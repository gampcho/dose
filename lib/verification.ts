import type { Plan, Medication, Result, Session, MealTiming } from "@/lib/types"
import type { Detection } from "@/lib/yolo"
import { findDrug, comparePills } from "@/lib/catalog"

export type OverallStatus = "pass" | "fail" | "manual_check"

export interface IdentityMed {
  med: Medication
  present: boolean
  name: string
}

export interface VerificationResult {
  results: Result[]
  identityMeds: IdentityMed[]
  unknownMeds: Medication[]
  unknownDetected: number
  status: OverallStatus
}

export function mergeAllPlans(plans: Plan[]): Medication[] {
  const meds: Medication[] = []
  for (const p of plans) {
    for (const m of p.medications) {
      meds.push(m)
    }
  }
  return meds
}

export function verify(
  plans: Plan[],
  detections: Detection[],
  session: Session,
  mealTiming: MealTiming,
): VerificationResult {
  const meds = mergeAllPlans(plans)

  const expected: Record<number, number> = {}
  const unitMap: Record<number, string> = {}
  const unknown: Medication[] = []
  const identity: IdentityMed[] = []

  for (const med of meds) {
    if (med.doses.length === 0) {
      const match = findDrug(med.name)
      const classIds = med.classId !== null ? [med.classId] : match?.classIds ?? []
      const present = classIds.length > 0 && detections.some((d) => classIds.includes(d.classId))
      identity.push({ med, present, name: match?.matchedName ?? med.name })
      continue
    }

    const doses = med.doses.filter((d) => {
      if (d.session !== session) return false
      if (mealTiming && med.mealTiming && med.mealTiming !== mealTiming) return false
      return true
    })
    if (doses.length === 0) continue

    const total = doses.reduce((s, sc) => s + sc.pillCount, 0)
    const match = findDrug(med.name)
    const allClassIds = match?.classIds ?? (med.classId !== null ? [med.classId] : [])

    if (allClassIds.length > 0) {
      for (const cid of allClassIds) {
        expected[cid] = (expected[cid] ?? 0) + total
        unitMap[cid] = med.unit
      }
    } else {
      unknown.push(med)
    }
  }

  const unknownClassIds = new Set(
    unknown.flatMap((m) => findDrug(m.name)?.classIds ?? []),
  )
  const unknownDetected = detections.filter((d) =>
    unknownClassIds.has(d.classId),
  ).length

  const results = comparePills(expected, detections, unitMap)

  const classToDrug = new Map<number, number[]>()
  for (const med of meds) {
    const match = findDrug(med.name)
    if (match && match.classIds.length > 1) {
      for (const cid of match.classIds) {
        classToDrug.set(cid, match.classIds)
      }
    }
  }

  const merged = new Map<number, Result>()
  for (const r of results) {
    const siblings = classToDrug.get(r.classId)
    if (siblings) {
      const existing = siblings.find((id) => merged.has(id) && merged.get(id)!.status !== "missing")
      if (existing) {
        const prev = merged.get(existing)!
        prev.detected += r.detected
        prev.confidence = Math.max(prev.confidence, r.confidence)
        if (prev.status === "missing") prev.status = r.status
        continue
      }
    }
    merged.set(r.classId, r)
  }

  const mergedResults = Array.from(merged.values())
  const status = computeStatus(mergedResults, identity, unknownDetected)

  return {
    results: mergedResults,
    identityMeds: identity,
    unknownMeds: unknown,
    unknownDetected,
    status,
  }
}

function computeStatus(
  results: Result[],
  identityMeds: IdentityMed[],
  unknownDetected: number,
): OverallStatus {
  const hasScheduledFail = results.some((r) => r.status === "missing" || r.status === "extra" || r.status === "unclear")
  if (hasScheduledFail) return "fail"

  const hasManualCheck = identityMeds.some((m) => !m.present) || unknownDetected > 0
  if (hasManualCheck) return "manual_check"

  return "pass"
}
