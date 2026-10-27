import { scenarioAccounts, workspaceSeeds } from "../../../packages/contracts/src/demo.js";
import type { Actor, personaSchema } from "../../../packages/contracts/src/index.js";
import { Icon } from "./Icon.js";

export type DemoViewChange = { membershipId: string; onboardingId: string | null };

const roles = [
  { role: "manager", label: "Account manager", icon: "briefcase" },
  { role: "reviewer", label: "Reviewer", icon: "list" },
  { role: "customer", label: "Customer", icon: "user" },
] as const;

export function DemoViewSwitcher({
  actor,
  personas,
  onboardingId,
  pending,
  onSwitch,
}: {
  actor: Actor | null | undefined;
  personas: readonly (typeof personaSchema.infer)[];
  onboardingId: string | null;
  pending: boolean;
  onSwitch: (view: DemoViewChange) => void;
}) {
  const workspaceId = actor?.workspaceId ?? workspaceSeeds[0].id;
  const available = personas.filter((person) => person.workspaceId === workspaceId);
  const customers = available.flatMap((person) => {
    if (person.role !== "customer") return [];
    const account = scenarioAccounts.find(
      (item) => item.member === person.userId && item.workspaceId === person.workspaceId,
    );
    return account ? [{ person, account }] : [];
  });
  const customer =
    customers.find((item) =>
      actor?.role === "customer"
        ? item.person.id === actor.membershipId
        : item.account.id === onboardingId,
    ) ?? customers[0];

  return (
    <div className="demo-view-switcher">
      <span id="demo-view-label" className="demo-view-label">
        View as
      </span>
      <fieldset
        className="demo-role-buttons"
        aria-labelledby="demo-view-label"
        aria-describedby="demo-view-help"
        aria-busy={pending}
      >
        {roles.map(({ role, label, icon }) => {
          const person =
            role === "customer" ? customer?.person : available.find((item) => item.role === role);
          return (
            <button
              key={role}
              type="button"
              className="demo-role-button"
              aria-pressed={actor?.role === role}
              disabled={pending || !person}
              aria-busy={pending}
              onClick={() => {
                if (person && role !== actor?.role)
                  onSwitch({
                    membershipId: person.id,
                    onboardingId:
                      role === "customer" ? (customer?.account.id ?? null) : onboardingId,
                  });
              }}
            >
              <Icon name={icon} />
              <span>{label}</span>
            </button>
          );
        })}
      </fieldset>
      <p id="demo-view-help" className="demo-view-help">
        {actor?.role === "customer"
          ? "Submit your details and documents."
          : actor?.role === "reviewer"
            ? "Review submissions and request corrections."
            : "Track customers and activate approved accounts."}
      </p>
      {actor?.role === "customer" && (
        <label className="demo-customer-field" htmlFor="demo-customer">
          Customer account
          <select
            id="demo-customer"
            aria-label="Customer account"
            value={customer?.account.id ?? ""}
            disabled={pending}
            aria-busy={pending}
            onChange={(event) => {
              const next = customers.find((item) => item.account.id === event.target.value);
              if (next) onSwitch({ membershipId: next.person.id, onboardingId: next.account.id });
            }}
          >
            {customers.map((item) => (
              <option key={item.account.id} value={item.account.id}>
                {item.account.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
