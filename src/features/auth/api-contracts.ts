import type { LoginInput, RegisterInput } from "./auth-types.ts";

export type ValidationIssue = {
  path: string;
  message: string;
};

export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: { issues: ValidationIssue[] } };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function issue<T>(path: string, message: string): ParseResult<T> {
  return { success: false, error: { issues: [{ path, message }] } };
}

export const registerRequestSchema = {
  safeParse(value: unknown): ParseResult<RegisterInput> {
    if (!isRecord(value)) return issue("", "Request body must be an object.");
    if (typeof value.name !== "string") return issue("name", "Name is required.");
    if (typeof value.email !== "string") return issue("email", "Email is required.");
    if (typeof value.password !== "string") {
      return issue("password", "Password is required.");
    }

    return {
      success: true,
      data: {
        name: value.name,
        email: value.email,
        password: value.password
      }
    };
  }
};

export const loginRequestSchema = {
  safeParse(value: unknown): ParseResult<LoginInput> {
    if (!isRecord(value)) return issue("", "Request body must be an object.");
    if (typeof value.email !== "string") return issue("email", "Email is required.");
    if (typeof value.password !== "string") {
      return issue("password", "Password is required.");
    }

    return {
      success: true,
      data: {
        email: value.email,
        password: value.password
      }
    };
  }
};
