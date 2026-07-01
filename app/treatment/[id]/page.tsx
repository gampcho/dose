"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import {
  RiArrowLeftLine,
  RiArrowRightLine,
  RiAddLine,
  RiCameraLine,
  RiImageAddLine,
  RiSunLine,
  RiBowlLine,
  RiMoonLine,
  RiCheckLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { ocr } from "@/lib/ocr"
import { parseWithLLM } from "@/lib/parser"
import { loadCatalog, searchDrugs } from "@/lib/catalog"
import { SESSION_LABELS } from "@/lib/types"
import type {
  Plan,
  Medication,
  ParsedMed,
  Session,
  MealTiming,
} from "@/lib/types"
import type { TextBox } from "@/lib/ocr"

const SESSIONS: { key: Session; label: string; icon: React.ReactNode }[] = [
  { key: "morning", label: SESSION_LABELS.morning, icon: <RiSunLine className="size-4" /> },
  { key: "noon", label: SESSION_LABELS.noon, icon: <RiBowlLine className="size-4" /> },
  { key: "afternoon", label: SESSION_LABELS.afternoon, icon: <RiSunLine className="size-4 opacity-60" /> },
  { key: "evening", label: SESSION_LABELS.evening, icon: <RiMoonLine className="size-4" /> },
]

type DoseState = Record<Session, { enabled: boolean; pillCount: number }>

function emptyDoses(): DoseState {
  return {
    morning: { enabled: false, pillCount: 1 },
    noon: { enabled: false, pillCount: 1 },
    afternoon: { enabled: false, pillCount: 1 },
    evening: { enabled: false, pillCount: 1 },
  }
}

function dosesFromMed(med: Medication): DoseState {
  const s = emptyDoses()
  for (const d of med.doses) s[d.session as Session] = { enabled: true, pillCount: d.pillCount }
  return s
}

export default function TreatmentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const planId = params.id as string

  const [plan, setPlan] = React.useState<Plan | null>(null)
  const [loaded, setLoaded] = React.useState(false)

  React.useEffect(() => {
    const p = getPlan(planId)
    if (!p) { router.push("/"); return }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage on mount
    setPlan(p)
    setLoaded(true)
  }, [planId, router])

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [imagePreview, setImagePreview] = React.useState<string | null>(null)
  const [ocrLoading, setOcrLoading] = React.useState(false)
  const [ocrError, setOcrError] = React.useState<string | null>(null)

  const [medName, setMedName] = React.useState("")
  const [classId, setClassId] = React.useState<number | null>(null)
  const [doses, setDoses] = React.useState<DoseState>(emptyDoses())
  const [mealTiming, setMealTiming] = React.useState<MealTiming>(null)
  const [notes, setNotes] = React.useState("")
  const [suggestions, setSuggestions] = React.useState<{ name: string; classIds: number[] }[]>([])
  const [parsedMeds, setParsedMeds] = React.useState<ParsedMed[]>([])

  const [editMed, setEditMed] = React.useState<Medication | null>(null)
  const [editName, setEditName] = React.useState("")
  const [editDoses, setEditDoses] = React.useState<DoseState>(emptyDoses())
  const [editMealTiming, setEditMealTiming] = React.useState<MealTiming>(null)
  const [editNotes, setEditNotes] = React.useState("")

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const cameraInputRef = React.useRef<HTMLInputElement>(null)

  async function handleOcr(file: File) {
    const url = URL.createObjectURL(file)
    setImagePreview(url)
    setOcrLoading(true)
    setOcrError(null)

    try {
      const img = new Image()
      img.src = url
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error("Không thể tải ảnh"))
      })

      const results: TextBox[] = await ocr(img)

      await loadCatalog()
      const text = results.map((r) => r.text).join("\n")

      if (text.length < 10) {
        setOcrError("Không đọc được đơn thuốc, vui lòng nhập tay")
        return
      }

      const parsed = await parseWithLLM(text)

      if (parsed.length === 0) {
        setOcrError("Không nhận diện được thuốc, vui lòng nhập tay")
        return
      }

      setParsedMeds(parsed)
      fillFormWithMed(parsed[0])
    } catch {
      setOcrError("Không đọc được đơn thuốc, vui lòng nhập tay")
    } finally {
      setOcrLoading(false)
    }
  }

  function fillFormWithMed(p: ParsedMed) {
    setMedName(p.name)
    setClassId(p.classId)
    const ds = emptyDoses()
    for (const d of p.doses) ds[d.session as Session] = { enabled: true, pillCount: d.pillCount }
    setDoses(ds)
    setMealTiming(p.mealTiming)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleOcr(file)
    e.target.value = ""
  }

  function updateSuggestions(name: string) {
    setMedName(name)
    if (name.length < 2) { setSuggestions([]); setClassId(null); return }
    setSuggestions(searchDrugs(name))
    setClassId(null)
  }

  function pickSuggestion(s: { name: string; classIds: number[] }) {
    setMedName(s.name)
    setClassId(s.classIds[0])
    setSuggestions([])
  }

  function resetForm() {
    setImagePreview(null)
    setMedName("")
    setClassId(null)
    setDoses(emptyDoses())
    setMealTiming(null)
    setNotes("")
    setSuggestions([])
    setParsedMeds([])
  }

  function saveMeds(meds: Medication[]) {
    if (!plan) return
    const updated: Plan = { ...plan, medications: [...plan.medications, ...meds] }
    upsertPlan(updated)
    setPlan(updated)
  }

  function handleSave() {
    if (!plan || !medName.trim()) return
    const enabled = Object.entries(doses).filter(([, s]) => s.enabled)
    if (enabled.length === 0) return

    const med: Medication = {
      id: generateId(),
      name: medName.trim(),
      classId,
      doses: enabled.map(([key, s]) => ({ session: key as Session, pillCount: s.pillCount })),
      mealTiming,
      unit: "viên",
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    }
    saveMeds([med])
    setDialogOpen(false)
    resetForm()
  }

  function handleSaveAll() {
    if (!plan || parsedMeds.length === 0) return
    const meds: Medication[] = parsedMeds.map((p) => {
      const activeDoses = p.doses.map((d: { session: Session; pillCount: number }) => ({ session: d.session, pillCount: d.pillCount }))
      return {
        id: generateId(),
        name: p.name,
        classId: p.classId,
        doses: activeDoses.length > 0 ? activeDoses : [{ session: "morning" as Session, pillCount: 1 }],
        mealTiming: p.mealTiming,
        unit: p.unit,
        notes: "",
        createdAt: new Date().toISOString(),
      }
    })
    saveMeds(meds)
    setDialogOpen(false)
    resetForm()
  }

  function handleDeleteMed(medId: string) {
    if (!plan) return
    const updated: Plan = { ...plan, medications: plan.medications.filter((m) => m.id !== medId) }
    upsertPlan(updated)
    setPlan(updated)
  }

  function openEdit(med: Medication) {
    setEditMed(med)
    setEditName(med.name)
    setEditDoses(dosesFromMed(med))
    setEditMealTiming(med.mealTiming)
    setEditNotes(med.notes)
  }

  function handleSaveEdit() {
    if (!plan || !editMed || !editName.trim()) return
    const enabled = Object.entries(editDoses).filter(([, s]) => s.enabled)
    const updated: Plan = {
      ...plan,
      medications: plan.medications.map((m) =>
        m.id !== editMed.id ? m : {
          ...m,
          name: editName.trim(),
          doses: enabled.map(([key, s]) => ({ session: key as Session, pillCount: s.pillCount })),
          mealTiming: editMealTiming,
          notes: editNotes.trim(),
        },
      ),
    }
    upsertPlan(updated)
    setPlan(updated)
    setEditMed(null)
  }

  function toggleDose(key: Session, state: DoseState, setState: (s: DoseState) => void) {
    setState({ ...state, [key]: { ...state[key], enabled: !state[key].enabled } })
  }

  function adjustPillCount(key: Session, delta: number, state: DoseState, setState: (s: DoseState) => void) {
    setState({ ...state, [key]: { ...state[key], pillCount: Math.max(1, state[key].pillCount + delta) } })
  }

  if (!loaded || !plan) return null

  const canSave = medName.trim().length > 0 && Object.values(doses).some((s) => s.enabled)

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" onClick={() => router.push("/")}>
              <RiArrowLeftLine />
            </Button>
            <span className="font-heading text-base font-medium">{plan.name}</span>
          </div>
          {plan.medications.length > 0 && (
            <Button size="sm" onClick={() => { resetForm(); loadCatalog(); setDialogOpen(true) }}>
              <RiAddLine /> Thêm thuốc
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
              onEdit={() => openEdit(med)}
              onDelete={() => handleDeleteMed(med.id)}
            />
          ))}
          <button
            onClick={() => { resetForm(); loadCatalog(); setDialogOpen(true) }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/40 hover:text-foreground"
          >
            <RiAddLine className="size-4" /> Thêm thuốc
          </button>
        </div>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Thêm thuốc</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => fileInputRef.current?.click()}>
                <RiImageAddLine /> Ảnh đơn thuốc
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => cameraInputRef.current?.click()}>
                <RiCameraLine /> Chụp
              </Button>
            </div>

            {imagePreview && (
              <div className="relative overflow-hidden rounded-xl border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="" className="max-h-32 w-full object-contain bg-muted/30" />
              </div>
            )}

            {ocrLoading && (
              <p className="text-center text-sm text-muted-foreground">Đang đọc đơn thuốc...</p>
            )}

            {ocrError && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                {ocrError}
              </div>
            )}

            {parsedMeds.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Thuốc tìm thấy ({parsedMeds.length})
                  </p>
                  <button
                    type="button"
                    onClick={handleSaveAll}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Lưu tất cả
                  </button>
                </div>
                <div className="flex flex-col gap-1.5">
                  {parsedMeds.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => fillFormWithMed(p)}
                      className="flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/40"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{p.name}</span>
                        {p.doses.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {p.doses.map((d: { session: Session; pillCount: number }) => `${SESSION_LABELS[d.session]} ${d.pillCount}${p.unit}`).join(", ")}
                          </span>
                        )}
                      </div>
                      <RiArrowRightLine className="size-4 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">hoặc nhập tay</span>
              <Separator className="flex-1" />
            </div>

            <div className="flex flex-col gap-1.5 relative">
              <label className="text-sm font-medium">
                Tên thuốc <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="VD: Paracetamol 500mg"
                value={medName}
                onChange={(e) => updateSuggestions(e.target.value)}
                autoFocus
              />
              {suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-lg border bg-background shadow-lg">
                  {suggestions.map((s) => (
                    <button
                      key={s.name}
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted"
                      onClick={() => pickSuggestion(s)}
                    >
                      <span>{s.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">
                Buổi uống <span className="text-destructive">*</span>
              </label>
              {SESSIONS.map(({ key, label, icon }) => {
                const s = doses[key]
                return (
                  <SessionRow
                    key={key}
                    label={label}
                    icon={icon}
                    enabled={s.enabled}
                    pillCount={s.pillCount}
                    unit="viên"
                    onToggle={() => toggleDose(key, doses, setDoses)}
                    onDecrease={() => adjustPillCount(key, -1, doses, setDoses)}
                    onIncrease={() => adjustPillCount(key, 1, doses, setDoses)}
                  />
                )
              })}
            </div>

            <MealTimingPicker value={mealTiming} onChange={setMealTiming} />

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                Lưu ý <span className="font-normal text-muted-foreground">(tùy chọn)</span>
              </label>
              <Input placeholder="VD: Uống sau ăn..." value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div className="flex gap-2 pb-1">
              <Button variant="outline" className="flex-1" onClick={() => { setDialogOpen(false); resetForm() }}>
                Hủy
              </Button>
              {parsedMeds.length > 1 ? (
                <Button className="flex-1" onClick={handleSaveAll}>
                  <RiCheckLine /> Lưu tất cả
                </Button>
              ) : (
                <Button className="flex-1" disabled={!canSave} onClick={handleSave}>
                  <RiCheckLine /> Lưu thuốc
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editMed} onOpenChange={(o) => { if (!o) setEditMed(null) }}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa thuốc</DialogTitle>
          </DialogHeader>
          {editMed && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Tên thuốc</label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Buổi uống</label>
                {SESSIONS.map(({ key, label, icon }) => {
                  const s = editDoses[key]
                  return (
                    <SessionRow
                      key={key}
                      label={label}
                      icon={icon}
                      enabled={s.enabled}
                      pillCount={s.pillCount}
                      unit={editMed?.unit ?? "viên"}
                      onToggle={() => toggleDose(key, editDoses, setEditDoses)}
                      onDecrease={() => adjustPillCount(key, -1, editDoses, setEditDoses)}
                      onIncrease={() => adjustPillCount(key, 1, editDoses, setEditDoses)}
                    />
                  )
                })}
              </div>

              <MealTimingPicker value={editMealTiming} onChange={setEditMealTiming} />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">
                  Lưu ý <span className="font-normal text-muted-foreground">(tùy chọn)</span>
                </label>
                <Input placeholder="VD: Uống sau ăn..." value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
              </div>

              <div className="flex gap-2 pb-1">
                <Button variant="outline" className="flex-1" onClick={() => setEditMed(null)}>
                  Hủy
                </Button>
                <Button className="flex-1" disabled={!editName.trim()} onClick={handleSaveEdit}>
                  <RiCheckLine /> Lưu thay đổi
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MealTimingPicker({ value, onChange }: { value: MealTiming; onChange: (v: MealTiming) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">
        Thời điểm uống <span className="font-normal text-muted-foreground">(tùy chọn)</span>
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
