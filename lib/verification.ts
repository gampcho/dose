import type { Plan, Medication, Result, Session, MealTiming } from "@/lib/types"
import {
  MIN_CLEAR_CONFIDENCE,
  MIN_CLEAR_MARGIN,
  OOD_CLASS_ID,
} from "@/lib/yolo-safety"
import type { Detection } from "@/lib/yolo"
import { findDrug, getClassName } from "@/lib/catalog"

export type OverallStatus = "pass" | "fail" | "manual_check"

export interface IdentityMed {
  med: Medication
  present: boolean
  name: string
}

export interface UnknownMed extends Medication {
  expected: number
}

export interface VerificationResult {
  results: Result[]
  identityMeds: IdentityMed[]
  unknownMeds: UnknownMed[]
  status: OverallStatus
}

interface DrugMatch {
  classIds: number[]
  matchedName: string
}

interface ExpectedGroup {
  classIds: number[]
  classId: number
  expected: number
  unit: string
}

interface DetectionSummary {
  count: number
  confidence: number
  rawClassId?: number
  rawConfidence?: number
  secondClassId?: number
  secondConfidence?: number
  oodConfidence?: number
  margin?: number
  uncertain?: boolean
  safetyReason?: Result["safetyReason"]
}

const VISUAL_LOOKALIKE_CLASS_IDS = new Set([10, 82])

function mergeAllPlans(plans: Plan[]): Medication[] {
  const meds: Medication[] = []
  for (const p of plans) {
    for (const m of p.medications) {
      meds.push(m)
    }
  }
  return meds
}

export function verify(
  plans: Plan[],
  detections: Detection[],
  session: Session,
  mealTiming: MealTiming,
): VerificationResult {
  const meds = mergeAllPlans(plans)

  const expectedGroups = new Map<string, ExpectedGroup>()
  const unknown: UnknownMed[] = []
  const identity: IdentityMed[] = []
  const identityClassIds: number[] = []

  for (const med of meds) {
    if (med.doses.length === 0) {
      const match = matchMedication(med)
      const classIds = match.classIds
      const present =
        classIds.length > 0 &&
        detections.some((d) => classIds.includes(d.classId))
      identity.push({ med, present, name: match.matchedName })
      if (classIds.length > 0) identityClassIds.push(...classIds)
      continue
    }

    const expected = currentDoseCount(med, session, mealTiming)
    if (expected === 0) continue

    const match = matchMedication(med)
    if (match.classIds.length === 0) {
      unknown.push({ ...med, expected })
      continue
    }

    addExpectedGroup(expectedGroups, med, match.classIds, expected)
  }

  const remainingDetections = summarizeDetections(detections)
  const scheduledResults = Array.from(expectedGroups.values()).map((group) =>
    compareExpectedGroup(group, remainingDetections),
  )
  consumeIdentityDetections(identityClassIds, remainingDetections)
  const results = [...scheduledResults, ...extraResults(remainingDetections)]

  const status = computeStatus(results, identity, unknown)

  return {
    results,
    identityMeds: identity,
    unknownMeds: unknown,
    status,
  }
}

function matchMedication(med: Medication): DrugMatch {
  const match = findDrug(med.name)
  if (match) return match
  if (med.classId !== null) {
    return { classIds: [med.classId], matchedName: med.name }
  }
  return { classIds: [], matchedName: med.name }
}

function currentDoseCount(
  med: Medication,
  session: Session,
  mealTiming: MealTiming,
): number {
  return med.doses
    .filter((dose) =>
      matchesVerificationTime(med, dose.session, session, mealTiming),
    )
    .reduce((total, dose) => total + dose.pillCount, 0)
}

function matchesVerificationTime(
  med: Medication,
  doseSession: Session,
  session: Session,
  mealTiming: MealTiming,
): boolean {
  if (doseSession !== session) return false
  if (!mealTiming) return true
  return med.mealTiming === mealTiming
}

function addExpectedGroup(
  groups: Map<string, ExpectedGroup>,
  med: Medication,
  classIds: number[],
  expected: number,
): void {
  const key = classIds.join(",")
  const current = groups.get(key)
  if (current) {
    current.expected += expected
    return
  }

  groups.set(key, {
    classIds,
    classId: med.classId ?? classIds[0],
    expected,
    unit: med.unit,
  })
}

function summarizeDetections(
  detections: Detection[],
): Map<number, DetectionSummary> {
  const detected = new Map<number, DetectionSummary>()
  for (const detection of detections) {
    const prev = detected.get(detection.classId)
    if (prev) {
      prev.count++
      mergeDetectionSummary(prev, detection)
      continue
    }
    detected.set(detection.classId, {
      count: 1,
      confidence: detection.confidence,
      rawClassId: detection.rawClassId,
      rawConfidence: detection.rawConfidence,
      secondClassId: detection.secondClassId,
      secondConfidence: detection.secondConfidence,
      oodConfidence: detection.oodConfidence,
      margin: detection.margin,
      uncertain: isUnsafeDetection(detection),
      safetyReason: detectionSafetyReason(detection),
    })
  }
  return detected
}

function mergeDetectionSummary(
  summary: DetectionSummary,
  detection: Detection,
): void {
  if (detection.confidence <= summary.confidence) {
    summary.uncertain = summary.uncertain || isUnsafeDetection(detection)
    summary.safetyReason =
      summary.safetyReason ?? detectionSafetyReason(detection)
    return
  }

  summary.confidence = detection.confidence
  summary.rawClassId = detection.rawClassId
  summary.rawConfidence = detection.rawConfidence
  summary.secondClassId = detection.secondClassId
  summary.secondConfidence = detection.secondConfidence
  summary.oodConfidence = detection.oodConfidence
  summary.margin = detection.margin
  summary.uncertain = summary.uncertain || isUnsafeDetection(detection)
  summary.safetyReason = detectionSafetyReason(detection)
}

function isUnsafeDetection(detection: Detection): boolean {
  return Boolean(detection.uncertain) || isVisualLookalike(detection.classId)
}

function detectionSafetyReason(detection: Detection): Result["safetyReason"] {
  if (detection.safetyReason) return detection.safetyReason
  if (isVisualLookalike(detection.classId)) return "visual_lookalike"
  if (detection.confidence < MIN_CLEAR_CONFIDENCE) return "low_confidence"
  if ((detection.margin ?? Number.POSITIVE_INFINITY) < MIN_CLEAR_MARGIN) {
    return "weak_margin"
  }
  return undefined
}

function consumeIdentityDetections(
  classIds: number[],
  remainingDetections: Map<number, DetectionSummary>,
): void {
  for (const classId of classIds) {
    remainingDetections.delete(classId)
  }
}

function compareExpectedGroup(
  group: ExpectedGroup,
  remainingDetections: Map<number, DetectionSummary>,
): Result {
  const detected = group.classIds.reduce(
    (total, classId) => total + (remainingDetections.get(classId)?.count ?? 0),
    0,
  )
  const summary = bestSummary(group.classIds, remainingDetections)
  const confidence = summary?.confidence ?? 0

  for (const classId of group.classIds) {
    remainingDetections.delete(classId)
  }

  return {
    classId: group.classId,
    name: getClassName(group.classId),
    expected: group.expected,
    detected,
    confidence,
    unit: group.unit,
    status: getStatus(group.expected, detected, confidence, summary?.uncertain),
    ...resultReviewFields(summary),
  }
}

function extraResults(
  remainingDetections: Map<number, DetectionSummary>,
): Result[] {
  return Array.from(remainingDetections.entries()).map(
    ([classId, detection]) => ({
      classId,
      name: "Thuốc ngoài đơn / chưa xác định",
      modelName: modelSuggestionName(detection, classId),
      expected: 0,
      detected: detection.count,
      confidence: detection.confidence,
      unit: "viên",
      status: "extra",
      ...resultReviewFields(detection),
    }),
  )
}

function getStatus(
  expected: number,
  detected: number,
  confidence: number,
  uncertain = false,
): Result["status"] {
  if (detected > 0 && confidence < MIN_CLEAR_CONFIDENCE) return "unclear"
  if (detected > 0 && uncertain) return "unclear"
  if (detected < expected) return "missing"
  if (detected > expected) return "extra"
  return "correct"
}

function bestSummary(
  classIds: number[],
  remainingDetections: Map<number, DetectionSummary>,
): DetectionSummary | undefined {
  return classIds
    .map((classId) => remainingDetections.get(classId))
    .filter((item): item is DetectionSummary => Boolean(item))
    .sort((a, b) => b.confidence - a.confidence)[0]
}

function resultReviewFields(
  summary: DetectionSummary | undefined,
): Partial<Result> {
  if (!summary) return {}

  return {
    rawClassId: summary.rawClassId,
    rawModelName:
      summary.rawClassId !== undefined ? getClassName(summary.rawClassId) : undefined,
    secondClassId: summary.secondClassId,
    secondModelName:
      summary.secondClassId !== undefined
        ? getClassName(summary.secondClassId)
        : undefined,
    oodConfidence: summary.oodConfidence,
    margin: summary.margin,
    safetyReason: summary.safetyReason,
  }
}

function modelSuggestionName(
  summary: DetectionSummary,
  classId: number,
): string | undefined {
  const rawClassId = summary.rawClassId ?? classId
  if (rawClassId === OOD_CLASS_ID) return undefined
  return getClassName(rawClassId)
}

function isVisualLookalike(classId: number): boolean {
  return VISUAL_LOOKALIKE_CLASS_IDS.has(classId)
}

function computeStatus(
  results: Result[],
  identityMeds: IdentityMed[],
  unknownMeds: Medication[],
): OverallStatus {
  const hasScheduledFail = results.some(
    (result) =>
      result.status === "missing" ||
      result.status === "extra" ||
      result.status === "unclear",
  )
  if (hasScheduledFail) return "fail"

  const hasManualCheck =
    identityMeds.some((med) => !med.present) || unknownMeds.length > 0
  if (hasManualCheck) return "manual_check"

  return "pass"
}
