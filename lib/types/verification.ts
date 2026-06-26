import type { MedicationSession, TreatmentPlan } from "./domain"

export interface MedicationResult {
  medicationId: string
  name: string
  session: MedicationSession
  expected: number
  detected: number
  status: "pass" | "fail" | "warning"
}

/** Tạo mock results từ medications trong plan (AI engine sẽ thay thế sau) */
export function generateMockResults(plan: TreatmentPlan): MedicationResult[] {
  const results: MedicationResult[] = []
  for (const med of plan.medications) {
    for (const schedule of med.schedules) {
      const scenarios = [
        { detected: schedule.pillCount, status: "pass" as const },
        { detected: schedule.pillCount + 1, status: "fail" as const },
        { detected: schedule.pillCount - 1, status: "fail" as const },
        { detected: schedule.pillCount, status: "warning" as const },
      ]
      const pick = scenarios[Math.floor(Math.random() * scenarios.length)]
      results.push({
        medicationId: med.id,
        name: med.name,
        session: schedule.session,
        expected: schedule.pillCount,
        detected: pick.detected,
        status: pick.status,
      })
    }
  }
  return results
}
