import type { AuthUser } from "./auth-types.ts";
import type { AuthUserRepository, CreateUserInput } from "./auth-repository.ts";

export class InMemoryAuthUserRepository implements AuthUserRepository {
  private readonly users = new Map<string, AuthUser>();
  private nextId = 1;

  async createUser(input: CreateUserInput): Promise<AuthUser> {
    const normalizedEmail = normalizeEmail(input.email);
    const user: AuthUser = {
      id: `user_${this.nextId}`,
      name: input.name,
      email: normalizedEmail,
      emailVerified: null,
      passwordHash: input.passwordHash,
      role: "USER",
      status: "ACTIVE"
    };

    this.nextId += 1;
    this.users.set(normalizedEmail, user);
    return user;
  }

  async findByEmail(email: string): Promise<AuthUser | null> {
    return this.users.get(normalizeEmail(email)) ?? null;
  }
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
