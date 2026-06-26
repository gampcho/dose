"use client"

import Link from "next/link"
import {
  RiArrowRightLine,
  RiDeleteBinLine,
  RiCapsuleLine,
  RiSettings3Line,
  RiScanLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { TreatmentPlan } from "@/lib/types"

export function PlanCard({
  plan,
  index,
  onDeleteAction,
}: {
  plan: TreatmentPlan
  index: number
  onDeleteAction: (e: React.MouseEvent) => void
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
          onClick={onDeleteAction}
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
