import type { ParsedMed, Dose, Session } from "@/lib/types"
import { findDrug } from "@/lib/catalog"

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

export async function parseWithLLM(text: string): Promise<ParsedMed[]> {
  try {
    const res = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
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
    name: d.name,
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
