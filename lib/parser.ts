import type { ParsedMed, Dose } from "@/lib/types"
import { findDrug } from "@/lib/catalog"

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

    const raw: {
      name: string
      quantity: number
      sessions?: { session: string; pills: number }[]
      dosage?: string
      unit?: string
      condition?: string
    }[] = data.prescription ?? data.drugs ?? []

    if (!Array.isArray(raw)) return []

    return raw.map((d) => {
      const match = findDrug(d.name)

      const doses: Dose[] = (d.sessions ?? []).map((s) => ({
        session: s.session as Dose["session"],
        pillCount: s.pills,
      }))

      return {
        name: d.name,
        classId: match?.classIds[0] ?? null,
        matchedName: match?.matchedName ?? null,
        quantity: d.quantity ?? 0,
        dosage: d.dosage ?? "",
        unit: d.unit ?? "đơn vị",
        doses,
        mealTiming:
          d.condition === "before_eat" ? "before" :
          d.condition === "after_eat" ? "after" :
          null,
      }
    })
  } catch {
    return []
  }
}
