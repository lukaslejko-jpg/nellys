import bcrypt from "bcryptjs";
import type { PasswordHasher } from "./password-hasher.ts";

export class BcryptPasswordHasher implements PasswordHasher {
  private readonly rounds: number;

  constructor(rounds = 12) {
    this.rounds = rounds;
  }

  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.rounds);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
