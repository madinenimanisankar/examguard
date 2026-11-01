/* eslint-disable no-console */
// Idempotent demo seed: platform admin, two companies (one verified, one
// pending, to prove tenant isolation), a published demo exam with questions,
// and a registered demo candidate. Run: npm run seed
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const env = require('../config/env');
const User = require('../models/User');
const Company = require('../models/Company');
const Exam = require('../models/Exam');
const Question = require('../models/Question');
const Invitation = require('../models/Invitation');
const Registration = require('../models/Registration');
const { sha256, randomToken } = require('../utils/helpers');

async function upsertUser({ name, email, password, role, companyId = null, emailVerified = true }) {
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 10), role, companyId, emailVerified });
    console.log(`  + user ${email} (${role})`);
  }
  return user;
}

async function main() {
  await connectDB();

  console.log('Seeding ExamGuard demo data…');

  const admin = await upsertUser({ name: 'Platform Admin', email: env.adminEmail, password: env.adminPassword, role: 'admin' });

  let acme = await Company.findOne({ name: 'Acme Technologies' });
  if (!acme) {
    const hr = await upsertUser({ name: 'Aarti HR', email: 'hr@examguard.test', password: 'Hr@12345', role: 'hr' });
    acme = await Company.create({ name: 'Acme Technologies', website: 'https://acme.example.com', status: 'verified', ownerUserId: hr._id, verifiedAt: new Date(), verifiedBy: admin._id });
    hr.companyId = acme._id;
    await hr.save();
    console.log('  + company Acme Technologies (verified) with HR hr@examguard.test');
  }

  let otherHr = await User.findOne({ email: 'hr2@examguard.test' });
  if (!otherHr) {
    const hr2 = await upsertUser({ name: 'Other HR', email: 'hr2@examguard.test', password: 'Hr@12345', role: 'hr' });
    await Company.create({ name: 'Other Corp', website: '', status: 'pending', ownerUserId: hr2._id });
    hr2.companyId = (await Company.findOne({ name: 'Other Corp' }))._id;
    await hr2.save();
    console.log('  + company Other Corp (pending) with HR hr2@examguard.test — for isolation testing');
  }

  let exam = await Exam.findOne({ companyId: acme._id, title: 'Full Stack Engineer Assessment' });
  if (!exam) {
    const hrUser = await User.findOne({ email: 'hr@examguard.test' });
    const now = Date.now();
    exam = await Exam.create({
      companyId: acme._id,
      createdBy: hrUser._id,
      title: 'Full Stack Engineer Assessment',
      jobRole: 'Full Stack Developer',
      description: 'Hiring assessment covering web fundamentals, aptitude, coding and a written response.',
      instructions: 'Answer all questions. Do not leave the exam tab. The session timer is controlled by the server.',
      startAt: new Date(now - 60 * 60 * 1000),
      endAt: new Date(now + 7 * 24 * 60 * 60 * 1000),
      durationMinutes: 30,
      negativeMarking: { enabled: true, defaultNegative: 1 },
      questionTypes: ['mcq', 'coding', 'descriptive', 'aptitude'],
      sections: [{ name: 'Fundamentals', timeLimitMinutes: 10 }, { name: 'Coding & Writing', timeLimitMinutes: 20 }],
      monitoring: { fullscreenRequired: false, simulatorEnabled: true },
      resultVisibility: 'manual',
      status: 'published',
    });

    const mk = (payload) => ({ ...payload, examId: exam._id });
    await Question.insertMany([
      mk({ type: 'mcq', section: 0, text: 'Which HTTP method is idempotent and is typically used to fetch data?', marks: 5, negativeMarks: 1, options: ['GET', 'POST', 'DELETE', 'PATCH'], correctIndex: 0, order: 0 }),
      mk({ type: 'mcq', section: 0, text: 'In React, which hook manages local component state in a function component?', marks: 5, negativeMarks: 1, options: ['useState', 'useEffect', 'useRef', 'useMemo'], correctIndex: 0, order: 1 }),
      mk({ type: 'aptitude', section: 0, text: 'Complete the series: 2, 6, 12, 20, 30, ?', marks: 5, negativeMarks: 1, options: ['40', '42', '44', '46'], correctIndex: 1, order: 2 }),
      mk({
        type: 'coding', section: 1, text: 'Array Sum', marks: 20,
        problem: {
          statement: 'Read a number N, then N integers separated by spaces on the next line. Print the sum of the integers.',
          inputFormat: 'First line: N. Second line: N space-separated integers.',
          outputFormat: 'A single integer: the sum.',
          constraints: '1 <= N <= 1000, -10000 <= element <= 10000',
          examples: [{ input: '5\n1 2 3 4 5', output: '15' }],
          languages: ['javascript', 'python'],
          timeLimitSeconds: 5,
        },
        testCases: [
          { input: '5\n1 2 3 4 5', output: '15', hidden: true },
          { input: '3\n-1 1 0', output: '0', hidden: true },
        ],
        order: 3,
      }),
      mk({ type: 'descriptive', section: 1, text: 'Explain, in a short paragraph, how you would investigate a suspected memory leak in a production Node.js service.', marks: 10, modelAnswer: 'Look for: heap snapshots comparison, monitoring RSS over time, event listener leaks, unbounded caches.', order: 4 }),
    ]);
    exam.totalMarks = 45;
    await exam.save();
    console.log('  + exam "Full Stack Engineer Assessment" (published, 45 marks)');
  }

  // Demo candidate with an accepted registration.
  const candidate = await upsertUser({ name: 'Demo Candidate', email: 'candidate@examguard.test', password: 'Candidate@123', role: 'candidate' });
  const hasReg = await Registration.findOne({ examId: exam._id, candidateId: candidate._id });
  if (!hasReg) {
    const inv = await Invitation.create({
      examId: exam._id, companyId: acme._id, email: candidate.email, tokenHash: sha256(randomToken()),
      status: 'accepted', expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), acceptedByUserId: candidate._id, timesSent: 1, sentAt: new Date(),
    });
    await Registration.create({ examId: exam._id, companyId: acme._id, candidateId: candidate._id, invitationId: inv._id });
    console.log('  + candidate registered for the demo exam');
  }

  // Pending invitation for a second candidate (for testing the link flow).
  const pendingInv = await Invitation.findOne({ examId: exam._id, email: 'priya.sharma@example.test' });
  if (!pendingInv) {
    await Invitation.create({
      examId: exam._id, companyId: acme._id, email: 'priya.sharma@example.test', tokenHash: sha256(randomToken()),
      status: 'pending', expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), timesSent: 0,
    });
    console.log('  + pending invitation for priya.sharma@example.test');
  }

  console.log('\nDone. Test accounts:');
  console.log(`  Admin:      ${env.adminEmail} / ${env.adminPassword}`);
  console.log('  HR:         hr@examguard.test / Hr@12345');
  console.log('  Candidate:  candidate@examguard.test / Candidate@123');

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
