const test = require('node:test');
const assert = require('node:assert/strict');
const { analyzePreflightSignals } = require('../src/flow');

test('preflight does not block create only because existing book ids are visible', () => {
  const result = analyzePreflightSignals({
    candidateIds: ['7600000000000000001'],
    pageText: '作品管理',
    bindOnlyOnPreflightHit: true,
  });
  assert.equal(result.allowCreate, true);
  assert.equal(result.bindOnly, false);
});

test('preflight allows create when there are no signals', () => {
  const result = analyzePreflightSignals({
    candidateIds: [],
    pageText: '欢迎来到创作中心',
    bindOnlyOnPreflightHit: true,
  });
  assert.equal(result.allowCreate, true);
  assert.equal(result.bindOnly, false);
});

test('preflight blocks create when daily limit phrase is present', () => {
  const result = analyzePreflightSignals({
    candidateIds: [],
    pageText: '你今天已经创建过作品了，每天只能创建一本',
    bindOnlyOnPreflightHit: true,
  });
  assert.equal(result.allowCreate, false);
  assert.match(result.reasons.join(' '), /limit signal/i);
});
