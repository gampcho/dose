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
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { getPlan } from "@/lib/storage"
import { verifyImageKey } from "@/lib/storage"
import { ResultRow } from "@/components/common/result-row"
import { detect } from "@/lib/yolo"
import type { Detection } from "@/lib/yolo"
import { loadCatalog, findDrug, comparePills } from "@/lib/catalog"
import type { Plan, Medication, Result } from "@/lib/types"
import { getCurrentSession, SESSION_LABELS } from "@/lib/types"
import type { Session, MealTiming } from "@/lib/types"

function analyzeDetections(plan: Plan, detections: Detection[], session: Session, mealTiming: MealTiming): {
  results: Result[]
  unknownMeds: Medication[]
  identityMeds: { med: Medication; present: boolean; name: string }[]
  unknownDetected: number
} {
  const expected: Record<number, number> = {}
  const unknown: Medication[] = []
  const identity: { med: Medication; present: boolean; name: string }[] = []

  for (const med of plan.medications) {
    if (med.doses.length === 0) {
      const match = findDrug(med.name)
      const classIds = med.classId !== null ? [med.classId] : match?.classIds ?? []
      const present = classIds.length > 0 && detections.some((d) => classIds.includes(d.classId))
      identity.push({ med, present, name: match?.matchedName ?? med.name })
      continue
    }

    const doses = med.doses.filter((d) => {
      if (d.session !== session) return false
      if (mealTiming && med.mealTiming && med.mealTiming !== mealTiming) return false
      return true
    })
    if (doses.length === 0) continue

    const total = doses.reduce((s, sc) => s + sc.pillCount, 0)

    const match = findDrug(med.name)
    const allClassIds = match?.classIds ?? (med.classId !== null ? [med.classId] : [])

    if (allClassIds.length > 0) {
      for (const cid of allClassIds) {
        expected[cid] = (expected[cid] ?? 0) + total
      }
    } else {
      unknown.push(med)
    }
  }

  const unknownClassIds = new Set(
    unknown.flatMap((m) => findDrug(m.name)?.classIds ?? []),
  )
  const unknownDetected = detections.filter((d) =>
    unknownClassIds.has(d.classId),
  ).length

  const results = comparePills(expected, detections)

  return { results, unknownMeds: unknown, identityMeds: identity, unknownDetected }
}

export default function ReportPage() {
  const params = useParams()
  const router = useRouter()
  const planId = params.id as string

  const [plan, setPlan] = React.useState<Plan | null>(null)
  const [imageUrl, setImageUrl] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [results, setResults] = React.useState<Result[]>([])
  const [unknownMeds, setUnknownMeds] = React.useState<Medication[]>([])
  const [identityMeds, setIdentityMeds] = React.useState<
    { med: Medication; present: boolean; name: string }[]
  >([])
  const [unknownDetected, setUnknownDetected] = React.useState(0)

  React.useEffect(() => {
    const p = getPlan(planId)
    if (!p) {
      router.push("/")
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage on mount
    setPlan(p)
    if (typeof window !== "undefined") {
      setImageUrl(sessionStorage.getItem(verifyImageKey(planId)))
    }
  }, [planId, router])

  React.useEffect(() => {
    if (!plan || !imageUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no image means nothing to analyze
      if (plan) setLoading(false)
      return
    }

    let cancelled = false

    async function run() {
      if (!plan || !imageUrl) return

      try {
        await loadCatalog()

        const img = new Image()
        img.crossOrigin = "anonymous"
        img.src = imageUrl
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error("Không thể tải ảnh"))
        })

        const detections = await detect(img)
        const session = getCurrentSession()
        const mt = (sessionStorage.getItem(`dose:verify:meal:${planId}`) ?? null) as MealTiming
        const analysis = analyzeDetections(plan, detections, session, mt)

        if (!cancelled) {
          setResults(analysis.results)
          setUnknownMeds(analysis.unknownMeds)
          setUnknownDetected(analysis.unknownDetected)
          setIdentityMeds(analysis.identityMeds)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Lỗi không xác định")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [plan, imageUrl, planId])

  if (!plan) return null

  const correctCount = results.filter((r) => r.status === "correct").length
  const extraCount = results.filter((r) => r.status === "extra").length
  const missingCount = results.filter((r) => r.status === "missing").length
  const overallPass = missingCount === 0 && extraCount === 0 && results.length > 0

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" onClick={() => router.push(`/verification/${planId}`)}>
              <RiArrowLeftLine />
            </Button>
            <div>
              <p className="font-heading text-base leading-tight font-semibold">{plan.name}</p>
              <p className="text-xs text-muted-foreground">Kết quả kiểm tra — Buổi {SESSION_LABELS[getCurrentSession()]}</p>
            </div>
          </div>

          {!loading && (results.length > 0 || unknownMeds.length > 0 || identityMeds.length > 0) && (
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
            <p className="text-sm text-muted-foreground">Đang phân tích khay thuốc...</p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && (results.length > 0 || unknownMeds.length > 0 || identityMeds.length > 0) && (
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
                    : `Phát hiện ${missingCount + extraCount} sai lệch — cần kiểm tra lại`}
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
                    <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed text-sm text-muted-foreground">
                      <p>Chưa có ảnh khay thuốc — chụp ảnh để kiểm tra</p>
                    </div>
                )}

                <Button variant="outline" size="sm" className="w-full" onClick={() => router.push(`/verification/${planId}`)}>
                  <RiRefreshLine />
                  Chụp lại
                </Button>
                <Button variant="outline" size="sm" className="w-full" onClick={() => router.push("/")}>
                  Về trang chủ
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

                {identityMeds.length > 0 && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900 dark:bg-blue-950/40">
                    <div className="flex items-center gap-2">
                      <RiCheckboxCircleFill className="size-4 shrink-0 text-blue-500" />
                      <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                        Kiểm tra định danh (không có lịch uống)
                      </p>
                    </div>
                    <div className="mt-2 flex flex-col gap-1">
                      {identityMeds.map((item) => (
                        <p key={item.med.id} className="text-xs text-blue-700 dark:text-blue-400">
                          {item.present ? "✓" : "✗"}{" "}
                          {item.med.name}
                          {item.name !== item.med.name ? ` → ${item.name}` : ""}
                          {item.present ? " — có trong khay" : " — không tìm thấy"}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {unknownMeds.length > 0 && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/40">
                    <div className="flex items-center gap-2">
                      <RiCloseCircleFill className="size-4 shrink-0 text-red-500" />
                      <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                        Thuốc chưa có trong model ({unknownMeds.length})
                      </p>
                    </div>
                    <div className="mt-2 flex flex-col gap-1">
                      {unknownMeds.map((med) => {
                        const total = med.doses.reduce((s, sc) => s + sc.pillCount, 0)
                        return (
                          <p key={med.id} className="text-xs text-red-700 dark:text-red-400">
                            {med.name} — Kỳ vọng: {total} viên
                          </p>
                        )
                      })}
                    </div>
                    <p className="mt-2 text-xs text-red-600 dark:text-red-500">
                      {unknownDetected > 0
                        ? `Phát hiện ${unknownDetected} viên — vui lòng kiểm tra thủ công`
                        : "Không phát hiện viên thuốc tương ứng — vui lòng kiểm tra thủ công"}
                    </p>
                  </div>
                )}

                <Separator />

                <div className="flex gap-4 rounded-xl bg-muted/40 px-4 py-3 text-sm">
                  <div className="flex flex-1 flex-col items-center gap-0.5">
                    <span className="text-xl font-bold text-emerald-500">{correctCount}</span>
                    <span className="text-xs text-muted-foreground">Đúng</span>
                  </div>
                  <div className="w-px bg-border" />
                  <div className="flex flex-1 flex-col items-center gap-0.5">
                    <span className="text-xl font-bold text-amber-500">{extraCount}</span>
                    <span className="text-xs text-muted-foreground">Ngoài đơn</span>
                  </div>
                  <div className="w-px bg-border" />
                  <div className="flex flex-1 flex-col items-center gap-0.5">
                    <span className="text-xl font-bold text-red-500">{missingCount}</span>
                    <span className="text-xs text-muted-foreground">Sai lệch</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {!loading && !error && results.length === 0 && unknownMeds.length === 0 && identityMeds.length === 0 && (
          <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
            Không có dữ liệu để hiển thị
          </div>
        )}
      </main>
    </div>
  )
}
