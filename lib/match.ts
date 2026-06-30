import type { MedicineType } from "@/types"
import type { Detection } from "@/lib/yolo"
import { getClassName, matchClassName } from "@/lib/verify"

export type EatingStatus = "before_eat" | "after_eat" | "unknown"

export interface MatchInput {
  now: Date
  eaten: EatingStatus
  detections: Detection[]
  prescription: MedicineType[]
}

export type MatchStatus =
  | "correct"
  | "missing"
  | "extra"
  | "wrong_count"

export interface MatchResult {
  medicine: MedicineType
  classId: number | null
  detectedCount: number
  expectedCount: number
  confidence: number
  status: MatchStatus
}

function getCurrentSession(now: Date): MedicineType["session"] {
  const h = now.getHours()
  if (h >= 5 && h < 10) return "morning"
  if (h >= 10 && h < 14) return "noon"
  if (h >= 14 && h < 18) return "afternoon"
  return "evening"
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function nameSimilarity(a: string, b: string): number {
  const na = normalize(a)
  const nb = normalize(b)
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.9

  const longer = na.length > nb.length ? na : nb
  const shorter = na.length > nb.length ? nb : na
  const costs: number[] = []
  for (let j = 0; j <= shorter.length; j++) costs[j] = j
  for (let i = 1; i <= longer.length; i++) {
    let prev = i
    for (let j = 1; j <= shorter.length; j++) {
      const cost = longer[i - 1] === shorter[j - 1] ? 0 : 1
      const val = Math.min(prev + 1, costs[j] + 1, costs[j - 1] + cost)
      costs[j - 1] = prev
      prev = val
    }
    costs[shorter.length] = prev
  }
  return 1 - costs[shorter.length] / longer.length
}

function findClassId(medName: string): number | null {
  const match = matchClassName(medName)
  return match?.classId ?? null
}

export function matchPills({
  now,
  eaten,
  detections,
  prescription,
}: MatchInput): MatchResult[] {
  const session = getCurrentSession(now)
  const expectedCondition: MedicineType["condition"] =
    eaten === "before_eat" ? "before_eat" : eaten === "after_eat" ? "after_eat" : "none"

  const relevant = prescription.filter((med) => {
    if (med.session !== "none" && med.session !== session) return false
    if (med.condition !== "none" && med.condition !== expectedCondition) return false
    return true
  })

  const detCounts = new Map<number, { count: number; conf: number }>()
  for (const d of detections) {
    const prev = detCounts.get(d.classId)
    if (prev) {
      prev.count++
      prev.conf = Math.max(prev.conf, d.confidence)
    } else {
      detCounts.set(d.classId, { count: 1, conf: d.confidence })
    }
  }

  const matchedDetClassIds = new Set<number>()
  const results: MatchResult[] = []

  for (const med of relevant) {
    let classId = findClassId(med.name)
    let detectedCount = 0
    let confidence = 0

    if (classId !== null) {
      const det = detCounts.get(classId)
      if (det) {
        detectedCount = det.count
        confidence = det.conf
        matchedDetClassIds.add(classId)
      }
    } else {
      let bestScore = 0
      let bestClassId = -1
      let bestConf = 0
      for (const [cid, det] of detCounts) {
        if (matchedDetClassIds.has(cid)) continue
        const className = getClassName(cid)
        const score = nameSimilarity(med.name, className)
        if (score > bestScore && score > 0.5) {
          bestScore = score
          bestClassId = cid
          bestConf = det.conf
        }
      }
      if (bestClassId !== -1) {
        classId = bestClassId
        const det = detCounts.get(bestClassId)
        detectedCount = det?.count ?? 0
        confidence = bestConf
        matchedDetClassIds.add(bestClassId)
      }
    }

    let status: MatchStatus
    if (classId === null || detectedCount === 0) {
      status = "missing"
    } else if (detectedCount < med.quantity) {
      status = "wrong_count"
    } else if (detectedCount > med.quantity) {
      status = "extra"
    } else {
      status = "correct"
    }

    results.push({
      medicine: med,
      classId,
      detectedCount,
      expectedCount: med.quantity,
      confidence,
      status,
    })
  }

  for (const [cid, det] of detCounts) {
    if (!matchedDetClassIds.has(cid)) {
      results.push({
        medicine: { name: getClassName(cid), known: false, quantity: 0, session: "none", condition: "none" },
        classId: cid,
        detectedCount: det.count,
        expectedCount: 0,
        confidence: det.conf,
        status: "extra",
      })
    }
  }

  return results
}

export function getCurrentSessionFromTime(now: Date): MedicineType["session"] {
  return getCurrentSession(now)
}
