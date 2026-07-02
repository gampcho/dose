import bundledClassNames from "@/public/models/class_names.json"

let classNames: Record<number, string> | null = null
let drugToIds: Map<string, number[]> | null = null

const fallbackClassNames = Object.fromEntries(
  Object.entries(bundledClassNames).map(([id, name]) => [Number(id), name]),
) as Record<number, string>

export async function loadCatalog(): Promise<void> {
  if (drugToIds) return

  const [cnRes, dgRes] = await Promise.all([
    fetch("/models/class_names.json"),
    fetch("/models/drug_groups.json"),
  ])

  const cn = (await cnRes.json()) as Record<string, string>
  const dg = (await dgRes.json()) as Record<string, number[]>

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
  return classNames?.[classId] ?? fallbackClassNames[classId] ?? `class_${classId}`
}

export function searchDrugs(query: string): { name: string; classIds: number[] }[] {
  if (!drugToIds) return []

  const q = cleanForLookup(stripDosage(query))
  if (q.length < 2) return []
  const results: { name: string; classIds: number[] }[] = []
  const seen = new Set<string>()

  for (const [name, ids] of drugToIds) {
    if (name.includes(q) || q.includes(name)) {
      if (seen.has(name)) continue
      seen.add(name)
      results.push({ name, classIds: ids })
    }
  }
  if (results.length > 0) return results.slice(0, 8)

  const fuzzyName = findBestFuzzyMatch(q, drugToIds.keys())
  if (!fuzzyName) return []

  return [{ name: fuzzyName, classIds: drugToIds.get(fuzzyName) ?? [] }]
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

  const fuzzyName = findBestFuzzyMatch(cleaned, drugToIds.keys())
  if (fuzzyName) {
    const ids = drugToIds.get(fuzzyName)
    if (ids) return { classIds: ids, matchedName: fuzzyName }
  }

  return null
}

export function findBestFuzzyMatch(input: string, candidates: Iterable<string>): string | null {
  const compactInput = compactForFuzzy(input)
  const maxDistance = maxFuzzyDistance(compactInput.length)
  if (maxDistance === 0) return null

  let best: string | null = null
  let bestDistance = maxDistance + 1
  let hasTie = false

  for (const candidate of candidates) {
    const compactCandidate = compactForFuzzy(candidate)
    if (Math.abs(compactInput.length - compactCandidate.length) > maxDistance) continue

    const distance = boundedEditDistance(compactInput, compactCandidate, maxDistance)
    if (distance > maxDistance) continue
    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
      hasTie = false
      continue
    }
    if (distance === bestDistance) hasTie = true
  }

  return hasTie ? null : best
}

function compactForFuzzy(text: string): string {
  return text.replace(/\s+/g, "")
}

function maxFuzzyDistance(length: number): number {
  if (length < 5) return 0
  if (length <= 7) return 1
  if (length <= 12) return 2
  return 3
}

function boundedEditDistance(a: string, b: string, maxDistance: number): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)

  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    let rowMin = current[0]

    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      )
      rowMin = Math.min(rowMin, current[j])
    }

    if (rowMin > maxDistance) return maxDistance + 1
    previous = current
  }

  return previous[b.length]
}
