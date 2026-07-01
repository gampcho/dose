import type { ParsedMed } from "@/lib/types"
import type { Dose, Session } from "@/lib/types"
import { findDrug } from "@/lib/catalog"

const QUANTITY_PATTERN = /(?:Số lượng|SL|Qty)[:\s]*(\d+)/i

const DOSAGE_PATTERN = /\b(\d+(?:[.,]\d+)?)\s*(mg|g|ml|mcg|ui)\b/i

const DOSAGE_FULL = /\d+(?:[.,]\d+)?\s*(?:mg|g|ml|mcg|ui)/gi

const SESSION_MAP: Record<string, Session> = {
  sáng: "morning",
  trưa: "noon",
  chiều: "afternoon",
  tối: "evening",
}

function blankMed(): ParsedMed {
  return {
    name: "",
    classId: null,
    matchedName: null,
    quantity: 0,
    dosage: "",
    doses: [],
    mealTiming: null,
  }
}

export function parsePrescription(lines: string[]): ParsedMed[] {
  const meds: ParsedMed[] = []
  let current: ParsedMed | null = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    const isNewEntry =
      /^\d+[\).:\-]/.test(line) ||
      /^[-•]\s/.test(line) ||
      /^thuốc[:\s]/i.test(line)

    if (isNewEntry) {
      if (current) meds.push(current)
      current = parseDrugLine(line)
      continue
    }

    if (!current) continue

    if (/ghi\s*chú|lời\s*dặn|cộng\s*khoản/i.test(line)) {
      current.doses = parseSessionPills(line)
    }

    for (const [kw, session] of Object.entries(SESSION_MAP)) {
      if (line.toLowerCase().includes(kw)) {
        if (current.doses.length === 0) {
          current.doses.push({ session, pillCount: 1 })
        }
      }
    }

    if (/trước\s*ăn|trc\s*ăn/i.test(line)) {
      current.mealTiming = "before"
    } else if (/sau\s*(?:khi\s*)?ăn|sau\s*ăn/i.test(line)) {
      current.mealTiming = "after"
    }

    const qm = QUANTITY_PATTERN.exec(line)
    if (qm) current.quantity = parseInt(qm[1], 10)

    const dm = DOSAGE_PATTERN.exec(line)
    if (dm && !current.dosage) current.dosage = `${dm[1]}${dm[2]}`
  }

  if (current) meds.push(current)

  for (const med of meds) {
    if (!med.name) continue
    const match = findDrug(med.name)
    if (match) {
      med.classId = match.classIds[0]
      med.matchedName = match.matchedName
    }
  }

  return meds.filter((m) => m.name.length > 0)
}

export async function parseWithLLM(
  text: string,
): Promise<ParsedMed[]> {
  try {
    const res = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })

    if (!res.ok) return []

    const data = await res.json()
    const raw: { name: string; quantity: number; session?: string; condition?: string }[] =
      data.prescription ?? data.drugs ?? []

    if (!Array.isArray(raw)) return []

    return raw.map((d) => {
      const match = findDrug(d.name)

      const session = SESSION_MAP[d.session as keyof typeof SESSION_MAP] ?? null
      const doses: Dose[] = session
        ? [{ session, pillCount: d.quantity > 0 ? d.quantity : 1 }]
        : d.quantity > 0
          ? [{ session: "morning", pillCount: d.quantity }]
          : []

      return {
        name: d.name,
        classId: match?.classIds[0] ?? null,
        matchedName: match?.matchedName ?? null,
        quantity: d.quantity ?? 0,
        dosage: "",
        doses,
        mealTiming:
          d.condition === "before_eat" ? "before" :
          d.condition === "after_eat" ? "after" :
          d.condition === "before" ? "before" :
          d.condition === "after" ? "after" :
          null,
      }
    })
  } catch {
    return []
  }
}

function parseDrugLine(line: string): ParsedMed {
  const cleaned = line
    .replace(/^\d+[\).:\-]\s*/, "")
    .replace(/^[-•]\s*/, "")
    .replace(/^thuốc[:\s]*/i, "")
    .replace(/\s+/g, " ")
    .trim()

  let name = cleaned
  let quantity = 0
  let dosage = ""

  const qm = cleaned.match(QUANTITY_PATTERN)
  if (qm) {
    quantity = parseInt(qm[1], 10)
    name = name.replace(qm[0], "").trim()
  }

  const dm = cleaned.match(DOSAGE_PATTERN)
  if (dm) dosage = `${dm[1]}${dm[2]}`

  const parts = name.split(DOSAGE_FULL)
  name = parts[0].trim()

  if (name.length < 2 && cleaned.length > name.length) {
    name = cleaned
      .replace(DOSAGE_FULL, "")
      .replace(/&L.*$/i, "")
      .replace(/\s+/g, " ")
      .trim()
  }

  return { ...blankMed(), name, quantity, dosage }
}

function parseSessionPills(line: string): Dose[] {
  const results: Dose[] = []

  for (const [kw, session] of Object.entries(SESSION_MAP)) {
    const regex = new RegExp(`${kw}\\s*(\\d+)\\s*viên`, "gi")
    const m = regex.exec(line)
    if (m) {
      results.push({ session, pillCount: parseInt(m[1], 10) })
    }
  }

  return results
}
