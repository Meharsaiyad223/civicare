const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Explainable 0–100 priority score:
 * severity contributes up to 40 points; nearby school/hospital importance up
 * to 20; reports in the previous 90 days up to 20 (4 each); and civic memory
 * up to 20 (bounded learned risk plus repeat-recurrence points).
 */
export function calculatePriority({
  severity = 3,
  nearImportantPlace = false,
  importantPlaceType = '',
  recentReports = 0,
  memory = null,
}) {
  const safeSeverity = clamp(Number(severity) || 1, 1, 5);
  const severityPoints = Math.round(((safeSeverity - 1) / 4) * 40);
  const locationPoints = nearImportantPlace || ['school', 'hospital'].includes(importantPlaceType) ? 20 : 0;
  const historyPoints = Math.min(20, Math.max(0, Number(recentReports) || 0) * 4);
  const riskWeight = clamp(Number(memory?.riskWeight) || 1, 0.5, 2);
  const learnedRiskPoints = clamp(Math.round((riskWeight - 1) * 15), -8, 15);
  const recurrencePoints = Math.min(5, Math.max(0, Number(memory?.recurrenceCount) || 0));
  const memoryPoints = clamp(learnedRiskPoints + recurrencePoints, 0, 20);
  const score = clamp(Math.round(severityPoints + locationPoints + historyPoints + memoryPoints), 0, 100);

  return {
    score,
    breakdown: {
      severity: { points: severityPoints, max: 40, input: safeSeverity, explanation: `Severity ${safeSeverity}/5 contributes ${severityPoints} points.` },
      locationImportance: { points: locationPoints, max: 20, input: importantPlaceType || (nearImportantPlace ? 'important place' : 'none'), explanation: locationPoints ? `Near a ${importantPlaceType || 'flagged important place'} (+20).` : 'No school or hospital proximity is flagged.' },
      recentHistory: { points: historyPoints, max: 20, input: Math.max(0, Number(recentReports) || 0), explanation: `${Math.max(0, Number(recentReports) || 0)} reports in this area in 90 days, up to 20 points.` },
      civicMemory: { points: memoryPoints, max: 20, riskWeight, recurrenceCount: Number(memory?.recurrenceCount) || 0, explanation: `Learned risk weight ${riskWeight.toFixed(2)} and ${Number(memory?.recurrenceCount) || 0} prior recurrences.` },
    },
  };
}

export default calculatePriority;
