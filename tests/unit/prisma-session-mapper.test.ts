import assert from "node:assert/strict";
import test from "node:test";
import {
  toPrismaSessionUpdate,
  toPuzzleSessionSnapshot
} from "../../src/features/puzzle-session/prisma-session-mapper.ts";
import { createSolvedState } from "../../src/lib/domain/pyraminx/state.ts";

test("maps Prisma session record to domain snapshot", () => {
  const state = createSolvedState();
  const snapshot = toPuzzleSessionSnapshot({
    id: "session_1",
    userId: "user_1",
    status: "SOLVED",
    correctedStateJson: state,
    solutionJson: ["U", "R'"],
    currentStep: 1
  });

  assert.equal(snapshot.status, "solved");
  assert.deepEqual(snapshot.correctedState, state);
  assert.deepEqual(snapshot.solution, ["U", "R'"]);
  assert.equal(snapshot.currentStep, 1);
});

test("maps domain snapshot to Prisma update payload", () => {
  const state = createSolvedState();
  const update = toPrismaSessionUpdate({
    id: "session_1",
    userId: "user_1",
    status: "validated",
    correctedState: state,
    currentStep: 0
  });

  assert.equal(update.status, "VALIDATED");
  assert.deepEqual(update.correctedStateJson, state);
  assert.equal(update.solutionJson, null);
});
