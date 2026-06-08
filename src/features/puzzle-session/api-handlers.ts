import type { PuzzleSessionService } from "./session-service.ts";
import {
  createManualSessionRequestSchema,
  saveCorrectedStateRequestSchema,
  solveSessionRequestSchema
} from "./api-contracts.ts";

export type ApiHandlerResult =
  | { status: number; body: unknown }
  | { status: 500; body: { ok: false; code: "INTERNAL_ERROR"; messageSk: string } };

export async function createManualSessionHandler(
  service: PuzzleSessionService,
  body: unknown
): Promise<ApiHandlerResult> {
  const parsed = createManualSessionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { ok: false, code: "BAD_REQUEST", issues: parsed.error.issues } };
  }

  const session = await service.createManualSession(parsed.data.actor);
  return { status: 201, body: { ok: true, session } };
}

export async function saveCorrectedStateHandler(
  service: PuzzleSessionService,
  sessionId: string,
  body: unknown
): Promise<ApiHandlerResult> {
  const parsed = saveCorrectedStateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { ok: false, code: "BAD_REQUEST", issues: parsed.error.issues } };
  }

  try {
    const result = await service.saveCorrectedState(
      parsed.data.actor,
      sessionId,
      parsed.data.correctedState
    );

    return result.ok
      ? { status: 200, body: { ok: true, session: result.value } }
      : { status: 422, body: { ok: false, code: result.code, messageSk: result.messageSk } };
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_ACCESS_DENIED") {
      return { status: 403, body: { ok: false, code: "SESSION_ACCESS_DENIED" } };
    }
    throw error;
  }
}

export async function solveSessionHandler(
  service: PuzzleSessionService,
  sessionId: string,
  body: unknown
): Promise<ApiHandlerResult> {
  const parsed = solveSessionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { ok: false, code: "BAD_REQUEST", issues: parsed.error.issues } };
  }

  try {
    const result = await service.solveSession(parsed.data.actor, sessionId);

    return result.ok
      ? { status: 200, body: { ok: true, session: result.session } }
      : { status: 422, body: { ok: false, code: result.code, messageSk: result.messageSk } };
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_ACCESS_DENIED") {
      return { status: 403, body: { ok: false, code: "SESSION_ACCESS_DENIED" } };
    }
    throw error;
  }
}
