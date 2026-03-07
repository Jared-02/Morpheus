const { makeStepResult } = require('../flow');
const { fillBySelectors } = require('../browser');

module.exports = {
  name: 'fill-intro',
  needsBrowser: true,
  async run({ config, store, page }) {
    if (!page.url().includes('/main/writer/create')) {
      await page.goto(config.urls.createBook, {
        waitUntil: 'domcontentloaded',
        timeout: Number(config?.timeouts?.defaultMs || 15000),
      });
    }

    const intro = await fillBySelectors(page, config?.selectors?.bookIntro || [], config?.book?.intro, 'book intro');
    store.update((draft) => {
      draft.page_confirmations.fill_intro = {
        ok: intro.ok || intro.skipped,
        intro_length: String(config?.book?.intro || '').length,
      };
      draft.artifacts.latest_page_url = page.url();
    });

    const result = makeStepResult({
      ok: intro.ok || intro.skipped,
      step: 'fill-intro',
      nextStep: 'upload-cover',
      notes: [
        `请确认简介长度为：${String(config?.book?.intro || '').length}`,
        intro.skipped ? 'intro not configured, step skipped' : 'intro auto-fill attempted',
      ],
      artifacts: {
        latest_page_url: page.url(),
      },
      detectedIds: store.load().detected_ids,
      sessionPath: store.sessionPath,
      extra: {
        fill_status: intro,
      },
    });
    store.recordStepResult(result);
    store.writeResult(result);
    return result;
  },
};
