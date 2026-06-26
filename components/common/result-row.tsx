"use client"

import {
  RiCheckboxCircleFill,
  RiCloseCircleFill,
  RiAlertFill,
  RiCapsuleLine,
} from "@remixicon/react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { SESSION_LABELS } from "@/lib/types"
import type { MedicationResult } from "@/lib/types"

export function ResultRow({ result }: { result: MedicationResult }) {
  const isPass = result.status === "pass"
  const isWarn = result.status === "warning"
  const isFail = result.status === "fail"

  const diff = result.detected - result.expected

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors",
        isPass &&
          "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20",
        isWarn &&
          "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20",
        isFail &&
          "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20",
      )}
    >
      {/* Icon */}
      <div className="mt-0.5 shrink-0">
        {isPass && <RiCheckboxCircleFill className="size-5 text-emerald-500" />}
        {isWarn && <RiAlertFill className="size-5 text-amber-500" />}
        {isFail && <RiCloseCircleFill className="size-5 text-red-500" />}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <RiCapsuleLine className="size-3.5 text-muted-foreground" />
          <p className="text-sm leading-tight font-medium">{result.name}</p>
          <Badge variant="secondary" className="text-xs">
            {SESSION_LABELS[result.session]}
          </Badge>
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
                isWarn && "text-amber-600",
                isFail && "text-red-600",
              )}
            >
              {result.detected} viên
            </span>
          </span>
        </div>

        {/* Reason */}
        {isFail && (
          <p className="text-xs text-red-600 dark:text-red-400">
            {diff > 0
              ? `Thừa ${diff} viên — kiểm tra lại khay`
              : `Thiếu ${Math.abs(diff)} viên — kiểm tra lại khay`}
          </p>
        )}
        {isWarn && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Hướng dẫn chưa đủ rõ — vui lòng xác nhận thủ công
          </p>
        )}
      </div>
    </div>
  )
}
