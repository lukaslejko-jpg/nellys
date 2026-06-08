import assert from "node:assert/strict";
import test from "node:test";
import { loginHandler, registerHandler } from "../../src/features/auth/api-handlers.ts";
import { AuthService } from "../../src/features/auth/auth-service.ts";
import { InMemoryAuthUserRepository } from "../../src/features/auth/in-memory-auth-repository.ts";
import { DeterministicTestPasswordHasher } from "../../src/features/auth/password-hasher.ts";

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
