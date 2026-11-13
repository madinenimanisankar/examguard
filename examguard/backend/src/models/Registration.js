const mongoose = require('mongoose');
const { Schema } = mongoose;

const registrationSchema = new Schema(
  {
    examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    candidateId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    invitationId: { type: Schema.Types.ObjectId, ref: 'Invitation', required: true },
    status: { type: String, enum: ['accepted'], default: 'accepted' },
  },
  { timestamps: true }
);

registrationSchema.index({ examId: 1, candidateId: 1 }, { unique: true });

module.exports = mongoose.model('Registration', registrationSchema);
