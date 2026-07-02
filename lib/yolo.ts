import * as ort from "onnxruntime-web/wasm"
import { resolveOpenSetClass } from "@/lib/yolo-safety"
import type { DetectionScores } from "@/lib/yolo-safety"

const MODEL_URL = "/models/vaipe12n.onnx"
const INPUT_SIZE = 640
const CONF_THRESHOLD = 0.25
const IOU_THRESHOLD = 0.5

let session: ort.InferenceSession | null = null

async function getSession() {
  if (!session) {
    ort.env.wasm.numThreads = 1
    ort.env.wasm.wasmPaths = "/"
    session = await ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ["wasm"],
    })
  }
  return session
}

function letterbox(img: HTMLImageElement | HTMLCanvasElement): {
  tensor: ort.Tensor
  pad: { x: number; y: number }
  scale: number
} {
  const w = img instanceof HTMLImageElement ? img.naturalWidth : img.width
  const h = img instanceof HTMLImageElement ? img.naturalHeight : img.height
  const scale = Math.min(INPUT_SIZE / w, INPUT_SIZE / h)
  const nw = Math.round(w * scale)
  const nh = Math.round(h * scale)
  const padX = (INPUT_SIZE - nw) / 2
  const padY = (INPUT_SIZE - nh) / 2

  const canvas = document.createElement("canvas")
  canvas.width = INPUT_SIZE
  canvas.height = INPUT_SIZE
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "#808080"
  ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE)
  ctx.drawImage(img, padX, padY, nw, nh)

  const data = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data
  const chw = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE)
  for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++) {
    chw[i] = data[i * 4] / 255
    chw[INPUT_SIZE * INPUT_SIZE + i] = data[i * 4 + 1] / 255
    chw[2 * INPUT_SIZE * INPUT_SIZE + i] = data[i * 4 + 2] / 255
  }

  return {
    tensor: new ort.Tensor("float32", chw, [1, 3, INPUT_SIZE, INPUT_SIZE]),
    pad: { x: padX, y: padY },
    scale,
  }
}

function nms(boxes: number[][], scores: number[], iouThresh: number): number[] {
  const order = scores
    .map((s, i) => [s, i] as [number, number])
    .sort((a, b) => b[0] - a[0])
    .map((x) => x[1])

  const keep: number[] = []
  const suppressed = new Set<number>()

  for (const i of order) {
    if (suppressed.has(i)) continue
    keep.push(i)
    for (const j of order) {
      if (j === i || suppressed.has(j)) continue
      if (iou(boxes[i], boxes[j]) > iouThresh) suppressed.add(j)
    }
  }
  return keep
}

function iou(a: number[], b: number[]): number {
  const x1 = Math.max(a[0], b[0])
  const y1 = Math.max(a[1], b[1])
  const x2 = Math.min(a[2], b[2])
  const y2 = Math.min(a[3], b[3])
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  const areaA = (a[2] - a[0]) * (a[3] - a[1])
  const areaB = (b[2] - b[0]) * (b[3] - b[1])
  return inter / (areaA + areaB - inter + 1e-7)
}

export interface Detection {
  classId: number
  confidence: number
  rawClassId?: number
  rawConfidence?: number
  secondClassId?: number
  secondConfidence?: number
  oodConfidence?: number
  margin?: number
  uncertain?: boolean
  safetyReason?: "low_confidence" | "weak_margin" | "ood_competitive"
  bbox: { x: number; y: number; w: number; h: number }
}

export function mapBoxToSourceImage(
  box: [number, number, number, number],
  scale: number,
  pad: { x: number; y: number },
  sourceSize: { width: number; height: number },
): { x: number; y: number; w: number; h: number } {
  const left = clamp(Math.round((box[0] - pad.x) / scale), 0, sourceSize.width)
  const top = clamp(Math.round((box[1] - pad.y) / scale), 0, sourceSize.height)
  const right = clamp(
    Math.round((box[2] - pad.x) / scale),
    left,
    sourceSize.width,
  )
  const bottom = clamp(
    Math.round((box[3] - pad.y) / scale),
    top,
    sourceSize.height,
  )

  return {
    x: left,
    y: top,
    w: right - left,
    h: bottom - top,
  }
}

export async function detect(
  img: HTMLImageElement | HTMLCanvasElement,
): Promise<Detection[]> {
  const sess = await getSession()
  const { tensor, scale, pad } = letterbox(img)
  const sourceSize = {
    width: img instanceof HTMLImageElement ? img.naturalWidth : img.width,
    height: img instanceof HTMLImageElement ? img.naturalHeight : img.height,
  }

  const output = await sess.run({ images: tensor })
  const outTensor = Object.values(output)[0]
  const data = outTensor.data as Float32Array
  const nc = 108
  const numAnchors = data.length / (nc + 4)

  const boxes: number[][] = []
  const scores: number[] = []
  const detectionScores: DetectionScores[] = []

  for (let i = 0; i < numAnchors; i++) {
    const cx = data[i]
    const cy = data[numAnchors + i]
    const w = data[2 * numAnchors + i]
    const h = data[3 * numAnchors + i]

    const classScores = new Float32Array(nc)
    for (let c = 0; c < nc; c++) {
      classScores[c] = data[(4 + c) * numAnchors + i]
    }

    const resolved = resolveOpenSetClass(classScores)
    if ((resolved.rawConfidence ?? resolved.confidence) < CONF_THRESHOLD) continue

    boxes.push([
      cx - w / 2,
      cy - h / 2,
      cx + w / 2,
      cy + h / 2,
    ])
    scores.push(resolved.confidence)
    detectionScores.push(resolved)
  }

  const keep = nms(boxes, scores, IOU_THRESHOLD)
  const sourceCanvas = createSourceCanvas(img)

  return keep.map((i) => {
    const rawBox = mapBoxToSourceImage(
      boxes[i] as [number, number, number, number],
      scale,
      pad,
      sourceSize,
    )

    return {
      ...detectionScores[i],
      bbox: refineDetectionBox(sourceCanvas, rawBox),
    }
  })
}

function createSourceCanvas(
  img: HTMLImageElement | HTMLCanvasElement,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  const width = img instanceof HTMLImageElement ? img.naturalWidth : img.width
  const height = img instanceof HTMLImageElement ? img.naturalHeight : img.height
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return canvas
  ctx.drawImage(img, 0, 0, width, height)
  return canvas
}

function refineDetectionBox(
  canvas: HTMLCanvasElement,
  box: { x: number; y: number; w: number; h: number },
): { x: number; y: number; w: number; h: number } {
  const margin = Math.max(16, Math.round(Math.max(box.w, box.h) * 0.2))
  const x0 = clamp(Math.floor(box.x - margin), 0, canvas.width - 1)
  const y0 = clamp(Math.floor(box.y - margin), 0, canvas.height - 1)
  const x1 = clamp(Math.ceil(box.x + box.w + margin), 0, canvas.width)
  const y1 = clamp(Math.ceil(box.y + box.h + margin), 0, canvas.height)
  const w = x1 - x0
  const h = y1 - y0
  if (w < 8 || h < 8) return box

  const ctx = canvas.getContext("2d")
  if (!ctx) return box

  const data = ctx.getImageData(x0, y0, w, h).data
  const background = estimateBackgroundColor(data, w, h)
  const threshold = 42
  const mask = new Uint8Array(w * h)
  const localRawBox = {
    x: clamp(box.x - x0, 0, w - 1),
    y: clamp(box.y - y0, 0, h - 1),
    w: clamp(box.w, 1, w),
    h: clamp(box.h, 1, h),
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x
      const pixel = idx * 4
      const dist = colorDistance(data, pixel, background)
      if (dist >= threshold) mask[idx] = 1
    }
  }

  const dilated = dilateMask(mask, w, h, 2)
  const bounds = findBestComponentBounds(dilated, w, h, localRawBox)
  if (!bounds) return box

  const area = bounds.w * bounds.h
  const cropArea = w * h
  if (area < 16 || area > cropArea * 0.95) return box

  return {
    x: x0 + bounds.x,
    y: y0 + bounds.y,
    w: bounds.w,
    h: bounds.h,
  }
}

function estimateBackgroundColor(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): [number, number, number] {
  let r = 0
  let g = 0
  let b = 0
  let count = 0
  const push = (index: number) => {
    r += data[index]
    g += data[index + 1]
    b += data[index + 2]
    count++
  }

  for (let x = 0; x < width; x++) {
    push(x * 4)
    push(((height - 1) * width + x) * 4)
  }
  for (let y = 1; y < height - 1; y++) {
    push((y * width) * 4)
    push((y * width + (width - 1)) * 4)
  }

  return [r / count, g / count, b / count]
}

function colorDistance(
  data: Uint8ClampedArray,
  index: number,
  background: [number, number, number],
): number {
  return (
    Math.abs(data[index] - background[0]) +
    Math.abs(data[index + 1] - background[1]) +
    Math.abs(data[index + 2] - background[2])
  )
}

function dilateMask(
  mask: Uint8Array,
  width: number,
  height: number,
  iterations: number,
): Uint8Array {
  let source = mask
  for (let iteration = 0; iteration < iterations; iteration++) {
    const next = new Uint8Array(source.length)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x
        if (source[index]) {
          next[index] = 1
          if (x > 0) next[index - 1] = 1
          if (x + 1 < width) next[index + 1] = 1
          if (y > 0) next[index - width] = 1
          if (y + 1 < height) next[index + width] = 1
        }
      }
    }
    source = next
  }
  return source
}

function findBestComponentBounds(
  mask: Uint8Array,
  width: number,
  height: number,
  rawBox: { x: number; y: number; w: number; h: number },
): { x: number; y: number; w: number; h: number } | null {
  const visited = new Uint8Array(mask.length)
  let best: { x: number; y: number; w: number; h: number } | null = null
  let bestScore = Number.NEGATIVE_INFINITY

  for (let index = 0; index < mask.length; index++) {
    if (!mask[index] || visited[index]) continue
    const bounds = floodFillBounds(mask, width, height, index, visited)
    if (!bounds) continue

    const score = componentScore(bounds, rawBox)
    if (score > bestScore) {
      best = bounds
      bestScore = score
    }
  }

  return best
}

function floodFillBounds(
  mask: Uint8Array,
  width: number,
  height: number,
  start: number,
  visited: Uint8Array = new Uint8Array(mask.length),
): { x: number; y: number; w: number; h: number } | null {
  const stack = [start]
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  let count = 0

  while (stack.length > 0) {
    const index = stack.pop()!
    if (visited[index] || !mask[index]) continue
    visited[index] = 1
    count++
    const y = Math.floor(index / width)
    const x = index - y * width
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
    if (x > 0) stack.push(index - 1)
    if (x + 1 < width) stack.push(index + 1)
    if (y > 0) stack.push(index - width)
    if (y + 1 < height) stack.push(index + width)
  }

  if (count === 0 || maxX < minX || maxY < minY) return null
  return {
    x: minX,
    y: minY,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
  }
}

function componentScore(
  bounds: { x: number; y: number; w: number; h: number },
  rawBox: { x: number; y: number; w: number; h: number },
): number {
  const boundsBox = {
    left: bounds.x,
    top: bounds.y,
    right: bounds.x + bounds.w,
    bottom: bounds.y + bounds.h,
  }
  const raw = {
    left: rawBox.x,
    top: rawBox.y,
    right: rawBox.x + rawBox.w,
    bottom: rawBox.y + rawBox.h,
  }
  const overlap = boxIoU(boundsBox, raw)
  const centerX = rawBox.x + rawBox.w / 2
  const centerY = rawBox.y + rawBox.h / 2
  const containsCenter =
    centerX >= boundsBox.left &&
    centerX <= boundsBox.right &&
    centerY >= boundsBox.top &&
    centerY <= boundsBox.bottom
  const sizePenalty =
    Math.abs(bounds.w - rawBox.w) / Math.max(rawBox.w, 1) +
    Math.abs(bounds.h - rawBox.h) / Math.max(rawBox.h, 1)

  return overlap * 4 + (containsCenter ? 1.5 : 0) - sizePenalty
}

function boxIoU(
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number },
): number {
  const x1 = Math.max(a.left, b.left)
  const y1 = Math.max(a.top, b.top)
  const x2 = Math.min(a.right, b.right)
  const y2 = Math.min(a.bottom, b.bottom)
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  const areaA = Math.max(0, a.right - a.left) * Math.max(0, a.bottom - a.top)
  const areaB = Math.max(0, b.right - b.left) * Math.max(0, b.bottom - b.top)
  return inter / (areaA + areaB - inter + 1e-7)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max))
}
