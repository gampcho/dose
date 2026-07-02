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
  RiShareForwardLine,
  RiStopCircleLine,
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
import type { Result, Session } from "@/lib/types"
import { speakVietnamese, stopSpeech } from "@/lib/speech"
import {
  VERIFY_IMAGE_KEY,
  VERIFY_MEAL_KEY,
  VERIFY_SESSION_KEY,
} from "@/lib/onboarding"

export default function GlobalReportPage() {
  const router = useRouter()

  const [imageUrl, setImageUrl] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<VerificationResult | null>(null)
  const [detections, setDetections] = React.useState<Detection[]>([])
  const [feedbackItems, setFeedbackItems] = React.useState<FeedbackItem[]>([])
  const [autoReviewItems, setAutoReviewItems] = React.useState<FeedbackItem[]>(
    [],
  )
  const [feedbackMessage, setFeedbackMessage] = React.useState<string | null>(null)
  const [shareMessage, setShareMessage] = React.useState<string | null>(null)
  const [session, setSession] = React.useState<Session | null>(null)

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- current session must come from the client timezone
    setSession(readSessionOverride() ?? getCurrentSession())

    const plans = listPlans()
    if (plans.length === 0) {
      router.push("/")
      return
    }
    const savedImage = sessionStorage.getItem(VERIFY_IMAGE_KEY)
    setImageUrl(savedImage)
    setFeedbackItems(listFeedback())
    if (!savedImage) setLoading(false)
  }, [router])

  React.useEffect(() => {
    if (!imageUrl || !session) return
    const activeSession = session

    const plans = listPlans()
    if (plans.length === 0) {
      router.push("/")
      return
    }

    let cancelled = false

    async function run() {
      try {
        setLoading(true)
        setError(null)
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
        const analysis = verify(plans, dets, activeSession, readMealTiming())

        if (!cancelled) {
          setDetections(dets)
          setResult(analysis)
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Lỗi không xác định")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => { cancelled = true }
  }, [imageUrl, router, session])

  React.useEffect(() => {
    let cancelled = false

    async function prepareReviewItems() {
      if (!result || !session) {
        setAutoReviewItems([])
        return
      }

      const items = await buildAutomaticReviewItems({
        result,
        detections,
        imageUrl,
        session,
        mealTiming: readMealTiming(),
      })
      if (!cancelled) setAutoReviewItems(items)
    }

    prepareReviewItems()
    return () => {
      cancelled = true
    }
  }, [detections, imageUrl, result, session])

  const status = result?.status
  const hasData =
    result &&
    (result.results.length > 0 ||
      result.unknownMeds.length > 0 ||
      result.identityMeds.length > 0)
  const reviewItems = React.useMemo(
    () => [...feedbackItems, ...autoReviewItems],
    [autoReviewItems, feedbackItems],
  )
  const reviewCount = reviewItems.length

  function speakResult() {
    if (result) speakVietnamese(buildReportSpeech(result))
  }

  function handleFeedback(
    result: Result,
    feedback: FeedbackValue,
    correctionText?: string,
    correctionCount?: number,
  ) {
    void saveFeedback(result, feedback, correctionText, correctionCount)
  }

  async function saveFeedback(
    result: Result,
    feedback: FeedbackValue,
    correctionText?: string,
    correctionCount?: number,
  ) {
    const detection = bestDetection(detections, result.classId)
    const crop = await cropDetection(imageUrl, detection)

    addFeedback({
      source: "user_feedback",
      resultClassId: result.classId,
      resultName: result.name,
      modelName: result.modelName,
      detectorModel: "vaipe12n.onnx",
      rawClassId: result.rawClassId,
      rawModelName: result.rawModelName,
      secondClassId: result.secondClassId,
      secondModelName: result.secondModelName,
      oodConfidence: result.oodConfidence,
      margin: result.margin,
      safetyReason: result.safetyReason,
      expected: result.expected,
      detected: result.detected,
      confidence: result.confidence,
      unit: result.unit,
      status: result.status,
      feedback,
      correctionText,
      correctionCount,
      correctedName:
        feedback === "incorrect_name" ? correctionText?.trim() : undefined,
      bbox: detection?.bbox,
      cropImageDataUrl: crop?.dataUrl,
      imageWidth: crop?.imageWidth,
      imageHeight: crop?.imageHeight,
      session: session ?? undefined,
      mealTiming: readMealTiming(),
    })
    setFeedbackItems(listFeedback())
    setFeedbackMessage("Đã lưu phản hồi để đưa vào dữ liệu review model")
  }

  function exportReviewData() {
    const exported = buildFeedbackExport(reviewItems)
    const blob = new Blob([JSON.stringify(exported, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "dose-review-bundle.json"
    link.click()
    URL.revokeObjectURL(url)
  }

  async function shareCaregiverSummary() {
    if (!result || !session) return

    const text = buildCaregiverSummary(result, session, readMealTiming())
    const nav = navigator as Navigator & {
      share?: (data: ShareData) => Promise<void>
      clipboard?: Clipboard
    }
    try {
      if (nav.share) {
        await nav.share({ title: "Kết quả DOSE", text })
        setShareMessage("Đã mở chia sẻ kết quả")
        return
      }
      if (!nav.clipboard) {
        setShareMessage("Trình duyệt không hỗ trợ chia sẻ kết quả")
        return
      }
      await nav.clipboard.writeText(text)
      setShareMessage("Đã sao chép kết quả")
    } catch {
      setShareMessage("Không thể chia sẻ, vui lòng thử lại")
    }
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => router.push("/verify")}
            >
              <RiArrowLeftLine />
            </Button>
            <div>
              <p className="font-heading text-base leading-tight font-semibold">Kết quả kiểm tra</p>
              <p className="text-xs text-muted-foreground">
                {session ? `Buổi ${SESSION_LABELS[session]}` : "Đang xác định buổi uống"}
              </p>
            </div>
          </div>

          {!loading && hasData && (
            <Badge
              variant={
                status === "pass"
                  ? "default"
                  : status === "fail"
                    ? "destructive"
                    : "secondary"
              }
              className={cn(
                "gap-1 px-3 py-1 text-sm font-bold",
                status === "pass" &&
                  "bg-emerald-500 text-white hover:bg-emerald-500",
                status === "fail" && "bg-red-500 text-white hover:bg-red-500",
                status === "manual_check" &&
                  "bg-amber-500 text-white hover:bg-amber-500",
              )}
            >
              {status === "pass" && <RiCheckboxCircleFill className="size-4" />}
              {status === "fail" && <RiCloseCircleFill className="size-4" />}
              {status === "manual_check" && <RiAlertLine className="size-4" />}
              {status === "pass"
                ? "PASS"
                : status === "fail"
                  ? "FAIL"
                  : "CẦN KIỂM TRA"}
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

        {!loading && !error && hasData && (
          <>
            <StatusBanner status={status!} result={result!} />

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="flex flex-col gap-3">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Ảnh khay thuốc
                </p>
                {imageUrl ? (
                  <div className="overflow-hidden rounded-2xl border shadow-sm">
                    <BBoxOverlay
                      src={imageUrl}
                      detections={detections}
                      results={result!.results}
                      className="max-h-[28rem] w-full bg-muted/30"
                    />
                  </div>
                ) : (
                  <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed text-sm text-muted-foreground">
                    <p>Chưa có ảnh khay thuốc</p>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => router.push("/verify")}
                >
                  <RiRefreshLine />
                  Chụp lại
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={speakResult}
                >
                  <RiVolumeUpLine />
                  Nghe kết quả
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={stopSpeech}
                >
                  <RiStopCircleLine />
                  Dừng đọc
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={shareCaregiverSummary}
                >
                  <RiShareForwardLine />
                  Chia sẻ kết quả
                </Button>
                {shareMessage && (
                  <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
                    {shareMessage}
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => router.push("/")}
                >
                  Về trang chủ
                </Button>
              </div>

              <div className="flex flex-col gap-3">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Kết quả từng thuốc
                </p>

                <div className="flex flex-col gap-2">
                  {result!.results.map((r) => (
                    <ResultRow key={r.classId} result={r} />
                  ))}
                </div>

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
                        <p
                          key={item.med.id}
                          className="text-xs text-blue-700 dark:text-blue-400"
                        >
                          {item.present ? "✓" : "✗"} {item.med.name}
                          {item.name !== item.med.name ? ` → ${item.name}` : ""}
                          {item.present
                            ? ", có trong khay"
                            : ", không tìm thấy"}
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
                        const total = med.doses.reduce(
                          (s, sc) => s + sc.pillCount,
                          0,
                        )
                        return (
                          <p
                            key={med.id}
                            className="text-xs text-amber-700 dark:text-amber-400"
                          >
                            {med.name}: kỳ vọng {med.expected ?? total}{" "}
                            {med.unit}
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

                <div className="flex gap-4 rounded-xl bg-muted/40 px-4 py-3 text-sm">
                  <div className="flex flex-1 flex-col items-center gap-0.5">
                    <span className="text-xl font-bold text-emerald-500">
                      {
                        result!.results.filter((r) => r.status === "correct")
                          .length
                      }
                    </span>
                    <span className="text-xs text-muted-foreground">Khớp</span>
                  </div>
                  <div className="w-px bg-border" />
                  <div className="flex flex-1 flex-col items-center gap-0.5">
                    <span className="text-xl font-bold text-amber-500">
                      {
                        result!.results.filter((r) => r.status === "extra")
                          .length
                      }
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Ngoài đơn
                    </span>
                  </div>
                  <div className="w-px bg-border" />
                  <div className="flex flex-1 flex-col items-center gap-0.5">
                    <span className="text-xl font-bold text-red-500">
                      {
                        result!.results.filter((r) => r.status === "missing")
                          .length
                      }
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Sai lệch
                    </span>
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

function readMealTiming(): MealTiming {
  const value = sessionStorage.getItem(VERIFY_MEAL_KEY)
  return value === "before" || value === "after" ? value : null
}

function readSessionOverride(): Session | null {
  const value = sessionStorage.getItem(VERIFY_SESSION_KEY)
  if (
    value === "morning" ||
    value === "noon" ||
    value === "afternoon" ||
    value === "evening"
  ) {
    return value
  }
  return null
}

async function buildAutomaticReviewItems({
  result,
  detections,
  imageUrl,
  session,
  mealTiming,
}: {
  result: VerificationResult
  detections: Detection[]
  imageUrl: string | null
  session: Session
  mealTiming: MealTiming
}): Promise<FeedbackItem[]> {
  const createdAt = new Date().toISOString()
  const image = imageUrl ? await loadImageForReview(imageUrl) : null
  const items: FeedbackItem[] = []

  for (const item of result.results.filter(shouldReviewResult)) {
    const detection = bestDetection(detections, item.classId)
    const crop = detection && image ? cropDetectionFromImage(image, detection) : null
    items.push({
      id: `auto-${reviewFeedback(item)}-${item.classId}`,
      createdAt,
      source: "auto_review",
      resultClassId: item.classId,
      resultName: item.name,
      modelName: item.modelName,
      detectorModel: "vaipe12n.onnx",
      rawClassId: item.rawClassId,
      rawModelName: item.rawModelName,
      secondClassId: item.secondClassId,
      secondModelName: item.secondModelName,
      oodConfidence: item.oodConfidence,
      margin: item.margin,
      safetyReason: item.safetyReason,
      expected: item.expected,
      detected: item.detected,
      confidence: item.confidence,
      unit: item.unit,
      status: item.status,
      feedback: reviewFeedback(item),
      bbox: detection?.bbox,
      cropImageDataUrl: crop?.dataUrl,
      imageWidth: crop?.imageWidth,
      imageHeight: crop?.imageHeight,
      session,
      mealTiming,
    })
  }

  for (const item of result.identityMeds.filter((item) => !item.present)) {
    items.push({
      id: `auto-identity-${item.med.id}`,
      createdAt,
      source: "auto_review",
      resultClassId: item.med.classId ?? undefined,
      resultName: item.med.name,
      expected: 1,
      detected: 0,
      unit: item.med.unit,
      status: "identity",
      feedback: "missing_expected",
      session,
      mealTiming,
      detectorModel: "vaipe12n.onnx",
    })
  }

  for (const item of result.unknownMeds) {
    items.push({
      id: `auto-ood-${item.id}`,
      createdAt,
      source: "auto_review",
      resultName: item.name,
      expected: item.expected,
      unit: item.unit,
      status: "unknown",
      feedback: "ood_unknown",
      session,
      mealTiming,
      detectorModel: "vaipe12n.onnx",
    })
  }

  return items
}

function shouldReviewResult(result: Result): boolean {
  return result.status !== "correct" || result.classId === 107
}

function reviewFeedback(result: Result): FeedbackValue {
  if (result.classId === 107) return "ood_unknown"
  if (result.status === "missing") return "missing_expected"
  if (result.status === "extra") return "extra_unexpected"
  if (result.status === "unclear") return "unclear"
  return "correct"
}

function bestDetection(
  detections: Detection[],
  classId: number,
): Detection | undefined {
  return detections
    .filter((item) => item.classId === classId)
    .sort((a, b) => b.confidence - a.confidence)[0]
}

async function cropDetection(
  imageUrl: string | null,
  detection: Detection | undefined,
): Promise<{ dataUrl: string; imageWidth: number; imageHeight: number } | null> {
  if (!imageUrl || !detection) return null
  const image = await loadImageForReview(imageUrl)
  return image ? cropDetectionFromImage(image, detection) : null
}

async function loadImageForReview(src: string): Promise<HTMLImageElement | null> {
  try {
    const image = new Image()
    image.crossOrigin = "anonymous"
    image.src = src
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error("image load failed"))
    })
    return image
  } catch {
    return null
  }
}

function cropDetectionFromImage(
  image: HTMLImageElement,
  detection: Detection,
): { dataUrl: string; imageWidth: number; imageHeight: number } | null {
  const imageWidth = image.naturalWidth
  const imageHeight = image.naturalHeight
  const box = clampBBox(detection.bbox, imageWidth, imageHeight)
  if (box.w <= 0 || box.h <= 0) return null

  try {
    const canvas = document.createElement("canvas")
    canvas.width = box.w
    canvas.height = box.h
    const ctx = canvas.getContext("2d")
    if (!ctx) return null

    ctx.drawImage(image, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h)
    return {
      dataUrl: canvas.toDataURL("image/png"),
      imageWidth,
      imageHeight,
    }
  } catch {
    return null
  }
}

function clampBBox(
  box: Detection["bbox"],
  imageWidth: number,
  imageHeight: number,
): Detection["bbox"] {
  const x = Math.max(0, Math.min(box.x, imageWidth))
  const y = Math.max(0, Math.min(box.y, imageHeight))
  const right = Math.max(x, Math.min(box.x + box.w, imageWidth))
  const bottom = Math.max(y, Math.min(box.y + box.h, imageHeight))
  return {
    x: Math.round(x),
    y: Math.round(y),
    w: Math.round(right - x),
    h: Math.round(bottom - y),
  }
}

function buildCaregiverSummary(
  result: VerificationResult,
  session: Session,
  mealTiming: MealTiming,
): string {
  const status =
    result.status === "pass"
      ? "ĐẠT"
      : result.status === "fail"
        ? "KHÔNG ĐẠT"
        : "CẦN KIỂM TRA"
  const timing =
    mealTiming === "before"
      ? "trước ăn"
      : mealTiming === "after"
        ? "sau ăn"
        : "tất cả thời điểm ăn"
  const lines = [
    "DOSE - Kết quả kiểm tra khay thuốc",
    `Thời điểm: Buổi ${SESSION_LABELS[session]}, ${timing}`,
    `Trạng thái: ${status}`,
    result.status === "pass"
      ? "Không phát hiện sai lệch."
      : "Không nên uống cho đến khi đã kiểm tra lại.",
    ...result.results
      .filter((item) => item.status !== "correct")
      .map(
        (item) =>
          `${statusLabel(item.status)}: ${item.name}, cần ${item.expected} ${item.unit}, thấy ${item.detected}.`,
      ),
    ...result.identityMeds
      .filter((item) => !item.present)
      .map((item) => `Không tìm thấy: ${item.med.name}.`),
    ...result.unknownMeds.map(
      (item) => `Thuốc chưa có trong model: ${item.name}, cần ${item.expected} ${item.unit}.`,
    ),
    `Thời gian: ${new Date().toLocaleString("vi-VN")}`,
  ]

  return lines.join("\n")
}

function statusLabel(status: Result["status"]): string {
  if (status === "missing") return "Thiếu"
  if (status === "extra") return "Thừa/ngoài đơn"
  if (status === "unclear") return "Ảnh chưa rõ"
  return "Khớp"
}

function StatusBanner({
  status,
  result,
}: {
  status: VerificationResult["status"]
  result: VerificationResult
}) {
  const missingCount = result.results.filter(
    (r) => r.status === "missing",
  ).length
  const extraCount = result.results.filter((r) => r.status === "extra").length
  const unclearCount = result.results.filter(
    (r) => r.status === "unclear",
  ).length
  const failCount = missingCount + extraCount + unclearCount

  return (
    <div
      className={cn(
        "mb-6 flex items-center gap-3 rounded-xl px-4 py-3",
        status === "pass" &&
          "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
        status === "fail" &&
          "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300",
        status === "manual_check" &&
          "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
      )}
    >
      {status === "pass" && (
        <RiCheckboxCircleFill className="size-5 shrink-0 text-emerald-500" />
      )}
      {status === "fail" && (
        <RiCloseCircleFill className="size-5 shrink-0 text-red-500" />
      )}
      {status === "manual_check" && (
        <RiAlertLine className="size-5 shrink-0 text-amber-500" />
      )}
      <div>
        <p className="text-sm font-semibold">
          {status === "pass" &&
            "Không phát hiện sai lệch, khay thuốc khớp với tất cả đơn thuốc"}
          {status === "fail" &&
            `Phát hiện ${failCount} sai lệch, cần kiểm tra lại`}
          {status === "manual_check" && "Thuốc cần kiểm tra thủ công"}
        </p>
      </div>
    </div>
  )
}
