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
  const [ready, setReady] = React.useState(false)

  const statusByClass = React.useMemo(() => {
    const map = new Map<number, Result["status"]>()
    for (const r of results) map.set(r.classId, r.status)
    return map
  }, [results])

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img || !img.complete || !img.naturalWidth) return

    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    for (const det of detections) {
      const { x, y, w, h } = det.bbox
      const color = STATUS_COLORS[statusByClass.get(det.classId) ?? "extra"]
      const label = `${getClassName(det.classId).split(" ")[0]} ${(det.confidence * 100).toFixed(0)}%`

      ctx.strokeStyle = color
      ctx.lineWidth = 3
      ctx.strokeRect(x, y, w, h)

      ctx.font = "bold 18px sans-serif"
      const textW = ctx.measureText(label).width
      const labelH = 24
      const labelY = y - labelH > 0 ? y - labelH : y

      ctx.fillStyle = color
      ctx.fillRect(x, labelY, textW + 8, labelH)
      ctx.fillStyle = "#fff"
      ctx.fillText(label, x + 4, labelY + 18)
    }
  }, [detections, statusByClass])

  React.useEffect(() => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.src = src
    imgRef.current = img
    img.onload = () => {
      setReady(true)
      draw()
    }
  }, [src, draw])

  React.useEffect(() => {
    if (ready) draw()
  }, [ready, draw])

  return (
    <div className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Khay thuốc"
        className="w-full bg-muted/30 object-contain"
        style={{ maxHeight: 380 }}
      />
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
      />
    </div>
  )
}
