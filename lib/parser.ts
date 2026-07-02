import type { ParsedMed, Dose, Session } from "@/lib/types"
import { findDrug } from "@/lib/catalog"
import { MAX_PARSE_TEXT_CHARS, sanitizePrescriptionText } from "@/lib/prescription-sanitizer"

interface RawLlmMedicine {
  name: string
  quantity?: number
  sessions?: { session: string; pills: number }[]
  dosage?: string
  unit?: string
  condition?: string
}

const DOMAIN_SESSIONS = new Set<Session>([
  "morning",
  "noon",
  "afternoon",
  "evening",
])

export type ParserBackend = "groq"

export async function parsePrescription(
  text: string,
  backend: ParserBackend = "groq",
): Promise<ParsedMed[]> {
  if (backend !== "groq") return []
  return parseWithGroq(text)
}

export async function parseWithLLM(text: string): Promise<ParsedMed[]> {
  return parsePrescription(text, "groq")
}

async function parseWithGroq(text: string): Promise<ParsedMed[]> {
  try {
    const sanitizedText = sanitizePrescriptionText(text)
    if (!sanitizedText || sanitizedText.length > MAX_PARSE_TEXT_CHARS) return []

    const res = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: sanitizedText }),
    })

    if (!res.ok) return []
    const data = await res.json()

    const raw: RawLlmMedicine[] = data.prescription ?? data.drugs ?? []

    if (!Array.isArray(raw)) return []

    return raw.map(normalizeLlmMedicine)
  } catch {
    return []
  }
}

export function normalizeLlmMedicine(d: RawLlmMedicine): ParsedMed {
  const match = findDrug(d.name)

  const doses: Dose[] = (d.sessions ?? [])
    .filter((s): s is { session: Session; pills: number } =>
      DOMAIN_SESSIONS.has(s.session as Session),
    )
    .map((s) => ({
      session: s.session,
      pillCount: s.pills,
    }))

  return {
    name: match?.matchedName ?? d.name,
    classId: match?.classIds[0] ?? null,
    matchedName: match?.matchedName ?? null,
    quantity: d.quantity ?? 0,
    dosage: d.dosage ?? "",
    unit: d.unit ?? "viên",
    doses,
    mealTiming:
      d.condition === "before_eat"
        ? "before"
        : d.condition === "after_eat"
          ? "after"
          : null,
  }
}
