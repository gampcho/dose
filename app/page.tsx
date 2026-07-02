"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  RiAddLine,
  RiMedicineBottleLine,
  RiArrowRightLine,
  RiFileListLine,
  RiScanLine,
  RiSunLine,
  RiSunFoggyLine,
  RiMoonLine,
  RiMoonFoggyLine,
  RiTimeLine,
  RiQuestionLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { listPlans, upsertPlan, generateId } from "@/lib/storage"
import { PlanCard } from "@/components/common/plan-card"
import type { Plan } from "@/lib/types"

export default function HomePage() {
  const router = useRouter()
  const [plans, setPlans] = React.useState<Plan[]>([])
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    if (!localStorage.getItem("dose:onboarding_seen")) {
      router.push("/guideline")
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage on mount
    setPlans(listPlans())
    setMounted(true)
  }, [router])

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

  const today =
    now?.toLocaleDateString("vi-VN", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }) ?? ""
  const time =
    now?.toLocaleTimeString("vi-VN", {
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
              <span className="font-heading text-lg font-semibold tracking-tight">
                DOSE
              </span>
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
            <span className="font-heading text-lg font-semibold tracking-tight">
              DOSE
            </span>
          </div>
          <Link href="/guideline">
            <Button variant="ghost" size="icon-sm">
              <RiQuestionLine />
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        <div className="mb-4">
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground capitalize">
            <TimeIcon className="size-4 shrink-0" />
            {today} · {time}
          </p>
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
            <div className="mb-6 flex flex-col gap-2">
              <Link href="/verify" className="block">
                <Button size="lg" className="w-full text-base">
                  <RiScanLine />
                  Kiểm tra khay thuốc hôm nay
                  <RiArrowRightLine />
                </Button>
              </Link>

              <Link href="/now" className="block">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full text-base"
                >
                  <RiTimeLine />
                  Thuốc cần uống ngay
                  <RiArrowRightLine />
                </Button>
              </Link>
            </div>

            {plans.map((plan, idx) => (
              <PlanCard key={plan.id} plan={plan} index={idx + 1} />
            ))}

            <button
              onClick={handleCreate}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-dashed border-border py-3.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/40 hover:text-foreground"
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
