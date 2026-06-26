"use client"

import * as React from "react"
import {
  RiAddLine,
  RiMedicineBottleLine,
  RiFileListLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { PlanCard } from "@/components/common/plan-card"
import { getPlans, upsertPlan, deletePlan, generateId } from "@/lib/storage"
import type { TreatmentPlan } from "@/lib/types"

export default function HomePage() {
  const [plans, setPlans] = React.useState<TreatmentPlan[]>(() => getPlans())
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")

  function handleCreate() {
    if (!name.trim()) return
    const plan: TreatmentPlan = {
      id: generateId(),
      name: name.trim(),
      medications: [],
      createdAt: new Date().toISOString(),
    }
    upsertPlan(plan)
    setPlans(getPlans())
    setName("")
    setOpen(false)
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault()
    deletePlan(id)
    setPlans(getPlans())
  }

  const today = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })

  return (
    <div className="min-h-svh bg-background">
      {/* Header */}
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

      <main className="mx-auto max-w-lg px-4 py-6">
        {/* Greeting */}
        <div className="mb-6">
          <p className="text-sm text-muted-foreground capitalize">{today}</p>
          <h1 className="mt-0.5 font-heading text-2xl font-bold tracking-tight">
            Liệu trình
          </h1>
        </div>

        {plans.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-dashed py-16 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
              <RiFileListLine className="size-7 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="font-medium">Chưa có liệu trình nào</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Thêm liệu trình để bắt đầu theo dõi và kiểm tra thuốc mỗi ngày.
              </p>
            </div>
            <Button onClick={() => setOpen(true)}>
              <RiAddLine />
              Thêm liệu trình
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {plans.map((plan, idx) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                index={idx + 1}
                onDeleteAction={(e) => handleDelete(plan.id, e)}
              />
            ))}

            {/* Add button */}
            <button
              onClick={() => setOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/40 hover:text-foreground"
            >
              <RiAddLine className="size-4" />
              Thêm liệu trình
            </button>
          </div>
        )}
      </main>

      {/* Dialog tạo liệu trình */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm liệu trình mới</DialogTitle>
          </DialogHeader>
          <div className="py-1">
            <Input
              placeholder={`VD: Liệu trình ${plans.length + 1}, Đợt điều trị tháng 6...`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={!name.trim()}>
              Tạo liệu trình
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
