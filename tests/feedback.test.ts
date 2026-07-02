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
          feedback: "correct",
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
    expect(exported.items).toHaveLength(1)
  })
})
