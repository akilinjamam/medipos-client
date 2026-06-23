/**
 * Client mirror of the server `PLAN_FEATURES` map (medipos-server
 * `src/config/planFeatures.ts`). The server is the source of truth and enforces
 * gating; this copy lets the POS decide which UI/offline paths to enable
 * (e.g. offline billing is Gold+). Keep the two in sync.
 */
export type Plan = 'silver' | 'gold' | 'platinum';

export interface PlanFeatures {
  branches: number;
  offlineMode: boolean;
  smsAlerts: boolean;
  apiAccess: boolean;
  whiteLabeling: boolean;
  prescriptionHistory: boolean;
}

export const PLAN_FEATURES: Record<Plan, PlanFeatures> = {
  silver: {
    branches: 1,
    offlineMode: false,
    smsAlerts: false,
    apiAccess: false,
    whiteLabeling: false,
    prescriptionHistory: false,
  },
  gold: {
    branches: 5,
    offlineMode: true,
    smsAlerts: true,
    apiAccess: false,
    whiteLabeling: false,
    prescriptionHistory: false,
  },
  platinum: {
    branches: Infinity,
    offlineMode: true,
    smsAlerts: true,
    apiAccess: true,
    whiteLabeling: true,
    prescriptionHistory: true,
  },
};

/** Features for a plan; falls back to the most restrictive (silver) when unknown. */
export function featuresForPlan(plan: Plan | null | undefined): PlanFeatures {
  return PLAN_FEATURES[plan ?? 'silver'] ?? PLAN_FEATURES.silver;
}
