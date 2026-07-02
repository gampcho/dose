import { describe, expect, test } from "bun:test"

import { normalizeLlmMedicine } from "../lib/parser"
import { sanitizePrescriptionText } from "../lib/prescription-sanitizer"
import { Prescription } from "../types"

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

describe("Prescription schema", () => {
  test("defaults optional LLM fields instead of rejecting usable meds", () => {
    const result = Prescription.safeParse([
      {
        name: "NOVOXIM-500",
      },
    ])

    expect(result.success).toBe(true)
    if (!result.success) return
    expect({
      quantity: result.data[0].quantity,
      sessions: result.data[0].sessions,
      condition: result.data[0].condition,
    }).toEqual({
      quantity: 0,
      sessions: [],
      condition: "none",
    })
  })

  test("allows none sessions with zero pills", () => {
    const result = Prescription.safeParse([
      {
        name: "DIAMICRON",
        sessions: [{ session: "none", pills: 0 }],
      },
    ])

    expect(result.success).toBe(true)
  })
})

describe("sanitizePrescriptionText", () => {
  test("removes likely patient data and keeps medication context", () => {
    const sanitized = sanitizePrescriptionText([
      "Bệnh viện Đa khoa",
      "Họ tên: Nguyễn Văn A",
      "Địa chỉ: 123 Lê Lợi",
      "1. Parseetamol 500mg",
      "Sáng 1 viên, trưa 1 viên, chiều 1 viên",
      "Bác sĩ: Trần B",
    ].join("\n"))

    expect(sanitized).toContain("Parseetamol 500mg")
    expect(sanitized).toContain("Sáng 1 viên")
    expect(sanitized.includes("Nguyễn Văn A")).toBe(false)
    expect(sanitized.includes("123 Lê Lợi")).toBe(false)
    expect(sanitized.includes("Bác sĩ")).toBe(false)
  })
})
