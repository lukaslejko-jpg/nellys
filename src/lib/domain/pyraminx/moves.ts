export const moveFaces = ["U", "L", "R", "B", "u", "l", "r", "b"] as const;
export type MoveFace = (typeof moveFaces)[number];

export type PyraminxMove = MoveFace | `${MoveFace}'`;

export const legalMoves: readonly PyraminxMove[] = [
  "U",
  "U'",
  "L",
  "L'",
  "R",
  "R'",
  "B",
  "B'",
  "u",
  "u'",
  "l",
  "l'",
  "r",
  "r'",
  "b",
  "b'"
] as const;

export function isLegalMove(move: string): move is PyraminxMove {
  return (legalMoves as readonly string[]).includes(move);
}

export function inverseMove(move: PyraminxMove): PyraminxMove {
  return move.endsWith("'")
    ? (move.slice(0, -1) as PyraminxMove)
    : (`${move}'` as PyraminxMove);
}

export function inverseSequence(moves: readonly PyraminxMove[]): PyraminxMove[] {
  return [...moves].reverse().map(inverseMove);
}

export function baseFace(move: PyraminxMove): MoveFace {
  return (move.endsWith("'") ? move.slice(0, -1) : move) as MoveFace;
}

export function turnCount(move: PyraminxMove): 1 | 2 {
  return move.endsWith("'") ? 2 : 1;
}
