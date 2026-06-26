import type { MedicationSession } from "./domain"

export interface ScheduleState {
  enabled: boolean
  pillCount: number
}

export type ScheduleMap = Record<MedicationSession, ScheduleState>

export const defaultSchedules = (): ScheduleMap => ({
  morning: { enabled: false, pillCount: 1 },
  noon: { enabled: false, pillCount: 1 },
  afternoon: { enabled: false, pillCount: 1 },
  evening: { enabled: false, pillCount: 1 },
})
