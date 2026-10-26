import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema({
  cellId: { type: String, required: true, unique: true, index: true },
  center: {
    type: { type: String, enum: ['Point'], default: 'Point', required: true },
    coordinates: { type: [Number], required: true },
  },
  issueHistory: [{
    report: { type: mongoose.Schema.Types.ObjectId, ref: 'Report' },
    category: { type: String },
    severity: { type: Number },
    occurredAt: { type: Date },
  }],
  repairHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Repair' }],
  recurrenceCount: { type: Number, min: 0, default: 0 },
  seasonalPatterns: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  riskWeight: { type: Number, min: 0.5, max: 2, default: 1 },
  outcomes: {
    held: { type: Number, min: 0, default: 0 },
    failed: { type: Number, min: 0, default: 0 },
  },
  reportCount: { type: Number, min: 0, default: 0 },
  memorySummary: { type: String, default: '' },
  lastReportedAt: { type: Date, default: null },
  lastRepairedAt: { type: Date, default: null },
  isSeedData: { type: Boolean, default: false, select: false },
}, { timestamps: true, versionKey: false });

locationSchema.index({ center: '2dsphere' });

export default mongoose.model('Location', locationSchema);
