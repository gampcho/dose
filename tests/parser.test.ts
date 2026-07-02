import { describe, expect, test } from "bun:test"

import { normalizeLlmMedicine } from "../lib/parser"

describe("normalizeLlmMedicine", () => {
  test("drops none sessions instead of casting them into domain doses", () => {
    const med = normalizeLlmMedicine({
      name: "DIAMICRON",
      quantity: 30,
      sessions: [
        { session: "none", pills: 1 },
        { session: "morning", pills: 2 },
      ],
      dosage: "30mg",
      unit: "viên",
      condition: "none",
    })

    expect(med.doses).toEqual([{ session: "morning", pillCount: 2 }])
  })
})
