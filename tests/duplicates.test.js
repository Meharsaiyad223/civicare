import { describe, expect, it } from 'vitest';
import { distanceMeters, findDuplicates } from '../server/services/duplicates.js';

const reportAt = (longitude, latitude, reporter, createdAt, description = 'Large pothole beside the bus stop') => ({
  reporter,
  description,
  createdAt: new Date(createdAt),
  location: { type: 'Point', coordinates: [longitude, latitude] },
});

describe('duplicate detection', () => {
  const now = new Date('2026-10-21T12:00:00.000Z');
  const origin = reportAt(-89.65, 39.8, 'citizen-a', now, 'Large pothole beside the bus stop');

  it('matches a similar report from another citizen within 50 m and 14 days', async () => {
    const nearby = reportAt(-89.6498, 39.8001, 'citizen-b', new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), 'Large pothole beside the bus stop');
    const matches = await findDuplicates(origin, [nearby], { now });

    expect(distanceMeters(origin, nearby)).toBeLessThan(50);
    expect(matches).toHaveLength(1);
    expect(matches[0].similarity).toBeGreaterThan(0.2);
  });

  it('ignores reports by the same citizen, farther than 50 m, or older than 14 days', async () => {
    const sameCitizen = reportAt(-89.65, 39.8, 'citizen-a', new Date(now.getTime() - 1_000));
    const farAway = reportAt(-89.648, 39.8, 'citizen-b', new Date(now.getTime() - 1_000));
    const tooOld = reportAt(-89.65, 39.8, 'citizen-c', new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000));
    const matches = await findDuplicates(origin, [sameCitizen, farAway, tooOld], { now });

    expect(matches).toHaveLength(0);
  });

  it('uses text similarity to reject a nearby but unrelated issue', async () => {
    const unrelated = reportAt(-89.6499, 39.8001, 'citizen-d', new Date(now.getTime() - 1_000), 'Overflowing garbage bins at the market entrance');
    const matches = await findDuplicates(origin, [unrelated], { now });
    expect(matches).toHaveLength(0);
  });
});
