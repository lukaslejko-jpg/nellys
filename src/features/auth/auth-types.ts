export type AuthUserRole = "USER" | "ADMIN";
export type AuthUserStatus = "ACTIVE" | "SUSPENDED" | "DELETED";

export type AuthUser = {
  id: string;
  name: string | null;
  email: string;
  emailVerified: Date | null;
  passwordHash: string | null;
  role: AuthUserRole;
  status: AuthUserStatus;
};

export type PublicAuthUser = {
  id: string;
  name: string | null;
  email: string;
  role: AuthUserRole;
  status: AuthUserStatus;
};

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type AuthResult =
  | { ok: true; user: PublicAuthUser }
  | { ok: false; code: string; messageSk: string };

export function toPublicAuthUser(user: AuthUser): PublicAuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status
  };
}
