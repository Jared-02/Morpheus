const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  collectBookIdsFromNetworkLog,
  collectBookIdsFromPayload,
  collectBookIdsFromText,
} = require('../src/idDetection');

test('collectBookIdsFromText extracts ids from urls and query strings', () => {
  const ids = new Set();
  collectBookIdsFromText(
    'https://fanqienovel.com/main/writer/7600000000000000001/publish/?book_id=7600000000000000002',
    ids
  );
  assert.deepEqual(Array.from(ids).sort(), ['7600000000000000001', '7600000000000000002']);
});

test('collectBookIdsFromPayload extracts nested ids', () => {
  const ids = new Set();
  collectBookIdsFromPayload(
    {
      data: {
        book_id: '7600000000000000003',
        extra: {
          novelId: '7600000000000000004',
        },
      },
    },
    ids
  );
  assert.deepEqual(Array.from(ids).sort(), ['7600000000000000003', '7600000000000000004']);
});

test('collectBookIdsFromNetworkLog prefers create response metadata', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fanqie-ids-'));
  const logPath = path.join(tmpDir, 'network.jsonl');
  fs.writeFileSync(
    logPath,
    [
      JSON.stringify({
        phase: 'response',
        request: {
          url: 'https://fanqienovel.com/api/author/book/create/?foo=bar',
        },
        response: {
          status: 200,
          body: JSON.stringify({
            code: 0,
            data: {
              book_id: '7600000000000000005',
            },
          }),
        },
      }),
    ].join('\n'),
    'utf8'
  );
  const detected = collectBookIdsFromNetworkLog(logPath);
  assert.equal(detected.latestBookId, '7600000000000000005');
  assert.equal(detected.createResponseStatus, 200);
});
