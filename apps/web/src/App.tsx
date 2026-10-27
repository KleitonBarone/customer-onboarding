import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  type Actor,
  type OnboardingDetail,
  queueInput,
} from "../../../packages/contracts/src/index.js";
import { ActivationPanel } from "./ActivationPanel.js";
import { api, isBrowserDemo, request } from "./api.js";
import { Icon } from "./Icon.js";
import { Notifications } from "./Notifications.js";
import { Queue } from "./Queue.js";
import { RequirementCard } from "./RequirementCard.js";

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
  const [filters, setFilters] = useState(() => queueInput.assert({ limit: 20, offset: 0 }));
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
    queryKey: ["onboardings", generation, filters],
    queryFn: ({ signal }) => api.onboardings(filters, signal),
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
      setFilters(queueInput.assert({ limit: 20, offset: 0 }));
      navigate(null);
      setGeneration((value) => value + 1);
    },
  });
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
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
            <Icon name="list" />
            {actor?.role === "customer" ? "Your onboarding" : "Onboarding queue"}
          </button>
        </nav>
        <div className="sidebar-note">
          <span className="live-dot" />
          {isBrowserDemo ? "Browser demonstration" : "Local demonstration"}
          <p>Fictional companies. Real workflow.</p>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>Customer onboarding</span>
          <div className="topbar-actions">
            <label className="persona-label" htmlFor="persona">
              Demo persona
              <select
                id="persona"
                aria-label="Demo persona"
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
            <a
              className="repository-link secondary"
              href="https://github.com/KleitonBarone/customer-onboarding"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="github" />
              View on GitHub
              <Icon name="external" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          {isBrowserDemo && (
            <section className="demo-banner" aria-label="About this demo">
              <div>
                <strong>Interactive browser demo</strong>
                <p>
                  Changes and uploads stay in this tab. Refresh or reset to restore the examples.
                </p>
              </div>
              <button
                type="button"
                className="secondary"
                onClick={() => window.location.assign("/")}
              >
                <Icon name="reset" />
                Reset demo
              </button>
            </section>
          )}
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
                <Icon name="arrow-left" />
                Back to {actor.role === "customer" ? "your onboarding" : "queue"}
              </button>
              {detail.isPending ? (
                <p role="status">Loading onboarding…</p>
              ) : detail.error ? (
                <section className="empty-state">
                  <h1>Onboarding unavailable</h1>
                  <p role="alert">{detail.error.message}</p>
                  <button type="button" onClick={() => navigate(null)}>
                    <Icon name="list" />
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
              <Queue
                records={list.data ?? []}
                pending={list.isPending}
                error={list.error?.message}
                filters={filters}
                setFilters={setFilters}
                onOpen={navigate}
                onRetry={() => void list.refetch()}
                owners={
                  personas.data?.filter(
                    (persona) =>
                      persona.role === "manager" && persona.workspaceId === actor.workspaceId,
                  ) ?? []
                }
              />
            </>
          )}
          {actor && (
            <Notifications
              key={actor.membershipId}
              actor={actor}
              onOpen={(id) => {
                navigate(id);
                document.getElementById("main-content")?.focus({ preventScroll: true });
                window.scrollTo(0, 0);
              }}
            />
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
  const { onboarding, requirements, activity } = detail;
  const approved = requirements.filter((item) => item.state === "approved").length;
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
      <ActivationPanel detail={detail} actor={actor} refresh={refresh} />
      <div className="detail-grid">
        <section className="checklist" aria-label="Onboarding checklist">
          <div className="panel-heading">
            <h2>What we need to get started</h2>
            <span>
              {approved} of {requirements.length} approved
            </span>
          </div>
          {requirements.map((requirement, index) => (
            <RequirementCard
              key={requirement.id}
              detail={detail}
              requirement={requirement}
              index={index}
              actor={actor}
              refresh={refresh}
            />
          ))}
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
