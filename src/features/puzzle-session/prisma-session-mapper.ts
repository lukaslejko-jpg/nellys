import type { PyraminxMove } from "../../lib/domain/pyraminx/moves.ts";
import type { PyraminxState } from "../../lib/domain/pyraminx/state.ts";
import type { PuzzleSessionSnapshot, PuzzleSessionStatus } from "./session-types.ts";

export type PrismaPuzzleSessionRecord = {
  id: string;
  userId: string;
  status: string;
  correctedStateJson: unknown;
  solutionJson: unknown;
  currentStep: number;
};

const prismaToDomainStatus: Record<string, PuzzleSessionStatus> = {
  DRAFT: "draft",
  NEEDS_CONFIRMATION: "needs_confirmation",
  VALIDATED: "validated",
  SOLVED: "solved",
  COMPLETED: "completed",
  FAILED: "failed"
};

const domainToPrismaStatus: Record<PuzzleSessionStatus, string> = {
  draft: "DRAFT",
  needs_confirmation: "NEEDS_CONFIRMATION",
  validated: "VALIDATED",
  solved: "SOLVED",
  completed: "COMPLETED",
  failed: "FAILED"
};

function asPyraminxState(value: unknown): PyraminxState | undefined {
  return value ? (value as PyraminxState) : undefined;
}

function asMoveArray(value: unknown): PyraminxMove[] | undefined {
  return Array.isArray(value) ? (value as PyraminxMove[]) : undefined;
}

export function toPuzzleSessionSnapshot(
  record: PrismaPuzzleSessionRecord
): PuzzleSessionSnapshot {
  return {
    id: record.id,
    userId: record.userId,
    status: prismaToDomainStatus[record.status] ?? "failed",
    correctedState: asPyraminxState(record.correctedStateJson),
    solution: asMoveArray(record.solutionJson),
    currentStep: record.currentStep
  };
}

export function toPrismaSessionUpdate(session: PuzzleSessionSnapshot) {
  return {
    status: domainToPrismaStatus[session.status],
    correctedStateJson: session.correctedState ?? null,
    solutionJson: session.solution ?? null,
    currentStep: session.currentStep
  };
}
