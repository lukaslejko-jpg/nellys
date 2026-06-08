import assert from "node:assert/strict";
import test from "node:test";
import { deterministicScramble } from "../../src/lib/domain/pyraminx/fixtures.ts";
import { inverseMove, inverseSequence, legalMoves } from "../../src/lib/domain/pyraminx/moves.ts";
import { solveState, verifySolution } from "../../src/lib/domain/pyraminx/solver.ts";
import { applyMove, applySequence } from "../../src/lib/domain/pyraminx/simulator.ts";
import { createSolvedState, isSolved, serializeState } from "../../src/lib/domain/pyraminx/state.ts";
import { validateStateShape } from "../../src/lib/domain/pyraminx/validator.ts";

test("solved state validates and needs no moves", () => {
  const state = createSolvedState();
  const validation = validateStateShape(state);
  const solution = solveState(state);

  assert.equal(validation.ok, true);
  assert.equal(solution.ok, true);
  assert.deepEqual(solution.ok ? solution.moves : ["failed"], []);
});

test("every move followed by its inverse returns the original state", () => {
  const solved = createSolvedState();

  for (const move of legalMoves) {
    const afterMove = applyMove(solved, move);
    const back = applyMove(afterMove, inverseMove(move));
    assert.equal(serializeState(back), serializeState(solved), move);
  }
});

test("inverse sequence returns a scramble to solved state", () => {
  const solved = createSolvedState();
  const scramble = deterministicScramble(42, 8);
  const scrambled = applySequence(solved, scramble);
  const restored = applySequence(scrambled, inverseSequence(scramble));

  assert.equal(isSolved(restored), true);
});

test("solver returns verified solutions for deterministic short scrambles", () => {
  const solved = createSolvedState();

  for (let seed = 1; seed <= 40; seed += 1) {
    const scramble = deterministicScramble(seed, 4);
    const scrambled = applySequence(solved, scramble);
    const solution = solveState(scrambled, { maxDepth: 6 });

    assert.equal(solution.ok, true, `seed ${seed}: ${solution.ok ? "" : solution.error}`);
    assert.equal(solution.ok ? verifySolution(scrambled, solution.moves) : false, true);
  }
});
