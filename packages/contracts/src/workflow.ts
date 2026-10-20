import type { OnboardingDetail } from "./index.js";

type Requirement = Pick<
  OnboardingDetail["requirements"][number],
  "mandatory" | "state" | "currentRevisionId"
>;

export function activationBlockers<T extends Requirement>(requirements: readonly T[]) {
  return requirements.filter(
    (item) => item.mandatory && (item.state !== "approved" || !item.currentRevisionId),
  );
}

export function canActivate(requirements: readonly Requirement[]) {
  return (
    requirements.some((item) => item.mandatory) && activationBlockers(requirements).length === 0
  );
}

export function onboardingStatus(
  onboarding: Pick<OnboardingDetail["onboarding"], "activeAt" | "startedAt">,
  requirements: readonly Requirement[],
): OnboardingDetail["onboarding"]["status"] {
  if (onboarding.activeAt) return "active";
  if (canActivate(requirements)) return "ready";
  return onboarding.startedAt ? "in_progress" : "draft";
}
