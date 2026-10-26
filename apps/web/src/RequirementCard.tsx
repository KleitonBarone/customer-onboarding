import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  type Actor,
  type OnboardingDetail,
  submissionInput,
} from "../../../packages/contracts/src/index.js";
import { documentUrl, request } from "./api.js";

const states = {
  missing: "Not submitted",
  submitted: "In review",
  changes_requested: "Needs correction",
  approved: "Approved",
};

export function RequirementCard({
  detail,
  requirement,
  index,
  actor,
  refresh,
}: {
  detail: OnboardingDetail;
  requirement: OnboardingDetail["requirements"][number];
  index: number;
  actor: Actor;
  refresh: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState("");
  const fileRequirement = requirement.kind === "agreement" || requirement.kind === "import";
  const revision = detail.revisions.find((item) => item.id === requirement.currentRevisionId);
  const currentReview = detail.reviews.find((item) => item.revisionId === revision?.id);
  const history = detail.revisions
    .filter((item) => item.requirementId === requirement.id)
    .sort((a, b) => b.number - a.number);
  const base = `/onboardings/${detail.onboarding.id}/requirements/${requirement.id}`;
  const submission = useMutation({
    mutationFn: async (form: FormData) => {
      if (fileRequirement) {
        const file = form.get("file");
        if (!(file instanceof File) || file.size === 0)
          throw new Error("Choose a document to upload.");
        if (file.size > 2 * 1024 * 1024) throw new Error("Choose a file no larger than 2 MiB.");
        return request(`${base}/files?version=${requirement.version}`, {
          method: "POST",
          body: form,
        });
      }
      return request(`${base}/submissions`, {
        method: "POST",
        body: JSON.stringify(
          submissionInput.assert(
            requirement.kind === "company"
              ? {
                  kind: "company",
                  legalName: String(form.get("legalName") ?? ""),
                  registeredAddress: String(form.get("registeredAddress") ?? ""),
                  version: requirement.version,
                }
              : {
                  kind: "contact",
                  name: String(form.get("name") ?? ""),
                  email: String(form.get("email") ?? ""),
                  version: requirement.version,
                },
          ),
        ),
      });
    },
    onSuccess: async () => {
      setEditing(false);
      await refresh();
    },
  });
  const review = useMutation({
    mutationFn: (decision: "approved" | "changes_requested") =>
      request(`${base}/reviews`, {
        method: "POST",
        body: JSON.stringify({
          revisionId: revision?.id,
          version: requirement.version,
          decision,
          reason,
        }),
      }),
    onSuccess: async () => {
      setReason("");
      await refresh();
    },
  });
  return (
    <article className="requirement" aria-labelledby={`title-${requirement.id}`}>
      <div className="requirement-heading">
        <span className={`step ${requirement.state === "approved" ? "complete" : ""}`}>
          {requirement.state === "approved" ? "✓" : index + 1}
        </span>
        <div>
          <h3 id={`title-${requirement.id}`}>{requirement.title}</h3>
          <span className={`state-label state-${requirement.state}`}>
            {states[requirement.state]}
          </span>
        </div>
        {actor.role === "customer" && !detail.onboarding.activeAt && (
          <button
            type="button"
            className="secondary small"
            onClick={() => {
              submission.reset();
              setEditing(!editing);
            }}
          >
            {fileRequirement
              ? revision
                ? "Replace document"
                : "Upload document"
              : revision
                ? "Update details"
                : "Add details"}
          </button>
        )}
      </div>
      {submission.error && (
        <div>
          <p className="error" role="alert">
            {submission.error.message}
          </p>
          <button
            type="button"
            className="text-button"
            onClick={async () => {
              await refresh();
              submission.reset();
            }}
          >
            Refresh requirement
          </button>
        </div>
      )}
      {editing && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submission.mutate(new FormData(event.currentTarget));
          }}
        >
          {fileRequirement ? (
            <>
              <label htmlFor={`file-${requirement.id}`}>
                {requirement.kind === "agreement" ? "PDF agreement" : "CSV sample import"}, up to 2
                MiB
              </label>
              <input
                id={`file-${requirement.id}`}
                name="file"
                type="file"
                accept={requirement.kind === "agreement" ? ".pdf" : ".csv"}
                required
              />
            </>
          ) : requirement.kind === "company" ? (
            <>
              <label htmlFor={`legalName-${requirement.id}`}>Legal company name</label>
              <input
                id={`legalName-${requirement.id}`}
                name="legalName"
                required
                maxLength={200}
                defaultValue={revision?.content.split("\n")[0]}
              />
              <label htmlFor={`address-${requirement.id}`}>Registered address</label>
              <textarea
                id={`address-${requirement.id}`}
                name="registeredAddress"
                required
                maxLength={500}
                defaultValue={revision?.content.split("\n").slice(1).join("\n")}
                rows={3}
              />
            </>
          ) : (
            <>
              <label htmlFor={`name-${requirement.id}`}>Launch contact name</label>
              <input
                id={`name-${requirement.id}`}
                name="name"
                required
                maxLength={100}
                defaultValue={revision?.content.split("\n")[0]}
              />
              <label htmlFor={`email-${requirement.id}`}>Launch contact email</label>
              <input
                id={`email-${requirement.id}`}
                name="email"
                type="email"
                required
                maxLength={254}
                defaultValue={revision?.content.split("\n")[1]}
              />
            </>
          )}
          <div className="form-actions">
            <button type="submit" disabled={submission.isPending}>
              {submission.isPending ? "Submitting…" : "Submit for review"}
            </button>
            <button type="button" className="text-button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {revision && (
        <div className="submission-preview">
          {revision.fileName ? (
            <a
              className="document-link"
              href={documentUrl(revision.id)}
              download={revision.fileName}
            >
              Download {revision.fileName}
            </a>
          ) : (
            <p>{revision.content}</p>
          )}
          <small>
            Revision {revision.number} · Submitted by {revision.actor}
          </small>
        </div>
      )}
      {currentReview && requirement.state === "changes_requested" && (
        <div className="correction-note">
          <strong>What needs correcting</strong>
          <p>{currentReview.reason}</p>
          <small>{currentReview.actor}</small>
        </div>
      )}
      {actor.role === "reviewer" &&
        requirement.state === "submitted" &&
        revision &&
        !detail.onboarding.activeAt && (
          <div className="review-panel">
            <label htmlFor={`reason-${requirement.id}`}>Correction reason</label>
            <textarea
              id={`reason-${requirement.id}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Explain any changes the customer needs to make."
            />
            {review.error && (
              <div>
                <p className="error" role="alert">
                  {review.error.message}
                </p>
                <button
                  type="button"
                  className="text-button"
                  onClick={async () => {
                    await refresh();
                    review.reset();
                  }}
                >
                  Refresh requirement
                </button>
              </div>
            )}
            <div className="form-actions">
              <button
                type="button"
                onClick={() => review.mutate("approved")}
                disabled={review.isPending}
              >
                Approve
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => review.mutate("changes_requested")}
                disabled={review.isPending}
              >
                Request correction
              </button>
            </div>
          </div>
        )}
      {history.length > 0 && (
        <details className="revision-history">
          <summary>
            {history.length === 1 ? "Submission history" : `${history.length} submission revisions`}
          </summary>
          <ol>
            {history.map((item) => {
              const decision = detail.reviews.find((entry) => entry.revisionId === item.id);
              return (
                <li key={item.id}>
                  <strong>Revision {item.number}</strong>
                  {item.fileName ? (
                    <a href={documentUrl(item.id)} download={item.fileName}>
                      Download revision {item.number}
                    </a>
                  ) : (
                    <p>{item.content}</p>
                  )}
                  <small>Submitted by {item.actor}</small>
                  {decision && (
                    <p className={`state-${decision.decision}`}>
                      {states[decision.decision]} by {decision.actor}
                      {decision.reason ? `. ${decision.reason}` : ""}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </details>
      )}
    </article>
  );
}
