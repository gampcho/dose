import { describe, expect, test } from "bun:test"

import { verify } from "../lib/verification"
import type { Detection } from "../lib/yolo"
import type { Medication, Plan, Session } from "../lib/types"

function med(overrides: Partial<Medication>): Medication {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: overrides.name ?? "Test med",
    classId: Object.hasOwn(overrides, "classId") ? overrides.classId! : 1,
    doses: overrides.doses ?? [{ session: "morning", pillCount: 1 }],
    mealTiming: overrides.mealTiming ?? null,
    unit: overrides.unit ?? "viên",
    notes: overrides.notes ?? "",
    createdAt: overrides.createdAt ?? "2026-07-01T00:00:00.000Z",
  }
}

function plan(medications: Medication[]): Plan {
  return {
    id: "plan-1",
    name: "Plan",
    medications,
    createdAt: "2026-07-01T00:00:00.000Z",
  }
}

function detection(classId: number, confidence = 0.9): Detection {
  return {
    classId,
    confidence,
    bbox: { x: 0, y: 0, w: 10, h: 10 },
  }
}

function run(
  medications: Medication[],
  detections: Detection[],
  session: Session = "morning",
) {
  return verify([plan(medications)], detections, session, null)
}

describe("verify", () => {
  test("marks scheduled meds correct, missing, extra, and unclear", () => {
    expect(run([med({ classId: 1 })], [detection(1)]).results[0].status).toBe(
      "correct",
    )
    expect(run([med({ classId: 1 })], []).results[0].status).toBe("missing")
    expect(
      run([med({ classId: 1 })], [detection(1), detection(1)]).results[0]
        .status,
    ).toBe("extra")
    expect(
      run([med({ classId: 1 })], [detection(1, 0.4)]).results[0].status,
    ).toBe("unclear")
  })

  test("presence-only meds do not also become extra detections", () => {
    const result = run([med({ classId: 7, doses: [] })], [detection(7)])

    expect(result.identityMeds).toHaveLength(1)
    expect(result.identityMeds[0].present).toBe(true)
    expect(result.results).toHaveLength(0)
    expect(result.status).toBe("pass")
  })

  test("unknown scheduled meds require manual check", () => {
    const result = run([med({ classId: null, name: "DIAMICRON" })], [])

    expect(result.unknownMeds).toHaveLength(1)
    expect(result.status).toBe("manual_check")
  })

  test("unknown scheduled meds expose active expected count only", () => {
    const result = run(
      [
        med({
          classId: null,
          doses: [
            { session: "morning", pillCount: 1 },
            { session: "evening", pillCount: 3 },
          ],
        }),
      ],
      [],
    )

    expect(result.unknownMeds[0].expected).toBe(1)
  })
})
