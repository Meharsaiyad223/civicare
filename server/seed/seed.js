import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import User from '../models/User.js';
import Report from '../models/Report.js';
import Location from '../models/Location.js';
import Repair from '../models/Repair.js';
import WeeklyReport from '../models/WeeklyReport.js';
import { calculatePriority } from '../services/priority.js';
import { getCellId, getCellCenter } from '../services/memoryEngine.js';

const RESET = process.argv.includes('--reset');
const PASSWORD = 'password123';
const DAY_MS = 24 * 60 * 60 * 1000;
const categories = ['pothole', 'garbage', 'water_leak', 'streetlight_damage', 'other'];
const categoryDescriptions = {
  pothole: ['Deep pothole is spreading across the right lane', 'Several cars are swerving around a broken patch of road', 'Road surface has a growing hole after the recent rain'],
  garbage: ['Overflowing bins have left bags across the sidewalk', 'Household waste has been dumped beside the bus stop', 'The collection point has not been cleared this week'],
  water_leak: ['Water is running from a cracked pipe into the road', 'A steady leak is forming a large puddle by the curb', 'Water continues to seep from the pavement near the junction'],
  streetlight_damage: ['Streetlight is leaning and the lamp is not working', 'The light pole is damaged and leaves the crossing dark', 'Broken streetlight cover is hanging above the walkway'],
  other: ['A damaged sidewalk tile is creating a trip hazard', 'Road sign has fallen and blocks part of the path', 'Public bench is damaged and needs attention'],
};
const contractors = ['Springfield Roadworks', 'Northside Civic Services', 'BrightWay Utilities', 'GreenPath Maintenance', 'Reliable Street Repair'];
const hotspots = [
  { label: 'Maple Avenue School crossing', latitude: 39.8012, longitude: -89.6484, important: 'school' },
  { label: 'Central Hospital approach', latitude: 39.8074, longitude: -89.6571, important: 'hospital' },
  { label: 'Market Street and 4th', latitude: 39.7950, longitude: -89.6355, important: '' },
  { label: 'Riverside Park entrance', latitude: 39.7884, longitude: -89.6502, important: '' },
  { label: 'Oak Street transit stop', latitude: 39.8121, longitude: -89.6359, important: '' },
  { label: 'Westside Library block', latitude: 39.7990, longitude: -89.6740, important: '' },
  { label: 'Cedar Avenue underpass', latitude: 39.7797, longitude: -89.6413, important: '' },
  { label: 'East District water plant road', latitude: 39.8226, longitude: -89.6184, important: '' },
];

function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function randomItem(random, items) {
  return items[Math.floor(random() * items.length)];
}

async function removePreviousSeedData() {
  const demoUsers = await User.find({ email: /@demo\.civiccare\.local$/ }).select('_id');
  await Promise.all([
    Report.deleteMany({ $or: [{ isSeedData: true }, { reporter: { $in: demoUsers.map((user) => user._id) } }] }),
    Repair.deleteMany({ $or: [{ isSeedData: true }, { createdBy: { $in: demoUsers.map((user) => user._id) } }] }),
    Location.deleteMany({ isSeedData: true }),
    WeeklyReport.deleteMany({ isSeedData: true }),
    User.deleteMany({ email: /@demo\.civiccare\.local$/ }),
  ]);
}

async function resetDatabase() {
  await Promise.all([
    User.deleteMany({}),
    Report.deleteMany({}),
    Location.deleteMany({}),
    Repair.deleteMany({}),
    WeeklyReport.deleteMany({}),
  ]);
}

async function seed() {
  await connectDatabase();
  if (RESET) {
    console.log('Resetting CivicCare collections before generating demo data.');
    await resetDatabase();
  } else {
    await removePreviousSeedData();
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const officerSpecs = [
    ['Avery Morgan', 'avery.officer@demo.civiccare.local'],
    ['Jordan Lee', 'jordan.officer@demo.civiccare.local'],
    ['Casey Patel', 'casey.officer@demo.civiccare.local'],
  ];
  const citizenSpecs = Array.from({ length: 20 }, (_, index) => [`Citizen ${String(index + 1).padStart(2, '0')}`, `citizen${String(index + 1).padStart(2, '0')}@demo.civiccare.local`]);
  const contractorSpecs = [
    ['Springfield Roadworks', 'roadworks.contractor@demo.civiccare.local'],
    ['BrightWay Utilities', 'brightway.contractor@demo.civiccare.local'],
    ['GreenPath Maintenance', 'greenpath.contractor@demo.civiccare.local'],
  ];
  const officers = await User.insertMany(officerSpecs.map(([name, email]) => ({ name, email, passwordHash, role: 'officer', isSeedData: true })));
  const citizens = await User.insertMany(citizenSpecs.map(([name, email]) => ({ name, email, passwordHash, role: 'citizen', isSeedData: true })));
  const contractorAccounts = await User.insertMany(contractorSpecs.map(([name, email]) => ({ name, email, passwordHash, role: 'contractor', isSeedData: true })));

  const random = randomGenerator(20261021);
  const now = new Date();
  const reportDocuments = [];
  const hotspotReportIndices = hotspots.map(() => []);
  for (let index = 0; index < 560; index += 1) {
    const hotspotIndex = index % hotspots.length;
    const hotspot = hotspots[hotspotIndex];
    const category = index < 20 ? 'pothole' : randomItem(random, categories);
    const description = categoryDescriptions[category][(index + Math.floor(random() * 3)) % 3];
    const latitude = index < 10 ? hotspot.latitude : hotspot.latitude + (random() - 0.5) * 0.0012;
    const longitude = index < 10 ? hotspot.longitude : hotspot.longitude + (random() - 0.5) * 0.0012;
    let createdAt = new Date(now.getTime() - Math.floor(random() * 548) * DAY_MS - Math.floor(random() * DAY_MS));
    if (index < 10) createdAt = new Date(now.getTime() - (30 + index) * DAY_MS);
    const severity = 1 + Math.floor(random() * 5);
    const cellId = getCellId(latitude, longitude);
    const nearImportantPlace = Boolean(hotspot.important);
    const priority = calculatePriority({ severity, nearImportantPlace, importantPlaceType: hotspot.important, recentReports: Math.floor(random() * 6), memory: { riskWeight: 1 + random() * 0.5, recurrenceCount: index < 10 ? 1 : 0 } });
    const report = {
      reporter: randomItem(random, citizens)._id,
      description,
      photoUrl: '',
      category,
      classificationConfidence: Number((0.72 + random() * 0.27).toFixed(2)),
      severity,
      location: { type: 'Point', coordinates: [longitude, latitude] },
      cellId,
      address: hotspot.label,
      nearImportantPlace,
      importantPlaceType: hotspot.important,
      status: index % 17 === 0 ? 'in_progress' : index % 11 === 0 ? 'acknowledged' : index % 7 === 0 ? 'repaired' : 'open',
      priorityScore: priority.score,
      priorityBreakdown: priority.breakdown,
      isRecurrence: index < 10,
      isSeedData: true,
      createdAt,
      updatedAt: createdAt,
    };
    reportDocuments.push(report);
    hotspotReportIndices[hotspotIndex].push(index);
  }
  const reports = await Report.insertMany(reportDocuments, { ordered: true });

  const hotspotCellIds = hotspotReportIndices.map((indices) => {
    const counts = new Map();
    for (const index of indices) {
      const cellId = reports[index].cellId;
      counts.set(cellId, (counts.get(cellId) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  });
  const repairs = [];
  for (let index = 0; index < 40; index += 1) {
    const hotspotIndex = index % hotspots.length;
    const relatedReports = reports.filter((report) => report.cellId === hotspotCellIds[hotspotIndex]);
    const repairedAt = new Date(now.getTime() - (index < 10 ? 60 + index : 110 + index * 2) * DAY_MS);
    repairs.push({
      location: null,
      cellId: hotspotCellIds[hotspotIndex],
      reports: relatedReports.slice(0, 3).map((report) => report._id),
      contractor: contractors[index % contractors.length],
      repairedAt,
      outcome: index < 10 ? 'reoccurred' : index < 30 ? 'held' : 'pending',
      outcomeCheckedAt: index < 30 ? new Date(repairedAt.getTime() + 90 * DAY_MS) : null,
      notes: index < 10 ? 'A new report followed the repair within 90 days.' : index < 30 ? 'No recurrence observed during the 90-day follow-up.' : 'Follow-up window is still open.',
      qualityPenalty: index < 10 ? 1 : 0,
      createdBy: officers[index % officers.length]._id,
      isSeedData: true,
      createdAt: repairedAt,
      updatedAt: repairedAt,
    });
  }

  const grouped = new Map();
  for (const report of reports) {
    if (!grouped.has(report.cellId)) grouped.set(report.cellId, []);
    grouped.get(report.cellId).push(report);
  }
  const locationDocuments = [];
  for (const [cellId, cellReports] of grouped) {
    const [longitude, latitude] = cellReports[0].location.coordinates;
    const issueHistory = cellReports.map((report) => ({ report: report._id, category: report.category, severity: report.severity, occurredAt: report.createdAt }));
    const seasonalPatterns = {};
    for (const report of cellReports) {
      const month = new Date(report.createdAt).getMonth() + 1;
      seasonalPatterns[month] ||= {};
      seasonalPatterns[month][report.category] = (seasonalPatterns[month][report.category] || 0) + 1;
    }
    const potholes = cellReports.filter((report) => report.category === 'pothole').length;
    const recurrenceCount = cellReports.filter((report) => report.isRecurrence).length;
    const riskWeight = Math.min(2, 1 + recurrenceCount * 0.1);
    const summary = potholes ? `This location has had ${potholes} potholes across the 18-month demo history; ${recurrenceCount} followed a repair within 90 days.` : `${cellReports.length} issues are in the 18-month demo history; ${recurrenceCount} followed a repair within 90 days.`;
    locationDocuments.push({
      cellId,
      center: getCellCenter(cellId, latitude),
      issueHistory,
      repairHistory: [],
      recurrenceCount,
      seasonalPatterns,
      riskWeight,
      outcomes: { held: 0, failed: recurrenceCount },
      reportCount: cellReports.length,
      memorySummary: summary,
      lastReportedAt: cellReports.reduce((latest, report) => report.createdAt > latest ? report.createdAt : latest, new Date(0)),
      isSeedData: true,
    });
  }
  const locations = await Location.insertMany(locationDocuments);
  const locationByCell = new Map(locations.map((location) => [location.cellId, location]));
  for (const repair of repairs) repair.location = locationByCell.get(repair.cellId)._id;
  const repairRecords = await Repair.insertMany(repairs);
  for (const repair of repairRecords) {
    const location = locationByCell.get(repair.cellId);
    location.repairHistory.push(repair._id);
    if (!location.lastRepairedAt || repair.repairedAt > location.lastRepairedAt) location.lastRepairedAt = repair.repairedAt;
    if (repair.outcome === 'held') location.outcomes.held += 1;
    await location.save();
  }

  // Link ten seeded reoccurrences to ten matching repair records for drill-downs.
  for (let index = 0; index < 10; index += 1) {
    const report = reports[index];
    const matchingRepair = repairRecords.find((repair) => repair.cellId === report.cellId && repair.outcome === 'reoccurred');
    if (matchingRepair) {
      report.recurrenceOf = matchingRepair._id;
      await report.save();
    }
  }
  console.log(`Seeded ${officers.length} officers, ${citizens.length} citizens, ${contractorAccounts.length} contractors, ${reports.length} reports, ${repairRecords.length} repairs, and ${locations.length} civic memory cells.`);
  console.log(`Demo login password for all accounts: ${PASSWORD}`);
  console.log('Officer accounts: avery.officer@demo.civiccare.local, jordan.officer@demo.civiccare.local, casey.officer@demo.civiccare.local');
  console.log('Contractor accounts: roadworks.contractor@demo.civiccare.local, brightway.contractor@demo.civiccare.local, greenpath.contractor@demo.civiccare.local');
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exitCode = 1;
}).finally(async () => {
  if (mongoose.connection.readyState !== 0) await disconnectDatabase();
});
