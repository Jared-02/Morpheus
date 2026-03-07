const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.resolve(__dirname, '..');

function nowStamp() {
  return new Date().toISOString().replace(/[.:]/g, '-');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function absPath(rootDir, relPath) {
  if (!relPath) return '';
  return path.isAbsolute(relPath) ? relPath : path.resolve(rootDir || ROOT, relPath);
}

function deepMerge(base, override) {
  if (Array.isArray(base) || Array.isArray(override)) {
    return override === undefined ? base : override;
  }
  const output = { ...(base || {}) };
  for (const [key, value] of Object.entries(override || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      output[key] = deepMerge(output[key] || {}, value);
    } else {
      output[key] = value;
    }
  }
  return output;
}

function readJsonFileSafe(filePath, fallback = {}) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return fallback;
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (parsed && typeof parsed === 'object') return parsed;
    return fallback;
  } catch {
    return fallback;
  }
}

function writeJsonFile(filePath, payload) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function truncate(text, maxChars) {
  const value = String(text || '');
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n...<truncated ${value.length - maxChars} chars>`;
}

async function promptInput(question) {
  if (process.env.FANQIE_NON_INTERACTIVE === '1') {
    return '';
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${question}\n> `, (answer) => {
      rl.close();
      resolve((answer || '').trim());
    });
  });
}

async function promptStepAction(question, options = {}) {
  const {
    allowRetry = true,
    allowSkip = true,
    allowBind = false,
    defaultAction = 'continue',
  } = options;
  if (process.env.FANQIE_NON_INTERACTIVE === '1') {
    return { action: defaultAction, raw: '' };
  }
  const hints = ['回车继续'];
  if (allowSkip) hints.push('skip 跳过');
  if (allowRetry) hints.push('retry 重试当前步骤');
  if (allowBind) hints.push('bind <bookId> 手动绑定');
  const answer = await promptInput(`${question}\n${hints.join('，')}`);
  const normalized = answer.trim();
  if (!normalized) return { action: 'continue', raw: normalized };
  if (allowSkip && normalized.toLowerCase() === 'skip') return { action: 'skip', raw: normalized };
  if (allowRetry && normalized.toLowerCase() === 'retry') return { action: 'retry', raw: normalized };
  if (allowBind) {
    const match = normalized.match(/^bind\s+(\d{6,})$/i);
    if (match) {
      return { action: 'bind', raw: normalized, value: match[1] };
    }
  }
  return { action: 'continue', raw: normalized };
}

function loadConfig(rootDir = ROOT) {
  const examplePath = path.resolve(rootDir, 'config', 'example.json');
  const localPath = path.resolve(rootDir, 'config', 'local.json');
  const customPath = process.env.FANQIE_CONFIG
    ? path.resolve(process.env.FANQIE_CONFIG)
    : localPath;
  const base = readJsonFileSafe(examplePath, {});
  const local = readJsonFileSafe(customPath, {});
  return deepMerge(base, local);
}

module.exports = {
  ROOT,
  absPath,
  deepMerge,
  ensureDir,
  loadConfig,
  nowStamp,
  promptInput,
  promptStepAction,
  readJsonFileSafe,
  truncate,
  writeJsonFile,
};
