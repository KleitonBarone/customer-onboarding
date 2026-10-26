import {
  demoNow,
  personaSeeds,
  requirementSeeds,
  scenarioAccounts,
  workspaceSeeds,
} from "../../../../packages/contracts/src/demo.js";
import {
  type Actor,
  activateInput,
  type notificationsSchema,
  type OnboardingDetail,
  personasSchema,
  queueInput,
  reopenInput,
  reviewInput,
  submissionInput,
  versionInput,
} from "../../../../packages/contracts/src/index.js";
import {
  canActivate,
  nextAction,
  onboardingStatus,
} from "../../../../packages/contracts/src/workflow.js";

class DemoError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

type RecordState = {
  workspaceId: string;
  ownerId: string;
  memberId: string;
  detail: OnboardingDetail;
};

// Each instance belongs to one browser tab. No cookies, remote writes or storage.
export function createDemoStore(fixtureUrls: Record<"agreement" | "import", string>) {
  const personas = personasSchema.assert(
    personaSeeds.map((person) => {
      const workspace = workspaceSeeds.find((item) => item.id === person.workspaceId);
      if (!workspace) throw new Error("Demo workspace is missing");
      return {
        id: "membershipId" in person ? person.membershipId : person.id,
        userId: person.id,
        name: person.name,
        role: person.role,
        workspaceId: workspace.id,
        workspaceName: workspace.name,
      };
    }),
  );
  let selectedId = "ada";
  let records: RecordState[] = [];
  const clocks = new Map<string, string>();
  const files = new Map<string, string>();
  const ownedUrls = new Set<string>();
  let notifications: typeof notificationsSchema.infer = [];

  function actor(): Actor {
    const person = personas.find((item) => item.id === selectedId);
    if (!person) throw new DemoError(401, "Choose a demo persona to continue.");
    return { ...person, membershipId: person.id };
  }

  function visible(record: RecordState, person: Actor) {
    return (
      record.workspaceId === person.workspaceId &&
      (person.role !== "customer" || record.memberId === person.membershipId)
    );
  }

  function scoped(id: string, person = actor()) {
    const record = records.find((item) => item.detail.onboarding.id === id);
    if (!record || !visible(record, person))
      throw new DemoError(404, "Onboarding not found for this account.");
    return record;
  }

  function clock(workspaceId: string) {
    return clocks.get(workspaceId) ?? demoNow;
  }

  function activity(record: RecordState, person: Actor, message: string) {
    record.detail.activity.unshift({
      id: crypto.randomUUID(),
      actor: person.name,
      message,
      createdAt: clock(record.workspaceId),
    });
  }

  function reminders() {
    for (const record of records) {
      const { onboarding, requirements } = record.detail;
      if (!onboarding.startedAt || onboarding.activeAt) continue;
      const blockers = requirements.filter(
        (item) =>
          item.mandatory && (item.state === "missing" || item.state === "changes_requested"),
      );
      const window = clock(record.workspaceId).slice(0, 10);
      if (
        !blockers.length ||
        notifications.some((item) => item.onboardingId === onboarding.id && item.window === window)
      )
        continue;
      notifications.unshift({
        id: crypto.randomUUID(),
        onboardingId: onboarding.id,
        company: onboarding.company,
        window,
        createdAt: clock(record.workspaceId),
        message: `${onboarding.company}: please complete or correct ${blockers.map((item) => item.title.toLowerCase()).join(", ")}.`,
      });
    }
  }

  function seed(config: (typeof scenarioAccounts)[number]): RecordState {
    const owner = personas.find((item) => item.userId === config.ownerId);
    const customer = personaSeeds.find((item) => item.id === config.member);
    if (!owner || !customer) throw new Error("Demo account persona is missing");
    const timestamp = (minutes: number) =>
      new Date(Date.parse(config.createdAt) + minutes * 60_000).toISOString();
    const detail: OnboardingDetail = {
      onboarding: {
        id: config.id,
        customerId: config.id,
        company: config.name,
        owner: owner.name,
        createdAt: config.createdAt,
        startedAt: null,
        activeAt: null,
        version: 0,
        status: "draft",
      },
      requirements: requirementSeeds.map((item) => ({
        ...item,
        id: `${config.id}-${item.kind}`,
        mandatory: true,
        state: "missing",
        currentRevisionId: null,
        version: 0,
      })),
      revisions: [],
      reviews: [],
      activity: [
        {
          id: `${config.id}-created`,
          actor: owner.name,
          message: "Created onboarding",
          createdAt: config.createdAt,
        },
      ],
    };
    if (config.scenario !== "missing") {
      for (const [index, requirement] of detail.requirements.entries()) {
        const fileKind =
          requirement.kind === "agreement" || requirement.kind === "import"
            ? requirement.kind
            : null;
        const fileName =
          fileKind === "agreement"
            ? "service-agreement.pdf"
            : fileKind === "import"
              ? "sample-import.csv"
              : null;
        const revisionId = `${requirement.id}-seed-1`;
        detail.revisions.unshift({
          id: revisionId,
          requirementId: requirement.id,
          number: 1,
          content:
            fileName ??
            (requirement.kind === "company"
              ? `${config.name} Ltd\n145 Orchard Avenue, Bristol`
              : `${customer.name}\n${customer.email}`),
          fileName,
          mediaType:
            fileKind === "agreement"
              ? "application/pdf"
              : fileKind === "import"
                ? "text/csv"
                : null,
          size: null,
          actor: customer.name,
          createdAt: timestamp(60 + index * 20),
        });
        if (fileKind) files.set(revisionId, fixtureUrls[fileKind]);
        detail.activity.unshift({
          id: `${revisionId}-submitted`,
          actor: customer.name,
          message: `Submitted ${requirement.title.toLowerCase()}`,
          createdAt: timestamp(60 + index * 20),
        });
        requirement.currentRevisionId = revisionId;
        requirement.state =
          config.scenario === "submitted"
            ? "submitted"
            : config.scenario === "changes_requested" && requirement.kind === "agreement"
              ? "changes_requested"
              : "approved";
        requirement.version = requirement.state === "submitted" ? 1 : 2;
        if (requirement.state !== "submitted") {
          const reason =
            requirement.state === "changes_requested" ? "Include the signed final page." : "";
          detail.reviews.unshift({
            id: `${revisionId}-review`,
            revisionId,
            actor: "Noah Ellis",
            decision: requirement.state,
            reason,
            createdAt: timestamp(70 + index * 20),
          });
          detail.activity.unshift({
            id: `${revisionId}-reviewed`,
            actor: "Noah Ellis",
            message:
              requirement.state === "approved"
                ? `Approved ${requirement.title.toLowerCase()}`
                : `Requested correction for ${requirement.title.toLowerCase()}: ${reason}`,
            createdAt: timestamp(70 + index * 20),
          });
        }
      }
      detail.onboarding.startedAt = timestamp(30);
      detail.onboarding.activeAt = config.scenario === "active" ? timestamp(180) : null;
      detail.onboarding.version =
        config.scenario === "submitted" ? 4 : config.scenario === "active" ? 9 : 8;
      if (detail.onboarding.activeAt)
        detail.activity.unshift({
          id: `${config.id}-activated`,
          actor: owner.name,
          message: "Activated account",
          createdAt: timestamp(180),
        });
    }
    return {
      workspaceId: config.workspaceId,
      ownerId: config.ownerId,
      memberId: config.member,
      detail,
    };
  }

  function reset() {
    for (const url of ownedUrls) URL.revokeObjectURL(url);
    ownedUrls.clear();
    files.clear();
    clocks.clear();
    notifications = [];
    for (const workspace of workspaceSeeds) clocks.set(workspace.id, demoNow);
    selectedId = "ada";
    records = scenarioAccounts.map(seed);
    reminders();
  }

  function editable(record: RecordState) {
    if (record.detail.onboarding.activeAt)
      throw new DemoError(
        409,
        "This account is active. Ask the account manager to reopen onboarding before changing information.",
      );
  }

  function requirement(record: RecordState, id: string, version: number) {
    const item = record.detail.requirements.find((entry) => entry.id === id);
    if (!item) throw new DemoError(404, "Requirement not found.");
    if (item.version !== version)
      throw new DemoError(409, "This requirement changed. Refresh it before continuing.");
    return item;
  }

  function submit(
    person: Actor,
    record: RecordState,
    requirementId: string,
    version: number,
    content: string,
    file?: { blob: Blob; name: string; type: string },
  ) {
    editable(record);
    if (!records.includes(record)) throw new DemoError(409, "The demo was reset. Submit again.");
    const item = requirement(record, requirementId, version);
    const id = crypto.randomUUID();
    if (file) {
      const url = URL.createObjectURL(file.blob);
      ownedUrls.add(url);
      files.set(id, url);
    }
    record.detail.revisions.unshift({
      id,
      requirementId,
      content,
      actor: person.name,
      createdAt: clock(record.workspaceId),
      number:
        record.detail.revisions.filter((entry) => entry.requirementId === requirementId).length + 1,
      fileName: file?.name ?? null,
      mediaType: file?.type ?? null,
      size: file?.blob.size ?? null,
    });
    item.currentRevisionId = id;
    item.state = "submitted";
    item.version++;
    record.detail.onboarding.startedAt ??= clock(record.workspaceId);
    record.detail.onboarding.version++;
    activity(record, person, `Submitted ${item.title.toLowerCase()}`);
    reminders();
    return { ok: true };
  }

  function customerRecord(id: string) {
    const person = actor();
    const record = scoped(id, person);
    if (person.role !== "customer")
      throw new DemoError(403, "Only the assigned customer can submit information.");
    return { person, record };
  }

  reset();
  return {
    reset,
    personas: () => structuredClone(personas),
    session: () => structuredClone(actor()),
    login(id: string) {
      if (!personas.some((item) => item.id === id))
        throw new DemoError(404, "Demo persona not found.");
      selectedId = id;
      return { ok: true };
    },
    clock: () => ({ now: clock(actor().workspaceId) }),
    advanceClock() {
      const person = actor();
      if (person.role !== "manager")
        throw new DemoError(403, "Only account managers can advance the demo clock.");
      clocks.set(
        person.workspaceId,
        new Date(Date.parse(clock(person.workspaceId)) + 86_400_000).toISOString(),
      );
      reminders();
      return { now: clock(person.workspaceId) };
    },
    notifications() {
      reminders();
      const person = actor();
      return structuredClone(
        notifications
          .filter((item) =>
            records.some(
              (record) =>
                record.detail.onboarding.id === item.onboardingId && visible(record, person),
            ),
          )
          .slice(0, 50),
      );
    },
    detail(id: string) {
      const record = scoped(id);
      const detail = structuredClone(record.detail);
      detail.onboarding.status = onboardingStatus(detail.onboarding, detail.requirements);
      return detail;
    },
    onboardings(query: typeof queueInput.infer) {
      const input = queueInput.assert(query);
      const person = actor();
      return records
        .filter((record) => visible(record, person))
        .map((record) => ({
          ...record.detail.onboarding,
          ownerId: record.ownerId,
          status: onboardingStatus(record.detail.onboarding, record.detail.requirements),
          ageDays: Math.max(
            0,
            Math.floor(
              (Date.parse(clock(record.workspaceId)) -
                Date.parse(record.detail.onboarding.createdAt)) /
                86_400_000,
            ),
          ),
          nextAction: nextAction(
            onboardingStatus(record.detail.onboarding, record.detail.requirements),
            record.detail.requirements,
          ),
        }))
        .filter(
          (item) =>
            (!input.status || item.status === input.status) &&
            (!input.ownerId || item.ownerId === input.ownerId) &&
            (!input.search?.trim() ||
              item.company.toLowerCase().includes(input.search.trim().toLowerCase())),
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
        .slice(input.offset, input.offset + input.limit);
    },
    documentUrl(id: string) {
      const record = records.find((entry) =>
        entry.detail.revisions.some((revision) => revision.id === id),
      );
      if (!record) throw new DemoError(404, "Document not found.");
      scoped(record.detail.onboarding.id);
      const url = files.get(id);
      if (!url) throw new DemoError(404, "Document not found.");
      return url;
    },
    submitDetails(id: string, requirementId: string, body: unknown) {
      const { person, record } = customerRecord(id);
      const input = submissionInput.assert(body);
      if (requirement(record, requirementId, input.version).kind !== input.kind)
        throw new DemoError(400, "The details do not match this requirement.");
      const fields =
        input.kind === "company"
          ? [input.legalName, input.registeredAddress]
          : [input.name, input.email];
      if (fields.some((field) => !field.trim()))
        throw new DemoError(400, "Complete every requested field.");
      return submit(
        person,
        record,
        requirementId,
        input.version,
        fields.map((field) => field.trim()).join("\n"),
      );
    },
    async submitFile(id: string, requirementId: string, version: number, file: unknown) {
      const { person, record } = customerRecord(id);
      versionInput.assert(version);
      const kind = requirement(record, requirementId, version).kind;
      if (!(file instanceof File) || !file.size)
        throw new DemoError(400, "Choose a document to upload.");
      if (file.size > 2 * 1024 * 1024)
        throw new DemoError(413, "Choose a file no larger than 2 MiB.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const name = file.name
        .replace(/^.*[\\/]/, "")
        .replace(/\p{Cc}/gu, "")
        .slice(0, 160);
      let type: string;
      if (
        kind === "agreement" &&
        name.toLowerCase().endsWith(".pdf") &&
        new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-"
      )
        type = "application/pdf";
      else if (kind === "import" && name.toLowerCase().endsWith(".csv")) {
        let text: string;
        try {
          text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        } catch {
          throw new DemoError(400, "Upload a UTF-8 CSV sample.");
        }
        if (text.includes("\0") || !text.includes(","))
          throw new DemoError(400, "Upload a UTF-8 CSV sample with comma-separated columns.");
        type = "text/csv";
      } else
        throw new DemoError(
          400,
          kind === "agreement"
            ? "Upload a PDF agreement, up to 2 MiB."
            : "Upload a UTF-8 CSV sample, up to 2 MiB.",
        );
      return submit(person, record, requirementId, version, name, {
        blob: new Blob([bytes], { type }),
        name,
        type,
      });
    },
    review(id: string, requirementId: string, body: unknown) {
      const person = actor();
      const record = scoped(id, person);
      const input = reviewInput.assert(body);
      if (person.role !== "reviewer")
        throw new DemoError(403, "Only a reviewer can approve information or request corrections.");
      editable(record);
      const item = requirement(record, requirementId, input.version);
      if (item.state !== "submitted" || item.currentRevisionId !== input.revisionId)
        throw new DemoError(
          409,
          "This submission changed or was already reviewed. Refresh before deciding.",
        );
      const reason = input.reason.trim();
      if (input.decision === "changes_requested" && !reason)
        throw new DemoError(400, "Explain what the customer needs to correct.");
      record.detail.reviews.unshift({
        id: crypto.randomUUID(),
        revisionId: input.revisionId,
        actor: person.name,
        decision: input.decision,
        reason,
        createdAt: clock(record.workspaceId),
      });
      item.state = input.decision;
      item.version++;
      record.detail.onboarding.version++;
      activity(
        record,
        person,
        input.decision === "approved"
          ? `Approved ${item.title.toLowerCase()}`
          : `Requested correction for ${item.title.toLowerCase()}: ${reason}`,
      );
      reminders();
      return { ok: true };
    },
    activation(id: string, action: "activate" | "reopen", body: unknown) {
      const person = actor();
      const record = scoped(id, person);
      if (person.role !== "manager")
        throw new DemoError(403, "Only an account manager can activate or reopen an account.");
      const input =
        action === "activate"
          ? { ...activateInput.assert(body), reason: "" }
          : reopenInput.assert(body);
      const onboarding = record.detail.onboarding;
      if (onboarding.version !== input.version)
        throw new DemoError(409, "This onboarding changed. Refresh before continuing.");
      if (
        action === "activate" &&
        (onboarding.activeAt || !canActivate(record.detail.requirements))
      )
        throw new DemoError(
          409,
          "Activation needs approval of every mandatory current submission.",
        );
      if (action === "reopen" && (!onboarding.activeAt || !input.reason.trim()))
        throw new DemoError(409, "Reopening needs an active account and a reason.");
      onboarding.activeAt = action === "activate" ? clock(record.workspaceId) : null;
      onboarding.version++;
      activity(
        record,
        person,
        action === "activate" ? "Activated account" : `Reopened onboarding: ${input.reason.trim()}`,
      );
      reminders();
      return { ok: true };
    },
  };
}
