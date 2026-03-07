const { makeStepResult } = require('../flow');
const { promptStepAction } = require('../utils');

function resolveBindTarget({ requestedId, session }) {
  const normalizedRequested = String(requestedId || '').trim();
  if (/^\d{6,}$/.test(normalizedRequested)) {
    return { bookId: normalizedRequested, source: 'manual-arg' };
  }
  const latestDetected = String(session?.detected_ids?.latestBookId || '').trim();
  if (/^\d{6,}$/.test(latestDetected)) {
    return { bookId: latestDetected, source: 'detected-latest' };
  }
  const candidateIds = Array.isArray(session?.detected_ids?.bookIds) ? session.detected_ids.bookIds : [];
  const firstValid = candidateIds.find((id) => /^\d{6,}$/.test(String(id || '').trim()));
  if (firstValid) {
    return { bookId: String(firstValid), source: 'detected-list' };
  }
  const sessionBound = String(session?.binding?.book_id || '').trim();
  if (/^\d{6,}$/.test(sessionBound)) {
    return { bookId: sessionBound, source: 'session-binding' };
  }
  return { bookId: '', source: 'none' };
}

module.exports = {
  name: 'bind-book',
  needsBrowser: false,
  resolveBindTarget,
  async run({ config, store, args }) {
    let session = store.load();
    let target = resolveBindTarget({ requestedId: args?.[0], session });

    if (!target.bookId && process.env.FANQIE_NON_INTERACTIVE !== '1') {
      const action = await promptStepAction(
        '当前没有可直接绑定的 bookId。你可以输入 bind <bookId> 手动绑定，或 skip 跳过。',
        { allowRetry: false, allowSkip: true, allowBind: true }
      );
      if (action.action === 'bind' && action.value) {
        target = { bookId: action.value, source: 'manual-input' };
      }
      if (action.action === 'skip') {
        const skipped = makeStepResult({
          ok: true,
          step: 'bind-book',
          nextStep: '',
          notes: ['bind step skipped by user'],
          artifacts: {},
          detectedIds: session.detected_ids,
          sessionPath: store.sessionPath,
        });
        store.recordStepResult(skipped);
        store.writeResult(skipped);
        return skipped;
      }
    } else if (target.bookId && process.env.FANQIE_NON_INTERACTIVE !== '1' && !args?.[0]) {
      const action = await promptStepAction(
        `检测到候选 bookId=${target.bookId}。回车将绑定它，或输入 bind <bookId> 覆盖。`,
        { allowRetry: false, allowSkip: true, allowBind: true }
      );
      if (action.action === 'bind' && action.value) {
        target = { bookId: action.value, source: 'manual-input' };
      }
      if (action.action === 'skip') {
        const skipped = makeStepResult({
          ok: true,
          step: 'bind-book',
          nextStep: '',
          notes: ['bind step skipped by user'],
          artifacts: {},
          detectedIds: session.detected_ids,
          sessionPath: store.sessionPath,
        });
        store.recordStepResult(skipped);
        store.writeResult(skipped);
        return skipped;
      }
    }

    if (!target.bookId) {
      const failed = makeStepResult({
        ok: false,
        step: 'bind-book',
        nextStep: '',
        notes: ['no valid bookId available for binding'],
        artifacts: {},
        detectedIds: session.detected_ids,
        sessionPath: store.sessionPath,
      });
      store.recordStepResult(failed);
      store.writeResult(failed);
      return failed;
    }

    store.setBinding(target.bookId, { source: target.source });
    const statePath = store.persistBoundBookState(target.bookId, {
      mode: config?.flow?.mode || 'guided',
      source: target.source,
      title: config?.book?.title || '',
    });
    session = store.load();

    const result = makeStepResult({
      ok: true,
      step: 'bind-book',
      nextStep: '',
      notes: [`bound bookId=${target.bookId} source=${target.source}`],
      artifacts: {
        bound_book_state_path: statePath || '',
        result_path: store.resultPath,
      },
      detectedIds: {
        ...session.detected_ids,
        latestBookId: target.bookId,
      },
      sessionPath: store.sessionPath,
      extra: {
        binding: session.binding,
      },
    });
    store.recordStepResult(result);
    store.writeResult(result);
    return result;
  },
};
