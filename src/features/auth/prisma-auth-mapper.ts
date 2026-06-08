import type { AuthUser, AuthUserRole, AuthUserStatus } from "./auth-types.ts";

export type PrismaUserRecord = {
  id: string;
  name: string | null;
  email: string;
  emailVerified: Date | null;
  passwordHash: string | null;
  role: string;
  status: string;
};

function toAuthUserRole(value: string): AuthUserRole {
  return value === "ADMIN" ? "ADMIN" : "USER";
}

function toAuthUserStatus(value: string): AuthUserStatus {
  if (value === "SUSPENDED") return "SUSPENDED";
  if (value === "DELETED") return "DELETED";
  return "ACTIVE";
}

export function toAuthUser(record: PrismaUserRecord): AuthUser {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    emailVerified: record.emailVerified,
    passwordHash: record.passwordHash,
    role: toAuthUserRole(record.role),
    status: toAuthUserStatus(record.status)
  };
}
