import Location from '../models/Location.js';

export async function getMemory(req, res) {
  const memory = await Location.findOne({ cellId: req.params.cellId }).populate({ path: 'issueHistory.report', select: 'category description severity status createdAt' }).populate({ path: 'repairHistory', options: { sort: { repairedAt: -1 } } });
  if (!memory) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'No civic memory exists for this geo-cell yet.' } });
  return res.json({ success: true, data: { memory } });
}
