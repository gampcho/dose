"use client"

import * as React from "react"
import {
  RiCheckboxCircleFill,
  RiCloseCircleFill,
  RiCapsuleLine,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import type { Result } from "@/lib/types"
import type { FeedbackValue } from "@/lib/feedback"

export function ResultRow({
  result,
  onFeedback,
}: {
  result: Result
  onFeedback?: (
    result: Result,
    feedback: FeedbackValue,
    correctionText?: string,
  ) => void
}) {
  const [correctionText, setCorrectionText] = React.useState("")
  const [showCorrection, setShowCorrection] = React.useState(false)

  const isCorrect = result.status === "correct"
  const isMissing = result.status === "missing"
  const isExtra = result.status === "extra"
  const isUnclear = result.status === "unclear"

  const diff = result.detected - result.expected

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors",
        isCorrect &&
          "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20",
        (isMissing || isExtra) &&
          "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20",
        isUnclear &&
          "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20",
      )}
    >
      <div className="mt-0.5 shrink-0">
        {isCorrect && (
          <RiCheckboxCircleFill className="size-5 text-emerald-500" />
        )}
        {(isMissing || isExtra) && (
          <RiCloseCircleFill className="size-5 text-red-500" />
        )}
        {isUnclear && <RiCloseCircleFill className="size-5 text-amber-500" />}
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <RiCapsuleLine className="size-3.5 text-muted-foreground" />
          <p className="text-sm leading-tight font-medium">{result.name}</p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">
            Kỳ vọng:{" "}
            <span className="font-semibold text-foreground">
              {result.expected} {result.unit}
            </span>
          </span>
          <span className="text-muted-foreground">
            Phát hiện:{" "}
            <span
              className={cn(
                "font-semibold",
                isCorrect && "text-emerald-600",
                (isMissing || isExtra) && "text-red-600",
              )}
            >
              {result.detected} {result.unit}
            </span>
          </span>
          {result.confidence > 0 && (
            <span className="text-muted-foreground">
              Confidence:{" "}
              <span className="font-semibold text-foreground">
                {(result.confidence * 100).toFixed(0)}%
              </span>
            </span>
          )}
        </div>

        {isMissing && (
          <p className="text-xs text-red-600 dark:text-red-400">
            Thiếu {Math.abs(diff)} {result.unit}, kiểm tra lại khay
          </p>
        )}
        {isExtra && (
          <p className="text-xs text-red-600 dark:text-red-400">
            Phát hiện {result.detected} {result.unit}, thuốc ngoài liệu trình
          </p>
        )}
        {isUnclear && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Không rõ, vui lòng chụp lại
          </p>
        )}

        {onFeedback && (
          <div className="mt-2 flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onFeedback(result, "correct")}
                className="rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Đúng
              </button>
              <button
                type="button"
                onClick={() => setShowCorrection((current) => !current)}
                className="rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Sai
              </button>
              <button
                type="button"
                onClick={() => onFeedback(result, "unclear")}
                className="rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Không rõ
              </button>
            </div>
            {showCorrection && (
              <div className="flex gap-2">
                <input
                  value={correctionText}
                  onChange={(e) => setCorrectionText(e.target.value)}
                  placeholder="Sửa tên thuốc hoặc số lượng"
                  className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => {
                    onFeedback(
                      result,
                      "incorrect",
                      correctionText.trim() || undefined,
                    )
                    setCorrectionText("")
                    setShowCorrection(false)
                  }}
                  className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground"
                >
                  Lưu
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
