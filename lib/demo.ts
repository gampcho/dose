import scenarios from "@/demo/scenarios.json"
import examples from "@/demo/examples.json"
import type { Dose, MealTiming, Medication, Plan, Session } from "@/lib/types"

interface DemoMedication {
  name: string
  classId: number | null
  doses: Dose[]
  mealTiming: MealTiming
}

export interface DemoScenario {
  id: string
  name: string
  description: string
  prescription: string
  pilltray: string
  tray_session: Session
  meal_timing: MealTiming
  plan: {
    medications: DemoMedication[]
  }
  detections: { classId: number; confidence: number; label: string }[]
  expected_overall: "pass" | "fail" | "manual_check"
}

export interface DemoExample {
  id: string
  kind: "prescription_dataset_photo" | "pill_dataset_photo"
  variant?: "tight" | "context"
  file: string
  sourceImage?: string
  sourceDataset?: string
  sourceSplit?: string
  sourceShard?: string
  sourceIndex?: number
  sourceFilename?: string
  width?: number
  height?: number
  classId?: number
  classIds?: number[]
  classNames?: string[]
  label?: string
  labels?: string[]
  confidence?: number
  bbox?: [number, number, number, number]
  cropBox?: [number, number, number, number]
  annotationCount?: number
  textCount?: number
  boxCount?: number
  verifiedBy: string
}

export const DEMO_SCENARIOS = scenarios as DemoScenario[]

export const DEMO_EXAMPLES = examples.examples as DemoExample[]
export const DEMO_EXAMPLE_CLASS_COVERAGE = examples.pillClassCoverage as number[]

export const FEATURED_DEMO_IDS = [
  "verified_pass",
  "verified_missing",
  "verified_extra",
  "verified_manual_check",
]

export function findDemoScenario(id: string): DemoScenario | undefined {
  return DEMO_SCENARIOS.find((scenario) => scenario.id === id)
}

export function demoAssetPath(fileName: string): string {
  return `/demo/${fileName}`
}

export function buildDemoPlan(scenario: DemoScenario): Plan {
  const createdAt = new Date().toISOString()
  return {
    id: `demo-${scenario.id}`,
    name: scenario.name,
    medications: scenario.plan.medications.map((med, index) =>
      buildDemoMedication(scenario, med, index, createdAt),
    ),
    createdAt,
  }
}

function buildDemoMedication(
  scenario: DemoScenario,
  med: DemoMedication,
  index: number,
  createdAt: string,
): Medication {
  return {
    id: `demo-${scenario.id}-${index}`,
    name: med.name,
    classId: med.classId,
    doses: med.doses,
    mealTiming: med.mealTiming,
    unit: "viên",
    notes: "Kịch bản demo",
    createdAt,
  }
}
