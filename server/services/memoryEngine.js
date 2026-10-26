import Location from '../models/Location.js';
import { distanceMeters } from './duplicates.js';

const METERS_PER_LATITUDE_DEGREE = 110_540;
const METERS_PER_LONGITUDE_DEGREE = 111_320;
const CELL_SIZE_METERS = 100;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function getCellId(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const metersPerLongitude = METERS_PER_LONGITUDE_DEGREE * Math.cos((lat * Math.PI) / 180);
  const row = Math.floor((lat * METERS_PER_LATITUDE_DEGREE) / CELL_SIZE_METERS);
  const column = Math.floor((lng * metersPerLongitude) / CELL_SIZE_METERS);
  return `${row}:${column}`;
}

export function getCellCenter(cellId, latitudeForProjection = 0) {
  const [row, column] = String(cellId).split(':').map(Number);
  const metersPerLongitude = METERS_PER_LONGITUDE_DEGREE * Math.cos((Number(latitudeForProjection) * Math.PI) / 180);
  return {
    type: 'Point',
    coordinates: [((column + 0.5) * CELL_SIZE_METERS) / metersPerLongitude, ((row + 0.5) * CELL_SIZE_METERS) / METERS_PER_LATITUDE_DEGREE],
  };
}

function coordinatesForReport(report) {
  return report?.location?.coordinates || [report?.lng, report?.lat];
}

export function describeMemory(memory) {
  if (!memory) return 'No civic memory has been recorded for this location yet.';
  const issues = memory.issueHistory || [];
  const potholes = issues.filter((issue) => issue.category === 'pothole');
  const repairs = memory.repairHistory || [];
  const recentRepeat = repairs.filter((repair) => repair.outcome === 'reoccurred').length;
  if (!issues.length && !repairs.length) return 'No prior issues or repairs are recorded for this location.';
  const totalYears = issues.length
    ? Math.max(1, Math.ceil((Date.now() - Math.min(...issues.map((item) => new Date(item.occurredAt || item.createdAt || Date.now()).getTime()))) / (365.25 * 24 * 60 * 60 * 1000)))
    : 1;
  const parts = [];
  if (potholes.length) parts.push(`This location has had ${potholes.length} pothole${potholes.length === 1 ? '' : 's'} in ${totalYears} ${totalYears === 1 ? 'year' : 'years'}`);
  if (recentRepeat) parts.push(`${recentRepeat} ${recentRepeat === 1 ? 'recurred' : 'recurred'} within 90 days of repair`);
  if (!parts.length) parts.push(`${issues.length} issues and ${repairs.length} repairs are in its history`);
  return `${parts.join('; ')}.`;
}

export async function getOrCreateMemory(latitude, longitude) {
  const cellId = getCellId(latitude, longitude);
  const center = getCellCenter(cellId, latitude);
  return Location.findOneAndUpdate(
    { cellId },
    { $setOnInsert: { cellId, center } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

export async function recordReportMemory(report) {
  const [longitude, latitude] = coordinatesForReport(report);
  const cellId = report.cellId || getCellId(latitude, longitude);
  const month = new Date(report.createdAt || Date.now()).getMonth() + 1;
  const category = report.category || 'other';
  const historyItem = {
    report: report._id,
    category,
    severity: Number(report.severity) || 3,
    occurredAt: report.createdAt || new Date(),
  };
  const seasonalPath = `seasonalPatterns.${month}.${category}`;
  const center = getCellCenter(cellId, latitude);
  const memory = await Location.findOneAndUpdate(
    { cellId },
    {
      $setOnInsert: { cellId, center },
      $push: { issueHistory: { $each: [historyItem], $slice: -250 } },
      $inc: { reportCount: 1, [seasonalPath]: 1 },
      $set: { lastReportedAt: report.createdAt || new Date() },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  memory.memorySummary = describeMemory(memory);
  await memory.save();
  return memory;
}

/**
 * Learning rule: a repair that holds for 90 days reduces cell risk by 0.05;
 * a recurrence increases risk by 0.10. Bounds [0.5, 2] keep learning gradual.
 */
export async function recordRepairOutcome(cellId, repair, outcome) {
  const memory = await Location.findOne({ cellId });
  if (!memory) return null;
  if (outcome === 'held') {
    memory.outcomes.held += 1;
    memory.riskWeight = clamp(memory.riskWeight - 0.05, 0.5, 2);
  } else if (outcome === 'failed' || outcome === 'reoccurred') {
    memory.outcomes.failed += 1;
    memory.recurrenceCount += 1;
    memory.riskWeight = clamp(memory.riskWeight + 0.1, 0.5, 2);
  }
  if (repair?._id && !memory.repairHistory.some((id) => String(id) === String(repair._id))) {
    memory.repairHistory.push(repair._id);
  }
  if (repair?.repairedAt) memory.lastRepairedAt = repair.repairedAt;
  memory.memorySummary = describeMemory(memory);
  await memory.save();
  return memory;
}

export async function findMemoryForReport(report) {
  const [longitude, latitude] = coordinatesForReport(report);
  const cellId = report.cellId || getCellId(latitude, longitude);
  return Location.findOne({ cellId }).populate({ path: 'repairHistory', options: { sort: { repairedAt: -1 } } });
}

export async function countNearbyRecentReports(report, { days = 90, distanceLimitMeters = 100 } = {}) {
  const Report = (await import('../models/Report.js')).default;
  const [longitude, latitude] = coordinatesForReport(report);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const candidates = await Report.find({
    _id: { $ne: report._id },
    createdAt: { $gte: cutoff },
    location: { $near: { $geometry: { type: 'Point', coordinates: [longitude, latitude] }, $maxDistance: distanceLimitMeters } },
  }).select('_id');
  return candidates.length;
}

export { distanceMeters };
