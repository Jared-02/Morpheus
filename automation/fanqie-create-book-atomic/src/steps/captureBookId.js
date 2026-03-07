const { makeStepResult } = require('../flow');
const { collectBookIdsFromNetworkLog } = require('../idDetection');
const { collectBookIdsFromPage } = require('../browser');

module.exports = {
  name: 'capture-book-id',
  needsBrowser: true,
  async run({ store, page }) {
    const session = store.load();
    const networkLogPath = session?.artifacts?.network_log_path || '';
    const networkDetected = collectBookIdsFromNetworkLog(networkLogPath);
    const createOk = session?.page_confirmations?.await_submit?.create_ok !== false;
    const canUsePageScan = !String(page.url() || '').includes('/main/writer/create');
    const pageDetected = canUsePageScan
      ? await collectBookIdsFromPage(page).catch(() => ({ bookIds: [], latestBookId: '' }))
      : { bookIds: [], latestBookId: '' };
    const merged = Array.from(new Set([...(networkDetected.bookIds || []), ...(pageDetected.bookIds || [])]));
    const latestBookId =
      networkDetected.latestBookId ||
      (createOk ? pageDetected.latestBookId : '') ||
      '';

    const detected = {
      bookIds: merged.sort((a, b) => a.localeCompare(b)),
      latestBookId,
      source: networkDetected.latestBookId ? 'network-log' : pageDetected.latestBookId ? 'page-scan' : '',
      create_response_status: networkDetected.createResponseStatus ?? session?.detected_ids?.create_response_status ?? null,
    };

    store.appendDetectedIds(detected);
    store.update((draft) => {
      draft.artifacts.latest_page_url = page.url();
    });

    const result = makeStepResult({
      ok: !!latestBookId,
      step: 'capture-book-id',
      nextStep: 'bind-book',
      notes: latestBookId
        ? [`captured latestBookId=${latestBookId} source=${detected.source}`]
        : ['no bookId captured from network log or current page'],
      artifacts: {
        network_log_path: networkLogPath,
        latest_page_url: page.url(),
      },
      detectedIds: detected,
      sessionPath: store.sessionPath,
      extra: {
        create_response_status: detected.create_response_status,
      },
    });
    store.recordStepResult(result);
    store.writeResult(result);
    return result;
  },
};
