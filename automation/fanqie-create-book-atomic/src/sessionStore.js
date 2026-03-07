const path = require('path');
const { absPath, ensureDir, readJsonFileSafe, writeJsonFile } = require('./utils');

function buildDefaultSession(config) {
  return {
    meta: {
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      mode: config?.flow?.mode || 'guided',
    },
    input: {
      project_id: String(config?.book?.projectId || '').trim(),
      title: String(config?.book?.title || '').trim(),
      tags: Array.isArray(config?.book?.tags) ? config.book.tags : [],
      intro: String(config?.book?.intro || ''),
      protagonist1: String(config?.book?.protagonist1 || '').trim(),
      protagonist2: String(config?.book?.protagonist2 || '').trim(),
      target_reader: String(config?.book?.targetReader || 'male').trim().toLowerCase(),
      cover_path: String(config?.book?.coverPath || '').trim(),
    },
    last_step: '',
    last_result: null,
    page_confirmations: {},
    preflight: {
      allow_create: null,
      bind_only: null,
      reasons: [],
      matched_signals: [],
      checked_at: '',
    },
    detected_ids: {
      bookIds: [],
      latestBookId: '',
      source: '',
      create_response_status: null,
      created_at: '',
    },
    artifacts: {
      network_log_path: '',
      result_path: '',
      latest_page_url: '',
    },
    binding: {
      book_id: '',
      source: '',
      bound_at: '',
      result_path: '',
    },
    history: [],
  };
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.filter((item) => item && typeof item === 'object').slice(-50);
}

function normalizeSession(config, payload) {
  const base = buildDefaultSession(config);
  const merged = {
    ...base,
    ...(payload || {}),
    meta: { ...base.meta, ...((payload && payload.meta) || {}) },
    input: { ...base.input, ...((payload && payload.input) || {}) },
    preflight: { ...base.preflight, ...((payload && payload.preflight) || {}) },
    detected_ids: { ...base.detected_ids, ...((payload && payload.detected_ids) || {}) },
    artifacts: { ...base.artifacts, ...((payload && payload.artifacts) || {}) },
    binding: { ...base.binding, ...((payload && payload.binding) || {}) },
    page_confirmations: { ...base.page_confirmations, ...((payload && payload.page_confirmations) || {}) },
  };
  merged.history = normalizeHistory(payload?.history);
  merged.meta.updated_at = new Date().toISOString();
  return merged;
}

function createSessionStore(rootDir, config) {
  const sessionPath = absPath(rootDir, config?.paths?.sessionPath || './state/create-book-session.json');
  const resultPath = absPath(rootDir, config?.paths?.resultPath || './state/create-book-result.json');
  const boundBookStatePath = absPath(
    rootDir,
    config?.paths?.boundBookStatePath || './state/book-ids.json'
  );

  function load() {
    const payload = readJsonFileSafe(sessionPath, {});
    return normalizeSession(config, payload);
  }

  function save(session) {
    const normalized = normalizeSession(config, session);
    ensureDir(path.dirname(sessionPath));
    writeJsonFile(sessionPath, normalized);
    return normalized;
  }

  function update(mutator) {
    const current = load();
    const draft = normalizeSession(config, current);
    mutator(draft);
    return save(draft);
  }

  function recordStepResult(result) {
    return update((session) => {
      session.last_step = result.step;
      session.last_result = result;
      session.meta.updated_at = new Date().toISOString();
      session.history.push({
        at: new Date().toISOString(),
        step: result.step,
        ok: !!result.ok,
        next_step: result.next_step || '',
      });
      session.history = normalizeHistory(session.history);
      if (result.artifacts?.network_log_path) {
        session.artifacts.network_log_path = result.artifacts.network_log_path;
      }
      if (result.artifacts?.latest_page_url) {
        session.artifacts.latest_page_url = result.artifacts.latest_page_url;
      }
      if (result.detected_ids?.latestBookId) {
        session.detected_ids = {
          ...session.detected_ids,
          ...result.detected_ids,
          created_at: new Date().toISOString(),
        };
      }
    });
  }

  function setPreflight(preflight) {
    return update((session) => {
      session.preflight = {
        ...session.preflight,
        ...preflight,
        checked_at: new Date().toISOString(),
      };
    });
  }

  function appendDetectedIds(payload) {
    return update((session) => {
      const existing = new Set(session.detected_ids.bookIds || []);
      for (const id of payload?.bookIds || []) {
        if (id) existing.add(String(id));
      }
      const mergedIds = Array.from(existing).sort((a, b) => a.localeCompare(b));
      session.detected_ids = {
        ...session.detected_ids,
        ...payload,
        bookIds: mergedIds,
        latestBookId: payload?.latestBookId || session.detected_ids.latestBookId || '',
        created_at: new Date().toISOString(),
      };
    });
  }

  function setBinding(bookId, meta = {}) {
    return update((session) => {
      session.binding = {
        ...session.binding,
        book_id: String(bookId || '').trim(),
        source: meta.source || session.binding.source || '',
        bound_at: new Date().toISOString(),
        result_path: resultPath,
      };
    });
  }

  function writeResult(payload) {
    ensureDir(path.dirname(resultPath));
    writeJsonFile(resultPath, payload);
    return resultPath;
  }

  function persistBoundBookState(bookId, meta = {}) {
    const normalized = String(bookId || '').trim();
    if (!normalized) return null;
    const state = readJsonFileSafe(boundBookStatePath, { latestBookId: '', history: [] });
    const history = Array.isArray(state.history) ? state.history.slice(-49) : [];
    history.push({
      bookId: normalized,
      at: new Date().toISOString(),
      mode: meta.mode || 'atomic-bind',
      source: meta.source || 'bind-book',
      title: meta.title || '',
      status: meta.status ?? null,
    });
    const payload = {
      latestBookId: normalized,
      history,
    };
    ensureDir(path.dirname(boundBookStatePath));
    writeJsonFile(boundBookStatePath, payload);
    return boundBookStatePath;
  }

  return {
    boundBookStatePath,
    load,
    recordStepResult,
    resultPath,
    save,
    sessionPath,
    setBinding,
    setPreflight,
    appendDetectedIds,
    update,
    writeResult,
    persistBoundBookState,
  };
}

module.exports = {
  buildDefaultSession,
  createSessionStore,
  normalizeSession,
};
