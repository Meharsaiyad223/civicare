import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  description: { type: String, required: true, trim: true, minlength: 8, maxlength: 2000 },
  photoUrl: { type: String, default: '' },
  category: {
    type: String,
    enum: ['pothole', 'garbage', 'water_leak', 'streetlight_damage', 'other'],
    default: 'other',
    index: true,
  },
  classificationConfidence: { type: Number, min: 0, max: 1, default: 0 },
  severity: { type: Number, min: 1, max: 5, default: 3, required: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point', required: true },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (coordinates) => coordinates.length === 2
          && coordinates[0] >= -180 && coordinates[0] <= 180
          && coordinates[1] >= -90 && coordinates[1] <= 90,
        message: 'Location coordinates must be [longitude, latitude].',
      },
    },
  },
  cellId: { type: String, required: true, index: true },
  address: { type: String, trim: true, maxlength: 240, default: '' },
  nearImportantPlace: {
    type: Boolean,
    default: false,
    index: true,
  },
  importantPlaceType: { type: String, enum: ['school', 'hospital', 'other', ''], default: '' },
  status: {
    type: String,
    enum: ['open', 'acknowledged', 'in_progress', 'repaired', 'closed'],
    default: 'open',
    index: true,
  },
  priorityScore: { type: Number, min: 0, max: 100, default: 0, index: true },
  priorityBreakdown: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  duplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Report', default: null },
  duplicateCandidates: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Report' }],
  isRecurrence: { type: Boolean, default: false, index: true },
  recurrenceOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Repair', default: null },
  repairedAt: { type: Date, default: null },
  isSeedData: { type: Boolean, default: false, select: false },
}, { timestamps: true, versionKey: false });

reportSchema.index({ location: '2dsphere' });
reportSchema.index({ createdAt: -1, category: 1, status: 1 });
reportSchema.index({ cellId: 1, createdAt: -1 });

export default mongoose.model('Report', reportSchema);
