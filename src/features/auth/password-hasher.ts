export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

export class DeterministicTestPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `test-hash:${password}`;
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return hash === `test-hash:${password}`;
  }
}
