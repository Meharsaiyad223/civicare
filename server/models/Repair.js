import mongoose from 'mongoose';

const repairSchema = new mongoose.Schema({
  location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true, index: true },
  cellId: { type: String, required: true, index: true },
  reports: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Report' }],
  contractor: { type: String, required: true, trim: true, maxlength: 120 },
  repairedAt: { type: Date, default: Date.now, index: true },
  outcome: { type: String, enum: ['pending', 'held', 'failed', 'reoccurred'], default: 'pending', index: true },
  outcomeCheckedAt: { type: Date, default: null },
  notes: { type: String, trim: true, maxlength: 1000, default: '' },
  qualityPenalty: { type: Number, min: 0, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isSeedData: { type: Boolean, default: false, select: false },
}, { timestamps: true, versionKey: false });

repairSchema.index({ cellId: 1, repairedAt: -1 });

export default mongoose.model('Repair', repairSchema);
