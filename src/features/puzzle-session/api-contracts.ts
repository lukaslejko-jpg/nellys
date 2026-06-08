import type { Actor } from "../../lib/server/auth/authorization.ts";
import type { PyraminxState } from "../../lib/domain/pyraminx/state.ts";

export type ValidationIssue = {
  path: string;
  message: string;
};

export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: { issues: ValidationIssue[] } };

export type CreateManualSessionRequest = {
  actor: Actor;
};

export type SaveCorrectedStateRequest = {
  actor: Actor;
  correctedState: PyraminxState;
};

export type SolveSessionRequest = {
  actor: Actor;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseActor(value: unknown): ParseResult<Actor> {
  if (!isRecord(value)) {
    return issue("actor", "Actor is required.");
  }

  if (typeof value.id !== "string" || value.id.length === 0) {
    return issue("actor.id", "Actor id is required.");
  }

  if (value.role !== "USER" && value.role !== "ADMIN") {
    return issue("actor.role", "Actor role must be USER or ADMIN.");
  }

  return { success: true, data: { id: value.id, role: value.role } };
}

function isOrientation3(value: unknown): value is 0 | 1 | 2 {
  return value === 0 || value === 1 || value === 2;
}

function isEdgeOrientation(value: unknown): value is 0 | 1 {
  return value === 0 || value === 1;
}

function parsePyraminxState(value: unknown): ParseResult<PyraminxState> {
  if (!isRecord(value) || !isRecord(value.tips) || !isRecord(value.centers)) {
    return issue("correctedState", "Pyraminx state is required.");
  }

  const tips = value.tips;
  const centers = value.centers;
  const edgesPerm = value.edgesPerm;
  const edgesOri = value.edgesOri;

  if (
    !isOrientation3(tips.u) ||
    !isOrientation3(tips.l) ||
    !isOrientation3(tips.r) ||
    !isOrientation3(tips.b) ||
    !isOrientation3(centers.U) ||
    !isOrientation3(centers.L) ||
    !isOrientation3(centers.R) ||
    !isOrientation3(centers.B)
  ) {
    return issue("correctedState.orientation", "Orientations must be 0, 1 or 2.");
  }

  if (
    !Array.isArray(edgesPerm) ||
    edgesPerm.length !== 6 ||
    edgesPerm.some((edge) => !Number.isInteger(edge) || edge < 0 || edge > 5)
  ) {
    return issue("correctedState.edgesPerm", "Edge permutation must contain six edge ids.");
  }

  if (
    !Array.isArray(edgesOri) ||
    edgesOri.length !== 6 ||
    edgesOri.some((orientation) => !isEdgeOrientation(orientation))
  ) {
    return issue("correctedState.edgesOri", "Edge orientations must be 0 or 1.");
  }

  return {
    success: true,
    data: {
      tips: { u: tips.u, l: tips.l, r: tips.r, b: tips.b },
      centers: { U: centers.U, L: centers.L, R: centers.R, B: centers.B },
      edgesPerm: edgesPerm as PyraminxState["edgesPerm"],
      edgesOri: edgesOri as PyraminxState["edgesOri"]
    }
  };
}

function issue<T>(path: string, message: string): ParseResult<T> {
  return { success: false, error: { issues: [{ path, message }] } };
}

export const createManualSessionRequestSchema = {
  safeParse(value: unknown): ParseResult<CreateManualSessionRequest> {
    if (!isRecord(value)) return issue("", "Request body must be an object.");
    const actor = parseActor(value.actor);
    return actor.success ? { success: true, data: { actor: actor.data } } : actor;
  }
};

export const saveCorrectedStateRequestSchema = {
  safeParse(value: unknown): ParseResult<SaveCorrectedStateRequest> {
    if (!isRecord(value)) return issue("", "Request body must be an object.");
    const actor = parseActor(value.actor);
    if (!actor.success) return actor;

    const correctedState = parsePyraminxState(value.correctedState);
    if (!correctedState.success) return correctedState;

    return {
      success: true,
      data: { actor: actor.data, correctedState: correctedState.data }
    };
  }
};

export const solveSessionRequestSchema = {
  safeParse(value: unknown): ParseResult<SolveSessionRequest> {
    if (!isRecord(value)) return issue("", "Request body must be an object.");
    const actor = parseActor(value.actor);
    return actor.success ? { success: true, data: { actor: actor.data } } : actor;
  }
};
