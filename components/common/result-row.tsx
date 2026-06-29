"use client"

import {
  RiCheckboxCircleFill,
  RiCloseCircleFill,
  RiCapsuleLine,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import type { MedicationResult } from "@/lib/types"

export function ResultRow({ result }: { result: MedicationResult }) {
  const isPass = result.status === "pass"
  const isFail = result.status === "fail"
  const isExtra = result.status === "extra"

  const diff = result.detected - result.expected

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors",
        isPass &&
          "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20",
        (isFail || isExtra) &&
          "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20",
      )}
    >
      <div className="mt-0.5 shrink-0">
        {isPass && <RiCheckboxCircleFill className="size-5 text-emerald-500" />}
        {(isFail || isExtra) && (
          <RiCloseCircleFill className="size-5 text-red-500" />
        )}
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
              {result.expected} viên
            </span>
          </span>
          <span className="text-muted-foreground">
            Phát hiện:{" "}
            <span
              className={cn(
                "font-semibold",
                isPass && "text-emerald-600",
                (isFail || isExtra) && "text-red-600",
              )}
            >
              {result.detected} viên
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

        {isFail && (
          <p className="text-xs text-red-600 dark:text-red-400">
            {diff > 0
              ? `Thừa ${diff} viên — kiểm tra lại khay`
              : `Thiếu ${Math.abs(diff)} viên — kiểm tra lại khay`}
          </p>
        )}
        {isExtra && (
          <p className="text-xs text-red-600 dark:text-red-400">
            Phát hiện {result.detected} viên — thuốc ngoài liệu trình
          </p>
        )}
      </div>
    </div>
  )
}
