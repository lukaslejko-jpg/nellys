import assert from "node:assert/strict";
import test from "node:test";
import {
  createManualSessionForActorHandler,
  saveCorrectedStateForActorHandler,
  solveSessionForActorHandler
} from "../../src/features/puzzle-session/api-handlers.ts";
import { InMemoryPuzzleSessionRepository } from "../../src/features/puzzle-session/in-memory-session-repository.ts";
import { PuzzleSessionService } from "../../src/features/puzzle-session/session-service.ts";
import { createSolvedState } from "../../src/lib/domain/pyraminx/state.ts";

function createService() {
  return new PuzzleSessionService(new InMemoryPuzzleSessionRepository());
}

test("secure puzzle session handlers use actor argument instead of body actor", async () => {
  const service = createService();
  const actor = { id: "user_1", role: "USER" } as const;
  const created = await createManualSessionForActorHandler(service, actor);
  const sessionId = (created.body as { session: { id: string } }).session.id;

  const saved = await saveCorrectedStateForActorHandler(service, actor, sessionId, {
    actor: { id: "attacker", role: "ADMIN" },
    correctedState: createSolvedState()
  });
  const solved = await solveSessionForActorHandler(service, actor, sessionId);

  assert.equal(created.status, 201);
  assert.equal(saved.status, 200);
  assert.equal(solved.status, 200);
});

test("secure save handler still rejects another user through service ownership", async () => {
  const service = createService();
  const created = await createManualSessionForActorHandler(service, {
    id: "user_1",
    role: "USER"
  });
  const sessionId = (created.body as { session: { id: string } }).session.id;

  const saved = await saveCorrectedStateForActorHandler(
    service,
    { id: "user_2", role: "USER" },
    sessionId,
    { correctedState: createSolvedState() }
  );

  assert.equal(saved.status, 403);
});
