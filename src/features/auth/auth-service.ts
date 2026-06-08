import type { AuthUserRepository } from "./auth-repository.ts";
import { normalizeEmail } from "./in-memory-auth-repository.ts";
import type { AuthResult, LoginInput, RegisterInput } from "./auth-types.ts";
import { toPublicAuthUser } from "./auth-types.ts";
import type { PasswordHasher } from "./password-hasher.ts";

export class AuthService {
  private readonly users: AuthUserRepository;
  private readonly passwordHasher: PasswordHasher;

  constructor(users: AuthUserRepository, passwordHasher: PasswordHasher) {
    this.users = users;
    this.passwordHasher = passwordHasher;
  }

  async register(input: RegisterInput): Promise<AuthResult> {
    const email = normalizeEmail(input.email);

    if (input.name.trim().length === 0) {
      return { ok: false, code: "NAME_REQUIRED", messageSk: "Meno je povinne." };
    }

    if (!isValidEmail(email)) {
      return { ok: false, code: "EMAIL_INVALID", messageSk: "Email nema platny format." };
    }

    if (input.password.length < 10) {
      return {
        ok: false,
        code: "PASSWORD_TOO_SHORT",
        messageSk: "Heslo musi mat aspon 10 znakov."
      };
    }

    const existing = await this.users.findByEmail(email);
    if (existing) {
      return { ok: false, code: "EMAIL_TAKEN", messageSk: "Email je uz registrovany." };
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = await this.users.createUser({
      name: input.name.trim(),
      email,
      passwordHash
    });

    return { ok: true, user: toPublicAuthUser(user) };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.users.findByEmail(input.email);

    if (!user || !user.passwordHash) {
      return invalidCredentials();
    }

    if (user.status !== "ACTIVE") {
      return {
        ok: false,
        code: "USER_NOT_ACTIVE",
        messageSk: "Pouzivatelsky ucet nie je aktivny."
      };
    }

    const verified = await this.passwordHasher.verify(input.password, user.passwordHash);
    if (!verified) {
      return invalidCredentials();
    }

    return { ok: true, user: toPublicAuthUser(user) };
  }
}

function invalidCredentials(): AuthResult {
  return {
    ok: false,
    code: "INVALID_CREDENTIALS",
    messageSk: "Email alebo heslo nie je spravne."
  };
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
