"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import {
  RiArrowLeftLine,
  RiCameraLine,
  RiImageAddLine,
  RiCapsuleLine,
  RiCloseLine,
  RiRefreshLine,
  RiArrowRightLine,
  RiFileListLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { getPlan } from "@/lib/storage"
import { ocr } from "@/lib/ocr"
import { parsePrescription, parseWithLLM } from "@/lib/parser"
import type { TreatmentPlan } from "@/lib/types"
import { SESSION_LABELS } from "@/lib/types"
import type { TextBox } from "@/lib/ocr"

export default function VerificationPage() {
  const params = useParams()
  const router = useRouter()
  const planId = params.id as string

  const [plan, setPlan] = React.useState<TreatmentPlan | null>(null)
  const [imagePreview, setImagePreview] = React.useState<string | null>(null)
  const [ocrText, setOcrText] = React.useState<string>("")
  const [ocrLoading, setOcrLoading] = React.useState(false)
  const [parsedMeds, setParsedMeds] = React.useState<
    {
      drugName: string
      quantity: number
      dosage: string
      instructions: string
      matchedName: string | null
    }[]
  >([])

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const cameraInputRef = React.useRef<HTMLInputElement>(null)
  const prescriptionInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    const p = getPlan(planId)
    if (!p) {
      router.push("/")
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlan(p)
  }, [planId, router])

  function handleFile(file: File) {
    const url = URL.createObjectURL(file)
    setImagePreview(url)
    sessionStorage.setItem(`dose:verify:image:${planId}`, url)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ""
  }

  async function handlePrescription(file: File) {
    setOcrLoading(true)
    try {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.src = url
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error("Cannot load image"))
      })

      const results: TextBox[] = await ocr(img)
      const text = results.map((r) => r.text).join("\n")
      setOcrText(text || "Không nhận diện được văn bản")

      let parsed = parsePrescription(results.map((r) => r.text))
      if (parsed.length === 0 && text.length > 10) {
        parsed = await parseWithLLM(text)
      }
      setParsedMeds(parsed)
    } catch (e) {
      setOcrText(
        "Lỗi: " + (e instanceof Error ? e.message : "Không xác định"),
      )
    } finally {
      setOcrLoading(false)
    }
  }

  function handlePrescriptionChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handlePrescription(file)
    e.target.value = ""
  }

  if (!plan) return null

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => router.push("/")}
          >
            <RiArrowLeftLine />
          </Button>
          <div>
            <p className="font-heading text-base leading-tight font-semibold">
              {plan.name}
            </p>
            <p className="text-xs text-muted-foreground">Kiểm tra khay thuốc</p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-8">
        {plan.medications.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Thuốc trong liệu trình
            </p>
            <div className="flex flex-wrap gap-2">
              {plan.medications.map((med) => (
                <div
                  key={med.id}
                  className="flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1.5"
                >
                  <RiCapsuleLine className="size-3.5 text-primary" />
                  <span className="text-xs font-medium">{med.name}</span>
                  <span className="text-xs text-muted-foreground">
                    (
                    {med.schedules
                      .map(
                        (s) => `${SESSION_LABELS[s.session]} ${s.pillCount}v`,
                      )
                      .join(", ")}
                    )
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Đơn thuốc
          </p>
          {ocrLoading ? (
            <div className="flex items-center gap-3 rounded-xl border bg-muted/40 px-4 py-3">
              <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">
                Đang đọc đơn thuốc...
              </p>
            </div>
          ) : ocrText ? (
            <div className="rounded-xl border bg-muted/40 px-4 py-3">
              <p className="whitespace-pre-wrap text-sm">{ocrText}</p>
              {parsedMeds.length > 0 && (
                <div className="mt-3 flex flex-col gap-1.5 border-t pt-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Thuốc phát hiện: {parsedMeds.length}
                  </p>
                  {parsedMeds.map((med, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg bg-background px-2.5 py-1.5 text-xs"
                    >
                      <div>
                        <span className="font-medium">{med.drugName}</span>
                        {med.matchedName && (
                          <span className="ml-1 text-muted-foreground">
                            → {med.matchedName}
                          </span>
                        )}
                      </div>
                      <span className="text-muted-foreground">
                        {med.quantity > 0 ? `${med.quantity} viên` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => prescriptionInputRef.current?.click()}
              >
                <RiRefreshLine className="size-3.5" />
                Quét lại
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => prescriptionInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/40 hover:text-foreground"
            >
              <RiFileListLine className="size-4" />
              Quét đơn thuốc (OCR)
            </button>
          )}
        </div>

        {imagePreview ? (
          <div className="flex flex-col gap-4">
            <div className="relative overflow-hidden rounded-2xl border shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt="Khay thuốc"
                className="max-h-72 w-full bg-muted/30 object-contain"
              />
              <button
                onClick={() => setImagePreview(null)}
                className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-opacity hover:bg-black/70"
              >
                <RiCloseLine className="size-4" />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                className="w-full"
                onClick={() => router.push(`/verification/${planId}/report`)}
              >
                Phân tích khay thuốc
                <RiArrowRightLine />
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <RiRefreshLine />
                  Chụp lại
                </Button>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <RiImageAddLine />
                  Đổi ảnh
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col justify-center gap-6">
            <div className="flex flex-col gap-1 text-center">
              <p className="font-heading text-lg font-semibold">
                Chụp ảnh khay thuốc
              </p>
              <p className="text-sm text-muted-foreground">
                Chụp hoặc tải ảnh lên để kiểm tra với liệu trình
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="group flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-border bg-card py-10 shadow-sm transition-all hover:border-primary hover:shadow-md active:scale-[0.97]"
              >
                <div className="flex size-16 items-center justify-center rounded-2xl bg-primary shadow-sm transition-transform group-hover:scale-105">
                  <RiCameraLine className="size-8 text-primary-foreground" />
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-sm font-semibold">Camera</span>
                  <span className="text-xs text-muted-foreground">
                    Chụp trực tiếp
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-border bg-card py-10 shadow-sm transition-all hover:border-primary hover:shadow-md active:scale-[0.97]"
              >
                <div className="flex size-16 items-center justify-center rounded-2xl bg-secondary shadow-sm transition-transform group-hover:scale-105">
                  <RiImageAddLine className="size-8 text-secondary-foreground" />
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-sm font-semibold">Tải ảnh lên</span>
                  <span className="text-xs text-muted-foreground">
                    Từ thư viện
                  </span>
                </div>
              </button>
            </div>
          </div>
        )}
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={prescriptionInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePrescriptionChange}
      />
    </div>
  )
}
