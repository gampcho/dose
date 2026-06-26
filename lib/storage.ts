import type { TreatmentPlan, DoseLog } from "@/lib/types"

const PLANS_KEY = "dose:plans"
const LOGS_KEY = "dose:logs"

export function getPlans(): TreatmentPlan[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(PLANS_KEY) ?? "[]")
  } catch {
    return []
  }
}

export function savePlans(plans: TreatmentPlan[]): void {
  localStorage.setItem(PLANS_KEY, JSON.stringify(plans))
}

export function getPlan(id: string): TreatmentPlan | undefined {
  return getPlans().find((p) => p.id === id)
}

export function upsertPlan(plan: TreatmentPlan): void {
  const plans = getPlans()
  const idx = plans.findIndex((p) => p.id === plan.id)
  if (idx >= 0) {
    plans[idx] = plan
  } else {
    plans.push(plan)
  }
  savePlans(plans)
}

export function deletePlan(id: string): void {
  savePlans(getPlans().filter((p) => p.id !== id))
}

export function getLogs(): DoseLog[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(LOGS_KEY) ?? "[]")
  } catch {
    return []
  }
}

export function saveLogs(logs: DoseLog[]): void {
  localStorage.setItem(LOGS_KEY, JSON.stringify(logs))
}

export function getTodayLogs(date: string): DoseLog[] {
  return getLogs().filter((l) => l.date === date)
}

export function addLog(log: DoseLog): void {
  const logs = getLogs()
  logs.push(log)
  saveLogs(logs)
}

export function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
