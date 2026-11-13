const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['hr', 'candidate', 'admin'], required: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', default: null },
    emailVerified: { type: Boolean, default: false },
    verificationTokenHash: { type: String, default: null },
    verificationExpires: { type: Date, default: null },
    resetTokenHash: { type: String, default: null },
    resetExpires: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);
