import { NextResponse } from "next/server"
import { Prescription } from "@/types"
import type { MedicineType } from "@/types"

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

const SYSTEM_PROMPT = `You are a Vietnamese prescription parser. Given raw OCR text from a medical prescription, extract all medications.

Return a JSON array. Each element:
- name: the EXACT YOLO class name if it matches the prescription drug, or the original prescription name if it does not match any class
- known: true if the name is an EXACT match or obvious rebrand of a YOLO class entry (e.g. "Panactol" = "panactol 500mg"), false if you are unsure or it does not appear in the class list
- quantity: total pill count (number, 0 if unclear)
- session: one of "none" | "morning" | "noon" | "afternoon" | "evening" — map Vietnamese time words: sáng→morning, trưa→noon, chiều→afternoon, tối→evening. If multiple sessions, pick the first one mentioned. If no time info, use "none".
- condition: one of "none" | "before_eat" | "after_eat" — map: trước ăn/sau khi ăn → before_eat/after_eat. If unclear, use "none".

Rules:
- ONLY set known=true if the drug name exactly matches or is an obvious rebrand of a YOLO class name. NEVER guess or fuzzy-match.
- When known=true, the name field MUST be the exact YOLO class name (e.g. "glucofast 850 850mg" not "Glucophage").
- When known=false, use the original prescription name as written.
- Only return valid JSON array, no explanation.
- If you cannot parse a medication, skip it.`

function buildUserPrompt(text: string, classNames: Record<string, string>): string {
  const classList = Object.entries(classNames)
    .map(([id, name]) => `${id}: ${name}`)
    .join("\n")
  return `OCR text:\n${text}\n\nYOLO class names:\n${classList}`
}

export async function POST(req: Request): Promise<NextResponse> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 500 })
  }

  const { text } = await req.json()
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Missing text" }, { status: 400 })
  }

  let classNames: Record<string, string> = {}
  try {
    const res = await fetch(
      "https://raw.githubusercontent.com/gampcho/dose/main/public/models/class_names.json",
    )
    classNames = await res.json()
  } catch {
    // fallback: LLM parses without class context
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
        { role: "user", content: buildUserPrompt(text, classNames) },
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
