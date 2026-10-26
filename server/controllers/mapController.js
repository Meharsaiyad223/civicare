import Report from '../models/Report.js';

export async function getHotspots(_req, res) {
  const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  const reports = await Report.find({ createdAt: { $gte: since }, status: { $in: ['open', 'acknowledged', 'in_progress'] } })
    .select('description category severity status priorityScore priorityBreakdown location cellId address isRecurrence createdAt')
    .lean();
  const features = reports.map((report) => ({
    type: 'Feature',
    geometry: report.location,
    properties: {
      id: String(report._id),
      description: report.description,
      category: report.category,
      severity: report.severity,
      status: report.status,
      priorityScore: report.priorityScore,
      priorityBreakdown: report.priorityBreakdown,
      cellId: report.cellId,
      address: report.address,
      isRecurrence: report.isRecurrence,
      createdAt: report.createdAt,
    },
  }));
  return res.json({ success: true, data: { type: 'FeatureCollection', features, refreshedAt: new Date().toISOString() } });
}
