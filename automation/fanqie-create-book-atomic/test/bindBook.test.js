const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveBindTarget } = require('../src/steps/bindBook');

test('resolveBindTarget prefers explicit requested id', () => {
  const target = resolveBindTarget({
    requestedId: '7600000000000000008',
    session: {
      detected_ids: {
        latestBookId: '7600000000000000002',
      },
    },
  });
  assert.equal(target.bookId, '7600000000000000008');
  assert.equal(target.source, 'manual-arg');
});

test('resolveBindTarget falls back to detected latest id', () => {
  const target = resolveBindTarget({
    requestedId: '',
    session: {
      detected_ids: {
        latestBookId: '7600000000000000007',
        bookIds: ['7600000000000000006', '7600000000000000007'],
      },
    },
  });
  assert.equal(target.bookId, '7600000000000000007');
  assert.equal(target.source, 'detected-latest');
});

test('resolveBindTarget prefers detected ids over stale session binding', () => {
  const target = resolveBindTarget({
    requestedId: '',
    session: {
      binding: {
        book_id: '7600000000000000001',
      },
      detected_ids: {
        latestBookId: '7600000000000000009',
      },
    },
  });
  assert.equal(target.bookId, '7600000000000000009');
  assert.equal(target.source, 'detected-latest');
});
