// Evaluates candidate answers. MCQ/aptitude are checked directly.
// Coding answers run in a short-lived child process (separate process, temp
// directory, hard timeout, no app credentials in scope). NOTE: this is a basic
// isolation layer for a student project, NOT a hardened sandbox — documented in the README.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const env = require('../config/env');

const SUPPORTED_LANGUAGES = ['javascript', 'python'];

function normalizeOut(s) {
  return String(s == null ? '' : s).replace(/\r/g, '').split('\n').map((l) => l.trimEnd()).join('\n').trim();
}

function runOnce({ language, code, stdin, timeoutMs }) {
  return new Promise((resolve) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'examguard-run-'));
    const ext = language === 'python' ? 'py' : 'js';
    const file = path.join(dir, `solution.${ext}`);
    fs.writeFileSync(file, code);
    const cmd = language === 'python' ? env.pythonCmd : env.nodeCmd;
    let settled = false;
    const finish = (r) => {
      if (settled) return;
      settled = true;
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
      resolve(r);
    };
    const child = spawn(cmd, [file], {
      cwd: dir,
      env: { PATH: process.env.PATH },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
    }, timeoutMs);
    child.stdout.on('data', (d) => { if (stdout.length < 200000) stdout += d; });
    child.stderr.on('data', (d) => { if (stderr.length < 100000) stderr += d; });
    child.on('error', (e) => {
      clearTimeout(timer);
      finish({ stdout: '', stderr: '', timedOut: false, error: `Could not run ${language}: ${e.message}. Is it installed on this machine?` });
    });
    child.on('close', (exitCode) => {
      clearTimeout(timer);
      finish({ stdout, stderr, timedOut: exitCode === null, exitCode });
    });
    child.stdin.on('error', () => { /* program may not read stdin */ });
    child.stdin.write(stdin == null ? '' : String(stdin));
    child.stdin.end();
  });
}

async function runCode({ language, code, testCases, timeLimitSeconds }) {
  const timeoutMs = Math.min(Math.max(Number(timeLimitSeconds) || 5, 1), 15) * 1000;
  const results = [];
  let error = null;
  for (const tc of (testCases || []).slice(0, 20)) {
    const r = await runOnce({ language, code, stdin: tc.input, timeoutMs });
    if (r.error) {
      error = r.error;
      results.push({ passed: false, timedOut: false });
      break;
    }
    results.push({ passed: !r.timedOut && normalizeOut(r.stdout) === normalizeOut(tc.output), timedOut: r.timedOut });
  }
  const passed = results.filter((r) => r.passed).length;
  return { passed, total: results.length, results, error };
}

function evaluateMcq(question, selected) {
  const answered = selected != null && selected !== -1;
  const correct = answered && Number(selected) === Number(question.correctIndex);
  const score = correct ? question.marks : answered && question.negativeMarks ? -question.negativeMarks : 0;
  return { score, correct };
}

async function evaluateSubmission(question, answer) {
  if (question.type === 'mcq' || question.type === 'aptitude') {
    const { score, correct } = evaluateMcq(question, answer?.selected);
    return { score, status: 'evaluated', feedback: !answer || answer.selected == null ? 'Not answered' : correct ? 'Correct answer' : 'Incorrect answer' };
  }
  if (question.type === 'coding') {
    if (!answer?.code || !answer.code.trim()) return { score: 0, status: 'evaluated', feedback: 'No code submitted' };
    const out = await runCode({
      language: answer.language || 'javascript',
      code: answer.code,
      testCases: question.testCases,
      timeLimitSeconds: question.problem?.timeLimitSeconds || 5,
    });
    const ratio = out.total ? out.passed / out.total : 0;
    const score = Math.round(question.marks * ratio * 100) / 100;
    return { score, status: 'evaluated', feedback: out.error || `Passed ${out.passed}/${out.total} hidden test cases` };
  }
  // descriptive: manual review by authorized reviewers
  return { score: 0, status: 'pending_review', feedback: 'Awaiting manual review' };
}

module.exports = { SUPPORTED_LANGUAGES, evaluateMcq, evaluateSubmission, runCode };
