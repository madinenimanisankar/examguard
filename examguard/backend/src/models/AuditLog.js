const mongoose = require('mongoose');
const { Schema } = mongoose;

const auditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actorEmail: { type: String, default: 'anonymous' },
    actorRole: { type: String, default: 'anonymous' },
    action: { type: String, required: true, index: true },
    targetType: { type: String, default: null },
    targetId: { type: String, default: null },
    meta: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, default: '' },
    at: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
