import { NextResponse } from "next/server"
import { Prescription } from "@/types"
import type { MedicineType } from "@/types"

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

const SYSTEM_PROMPT = `You are a Vietnamese prescription parser. The input is raw OCR text from a photo of a paper prescription — expect messy, misaligned, and sometimes truncated text.

Extract all medications. For each, return:
- name: the generic drug name (strip brand names in parentheses, e.g. "Etoricoxib(Roticox" → "Etoricoxib")
- sessions: array of {session, pills} — map: sáng→morning, trưa→noon, chiều→afternoon, tối→evening. Each session mentioned gets its own entry. Must be approximated to the nearst hundred (if it is a floating expression). Example: 1/3 -> 0.33
- dosage: the strength, e.g. "90mg", "500mg" (empty string if not found)
- unit: one of "viên" | "ống" | "gói" | "chai" — the drug form. Default to "viên" if unclear.
- quantity: total pill count from the prescription (number, 0 if unclear).
- condition: "none" | "before_eat" | "after_eat" — map: trước ăn→before_eat, sau ăn→after_eat

Rules:
- Ignore non-drug lines: hospital headers, page numbers, dates, footer notes
- If a drug name is truncated or garbled, use your best guess at the real name
- If multiple drugs share the same entry number, treat them as separate medications
- Only return valid JSON array, no explanation
- If you cannot parse any medication, return []`

export async function POST(req: Request): Promise<NextResponse> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 500 })
  }

  const { text } = await req.json()
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Missing text" }, { status: 400 })
  }

  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `OCR text:\n${text}` },
      ],
      temperature: 0.1,
      max_tokens: 1024,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: err }, { status: 502 })
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content ?? "[]"

  const jsonMatch = content.match(/\[[\s\S]*\]/)
  const raw = JSON.parse(jsonMatch?.[0] ?? "[]")

  const result = Prescription.safeParse(raw)
  if (!result.success) {
    return NextResponse.json(
      { error: "LLM output failed validation", details: result.error.issues, raw },
      { status: 422 },
    )
  }

  return NextResponse.json({ prescription: result.data satisfies MedicineType[] })
}
