"use client"

import { RiCapsuleLine, RiDeleteBinLine } from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SESSION_LABELS } from "@/lib/types"
import type { Medication } from "@/lib/types"

export function MedicationCard({
  med,
  onDeleteAction,
}: {
  med: Medication
  onDeleteAction: () => void
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 py-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <RiCapsuleLine className="size-4 text-primary" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="leading-snug font-medium">{med.name}</p>
          <div className="flex flex-wrap gap-1">
            {med.schedules.map((s) => (
              <Badge key={s.session} variant="secondary">
                {SESSION_LABELS[s.session]} · {s.pillCount} viên
              </Badge>
            ))}
          </div>
          {med.schedules[0]?.notes && (
            <p className="text-xs text-muted-foreground">
              {med.schedules[0].notes}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onDeleteAction}
        >
          <RiDeleteBinLine />
        </Button>
      </CardContent>
    </Card>
  )
}
