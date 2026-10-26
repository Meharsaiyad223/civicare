import mongoose from 'mongoose';
import Location from '../models/Location.js';
import Repair from '../models/Repair.js';
import Report from '../models/Report.js';
import User from '../models/User.js';
import WorkOrder from '../models/WorkOrder.js';

const reportDetails = {
  path: 'report',
  select: 'reporter description photoUrl category severity status priorityScore address location cellId createdAt nearImportantPlace importantPlaceType',
  populate: { path: 'reporter', select: 'name' },
};

function httpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export async function listContractors(_req, res) {
  const contractors = await User.find({ role: 'contractor', isActive: true }).select('name email').sort({ name: 1 });
  return res.json({ success: true, data: { contractors } });
}

export async function listWorkOrders(req, res) {
  const filter = req.user.role === 'contractor' ? { contractor: req.user._id } : {};
  const workOrders = await WorkOrder.find(filter)
    .sort({ updatedAt: -1 })
    .limit(100)
    .populate(reportDetails)
    .populate('contractor', 'name email')
    .populate('assignedBy', 'name email');
  return res.json({ success: true, data: { workOrders } });
}

export async function assignWorkOrder(req, res) {
  const { reportId, contractorId, instructions, dueDate } = req.body;
  const [report, contractor] = await Promise.all([
    Report.findById(reportId),
    User.findOne({ _id: contractorId, role: 'contractor', isActive: true }),
  ]);
  if (!report) throw httpError(404, 'REPORT_NOT_FOUND', 'That report could not be found.');
  if (!contractor) throw httpError(404, 'CONTRACTOR_NOT_FOUND', 'Choose an active contractor account.');
  if (['repaired', 'closed'].includes(report.status)) throw httpError(409, 'REPORT_ALREADY_CLOSED', 'This report is already marked complete.');
  const activeOrder = await WorkOrder.findOne({ report: report._id, status: { $in: ['assigned', 'completion_submitted'] } });
  if (activeOrder) throw httpError(409, 'WORK_ORDER_EXISTS', 'This report already has an active contractor work order.');

  const workOrder = await WorkOrder.create({
    report: report._id,
    contractor: contractor._id,
    assignedBy: req.user._id,
    instructions: instructions.trim(),
    dueDate: dueDate || null,
  });
  report.status = 'in_progress';
  await report.save();
  const populated = await WorkOrder.findById(workOrder._id)
    .populate(reportDetails)
    .populate('contractor', 'name email')
    .populate('assignedBy', 'name email');
  return res.status(201).json({ success: true, data: { workOrder: populated } });
}

export async function submitWorkOrderCompletion(req, res) {
  const workOrder = await WorkOrder.findOne({ _id: req.params.id, contractor: req.user._id });
  if (!workOrder) throw httpError(404, 'WORK_ORDER_NOT_FOUND', 'That assignment is not in your work queue.');
  if (workOrder.status !== 'assigned') throw httpError(409, 'WORK_ORDER_NOT_ASSIGNABLE', 'This assignment is already awaiting review or verified.');
  workOrder.status = 'completion_submitted';
  workOrder.completionNotes = req.body.notes.trim();
  workOrder.completionSubmittedAt = new Date();
  await workOrder.save();
  const populated = await WorkOrder.findById(workOrder._id)
    .populate(reportDetails)
    .populate('contractor', 'name email')
    .populate('assignedBy', 'name email');
  return res.json({ success: true, data: { workOrder: populated } });
}

export async function verifyWorkOrderCompletion(req, res) {
  const workOrder = await WorkOrder.findById(req.params.id).populate('contractor', 'name');
  if (!workOrder) throw httpError(404, 'WORK_ORDER_NOT_FOUND', 'That work order could not be found.');
  if (workOrder.status !== 'completion_submitted') throw httpError(409, 'COMPLETION_NOT_SUBMITTED', 'The contractor has not submitted this job for review.');
  const report = await Report.findById(workOrder.report);
  if (!report) throw httpError(404, 'REPORT_NOT_FOUND', 'The linked report could not be found.');
  const location = await Location.findOne({ cellId: report.cellId });
  if (!location) throw httpError(409, 'LOCATION_MEMORY_NOT_FOUND', 'The report location record is missing, so the repair cannot be verified.');

  const repairedAt = workOrder.completionSubmittedAt || new Date();
  const repair = await Repair.create({
    location: location._id,
    cellId: report.cellId,
    reports: [report._id],
    contractor: workOrder.contractor?.name || 'Assigned contractor',
    repairedAt,
    outcome: 'pending',
    notes: workOrder.completionNotes,
    createdBy: req.user._id,
  });
  location.repairHistory.push(repair._id);
  location.lastRepairedAt = repairedAt;
  await location.save();
  report.status = 'repaired';
  report.repairedAt = repairedAt;
  await report.save();
  workOrder.status = 'verified';
  workOrder.verifiedAt = new Date();
  await workOrder.save();
  return res.json({ success: true, data: { workOrder, repair, report } });
}

export function isValidWorkOrderId(id) {
  return mongoose.isValidObjectId(id);
}
