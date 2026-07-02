import { describe, expect, test } from "bun:test"

import { classifyOcrQuality } from "../lib/ocr-quality"
import type { TextBox } from "../lib/ocr"

function box(text: string, confidence: number): TextBox {
  return {
    text,
    confidence,
    bbox: { x: 0, y: 0, w: 20, h: 10 },
  }
}

describe("classifyOcrQuality", () => {
  test("asks for retake when no text boxes are found", () => {
    expect(classifyOcrQuality([]).status).toBe("no_text")
  })

  test("asks for manual entry when text is too short", () => {
    expect(classifyOcrQuality([box("abc", 0.9)]).status).toBe("too_short")
  })

  test("warns when average confidence is low", () => {
    expect(
      classifyOcrQuality([
        box("PARACETAMOL 500MG", 0.35),
        box("Sáng 1 viên", 0.45),
      ]).status,
    ).toBe("low_confidence")
  })

  test("accepts readable OCR text", () => {
    expect(
      classifyOcrQuality([
        box("PARACETAMOL 500MG", 0.82),
        box("Sáng 1 viên", 0.76),
      ]).status,
    ).toBe("readable")
  })
})
