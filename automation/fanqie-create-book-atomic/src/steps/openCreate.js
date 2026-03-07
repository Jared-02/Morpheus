const { makeStepResult } = require('../flow');
const { ensureLoginState, waitForAnySelectorAcrossFrames } = require('../browser');

module.exports = {
  name: 'open-create',
  needsBrowser: true,
  async run({ config, store, page, context }) {
    const session = store.load();
    if (session?.preflight?.bind_only) {
      const result = makeStepResult({
        ok: false,
        step: 'open-create',
        nextStep: 'detect-existing-books',
        notes: ['preflight recommends bind-only path; creation page will not be opened'],
        artifacts: {
          latest_page_url: page.url(),
        },
        detectedIds: session.detected_ids,
        sessionPath: store.sessionPath,
      });
      store.recordStepResult(result);
      store.writeResult(result);
      return result;
    }

    await ensureLoginState(context, page, config);
    await page.goto(config.urls.createBook, {
      waitUntil: 'domcontentloaded',
      timeout: Number(config?.timeouts?.defaultMs || 15000),
    });
    const mounted = await waitForAnySelectorAcrossFrames(
      page,
      config?.selectors?.bookTitle || [],
      Number(config?.timeouts?.defaultMs || 15000)
    );

    store.update((draft) => {
      draft.page_confirmations.open_create = !!mounted;
      draft.artifacts.latest_page_url = page.url();
    });

    const result = makeStepResult({
      ok: !!mounted,
      step: 'open-create',
      nextStep: 'fill-basic',
      notes: mounted
        ? ['create page opened and title field is visible']
        : ['create page opened but title field selector did not resolve'],
      artifacts: {
        latest_page_url: page.url(),
      },
      detectedIds: session.detected_ids,
      sessionPath: store.sessionPath,
    });
    store.recordStepResult(result);
    store.writeResult(result);
    return result;
  },
};
