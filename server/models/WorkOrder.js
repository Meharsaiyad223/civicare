import mongoose from 'mongoose';

const workOrderSchema = new mongoose.Schema({
  report: { type: mongoose.Schema.Types.ObjectId, ref: 'Report', required: true, index: true },
  contractor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  instructions: { type: String, required: true, trim: true, minlength: 6, maxlength: 1000 },
  status: { type: String, enum: ['assigned', 'completion_submitted', 'verified'], default: 'assigned', index: true },
  dueDate: { type: Date, default: null },
  completionNotes: { type: String, trim: true, maxlength: 1000, default: '' },
  completionSubmittedAt: { type: Date, default: null },
  verifiedAt: { type: Date, default: null },
  isSeedData: { type: Boolean, default: false, select: false },
}, { timestamps: true, versionKey: false });

workOrderSchema.index({ contractor: 1, status: 1, updatedAt: -1 });

export default mongoose.model('WorkOrder', workOrderSchema);
