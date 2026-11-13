const mongoose = require('mongoose');
const { Schema } = mongoose;

const QUESTION_TYPES = ['mcq', 'coding', 'descriptive', 'aptitude'];

const weightsSchema = new Schema(
  {
    tab_hidden: { type: Number, default: 10, min: 0, max: 100 },
    window_blur: { type: Number, default: 8, min: 0, max: 100 },
    fullscreen_exit: { type: Number, default: 20, min: 0, max: 100 },
    copy_attempt: { type: Number, default: 5, min: 0, max: 100 },
    paste_attempt: { type: Number, default: 5, min: 0, max: 100 },
    prohibited_app: { type: Number, default: 70, min: 0, max: 100 },
    remote_desktop: { type: Number, default: 80, min: 0, max: 100 },
    screen_share: { type: Number, default: 60, min: 0, max: 100 },
  },
  { _id: false }
);

const examSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    jobRole: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    instructions: { type: String, default: '', trim: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    durationMinutes: { type: Number, required: true, min: 5, max: 600 },
    totalMarks: { type: Number, default: 0 },
    negativeMarking: {
      enabled: { type: Boolean, default: false },
      defaultNegative: { type: Number, default: 0, min: 0 },
    },
    questionTypes: {
      type: [{ type: String, enum: QUESTION_TYPES }],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'Select at least one question type (MCQ, Coding, Descriptive or Aptitude).',
      },
    },
    sections: { type: [{ name: String, timeLimitMinutes: Number }], default: [] },
    monitoring: {
      fullscreenRequired: { type: Boolean, default: false },
      simulatorEnabled: { type: Boolean, default: true },
      weights: { type: weightsSchema, default: () => ({}) },
      thresholds: {
        type: { medium: { type: Number, default: 40 }, high: { type: Number, default: 70 }, critical: { type: Number, default: 90 } },
        default: () => ({}),
      },
      prohibitedList: { type: [String], default: ['anydesk', 'teamviewer', 'remote desktop', 'vnc', 'ammyy', 'ultraviewer'] },
    },
    resultVisibility: { type: String, enum: ['manual', 'immediate', 'after_end'], default: 'manual' },
    resultsReleased: { type: Boolean, default: false },
    status: { type: String, enum: ['draft', 'published', 'closed'], default: 'draft', index: true },
  },
  { timestamps: true }
);

examSchema.index({ companyId: 1, status: 1 });

module.exports = mongoose.model('Exam', examSchema);
module.exports.QUESTION_TYPES = QUESTION_TYPES;
