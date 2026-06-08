import { legalMoves, type PyraminxMove } from "./moves.ts";

export function deterministicScramble(seed: number, length: number): PyraminxMove[] {
  const moves: PyraminxMove[] = [];
  let value = seed || 1;

  for (let i = 0; i < length; i += 1) {
    value = (value * 48271) % 0x7fffffff;
    moves.push(legalMoves[value % legalMoves.length]);
  }

  return moves;
}
