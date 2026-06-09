import assert from "node:assert/strict";
import test from "node:test";
import { currentUserHandler, loginHandler, logoutHandler, registerHandler } from "../../src/features/auth/api-handlers.ts";
import { AuthService } from "../../src/features/auth/auth-service.ts";
import { InMemoryAuthUserRepository } from "../../src/features/auth/in-memory-auth-repository.ts";
import { InMemoryUserSessionRepository } from "../../src/features/auth/in-memory-session-repository.ts";
import { DeterministicTestPasswordHasher } from "../../src/features/auth/password-hasher.ts";
import { SessionActorResolver } from "../../src/features/auth/session-actor-resolver.ts";
import { UserSessionService } from "../../src/features/auth/session-service.ts";
import { NodeSessionTokenService } from "../../src/features/auth/session-token-service.ts";

function createTestAuthService() {
  return new AuthService(
    new InMemoryAuthUserRepository(),
    new DeterministicTestPasswordHasher()
  );
}

test("register API handler creates user", async () => {
  const result = await registerHandler(createTestAuthService(), {
    name: "Lukas",
    email: "lukas@example.com",
    password: "very-safe-password"
  });

  assert.equal(result.status, 201);
  assert.equal((result.body as { ok: boolean }).ok, true);
});

test("register API handler rejects malformed body", async () => {
  const result = await registerHandler(createTestAuthService(), {
    name: "Lukas",
    email: "lukas@example.com"
  });

  assert.equal(result.status, 400);
});

test("register API handler rejects duplicate email", async () => {
  const service = createTestAuthService();

  await registerHandler(service, {
    name: "Lukas",
    email: "lukas@example.com",
    password: "very-safe-password"
  });
  const duplicate = await registerHandler(service, {
    name: "Lukas",
    email: "LUKAS@example.com",
    password: "very-safe-password"
  });

  assert.equal(duplicate.status, 422);
  assert.equal((duplicate.body as { code: string }).code, "EMAIL_TAKEN");
});

test("login API handler authenticates registered user", async () => {
  const service = createTestAuthService();

  await registerHandler(service, {
    name: "Lukas",
    email: "lukas@example.com",
    password: "very-safe-password"
  });
  const result = await loginHandler(service, {
    email: "lukas@example.com",
    password: "very-safe-password"
  });

  assert.equal(result.status, 200);
  assert.equal((result.body as { ok: boolean }).ok, true);
});

test("login API handler rejects wrong password", async () => {
  const service = createTestAuthService();

  await registerHandler(service, {
    name: "Lukas",
    email: "lukas@example.com",
    password: "very-safe-password"
  });
  const result = await loginHandler(service, {
    email: "lukas@example.com",
    password: "wrong-password"
  });

  assert.equal(result.status, 401);
  assert.equal((result.body as { code: string }).code, "INVALID_CREDENTIALS");
});

test("current user API handler resolves a valid session token", async () => {
  const users = new InMemoryAuthUserRepository();
  const sessions = new UserSessionService(
    new InMemoryUserSessionRepository(),
    new NodeSessionTokenService()
  );
  const user = await users.createUser({
    name: "Lukas",
    email: "lukas@example.com",
    passwordHash: "hash"
  });
  const token = await sessions.createForUser(user.id);
  const result = await currentUserHandler(new SessionActorResolver(users, sessions), token.token);

  assert.equal(result.status, 200);
  assert.equal((result.body as { ok: boolean }).ok, true);
  assert.equal((result.body as { user: { email: string } }).user.email, "lukas@example.com");
});

test("current user API handler rejects missing session token", async () => {
  const users = new InMemoryAuthUserRepository();
  const sessions = new UserSessionService(
    new InMemoryUserSessionRepository(),
    new NodeSessionTokenService()
  );
  const result = await currentUserHandler(new SessionActorResolver(users, sessions), undefined);

  assert.equal(result.status, 401);
  assert.equal((result.body as { code: string }).code, "SESSION_MISSING");
});

test("logout API handler revokes session token and clears cookie", async () => {
  const sessions = new UserSessionService(
    new InMemoryUserSessionRepository(),
    new NodeSessionTokenService()
  );
  const token = await sessions.createForUser("user-1");
  const result = await logoutHandler(sessions, token.token);
  const verified = await sessions.verify(token.token);

  assert.equal(result.status, 200);
  assert.equal(result.cookie?.name, "nellys_session");
  assert.equal(result.cookie?.maxAgeSeconds, 0);
  assert.equal(verified.ok, false);
  assert.equal(verified.ok ? "" : verified.code, "SESSION_REVOKED");
});
