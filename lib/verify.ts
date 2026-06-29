import type { Detection } from "@/lib/yolo"

let classNames: Record<string, string> | null = null

export async function loadClassNames(): Promise<Record<string, string>> {
  if (!classNames) {
    const res = await fetch("/models/class_names.json")
    classNames = await res.json()
  }
  return classNames
}

export function getClassName(classId: number): string {
  if (!classNames) return `class_${classId}`
  return classNames[String(classId)] ?? `class_${classId}`
}

export interface VerificationItem {
  classId: number
  name: string
  expected: number
  detected: number
  confidence: number
  status: "pass" | "fail" | "missing" | "extra"
}

export interface VerificationResult {
  items: VerificationItem[]
  overallPass: boolean
}

export function verify(
  expected: Record<number, number>,
  detections: Detection[],
): VerificationResult {
  const detectedCounts = new Map<number, { count: number; conf: number }>()
  for (const d of detections) {
    const prev = detectedCounts.get(d.classId)
    if (prev) {
      prev.count++
      prev.conf = Math.max(prev.conf, d.confidence)
    } else {
      detectedCounts.set(d.classId, { count: 1, conf: d.confidence })
    }
  }

  const items: VerificationItem[] = []

  for (const [classId, expectedCount] of Object.entries(expected)) {
    const cid = Number(classId)
    const det = detectedCounts.get(cid)
    detectedCounts.delete(cid)

    const detectedCount = det?.count ?? 0
    const confidence = det?.conf ?? 0

    let status: VerificationItem["status"]
    if (detectedCount === 0) status = "missing"
    else if (detectedCount < expectedCount) status = "fail"
    else if (detectedCount > expectedCount) status = "extra"
    else status = "pass"

    items.push({
      classId: cid,
      name: getClassName(cid),
      expected: expectedCount,
      detected: detectedCount,
      confidence,
      status,
    })
  }

  for (const [classId, det] of detectedCounts) {
    items.push({
      classId,
      name: getClassName(classId),
      expected: 0,
      detected: det.count,
      confidence: det.conf,
      status: "extra",
    })
  }

  return {
    items,
    overallPass: items.every((i) => i.status === "pass"),
  }
}
