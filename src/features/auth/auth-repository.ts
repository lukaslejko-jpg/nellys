import type { AuthUser } from "./auth-types.ts";

export type CreateUserInput = {
  name: string;
  email: string;
  passwordHash: string;
};

export interface AuthUserRepository {
  createUser(input: CreateUserInput): Promise<AuthUser>;
  findByEmail(email: string): Promise<AuthUser | null>;
}
