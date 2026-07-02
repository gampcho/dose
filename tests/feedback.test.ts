import { describe, expect, test } from "bun:test"

import { buildFeedbackExport, normalizeFeedbackItems } from "../lib/feedback"

describe("feedback helpers", () => {
  test("drops malformed feedback records", () => {
    expect(
      normalizeFeedbackItems([
        {
          id: "ok",
          createdAt: "now",
          resultName: "paracetamol",
          status: "correct",
          feedback: "incorrect_count",
          correctionCount: 2,
          bbox: { x: 1, y: 2, w: 3, h: 4 },
        },
        { id: "bad", feedback: "correct" },
      ]),
    ).toHaveLength(1)
  })

  test("exports feedback with metadata for review data", () => {
    const exported = buildFeedbackExport([
      {
        id: "ok",
        createdAt: "now",
        resultName: "paracetamol",
        status: "correct",
        feedback: "incorrect",
      },
    ])

    expect(exported.source).toBe("dose")
    expect(exported.schemaVersion).toBe(2)
    expect(exported.model.name).toBe("vaipe12n.onnx")
    expect(exported.items).toHaveLength(1)
  })
})
