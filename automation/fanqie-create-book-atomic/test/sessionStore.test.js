const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createSessionStore } = require('../src/sessionStore');

function buildConfig(rootDir) {
  return {
    flow: { mode: 'guided' },
    book: {
      title: '备份神谕',
      tags: ['悬疑'],
      intro: '简介',
      protagonist1: '沈砺',
      protagonist2: '',
      targetReader: 'male',
      coverPath: '',
    },
    paths: {
      sessionPath: path.join(rootDir, 'session.json'),
      resultPath: path.join(rootDir, 'result.json'),
      boundBookStatePath: path.join(rootDir, 'book-ids.json'),
    },
  };
}

test('session store persists step results and detected ids', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fanqie-session-'));
  const store = createSessionStore(rootDir, buildConfig(rootDir));
  const session = store.load();
  assert.equal(session.input.title, '备份神谕');

  store.appendDetectedIds({
    bookIds: ['7600000000000000001'],
    latestBookId: '7600000000000000001',
    source: 'test',
  });
  store.recordStepResult({
    ok: true,
    step: 'preflight',
    next_step: 'open-create',
    notes: [],
    artifacts: {},
    detected_ids: {
      bookIds: ['7600000000000000001'],
      latestBookId: '7600000000000000001',
    },
    session_path: store.sessionPath,
  });

  const reloaded = store.load();
  assert.equal(reloaded.last_step, 'preflight');
  assert.equal(reloaded.detected_ids.latestBookId, '7600000000000000001');
  assert.equal(reloaded.history.length, 1);
});

test('persistBoundBookState writes compatible latestBookId history', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fanqie-state-'));
  const store = createSessionStore(rootDir, buildConfig(rootDir));
  const statePath = store.persistBoundBookState('7600000000000000009', {
    source: 'bind-book',
    title: '备份神谕',
  });
  const payload = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  assert.equal(payload.latestBookId, '7600000000000000009');
  assert.equal(payload.history[0].source, 'bind-book');
});
