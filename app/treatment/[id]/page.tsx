"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import {
  RiArrowLeftLine,
  RiAddLine,
  RiCameraLine,
  RiImageAddLine,
  RiCloseLine,
  RiCheckLine,
  RiSunLine,
  RiBowlLine,
  RiMoonLine,
  RiCapsuleLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { MedicationCard } from "@/components/common/medication-card"
import { SessionRow } from "@/components/common/session-row"
import { getPlan, upsertPlan, generateId } from "@/lib/storage"
import type {
  TreatmentPlan,
  Medication,
  MedicationSession,
  MedicationSchedule,
  ScheduleMap,
} from "@/lib/types"
import { SESSION_LABELS, defaultSchedules } from "@/lib/types"

const SESSIONS: {
  key: MedicationSession
  label: string
  icon: React.ReactNode
}[] = [
  {
    key: "morning",
    label: SESSION_LABELS["morning"],
    icon: <RiSunLine className="size-4" />,
  },
  {
    key: "noon",
    label: SESSION_LABELS["noon"],
    icon: <RiBowlLine className="size-4" />,
  },
  {
    key: "afternoon",
    label: SESSION_LABELS["afternoon"],
    icon: <RiSunLine className="size-4 opacity-60" />,
  },
  {
    key: "evening",
    label: SESSION_LABELS["evening"],
    icon: <RiMoonLine className="size-4" />,
  },
]

export default function TreatmentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const planId = params.id as string

  const [plan, setPlan] = React.useState<TreatmentPlan | null>(
    () => getPlan(planId) ?? null,
  )
  const [dialogOpen, setDialogOpen] = React.useState(false)

  // Add medication form state
  const [step, setStep] = React.useState<"upload" | "form">("upload")
  const [imagePreview, setImagePreview] = React.useState<string | null>(null)
  const [medName, setMedName] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [schedules, setSchedules] =
    React.useState<ScheduleMap>(defaultSchedules())
  const [rawText, setRawText] = React.useState("")

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const cameraInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!plan) router.push("/")
  }, [plan, router])

  function handleFile(file: File) {
    const url = URL.createObjectURL(file)
    setImagePreview(url)
    setStep("form")
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function toggleSession(key: MedicationSession) {
    setSchedules((prev) => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key].enabled },
    }))
  }

  function setPillCount(key: MedicationSession, delta: number) {
    setSchedules((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        pillCount: Math.max(1, prev[key].pillCount + delta),
      },
    }))
  }

  function resetForm() {
    setStep("upload")
    setImagePreview(null)
    setMedName("")
    setNotes("")
    setSchedules(defaultSchedules())
    setRawText("")
  }

  function handleOpenDialog() {
    resetForm()
    setDialogOpen(true)
  }

  const enabledSchedules = Object.entries(schedules).filter(
    ([, s]) => s.enabled,
  )
  const canSave = medName.trim() && enabledSchedules.length > 0

  function handleSaveMed() {
    if (!plan || !canSave) return
    const schedulesOut: MedicationSchedule[] = enabledSchedules.map(
      ([key, s]) => ({
        session: key as MedicationSession,
        pillCount: s.pillCount,
        notes: notes.trim() || undefined,
      }),
    )
    const med: Medication = {
      id: generateId(),
      name: medName.trim(),
      schedules: schedulesOut,
      instructions: rawText.trim(),
      createdAt: new Date().toISOString(),
    }
    const updated = { ...plan, medications: [...plan.medications, med] }
    upsertPlan(updated)
    setPlan(updated)
    setDialogOpen(false)
    resetForm()
  }

  function handleDeleteMed(medId: string) {
    if (!plan) return
    const updated = {
      ...plan,
      medications: plan.medications.filter((m) => m.id !== medId),
    }
    upsertPlan(updated)
    setPlan(updated)
  }

  if (!plan) return null

  return (
    <div className="min-h-svh bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => router.push("/")}
            >
              <RiArrowLeftLine />
            </Button>
            <span className="font-heading text-base font-medium">
              {plan.name}
            </span>
          </div>
          {plan.medications.length > 0 && (
            <Button size="sm" onClick={handleOpenDialog}>
              <RiAddLine />
              Thêm thuốc
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        {plan.medications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
              <RiCapsuleLine className="size-6 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-medium">Chưa có thuốc nào</p>
              <p className="text-sm text-muted-foreground">
                Thêm thuốc vào liệu trình này để bắt đầu theo dõi.
              </p>
            </div>
            <Button onClick={handleOpenDialog}>
              <RiAddLine />
              Thêm thuốc
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {plan.medications.map((med) => (
              <MedicationCard
                key={med.id}
                med={med}
                onDeleteAction={() => handleDeleteMed(med.id)}
              />
            ))}
            <button
              onClick={handleOpenDialog}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/40 hover:text-foreground"
            >
              <RiAddLine className="size-4" />
              Thêm thuốc
            </button>
          </div>
        )}
      </main>

      {/* Dialog thêm thuốc */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Thêm thuốc mới</DialogTitle>
          </DialogHeader>

          {step === "upload" ? (
            <div className="flex flex-col gap-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex min-h-36 w-full flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-border bg-muted/30 transition-colors hover:border-primary/50 hover:bg-muted/50"
              >
                <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                  <RiImageAddLine className="size-5 text-muted-foreground" />
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-sm font-medium">
                    Chọn ảnh đơn thuốc
                  </span>
                  <span className="text-xs text-muted-foreground">
                    JPG, PNG, HEIC...
                  </span>
                </div>
              </button>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => cameraInputRef.current?.click()}
              >
                <RiCameraLine />
                Chụp ảnh trực tiếp
              </Button>

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

              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">hoặc</span>
                <Separator className="flex-1" />
              </div>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setStep("form")}
              >
                Nhập thủ công
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {imagePreview && (
                <div className="relative overflow-hidden rounded-xl border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="Đơn thuốc"
                    className="max-h-40 w-full bg-muted/30 object-contain"
                  />
                  <Button
                    variant="secondary"
                    size="icon-sm"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      setImagePreview(null)
                      setStep("upload")
                    }}
                  >
                    <RiCloseLine />
                  </Button>
                  <div className="border-t bg-muted/50 px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      Đang chờ OCR... (có thể nhập thủ công bên dưới)
                    </p>
                  </div>
                </div>
              )}

              {imagePreview && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">
                    Nội dung đọc được
                  </label>
                  <textarea
                    className="min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    placeholder="OCR sẽ điền tự động. Bạn có thể chỉnh sửa."
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                  />
                </div>
              )}

              <Separator />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">
                  Tên thuốc <span className="text-destructive">*</span>
                </label>
                <Input
                  placeholder="VD: Paracetamol 500mg"
                  value={medName}
                  onChange={(e) => setMedName(e.target.value)}
                  autoFocus={!imagePreview}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">
                  Buổi uống <span className="text-destructive">*</span>
                </label>
                {SESSIONS.map(({ key, label, icon }) => {
                  const s = schedules[key]
                  return (
                    <SessionRow
                      key={key}
                      label={label}
                      icon={icon}
                      enabled={s.enabled}
                      pillCount={s.pillCount}
                      onToggle={() => toggleSession(key)}
                      onDecrease={() => setPillCount(key, -1)}
                      onIncrease={() => setPillCount(key, 1)}
                    />
                  )
                })}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Lưu ý</label>
                <Input
                  placeholder="VD: Uống sau ăn..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {canSave && (
                <Card>
                  <CardContent className="py-3">
                    <p className="font-medium">{medName}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {SESSIONS.filter(({ key }) => schedules[key].enabled).map(
                        ({ key, label }) => (
                          <Badge key={key} variant="secondary">
                            {label} · {schedules[key].pillCount} viên
                          </Badge>
                        ),
                      )}
                    </div>
                    {notes && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {notes}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-2 pb-1">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setDialogOpen(false)}
                >
                  Hủy
                </Button>
                <Button
                  className="flex-1"
                  disabled={!canSave}
                  onClick={handleSaveMed}
                >
                  <RiCheckLine />
                  Lưu thuốc
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
