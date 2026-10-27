import {
  type onboardingsSchema,
  type personaSchema,
  queueInput,
} from "../../../packages/contracts/src/index.js";
import { Icon } from "./Icon.js";

const labels = {
  draft: "Not started",
  in_progress: "In progress",
  ready: "Ready to activate",
  active: "Active",
};

export function Queue({
  records,
  pending,
  error,
  filters,
  setFilters,
  owners,
  onOpen,
  onRetry,
}: {
  records: typeof onboardingsSchema.infer;
  pending: boolean;
  error?: string;
  filters: typeof queueInput.infer;
  setFilters: (input: typeof queueInput.infer) => void;
  owners: Pick<typeof personaSchema.infer, "userId" | "name">[];
  onOpen: (id: string) => void;
  onRetry: () => void;
}) {
  return (
    <>
      <fieldset className="queue-filters" aria-label="Queue filters">
        <label htmlFor="queue-search">
          Search customers
          <input
            id="queue-search"
            type="search"
            maxLength={80}
            value={filters.search ?? ""}
            placeholder="Company name"
            onChange={(event) => setFilters({ ...filters, search: event.target.value, offset: 0 })}
          />
        </label>
        <label htmlFor="queue-status">
          Status
          <select
            id="queue-status"
            aria-label="Status"
            value={filters.status ?? ""}
            onChange={(event) => {
              const next = { ...filters, offset: 0 };
              delete next.status;
              setFilters(
                event.target.value
                  ? queueInput.assert({ ...next, status: event.target.value })
                  : next,
              );
            }}
          >
            <option value="">All statuses</option>
            <option value="draft">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="ready">Ready to activate</option>
            <option value="active">Active</option>
          </select>
        </label>
        <label htmlFor="queue-owner">
          Account manager
          <select
            id="queue-owner"
            aria-label="Account manager"
            value={filters.ownerId ?? ""}
            onChange={(event) => {
              const next = { ...filters, offset: 0 };
              delete next.ownerId;
              if (event.target.value) next.ownerId = event.target.value;
              setFilters(next);
            }}
          >
            <option value="">All account managers</option>
            {owners.map((owner) => (
              <option key={owner.userId} value={owner.userId}>
                {owner.name}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      {pending ? (
        <p role="status">Loading customers…</p>
      ) : error ? (
        <div>
          <p role="alert" className="error">
            {error}
          </p>
          <button type="button" className="secondary" onClick={onRetry}>
            <Icon name="refresh" />
            Retry
          </button>
        </div>
      ) : (
        <div className="queue">
          <div className="queue-heading">
            <span>Customer</span>
            <span>Status</span>
            <span className="owner">Account manager</span>
            <span className="age">Age</span>
            <span className="next-action">Next action</span>
          </div>
          {records.length ? (
            records.map((record) => (
              <button
                type="button"
                className="queue-row"
                key={record.id}
                onClick={() => onOpen(record.id)}
              >
                <span>
                  <strong>{record.company}</strong>
                  <small>
                    Opened{" "}
                    {new Date(record.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    })}
                    <span className="mobile-age"> · {record.ageDays} days old</span>
                  </small>
                </span>
                <span className={`status status-${record.status}`}>{labels[record.status]}</span>
                <span className="owner">{record.owner}</span>
                <span className="age">{record.ageDays}d</span>
                <span className="next-action">{record.nextAction}</span>
                <Icon name="chevron-right" />
              </button>
            ))
          ) : (
            <div className="empty-state">
              <p>No onboardings match these filters.</p>
              <button
                type="button"
                className="secondary"
                onClick={() => setFilters(queueInput.assert({ limit: 20, offset: 0 }))}
              >
                <Icon name="cancel" />
                Clear filters
              </button>
            </div>
          )}
        </div>
      )}
      {(filters.offset > 0 || records.length === filters.limit) && (
        <div className="pagination">
          <button
            type="button"
            className="secondary"
            disabled={!filters.offset || pending}
            onClick={() =>
              setFilters({ ...filters, offset: Math.max(0, filters.offset - filters.limit) })
            }
          >
            <Icon name="arrow-left" />
            Previous page
          </button>
          <button
            type="button"
            className="secondary"
            disabled={pending || records.length < filters.limit}
            onClick={() => setFilters({ ...filters, offset: filters.offset + filters.limit })}
          >
            Next page
            <Icon name="arrow-right" />
          </button>
        </div>
      )}
    </>
  );
}
