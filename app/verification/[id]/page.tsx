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
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { getPlan } from "@/lib/storage"
import type { TreatmentPlan, MedicationSession } from "@/lib/types"

const SESSION_LABELS: Record<MedicationSession, string> = {
  morning: "Sáng",
  noon: "Trưa",
  afternoon: "Chiều",
  evening: "Tối",
}

export default function VerificationPage() {
  const params = useParams()
  const router = useRouter()
  const planId = params.id as string

  const [plan] = React.useState<TreatmentPlan | null>(() => getPlan(planId) ?? null)
  const [imagePreview, setImagePreview] = React.useState<string | null>(null)

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const cameraInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!plan) router.push("/")
  }, [plan, router])

  function handleFile(file: File) {
    const url = URL.createObjectURL(file)
    setImagePreview(url)
    // Lưu imageUrl để report page đọc
    sessionStorage.setItem(`dose:verify:image:${planId}`, url)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ""
  }

  if (!plan) return null

  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon-sm" onClick={() => router.push("/")}>
            <RiArrowLeftLine />
          </Button>
          <div>
            <p className="font-heading text-base font-semibold leading-tight">{plan.name}</p>
            <p className="text-xs text-muted-foreground">Kiểm tra khay thuốc</p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-8">

        {/* Medication chips */}
        {plan.medications.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
                    ({med.schedules.map((s) => `${SESSION_LABELS[s.session]} ${s.pillCount}v`).join(", ")})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {imagePreview ? (
          /* Preview state */
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

            {/* CTA */}
            <div className="flex flex-col gap-2">
              <Button className="w-full" onClick={() => router.push(`/verification/${planId}/report`)}>
                Phân tích khay thuốc
                <RiArrowRightLine />
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => cameraInputRef.current?.click()}>
                  <RiRefreshLine />
                  Chụp lại
                </Button>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <RiImageAddLine />
                  Đổi ảnh
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Pick state */
          <div className="flex flex-1 flex-col justify-center gap-6">
            <div className="flex flex-col gap-1 text-center">
              <p className="font-heading text-lg font-semibold">Chụp ảnh khay thuốc</p>
              <p className="text-sm text-muted-foreground">
                Chụp hoặc tải ảnh lên để kiểm tra với liệu trình
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Camera */}
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
                  <span className="text-xs text-muted-foreground">Chụp trực tiếp</span>
                </div>
              </button>

              {/* Upload */}
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
                  <span className="text-xs text-muted-foreground">Từ thư viện</span>
                </div>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Hidden inputs */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
    </div>
  )
}
