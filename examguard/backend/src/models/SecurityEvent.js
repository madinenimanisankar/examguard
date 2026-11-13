const mongoose = require('mongoose');
const { Schema } = mongoose;

const securityEventSchema = new Schema(
  {
    examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'ExamSession', required: true, index: true },
    candidateId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true },
    source: { type: String, enum: ['browser', 'simulation'], required: true },
    occurredAt: { type: Date, required: true },
    meta: { type: Schema.Types.Mixed, default: {} },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

securityEventSchema.index({ sessionId: 1, occurredAt: -1 });

module.exports = mongoose.model('SecurityEvent', securityEventSchema);
