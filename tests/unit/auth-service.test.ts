import assert from "node:assert/strict";
import test from "node:test";
import { AuthService } from "../../src/features/auth/auth-service.ts";
import { InMemoryAuthUserRepository } from "../../src/features/auth/in-memory-auth-repository.ts";
import { DeterministicTestPasswordHasher } from "../../src/features/auth/password-hasher.ts";

function createAuthService() {
  return new AuthService(
    new InMemoryAuthUserRepository(),
    new DeterministicTestPasswordHasher()
  );
}

test("auth service registers a new user with normalized email", async () => {
  const service = createAuthService();

  const result = await service.register({
    name: "Lukas",
    email: "  LUKAS@example.com ",
    password: "very-safe-password"
  });

  assert.equal(result.ok, true);
  assert.equal(result.ok ? result.user.email : "", "lukas@example.com");
  assert.equal(result.ok ? result.user.role : "", "USER");
});

test("auth service rejects duplicate email", async () => {
  const service = createAuthService();

  await service.register({
    name: "Lukas",
    email: "lukas@example.com",
    password: "very-safe-password"
  });
  const duplicate = await service.register({
    name: "Lukas",
    email: "LUKAS@example.com",
    password: "very-safe-password"
  });

  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.ok ? "" : duplicate.code, "EMAIL_TAKEN");
});

test("auth service logs in with valid credentials", async () => {
  const service = createAuthService();

  await service.register({
    name: "Lukas",
    email: "lukas@example.com",
    password: "very-safe-password"
  });
  const result = await service.login({
    email: "lukas@example.com",
    password: "very-safe-password"
  });

  assert.equal(result.ok, true);
  assert.equal(result.ok ? result.user.email : "", "lukas@example.com");
});

test("auth service rejects invalid password", async () => {
  const service = createAuthService();

  await service.register({
    name: "Lukas",
    email: "lukas@example.com",
    password: "very-safe-password"
  });
  const result = await service.login({
    email: "lukas@example.com",
    password: "wrong-password"
  });

  assert.equal(result.ok, false);
  assert.equal(result.ok ? "" : result.code, "INVALID_CREDENTIALS");
});
