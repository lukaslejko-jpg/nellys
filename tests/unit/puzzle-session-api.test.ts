import assert from "node:assert/strict";
import test from "node:test";
import {
  createManualSessionHandler,
  saveCorrectedStateHandler,
  solveSessionHandler
} from "../../src/features/puzzle-session/api-handlers.ts";
import { InMemoryPuzzleSessionRepository } from "../../src/features/puzzle-session/in-memory-session-repository.ts";
import { PuzzleSessionService } from "../../src/features/puzzle-session/session-service.ts";
import { createSolvedState } from "../../src/lib/domain/pyraminx/state.ts";

function createTestService() {
  return new PuzzleSessionService(new InMemoryPuzzleSessionRepository());
}

test("create manual session API handler validates actor and returns session", async () => {
  const result = await createManualSessionHandler(createTestService(), {
    actor: { id: "user_1", role: "USER" }
  });

  assert.equal(result.status, 201);
  assert.equal((result.body as { ok: boolean }).ok, true);
});

test("create manual session API handler rejects malformed body", async () => {
  const result = await createManualSessionHandler(createTestService(), {
    actor: { id: "", role: "OWNER" }
  });

  assert.equal(result.status, 400);
});

test("save state and solve handlers complete solved manual flow", async () => {
  const service = createTestService();
  const actor = { id: "user_1", role: "USER" } as const;
  const created = await createManualSessionHandler(service, { actor });
  const sessionId = (created.body as { session: { id: string } }).session.id;

  const saved = await saveCorrectedStateHandler(service, sessionId, {
    actor,
    correctedState: createSolvedState()
  });
  const solved = await solveSessionHandler(service, sessionId, { actor });

  assert.equal(saved.status, 200);
  assert.equal(solved.status, 200);
  assert.deepEqual(
    (solved.body as { session: { solution: string[] } }).session.solution,
    []
  );
});

test("save state handler rejects another user's session", async () => {
  const service = createTestService();
  const created = await createManualSessionHandler(service, {
    actor: { id: "user_1", role: "USER" }
  });
  const sessionId = (created.body as { session: { id: string } }).session.id;

  const saved = await saveCorrectedStateHandler(service, sessionId, {
    actor: { id: "user_2", role: "USER" },
    correctedState: createSolvedState()
  });

  assert.equal(saved.status, 403);
});
