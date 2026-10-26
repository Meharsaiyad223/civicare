import { createWeeklyReport, getLatestWeeklyReport } from '../services/weeklyReport.js';

export async function generateWeekly(req, res) {
  const report = await createWeeklyReport({ generatedBy: req.user._id });
  return res.status(201).json({ success: true, data: { report } });
}

export async function latestWeekly(_req, res) {
  const report = await getLatestWeeklyReport();
  if (!report) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'No weekly report has been generated yet.' } });
  return res.json({ success: true, data: { report } });
}
