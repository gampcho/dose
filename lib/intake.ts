import type { MealTiming, Medication, Plan, Session } from "@/lib/types"
import { SESSION_LABELS } from "@/lib/types"

export interface DueMedication {
  planId: string
  planName: string
  med: Medication
  pillCount: number
}

export function getDueMedications(
  plans: Plan[],
  session: Session,
  mealTiming: MealTiming,
): DueMedication[] {
  const due: DueMedication[] = []

  for (const plan of plans) {
    for (const med of plan.medications) {
      const pillCount = currentPillCount(med, session, mealTiming)
      if (pillCount > 0) {
        due.push({ planId: plan.id, planName: plan.name, med, pillCount })
      }
    }
  }

  return due
}

export function buildIntakeSpeech(
  meds: DueMedication[],
  session: Session,
  mealTiming: MealTiming,
): string {
  const timing = mealTiming === "before"
    ? "trước ăn"
    : mealTiming === "after"
      ? "sau ăn"
      : ""

  if (meds.length === 0) {
    return `Buổi ${SESSION_LABELS[session]} ${timing}, hiện không có thuốc cần uống.`
  }

  const intro = `Buổi ${SESSION_LABELS[session]} ${timing}, bạn cần uống ${meds.length} loại thuốc.`
  const items = meds.map((item) =>
    `${item.med.name}, ${item.pillCount} ${item.med.unit}${item.med.mealTiming ? `, ${mealTimingLabel(item.med.mealTiming)}` : ""}.`,
  )

  return [intro, ...items].join(" ")
}

function currentPillCount(
  med: Medication,
  session: Session,
  mealTiming: MealTiming,
): number {
  return med.doses
    .filter((dose) => dose.session === session)
    .filter(() => !mealTiming || med.mealTiming === mealTiming)
    .reduce((sum, dose) => sum + dose.pillCount, 0)
}

function mealTimingLabel(mealTiming: Exclude<MealTiming, null>): string {
  return mealTiming === "before" ? "trước ăn" : "sau ăn"
}
