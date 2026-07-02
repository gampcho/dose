import { describe, expect, test } from "bun:test"
import { existsSync } from "node:fs"
import path from "node:path"

import {
  DEMO_EXAMPLE_CLASS_COVERAGE,
  DEMO_EXAMPLES,
  FEATURED_DEMO_IDS,
  DEMO_SCENARIOS,
  buildDemoPlan,
  demoAssetPath,
  findDemoScenario,
} from "../lib/demo"
import { verify } from "../lib/verification"

describe("demo scenarios", () => {
  test("featured scenarios build valid local plans", () => {
    for (const id of FEATURED_DEMO_IDS) {
      const scenario = findDemoScenario(id)
      expect(Boolean(scenario)).toBe(true)

      const plan = buildDemoPlan(scenario!)
      expect(plan.id).toBe(`demo-${id}`)
      expect(plan.medications.length > 0).toBe(true)
      expect(demoAssetPath(scenario!.pilltray)).toContain("/demo/")
    }
  })

  test("verified scenarios produce their declared verification status", () => {
    for (const scenario of DEMO_SCENARIOS) {
      const detections = scenario.detections.map((detection) => ({
        classId: detection.classId,
        confidence: detection.confidence,
        bbox: { x: 0, y: 0, w: 10, h: 10 },
      }))
      const result = verify(
        [buildDemoPlan(scenario)],
        detections,
        scenario.tray_session,
        scenario.meal_timing,
      )

      expect(result.status).toBe(scenario.expected_overall)
    }
  })

  test("demo examples use uncropped real VAIPE dataset assets", () => {
    expect(DEMO_EXAMPLES.length >= 20).toBe(true)
    expect(DEMO_EXAMPLES.length <= 25).toBe(true)
    expect(DEMO_EXAMPLE_CLASS_COVERAGE.length > 20).toBe(true)
    expect(DEMO_EXAMPLE_CLASS_COVERAGE).toContain(107)

    const kinds = new Set(DEMO_EXAMPLES.map((example) => example.kind))
    expect(kinds.has("prescription_dataset_photo")).toBe(true)
    expect(kinds.has("pill_dataset_photo")).toBe(true)

    const prescriptionExamples = DEMO_EXAMPLES.filter(
      (example) => example.kind === "prescription_dataset_photo",
    )
    const pillExamples = DEMO_EXAMPLES.filter(
      (example) => example.kind === "pill_dataset_photo",
    )
    expect(prescriptionExamples).toHaveLength(12)
    expect(pillExamples).toHaveLength(12)

    for (const example of DEMO_EXAMPLES) {
      expect(existsSync(path.join("demo", example.file))).toBe(true)
      expect(existsSync(path.join("public/demo", example.file))).toBe(true)
      if (example.kind === "pill_dataset_photo") {
        expect(example.verifiedBy).toBe(
          "yolo-raw-match-huggingface-cache-original-image",
        )
      } else {
        expect(example.verifiedBy).toBe("huggingface-cache-original-image")
      }
    }
  })
})
