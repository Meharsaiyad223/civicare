import { describe, expect, it } from 'vitest';
import { calculatePriority } from '../server/services/priority.js';

describe('calculatePriority', () => {
  it('shows each factor and rewards severe issues near important places', () => {
    const result = calculatePriority({
      severity: 5,
      nearImportantPlace: true,
      importantPlaceType: 'school',
      recentReports: 6,
      memory: { riskWeight: 2, recurrenceCount: 3 },
    });

    expect(result.score).toBe(98);
    expect(result.breakdown.severity.points).toBe(40);
    expect(result.breakdown.locationImportance.points).toBe(20);
    expect(result.breakdown.recentHistory.points).toBe(20);
    expect(result.breakdown.civicMemory.points).toBe(18);
  });

  it('caps at 100 and floors invalid or out-of-range inputs safely', () => {
    const maximum = calculatePriority({ severity: 100, nearImportantPlace: true, recentReports: 100, memory: { riskWeight: 2, recurrenceCount: 50 } });
    const minimum = calculatePriority({ severity: 0, recentReports: -5, memory: { riskWeight: 0, recurrenceCount: -1 } });

    expect(maximum.score).toBe(100);
    expect(minimum.score).toBe(0);
    expect(minimum.breakdown.severity.input).toBe(1);
  });

  it('gives a location with no added risk a severity-only score', () => {
    const result = calculatePriority({ severity: 3 });
    expect(result.score).toBe(20);
    expect(result.breakdown.civicMemory.points).toBe(0);
  });
});
