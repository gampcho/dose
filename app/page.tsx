"use client"

import * as React from "react"
import Link from "next/link"
import {
  RiAddLine,
  RiMedicineBottleLine,
  RiArrowRightLine,
  RiDeleteBinLine,
  RiCapsuleLine,
  RiFileListLine,
  RiSettings3Line,
  RiScanLine,
  RiSunLine,
  RiSunFoggyLine,
  RiMoonLine,
  RiMoonFoggyLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { listPlans, upsertPlan, deletePlan, generateId } from "@/lib/storage"
import type { Plan } from "@/lib/types"

export default function HomePage() {
  const [plans, setPlans] = React.useState<Plan[]>([])
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage on mount
    setPlans(listPlans())
    setMounted(true)
  }, [])

  function handleCreate() {
    const all = listPlans()
    const plan: Plan = {
      id: generateId(),
      name: `Đơn thuốc ${all.length + 1}`,
      medications: [],
      createdAt: new Date().toISOString(),
    }
    upsertPlan(plan)
    setPlans(listPlans())
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault()
    deletePlan(id)
    setPlans(listPlans())
  }

  const [now, setNow] = React.useState<Date | null>(null)
  React.useEffect(() => {
    const tick = () => setNow(new Date())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const hour = now?.getHours() ?? 12

  const TimeIcon = (() => {
    if (hour >= 5 && hour < 10) return RiSunFoggyLine
    if (hour >= 10 && hour < 14) return RiSunLine
    if (hour >= 14 && hour < 18) return RiSunFoggyLine
    if (hour >= 18 && hour < 21) return RiMoonFoggyLine
    return RiMoonLine
  })()

  const today = now?.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }) ?? ""
  const time = now?.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }) ?? ""

  if (!mounted) {
    return (
      <div className="min-h-svh bg-background">
        <header className="border-b bg-background">
          <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-xl bg-primary">
                <RiMedicineBottleLine className="size-4 text-primary-foreground" />
              </div>
              <span className="font-heading text-lg font-semibold tracking-tight">DOSE</span>
            </div>
          </div>
        </header>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary">
              <RiMedicineBottleLine className="size-4 text-primary-foreground" />
            </div>
            <span className="font-heading text-lg font-semibold tracking-tight">DOSE</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        <div className="mb-6">
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground capitalize">
            <TimeIcon className="size-4 shrink-0" />
            {today} · {time}
          </p>
          <h1 className="mt-0.5 font-heading text-2xl font-bold tracking-tight">
            Đơn thuốc
          </h1>
        </div>

        {plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-dashed py-16 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
              <RiFileListLine className="size-7 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="font-medium">Chưa có đơn thuốc nào</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Thêm đơn thuốc để bắt đầu theo dõi và kiểm tra thuốc mỗi ngày.
              </p>
            </div>
            <Button onClick={handleCreate}>
              <RiAddLine />
              Thêm đơn thuốc
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {plans.map((plan, idx) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                index={idx + 1}
                onDelete={(e) => handleDelete(plan.id, e)}
              />
            ))}

            <button
              onClick={handleCreate}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/40 hover:text-foreground"
            >
              <RiAddLine className="size-4" />
              Thêm đơn thuốc
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

function PlanCard({
  plan,
  index,
  onDelete,
}: {
  plan: Plan
  index: number
  onDelete: (e: React.MouseEvent) => void
}) {
  const medCount = plan.medications.length

  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <span className="font-heading text-sm font-bold text-primary">{index}</span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="font-medium leading-snug">{plan.name}</p>
          <div className="flex items-center gap-2">
            {medCount === 0 ? (
              <span className="text-xs text-muted-foreground">Chưa có thuốc</span>
            ) : (
              <>
                <RiCapsuleLine className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{medCount} loại thuốc</span>
                <div className="flex flex-wrap gap-1">
                  {plan.medications.map((med) => (
                    <Badge key={med.id} variant="secondary" className="text-xs">
                      {med.name}
                    </Badge>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <RiDeleteBinLine />
        </Button>
      </CardContent>

      <CardFooter className="gap-2">
        <Link href={`/treatment/${plan.id}`} className="flex-1">
          <Button variant="outline" size="sm" className="w-full">
            <RiSettings3Line />
            Quản lý thuốc
          </Button>
        </Link>
        <Link href={`/verification/${plan.id}`} className="flex-1">
          <Button size="sm" className="w-full">
            <RiScanLine />
            Kiểm tra ngay
            <RiArrowRightLine />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  )
}
