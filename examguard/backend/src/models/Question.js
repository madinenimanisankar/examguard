const mongoose = require('mongoose');
const { Schema } = mongoose;

const questionSchema = new Schema(
  {
    examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    type: { type: String, enum: ['mcq', 'coding', 'descriptive', 'aptitude'], required: true },
    section: { type: Number, default: 0 },
    text: { type: String, required: true, trim: true },
    marks: { type: Number, required: true, min: 1, max: 100 },
    negativeMarks: { type: Number, default: 0, min: 0 },
    options: { type: [String], default: [] },
    correctIndex: { type: Number, default: null },
    problem: {
      type: new Schema(
        {
          statement: { type: String, default: '' },
          inputFormat: { type: String, default: '' },
          outputFormat: { type: String, default: '' },
          constraints: { type: String, default: '' },
          examples: { type: [{ input: String, output: String }], default: [] },
          languages: { type: [String], default: ['javascript', 'python'] },
          timeLimitSeconds: { type: Number, default: 5, min: 1, max: 15 },
        },
        { _id: false }
      ),
      default: null,
    },
    testCases: { type: [{ input: String, output: String, hidden: { type: Boolean, default: true } }], default: [] },
    modelAnswer: { type: String, default: '' },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Question', questionSchema);
