import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Actor, OnboardingDetail } from "../../../packages/contracts/src/index.js";
import { api, request } from "./api.js";

const labels = {
  missing: "Not submitted",
  submitted: "In review",
  changes_requested: "Needs correction",
  approved: "Approved",
  draft: "Not started",
  in_progress: "In progress",
  ready: "Ready to activate",
  active: "Active",
};
const roleLabels = { manager: "Account manager", reviewer: "Reviewer", customer: "Customer" };

function currentId() {
  const match = /^\/onboardings\/([^/]+)$/.exec(window.location.pathname);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function App() {
  const queries = useQueryClient();
  const [generation, setGeneration] = useState(0);
  const [selectedId, setSelectedId] = useState(currentId);
  const personas = useQuery({
    queryKey: ["personas", generation],
    queryFn: ({ signal }) => api.personas(signal),
  });
  const session = useQuery({
    queryKey: ["session", generation],
    queryFn: ({ signal }) => api.session(signal),
    retry: false,
  });
  const actor = session.data;
  const list = useQuery({
    queryKey: ["onboardings", generation],
    queryFn: ({ signal }) => api.onboardings(signal),
    enabled: !!actor,
  });
  const id = selectedId ?? (actor?.role === "customer" ? list.data?.[0]?.id : undefined);
  const detail = useQuery({
    queryKey: ["detail", generation, id],
    queryFn: ({ signal }) => api.detail(id ?? "", signal),
    enabled: !!actor && !!id,
    retry: false,
  });
  const navigate = (next: string | null) => {
    window.history.pushState({}, "", next ? `/onboardings/${encodeURIComponent(next)}` : "/");
    setSelectedId(next);
  };
  useEffect(() => {
    const listener = () => setSelectedId(currentId());
    window.addEventListener("popstate", listener);
    return () => window.removeEventListener("popstate", listener);
  }, []);
  const login = useMutation({
    mutationFn: async (membershipId: string) => {
      await queries.cancelQueries();
      await request("/demo/session", { method: "POST", body: JSON.stringify({ membershipId }) });
    },
    onSuccess: () => {
      queries.clear();
      navigate(null);
      setGeneration((value) => value + 1);
    },
  });
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            navigate(null);
          }}
        >
          <span className="brand-mark" aria-hidden="true">
            r
          </span>
          Relay
        </a>
        <p className="workspace-name">{actor?.workspaceName ?? "Customer onboarding"}</p>
        <nav aria-label="Main navigation">
          <button type="button" className="nav-item selected" onClick={() => navigate(null)}>
            {actor?.role === "customer" ? "Your onboarding" : "Onboarding queue"}
          </button>
        </nav>
        <div className="sidebar-note">
          <span className="live-dot" />
          Local demonstration<p>Fictional companies. Real workflow.</p>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>Customer onboarding</span>
          <label className="persona-label" htmlFor="persona">
            Demo persona
            <select
              id="persona"
              value={actor?.membershipId ?? ""}
              disabled={login.isPending}
              onChange={(event) => {
                if (event.target.value) login.mutate(event.target.value);
              }}
            >
              <option value="">Choose a persona</option>
              {personas.data?.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.name} · {roleLabels[persona.role]} · {persona.workspaceName}
                </option>
              ))}
            </select>
          </label>
        </header>
        <main id="main-content">
          {(login.error || session.error || personas.error) && (
            <p role="alert" className="error">
              {(login.error ?? session.error ?? personas.error)?.message}
            </p>
          )}
          {session.isPending ? (
            <p role="status">Loading your session…</p>
          ) : !actor ? (
            <section className="welcome">
              <p className="section-label">A clear path to launch</p>
              <h1>
                Every customer.
                <br />
                Ready for day one.
              </h1>
              <p>
                Collect the details, review the documents, and see exactly what stands between your
                customer and activation.
              </p>
              <p>
                Choose a demo persona above to explore the customer portal or employee workspace.
              </p>
            </section>
          ) : id ? (
            <>
              <button type="button" className="text-button back" onClick={() => navigate(null)}>
                Back to {actor.role === "customer" ? "your onboarding" : "queue"}
              </button>
              {detail.isPending ? (
                <p role="status">Loading onboarding…</p>
              ) : detail.error ? (
                <section className="empty-state">
                  <h1>Onboarding unavailable</h1>
                  <p role="alert">{detail.error.message}</p>
                  <button type="button" onClick={() => navigate(null)}>
                    Return to your workspace
                  </button>
                </section>
              ) : (
                detail.data && (
                  <Onboarding
                    detail={detail.data}
                    actor={actor}
                    refresh={async () => {
                      await queries.invalidateQueries({ queryKey: ["detail"] });
                      await queries.invalidateQueries({ queryKey: ["onboardings"] });
                    }}
                  />
                )
              )}
            </>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <p className="section-label">Your workspace</p>
                  <h1>
                    {actor.role === "customer" ? "Your onboarding" : "Keep every launch moving."}
                  </h1>
                  <p className="intro-copy">
                    {actor.role === "customer"
                      ? "Complete your checklist and follow the review."
                      : "Open a customer to see their checklist and the next step."}
                  </p>
                </div>
                <span className="count-label">{list.data?.length ?? 0} customers</span>
              </div>
              {list.isPending ? (
                <p role="status">Loading customers…</p>
              ) : list.error ? (
                <p role="alert" className="error">
                  {list.error.message}
                </p>
              ) : (
                <div className="queue">
                  <div className="queue-heading">
                    <span>Customer</span>
                    <span>Status</span>
                    <span>Account manager</span>
                  </div>
                  {list.data?.length ? (
                    list.data.map((record) => (
                      <button
                        type="button"
                        className="queue-row"
                        key={record.id}
                        onClick={() => navigate(record.id)}
                      >
                        <span>
                          <strong>{record.company}</strong>
                          <small>
                            Started{" "}
                            {new Date(record.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              timeZone: "UTC",
                            })}
                          </small>
                        </span>
                        <span className={`status status-${record.status}`}>
                          {labels[record.status]}
                        </span>
                        <span className="owner">{record.owner}</span>
                      </button>
                    ))
                  ) : (
                    <p className="empty-state">No onboardings are assigned to this account.</p>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function Onboarding({
  detail,
  actor,
  refresh,
}: {
  detail: OnboardingDetail;
  actor: Actor;
  refresh: () => Promise<void>;
}) {
  const { onboarding, requirements, revisions, activity } = detail;
  const approved = requirements.filter((item) => item.state === "approved").length;
  const [editing, setEditing] = useState<string | null>(null);
  const submission = useMutation({
    mutationFn: async ({
      id,
      content,
      version,
    }: {
      id: string;
      content: string;
      version: number;
    }) =>
      request(`/onboardings/${onboarding.id}/requirements/${id}/submissions`, {
        method: "POST",
        body: JSON.stringify({ content, version }),
      }),
    onSuccess: async () => {
      setEditing(null);
      await refresh();
    },
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="section-label">
            {actor.role === "customer" ? "Your launch checklist" : "Onboarding details"}
          </p>
          <h1>{onboarding.company}</h1>
          <p className="intro-copy">Account manager {onboarding.owner}</p>
        </div>
        <span className={`status status-${onboarding.status}`}>{labels[onboarding.status]}</span>
      </div>
      <div className="detail-grid">
        <section className="checklist" aria-label="Onboarding checklist">
          <div className="panel-heading">
            <h2>What we need to get started</h2>
            <span>
              {approved} of {requirements.length} approved
            </span>
          </div>
          {submission.error && (
            <p className="error" role="alert">
              {submission.error.message}
            </p>
          )}
          {requirements.map((requirement, index) => {
            const revision = revisions.find((item) => item.id === requirement.currentRevisionId);
            return (
              <article className="requirement" key={requirement.id}>
                <div className="requirement-heading">
                  <span className={`step ${requirement.state === "approved" ? "complete" : ""}`}>
                    {requirement.state === "approved" ? "✓" : index + 1}
                  </span>
                  <div>
                    <h3>{requirement.title}</h3>
                    <span className={`state-label state-${requirement.state}`}>
                      {labels[requirement.state]}
                    </span>
                  </div>
                  {actor.role === "customer" &&
                    (requirement.kind === "company" || requirement.kind === "contact") && (
                      <button
                        type="button"
                        className="secondary small"
                        onClick={() => {
                          submission.reset();
                          setEditing(editing === requirement.id ? null : requirement.id);
                        }}
                      >
                        {revision ? "Update details" : "Add details"}
                      </button>
                    )}
                </div>
                {editing === requirement.id && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      submission.mutate({
                        id: requirement.id,
                        content: String(form.get("content") ?? ""),
                        version: requirement.version,
                      });
                    }}
                  >
                    <label htmlFor={`content-${requirement.id}`}>
                      {requirement.kind === "company"
                        ? "Legal company name and registered address"
                        : "Launch contact name and email"}
                    </label>
                    <textarea
                      id={`content-${requirement.id}`}
                      name="content"
                      required
                      maxLength={5000}
                      defaultValue={revision?.content}
                      rows={4}
                    />
                    <div className="form-actions">
                      <button type="submit" disabled={submission.isPending}>
                        {submission.isPending ? "Submitting…" : "Submit for review"}
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setEditing(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
                {revision && (
                  <div className="submission-preview">
                    <p>{revision.content}</p>
                    <small>Submitted by {revision.actor}</small>
                  </div>
                )}
              </article>
            );
          })}
        </section>
        <aside className="activity-panel">
          <h2>Activity</h2>
          {activity.length ? (
            <ol className="timeline">
              {activity.map((entry) => (
                <li key={entry.id}>
                  <p>{entry.message}</p>
                  <small>
                    {entry.actor} ·{" "}
                    {new Date(entry.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    })}
                  </small>
                </li>
              ))}
            </ol>
          ) : (
            <div className="empty-activity">
              <span aria-hidden="true">◎</span>
              <p>The story starts here.</p>
              <small>Submissions and decisions will appear as your onboarding progresses.</small>
            </div>
          )}
          <div className="account-contact">
            <span className="avatar">{onboarding.owner.charAt(0)}</span>
            <div>
              <strong>{onboarding.owner}</strong>
              <small>Your account manager</small>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
