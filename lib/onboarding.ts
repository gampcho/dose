const ONBOARDING_SEEN_KEY = "dose:onboarding_seen"
export const HOME_TOUR_KEY = "dose:home_tour_seen"
export const PLAN_TOUR_PENDING_KEY = "dose:plan_tour_pending"
export const PLANS_KEY = "dose:plans"
export const FEEDBACK_KEY = "dose:feedback"
export const VERIFY_IMAGE_KEY = "dose:verify:global:image"
export const VERIFY_MEAL_KEY = "dose:verify:global:meal"
export const VERIFY_SESSION_KEY = "dose:verify:global:session"

function hasWindow(): boolean {
  return typeof window !== "undefined"
}

export function hasSeenOnboarding(): boolean {
  return hasWindow() && localStorage.getItem(ONBOARDING_SEEN_KEY) === "1"
}

export function markOnboardingSeen(): void {
  if (!hasWindow()) return
  localStorage.setItem(ONBOARDING_SEEN_KEY, "1")
}

export function reopenHomeTour(): void {
  if (!hasWindow()) return
  markOnboardingSeen()
  localStorage.removeItem(HOME_TOUR_KEY)
  localStorage.removeItem(PLAN_TOUR_PENDING_KEY)
}

export function finishHomeTour(): void {
  if (!hasWindow()) return
  localStorage.setItem(HOME_TOUR_KEY, "1")
}

export function startPlanTour(planId: string): void {
  if (!hasWindow()) return
  finishHomeTour()
  localStorage.setItem(PLAN_TOUR_PENDING_KEY, planId)
}

export function readPendingPlanTour(): string | null {
  if (!hasWindow()) return null
  return localStorage.getItem(PLAN_TOUR_PENDING_KEY)
}

export function clearPendingPlanTour(planId?: string): void {
  if (!hasWindow()) return
  if (!planId || localStorage.getItem(PLAN_TOUR_PENDING_KEY) === planId) {
    localStorage.removeItem(PLAN_TOUR_PENDING_KEY)
  }
}

export function resetDoseAppState(): void {
  if (!hasWindow()) return
  localStorage.removeItem(ONBOARDING_SEEN_KEY)
  localStorage.removeItem(HOME_TOUR_KEY)
  localStorage.removeItem(PLAN_TOUR_PENDING_KEY)
  localStorage.removeItem(PLANS_KEY)
  localStorage.removeItem(FEEDBACK_KEY)
  sessionStorage.removeItem(VERIFY_IMAGE_KEY)
  sessionStorage.removeItem(VERIFY_MEAL_KEY)
  sessionStorage.removeItem(VERIFY_SESSION_KEY)
}
