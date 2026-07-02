import Tesseract from "tesseract.js"

interface PaddleOcrResult {
  text: string
  confidence: number
  box: { x: number; y: number; width: number; height: number }
}

interface PaddleOcrService {
  recognize(input: {
    width: number
    height: number
    data: Uint8Array
  }): Promise<PaddleOcrResult[]>
}

export interface TextBox {
  bbox: { x: number; y: number; w: number; h: number }
  text: string
  confidence: number
}

const BOX_SHIFT_X = 0.06
const BOX_SHIFT_Y = 0.1
const BOX_PAD_X = 0.04
const BOX_PAD_Y = 0.06

let tessWorkerPromise: Promise<Tesseract.Worker> | null = null

function getTessWorker(): Promise<Tesseract.Worker> {
  if (!tessWorkerPromise) {
    tessWorkerPromise = createTessWorker()
  }
  return tessWorkerPromise
}

async function createTessWorker(): Promise<Tesseract.Worker> {
  const worker = await Tesseract.createWorker("vie", Tesseract.OEM.LSTM_ONLY, {
    workerPath: "/tesseract-worker.min.js",
    corePath: "/tesseract-core",
    langPath: "/tessdata",
    gzip: true,
    logger: () => {},
  })

  await worker.setParameters({
    tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
    preserve_interword_spaces: "1",
    user_defined_dpi: "300",
  })

  return worker
}

let paddleService: PaddleOcrService | null = null

async function getPaddleService(): Promise<PaddleOcrService> {
  if (!paddleService) {
    paddleService = await createPaddleService()
  }
  return paddleService
}

async function createPaddleService(): Promise<PaddleOcrService> {
  const { PaddleOcrService } = await import("paddleocr")
  const ort = await import("onnxruntime-web/wasm")
  ort.env.wasm.numThreads = 1
  ort.env.wasm.wasmPaths = "/"

  const [detBytes, recBytes, dictRes] = await Promise.all([
    fetchModel("/models/det.onnx"),
    fetchModel("/models/rec.onnx"),
    fetchText("/models/dict.txt"),
  ])

  const dict = dictRes.split(/\r?\n/).filter((c) => c.length > 0)

  return PaddleOcrService.createInstance({
    ort,
    detection: { modelBuffer: detBytes },
    recognition: { modelBuffer: recBytes, charactersDictionary: dict },
  })
}

async function fetchModel(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Không tải được model OCR: ${url}`)
  return res.arrayBuffer()
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Không tải được dữ liệu OCR: ${url}`)
  return res.text()
}

function imageToCanvas(
  img: HTMLImageElement | HTMLCanvasElement,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  const w = img instanceof HTMLImageElement ? img.naturalWidth : img.width
  const h = img instanceof HTMLImageElement ? img.naturalHeight : img.height
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(img, 0, 0, w, h)
  return canvas
}

async function ocrPaddleDetect(
  img: HTMLImageElement | HTMLCanvasElement,
): Promise<{ x: number; y: number; w: number; h: number }[]> {
  const service = await getPaddleService()
  const canvas = imageToCanvas(img)
  const w = canvas.width
  const h = canvas.height
  const imageData = canvas.getContext("2d")!.getImageData(0, 0, w, h)

  const results = await service.recognize({
    width: w,
    height: h,
    data: new Uint8Array(imageData.data),
  })

  return results
    .map((r) => calibrateBox({
      x: r.box.x,
      y: r.box.y,
      w: r.box.width,
      h: r.box.height,
    }, w, h))
    .filter((box) => box.w > 0 && box.h > 0)
}

function calibrateBox(
  box: { x: number; y: number; w: number; h: number },
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } {
  const shiftX = box.w * BOX_SHIFT_X
  const shiftY = box.h * BOX_SHIFT_Y
  const padX = box.w * BOX_PAD_X
  const padY = box.h * BOX_PAD_Y

  return clampBox({
    x: Math.round(box.x + shiftX - padX),
    y: Math.round(box.y + shiftY - padY),
    w: Math.round(box.w + padX * 2),
    h: Math.round(box.h + padY * 2),
  }, width, height)
}

function clampBox(
  box: { x: number; y: number; w: number; h: number },
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } {
  const x = Math.max(0, Math.min(box.x, width))
  const y = Math.max(0, Math.min(box.y, height))
  const right = Math.max(x, Math.min(box.x + box.w, width))
  const bottom = Math.max(y, Math.min(box.y + box.h, height))

  return { x, y, w: right - x, h: bottom - y }
}

function cropBox(
  canvas: HTMLCanvasElement,
  box: { x: number; y: number; w: number; h: number },
): HTMLCanvasElement {
  const cropCanvas = document.createElement("canvas")
  cropCanvas.width = box.w
  cropCanvas.height = box.h
  const ctx = cropCanvas.getContext("2d")!
  ctx.drawImage(canvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h)
  return cropCanvas
}

export async function ocr(
  img: HTMLImageElement | HTMLCanvasElement,
): Promise<TextBox[]> {
  const boxes = await ocrPaddleDetect(img)
  if (boxes.length === 0) return []

  const canvas = imageToCanvas(img)
  const worker = await getTessWorker()

  const results: TextBox[] = []
  for (const box of boxes) {
    const { data } = await worker.recognize(cropBox(canvas, box))
    const text = data.text.trim()
    if (text.length > 0) {
      results.push({
        bbox: box,
        text,
        confidence: data.confidence / 100,
      })
    }
  }

  return results
}
