import { scenarioAccounts, workspaceSeeds } from "../../../packages/contracts/src/demo.js";
import {
  type Actor,
  type personaSchema,
  roleSchema,
} from "../../../packages/contracts/src/index.js";

export type DemoViewChange = { membershipId: string; onboardingId: string | null };

const roles = { manager: "Account manager", reviewer: "Reviewer", customer: "Customer" };

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
      <div className="demo-view-fields">
        <label htmlFor="demo-view">
          View as
          <select
            id="demo-view"
            aria-label="View as"
            aria-describedby="demo-view-help"
            value={actor?.role ?? ""}
            disabled={pending || !personas.length}
            aria-busy={pending}
            onChange={(event) => {
              const role = roleSchema.assert(event.target.value);
              if (role === actor?.role) return;
              const person =
                role === "customer"
                  ? customer?.person
                  : available.find((item) => item.role === role);
              if (person)
                onSwitch({
                  membershipId: person.id,
                  onboardingId: role === "customer" ? (customer?.account.id ?? null) : onboardingId,
                });
            }}
          >
            {!actor && <option value="">Choose a view</option>}
            {(["manager", "reviewer", "customer"] as const).map((role) => (
              <option
                key={role}
                value={role}
                disabled={
                  role === "customer"
                    ? !customers.length
                    : !available.some((item) => item.role === role)
                }
              >
                {roles[role]}
              </option>
            ))}
          </select>
        </label>
        {actor?.role === "customer" && (
          <label htmlFor="demo-customer">
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
      <p id="demo-view-help" className="demo-view-help">
        {actor?.role === "customer"
          ? `Submit details and documents for ${customer?.account.name ?? "your account"}.`
          : actor?.role === "reviewer"
            ? "Review submissions and request corrections."
            : "Track customers and activate approved accounts."}
      </p>
    </div>
  );
}
