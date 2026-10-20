import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import type { Actor, OnboardingDetail } from "../../../packages/contracts/src/index.js";
import { activationBlockers } from "../../../packages/contracts/src/workflow.js";
import { request } from "./api.js";

export function ActivationPanel({
  detail,
  actor,
  refresh,
}: {
  detail: OnboardingDetail;
  actor: Actor;
  refresh: () => Promise<void>;
}) {
  const { onboarding } = detail;
  const [reopening, setReopening] = useState(false);
  const [reason, setReason] = useState("");
  const blockers = activationBlockers(detail.requirements);
  const mutation = useMutation({
    mutationFn: (action: "activate" | "reopen") =>
      request(`/onboardings/${onboarding.id}/${action}`, {
        method: "POST",
        body: JSON.stringify({
          version: onboarding.version,
          ...(action === "reopen" ? { reason } : {}),
        }),
      }),
    onSuccess: async () => {
      setReopening(false);
      setReason("");
      await refresh();
    },
  });
  return (
    <section
      className={`activation-panel ${onboarding.activeAt ? "is-active" : ""}`}
      aria-label="Account activation"
    >
      <div>
        <strong>
          {onboarding.activeAt
            ? "Account is active"
            : onboarding.status === "ready"
              ? "Everything is approved. Ready for launch."
              : "Approval needed before activation"}
        </strong>
        <p>
          {onboarding.activeAt
            ? "Changes require the account manager to reopen onboarding first."
            : blockers.length
              ? `${blockers.length} mandatory ${blockers.length === 1 ? "requirement needs" : "requirements need"} approval: ${blockers.map((item) => item.title).join(", ")}.`
              : `${onboarding.owner} can activate this account.`}
        </p>
      </div>
      {actor.role === "manager" &&
        (onboarding.activeAt ? (
          <button type="button" className="secondary" onClick={() => setReopening(!reopening)}>
            Reopen onboarding
          </button>
        ) : (
          <button
            type="button"
            disabled={onboarding.status !== "ready" || mutation.isPending}
            onClick={() => mutation.mutate("activate")}
          >
            {mutation.isPending ? "Activating…" : "Activate account"}
          </button>
        ))}
      {reopening && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate("reopen");
          }}
        >
          <label htmlFor="reopen-reason">Reopening reason</label>
          <textarea
            id="reopen-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            maxLength={1000}
            rows={2}
          />
          <div className="form-actions">
            <button type="submit" disabled={mutation.isPending}>
              Confirm reopening
            </button>
            <button type="button" className="text-button" onClick={() => setReopening(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {mutation.error && (
        <div className="activation-error">
          <p role="alert" className="error">
            {mutation.error.message}
          </p>
          <button
            type="button"
            className="text-button"
            onClick={async () => {
              await refresh();
              mutation.reset();
            }}
          >
            Refresh onboarding
          </button>
        </div>
      )}
    </section>
  );
}
