import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryPuzzleSessionRepository } from "../../src/features/puzzle-session/in-memory-session-repository.ts";
import { PuzzleSessionService } from "../../src/features/puzzle-session/session-service.ts";
import { createSolvedState } from "../../src/lib/domain/pyraminx/state.ts";

test("session service creates a manual session owned by actor", async () => {
  const service = new PuzzleSessionService(new InMemoryPuzzleSessionRepository());

  const session = await service.createManualSession({ id: "user_1", role: "USER" });

  assert.equal(session.userId, "user_1");
  assert.equal(session.status, "draft");
});

test("session service saves corrected state and solves through deterministic solver", async () => {
  const repository = new InMemoryPuzzleSessionRepository();
  const service = new PuzzleSessionService(repository);
  const actor = { id: "user_1", role: "USER" } as const;
  const session = await service.createManualSession(actor);

  const saved = await service.saveCorrectedState(actor, session.id, createSolvedState());
  const solved = await service.solveSession(actor, session.id);

  assert.equal(saved.ok, true);
  assert.equal(solved.ok, true);
  assert.deepEqual(solved.ok ? solved.session.solution : ["failed"], []);
});

test("session service rejects access to another user's session", async () => {
  const repository = new InMemoryPuzzleSessionRepository();
  const service = new PuzzleSessionService(repository);
  const session = await service.createManualSession({ id: "user_1", role: "USER" });

  await assert.rejects(
    () =>
      service.saveCorrectedState(
        { id: "user_2", role: "USER" },
        session.id,
        createSolvedState()
      ),
    /SESSION_ACCESS_DENIED/
  );
});

test("admin can access another user's session", async () => {
  const repository = new InMemoryPuzzleSessionRepository();
  const service = new PuzzleSessionService(repository);
  const session = await service.createManualSession({ id: "user_1", role: "USER" });

  const saved = await service.saveCorrectedState(
    { id: "admin_1", role: "ADMIN" },
    session.id,
    createSolvedState()
  );

  assert.equal(saved.ok, true);
});
