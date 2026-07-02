import type { TextBox } from "@/lib/ocr"

export type OcrQualityStatus = "no_text" | "too_short" | "low_confidence" | "readable"

export interface OcrQuality {
  status: OcrQualityStatus
  text: string
  averageConfidence: number
  shouldParse: boolean
  message: string
}

const MIN_TEXT_LENGTH = 10
const LOW_CONFIDENCE = 0.5

export function classifyOcrQuality(boxes: TextBox[]): OcrQuality {
  const text = boxes.map((box) => box.text).join("\n").trim()
  const averageConfidence = average(boxes.map((box) => box.confidence))

  if (boxes.length === 0) {
    return quality("no_text", text, 0, false, "Không tìm thấy chữ trong ảnh. Vui lòng chụp lại hoặc nhập tay.")
  }

  if (text.length < MIN_TEXT_LENGTH) {
    return quality("too_short", text, averageConfidence, false, "Không đọc được đơn thuốc, vui lòng nhập tay.")
  }

  if (averageConfidence < LOW_CONFIDENCE) {
    return quality("low_confidence", text, averageConfidence, true, "Ảnh đơn thuốc chưa rõ. Vui lòng kiểm tra lại kết quả trước khi lưu.")
  }

  return quality("readable", text, averageConfidence, true, "")
}

function quality(
  status: OcrQualityStatus,
  text: string,
  averageConfidence: number,
  shouldParse: boolean,
  message: string,
): OcrQuality {
  return { status, text, averageConfidence, shouldParse, message }
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}
