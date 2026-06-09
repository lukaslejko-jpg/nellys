import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryAuthUserRepository } from "../../src/features/auth/in-memory-auth-repository.ts";
import { InMemoryUserSessionRepository } from "../../src/features/auth/in-memory-session-repository.ts";
import { SessionActorResolver } from "../../src/features/auth/session-actor-resolver.ts";
import { UserSessionService } from "../../src/features/auth/session-service.ts";
import { NodeSessionTokenService } from "../../src/features/auth/session-token-service.ts";

async function createResolverFixture() {
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

  return { users, sessions, user, resolver: new SessionActorResolver(users, sessions) };
}

test("session actor resolver resolves valid token to actor", async () => {
  const { sessions, user, resolver } = await createResolverFixture();
  const token = await sessions.createForUser(user.id);
  const resolved = await resolver.resolve(token.token);

  assert.equal(resolved.ok, true);
  assert.equal(resolved.ok ? resolved.actor.id : "", user.id);
  assert.equal(resolved.ok ? resolved.actor.role : "", "USER");
});

test("session actor resolver rejects missing token", async () => {
  const { resolver } = await createResolverFixture();
  const resolved = await resolver.resolve(undefined);

  assert.equal(resolved.ok, false);
  assert.equal(resolved.ok ? "" : resolved.code, "SESSION_MISSING");
});

test("session actor resolver rejects revoked token", async () => {
  const { sessions, user, resolver } = await createResolverFixture();
  const token = await sessions.createForUser(user.id);

  await sessions.revoke(token.token);
  const resolved = await resolver.resolve(token.token);

  assert.equal(resolved.ok, false);
  assert.equal(resolved.ok ? "" : resolved.code, "SESSION_INVALID");
});
