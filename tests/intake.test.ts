import { describe, expect, test } from "bun:test"

import { buildIntakeSpeech, getDueMedications } from "../lib/intake"
import type { Plan } from "../lib/types"

const plans: Plan[] = [{
  id: "plan-1",
  name: "Đơn thuốc 1",
  createdAt: "",
  medications: [
    {
      id: "a",
      name: "Paracetamol",
      classId: 0,
      doses: [{ session: "morning", pillCount: 2 }],
      mealTiming: null,
      unit: "viên",
      notes: "",
      createdAt: "",
    },
    {
      id: "b",
      name: "Ebitac",
      classId: 45,
      doses: [{ session: "morning", pillCount: 1 }],
      mealTiming: "before",
      unit: "viên",
      notes: "",
      createdAt: "",
    },
    {
      id: "c",
      name: "Atoris",
      classId: 13,
      doses: [{ session: "evening", pillCount: 1 }],
      mealTiming: null,
      unit: "viên",
      notes: "",
      createdAt: "",
    },
  ],
}]

describe("getDueMedications", () => {
  test("returns scheduled meds for the current session", () => {
    const due = getDueMedications(plans, "morning", null)

    expect(due.map((item) => item.med.name)).toEqual(["Paracetamol", "Ebitac"])
  })

  test("filters by meal timing when selected", () => {
    const due = getDueMedications(plans, "morning", "after")

    expect(due.map((item) => item.med.name)).toEqual([])
  })

  test("shows only exact meal-timing matches for before-meal view", () => {
    const due = getDueMedications(plans, "morning", "before")

    expect(due.map((item) => item.med.name)).toEqual(["Ebitac"])
  })
})

describe("buildIntakeSpeech", () => {
  test("speaks a clear list of medicines to take", () => {
    const speech = buildIntakeSpeech(getDueMedications(plans, "morning", null), "morning", null)

    expect(speech).toContain("bạn cần uống 2 loại thuốc")
    expect(speech).toContain("Paracetamol, 2 viên")
  })
})
