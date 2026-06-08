import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryUserSessionRepository } from "../../src/features/auth/in-memory-session-repository.ts";
import { loginHandler, registerHandler } from "../../src/features/auth/api-handlers.ts";
import { AuthService } from "../../src/features/auth/auth-service.ts";
import { InMemoryAuthUserRepository } from "../../src/features/auth/in-memory-auth-repository.ts";
import { DeterministicTestPasswordHasher } from "../../src/features/auth/password-hasher.ts";
import { UserSessionService } from "../../src/features/auth/session-service.ts";
import { NodeSessionTokenService } from "../../src/features/auth/session-token-service.ts";

function createSessionService(ttlMs = 1000 * 60) {
  return new UserSessionService(
    new InMemoryUserSessionRepository(),
    new NodeSessionTokenService(),
    ttlMs
  );
}

function createAuthService() {
  return new AuthService(
    new InMemoryAuthUserRepository(),
    new DeterministicTestPasswordHasher()
  );
}

test("session service creates and verifies token", async () => {
  const sessions = createSessionService();
  const pair = await sessions.createForUser("user_1", new Date("2026-01-01T00:00:00Z"));
  const verified = await sessions.verify(pair.token, new Date("2026-01-01T00:00:01Z"));

  assert.equal(verified.ok, true);
  assert.equal(verified.ok ? verified.userId : "", "user_1");
});

test("session service rejects expired token", async () => {
  const sessions = createSessionService(1000);
  const pair = await sessions.createForUser("user_1", new Date("2026-01-01T00:00:00Z"));
  const verified = await sessions.verify(pair.token, new Date("2026-01-01T00:00:02Z"));

  assert.equal(verified.ok, false);
  assert.equal(verified.ok ? "" : verified.code, "SESSION_EXPIRED");
});

test("session service rejects revoked token", async () => {
  const sessions = createSessionService();
  const pair = await sessions.createForUser("user_1");

  await sessions.revoke(pair.token);
  const verified = await sessions.verify(pair.token);

  assert.equal(verified.ok, false);
  assert.equal(verified.ok ? "" : verified.code, "SESSION_REVOKED");
});

test("login handler can issue http-only cookie metadata", async () => {
  const auth = createAuthService();
  const sessions = createSessionService();

  await registerHandler(auth, {
    name: "Lukas",
    email: "lukas@example.com",
    password: "very-safe-password"
  });
  const login = await loginHandler(
    auth,
    { email: "lukas@example.com", password: "very-safe-password" },
    sessions
  );

  assert.equal(login.status, 200);
  assert.equal(login.cookie?.name, "nellys_session");
  assert.ok(login.cookie?.value);
});
