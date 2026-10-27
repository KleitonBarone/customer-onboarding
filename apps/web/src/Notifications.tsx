import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Actor } from "../../../packages/contracts/src/index.js";
import { api, isBrowserDemo, request } from "./api.js";
import { Icon } from "./Icon.js";

export function Notifications({ actor, onOpen }: { actor: Actor; onOpen: (id: string) => void }) {
  const queries = useQueryClient();
  const clock = useQuery({
    queryKey: ["clock", actor.membershipId],
    queryFn: ({ signal }) => api.clock(signal),
  });
  const inbox = useQuery({
    queryKey: ["notifications", actor.membershipId],
    queryFn: ({ signal }) => api.notifications(signal),
    refetchInterval: 5_000,
  });
  const advance = useMutation({
    mutationFn: () => request("/demo/clock/advance", { method: "POST", body: "{}" }),
    onSuccess: async () => {
      await queries.invalidateQueries({ queryKey: ["clock"] });
      await queries.invalidateQueries({ queryKey: ["onboardings"] });
      await queries.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
  return (
    <section className="notification-panel" aria-label="Local notification inbox">
      <header className="notification-header">
        <div className="notification-heading">
          <h2>Notification inbox</h2>
          <span>{isBrowserDemo ? "Browser demo" : "Local demo"}</span>
        </div>
        <p className="notification-description">
          Reminders for customer action appear here once per UTC day. No email is sent.
        </p>
      </header>
      <div className="demo-clock">
        <span>Workspace demo date: {clock.data ? clock.data.now.slice(0, 10) : "Loading…"}</span>
        {actor.role === "manager" && (
          <button
            type="button"
            className="secondary"
            disabled={advance.isPending}
            aria-busy={advance.isPending}
            onClick={() => advance.mutate()}
          >
            <Icon name="clock" />
            {advance.isPending ? "Advancing…" : "Advance 24 hours"}
          </button>
        )}
      </div>
      {(inbox.error || clock.error || advance.error) && (
        <p role="alert" className="error">
          {(inbox.error ?? clock.error ?? advance.error)?.message}
        </p>
      )}
      {inbox.isPending ? (
        <p role="status" className="notification-empty">
          Loading notifications…
        </p>
      ) : inbox.data?.length ? (
        <ul className="notifications">
          {inbox.data.map((item) => (
            <li key={item.id}>
              <span className="reminder-icon">
                <Icon name="bell" />
              </span>
              <div className="reminder-copy">
                <div className="reminder-heading">
                  <strong>Reminder</strong>
                  <small className="notification-date">
                    <time dateTime={item.window}>
                      {new Date(`${item.window}T00:00:00.000Z`).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        timeZone: "UTC",
                      })}
                    </time>
                  </small>
                </div>
                <p>{item.message}</p>
                <a
                  className="reminder-action"
                  href={`/onboardings/${encodeURIComponent(item.onboardingId)}`}
                  aria-label={`${actor.role === "customer" ? "Open checklist" : "View onboarding"} for ${item.company}`}
                  onClick={(event) => {
                    if (
                      event.button !== 0 ||
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey
                    )
                      return;
                    event.preventDefault();
                    onOpen(item.onboardingId);
                  }}
                >
                  {actor.role === "customer" ? "Open checklist" : "View onboarding"}
                  <Icon name="arrow-right" />
                </a>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="notification-empty">No reminders for this account yet.</p>
      )}
      <small className="notification-note">
        {isBrowserDemo
          ? "Reminders update as you explore and advance the demo date."
          : "The processor checks every five seconds."}{" "}
        Showing up to 50 reminders.
      </small>
    </section>
  );
}
