import Report from '../models/Report.js';
import Repair from '../models/Repair.js';
import WeeklyReport from '../models/WeeklyReport.js';
import { getAIProvider } from './ai/providerInterface.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function aggregateWeeklyStats({ now = new Date() } = {}) {
  const periodEnd = new Date(now);
  const periodStart = new Date(periodEnd.getTime() - 7 * DAY_MS);
  const previousStart = new Date(periodStart.getTime() - 7 * DAY_MS);
  const [currentReports, previousCount, categoryGroups, hotspotGroups, totalRepairs, recurredRepairs] = await Promise.all([
    Report.find({ createdAt: { $gte: periodStart, $lt: periodEnd } }).select('category cellId address isRecurrence priorityScore severity'),
    Report.countDocuments({ createdAt: { $gte: previousStart, $lt: periodStart } }),
    Report.aggregate([
      { $match: { createdAt: { $gte: periodStart, $lt: periodEnd } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Report.aggregate([
      { $match: { createdAt: { $gte: periodStart, $lt: periodEnd } } },
      { $group: { _id: '$cellId', reportCount: { $sum: 1 }, averagePriority: { $avg: '$priorityScore' }, label: { $first: '$address' } } },
      { $sort: { reportCount: -1, averagePriority: -1 } },
      { $limit: 5 },
    ]),
    Repair.countDocuments({ repairedAt: { $gte: periodStart, $lt: periodEnd } }),
    Repair.countDocuments({ repairedAt: { $gte: periodStart, $lt: periodEnd }, outcome: 'reoccurred' }),
  ]);
  const totalReports = currentReports.length;
  const recurrenceCount = currentReports.filter((report) => report.isRecurrence).length;
  const weekOverWeekChange = previousCount === 0
    ? (totalReports ? 100 : 0)
    : Math.round(((totalReports - previousCount) / previousCount) * 100);
  return {
    periodStart,
    periodEnd,
    totalReports,
    previousWeekReports: previousCount,
    weekOverWeekChange,
    categoryCounts: Object.fromEntries(categoryGroups.map(({ _id, count }) => [_id || 'other', count])),
    topHotspots: hotspotGroups.map((group) => ({ cellId: group._id, reportCount: group.reportCount, averagePriority: Math.round(group.averagePriority || 0), label: group.label || group._id })),
    recurrenceCount,
    recurrenceRate: totalReports ? (recurrenceCount / totalReports) * 100 : 0,
    repairsCompleted: totalRepairs,
    repairRecurrences: recurredRepairs,
    recommendedActions: [],
  };
}

function recommendationsFromStats(stats) {
  const actions = [];
  const topHotspot = stats.topHotspots?.[0];
  if (topHotspot) actions.push(`Inspect ${topHotspot.label} first; it has ${topHotspot.reportCount} reports this week.`);
  const mostReportedCategory = Object.entries(stats.categoryCounts || {}).sort((a, b) => b[1] - a[1])[0];
  if (mostReportedCategory) actions.push(`Check crew and materials for ${mostReportedCategory[0].replaceAll('_', ' ')} issues, the most reported category.`);
  if (stats.recurrenceRate > 10) actions.push('Audit recently repaired locations and review contractor follow-up for repeat failures.');
  if (!actions.length) actions.push('Continue monitoring the map and close out reports with verified field updates.');
  return actions;
}

export async function createWeeklyReport({ generatedBy, now = new Date() }) {
  const statistics = await aggregateWeeklyStats({ now });
  const recommendations = recommendationsFromStats(statistics);
  statistics.recommendedActions = recommendations;
  const provider = getAIProvider();
  const narrative = await provider.writeWeeklyNarrative(statistics);
  return WeeklyReport.create({
    periodStart: statistics.periodStart,
    periodEnd: statistics.periodEnd,
    generatedBy,
    statistics,
    narrative,
    aiProvider: provider.name,
    recommendations,
  });
}

export async function getLatestWeeklyReport() {
  return WeeklyReport.findOne().sort({ periodEnd: -1, createdAt: -1 }).populate('generatedBy', 'name email role');
}

export { recommendationsFromStats };
