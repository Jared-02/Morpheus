const { makeStepResult } = require('../flow');
const { promptStepAction } = require('../utils');
const { clickBySelectors, setupNetworkCapture } = require('../browser');
const {
  collectBookIdsFromPayload,
  collectBookIdsFromText,
  pickLatestBookId,
  sortBookIdsAsc,
} = require('../idDetection');

module.exports = {
  name: 'await-submit',
  needsBrowser: true,
  async run({ rootDir, config, store, page, context }) {
    if (!page.url().includes('/main/writer/create')) {
      await page.goto(config.urls.createBook, {
        waitUntil: 'domcontentloaded',
        timeout: Number(config?.timeouts?.defaultMs || 15000),
      });
    }

    const capture = setupNetworkCapture(context, rootDir, config);
    const ids = new Set();
    let createResp = null;
    let createPayload = null;
    let createBody = '';
    let createOk = false;

    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/author/book/create/') && resp.request().method() === 'POST',
      { timeout: Number(config?.timeouts?.createResponseMs || 60000) }
    );

    const action = await promptStepAction(
      [
        '现在请在浏览器里核对创建表单。',
        config?.book?.autoSubmit
          ? '脚本也会尝试自动点击“立即创建”；如果未成功，请手动点击。'
          : '请手动点击“立即创建”，然后回车让我等待创建接口响应。',
      ].join('\n'),
      { allowRetry: true, allowSkip: true }
    );

    if (action.action === 'retry') {
      await capture.stop();
      const result = makeStepResult({
        ok: false,
        step: 'await-submit',
        nextStep: 'await-submit',
        notes: ['retry requested before submit'],
        artifacts: {
          network_log_path: capture.filePath,
          latest_page_url: page.url(),
        },
        detectedIds: store.load().detected_ids,
        sessionPath: store.sessionPath,
      });
      store.recordStepResult(result);
      store.writeResult(result);
      return result;
    }

    if (config?.book?.autoSubmit) {
      const clicked = await clickBySelectors(page, config?.selectors?.submitButton || [], 'submit-button');
      if (!clicked.ok) {
        console.log('[warn] submit button auto click failed, waiting for manual submit');
      }
    }

    if (action.action === 'skip') {
      await capture.stop();
      store.update((draft) => {
        draft.artifacts.network_log_path = capture.filePath;
        draft.artifacts.latest_page_url = page.url();
      });
      const result = makeStepResult({
        ok: true,
        step: 'await-submit',
        nextStep: 'capture-book-id',
        notes: ['submit waiting skipped by user; no create response captured in this run'],
        artifacts: {
          network_log_path: capture.filePath,
          latest_page_url: page.url(),
        },
        detectedIds: store.load().detected_ids,
        sessionPath: store.sessionPath,
      });
      store.recordStepResult(result);
      store.writeResult(result);
      return result;
    }

    try {
      createResp = await responsePromise;
      createBody = await createResp.text();
      collectBookIdsFromText(createResp.url(), ids);
      collectBookIdsFromText(createBody, ids);
      try {
        createPayload = JSON.parse(createBody);
        collectBookIdsFromPayload(createPayload, ids);
      } catch {
        // ignore non-json body
      }
      const code = Number(createPayload?.code);
      createOk =
        createResp.status() >= 200 &&
        createResp.status() < 300 &&
        (!Number.isFinite(code) || code === 0);
    } catch (error) {
      await capture.stop();
      store.update((draft) => {
        draft.artifacts.network_log_path = capture.filePath;
        draft.artifacts.latest_page_url = page.url();
      });
      const result = makeStepResult({
        ok: false,
        step: 'await-submit',
        nextStep: 'capture-book-id',
        notes: [`waiting create response failed: ${String(error)}`],
        artifacts: {
          network_log_path: capture.filePath,
          latest_page_url: page.url(),
        },
        detectedIds: store.load().detected_ids,
        sessionPath: store.sessionPath,
      });
      store.recordStepResult(result);
      store.writeResult(result);
      return result;
    } finally {
      await capture.stop();
    }

    const detected = {
      bookIds: sortBookIdsAsc(ids),
      latestBookId: pickLatestBookId(ids),
      source: 'await-submit:create-response',
      create_response_status: createResp?.status?.() ?? null,
    };

    store.update((draft) => {
      draft.artifacts.network_log_path = capture.filePath;
      draft.artifacts.latest_page_url = page.url();
      draft.page_confirmations.await_submit = {
        create_response_status: createResp?.status?.() ?? null,
        create_ok: createOk,
      };
    });
    store.appendDetectedIds(detected);

    const result = makeStepResult({
      ok: createOk,
      step: 'await-submit',
      nextStep: 'capture-book-id',
      notes: [
        `create response status=${createResp?.status?.() ?? 'unknown'}`,
        detected.latestBookId ? `response latestBookId=${detected.latestBookId}` : 'response did not expose a bookId',
      ],
      artifacts: {
        network_log_path: capture.filePath,
        latest_page_url: page.url(),
      },
      detectedIds: detected,
      sessionPath: store.sessionPath,
      extra: {
        create_response: {
          ok: createOk,
          status: createResp?.status?.() ?? null,
          url: createResp?.url?.() || '',
          body: createBody,
        },
      },
    });
    store.recordStepResult(result);
    store.writeResult(result);
    return result;
  },
};
