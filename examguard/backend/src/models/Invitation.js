const mongoose = require('mongoose');
const { Schema } = mongoose;

const invitationSchema = new Schema(
  {
    examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    tokenHash: { type: String, required: true, unique: true },
    status: { type: String, enum: ['pending', 'sent', 'accepted', 'expired', 'revoked'], default: 'pending' },
    expiresAt: { type: Date, required: true },
    sentAt: { type: Date, default: null },
    timesSent: { type: Number, default: 0 },
    emailStatus: { type: String, enum: ['sent', 'failed', null], default: null },
    emailError: { type: String, default: '' },
    emailAttemptAt: { type: Date, default: null },
    acceptedByUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

invitationSchema.index({ examId: 1, email: 1 });

module.exports = mongoose.model('Invitation', invitationSchema);
