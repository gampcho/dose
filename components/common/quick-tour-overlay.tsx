"use client"

import * as React from "react"
import {
  RiArrowLeftLine,
  RiArrowRightLine,
  RiCloseLine,
  RiStopCircleLine,
  RiVolumeUpLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { speakVietnamese, stopSpeech } from "@/lib/speech"
import { cn } from "@/lib/utils"

export interface QuickTourStep {
  title: string
  description: string
  targetRef: React.RefObject<HTMLElement | null>
}

export function QuickTourOverlay({
  rect,
  step,
  index,
  count,
  onClose,
  onBack,
  onNext,
  nextLabel,
  label = "Hướng dẫn nhanh",
}: {
  rect: DOMRect | null
  step: QuickTourStep
  index: number
  count: number
  onClose: () => void
  onBack?: () => void
  onNext: () => void
  nextLabel?: string
  label?: string
}) {
  const inset = 10
  const viewportWidth = typeof window === "undefined" ? 0 : window.innerWidth
  const viewportHeight = typeof window === "undefined" ? 0 : window.innerHeight
  const top = rect ? Math.max(rect.top - inset, 0) : 0
  const left = rect ? Math.max(rect.left - inset, 0) : 0
  const right = rect ? Math.min(rect.right + inset, viewportWidth) : 0
  const bottom = rect ? Math.min(rect.bottom + inset, viewportHeight) : 0

  function handleSpeak() {
    speakVietnamese(`${label} ${index + 1} trên ${count}. ${step.title}. ${step.description}`)
  }

  function handleClose() {
    stopSpeech()
    onClose()
  }

  function handleBack() {
    stopSpeech()
    onBack?.()
  }

  function handleNext() {
    stopSpeech()
    onNext()
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[70]">
      <div
        className="pointer-events-auto absolute inset-x-0 top-0 bg-black/55"
        style={{ height: top }}
      />
      <div
        className="pointer-events-auto absolute left-0 bg-black/55"
        style={{ top, width: left, height: Math.max(bottom - top, 0) }}
      />
      <div
        className="pointer-events-auto absolute bg-black/55"
        style={{
          top,
          left: right,
          width: Math.max(viewportWidth - right, 0),
          height: Math.max(bottom - top, 0),
        }}
      />
      <div
        className="pointer-events-auto absolute inset-x-0 bottom-0 bg-black/55"
        style={{ top: bottom }}
      />

      {rect && (
        <div
          className="absolute rounded-2xl ring-2 ring-primary ring-offset-2 ring-offset-background/0"
          style={{
            top,
            left,
            width: Math.max(right - left, 0),
            height: Math.max(bottom - top, 0),
            boxShadow: "0 0 0 9999px rgba(0,0,0,0)",
          }}
        />
      )}

      <div className="pointer-events-auto absolute inset-x-4 bottom-4 mx-auto max-w-sm rounded-3xl bg-background p-4 shadow-2xl ring-1 ring-foreground/10">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {label} {index + 1}/{count}
            </p>
            <h2 className="mt-1 font-heading text-lg font-semibold">{step.title}</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <RiCloseLine className="size-4" />
          </button>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">
          {step.description}
        </p>

        <div className="mt-4 flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSpeak}>
            <RiVolumeUpLine />
            Nghe
          </Button>
          <Button variant="ghost" size="sm" onClick={stopSpeech}>
            <RiStopCircleLine />
            Dừng
          </Button>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Bỏ qua
          </button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={!onBack}
              className={cn(!onBack && "invisible")}
            >
              <RiArrowLeftLine />
              Quay lại
            </Button>
            <Button onClick={handleNext}>
              {nextLabel ?? (index === count - 1 ? "Bắt đầu" : "Tiếp theo")}
              <RiArrowRightLine />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
