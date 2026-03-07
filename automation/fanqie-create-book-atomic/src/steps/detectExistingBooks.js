const { makeStepResult } = require('../flow');
const {
  collectBookIdsFromPage,
  collectBookIdsFromResponses,
  ensureLoginState,
} = require('../browser');

module.exports = {
  name: 'detect-existing-books',
  needsBrowser: true,
  async run({ config, store, page, context }) {
    await ensureLoginState(context, page, config);
    await page.goto(config.urls.writerHome, {
      waitUntil: 'domcontentloaded',
      timeout: Number(config?.timeouts?.defaultMs || 15000),
    });
    await page.waitForTimeout(1200);
    const [pageIds, responseIds] = await Promise.all([
      collectBookIdsFromPage(page),
      collectBookIdsFromResponses(page, 1200),
    ]);
    const merged = Array.from(new Set([...(pageIds.bookIds || []), ...(responseIds.bookIds || [])]));
    const latestBookId = pageIds.latestBookId || responseIds.latestBookId || '';

    store.appendDetectedIds({
      bookIds: merged,
      latestBookId,
      source: 'detect-existing-books',
      create_response_status: null,
    });

    const result = makeStepResult({
      ok: true,
      step: 'detect-existing-books',
      nextStep: latestBookId ? 'bind-book' : 'open-create',
      notes: latestBookId
        ? [`detected existing latestBookId=${latestBookId}`]
        : ['no visible book id found on writer home'],
      artifacts: {
        latest_page_url: page.url(),
      },
      detectedIds: {
        bookIds: merged,
        latestBookId,
        source: 'detect-existing-books',
        create_response_status: null,
      },
      sessionPath: store.sessionPath,
    });

    store.recordStepResult(result);
    store.writeResult(result);
    return result;
  },
};
