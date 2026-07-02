"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  RiAlertLine,
  RiArrowLeftLine,
  RiBowlLine,
  RiCapsuleLine,
  RiMoonLine,
  RiSunLine,
  RiVolumeUpLine,
} from "@remixicon/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { buildIntakeSpeech, getDueMedications, type DueMedication } from "@/lib/intake"
import { listPlans } from "@/lib/storage"
import { getCurrentSession, SESSION_LABELS } from "@/lib/types"
import type { MealTiming, Plan, Session } from "@/lib/types"
import { speakVietnamese } from "@/lib/speech"

const MEAL_OPTIONS: { value: MealTiming; label: string }[] = [
  { value: null, label: "Theo tất cả" },
  { value: "before", label: "Trước ăn" },
  { value: "after", label: "Sau ăn" },
]

export default function NowPage() {
  const router = useRouter()
  const [plans, setPlans] = React.useState<Plan[]>([])
  const [session, setSession] = React.useState<Session | null>(null)
  const [mealTiming, setMealTiming] = React.useState<MealTiming>(null)
  const [loaded, setLoaded] = React.useState(false)

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- current session must come from the client timezone
    setSession(getCurrentSession())
    setPlans(listPlans())
    setLoaded(true)
  }, [])

  const dueMeds = React.useMemo(() => {
    if (!session) return []
    return getDueMedications(plans, session, mealTiming)
  }, [mealTiming, plans, session])

  function speakNow() {
    if (!session) return
    speakVietnamese(buildIntakeSpeech(dueMeds, session, mealTiming))
  }

  if (!loaded) return null

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="icon-sm" onClick={() => router.push("/")}>
              <RiArrowLeftLine />
            </Button>
            <div className="min-w-0">
              <p className="font-heading text-base leading-tight font-semibold">Lịch uống theo buổi</p>
              <p className="text-xs text-muted-foreground">
                {session ? `Buổi ${SESSION_LABELS[session]}` : "Đang xác định buổi uống"}
              </p>
            </div>
          </div>
          <Button variant="outline" size="icon-sm" onClick={speakNow} disabled={!session}>
            <RiVolumeUpLine />
          </Button>
        </div>
      </header>

      <main className="mx-auto flex max-w-lg flex-col gap-5 px-4 py-6">
        <div className="grid grid-cols-3 gap-2">
          {MEAL_OPTIONS.map((option) => (
            <button
              key={option.value ?? "all"}
              type="button"
              onClick={() => setMealTiming(option.value)}
              className={`rounded-lg border py-2 text-sm transition-colors ${
                mealTiming === option.value
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-muted/40"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {plans.length === 0 ? (
          <EmptyState
            title="Chưa có đơn thuốc"
            detail="Thêm đơn thuốc để xem thuốc cần uống theo từng buổi."
            action="Về trang chủ"
            onAction={() => router.push("/")}
          />
        ) : dueMeds.length === 0 ? (
          <EmptyState
            title="Không có thuốc cần uống"
            detail={session ? `Buổi ${SESSION_LABELS[session]} hiện không có thuốc theo lịch.` : ""}
            action="Về trang chủ"
            onAction={() => router.push("/")}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {dueMeds.length} loại thuốc
              </p>
              <Badge variant="secondary">{mealLabel(mealTiming)}</Badge>
            </div>

            {dueMeds.map((item) => (
              <DueMedicationCard key={`${item.planId}-${item.med.id}`} item={item} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function DueMedicationCard({ item }: { item: DueMedication }) {
  const isUnknown = item.med.classId === null

  return (
    <Card className={isUnknown ? "border-amber-300 bg-amber-50/50" : ""}>
      <CardContent className="flex items-start gap-3 py-4">
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${isUnknown ? "bg-amber-100" : "bg-primary/10"}`}>
          {isUnknown ? (
            <RiAlertLine className="size-5 text-amber-600" />
          ) : (
            <RiCapsuleLine className="size-5 text-primary" />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="leading-snug font-medium">{item.med.name}</p>
              <p className="text-xs text-muted-foreground">{item.planName}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-heading text-2xl leading-none font-bold text-primary">{item.pillCount}</p>
              <p className="text-xs text-muted-foreground">{item.med.unit}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            {item.med.mealTiming && (
              <Badge variant="outline">{mealLabel(item.med.mealTiming)}</Badge>
            )}
            {isUnknown && (
              <Badge variant="outline" className="border-amber-300 text-amber-700">
                Cần kiểm tra thủ công
              </Badge>
            )}
            {item.med.notes && (
              <Badge variant="secondary">{item.med.notes}</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyState({
  title,
  detail,
  action,
  onAction,
}: {
  title: string
  detail: string
  action: string
  onAction: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed py-14 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
        <SessionIcon className="size-7 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="font-medium">{title}</p>
        {detail && <p className="max-w-xs text-sm text-muted-foreground">{detail}</p>}
      </div>
      <Button variant="outline" onClick={onAction}>{action}</Button>
    </div>
  )
}

function SessionIcon({ className }: { className?: string }) {
  const session = getCurrentSession()
  if (session === "morning" || session === "afternoon") return <RiSunLine className={className} />
  if (session === "noon") return <RiBowlLine className={className} />
  return <RiMoonLine className={className} />
}

function mealLabel(mealTiming: MealTiming): string {
  if (mealTiming === "before") return "Trước ăn"
  if (mealTiming === "after") return "Sau ăn"
  return "Theo tất cả"
}
