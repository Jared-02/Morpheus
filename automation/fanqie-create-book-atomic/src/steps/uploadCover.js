const { makeStepResult } = require('../flow');
const { uploadFileBySelectors } = require('../browser');

module.exports = {
  name: 'upload-cover',
  needsBrowser: true,
  async run({ rootDir, config, store, page }) {
    if (!page.url().includes('/main/writer/create')) {
      await page.goto(config.urls.createBook, {
        waitUntil: 'domcontentloaded',
        timeout: Number(config?.timeouts?.defaultMs || 15000),
      });
    }

    const upload = await uploadFileBySelectors(
      page,
      rootDir,
      config?.selectors?.coverFileInput || [],
      config?.book?.coverPath,
      'book cover'
    );
    store.update((draft) => {
      draft.page_confirmations.upload_cover = upload;
      draft.artifacts.latest_page_url = page.url();
    });

    const result = makeStepResult({
      ok: upload.ok || upload.skipped,
      step: 'upload-cover',
      nextStep: 'await-submit',
      notes: [
        `请确认封面路径为：${config?.book?.coverPath || '(空)'}`,
        upload.skipped ? 'cover not configured, step skipped' : 'cover upload attempted',
      ],
      artifacts: {
        latest_page_url: page.url(),
      },
      detectedIds: store.load().detected_ids,
      sessionPath: store.sessionPath,
      extra: {
        fill_status: upload,
      },
    });
    store.recordStepResult(result);
    store.writeResult(result);
    return result;
  },
};
