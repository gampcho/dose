export type MedicationSession = "morning" | "noon" | "afternoon" | "evening"

export interface MedicationSchedule {
  session: MedicationSession
  pillCount: number
  notes?: string
}

export interface Medication {
  id: string
  name: string
  schedules: MedicationSchedule[]
  instructions: string
  createdAt: string
}

export interface TreatmentPlan {
  id: string
  name: string
  medications: Medication[]
  createdAt: string
}

export interface DoseLog {
  medicationId: string
  treatmentPlanId: string
  session: MedicationSession
  takenAt: string
  date: string
}
