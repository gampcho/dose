"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  RiArrowLeftLine,
  RiCameraLine,
  RiImageAddLine,
  RiCloseLine,
  RiRefreshLine,
  RiArrowRightLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { listPlans } from "@/lib/storage"
import type { MealTiming } from "@/lib/types"

const IMAGE_KEY = "dose:verify:global:image"
const MEAL_KEY = "dose:verify:global:meal"

export default function GlobalVerifyPage() {
  const router = useRouter()
  const [imagePreview, setImagePreview] = React.useState<string | null>(null)
  const [mealTiming, setMealTiming] = React.useState<MealTiming>(null)
  const [planCount, setPlanCount] = React.useState(0)
  const [totalMeds, setTotalMeds] = React.useState(0)

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const cameraInputRef = React.useRef<HTMLInputElement>(null)

  function readSavedImage(): string | null {
    const saved = sessionStorage.getItem(IMAGE_KEY)
    if (!saved) return null
    if (!saved.startsWith("blob:")) return saved

    sessionStorage.removeItem(IMAGE_KEY)
    return null
  }

  React.useEffect(() => {
    const plans = listPlans()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage on mount
    setPlanCount(plans.length)
    setTotalMeds(plans.reduce((s, p) => s + p.medications.length, 0))
    const saved = readSavedImage()
    if (saved) setImagePreview(saved)
  }, [])

  function handleFile(file: File) {
    const url = URL.createObjectURL(file)
    setImagePreview(url)
    if (typeof window !== "undefined") {
      sessionStorage.setItem(IMAGE_KEY, url)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ""
  }

  function clearImagePreview() {
    setImagePreview(null)
    sessionStorage.removeItem(IMAGE_KEY)
  }

  function handleVerify() {
    if (mealTiming && typeof window !== "undefined") {
      sessionStorage.setItem(MEAL_KEY, mealTiming)
    } else if (typeof window !== "undefined") {
      sessionStorage.removeItem(MEAL_KEY)
    }
    router.push("/verify/report")
  }

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
              Kiểm tra khay thuốc
            </p>
            <p className="text-xs text-muted-foreground">
              {planCount} đơn thuốc, {totalMeds} loại thuốc
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-8">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Thời điểm uống
          </p>
          <div className="flex gap-2">
            {(["before", "after"] as const).map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setMealTiming(mealTiming === val ? null : val)}
                className={`flex-1 rounded-lg border py-2.5 text-sm transition-colors ${
                  mealTiming === val
                    ? "border-primary bg-primary/10 font-medium text-primary"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/40"
                }`}
              >
                {val === "before" ? "Trước ăn" : "Sau ăn"}
              </button>
            ))}
          </div>
        </div>

        {imagePreview ? (
          <div className="flex flex-col gap-4">
            <div className="relative overflow-hidden rounded-2xl border shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt="Khay thuốc"
                onError={clearImagePreview}
                className="max-h-72 w-full bg-muted/30 object-contain"
              />
              <button
                onClick={clearImagePreview}
                className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-opacity hover:bg-black/70"
              >
                <RiCloseLine className="size-4" />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <Button className="w-full" onClick={handleVerify}>
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
                Kiểm tra tất cả thuốc từ {planCount} đơn thuốc
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
    </div>
  )
}
