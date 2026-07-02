"use client"

import Link from "next/link"
import { RiCapsuleLine, RiArrowRightLine } from "@remixicon/react"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Plan } from "@/lib/types"

export function PlanCard({
  plan,
  index,
}: {
  plan: Plan
  index: number
}) {
  const medCount = plan.medications.length

  return (
    <Link href={`/plan/${plan.id}`} className="block">
      <Card className="transition-colors hover:bg-muted/40">
        <CardContent className="flex items-center gap-4 py-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <span className="font-heading text-sm font-bold text-primary">
              {index}
            </span>
          </div>

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

          <RiArrowRightLine className="size-4 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  )
}
