"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  RiArrowLeftLine,
  RiCheckboxCircleFill,
  RiCloseCircleFill,
  RiAlertLine,
  RiRefreshLine,
  RiVolumeUpLine,
  RiDownloadLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { listPlans } from "@/lib/storage"
import { ResultRow } from "@/components/common/result-row"
import { BBoxOverlay } from "@/components/common/bbox-overlay"
import type { Detection } from "@/lib/yolo"
import { loadCatalog } from "@/lib/catalog"
import { verify } from "@/lib/verification"
import type { VerificationResult } from "@/lib/verification"
import { getCurrentSession, SESSION_LABELS } from "@/lib/types"
import type { MealTiming } from "@/lib/types"
import { buildReportSpeech } from "@/lib/report-speech"
import {
  addFeedback,
  buildFeedbackExport,
  listFeedback,
  type FeedbackItem,
  type FeedbackValue,
} from "@/lib/feedback"
import type { Result } from "@/lib/types"

const IMAGE_KEY = "dose:verify:global:image"
const MEAL_KEY = "dose:verify:global:meal"

export default function GlobalReportPage() {
  const router = useRouter()

  const [imageUrl, setImageUrl] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<VerificationResult | null>(null)
  const [detections, setDetections] = React.useState<Detection[]>([])
  const [feedbackItems, setFeedbackItems] = React.useState<FeedbackItem[]>([])
  const [feedbackMessage, setFeedbackMessage] = React.useState<string | null>(null)

  React.useEffect(() => {
    const plans = listPlans()
    if (plans.length === 0) {
      router.push("/")
      return
    }
    if (typeof window !== "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from sessionStorage on mount
      setImageUrl(sessionStorage.getItem(IMAGE_KEY))
      setFeedbackItems(listFeedback())
    }
  }, [router])

  React.useEffect(() => {
    const plans = listPlans()
    if (plans.length === 0 || !imageUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no image means nothing to analyze
      if (plans.length > 0) setLoading(false)
      return
    }

    let cancelled = false

    async function run() {
      try {
        await loadCatalog()

        const img = new Image()
        img.crossOrigin = "anonymous"
        img.src = imageUrl!
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error("Không thể tải ảnh"))
        })

        const { detect } = await import("@/lib/yolo")
        const dets = await detect(img)
        const session = getCurrentSession()
        const mt = (sessionStorage.getItem(MEAL_KEY) ?? null) as MealTiming
        const analysis = verify(plans, dets, session, mt)

        if (!cancelled) {
          setDetections(dets)
          setResult(analysis)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Lỗi không xác định")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => { cancelled = true }
  }, [imageUrl])

  const status = result?.status
  const hasData = result && (result.results.length > 0 || result.unknownMeds.length > 0 || result.identityMeds.length > 0)
  const reviewItems = React.useMemo(
    () => [...feedbackItems, ...latestReviewItems(result)],
    [feedbackItems, result],
  )
  const reviewCount = reviewItems.length

  function speakResult() {
    if (!result || typeof window === "undefined" || !("speechSynthesis" in window)) return

    const utterance = new SpeechSynthesisUtterance(buildReportSpeech(result))
    utterance.lang = "vi-VN"
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }

  function handleFeedback(result: Result, feedback: FeedbackValue, correctionText?: string) {
    addFeedback({
      resultClassId: result.classId,
      resultName: result.name,
      expected: result.expected,
      detected: result.detected,
      status: result.status,
      feedback,
      correctionText,
    })
    setFeedbackItems(listFeedback())
    setFeedbackMessage("Đã lưu phản hồi để kiểm tra lại model")
  }

  function exportReviewData() {
    const exported = buildFeedbackExport(reviewItems)
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "dose-review-data.json"
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" onClick={() => router.push("/verify")}>
              <RiArrowLeftLine />
            </Button>
            <div>
              <p className="font-heading text-base leading-tight font-semibold">Kết quả kiểm tra</p>
              <p className="text-xs text-muted-foreground">Buổi {SESSION_LABELS[getCurrentSession()]}</p>
            </div>
          </div>

          {!loading && hasData && (
            <Badge
              variant={status === "pass" ? "default" : status === "fail" ? "destructive" : "secondary"}
              className={cn(
                "gap-1 px-3 py-1 text-sm font-bold",
                status === "pass" && "bg-emerald-500 text-white hover:bg-emerald-500",
                status === "fail" && "bg-red-500 text-white hover:bg-red-500",
                status === "manual_check" && "bg-amber-500 text-white hover:bg-amber-500",
              )}
            >
              {status === "pass" && <RiCheckboxCircleFill className="size-4" />}
              {status === "fail" && <RiCloseCircleFill className="size-4" />}
              {status === "manual_check" && <RiAlertLine className="size-4" />}
              {status === "pass" ? "PASS" : status === "fail" ? "FAIL" : "CẦN KIỂM TRA"}
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

        {!loading && !error && hasData && (
          <>
            <StatusBanner status={status!} result={result!} />

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="flex flex-col gap-3">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Ảnh khay thuốc
                </p>
                {imageUrl ? (
                  <div className="relative overflow-hidden rounded-2xl border shadow-sm">
                    <BBoxOverlay
                      src={imageUrl}
                      detections={detections}
                      results={result!.results}
                      className="relative"
                    />
                  </div>
                ) : (
                  <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed text-sm text-muted-foreground">
                    <p>Chưa có ảnh khay thuốc</p>
                  </div>
                )}

                <Button variant="outline" size="sm" className="w-full" onClick={() => router.push("/verify")}>
                  <RiRefreshLine />
                  Chụp lại
                </Button>
                <Button variant="outline" size="sm" className="w-full" onClick={speakResult}>
                  <RiVolumeUpLine />
                  Nghe kết quả
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
                  {result!.results.map((r) => (
                    <ResultRow key={r.classId} result={r} onFeedback={handleFeedback} />
                  ))}
                </div>

                {feedbackMessage && (
                  <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {feedbackMessage}
                  </p>
                )}

                {result!.identityMeds.length > 0 && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900 dark:bg-blue-950/40">
                    <div className="flex items-center gap-2">
                      <RiCheckboxCircleFill className="size-4 shrink-0 text-blue-500" />
                      <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                        Kiểm tra định danh (không có lịch uống)
                      </p>
                    </div>
                    <div className="mt-2 flex flex-col gap-1">
                      {result!.identityMeds.map((item) => (
                        <p key={item.med.id} className="text-xs text-blue-700 dark:text-blue-400">
                          {item.present ? "✓" : "✗"}{" "}
                          {item.med.name}
                          {item.name !== item.med.name ? ` → ${item.name}` : ""}
                          {item.present ? ", có trong khay" : ", không tìm thấy"}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {result!.unknownMeds.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/40">
                    <div className="flex items-center gap-2">
                      <RiAlertLine className="size-4 shrink-0 text-amber-500" />
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                        Thuốc chưa có trong model ({result!.unknownMeds.length})
                      </p>
                    </div>
                    <div className="mt-2 flex flex-col gap-1">
                      {result!.unknownMeds.map((med) => {
                        const total = med.doses.reduce((s, sc) => s + sc.pillCount, 0)
                        return (
                          <p key={med.id} className="text-xs text-amber-700 dark:text-amber-400">
                            {med.name}: kỳ vọng {med.expected ?? total} {med.unit}
                          </p>
                        )
                      })}
                    </div>
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-500">
                      Thuốc chưa có trong model, vui lòng kiểm tra thủ công
                    </p>
                  </div>
                )}

                <Separator />

                <div className="rounded-xl border bg-card px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Dữ liệu review model</p>
                      <p className="text-xs text-muted-foreground">
                        {reviewCount} mục cần kiểm tra hoặc đã được người dùng phản hồi
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={exportReviewData} disabled={reviewItems.length === 0}>
                      <RiDownloadLine />
                      Xuất JSON
                    </Button>
                  </div>
                  {result!.results.some((r) => r.status === "unclear") && (
                    <p className="mt-2 text-xs text-amber-600">
                      Có kết quả chưa rõ, nên đưa vào tập review trước khi cập nhật model.
                    </p>
                  )}
                </div>

                <div className="flex gap-4 rounded-xl bg-muted/40 px-4 py-3 text-sm">
                  <div className="flex flex-1 flex-col items-center gap-0.5">
                    <span className="text-xl font-bold text-emerald-500">{result!.results.filter((r) => r.status === "correct").length}</span>
                    <span className="text-xs text-muted-foreground">Đúng</span>
                  </div>
                  <div className="w-px bg-border" />
                  <div className="flex flex-1 flex-col items-center gap-0.5">
                    <span className="text-xl font-bold text-amber-500">{result!.results.filter((r) => r.status === "extra").length}</span>
                    <span className="text-xs text-muted-foreground">Ngoài đơn</span>
                  </div>
                  <div className="w-px bg-border" />
                  <div className="flex flex-1 flex-col items-center gap-0.5">
                    <span className="text-xl font-bold text-red-500">{result!.results.filter((r) => r.status === "missing").length}</span>
                    <span className="text-xs text-muted-foreground">Sai lệch</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {!loading && !error && !hasData && (
          <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
            Không có dữ liệu để hiển thị
          </div>
        )}
      </main>
    </div>
  )
}

function latestReviewItems(result: VerificationResult | null): FeedbackItem[] {
  if (!result) return []

  const createdAt = new Date().toISOString()
  const unclear = result.results
    .filter((item) => item.status === "unclear")
    .map((item) => ({
      id: `unclear-${item.classId}`,
      createdAt,
      resultClassId: item.classId,
      resultName: item.name,
      expected: item.expected,
      detected: item.detected,
      status: item.status,
      feedback: "unclear" as const,
    }))

  const unknown = result.unknownMeds.map((item) => ({
    id: `unknown-${item.id}`,
    createdAt,
    resultName: item.name,
    expected: item.expected,
    status: "unknown" as const,
    feedback: "unclear" as const,
  }))

  return [...unclear, ...unknown]
}

function StatusBanner({ status, result }: { status: VerificationResult["status"]; result: VerificationResult }) {
  const missingCount = result.results.filter((r) => r.status === "missing").length
  const extraCount = result.results.filter((r) => r.status === "extra").length
  const unclearCount = result.results.filter((r) => r.status === "unclear").length
  const failCount = missingCount + extraCount + unclearCount

  return (
    <div
      className={cn(
        "mb-6 flex items-center gap-3 rounded-xl px-4 py-3",
        status === "pass" && "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
        status === "fail" && "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300",
        status === "manual_check" && "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
      )}
    >
      {status === "pass" && <RiCheckboxCircleFill className="size-5 shrink-0 text-emerald-500" />}
      {status === "fail" && <RiCloseCircleFill className="size-5 shrink-0 text-red-500" />}
      {status === "manual_check" && <RiAlertLine className="size-5 shrink-0 text-amber-500" />}
      <div>
        <p className="text-sm font-semibold">
          {status === "pass" && "Không phát hiện sai lệch, khay thuốc khớp với tất cả đơn thuốc"}
          {status === "fail" && `Phát hiện ${failCount} sai lệch, cần kiểm tra lại`}
          {status === "manual_check" && "Thuốc cần kiểm tra thủ công"}
        </p>
      </div>
    </div>
  )
}
