import type { Result } from "@/lib/types"

const FEEDBACK_KEY = "dose:feedback"

export type FeedbackValue = "correct" | "incorrect" | "unclear"

export interface FeedbackItem {
  id: string
  createdAt: string
  resultClassId?: number
  resultName: string
  expected?: number
  detected?: number
  status: Result["status"] | "unknown" | "identity"
  feedback: FeedbackValue
  correctionText?: string
  correctionCount?: number
}

export interface FeedbackExport {
  source: "dose"
  kind: "training_review"
  exportedAt: string
  items: FeedbackItem[]
}

export function listFeedback(): FeedbackItem[] {
  if (typeof window === "undefined") return []

  try {
    return normalizeFeedbackItems(JSON.parse(localStorage.getItem(FEEDBACK_KEY) ?? "[]"))
  } catch {
    return []
  }
}

export function addFeedback(input: Omit<FeedbackItem, "id" | "createdAt">): FeedbackItem {
  const item: FeedbackItem = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }
  saveFeedbackItems([...listFeedback(), item])
  return item
}

export function normalizeFeedbackItems(raw: unknown): FeedbackItem[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(isFeedbackItem)
}

export function buildFeedbackExport(items: FeedbackItem[] = listFeedback()): FeedbackExport {
  return {
    source: "dose",
    kind: "training_review",
    exportedAt: new Date().toISOString(),
    items,
  }
}

function saveFeedbackItems(items: FeedbackItem[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(items))
}

function isFeedbackItem(item: unknown): item is FeedbackItem {
  if (!item || typeof item !== "object") return false
  const candidate = item as Partial<FeedbackItem>
  return (
    typeof candidate.id === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.resultName === "string" &&
    typeof candidate.status === "string" &&
    isFeedbackValue(candidate.feedback)
  )
}

function isFeedbackValue(value: unknown): value is FeedbackValue {
  return value === "correct" || value === "incorrect" || value === "unclear"
}
