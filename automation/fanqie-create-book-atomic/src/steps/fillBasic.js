const { makeStepResult } = require('../flow');
const {
  clickBySelectors,
  fillBySelectors,
  waitForAnySelectorAcrossFrames,
} = require('../browser');

module.exports = {
  name: 'fill-basic',
  needsBrowser: true,
  async run({ config, store, page }) {
    if (!page.url().includes('/main/writer/create')) {
      await page.goto(config.urls.createBook, {
        waitUntil: 'domcontentloaded',
        timeout: Number(config?.timeouts?.defaultMs || 15000),
      });
      await waitForAnySelectorAcrossFrames(
        page,
        config?.selectors?.bookTitle || [],
        Number(config?.timeouts?.defaultMs || 15000)
      );
    }

    const notes = [
      `请确认书名应为：${config?.book?.title || '(空)'}`,
      `请确认主角1应为：${config?.book?.protagonist1 || '(空)'}`,
      `请确认主角2应为：${config?.book?.protagonist2 || '(空)'}`,
      `请确认目标读者应为：${config?.book?.targetReader || 'male'}`,
      '当前页面真实表单字段已按你提供的 DOM 结构对齐：书名、目标读者、主角名、作品简介',
    ];

    const title = await fillBySelectors(page, config?.selectors?.bookTitle || [], config?.book?.title, 'book title');
    const protagonist1 = await fillBySelectors(
      page,
      config?.selectors?.protagonist1 || [],
      config?.book?.protagonist1,
      'protagonist1'
    );
    const protagonist2 = await fillBySelectors(
      page,
      config?.selectors?.protagonist2 || [],
      config?.book?.protagonist2,
      'protagonist2'
    );

    let target = { ok: true, skipped: true };
    const reader = String(config?.book?.targetReader || 'male').trim().toLowerCase();
    if (reader === 'female') {
      target = await clickBySelectors(page, config?.selectors?.targetReaderFemale || [], 'target-reader-female');
    } else {
      target = await clickBySelectors(page, config?.selectors?.targetReaderMale || [], 'target-reader-male');
    }

    store.update((draft) => {
      draft.page_confirmations.fill_basic = {
        title: title.ok,
        protagonist1: protagonist1.ok,
        protagonist2: protagonist2.ok || protagonist2.skipped,
        target_reader: target.ok || target.skipped,
      };
      draft.artifacts.latest_page_url = page.url();
    });

    const ok = title.ok && protagonist1.ok && (protagonist2.ok || protagonist2.skipped) && (target.ok || target.skipped);
    const result = makeStepResult({
      ok,
      step: 'fill-basic',
      nextStep: 'fill-tags',
      notes,
      artifacts: {
        latest_page_url: page.url(),
      },
      detectedIds: store.load().detected_ids,
      sessionPath: store.sessionPath,
      extra: {
        fill_status: {
          title,
          protagonist1,
          protagonist2,
          target,
        },
      },
    });
    store.recordStepResult(result);
    store.writeResult(result);
    return result;
  },
};
