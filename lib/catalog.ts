let classNames: Record<number, string> | null = null
let drugToIds: Map<string, number[]> | null = null

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
  return classNames?.[classId] ?? `class_${classId}`
}

export function searchDrugs(
  query: string,
): { name: string; classIds: number[] }[] {
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
