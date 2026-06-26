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
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
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
                onDelete={(e) => handleDelete(plan.id, e)}
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

function PlanCard({
  plan,
  index,
  onDelete,
}: {
  plan: TreatmentPlan
  index: number
  onDelete: (e: React.MouseEvent) => void
}) {
  const medCount = plan.medications.length

  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        {/* Index badge */}
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <span className="font-heading text-sm font-bold text-primary">
            {index}
          </span>
        </div>

        {/* Info */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="leading-snug font-medium">{plan.name}</p>
          <div className="flex items-center gap-2">
            {medCount === 0 ? (
              <span className="text-xs text-muted-foreground">
                Chưa có thuốc
              </span>
            ) : (
              <>
                <RiCapsuleLine className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {medCount} loại thuốc
                </span>
                <div className="flex gap-1 overflow-hidden">
                  {plan.medications.slice(0, 2).map((med) => (
                    <Badge key={med.id} variant="secondary" className="text-xs">
                      {med.name}
                    </Badge>
                  ))}
                  {medCount > 2 && (
                    <Badge variant="outline" className="text-xs">
                      +{medCount - 2}
                    </Badge>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Delete */}
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
