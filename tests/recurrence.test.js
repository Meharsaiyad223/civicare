import { describe, expect, it } from 'vitest';
import { applyRecurrenceOutcome, detectRecurrence } from '../server/services/recurrence.js';

const now = new Date('2026-10-21T12:00:00.000Z');
const report = (createdAt, longitude = -89.65, latitude = 39.8) => ({
  _id: 'report-new',
  createdAt: new Date(createdAt),
  location: { type: 'Point', coordinates: [longitude, latitude] },
});
const repair = (repairedAt, longitude = -89.65, latitude = 39.8) => ({
  _id: 'repair-old',
  repairedAt: new Date(repairedAt),
  outcome: 'pending',
  qualityPenalty: 0,
  location: { center: { type: 'Point', coordinates: [longitude, latitude] } },
});

describe('recurrence tracking', () => {
  it('detects a report at the repaired location within 90 days', () => {
    const previousRepair = repair(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
    expect(detectRecurrence(report(now), [previousRepair], { now })).toBe(previousRepair);
  });

  it('ignores reports before the repair, beyond 90 days, or more than 50 m away', () => {
    const previousRepair = repair(new Date(now.getTime() - 91 * 24 * 60 * 60 * 1000));
    const futureRepair = repair(new Date(now.getTime() + 24 * 60 * 60 * 1000));
    const nearbyRepair = repair(new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), -89.648, 39.8);

    expect(detectRecurrence(report(now), [previousRepair, futureRepair, nearbyRepair], { now })).toBeNull();
  });

  it('records a failed outcome and increases the learned cell risk', () => {
    const currentReport = report(now);
    const previousRepair = repair(new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000));
    const memory = { recurrenceCount: 0, riskWeight: 1, outcomes: { held: 0, failed: 0 } };
    const result = applyRecurrenceOutcome({ report: currentReport, repair: previousRepair, location: memory });

    expect(result.report.isRecurrence).toBe(true);
    expect(result.repair.outcome).toBe('reoccurred');
    expect(result.repair.qualityPenalty).toBe(1);
    expect(result.location.recurrenceCount).toBe(1);
    expect(result.location.outcomes.failed).toBe(1);
    expect(result.location.riskWeight).toBeCloseTo(1.1);
  });
});
