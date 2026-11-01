const mongoose = require('mongoose');
const { Schema } = mongoose;

const sessionSchema = new Schema(
  {
    examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    candidateId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    registrationId: { type: Schema.Types.ObjectId, ref: 'Registration', required: true },
    startedAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    status: { type: String, enum: ['active', 'submitted', 'expired'], default: 'active' },
    submittedAt: { type: Date, default: null },
    lastActivityAt: { type: Date, default: null },
    riskScore: { type: Number, default: 0 },
    alertsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

sessionSchema.index({ examId: 1, candidateId: 1 }, { unique: true });

module.exports = mongoose.model('ExamSession', sessionSchema);
