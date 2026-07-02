export const OOD_CLASS_ID = 107
export const MIN_CLEAR_CONFIDENCE = 0.65
export const MIN_CLEAR_MARGIN = 0.15
export const OOD_COMPETITIVE_RATIO = 0.65

export interface DetectionScores {
  classId: number
  confidence: number
  rawClassId?: number
  rawConfidence?: number
  secondClassId?: number
  secondConfidence?: number
  oodConfidence?: number
  margin?: number
  uncertain?: boolean
  safetyReason?: "low_confidence" | "weak_margin" | "ood_competitive"
}

export function resolveOpenSetClass(scores: ArrayLike<number>): DetectionScores {
  let bestClassId = -1
  let bestConfidence = 0
  let secondClassId = -1
  let secondConfidence = 0

  for (let classId = 0; classId < scores.length; classId++) {
    const confidence = scores[classId]
    if (confidence > bestConfidence) {
      secondClassId = bestClassId
      secondConfidence = bestConfidence
      bestClassId = classId
      bestConfidence = confidence
      continue
    }
    if (confidence > secondConfidence) {
      secondClassId = classId
      secondConfidence = confidence
    }
  }

  const oodConfidence = scores[OOD_CLASS_ID] ?? 0
  const margin = bestConfidence - secondConfidence
  const oodIsCompetitive =
    bestClassId !== OOD_CLASS_ID &&
    oodConfidence >= 0.25 &&
    oodConfidence >= bestConfidence * OOD_COMPETITIVE_RATIO
  const weakMargin = bestClassId !== OOD_CLASS_ID && margin < MIN_CLEAR_MARGIN
  const lowConfidence = bestConfidence < MIN_CLEAR_CONFIDENCE

  return {
    classId: oodIsCompetitive ? OOD_CLASS_ID : bestClassId,
    confidence: oodIsCompetitive ? oodConfidence : bestConfidence,
    rawClassId: bestClassId,
    rawConfidence: bestConfidence,
    secondClassId,
    secondConfidence,
    oodConfidence,
    margin,
    uncertain: lowConfidence || weakMargin || oodIsCompetitive,
    safetyReason: oodIsCompetitive
      ? "ood_competitive"
      : weakMargin
        ? "weak_margin"
        : lowConfidence
          ? "low_confidence"
          : undefined,
  }
}
