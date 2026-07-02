"use client"

import * as React from "react"
import { getClassName } from "@/lib/catalog"
import type { Detection } from "@/lib/yolo"
import type { Result } from "@/lib/types"

const STATUS_COLORS: Record<Result["status"], string> = {
  correct: "#22c55e",
  missing: "#ef4444",
  extra: "#f59e0b",
  unclear: "#f59e0b",
}

export function BBoxOverlay({
  src,
  detections,
  results,
  className,
}: {
  src: string
  detections: Detection[]
  results: Result[]
  className?: string
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const imgRef = React.useRef<HTMLImageElement | null>(null)
  const wrapperRef = React.useRef<HTMLDivElement>(null)

  const resultByClass = React.useMemo(() => {
    const map = new Map<number, Result>()
    for (const r of results) map.set(r.classId, r)
    return map
  }, [results])

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img || !img.complete || !img.naturalWidth) return

    const rect = img.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(rect.height * dpr)
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, rect.width, rect.height)

    const imgAspect = img.naturalWidth / img.naturalHeight
    const containerAspect = rect.width / rect.height
    let renderW: number
    let renderH: number
    let offsetX: number
    let offsetY: number
    if (imgAspect > containerAspect) {
      renderW = rect.width
      renderH = rect.width / imgAspect
      offsetX = 0
      offsetY = (rect.height - renderH) / 2
    } else {
      renderH = rect.height
      renderW = rect.height * imgAspect
      offsetX = (rect.width - renderW) / 2
      offsetY = 0
    }
    const scaleX = renderW / img.naturalWidth
    const scaleY = renderH / img.naturalHeight

    for (const det of detections) {
      const { x, y, w, h } = det.bbox
      const result = resultByClass.get(det.classId)
      const status = result?.status ?? "extra"
      const color = STATUS_COLORS[status]
      const labelName =
        status === "extra"
          ? "ngoài đơn"
          : status === "unclear"
            ? "cần kiểm tra"
            : getClassName(det.classId).split(" ")[0]
      const label = labelName

      const bx = offsetX + x * scaleX
      const by = offsetY + y * scaleY
      const bw = w * scaleX
      const bh = h * scaleY

      ctx.fillStyle = `${color}20`
      ctx.fillRect(bx, by, bw, bh)
      ctx.strokeStyle = color
      ctx.lineWidth = 3
      ctx.strokeRect(bx, by, bw, bh)

      ctx.font = "bold 12px sans-serif"
      const textW = ctx.measureText(label).width
      const labelH = 18
      const labelY = by - labelH > 0 ? by - labelH : by

      ctx.fillStyle = color
      ctx.fillRect(bx, labelY, textW + 8, labelH)
      ctx.fillStyle = "#fff"
      ctx.fillText(label, bx + 4, labelY + 13)
    }
  }, [detections, resultByClass])

  React.useEffect(() => {
    const img = imgRef.current
    const wrapper = wrapperRef.current
    if (!img || !wrapper) return

    const observer = new ResizeObserver(() => {
      if (img.complete && img.naturalWidth) draw()
    })
    observer.observe(wrapper)

    if (img.complete && img.naturalWidth) {
      draw()
    }

    return () => observer.disconnect()
  }, [src, draw])

  return (
    <div ref={wrapperRef} className={className ? `relative ${className}` : "relative"}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Khay thuốc"
        ref={imgRef}
        onLoad={() => {
          draw()
        }}
        className="block w-full bg-muted/30 object-contain"
        style={{ maxHeight: 380 }}
      />
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
    </div>
  )
}
