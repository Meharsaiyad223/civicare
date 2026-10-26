import Report from '../models/Report.js';
import Repair from '../models/Repair.js';
import Location from '../models/Location.js';
import { recordRepairOutcome } from '../services/memoryEngine.js';

export async function getOfficerQueue(req, res) {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const filter = { status: { $in: ['open', 'acknowledged', 'in_progress'] } };
  const [reports, recentReports, total] = await Promise.all([
    Report.find(filter).sort({ priorityScore: -1, createdAt: 1 }).limit(limit).populate('reporter', 'name'),
    Report.find(filter).sort({ createdAt: -1 }).limit(10).populate('reporter', 'name'),
    Report.countDocuments(filter),
  ]);
  return res.json({ success: true, data: { reports, recentReports, total } });
}

export async function createRepair(req, res) {
  const { reportId, cellId, contractor, notes = '' } = req.body;
  if (!contractor || !String(contractor).trim()) {
    const error = new Error('Contractor name is required.');
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  let linkedReports = [];
  let resolvedCellId = cellId;
  if (reportId) {
    const report = await Report.findById(reportId);
    if (!report) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Report not found.' } });
    resolvedCellId = report.cellId;
    linkedReports = await Report.find({ cellId: resolvedCellId, status: { $in: ['open', 'acknowledged', 'in_progress'] } }).select('_id');
  } else if (!cellId) {
    const error = new Error('Provide reportId or cellId to identify the repaired location.');
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  } else {
    linkedReports = await Report.find({ cellId, status: { $in: ['open', 'acknowledged', 'in_progress'] } }).select('_id');
  }
  const location = await Location.findOne({ cellId: resolvedCellId });
  if (!location) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Civic memory location not found.' } });
  const repair = await Repair.create({
    location: location._id,
    cellId: resolvedCellId,
    reports: linkedReports.map((item) => item._id),
    contractor: String(contractor).trim(),
    repairedAt: req.body.repairedAt ? new Date(req.body.repairedAt) : new Date(),
    outcome: 'pending',
    notes: String(notes).trim(),
    createdBy: req.user._id,
  });
  if (linkedReports.length) {
    await Report.updateMany({ _id: { $in: linkedReports.map((item) => item._id) } }, { $set: { status: 'repaired', repairedAt: repair.repairedAt } });
  }
  location.repairHistory.push(repair._id);
  location.lastRepairedAt = repair.repairedAt;
  await location.save();
  return res.status(201).json({ success: true, data: { repair } });
}

export async function getContractorQuality(_req, res) {
  const rows = await Repair.aggregate([
    { $group: { _id: '$contractor', repairs: { $sum: 1 }, recurrences: { $sum: { $cond: [{ $eq: ['$outcome', 'reoccurred'] }, 1, 0] } }, penalty: { $sum: '$qualityPenalty' } } },
    { $sort: { recurrences: -1, repairs: -1 } },
  ]);
  return res.json({ success: true, data: { contractors: rows.map((row) => ({ contractor: row._id, repairs: row.repairs, recurrences: row.recurrences, qualityPenalty: row.penalty })) } });
}

export async function recordHeldRepairs(_req, res) {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const pending = await Repair.find({ outcome: 'pending', repairedAt: { $lte: cutoff } });
  for (const repair of pending) {
    repair.outcome = 'held';
    repair.outcomeCheckedAt = new Date();
    await repair.save();
    await recordRepairOutcome(repair.cellId, repair, 'held');
  }
  return res.json({ success: true, data: { verifiedRepairs: pending.length } });
}
