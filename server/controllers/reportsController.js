import Report from '../models/Report.js';
import Repair from '../models/Repair.js';
import Location from '../models/Location.js';
import WorkOrder from '../models/WorkOrder.js';
import { getAIProvider } from '../services/ai/providerInterface.js';
import { findDuplicates } from '../services/duplicates.js';
import { calculatePriority } from '../services/priority.js';
import { applyRecurrenceOutcome, detectRecurrence } from '../services/recurrence.js';
import { countNearbyRecentReports, findMemoryForReport, getCellId, getOrCreateMemory, recordReportMemory } from '../services/memoryEngine.js';

function parsePoint(body) {
  const latitude = Number(body.lat);
  const longitude = Number(body.lng);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    const error = new Error('Latitude and longitude must be valid coordinates.');
    error.status = 400;
    error.code = 'INVALID_LOCATION';
    throw error;
  }
  return { latitude, longitude };
}

export async function createReport(req, res) {
  const { latitude, longitude } = parsePoint(req.body);
  const description = String(req.body.description || '').trim();
  if (description.length < 8 || description.length > 2000) {
    const error = new Error('Description must contain 8 to 2,000 characters.');
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  if (!req.file) {
    const error = new Error('Choose an issue photo to submit the report.');
    error.status = 400;
    error.code = 'PHOTO_REQUIRED';
    throw error;
  }

  const selectedCategory = ['pothole', 'garbage', 'water_leak', 'streetlight_damage', 'other'].includes(req.body.category) ? req.body.category : '';
  const provider = getAIProvider();
  const classification = selectedCategory
    ? { category: selectedCategory, confidence: 1, provider: 'citizen_selected' }
    : await provider.classifyImage({ buffer: req.file.buffer || await import('node:fs/promises').then(({ readFile }) => readFile(req.file.path)), mimeType: req.file.mimetype, description });
  const severity = Math.min(5, Math.max(1, Number(req.body.severity) || 3));
  const cellId = getCellId(latitude, longitude);
  const memory = await getOrCreateMemory(latitude, longitude);
  const [recentReports, recentRepairs] = await Promise.all([
    countNearbyRecentReports({ location: { type: 'Point', coordinates: [longitude, latitude] } }, { days: 90, distanceLimitMeters: 100 }),
    Repair.find({ cellId, repairedAt: { $lte: new Date(), $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } }).populate('location'),
  ]);
  const report = new Report({
    reporter: req.user._id,
    description,
    photoUrl: `/uploads/${req.file.filename}`,
    category: classification.category,
    classificationConfidence: classification.confidence,
    severity,
    location: { type: 'Point', coordinates: [longitude, latitude] },
    cellId,
    address: String(req.body.address || '').trim().slice(0, 240),
    nearImportantPlace: req.body.nearImportantPlace === 'true' || req.body.nearImportantPlace === true,
    importantPlaceType: ['school', 'hospital', 'other'].includes(req.body.importantPlaceType) ? req.body.importantPlaceType : '',
  });

  const recurrence = detectRecurrence(report, recentRepairs);
  const priority = calculatePriority({
    severity,
    nearImportantPlace: report.nearImportantPlace,
    importantPlaceType: report.importantPlaceType,
    recentReports,
    memory,
  });
  report.priorityScore = priority.score;
  report.priorityBreakdown = priority.breakdown;
  if (recurrence) {
    applyRecurrenceOutcome({ report, repair: recurrence, location: memory });
    await recurrence.save();
    await memory.save();
  }
  await report.save();
  await recordReportMemory(report);

  const candidateReports = await Report.find({
    _id: { $ne: report._id },
    createdAt: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
    location: { $near: { $geometry: report.location, $maxDistance: 50 } },
  }).limit(100).populate('reporter', 'name');
  const duplicates = await findDuplicates(report, candidateReports);
  if (duplicates.length) {
    report.duplicateCandidates = duplicates.map(({ report: match }) => match._id);
    report.duplicateOf = duplicates[0].report._id;
    await report.save();
  }
  return res.status(201).json({
    success: true,
    data: {
      report,
      classification: { category: classification.category, confidence: classification.confidence, provider: classification.provider },
      duplicateCandidates: duplicates,
      recurrence: Boolean(recurrence),
    },
  });
}

export async function listReports(req, res) {
  const filter = {};
  if (req.query.category) filter.category = req.query.category;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
  }
  if (req.query.location) filter.cellId = String(req.query.location);
  if (req.user.role === 'citizen' && req.query.mine === 'true') filter.reporter = req.user._id;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const [reports, total] = await Promise.all([
    Report.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('reporter', 'name'),
    Report.countDocuments(filter),
  ]);
  if (req.user.role === 'citizen' && req.query.mine === 'true' && reports.length) {
    const workOrders = await WorkOrder.find({ report: { $in: reports.map((report) => report._id) } })
      .sort({ updatedAt: -1 })
      .select('report contractor assignedBy status dueDate completionNotes completionSubmittedAt verifiedAt createdAt updatedAt')
      .populate('contractor', 'name')
      .populate('assignedBy', 'name');
    const latestWorkOrderByReport = new Map();
    for (const order of workOrders) {
      const reportId = String(order.report);
      if (!latestWorkOrderByReport.has(reportId)) latestWorkOrderByReport.set(reportId, order.toObject());
    }
    const reportsWithProgress = reports.map((report) => ({
      ...report.toObject(),
      workOrder: latestWorkOrderByReport.get(String(report._id)) || null,
    }));
    return res.json({ success: true, data: { reports: reportsWithProgress, pagination: { page, limit, total, pages: Math.ceil(total / limit) } } });
  }
  return res.json({ success: true, data: { reports, pagination: { page, limit, total, pages: Math.ceil(total / limit) } } });
}

export async function getReport(req, res) {
  const report = await Report.findById(req.params.id)
    .populate('reporter', 'name')
    .populate({ path: 'duplicateCandidates', select: 'description category status createdAt location priorityScore reporter', populate: { path: 'reporter', select: 'name' } })
    .populate({ path: 'duplicateOf', select: 'description category status createdAt location priorityScore' });
  if (!report) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Report not found.' } });
  const [memory, duplicates] = await Promise.all([
    findMemoryForReport(report),
    findDuplicates(report, await Report.find({ cellId: report.cellId, _id: { $ne: report._id }, createdAt: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } }).populate('reporter', 'name')),
  ]);
  return res.json({ success: true, data: { report, priority: { score: report.priorityScore, breakdown: report.priorityBreakdown }, duplicates, memory } });
}

export async function updateReportStatus(req, res) {
  const { status } = req.body;
  if (!['open', 'acknowledged', 'in_progress', 'repaired', 'closed'].includes(status)) {
    const error = new Error('Choose a valid report status.');
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  const report = await Report.findById(req.params.id);
  if (!report) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Report not found.' } });
  report.status = status;
  let repair = null;
  if (status === 'repaired') {
    report.repairedAt = new Date();
    const existing = await Repair.exists({ cellId: report.cellId, reports: report._id, outcome: { $in: ['pending', 'held'] } });
    if (!existing) {
      const location = await Location.findOne({ cellId: report.cellId });
      if (location) {
        repair = await Repair.create({
          location: location._id,
          cellId: report.cellId,
          reports: [report._id],
          contractor: String(req.body.contractor || 'Municipal field crew').trim().slice(0, 120),
          repairedAt: report.repairedAt,
          outcome: 'pending',
          createdBy: req.user._id,
        });
        location.repairHistory.push(repair._id);
        location.lastRepairedAt = repair.repairedAt;
        await location.save();
      }
    }
  }
  await report.save();
  return res.json({ success: true, data: { report, repair } });
}
