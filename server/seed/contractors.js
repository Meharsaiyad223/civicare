import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import User from '../models/User.js';
import Report from '../models/Report.js';
import Location from '../models/Location.js';
import Repair from '../models/Repair.js';
import WeeklyReport from '../models/WeeklyReport.js';
import WorkOrder from '../models/WorkOrder.js';
import { calculatePriority } from '../services/priority.js';
import { getCellId, getCellCenter } from '../services/memoryEngine.js';

const password = 'password123';
const accounts = [
  ['Springfield Roadworks', 'roadworks.contractor@demo.civiccare.local'],
  ['BrightWay Utilities', 'brightway.contractor@demo.civiccare.local'],
  ['GreenPath Maintenance', 'greenpath.contractor@demo.civiccare.local'],
];
const jobTemplates = [
  { category: 'pothole', severity: 4, description: 'repair a large pothole near the school crossing', address: 'Maple Avenue School crossing', coordinates: [-89.6484, 39.8012], importantPlaceType: 'school', instructions: 'Cone off the damaged lane, fill and compact the pothole, then send a completion note.' },
  { category: 'pothole', severity: 3, description: 'broken pavement is spreading near the Market Street intersection', address: 'Market Street and 4th', coordinates: [-89.6355, 39.7950], instructions: 'Inspect the pavement, repair the damaged section, and note any traffic control used.' },
  { category: 'other', severity: 2, description: 'a raised sidewalk slab is creating a trip hazard by the park', address: 'Riverside Park entrance', coordinates: [-89.6502, 39.7884], instructions: 'Level or replace the raised slab and confirm the pedestrian route is clear.' },
  { category: 'pothole', severity: 5, description: 'a deep road hole is affecting both lanes near the underpass', address: 'Cedar Avenue underpass', coordinates: [-89.6413, 39.7797], instructions: 'Secure the area promptly, repair the road surface, and submit a completion note.' },
  { category: 'water_leak', severity: 4, description: 'water is leaking from a cracked curbside pipe near the hospital', address: 'Central Hospital approach', coordinates: [-89.6571, 39.8074], importantPlaceType: 'hospital', instructions: 'Inspect the curbside pipe, stop the leak, and confirm the walkway is safe.' },
  { category: 'water_leak', severity: 3, description: 'water continues to seep from pavement near the water plant', address: 'East District water plant road', coordinates: [-89.6184, 39.8226], instructions: 'Trace the source of the leak, repair the pipe, and record any follow-up required.' },
  { category: 'streetlight_damage', severity: 3, description: 'a streetlight is out beside the transit stop', address: 'Oak Street transit stop', coordinates: [-89.6359, 39.8121], instructions: 'Inspect the streetlight, restore lighting or secure the area, and report the repair.' },
  { category: 'streetlight_damage', severity: 4, description: 'damaged wiring has left the library block without street lighting', address: 'Westside Library block', coordinates: [-89.6740, 39.7990], instructions: 'Make the electrical area safe, restore the light, and include the work performed in your note.' },
  { category: 'garbage', severity: 3, description: 'overflowing bins have left bags across a sidewalk near a bus stop', address: 'Oak Street transit stop', coordinates: [-89.6365, 39.8116], instructions: 'Clear the litter, empty the public bins, and confirm the sidewalk is passable.' },
  { category: 'garbage', severity: 2, description: 'household waste has been left beside the park entrance', address: 'Riverside Park entrance', coordinates: [-89.6510, 39.7890], instructions: 'Remove the dumped waste and check nearby bins for overflow.' },
  { category: 'other', severity: 3, description: 'a public bench is damaged and needs attention by the library', address: 'Westside Library block', coordinates: [-89.6734, 39.7995], instructions: 'Repair or replace the unsafe bench and leave the area clean for visitors.' },
  { category: 'garbage', severity: 4, description: 'a collection point has not been cleared beside the shops', address: 'Market Street and 4th', coordinates: [-89.6348, 39.7945], instructions: 'Clear the collection point, remove loose waste, and report any repeated dumping.' },
];
const demoJobs = Array.from({ length: 100 }, (_, index) => {
  const template = jobTemplates[index % jobTemplates.length];
  const zone = String(index + 1).padStart(3, '0');
  const longitudeOffset = ((index % 10) - 4.5) * 0.0008;
  const latitudeOffset = (Math.floor(index / 10) - 4.5) * 0.0008;
  return {
    ...template,
    contractorIndex: index % accounts.length,
    description: `Demo complaint ${zone}: ${template.description}.`,
    address: `${template.address} · Demo zone ${zone}`,
    coordinates: [template.coordinates[0] + longitudeOffset, template.coordinates[1] + latitudeOffset],
  };
});

async function seedContractors() {
  await connectDatabase();
  const passwordHash = await bcrypt.hash(password, 12);
  const contractors = [];
  for (const [name, email] of accounts) {
    const existing = await User.findOne({ email });
    if (existing) {
      if (existing.role !== 'contractor') throw new Error(`${email} already belongs to a non-contractor account.`);
      console.log(`Contractor account already exists: ${email}`);
      contractors.push(existing);
      continue;
    }
    const contractor = await User.create({ name, email, passwordHash, role: 'contractor', isSeedData: true });
    contractors.push(contractor);
    console.log(`Created contractor account: ${email}`);
  }
  const officer = await User.findOne({ email: 'avery.officer@demo.civiccare.local', role: 'officer' });
  const citizen = await User.findOne({ email: 'citizen01@demo.civiccare.local', role: 'citizen' });
  if (!officer || !citizen) {
    throw new Error('Demo officer/citizen accounts are missing. Run the main demo seed first, then run npm run seed:contractors again.');
  }

  // Replace old demo reports and work assigned to these contractor accounts.
  // Real citizen accounts are retained; their non-seed reports stay in place
  // unless they were part of work explicitly assigned to these demo contractors.
  const contractorIds = contractors.map((contractor) => contractor._id);
  const oldOrders = await WorkOrder.find({
    $or: [
      { isSeedData: true },
      { contractor: { $in: contractorIds } },
    ],
  }).select('report');
  const reportIdsFromOldOrders = oldOrders.map((order) => order.report).filter(Boolean);
  const demoCitizens = await User.find({ role: 'citizen', email: /@demo\.civiccare\.local$/ }).select('_id');
  const demoCitizenIds = demoCitizens.map((demoCitizen) => demoCitizen._id);
  const oldDemoReports = await Report.find({
    $or: [
      { isSeedData: true },
      { reporter: { $in: demoCitizenIds } },
    ],
  }).select('_id');
  const reportIdsToDelete = [...new Set([
    ...oldDemoReports.map((report) => String(report._id)),
    ...reportIdsFromOldOrders.map((id) => String(id)),
  ])].map((id) => new mongoose.Types.ObjectId(id));
  const orderFilter = { $or: [
    { isSeedData: true },
    { contractor: { $in: contractorIds } },
    { report: { $in: reportIdsToDelete } },
  ] };
  const oldRepairs = await Repair.find({
    $or: [
      { isSeedData: true },
      { reports: { $in: reportIdsToDelete } },
    ],
  }).select('_id');
  const repairIdsToDelete = oldRepairs.map((repair) => repair._id);
  const affectedLocations = await Location.find({ isSeedData: true }).select('_id');
  await Promise.all([
    WorkOrder.deleteMany(orderFilter),
    Report.deleteMany({ $or: [{ isSeedData: true }, { _id: { $in: reportIdsToDelete } }] }),
    Repair.deleteMany({ _id: { $in: repairIdsToDelete } }),
    WeeklyReport.deleteMany({ isSeedData: true, generatedBy: officer._id }),
    Location.updateMany(
      { _id: { $in: affectedLocations.map((location) => location._id) } },
      { $pull: {
        issueHistory: { report: { $in: reportIdsToDelete } },
        repairHistory: { $in: repairIdsToDelete },
      } },
    ),
  ]);
  for (const affected of affectedLocations) {
    const location = await Location.findById(affected._id);
    if (!location) continue;
    const [remainingReports, remainingRepairs] = await Promise.all([
      Report.find({ _id: { $in: location.issueHistory.map((issue) => issue.report).filter(Boolean) } }).select('isRecurrence createdAt'),
      Repair.find({ _id: { $in: location.repairHistory } }).select('outcome repairedAt'),
    ]);
    location.reportCount = remainingReports.length;
    location.recurrenceCount = remainingReports.filter((report) => report.isRecurrence).length;
    location.lastReportedAt = remainingReports.reduce((latest, report) => report.createdAt && report.createdAt > latest ? report.createdAt : latest, null);
    location.lastRepairedAt = remainingRepairs.reduce((latest, repair) => repair.repairedAt && repair.repairedAt > latest ? repair.repairedAt : latest, null);
    location.outcomes = {
      held: remainingRepairs.filter((repair) => repair.outcome === 'held').length,
      failed: remainingRepairs.filter((repair) => ['failed', 'reoccurred'].includes(repair.outcome)).length,
    };
    location.memorySummary = remainingReports.length ? `${remainingReports.length} reported issue${remainingReports.length === 1 ? '' : 's'} recorded for this location.` : '';
    if (!remainingReports.length && !remainingRepairs.length) await Location.deleteOne({ _id: location._id });
    else await location.save();
  }

  for (const [index, job] of demoJobs.entries()) {
    const [longitude, latitude] = job.coordinates;
    const cellId = getCellId(latitude, longitude);
    // Demo tasks start as assigned. A citizen sees completion only after the
    // contractor submits completion for this specific work order.
    const workOrderStatus = 'assigned';
    const completionSubmittedAt = null;
    const importantPlaceType = job.importantPlaceType || '';
    const priority = calculatePriority({
      severity: job.severity,
      nearImportantPlace: Boolean(importantPlaceType),
      importantPlaceType,
      recentReports: 0,
      memory: { riskWeight: 1, recurrenceCount: 0 },
    });
    const report = await Report.create({
      reporter: citizen._id,
      description: job.description,
      category: job.category,
      severity: job.severity,
      location: { type: 'Point', coordinates: job.coordinates },
      cellId,
      address: job.address,
      nearImportantPlace: Boolean(importantPlaceType),
      importantPlaceType,
      status: 'in_progress',
      repairedAt: null,
      priorityScore: priority.score,
      priorityBreakdown: priority.breakdown,
      isSeedData: true,
    });
    const location = await Location.findOneAndUpdate(
      { cellId },
      {
        $setOnInsert: {
          center: getCellCenter(cellId, latitude),
          isSeedData: true,
        },
        $push: {
          issueHistory: { report: report._id, category: job.category, severity: job.severity, occurredAt: report.createdAt },
        },
        $inc: { reportCount: 1 },
        $set: { lastReportedAt: report.createdAt },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    const completionNotes = '';
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3 + (index % 5));
    await WorkOrder.create({
      report: report._id,
      contractor: contractors[job.contractorIndex]._id,
      assignedBy: officer._id,
      instructions: job.instructions,
      dueDate,
      status: workOrderStatus,
      completionNotes,
      completionSubmittedAt,
      verifiedAt: null,
      isSeedData: true,
    });
  }
  console.log(`Created ${demoJobs.length} connected demo complaints, with assignments split across the three contractors.`);
  console.log('Each record links citizen01, officer Avery Morgan, and the assigned contractor.');
  console.log(`Contractor demo password: ${password}`);
}

seedContractors().catch((error) => {
  console.error('Contractor account setup failed:', error.message);
  process.exitCode = 1;
}).finally(async () => {
  if (mongoose.connection.readyState !== 0) await disconnectDatabase();
});
