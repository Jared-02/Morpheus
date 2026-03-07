const fs = require('fs');

function collectBookIdsFromText(input, outSet) {
  const text = String(input || '');
  const patterns = [
    /\/main\/writer\/(\d+)(?:\/|$|\?)/g,
    /[?&]book_id=(\d+)/g,
    /"book[_-]?id"\s*[:=]\s*"(\d+)"/gi,
    /"novel[_-]?id"\s*[:=]\s*"(\d+)"/gi,
  ];
  for (const re of patterns) {
    let match = re.exec(text);
    while (match) {
      if (match[1]) outSet.add(String(match[1]));
      match = re.exec(text);
    }
  }
}

function collectBookIdsFromPayload(payload, outSet) {
  if (!payload || typeof payload !== 'object') return;
  const stack = [payload];
  const visited = new Set();
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') continue;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const [key, value] of Object.entries(current)) {
      if (typeof value === 'string' || typeof value === 'number') {
        const text = String(value);
        if (/(^|_)(book|novel)(_|)id$/i.test(String(key)) && /^\d{6,}$/.test(text)) {
          outSet.add(text);
        }
        collectBookIdsFromText(text, outSet);
      } else if (value && typeof value === 'object') {
        stack.push(value);
      }
    }
  }
}

function sortBookIdsAsc(ids) {
  return Array.from(ids || []).sort((a, b) => {
    const aa = String(a || '').trim();
    const bb = String(b || '').trim();
    if (/^\d+$/.test(aa) && /^\d+$/.test(bb)) {
      try {
        const an = BigInt(aa);
        const bn = BigInt(bb);
        if (an < bn) return -1;
        if (an > bn) return 1;
        return 0;
      } catch {
        return aa.localeCompare(bb);
      }
    }
    return aa.localeCompare(bb);
  });
}

function pickLatestBookId(ids) {
  const sorted = sortBookIdsAsc(ids);
  return sorted[sorted.length - 1] || '';
}

function collectBookIdsFromList(inputs, outSet) {
  for (const value of inputs || []) {
    collectBookIdsFromText(value, outSet);
  }
}

function parseJsonLines(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, 'utf8').split('\n').map((line) => line.trim()).filter(Boolean);
  const records = [];
  for (const line of lines) {
    try {
      records.push(JSON.parse(line));
    } catch {
      // ignore broken lines
    }
  }
  return records;
}

function collectBookIdsFromNetworkLog(filePath) {
  const ids = new Set();
  const records = parseJsonLines(filePath);
  let createResponseStatus = null;
  let createResponseUrl = '';
  for (const record of records) {
    const requestUrl = record?.request?.url || '';
    const responseBody = record?.response?.body || '';
    collectBookIdsFromText(requestUrl, ids);
    collectBookIdsFromText(responseBody, ids);
    if (requestUrl.includes('/api/author/book/create/') && record.phase === 'response') {
      createResponseStatus = record?.response?.status ?? null;
      createResponseUrl = requestUrl;
      try {
        const payload = JSON.parse(String(responseBody || ''));
        collectBookIdsFromPayload(payload, ids);
      } catch {
        // response body may be truncated or non-json
      }
    }
  }
  return {
    bookIds: sortBookIdsAsc(ids),
    latestBookId: pickLatestBookId(ids),
    createResponseStatus,
    createResponseUrl,
  };
}

module.exports = {
  collectBookIdsFromList,
  collectBookIdsFromNetworkLog,
  collectBookIdsFromPayload,
  collectBookIdsFromText,
  parseJsonLines,
  pickLatestBookId,
  sortBookIdsAsc,
};
