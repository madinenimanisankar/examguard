const mongoose = require('mongoose');
const { Schema } = mongoose;

const submissionSchema = new Schema(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'ExamSession', required: true, index: true },
    examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    candidateId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
    answer: {
      type: new Schema(
        {
          selected: { type: Number, default: null },
          code: { type: String, default: '' },
          language: { type: String, default: '' },
          text: { type: String, default: '' },
        },
        { _id: false }
      ),
      default: () => ({}),
    },
    status: { type: String, enum: ['saved', 'submitted', 'evaluated', 'pending_review'], default: 'saved' },
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    autoFeedback: { type: String, default: '' },
    evaluatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

submissionSchema.index({ sessionId: 1, questionId: 1 }, { unique: true });

module.exports = mongoose.model('Submission', submissionSchema);
