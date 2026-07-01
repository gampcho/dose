import type { Detection } from "@/lib/yolo"
import type { Result } from "@/lib/types"

let classNames: Record<number, string> | null = null
let drugToIds: Map<string, number[]> | null = null

export async function loadCatalog(): Promise<void> {
  if (drugToIds) return

  const [cnRes, dgRes] = await Promise.all([
    fetch("/models/class_names.json"),
    fetch("/models/drug_groups.json"),
  ])

  const cn = await cnRes.json() as Record<string, string>
  const dg = await dgRes.json() as Record<string, number[]>

  classNames = {}
  for (const [id, name] of Object.entries(cn)) {
    classNames[Number(id)] = name
  }

  drugToIds = new Map()
  for (const [key, ids] of Object.entries(dg)) {
    drugToIds.set(cleanForLookup(key), ids)
  }
}

export function getClassName(classId: number): string {
  return classNames?.[classId] ?? `class_${classId}`
}

export function searchDrugs(query: string): { name: string; classIds: number[] }[] {
  if (!drugToIds || query.length < 2) return []
  const q = query.toLowerCase()
  const results: { name: string; classIds: number[] }[] = []
  const seen = new Set<string>()
  for (const [name, ids] of drugToIds) {
    if (name.includes(q) || q.includes(name)) {
      if (seen.has(name)) continue
      seen.add(name)
      results.push({ name, classIds: ids })
    }
  }
  return results.slice(0, 8)
}

function stripDosage(text: string): string {
  return text.replace(/\d+(?:[,.]\d+)?\s*(?:mg|g|ml|mcg|ui)/gi, "").trim()
}

function cleanForLookup(text: string): string {
  return text
    .toLowerCase()
    .replace(/[,.\-;:!?/@#$%^&*+=|\\~`'"()\[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function findDrug(text: string): {
  classIds: number[]
  matchedName: string
} | null {
  if (!drugToIds) return null

  const withoutDosage = stripDosage(text)
  const cleaned = cleanForLookup(withoutDosage)

  if (!cleaned || cleaned.length < 2) return null

  const exact = drugToIds.get(cleaned)
  if (exact) return { classIds: exact, matchedName: cleaned }

  for (const [key, ids] of drugToIds) {
    if (key.includes(cleaned) || cleaned.includes(key)) {
      return { classIds: ids, matchedName: key }
    }
  }

  return null
}

export function comparePills(
  expected: Record<number, number>,
  detections: Detection[],
): Result[] {
  const detected = new Map<number, { count: number; conf: number }>()
  for (const d of detections) {
    const prev = detected.get(d.classId)
    if (prev) {
      prev.count++
      prev.conf = Math.max(prev.conf, d.confidence)
    } else {
      detected.set(d.classId, { count: 1, conf: d.confidence })
    }
  }

  const results: Result[] = []

  for (const [classIdStr, expectedCount] of Object.entries(expected)) {
    const classId = Number(classIdStr)
    const det = detected.get(classId)
    detected.delete(classId)

    const detectedCount = det?.count ?? 0
    const confidence = det?.conf ?? 0

    let status: Result["status"]
    if (detectedCount > 0 && confidence < 0.65) {
      status = "unclear"
    } else if (detectedCount === 0 || detectedCount < expectedCount) {
      status = "missing"
    } else if (detectedCount > expectedCount) {
      status = "extra"
    } else {
      status = "correct"
    }

    results.push({
      classId,
      name: getClassName(classId),
      expected: expectedCount,
      detected: detectedCount,
      confidence,
      status,
    })
  }

  for (const [classId, det] of detected) {
    results.push({
      classId,
      name: getClassName(classId),
      expected: 0,
      detected: det.count,
      confidence: det.conf,
      status: "extra",
    })
  }

  return results
}
