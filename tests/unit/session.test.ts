import assert from "node:assert/strict";
import test from "node:test";
import { canStartSolve, defaultPlans } from "../../src/features/billing/plans.ts";
import { solveManualSession } from "../../src/features/puzzle-session/session-solver.ts";
import { createSolvedState } from "../../src/lib/domain/pyraminx/state.ts";

test("free plan blocks solves after monthly limit", () => {
  const free = defaultPlans.find((plan) => plan.slug === "free");

  assert.ok(free);
  assert.equal(canStartSolve(free, 0), true);
  assert.equal(canStartSolve(free, 2), true);
  assert.equal(canStartSolve(free, 3), false);
});

test("premium plan has no monthly solve limit", () => {
  const premium = defaultPlans.find((plan) => plan.slug === "premium");

  assert.ok(premium);
  assert.equal(canStartSolve(premium, 10_000), true);
});

test("manual session with solved state becomes solved with empty solution", () => {
  const result = solveManualSession({
    id: "session_1",
    userId: "user_1",
    status: "validated",
    correctedState: createSolvedState(),
    currentStep: 0
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.ok ? result.session.solution : ["failed"], []);
  assert.equal(result.ok ? result.session.status : "failed", "solved");
});

test("manual session without corrected state is rejected", () => {
  const result = solveManualSession({
    id: "session_1",
    userId: "user_1",
    status: "draft",
    currentStep: 0
  });

  assert.equal(result.ok, false);
  assert.equal(result.ok ? "" : result.code, "MISSING_STATE");
});
