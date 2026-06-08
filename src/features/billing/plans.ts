export type PlanSlug = "free" | "family" | "premium";

export type PlanFeature =
  | "manual-input"
  | "photo-scan"
  | "video-analysis"
  | "voice-assistant"
  | "mistake-check"
  | "history";

export type PlanDefinition = {
  slug: PlanSlug;
  name: string;
  priceCents: number;
  currency: "EUR";
  billingInterval: "month";
  monthlySolveLimit: number | null;
  features: PlanFeature[];
  recommended: boolean;
};

export const defaultPlans: PlanDefinition[] = [
  {
    slug: "free",
    name: "Free",
    priceCents: 0,
    currency: "EUR",
    billingInterval: "month",
    monthlySolveLimit: 3,
    features: ["manual-input", "history"],
    recommended: false
  },
  {
    slug: "family",
    name: "Rodinny",
    priceCents: 699,
    currency: "EUR",
    billingInterval: "month",
    monthlySolveLimit: 100,
    features: ["manual-input", "photo-scan", "voice-assistant", "mistake-check", "history"],
    recommended: true
  },
  {
    slug: "premium",
    name: "Premium",
    priceCents: 999,
    currency: "EUR",
    billingInterval: "month",
    monthlySolveLimit: null,
    features: [
      "manual-input",
      "photo-scan",
      "video-analysis",
      "voice-assistant",
      "mistake-check",
      "history"
    ],
    recommended: false
  }
];

export function canStartSolve(plan: PlanDefinition, solvesThisMonth: number) {
  return plan.monthlySolveLimit === null || solvesThisMonth < plan.monthlySolveLimit;
}
