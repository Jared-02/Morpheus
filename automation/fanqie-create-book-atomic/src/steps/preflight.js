const { analyzePreflightSignals, makeStepResult } = require('../flow');
const {
  collectBookIdsFromPage,
  collectBookIdsFromResponses,
  ensureLoginState,
} = require('../browser');

module.exports = {
  name: 'preflight',
  needsBrowser: true,
  async run({ config, store, page, context }) {
    await ensureLoginState(context, page, config);
    await page.goto(config.urls.writerHome, {
      waitUntil: 'domcontentloaded',
      timeout: Number(config?.timeouts?.defaultMs || 15000),
    });
    await page.waitForTimeout(1200);

    const [pageIds, responseIds, pageText] = await Promise.all([
      collectBookIdsFromPage(page),
      collectBookIdsFromResponses(page, 1200),
      page.locator('body').innerText().catch(() => ''),
    ]);

    const merged = Array.from(new Set([...(pageIds.bookIds || []), ...(responseIds.bookIds || [])]));
    const analysis = analyzePreflightSignals({
      candidateIds: merged,
      pageText,
      bindOnlyOnPreflightHit: config?.flow?.bindOnlyOnPreflightHit,
    });

    store.setPreflight({
      allow_create: analysis.allowCreate,
      bind_only: analysis.bindOnly,
      reasons: analysis.reasons,
      matched_signals: analysis.matchedSignals,
    });
    store.appendDetectedIds({
      bookIds: merged,
      latestBookId: pageIds.latestBookId || responseIds.latestBookId || '',
      source: 'preflight',
      create_response_status: null,
    });

    const result = makeStepResult({
      ok: true,
      step: 'preflight',
      nextStep: analysis.allowCreate ? 'open-create' : 'detect-existing-books',
      notes: [
        `preflight allowCreate=${analysis.allowCreate}`,
        ...analysis.reasons,
      ],
      artifacts: {
        latest_page_url: page.url(),
      },
      detectedIds: {
        bookIds: merged,
        latestBookId: pageIds.latestBookId || responseIds.latestBookId || '',
        source: 'preflight',
        create_response_status: null,
      },
      sessionPath: store.sessionPath,
      extra: {
        preflight: {
          allow_create: analysis.allowCreate,
          bind_only: analysis.bindOnly,
          reasons: analysis.reasons,
          matched_signals: analysis.matchedSignals,
        },
      },
    });

    store.recordStepResult(result);
    store.writeResult(result);
    return result;
  },
};
