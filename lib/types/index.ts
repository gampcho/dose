export type Session = "morning" | "noon" | "afternoon" | "evening"

export function getCurrentSession(now: Date = new Date()): Session {
  const h = now.getHours()
  if (h >= 5 && h < 10) return "morning"
  if (h >= 10 && h < 14) return "noon"
  if (h >= 14 && h < 18) return "afternoon"
  return "evening"
}
export type MealTiming = "before" | "after" | null

export interface Dose {
  session: Session
  pillCount: number
}

export interface Medication {
  id: string
  name: string
  classId: number | null
  doses: Dose[]
  mealTiming: MealTiming
  unit: string
  notes: string
  createdAt: string
}

export interface Plan {
  id: string
  name: string
  medications: Medication[]
  createdAt: string
}

export interface ParsedMed {
  name: string
  classId: number | null
  matchedName: string | null
  quantity: number
  dosage: string
  unit: string
  doses: Dose[]
  mealTiming: MealTiming
}

export interface Result {
  classId: number
  name: string
  expected: number
  detected: number
  confidence: number
  status: "correct" | "missing" | "extra" | "unclear"
}

export const SESSION_LABELS: Record<Session, string> = {
  morning: "Sáng",
  noon: "Trưa",
  afternoon: "Chiều",
  evening: "Tối",
}
