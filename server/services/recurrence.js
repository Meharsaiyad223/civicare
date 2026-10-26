import { distanceMeters } from './duplicates.js';

/**
 * A new report is a recurrence when it follows a repair at the same spot, is
 * within 50 m, and arrives no later than 90 days after that repair.
 */
export function detectRecurrence(report, repairs, {
  now = new Date(),
  distanceLimitMeters = 50,
  windowDays = 90,
} = {}) {
  const reportTime = new Date(report.createdAt || now).getTime();
  const maxAge = windowDays * 24 * 60 * 60 * 1000;
  return (repairs || []).filter((repair) => {
    if (!repair || !repair.repairedAt || repair.outcome === 'reoccurred') return false;
    const repairedTime = new Date(repair.repairedAt).getTime();
    const elapsed = reportTime - repairedTime;
    return elapsed >= 0 && elapsed <= maxAge && distanceMeters(report, repair) <= distanceLimitMeters;
  }).sort((a, b) => new Date(b.repairedAt) - new Date(a.repairedAt))[0] || null;
}

/** Update plain objects in place so callers can persist the outcome atomically. */
export function applyRecurrenceOutcome({ report, repair, location }) {
  if (!report || !repair) return { report, repair, location };
  report.isRecurrence = true;
  report.recurrenceOf = repair._id || repair.id || null;
  repair.outcome = 'reoccurred';
  repair.outcomeCheckedAt = new Date(report.createdAt || Date.now());
  repair.qualityPenalty = (Number(repair.qualityPenalty) || 0) + 1;
  if (location) {
    location.recurrenceCount = (Number(location.recurrenceCount) || 0) + 1;
    location.outcomes ||= { held: 0, failed: 0 };
    location.outcomes.failed = (Number(location.outcomes.failed) || 0) + 1;
    location.riskWeight = Math.min(2, (Number(location.riskWeight) || 1) + 0.1);
  }
  return { report, repair, location };
}

export default detectRecurrence;
