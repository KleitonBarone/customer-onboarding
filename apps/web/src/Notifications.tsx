import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Actor } from "../../../packages/contracts/src/index.js";
import { api, isBrowserDemo, request } from "./api.js";
import { Icon } from "./Icon.js";

export function Notifications({ actor }: { actor: Actor }) {
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
            onClick={() => advance.mutate()}
          >
            <Icon name="clock" />
            Advance 24 hours
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
              <p>{item.message}</p>
              <small className="notification-date">Reminder window: {item.window}</small>
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
