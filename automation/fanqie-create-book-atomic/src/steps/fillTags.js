const { makeStepResult } = require('../flow');
const { clickBySelectors, fillBookTags, fillBySelectors } = require('../browser');

module.exports = {
  name: 'fill-tags',
  needsBrowser: true,
  async run({ config, store, page }) {
    if (!page.url().includes('/main/writer/create')) {
      await page.goto(config.urls.createBook, {
        waitUntil: 'domcontentloaded',
        timeout: Number(config?.timeouts?.defaultMs || 15000),
      });
    }

    // The tag modal does not reliably open on a pristine form, so standalone
    // `fill-tags` primes the required basic fields first.
    await fillBySelectors(page, config?.selectors?.bookTitle || [], config?.book?.title, 'book title');
    await fillBySelectors(page, config?.selectors?.protagonist1 || [], config?.book?.protagonist1, 'protagonist1');
    await fillBySelectors(page, config?.selectors?.protagonist2 || [], config?.book?.protagonist2, 'protagonist2');
    const reader = String(config?.book?.targetReader || 'male').trim().toLowerCase();
    if (reader === 'female') {
      await clickBySelectors(page, config?.selectors?.targetReaderFemale || [], 'target-reader-female');
    } else {
      await clickBySelectors(page, config?.selectors?.targetReaderMale || [], 'target-reader-male');
    }

    const expectedTags = [];
    if (Array.isArray(config?.book?.tags)) {
      expectedTags.push(...config.book.tags);
    }
    if (config?.book?.tagsByTab && typeof config.book.tagsByTab === 'object') {
      for (const [tab, values] of Object.entries(config.book.tagsByTab)) {
        const list = Array.isArray(values) ? values : [values];
        for (const value of list) {
          const normalized = String(value || '').trim();
          if (normalized) expectedTags.push(`${tab}:${normalized}`);
        }
      }
    }
    const tagResult = await fillBookTags(page, config);

    store.update((draft) => {
      draft.page_confirmations.fill_tags = {
        ok: tagResult.ok,
        selected_tags: tagResult.selectedTags || [],
        expected_tags: expectedTags,
        failures: tagResult.failures || [],
        confirmed: !!tagResult.confirmed,
      };
      draft.artifacts.latest_page_url = page.url();
    });

    const result = makeStepResult({
      ok: tagResult.ok || tagResult.skipped,
      step: 'fill-tags',
      nextStep: 'fill-intro',
      notes: [
        `请确认作品标签应为：${expectedTags.length ? expectedTags.join(', ') : '(空)'}`,
        'standalone fill-tags 会先自动补齐书名/主角/目标读者，再打开标签弹窗',
        tagResult.skipped ? 'no tags configured, step skipped' : `selected tags: ${(tagResult.selectedTags || []).join(', ')}`,
      ],
      artifacts: {
        latest_page_url: page.url(),
      },
      detectedIds: store.load().detected_ids,
      sessionPath: store.sessionPath,
      extra: {
        fill_status: tagResult,
      },
    });
    store.recordStepResult(result);
    store.writeResult(result);
    return result;
  },
};
