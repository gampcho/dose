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
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { MedicationCard } from "@/components/common/medication-card"
import { SessionRow } from "@/components/common/session-row"
import { getPlan, upsertPlan, generateId } from "@/lib/storage"
import { ocr } from "@/lib/ocr"
import { parsePrescription, parseWithLLM } from "@/lib/parser"
import type { ParsedMedication } from "@/lib/parser"
import type {
  TreatmentPlan,
  Medication,
  MedicationSession,
  MedicationSchedule,
  ScheduleMap,
  MealTiming,
} from "@/lib/types"
import { SESSION_LABELS, defaultSchedules } from "@/lib/types"
import type { TextBox } from "@/lib/ocr"

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

type DraftMed = {
  name: string
  schedules: ScheduleMap
  mealTiming: MealTiming
  notes: string
}

export default function TreatmentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const planId = params.id as string

  const [plan, setPlan] = React.useState<TreatmentPlan | null>(
    () => getPlan(planId) ?? null,
  )
  const [dialogOpen, setDialogOpen] = React.useState(
    () => (getPlan(planId)?.medications.length ?? 0) === 0,
  )

  React.useEffect(() => {
    if (!plan) router.push("/")
  }, [plan, router])

  const [step, setStep] = React.useState<"upload" | "ocr-select" | "form">(
    "upload",
  )
  const [imagePreview, setImagePreview] = React.useState<string | null>(null)
  const [rawText, setRawText] = React.useState("")
  const [ocrLoading, setOcrLoading] = React.useState(false)
  const [parsedMeds, setParsedMeds] = React.useState<ParsedMedication[]>([])
  const [selectedIndices, setSelectedIndices] = React.useState<Set<number>>(
    new Set(),
  )

  const [medName, setMedName] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [schedules, setSchedules] =
    React.useState<ScheduleMap>(defaultSchedules())
  const [mealTiming, setMealTiming] = React.useState<MealTiming>(null)

  const [editMed, setEditMed] = React.useState<Medication | null>(null)
  const [editDraft, setEditDraft] = React.useState<DraftMed | null>(null)

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const cameraInputRef = React.useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    const url = URL.createObjectURL(file)
    setImagePreview(url)
    setOcrLoading(true)
    setRawText("")
    setStep("ocr-select")

    try {
      const img = new Image()
      img.src = url
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error("Cannot load image"))
      })

      const results: TextBox[] = await ocr(img)
      const text = results.map((r) => r.text).join("\n")
      setRawText(text || "Không nhận diện được văn bản")

      let parsed = parsePrescription(results.map((r) => r.text))
      if (parsed.length === 0 && text.length > 10) {
        parsed = await parseWithLLM(text)
      }
      setParsedMeds(parsed)
      setSelectedIndices(new Set(parsed.map((_m, i) => i)))
    } catch (e) {
      setRawText(
        "Lỗi OCR: " + (e instanceof Error ? e.message : "Không xác định"),
      )
      setParsedMeds([])
    } finally {
      setOcrLoading(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ""
  }

  function toggleSelected(i: number) {
    setSelectedIndices((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  function resetForm() {
    setStep("upload")
    setImagePreview(null)
    setMedName("")
    setNotes("")
    setSchedules(defaultSchedules())
    setMealTiming(null)
    setRawText("")
    setParsedMeds([])
    setSelectedIndices(new Set())
  }

  function handleOpenDialog() {
    resetForm()
    setDialogOpen(true)
  }

  function saveMeds(meds: Medication[]) {
    if (!plan) return
    const updated = { ...plan, medications: [...plan.medications, ...meds] }
    upsertPlan(updated)
    setPlan(updated)
  }

  function handleSaveSelected() {
    const meds: Medication[] = Array.from(selectedIndices)
      .sort((a, b) => a - b)
      .map((i) => {
        const p = parsedMeds[i]
        const schedules: MedicationSchedule[] = []
        if (p.session !== "none") {
          schedules.push({ session: p.session as MedicationSession, pillCount: p.quantity || 1 })
        }
        return {
          id: generateId(),
          name: p.drugName,
          schedules,
          mealTiming: p.condition === "before_eat" ? "before" as const : p.condition === "after_eat" ? "after" as const : null,
          notes: p.matchedName || "",
          instructions: p.instructions || rawText.trim(),
          createdAt: new Date().toISOString(),
        }
      })
    saveMeds(meds)
    setDialogOpen(false)
    resetForm()
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
      }),
    )
    const med: Medication = {
      id: generateId(),
      name: medName.trim(),
      schedules: schedulesOut,
      mealTiming,
      notes: notes.trim(),
      instructions: rawText.trim(),
      createdAt: new Date().toISOString(),
    }
    saveMeds([med])
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

  function openEdit(med: Medication) {
    const sm = defaultSchedules()
    for (const s of med.schedules) sm[s.session] = { enabled: true, pillCount: s.pillCount }
    setEditDraft({ name: med.name, schedules: sm, mealTiming: med.mealTiming, notes: med.notes })
    setEditMed(med)
  }

  function handleSaveEdit() {
    if (!plan || !editMed || !editDraft) return
    const schedulesOut: MedicationSchedule[] = Object.entries(editDraft.schedules)
      .filter(([, s]) => s.enabled)
      .map(([key, s]) => ({ session: key as MedicationSession, pillCount: s.pillCount }))
    const updated = {
      ...plan,
      medications: plan.medications.map((m) =>
        m.id !== editMed.id
          ? m
          : { ...m, name: editDraft.name, schedules: schedulesOut, mealTiming: editDraft.mealTiming, notes: editDraft.notes },
      ),
    }
    upsertPlan(updated)
    setPlan(updated)
    setEditMed(null)
    setEditDraft(null)
  }

  if (!plan) return null

  return (
    <div className="min-h-svh bg-background">
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
        <div className="flex flex-col gap-3">
          {plan.medications.map((med) => (
            <MedicationCard
              key={med.id}
              med={med}
              onEditAction={() => openEdit(med)}
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
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Thêm thuốc mới</DialogTitle>
          </DialogHeader>

          {step === "upload" && (
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
                  <span className="text-sm font-medium">Chọn ảnh đơn thuốc</span>
                  <span className="text-xs text-muted-foreground">JPG, PNG, HEIC...</span>
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
          )}

          {step === "ocr-select" && (
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
                      {ocrLoading
                        ? "Đang đọc đơn thuốc..."
                        : rawText
                          ? `Đã đọc ${rawText.split("\n").filter((l) => l.trim()).length} dòng`
                          : "Chưa có kết quả"}
                    </p>
                  </div>
                </div>
              )}

              {ocrLoading && (
                <p className="text-center text-sm text-muted-foreground">
                  Đang nhận diện thuốc...
                </p>
              )}

              {!ocrLoading && parsedMeds.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Thuốc phát hiện ({parsedMeds.length})
                    </span>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                      onClick={() =>
                        setSelectedIndices(
                          selectedIndices.size === parsedMeds.length
                            ? new Set()
                            : new Set(parsedMeds.map((_, i) => i)),
                        )
                      }
                    >
                      {selectedIndices.size === parsedMeds.length
                        ? "Bỏ chọn tất cả"
                        : "Chọn tất cả"}
                    </button>
                  </div>

                  <div className="flex flex-col gap-2">
                    {parsedMeds.map((med, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                          selectedIndices.has(i)
                            ? "border-primary/50 bg-primary/5"
                            : "border-border bg-muted/40"
                        }`}
                      >
                        <Checkbox
                          checked={selectedIndices.has(i)}
                          onCheckedChange={() => toggleSelected(i)}
                          className="mt-2.5"
                        />
                        <div className="flex flex-1 flex-col gap-1 text-sm">
                          <Input
                            value={med.drugName}
                            onChange={(e) =>
                              setParsedMeds((prev) =>
                                prev.map((m, j) =>
                                  j === i ? { ...m, drugName: e.target.value } : m,
                                ),
                              )
                            }
                            className="h-8 border-0 bg-transparent px-0 font-medium shadow-none focus-visible:ring-0"
                          />
                          <p className="text-xs text-muted-foreground">
                            {med.quantity > 0 ? `${med.quantity} viên` : ""}
                            {med.dosage ? ` · ${med.dosage}` : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="mt-1.5 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setParsedMeds((prev) => prev.filter((_, j) => j !== i))
                            setSelectedIndices((prev) => {
                              const next = new Set<number>()
                              for (const idx of prev) {
                                if (idx < i) next.add(idx)
                                else if (idx > i) next.add(idx - 1)
                              }
                              return next
                            })
                          }}
                        >
                          <RiCloseLine className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>

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
                      disabled={selectedIndices.size === 0}
                      onClick={handleSaveSelected}
                    >
                      <RiCheckLine />
                      Xác nhận {selectedIndices.size > 1 ? `${selectedIndices.size} thuốc` : "thuốc"}
                    </Button>
                  </div>
                </>
              )}

              {!ocrLoading && parsedMeds.length === 0 && rawText && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground">
                    Không nhận diện được thuốc, hãy nhập thủ công.
                  </p>
                  <Button variant="outline" onClick={() => setStep("form")}>
                    Nhập thủ công
                  </Button>
                </div>
              )}
            </div>
          )}

          {step === "form" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">
                  Tên thuốc <span className="text-destructive">*</span>
                </label>
                <Input
                  placeholder="VD: Paracetamol 500mg"
                  value={medName}
                  onChange={(e) => setMedName(e.target.value)}
                  autoFocus
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

              <MealTimingPicker value={mealTiming} onChange={setMealTiming} />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">
                  Lưu ý{" "}
                  <span className="font-normal text-muted-foreground">
                    (tùy chọn)
                  </span>
                </label>
                <Input
                  placeholder="VD: Uống sau ăn..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

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

      <Dialog
        open={!!editMed}
        onOpenChange={(o) => {
          if (!o) {
            setEditMed(null)
            setEditDraft(null)
          }
        }}
      >
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa thuốc</DialogTitle>
          </DialogHeader>
          {editDraft && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Tên thuốc</label>
                <Input
                  value={editDraft.name}
                  onChange={(e) =>
                    setEditDraft((d) => d && { ...d, name: e.target.value })
                  }
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Buổi uống</label>
                {SESSIONS.map(({ key, label, icon }) => {
                  const s = editDraft.schedules[key]
                  return (
                    <SessionRow
                      key={key}
                      label={label}
                      icon={icon}
                      enabled={s.enabled}
                      pillCount={s.pillCount}
                      onToggle={() =>
                        setEditDraft(
                          (d) =>
                            d && {
                              ...d,
                              schedules: {
                                ...d.schedules,
                                [key]: {
                                  ...d.schedules[key],
                                  enabled: !d.schedules[key].enabled,
                                },
                              },
                            },
                        )
                      }
                      onDecrease={() =>
                        setEditDraft(
                          (d) =>
                            d && {
                              ...d,
                              schedules: {
                                ...d.schedules,
                                [key]: {
                                  ...d.schedules[key],
                                  pillCount: Math.max(
                                    1,
                                    d.schedules[key].pillCount - 1,
                                  ),
                                },
                              },
                            },
                        )
                      }
                      onIncrease={() =>
                        setEditDraft(
                          (d) =>
                            d && {
                              ...d,
                              schedules: {
                                ...d.schedules,
                                [key]: {
                                  ...d.schedules[key],
                                  pillCount: d.schedules[key].pillCount + 1,
                                },
                              },
                            },
                        )
                      }
                    />
                  )
                })}
              </div>

              <MealTimingPicker
                value={editDraft.mealTiming}
                onChange={(v) =>
                  setEditDraft((d) => d && { ...d, mealTiming: v })
                }
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">
                  Lưu ý{" "}
                  <span className="font-normal text-muted-foreground">
                    (tùy chọn)
                  </span>
                </label>
                <Input
                  placeholder="VD: Uống sau ăn..."
                  value={editDraft.notes}
                  onChange={(e) =>
                    setEditDraft(
                      (d) => d && { ...d, notes: e.target.value },
                    )
                  }
                />
              </div>

              <div className="flex gap-2 pb-1">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setEditMed(null)
                    setEditDraft(null)
                  }}
                >
                  Hủy
                </Button>
                <Button
                  className="flex-1"
                  disabled={!editDraft.name.trim()}
                  onClick={handleSaveEdit}
                >
                  <RiCheckLine />
                  Lưu thay đổi
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MealTimingPicker({
  value,
  onChange,
}: {
  value: MealTiming
  onChange: (v: MealTiming) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">
        Thời điểm uống{" "}
        <span className="font-normal text-muted-foreground">(tùy chọn)</span>
      </label>
      <div className="flex gap-2">
        {(["before", "after"] as const).map((val) => (
          <button
            key={val}
            type="button"
            onClick={() => onChange(value === val ? null : val)}
            className={`flex-1 rounded-lg border py-2 text-sm transition-colors ${
              value === val
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-border bg-background text-muted-foreground hover:bg-muted/40"
            }`}
          >
            {val === "before" ? "Trước ăn" : "Sau ăn"}
          </button>
        ))}
      </div>
    </div>
  )
}
