"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import {
  RiArrowLeftLine,
  RiCheckboxCircleFill,
  RiCloseCircleFill,
  RiRefreshLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getPlan } from "@/lib/storage"
import { ResultRow } from "@/components/common/result-row"
import { detect } from "@/lib/yolo"
import { loadClassNames, matchClassName, verify } from "@/lib/verify"
import type { TreatmentPlan, MedicationResult } from "@/lib/types"

export default function ReportPage() {
  const params = useParams()
  const router = useRouter()
  const planId = params.id as string

  const [plan, setPlan] = React.useState<TreatmentPlan | null>(null)
  const [imageUrl, setImageUrl] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [results, setResults] = React.useState<MedicationResult[]>([])

  React.useEffect(() => {
    const p = getPlan(planId)
    if (!p) {
      router.push("/")
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlan(p)
    setImageUrl(sessionStorage.getItem(`dose:verify:image:${planId}`))
  }, [planId, router])

  React.useEffect(() => {
    if (!plan || !imageUrl) {
      if (plan) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(false)
      }
      return
    }

    let cancelled = false

    async function run() {
      if (!plan || !imageUrl) return

      try {
        await loadClassNames()

        const img = new Image()
        img.crossOrigin = "anonymous"
        img.src = imageUrl
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error("Không thể tải ảnh"))
        })

        const detections = await detect(img)

        const expected: Record<number, number> = {}
        const matched: { medId: string; medName: string; classId: number }[] = []

        for (const med of plan.medications) {
          const match = matchClassName(med.name)
          if (!match) continue

          const totalPills = med.schedules.reduce((sum, s) => sum + s.pillCount, 0)
          expected[match.classId] = (expected[match.classId] ?? 0) + totalPills
          matched.push({ medId: med.id, medName: med.name, classId: match.classId })
        }

        const items = verify(expected, detections)

        const medResults: MedicationResult[] = items.map((item) => {
          const match = matched.find((m) => m.classId === item.classId)
          return {
            ...item,
            name: match?.medName ?? item.name,
          }
        })

        if (!cancelled) setResults(medResults)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Lỗi không xác định")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => { cancelled = true }
  }, [plan, imageUrl])

  if (!plan) return null

  const failCount = results.filter((r) => r.status === "fail" || r.status === "extra").length
  const overallPass = failCount === 0 && results.length > 0

  return (
    <div className="min-h-svh bg-background">
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
              <p className="font-heading text-base leading-tight font-semibold">
                {plan.name}
              </p>
              <p className="text-xs text-muted-foreground">Kết quả kiểm tra</p>
            </div>
          </div>

          {!loading && results.length > 0 && (
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
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {loading && (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <div className="size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">
              Đang phân tích khay thuốc...
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && results.length > 0 && (
          <>
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
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="flex flex-col gap-3">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
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

              <div className="flex flex-col gap-3">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Kết quả từng thuốc
                </p>

                <div className="flex flex-col gap-2">
                  {results.map((r) => (
                    <ResultRow key={r.classId} result={r} />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
