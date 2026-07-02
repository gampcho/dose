import type { Result } from "@/lib/types"
import { FEEDBACK_KEY } from "@/lib/onboarding"

export type FeedbackValue =
  | "correct"
  | "incorrect"
  | "incorrect_name"
  | "incorrect_count"
  | "unclear"
  | "ood_unknown"
  | "missing_expected"
  | "extra_unexpected"

export type FeedbackSource = "user_feedback" | "auto_review"

export interface ReviewBBox {
  x: number
  y: number
  w: number
  h: number
}

export interface FeedbackItem {
  id: string
  createdAt: string
  source?: FeedbackSource
  resultClassId?: number
  resultName: string
  modelName?: string
  detectorModel?: string
  rawClassId?: number
  rawModelName?: string
  secondClassId?: number
  secondModelName?: string
  oodConfidence?: number
  margin?: number
  safetyReason?: Result["safetyReason"]
  expected?: number
  detected?: number
  confidence?: number
  unit?: string
  status: Result["status"] | "unknown" | "identity"
  feedback: FeedbackValue
  correctionText?: string
  correctionCount?: number
  correctedName?: string
  correctedClassId?: number
  bbox?: ReviewBBox
  cropImageDataUrl?: string
  session?: string
  mealTiming?: string | null
  imageWidth?: number
  imageHeight?: number
}

export interface FeedbackExport {
  source: "dose"
  kind: "training_review"
  schemaVersion: 2
  exportedAt: string
  model: {
    name: string
    classCount: number
    oodClassId: number
  }
  items: FeedbackItem[]
}

const MODEL_METADATA = {
  name: "vaipe12n.onnx",
  classCount: 108,
  oodClassId: 107,
}

export function listFeedback(): FeedbackItem[] {
  if (typeof window === "undefined") return []

  try {
    return normalizeFeedbackItems(
      JSON.parse(localStorage.getItem(FEEDBACK_KEY) ?? "[]"),
    )
  } catch {
    return []
  }
}

export function addFeedback(
  input: Omit<FeedbackItem, "id" | "createdAt">,
): FeedbackItem {
  const item: FeedbackItem = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    source: input.source ?? "user_feedback",
  }
  saveFeedbackItems([...listFeedback(), item])
  return item
}

export function normalizeFeedbackItems(raw: unknown): FeedbackItem[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(isFeedbackItem)
}

export function buildFeedbackExport(
  items: FeedbackItem[] = listFeedback(),
): FeedbackExport {
  return {
    source: "dose",
    kind: "training_review",
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    model: MODEL_METADATA,
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
  return (
    value === "correct" ||
    value === "incorrect" ||
    value === "incorrect_name" ||
    value === "incorrect_count" ||
    value === "unclear" ||
    value === "ood_unknown" ||
    value === "missing_expected" ||
    value === "extra_unexpected"
  )
}
