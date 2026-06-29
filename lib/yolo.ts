import * as ort from "onnxruntime-web"

const MODEL_URL = "/models/vaipe12n.onnx"
const INPUT_SIZE = 640
const CONF_THRESHOLD = 0.45
const IOU_THRESHOLD = 0.5

let session: ort.InferenceSession | null = null

async function getSession() {
  if (!session) {
    ort.env.wasm.numThreads = navigator.hardwareConcurrency ?? 4
    session = await ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ["webgpu", "wasm"],
    })
  }
  return session
}

function letterbox(
  img: HTMLImageElement | HTMLCanvasElement,
): { tensor: ort.Tensor; pad: { x: number; y: number }; scale: number } {
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
      if (j <= i || suppressed.has(j)) continue
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
  bbox: { x: number; y: number; w: number; h: number }
}

export async function detect(
  img: HTMLImageElement | HTMLCanvasElement,
): Promise<Detection[]> {
  const sess = await getSession()
  const { tensor, pad, scale } = letterbox(img)

  const output = await sess.run({ images: tensor })
  const outTensor = Object.values(output)[0]
  const data = outTensor.data as Float32Array
  const nc = 108
  const numAnchors = data.length / (nc + 4)

  const boxes: number[][] = []
  const scores: number[] = []
  const classIds: number[] = []

  for (let i = 0; i < numAnchors; i++) {
    const cx = data[i] - pad.x
    const cy = data[numAnchors + i] - pad.y
    const w = data[2 * numAnchors + i]
    const h = data[3 * numAnchors + i]

    let bestScore = 0
    let bestClass = -1
    for (let c = 0; c < nc; c++) {
      const s = data[(4 + c) * numAnchors + i]
      if (s > bestScore) {
        bestScore = s
        bestClass = c
      }
    }

    if (bestScore < CONF_THRESHOLD) continue

    boxes.push([
      (cx - w / 2) / scale,
      (cy - h / 2) / scale,
      (cx + w / 2) / scale,
      (cy + h / 2) / scale,
    ])
    scores.push(bestScore)
    classIds.push(bestClass)
  }

  const keep = nms(boxes, scores, IOU_THRESHOLD)
  return keep.map((i) => ({
    classId: classIds[i],
    confidence: scores[i],
    bbox: {
      x: Math.round(boxes[i][0]),
      y: Math.round(boxes[i][1]),
      w: Math.round(boxes[i][2] - boxes[i][0]),
      h: Math.round(boxes[i][3] - boxes[i][1]),
    },
  }))
}
