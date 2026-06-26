"use client"

import * as React from "react"
import { RiCheckLine, RiSubtractLine, RiAddLine } from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function SessionRow({
  label,
  icon,
  enabled,
  pillCount,
  onToggle,
  onDecrease,
  onIncrease,
}: {
  label: string
  icon: React.ReactNode
  enabled: boolean
  pillCount: number
  onToggle: () => void
  onDecrease: () => void
  onIncrease: () => void
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
        enabled ? "border-primary/30 bg-primary/5" : "border-border",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded border transition-colors",
          enabled
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background",
        )}
      >
        {enabled && <RiCheckLine className="size-3" />}
      </button>
      <div className="flex items-center gap-1.5 text-sm">
        {icon}
        <span
          className={cn("font-medium", !enabled && "text-muted-foreground")}
        >
          {label}
        </span>
      </div>
      {enabled && (
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-xs"
            onClick={onDecrease}
            disabled={pillCount <= 1}
          >
            <RiSubtractLine />
          </Button>
          <span className="w-5 text-center text-sm font-medium tabular-nums">
            {pillCount}
          </span>
          <Button variant="outline" size="icon-xs" onClick={onIncrease}>
            <RiAddLine />
          </Button>
          <span className="text-sm text-muted-foreground">viên</span>
        </div>
      )}
    </div>
  )
}
