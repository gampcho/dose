import type { Plan } from "@/lib/types"

const PLANS_KEY = "dose:plans"

function isClient(): boolean {
  return typeof window !== "undefined"
}

export function listPlans(): Plan[] {
  if (!isClient()) return []
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(PLANS_KEY) ?? "[]")
    if (!Array.isArray(raw)) return []
    return raw.map(migratePlan) as Plan[]
  } catch {
    return []
  }
}

function migratePlan(p: Record<string, unknown>) {
  const meds = Array.isArray(p.medications)
    ? (p.medications as Record<string, unknown>[]).map(migrateMed)
    : []
  return {
    id: String(p.id ?? ""),
    name: String(p.name ?? ""),
    medications: meds,
    createdAt: String(p.createdAt ?? ""),
  }
}

function migrateMed(m: Record<string, unknown>) {
  return {
    id: String(m.id ?? ""),
    name: String(m.name ?? ""),
    classId: typeof m.classId === "number" ? m.classId : null,
    doses: (m as { doses?: unknown; schedules?: unknown }).doses
      ?? (m as { schedules?: unknown }).schedules
      ?? [],
    mealTiming: m.mealTiming ?? null,
    notes: String(m.notes ?? ""),
    createdAt: String(m.createdAt ?? ""),
  }
}

function savePlans(plans: Plan[]): void {
  if (!isClient()) return
  localStorage.setItem(PLANS_KEY, JSON.stringify(plans))
}

export function getPlan(id: string): Plan | undefined {
  return listPlans().find((p) => p.id === id)
}

export function upsertPlan(plan: Plan): void {
  const plans = listPlans()
  const idx = plans.findIndex((p) => p.id === plan.id)
  if (idx >= 0) plans[idx] = plan
  else plans.push(plan)
  savePlans(plans)
}

export function deletePlan(id: string): void {
  savePlans(listPlans().filter((p) => p.id !== id))
}

export function generateId(): string {
  return crypto.randomUUID()
}

export const verifyImageKey = (planId: string): string =>
  `dose:verify:image:${planId}`
