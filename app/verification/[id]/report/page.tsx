"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import {
  RiArrowLeftLine,
  RiCheckboxCircleFill,
  RiCloseCircleFill,
  RiAlertFill,
  RiCapsuleLine,
  RiRefreshLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { getPlan } from "@/lib/storage"
import type { TreatmentPlan, MedicationSession } from "@/lib/types"

const SESSION_LABELS: Record<MedicationSession, string> = {
  morning: "Sáng",
  noon: "Trưa",
  afternoon: "Chiều",
  evening: "Tối",
}

interface MedicationResult {
  medicationId: string
  name: string
  session: MedicationSession
  expected: number
  detected: number
  status: "pass" | "fail" | "warning"
}

// Tạo mock results từ medications trong plan (AI engine sẽ thay thế sau)
function generateMockResults(plan: TreatmentPlan): MedicationResult[] {
  const results: MedicationResult[] = []
  for (const med of plan.medications) {
    for (const schedule of med.schedules) {
      // Mock: random pass/fail để demo
      const scenarios = [
        { detected: schedule.pillCount, status: "pass" as const },
        { detected: schedule.pillCount + 1, status: "fail" as const },
        { detected: schedule.pillCount - 1, status: "fail" as const },
        { detected: schedule.pillCount, status: "warning" as const },
      ]
      const pick = scenarios[Math.floor(Math.random() * scenarios.length)]
      results.push({
        medicationId: med.id,
        name: med.name,
        session: schedule.session,
        expected: schedule.pillCount,
        detected: pick.detected,
        status: pick.status,
      })
    }
  }
  return results
}

export default function ReportPage() {
  const params = useParams()
  const router = useRouter()
  const planId = params.id as string

  const [plan] = React.useState<TreatmentPlan | null>(() => getPlan(planId) ?? null)
  const [imageUrl] = React.useState<string | null>(() =>
    typeof window !== "undefined"
      ? sessionStorage.getItem(`dose:verify:image:${planId}`)
      : null,
  )
  const [results] = React.useState<MedicationResult[]>(() => {
    const p = getPlan(planId)
    return p ? generateMockResults(p) : []
  })

  React.useEffect(() => {
    if (!plan) router.push("/")
  }, [plan, router])

  if (!plan) return null

  const failCount = results.filter((r) => r.status === "fail").length
  const warnCount = results.filter((r) => r.status === "warning").length
  const overallPass = failCount === 0

  return (
    <div className="min-h-svh bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => router.push(`/verification/${planId}`)}
            >
              <RiArrowLeftLine />
            </Button>
            <div>
              <p className="font-heading text-base font-semibold leading-tight">{plan.name}</p>
              <p className="text-xs text-muted-foreground">Kết quả kiểm tra</p>
            </div>
          </div>

          <Badge
            variant={overallPass ? "default" : "destructive"}
            className={cn(
              "gap-1 px-3 py-1 text-sm font-bold",
              overallPass
                ? "bg-emerald-500 text-white hover:bg-emerald-500"
                : "bg-red-500 text-white hover:bg-red-500",
            )}
          >
            {overallPass ? (
              <RiCheckboxCircleFill className="size-4" />
            ) : (
              <RiCloseCircleFill className="size-4" />
            )}
            {overallPass ? "PASS" : "FAIL"}
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {/* Overall banner */}
        <div
          className={cn(
            "mb-6 flex items-center gap-3 rounded-xl px-4 py-3",
            overallPass
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300",
          )}
        >
          {overallPass ? (
            <RiCheckboxCircleFill className="size-5 shrink-0 text-emerald-500" />
          ) : (
            <RiCloseCircleFill className="size-5 shrink-0 text-red-500" />
          )}
          <div>
            <p className="text-sm font-semibold">
              {overallPass
                ? "Không phát hiện sai lệch — khay thuốc khớp với liệu trình"
                : `Phát hiện ${failCount} sai lệch — cần kiểm tra lại trước khi dùng`}
            </p>
            {warnCount > 0 && (
              <p className="mt-0.5 text-xs opacity-80">
                {warnCount} mục cần xác nhận thêm
              </p>
            )}
          </div>
        </div>

        {/* Body: 2 cột trên desktop, stack trên mobile */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

          {/* Cột trái: ảnh */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Ảnh khay thuốc
            </p>
            {imageUrl ? (
              <div className="overflow-hidden rounded-2xl border shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt="Khay thuốc"
                  className="w-full bg-muted/30 object-contain"
                  style={{ maxHeight: 380 }}
                />
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
                Không có ảnh
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => router.push(`/verification/${planId}`)}
            >
              <RiRefreshLine />
              Chụp lại
            </Button>
          </div>

          {/* Cột phải: kết quả từng thuốc */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Kết quả từng thuốc
            </p>

            {results.length === 0 ? (
              <div className="flex h-48 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
                Không có dữ liệu
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {results.map((r, i) => (
                  <ResultRow key={i} result={r} />
                ))}
              </div>
            )}

            <Separator />

            {/* Summary */}
            <div className="flex gap-4 rounded-xl bg-muted/40 px-4 py-3 text-sm">
              <div className="flex flex-1 flex-col items-center gap-0.5">
                <span className="text-xl font-bold text-emerald-500">
                  {results.filter((r) => r.status === "pass").length}
                </span>
                <span className="text-xs text-muted-foreground">Đúng</span>
              </div>
              <div className="w-px bg-border" />
              <div className="flex flex-1 flex-col items-center gap-0.5">
                <span className="text-xl font-bold text-amber-500">
                  {warnCount}
                </span>
                <span className="text-xs text-muted-foreground">Cần xác nhận</span>
              </div>
              <div className="w-px bg-border" />
              <div className="flex flex-1 flex-col items-center gap-0.5">
                <span className="text-xl font-bold text-red-500">
                  {failCount}
                </span>
                <span className="text-xs text-muted-foreground">Sai lệch</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function ResultRow({ result }: { result: MedicationResult }) {
  const isPass = result.status === "pass"
  const isWarn = result.status === "warning"
  const isFail = result.status === "fail"

  const diff = result.detected - result.expected

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors",
        isPass && "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20",
        isWarn && "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20",
        isFail && "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20",
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
          <p className="text-sm font-medium leading-tight">{result.name}</p>
          <Badge variant="secondary" className="text-xs">
            {SESSION_LABELS[result.session]}
          </Badge>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">
            Kỳ vọng: <span className="font-semibold text-foreground">{result.expected} viên</span>
          </span>
          <span className="text-muted-foreground">
            Phát hiện: <span className={cn(
              "font-semibold",
              isPass && "text-emerald-600",
              isWarn && "text-amber-600",
              isFail && "text-red-600",
            )}>{result.detected} viên</span>
          </span>
        </div>

        {/* Reason */}
        {isFail && (
          <p className="text-xs text-red-600 dark:text-red-400">
            {diff > 0 ? `Thừa ${diff} viên — kiểm tra lại khay` : `Thiếu ${Math.abs(diff)} viên — kiểm tra lại khay`}
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
