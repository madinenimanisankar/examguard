const mongoose = require('mongoose');
const { Schema } = mongoose;

const loginAttemptSchema = new Schema(
  {
    identifier: { type: String, required: true, unique: true },
    count: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastFailedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LoginAttempt', loginAttemptSchema);
