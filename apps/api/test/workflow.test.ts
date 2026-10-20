import assert from "node:assert/strict";
import test from "node:test";
import { submissionInput } from "../../../packages/contracts/src/index.js";
import {
  activationBlockers,
  canActivate,
  onboardingStatus,
} from "../../../packages/contracts/src/workflow.js";

test("readiness requires mandatory current approvals and cannot arise from an empty checklist", () => {
  const approved = { mandatory: true, state: "approved", currentRevisionId: "current" } as const;
  const missing = { mandatory: true, state: "missing", currentRevisionId: null } as const;
  assert.equal(canActivate([]), false);
  assert.equal(canActivate([approved, missing]), false);
  assert.equal(canActivate([{ ...approved, currentRevisionId: null }]), false);
  assert.equal(canActivate([approved, { ...missing, mandatory: false }]), true);
  assert.deepEqual(activationBlockers([approved, missing]), [missing]);
  assert.equal(onboardingStatus({ activeAt: null, startedAt: null }, [missing]), "draft");
  assert.equal(
    onboardingStatus({ activeAt: null, startedAt: "started" }, [missing]),
    "in_progress",
  );
  assert.equal(onboardingStatus({ activeAt: null, startedAt: "started" }, [approved]), "ready");
  assert.equal(
    onboardingStatus({ activeAt: "active", startedAt: "started" }, [approved]),
    "active",
  );
});

test("company and contact submissions have bounded structured fields", () => {
  assert.doesNotThrow(() =>
    submissionInput.assert({
      kind: "company",
      legalName: "Juniper",
      registeredAddress: "145 Orchard Avenue",
      version: 0,
    }),
  );
  assert.throws(() =>
    submissionInput.assert({ kind: "contact", name: "Maya", email: "invalid", version: 0 }),
  );
  assert.throws(() =>
    submissionInput.assert({
      kind: "company",
      legalName: " ".repeat(201),
      registeredAddress: "Address",
      version: 0,
    }),
  );
});
