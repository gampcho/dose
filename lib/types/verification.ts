export interface MedicationResult {
  classId: number
  name: string
  expected: number
  detected: number
  confidence: number
  status: "pass" | "fail" | "extra"
}
