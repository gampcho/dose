import type { MedicationSession } from "./domain"

export interface MedicationResult {
  medicationId: string
  name: string
  session: MedicationSession
  expected: number
  detected: number
  status: "pass" | "fail" | "warning"
}
