import type { MedicationSession } from "./domain"

export const SESSION_LABELS: Record<MedicationSession, string> = {
  morning: "Sáng",
  noon: "Trưa",
  afternoon: "Chiều",
  evening: "Tối",
}
