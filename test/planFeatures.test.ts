import { describe, it, expect } from 'vitest';
import { featuresForPlan, PLAN_FEATURES } from '@/config/planFeatures';

describe('featuresForPlan', () => {
  it('silver has offline/whiteLabeling/prescriptions disabled', () => {
    const f = featuresForPlan('silver');
    expect(f.offlineMode).toBe(false);
    expect(f.whiteLabeling).toBe(false);
    expect(f.prescriptionHistory).toBe(false);
  });

  it('gold enables offline + sms but not whiteLabeling/api', () => {
    const f = featuresForPlan('gold');
    expect(f.offlineMode).toBe(true);
    expect(f.smsAlerts).toBe(true);
    expect(f.whiteLabeling).toBe(false);
    expect(f.apiAccess).toBe(false);
  });

  it('platinum enables everything', () => {
    const f = featuresForPlan('platinum');
    expect(f.apiAccess).toBe(true);
    expect(f.whiteLabeling).toBe(true);
    expect(f.prescriptionHistory).toBe(true);
  });

  it('falls back to silver for null/undefined/unknown', () => {
    expect(featuresForPlan(null)).toEqual(PLAN_FEATURES.silver);
    expect(featuresForPlan(undefined)).toEqual(PLAN_FEATURES.silver);
  });
});
