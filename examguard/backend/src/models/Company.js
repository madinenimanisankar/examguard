const mongoose = require('mongoose');
const { Schema } = mongoose;

const companySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    website: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    verifiedAt: { type: Date, default: null },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Company', companySchema);
