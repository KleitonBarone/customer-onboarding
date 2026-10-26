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

export function nextAction(
  status: ReturnType<typeof onboardingStatus>,
  requirements: readonly Pick<OnboardingDetail["requirements"][number], "state" | "title">[],
) {
  if (status === "active") return "Account active";
  if (status === "ready") return "Account manager to activate";
  const correction = requirements.find((item) => item.state === "changes_requested");
  if (correction) return `Customer to correct ${correction.title.toLowerCase()}`;
  const waiting = requirements.filter((item) => item.state === "submitted").length;
  return waiting
    ? `Reviewer to review ${waiting} ${waiting === 1 ? "submission" : "submissions"}`
    : "Customer to submit missing information";
}
