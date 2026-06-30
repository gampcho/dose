import { matchClassName, matchDrug } from "@/lib/verify"

export interface ParsedMedication {
  drugName: string
  quantity: number
  dosage: string
  instructions: string
  classId: number | null
  matchedName: string | null
}

const QUANTITY_PATTERN = /(?:&L|Số lượng|SL|Qty)[:\s]*(\d+)/i
const DOSAGE_PATTERN = /\b(\d+(?:[.,]\d+)?)\s*(mg|g|ml|mcg|ui)\b/i

const SESSION_KEYWORDS: Record<string, string> = {
  sáng: "morning",
  trưa: "noon",
  chiều: "afternoon",
  tối: "evening",
}

export function parsePrescription(lines: string[]): ParsedMedication[] {
  const medications: ParsedMedication[] = []
  let current: ParsedMedication | null = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    const isNewEntry =
      /^\d+[\).:\-]/.test(line) ||
      /^[-•]\s/.test(line) ||
      /^thuốc[:\s]/i.test(line)

    if (isNewEntry) {
      if (current) medications.push(current)
      current = extractDrugFromLine(line)
      continue
    }

    if (!current) continue

    if (/ghichú|lời dặn|cộng khoản/i.test(line)) {
      current.instructions = extractInstructions(line)
    }

    const qty = QUANTITY_PATTERN.exec(line)
    if (qty) {
      current.quantity = parseInt(qty[1], 10)
    }

    const dosage = DOSAGE_PATTERN.exec(line)
    if (dosage && !current.dosage) {
      current.dosage = `${dosage[1]}${dosage[2]}`
    }
  }

  if (current) medications.push(current)

  for (const med of medications) {
    const match = matchDrug(med.drugName)
    if (match) {
      med.classId = match.classIds[0]
      med.matchedName = match.drug
    } else {
      const fallback = matchClassName(med.drugName)
      if (fallback) {
        med.classId = fallback.classId
        med.matchedName = fallback.name
      }
    }
  }

  return medications.filter((m) => m.drugName.length > 0)
}

export async function parseWithLLM(
  text: string,
): Promise<ParsedMedication[]> {
  try {
    const res = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })

    if (!res.ok) return []

    const { drugs } = await res.json()
    if (!Array.isArray(drugs)) return []

    return drugs.map(
      (d: { name: string; quantity: number; dosage: string; instructions: string }) => {
        const match = matchDrug(d.name)
        return {
          drugName: d.name,
          quantity: d.quantity ?? 0,
          dosage: d.dosage ?? "",
          instructions: d.instructions ?? "",
          classId: match?.classIds[0] ?? null,
          matchedName: match?.drug ?? null,
        }
      },
    )
  } catch {
    return []
  }
}

function extractDrugFromLine(line: string): ParsedMedication {
  const cleaned = line
    .replace(/^\d+[\).:\-]\s*/, "")
    .replace(/^[-•]\s*/, "")
    .replace(/^thuốc[:\s]*/i, "")
    .replace(/\s+/g, " ")
    .trim()

  let drugName = cleaned
  let quantity = 0
  let dosage = ""

  const qtyMatch = cleaned.match(QUANTITY_PATTERN)
  if (qtyMatch) {
    quantity = parseInt(qtyMatch[1], 10)
    drugName = drugName.replace(qtyMatch[0], "").trim()
  }

  const dosageMatch = cleaned.match(DOSAGE_PATTERN)
  if (dosageMatch) {
    dosage = `${dosageMatch[1]}${dosageMatch[2]}`
  }

  const dosagePattern = /\d+(?:[.,]\d+)?\s*(?:mg|g|ml|mcg|ui)/gi
  const drugParts = drugName.split(dosagePattern)
  drugName = drugParts[0].trim()

  if (drugName.length < 2 && cleaned.length > drugName.length) {
    drugName = cleaned
      .replace(/\d+(?:[.,]\d+)?\s*(?:mg|g|ml|mcg|ui)/gi, "")
      .replace(/&L.*$/i, "")
      .replace(/\s+/g, " ")
      .trim()
  }

  return {
    drugName,
    quantity,
    dosage,
    instructions: "",
    classId: null,
    matchedName: null,
  }
}

function extractInstructions(line: string): string {
  const parts: string[] = []

  for (const [kw, session] of Object.entries(SESSION_KEYWORDS)) {
    const regex = new RegExp(`${kw}\\s*(\\d+)\\s*viên`, "gi")
    const match = regex.exec(line)
    if (match) {
      const sessionLabel =
        session === "morning"
          ? "Sáng"
          : session === "noon"
            ? "Trưa"
            : session === "afternoon"
              ? "Chiều"
              : "Tối"
      parts.push(`${sessionLabel} ${match[1]} viên`)
    }
  }

  if (parts.length === 0) {
    const noteMatch = line.match(/(?:ghichú|lời dặn)[:\s]*(.+)/i)
    return noteMatch?.[1]?.trim() ?? ""
  }

  return parts.join(", ")
}

export function parseInstructions(
  instructions: string,
): { session: string; pillCount: number }[] {
  const result: { session: string; pillCount: number }[] = []

  for (const [kw, session] of Object.entries(SESSION_KEYWORDS)) {
    const regex = new RegExp(`${kw}\\s*(\\d+)\\s*viên`, "gi")
    const match = regex.exec(instructions)
    if (match) {
      result.push({ session, pillCount: parseInt(match[1], 10) })
    }
  }

  return result
}
