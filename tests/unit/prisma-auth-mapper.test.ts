import assert from "node:assert/strict";
import test from "node:test";
import { toAuthUser } from "../../src/features/auth/prisma-auth-mapper.ts";

test("maps Prisma user record to auth user", () => {
  const user = toAuthUser({
    id: "user_1",
    name: "Lukas",
    email: "lukas@example.com",
    emailVerified: null,
    passwordHash: "hash",
    role: "ADMIN",
    status: "ACTIVE"
  });

  assert.equal(user.role, "ADMIN");
  assert.equal(user.status, "ACTIVE");
  assert.equal(user.passwordHash, "hash");
});

test("mapper falls back to safe role and status values", () => {
  const user = toAuthUser({
    id: "user_1",
    name: null,
    email: "lukas@example.com",
    emailVerified: null,
    passwordHash: null,
    role: "OWNER",
    status: "UNKNOWN"
  });

  assert.equal(user.role, "USER");
  assert.equal(user.status, "ACTIVE");
});
