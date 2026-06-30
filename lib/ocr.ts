import Tesseract from "tesseract.js"

export interface TextBox {
  bbox: { x: number; y: number; w: number; h: number }
  text: string
  confidence: number
}

let tessWorkerPromise: Promise<Tesseract.Worker> | null = null

function getTessWorker(): Promise<Tesseract.Worker> {
  if (!tessWorkerPromise) {
    tessWorkerPromise = Tesseract.createWorker("vie", undefined, {
      logger: () => {},
    })
  }
  return tessWorkerPromise
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let paddleService: { recognize: (input: any) => Promise<any[]> } | null = null

async function getPaddleService() {
  if (!paddleService) {
    const { PaddleOcrService } = await import("paddleocr")
    const ort = await import("onnxruntime-web/wasm")
    ort.env.wasm.numThreads = 1
    ort.env.wasm.wasmPaths = "/"

    const [detBytes, recBytes, dictRes] = await Promise.all([
      fetch("/models/det.onnx").then((r) => r.arrayBuffer()),
      fetch("/models/rec.onnx").then((r) => r.arrayBuffer()),
      fetch("/models/dict.txt").then((r) => r.text()),
    ])

    const dict = dictRes.split("\n").filter((c: string) => c.length > 0)

    paddleService = await PaddleOcrService.createInstance({
      ort,
      detection: { modelBuffer: detBytes },
      recognition: { modelBuffer: recBytes, charactersDictionary: dict },
    })
  }
  return paddleService
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

  type PaddleResult = {
    text: string
    confidence: number
    box: { x: number; y: number; width: number; height: number }
  }

  const results: PaddleResult[] = await service.recognize({
    width: w,
    height: h,
    data: new Uint8Array(imageData.data),
  })

  console.log("[OCR] PaddleOCR raw results:", JSON.stringify(results, null, 2))

  return results.map((r) => ({
    x: Math.round(r.box.x),
    y: Math.round(r.box.y),
    w: Math.round(r.box.width),
    h: Math.round(r.box.height),
  }))
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
    const cropCanvas = document.createElement("canvas")
    cropCanvas.width = box.w
    cropCanvas.height = box.h
    const ctx = cropCanvas.getContext("2d")!
    ctx.drawImage(canvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h)

    const { data } = await worker.recognize(cropCanvas)
    const text = data.text.trim()
    if (text.length > 0) {
      results.push({
        bbox: box,
        text,
        confidence: data.confidence / 100,
      })
    }
  }

  console.log("[OCR] Tesseract results:", results.map((r) => ({ text: r.text, conf: r.confidence, bbox: r.bbox })))

  return results
}
