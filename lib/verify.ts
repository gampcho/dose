import type { Detection } from "@/lib/yolo"
import type { MedicationResult } from "@/lib/types"

let classNames: Record<string, string> | null = null
let reverseMap: Map<string, number> | null = null
let drugGroups: Record<string, number[]> | null = null
let classToDrug: Map<number, string> | null = null

export async function loadClassNames(): Promise<Record<string, string>> {
  if (!classNames) {
    const [classRes, groupRes] = await Promise.all([
      fetch("/models/class_names.json"),
      fetch("/models/drug_groups.json"),
    ])
    classNames = await classRes.json()
    drugGroups = await groupRes.json()

    reverseMap = new Map(
      Object.entries(classNames!).map(([id, name]) => [name.toLowerCase(), Number(id)]),
    )

    classToDrug = new Map()
    for (const [drug, ids] of Object.entries(drugGroups!)) {
      for (const id of ids) {
        classToDrug.set(id, drug)
      }
    }
  }
  return classNames!
}

export function getClassName(classId: number): string {
  if (!classNames) return `class_${classId}`
  return classNames[String(classId)] ?? `class_${classId}`
}

export function getDrugName(classId: number): string {
  if (!classToDrug) return getClassName(classId)
  return classToDrug.get(classId) ?? getClassName(classId)
}

export function getDrugClassIds(drugName: string): number[] {
  if (!drugGroups) return []
  const norm = normalize(drugName)
  for (const [drug, ids] of Object.entries(drugGroups)) {
    if (normalize(drug) === norm) return ids
  }
  return []
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

function similarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length === 0 || b.length === 0) return 0

  const longer = a.length > b.length ? a : b
  const shorter = a.length > b.length ? b : a

  if (longer.includes(shorter)) return shorter.length / longer.length

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

export function matchClassName(medName: string): { classId: number; name: string } | null {
  if (!reverseMap) return null
  const norm = normalize(medName)

  let bestId = -1
  let bestScore = 0

  for (const [className, classId] of reverseMap) {
    const score = similarity(norm, normalize(className))
    if (score > bestScore) {
      bestScore = score
      bestId = classId
    }
  }

  if (bestId === -1 || bestScore < 0.4) return null
  return { classId: bestId, name: getClassName(bestId) }
}

export function matchDrug(medName: string): { drug: string; classIds: number[] } | null {
  if (!drugGroups) return null
  const norm = normalize(medName)

  let bestDrug: string | null = null
  let bestScore = 0

  for (const drug of Object.keys(drugGroups!)) {
    const score = similarity(norm, normalize(drug))
    if (score > bestScore) {
      bestScore = score
      bestDrug = drug
    }
  }

  if (!bestDrug || bestScore < 0.4) return null
  return { drug: bestDrug, classIds: drugGroups![bestDrug] }
}

export function verify(
  expected: Record<number, number>,
  detections: Detection[],
): MedicationResult[] {
  const detectedCounts = new Map<number, { count: number; conf: number }>()
  for (const d of detections) {
    const prev = detectedCounts.get(d.classId)
    if (prev) {
      prev.count++
      prev.conf = Math.max(prev.conf, d.confidence)
    } else {
      detectedCounts.set(d.classId, { count: 1, conf: d.confidence })
    }
  }

  const items: MedicationResult[] = []

  for (const [classId, expectedCount] of Object.entries(expected)) {
    const cid = Number(classId)
    const det = detectedCounts.get(cid)
    detectedCounts.delete(cid)

    const detectedCount = det?.count ?? 0
    const confidence = det?.conf ?? 0

    let status: MedicationResult["status"]
    if (detectedCount === 0) status = "fail"
    else if (detectedCount < expectedCount) status = "fail"
    else if (detectedCount > expectedCount) status = "extra"
    else status = "pass"

    items.push({
      classId: cid,
      name: getClassName(cid),
      expected: expectedCount,
      detected: detectedCount,
      confidence,
      status,
    })
  }

  for (const [classId, det] of detectedCounts) {
    items.push({
      classId,
      name: getClassName(classId),
      expected: 0,
      detected: det.count,
      confidence: det.conf,
      status: "extra",
    })
  }

  return items
}
