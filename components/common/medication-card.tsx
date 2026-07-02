"use client"

import {
  RiCapsuleLine,
  RiDeleteBinLine,
  RiPencilLine,
  RiAlertLine,
  RiTimeLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Medication } from "@/lib/types"
import { SESSION_LABELS } from "@/lib/types"

export function MedicationCard({
  med,
  onDelete,
  onEdit,
}: {
  med: Medication
  onDelete: () => void
  onEdit?: () => void
}) {
  const isUnknown = med.classId === null

  return (
    <Card
      className={
        isUnknown
          ? "border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20"
          : ""
      }
    >
      <CardContent className="flex items-start gap-3 py-4">
        <div
          className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${isUnknown ? "bg-amber-100 dark:bg-amber-900/40" : "bg-primary/10"}`}
        >
          {isUnknown ? (
            <RiAlertLine className="size-4 text-amber-600 dark:text-amber-400" />
          ) : (
            <RiCapsuleLine className="size-4 text-primary" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="leading-snug font-medium">{med.name}</p>
          {isUnknown && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Chưa có trong model, chỉ kiểm tra số lượng
            </p>
          )}
          <div className="flex flex-wrap gap-1">
            {med.doses.length > 0 ? (
              med.doses.map((s) => (
                <Badge key={s.session} variant="secondary">
                  {SESSION_LABELS[s.session]} · {s.pillCount} {med.unit}
                </Badge>
              ))
            ) : (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <RiTimeLine className="size-3" />
                Chưa đặt lịch uống
              </Badge>
            )}
            {med.mealTiming === "before" && (
              <Badge variant="outline">Trước ăn</Badge>
            )}
            {med.mealTiming === "after" && (
              <Badge variant="outline">Sau ăn</Badge>
            )}
          </div>
          {med.notes && (
            <p className="text-xs text-muted-foreground">{med.notes}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onEdit && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={onEdit}
            >
              <RiPencilLine />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <RiDeleteBinLine />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
