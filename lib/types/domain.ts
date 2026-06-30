export type MedicationSession = "morning" | "noon" | "afternoon" | "evening"

export interface MedicationSchedule {
  session: MedicationSession
  pillCount: number
  notes?: string
}

export type MealTiming = "before" | "after" | null

export interface Medication {
  id: string
  name: string
  schedules: MedicationSchedule[]
  mealTiming: MealTiming
  notes: string
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
