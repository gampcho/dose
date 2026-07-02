import { describe, expect, test } from "bun:test"

import { mapBoxToSourceImage } from "../lib/yolo"
import { OOD_CLASS_ID, resolveOpenSetClass } from "../lib/yolo-safety"

function scores(entries: Record<number, number>): number[] {
  const values = Array.from({ length: 108 }, () => 0)
  for (const [classId, confidence] of Object.entries(entries)) {
    values[Number(classId)] = confidence
  }
  return values
}

describe("resolveOpenSetClass", () => {
  test("keeps a strong known class", () => {
    const result = resolveOpenSetClass(scores({ 10: 0.9, 107: 0.2, 5: 0.4 }))

    expect(result.classId).toBe(10)
    expect(result.rawClassId).toBe(10)
    expect(result.uncertain).toBe(false)
  })

  test("uses outside-plan class when it is highest", () => {
    const result = resolveOpenSetClass(scores({ 10: 0.5, 107: 0.8 }))

    expect(result.classId).toBe(OOD_CLASS_ID)
    expect(result.rawClassId).toBe(OOD_CLASS_ID)
  })

  test("uses outside-plan class when it is competitive", () => {
    const result = resolveOpenSetClass(scores({ 10: 0.8, 107: 0.55 }))

    expect(result.classId).toBe(OOD_CLASS_ID)
    expect(result.rawClassId).toBe(10)
    expect(result.safetyReason).toBe("ood_competitive")
  })

  test("marks weak class margins as uncertain", () => {
    const result = resolveOpenSetClass(scores({ 10: 0.8, 11: 0.72 }))

    expect(result.classId).toBe(10)
    expect(result.uncertain).toBe(true)
    expect(result.safetyReason).toBe("weak_margin")
  })
})

describe("mapBoxToSourceImage", () => {
  test("removes letterbox padding before projecting to the source image", () => {
    const box = mapBoxToSourceImage(
      [160, 224, 480, 416],
      0.5,
      { x: 0, y: 160 },
      { width: 1280, height: 640 },
    )

    expect(box).toEqual({ x: 320, y: 128, w: 640, h: 384 })
  })
})
