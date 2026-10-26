import mongoose from 'mongoose';

const weeklyReportSchema = new mongoose.Schema({
  periodStart: { type: Date, required: true, index: true },
  periodEnd: { type: Date, required: true },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  statistics: { type: mongoose.Schema.Types.Mixed, required: true, default: () => ({}) },
  narrative: { type: String, required: true },
  aiProvider: { type: String, enum: ['mock', 'openai', 'gemini', 'openrouter'], default: 'mock' },
  recommendations: [{ type: String }],
  isSeedData: { type: Boolean, default: false, select: false },
}, { timestamps: true, versionKey: false });

weeklyReportSchema.index({ periodStart: -1, periodEnd: -1 });

export default mongoose.model('WeeklyReport', weeklyReportSchema);
