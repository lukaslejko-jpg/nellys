import { type PyraminxState } from "./state.ts";

export type ValidationErrorCode =
  | "EDGE_PERMUTATION_INVALID"
  | "EDGE_ORIENTATION_INVALID"
  | "TIP_ORIENTATION_INVALID"
  | "CENTER_ORIENTATION_INVALID";

export type ValidationError = {
  code: ValidationErrorCode;
  messageSk: string;
};

export type ValidationResult =
  | { ok: true; state: PyraminxState }
  | { ok: false; errors: ValidationError[] };

export function validateStateShape(state: PyraminxState): ValidationResult {
  const errors: ValidationError[] = [];
  const edgeSet = new Set(state.edgesPerm);

  if (state.edgesPerm.length !== 6 || edgeSet.size !== 6 || state.edgesPerm.some((edge) => edge < 0 || edge > 5)) {
    errors.push({
      code: "EDGE_PERMUTATION_INVALID",
      messageSk: "Hrany netvoria platnu permutaciu Pyraminxu."
    });
  }

  if (state.edgesOri.length !== 6 || state.edgesOri.some((orientation) => orientation !== 0 && orientation !== 1)) {
    errors.push({
      code: "EDGE_ORIENTATION_INVALID",
      messageSk: "Orientacia hran obsahuje nepovolenu hodnotu."
    });
  }

  if (Object.values(state.tips).some((orientation) => orientation < 0 || orientation > 2)) {
    errors.push({
      code: "TIP_ORIENTATION_INVALID",
      messageSk: "Orientacia spiciek musi byt 0, 1 alebo 2."
    });
  }

  if (Object.values(state.centers).some((orientation) => orientation < 0 || orientation > 2)) {
    errors.push({
      code: "CENTER_ORIENTATION_INVALID",
      messageSk: "Orientacia vrstiev musi byt 0, 1 alebo 2."
    });
  }

  return errors.length ? { ok: false, errors } : { ok: true, state };
}
