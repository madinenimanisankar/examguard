const mongoose = require('mongoose');
const { Schema } = mongoose;

const alertSchema = new Schema(
  {
    examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'ExamSession', required: true, index: true },
    candidateId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, default: 'mixed' },
    riskScore: { type: Number, default: 0 },
    riskLevel: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'low' },
    reasons: { type: [String], default: [] },
    evidence: { type: [{ eventId: Schema.Types.ObjectId, eventType: String, source: String, at: Date, meta: Schema.Types.Mixed }], default: [] },
    status: { type: String, enum: ['new', 'under_review', 'resolved', 'inconclusive'], default: 'new', index: true },
    review: {
      decision: { type: String, default: '' },
      reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      reviewedAt: { type: Date, default: null },
      notes: { type: [{ text: String, by: String, at: Date }], default: [] },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SecurityAlert', alertSchema);
