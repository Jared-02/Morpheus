const fs = require('fs');
const path = require('path');
const {
  absPath,
  ensureDir,
  nowStamp,
  promptInput,
  truncate,
} = require('./utils');
const {
  collectBookIdsFromPayload,
  collectBookIdsFromText,
  pickLatestBookId,
  sortBookIdsAsc,
} = require('./idDetection');

function getPlaywright() {
  return require('playwright');
}

async function launchBrowser(rootDir, config) {
  const { chromium } = getPlaywright();
  const userDataDir = absPath(rootDir, config?.paths?.userDataDir || './state/chromium-profile');
  ensureDir(userDataDir);
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: !!config?.browser?.headless,
    slowMo: Number(config?.browser?.slowMo || 0),
    viewport: {
      width: Number(config?.browser?.viewportWidth || 1440),
      height: Number(config?.browser?.viewportHeight || 900),
    },
  });
  const page = context.pages()[0] || (await context.newPage());
  return { context, page };
}

async function ensureLoginState(context, page, config) {
  const cookies = await context.cookies('https://fanqienovel.com');
  const hasSession = cookies.some((cookie) => ['sessionid', 'sessionid_ss', 'sid_tt'].includes(cookie.name) && cookie.value);
  if (hasSession) return;

  if (process.env.FANQIE_NON_INTERACTIVE === '1') {
    throw new Error('no session cookie found in non-interactive mode');
  }

  await page.goto(config.urls.writerHome, {
    waitUntil: 'domcontentloaded',
    timeout: Number(config?.timeouts?.defaultMs || 15000),
  });
  await promptInput('请先在浏览器中完成登录，然后回车继续');
}

async function firstExistingLocator(page, selectors) {
  const frames = page.frames();
  for (const selector of selectors || []) {
    for (const frame of frames) {
      const locator = frame.locator(selector);
      let count = 0;
      try {
        count = await locator.count();
      } catch {
        count = 0;
      }
      if (count <= 0) continue;
      for (let index = 0; index < count; index += 1) {
        const candidate = locator.nth(index);
        try {
          const visible = await candidate.isVisible();
          if (!visible) continue;
          const box = await candidate.boundingBox();
          if (!box || box.width < 20 || box.height < 10) continue;
          return { selector, locator: candidate, frameUrl: frame.url() || '' };
        } catch {
          // ignore
        }
      }
    }
  }
  return null;
}

async function waitForAnySelectorAcrossFrames(page, selectors, timeoutMs = 15000) {
  const endAt = Date.now() + Math.max(1000, Number(timeoutMs || 15000));
  while (Date.now() < endAt) {
    const hit = await firstExistingLocator(page, selectors);
    if (hit) return hit;
    await page.waitForTimeout(250);
  }
  return null;
}

async function clickBySelectors(page, selectors, label) {
  const hit = await firstExistingLocator(page, selectors);
  if (!hit) return { ok: false, selector: '', frameUrl: '' };
  await hit.locator.click({ force: true });
  return { ok: true, selector: hit.selector, frameUrl: hit.frameUrl };
}

async function fillBySelectors(page, selectors, value, label) {
  if (!String(value || '').trim()) {
    return { ok: true, label, skipped: true };
  }
  const hit = await firstExistingLocator(page, selectors);
  if (!hit) return { ok: false, label, selector: '', reason: 'selector_not_found' };
  const expected = String(value);
  await hit.locator.click({ force: true });
  await hit.locator.fill(expected);
  await page.waitForTimeout(80);
  let actual = '';
  try {
    actual = await hit.locator.inputValue();
  } catch {
    actual = '';
  }
  if (actual !== expected) {
    await hit.locator.fill('');
    await hit.locator.type(expected, { delay: 35 });
    await page.waitForTimeout(120);
    try {
      actual = await hit.locator.inputValue();
    } catch {
      actual = '';
    }
  }
  return {
    ok: actual === expected,
    label,
    selector: hit.selector,
    frameUrl: hit.frameUrl,
    actual,
  };
}

async function uploadFileBySelectors(page, rootDir, selectors, filePath, label) {
  const relative = String(filePath || '').trim();
  if (!relative) return { ok: true, label, skipped: true };
  const abs = absPath(rootDir, relative);
  if (!fs.existsSync(abs)) return { ok: false, label, reason: 'file_not_found', filePath: abs };
  const hit = await firstExistingLocator(page, selectors);
  if (!hit) return { ok: false, label, reason: 'selector_not_found', filePath: abs };
  await hit.locator.setInputFiles(abs);
  return { ok: true, label, selector: hit.selector, frameUrl: hit.frameUrl, filePath: abs };
}

function sanitizeHeaders(headers) {
  const redact = new Set([
    'cookie',
    'authorization',
    'x-secsdk-csrf-token',
    'x-ms-token',
    'x-tt-token',
    'x-tt-token-sign',
    'x-tt-passport-csrf-token',
  ]);
  const output = {};
  for (const [key, value] of Object.entries(headers || {})) {
    output[key] = redact.has(key.toLowerCase()) ? '__REDACTED__' : value;
  }
  return output;
}

function sanitizeUrl(rawUrl, redactSensitiveQuery) {
  if (!redactSensitiveQuery) return rawUrl;
  try {
    const url = new URL(rawUrl);
    for (const key of ['msToken', 'a_bogus', '_signature', 'X-Bogus']) {
      if (url.searchParams.has(key)) {
        url.searchParams.set(key, '__REDACTED__');
      }
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function getRequestPageUrl(request) {
  try {
    const frame = request.frame();
    return frame ? frame.url() || '' : '';
  } catch {
    return '';
  }
}

function setupNetworkCapture(context, rootDir, config) {
  if (!config?.capture?.enabled) {
    return { filePath: '', stop: async () => {} };
  }

  const logDir = absPath(rootDir, config?.paths?.networkLogDir || './output/network');
  ensureDir(logDir);
  const filePath = path.join(logDir, `network-${nowStamp()}.jsonl`);
  const urlIncludes = Array.isArray(config?.capture?.urlIncludes) ? config.capture.urlIncludes : [];
  const captureAll = !!config?.capture?.captureAll || urlIncludes.length === 0;
  const maxBodyChars = Number(config?.capture?.maxBodyChars || 16000);
  const includeResponseBody = config?.capture?.includeResponseBody !== false;
  const redactSensitiveQuery = config?.capture?.redactSensitiveQuery !== false;

  const shouldCaptureUrl = (rawUrl) => {
    if (!/^https?:\/\//i.test(String(rawUrl || ''))) return false;
    if (captureAll) return true;
    return urlIncludes.some((part) => String(rawUrl || '').includes(part));
  };

  const onRequest = (request) => {
    const rawUrl = request.url();
    if (!shouldCaptureUrl(rawUrl)) return;
    fs.appendFileSync(
      filePath,
      `${JSON.stringify({
        phase: 'request',
        at: new Date().toISOString(),
        request: {
          method: request.method(),
          url: sanitizeUrl(rawUrl, redactSensitiveQuery),
          headers: sanitizeHeaders(request.headers()),
          postData: truncate(request.postData() || '', maxBodyChars),
          resourceType: request.resourceType(),
          pageUrl: getRequestPageUrl(request),
        },
        response: null,
      })}\n`,
      'utf8'
    );
  };

  const onResponse = async (response) => {
    const request = response.request();
    const rawUrl = request.url();
    if (!shouldCaptureUrl(rawUrl)) return;
    let body = '';
    if (includeResponseBody) {
      try {
        body = truncate(await response.text(), maxBodyChars);
      } catch (error) {
        body = `<read body failed: ${String(error)}>`;
      }
    }
    fs.appendFileSync(
      filePath,
      `${JSON.stringify({
        phase: 'response',
        at: new Date().toISOString(),
        request: {
          method: request.method(),
          url: sanitizeUrl(rawUrl, redactSensitiveQuery),
          headers: sanitizeHeaders(request.headers()),
          postData: truncate(request.postData() || '', maxBodyChars),
          resourceType: request.resourceType(),
          pageUrl: getRequestPageUrl(request),
        },
        response: {
          status: response.status(),
          statusText: response.statusText(),
          headers: sanitizeHeaders(response.headers()),
          body,
        },
      })}\n`,
      'utf8'
    );
  };

  context.on('request', onRequest);
  context.on('response', onResponse);

  return {
    filePath,
    stop: async () => {
      context.off('request', onRequest);
      context.off('response', onResponse);
    },
  };
}

async function collectBookIdsFromPage(page) {
  const ids = new Set();
  collectBookIdsFromText(page.url(), ids);
  const hrefs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href]'))
      .map((node) => node.getAttribute('href') || '')
      .filter(Boolean)
  ).catch(() => []);
  for (const href of hrefs) {
    collectBookIdsFromText(href, ids);
  }
  const resources = await page.evaluate(() => {
    try {
      return performance.getEntriesByType('resource').map((entry) => entry.name || '');
    } catch {
      return [];
    }
  }).catch(() => []);
  for (const resourceUrl of resources) {
    collectBookIdsFromText(resourceUrl, ids);
  }
  return {
    bookIds: sortBookIdsAsc(ids),
    latestBookId: pickLatestBookId(ids),
  };
}

async function collectBookIdsFromResponses(page, waitMs = 1800) {
  const ids = new Set();
  const responseDetails = [];
  const onResponse = async (response) => {
    try {
      const rawUrl = response.url();
      collectBookIdsFromText(rawUrl, ids);
      const ct = String(response.headers()['content-type'] || '').toLowerCase();
      if (!ct.includes('application/json') && !ct.includes('text/')) return;
      const text = await response.text();
      collectBookIdsFromText(text, ids);
      try {
        collectBookIdsFromPayload(JSON.parse(text), ids);
      } catch {
        // ignore malformed body
      }
      if (rawUrl.includes('/api/author/book/create/')) {
        responseDetails.push({
          url: rawUrl,
          status: response.status(),
          body: truncate(text, 4000),
        });
      }
    } catch {
      // ignore
    }
  };
  page.on('response', onResponse);
  await page.waitForTimeout(waitMs);
  page.off('response', onResponse);
  return {
    bookIds: sortBookIdsAsc(ids),
    latestBookId: pickLatestBookId(ids),
    createResponses: responseDetails,
  };
}

function normalizeTagList(raw) {
  if (Array.isArray(raw)) return raw.map((item) => String(item || '').trim()).filter(Boolean);
  return String(raw || '')
    .split(/[,\n，]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeTagPlan(config) {
  const tagsByTab = config?.book?.tagsByTab;
  if (tagsByTab && typeof tagsByTab === 'object' && !Array.isArray(tagsByTab)) {
    const entries = [];
    for (const [tab, values] of Object.entries(tagsByTab)) {
      for (const value of normalizeTagList(values)) {
        entries.push({ tab: String(tab || '').trim(), value });
      }
    }
    if (entries.length > 0) return entries;
  }
  return normalizeTagList(config?.book?.tags).map((value) => ({ tab: '', value }));
}

function quoteForHasText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}

async function clearSelectedBookTags(page, selectors) {
  const removeSelectors = [
    ...(selectors?.selectedTagRemove || []),
    '.create-category-item .item-del',
    '.create-category-item .tomato-close',
  ];
  for (let round = 0; round < 20; round += 1) {
    const hit = await firstExistingLocator(page, removeSelectors);
    if (!hit) break;
    await hit.locator.click({ force: true }).catch(() => {});
    await page.waitForTimeout(120);
  }
}

async function ensureTagModalOpen(page, config) {
  const modalSelectors = [
    ...(config?.selectors?.tagModal || []),
    "div[role='dialog'].category-modal",
    "div[role='dialog']:has-text('作品标签')",
  ];
  const hit = await waitForAnySelectorAcrossFrames(page, modalSelectors, 3000);
  return hit;
}

async function openTagModal(page, config) {
  const existing = await ensureTagModalOpen(page, config);
  if (existing) return { ok: true, mode: 'already-open' };

  const triggerSelectors = [
    ...(config?.selectors?.tagTrigger || []),
    "#selectRow .select-view",
    "#selectRow .view-inner-wrap",
    "#selectRow .select-row",
    "div[id='selectRow'] .select-view",
    "div[id='selectRow'] .view-inner-wrap",
    "div[id='selectRow'] .select-row",
    "#selectRow_input .select-view",
    ".serial-form-item.cate-wrap .view-inner-wrap",
    ".serial-form-item.cate-wrap .select-row",
  ];

  await waitForAnySelectorAcrossFrames(page, triggerSelectors, 5000);

  const clicked = await clickBySelectors(page, triggerSelectors, 'tag-trigger');
  if (clicked.ok) {
    const modal = await ensureTagModalOpen(page, config);
    if (modal) return { ok: true, mode: 'selector-click', selector: clicked.selector };
  }

  const fallback = await page.evaluate(() => {
    const candidates = [
      '#selectRow .select-view',
      '#selectRow .view-inner-wrap',
      '#selectRow .select-row',
      "div[id='selectRow'] .select-view",
      "div[id='selectRow'] .view-inner-wrap",
      "div[id='selectRow'] .select-row",
      '#selectRow_input .select-view',
      '.serial-form-item.cate-wrap .select-view',
      '.serial-form-item.cate-wrap .view-inner-wrap',
      '.serial-form-item.cate-wrap .select-row',
    ];
    const isVisible = (node) => {
      if (!node) return false;
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const clickLikeUser = (node) => {
      node.scrollIntoView({ block: 'center', inline: 'nearest' });
      const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
      for (const name of events) {
        node.dispatchEvent(new MouseEvent(name, { bubbles: true, cancelable: true, view: window }));
      }
      if (typeof node.click === 'function') node.click();
      return true;
    };
    for (const selector of candidates) {
      const node = document.querySelector(selector);
      if (!isVisible(node)) continue;
      clickLikeUser(node);
      return { ok: true, selector };
    }
    return { ok: false, selector: '' };
  });

  if (fallback?.ok) {
    const modal = await ensureTagModalOpen(page, config);
    if (modal) return { ok: true, mode: 'dom-click', selector: fallback.selector };
  }

  return {
    ok: false,
    reason: 'tag_trigger_not_found',
  };
}

async function activateTagTab(page, tabName) {
  const safeTab = String(tabName || '').trim();
  if (!safeTab) return { ok: true, skipped: true };

  const result = await page.evaluate((targetTab) => {
    const dialogs = Array.from(document.querySelectorAll("div[role='dialog']"));
    const modalNode = dialogs.find((node) => (node.textContent || '').includes('作品标签'));
    if (!modalNode) return { ok: false, reason: 'modal_not_found' };

    const isVisible = (node) => {
      if (!node) return false;
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };

    const clickLikeUser = (node) => {
      if (!node) return false;
      node.scrollIntoView({ block: 'center', inline: 'nearest' });
      const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
      for (const name of events) {
        node.dispatchEvent(new MouseEvent(name, { bubbles: true, cancelable: true, view: window }));
      }
      if (typeof node.click === 'function') node.click();
      return true;
    };

    const candidates = Array.from(modalNode.querySelectorAll('*'))
      .filter((node) => {
        const text = (node.textContent || '').trim();
        if (text !== targetTab) return false;
        if (!isVisible(node)) return false;
        const className = String(node.className || '');
        return (
          node.getAttribute('role') === 'tab' ||
          className.includes('tabs-header-title') ||
          className.includes('category') ||
          className.includes('label')
        );
      });

    const hit = candidates[0];
    if (!hit) {
      return { ok: false, reason: 'tab_not_found' };
    }
    clickLikeUser(hit);
    return { ok: true };
  }, safeTab);

  if (!result?.ok) return result || { ok: false, reason: 'tab_not_found' };
  await page.waitForTimeout(250);
  return result;
}

async function pickTagFromModal(page, config, tabName, tagValue) {
  const safeTab = String(tabName || '').trim();
  const safeTag = String(tagValue || '').trim();
  if (!safeTag) return { ok: false, reason: 'empty_tag' };

  const modal = await ensureTagModalOpen(page, config);
  if (!modal) return { ok: false, reason: 'modal_not_found' };

  const tabResult = await activateTagTab(page, safeTab);
  if (!tabResult?.ok) {
    return {
      ok: false,
      reason: tabResult?.reason || 'tab_not_found',
      targetTab: safeTab,
      targetTag: safeTag,
    };
  }

  await page.waitForFunction(
    ({ targetTag }) => {
      const dialogs = Array.from(document.querySelectorAll("div[role='dialog']"));
      const modalNode = dialogs.find((node) => (node.textContent || '').includes('作品标签'));
      if (!modalNode) return false;
      const activePane =
        modalNode.querySelector('.arco-tabs-content-item-active') ||
        modalNode.querySelector(".arco-tabs-content-item[aria-hidden='false']") ||
        modalNode.querySelector('.category-choose-pane') ||
        modalNode;
      return Array.from(activePane.querySelectorAll('.category-choose-item-title')).some(
        (node) => (node.textContent || '').trim() === targetTag
      );
    },
    { targetTag: safeTag },
    { timeout: 2000 }
  ).catch(() => {});

  const result = await page.evaluate(
    ({ targetTab, targetTag }) => {
      const dialogs = Array.from(document.querySelectorAll("div[role='dialog']"));
      const modalNode = dialogs.find((node) => (node.textContent || '').includes('作品标签'));
      if (!modalNode) return { ok: false, reason: 'modal_not_found' };

      const isVisible = (node) => {
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      };

      const clickLikeUser = (node) => {
        if (!node) return false;
        node.scrollIntoView({ block: 'center', inline: 'nearest' });
        const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
        for (const name of events) {
          node.dispatchEvent(new MouseEvent(name, { bubbles: true, cancelable: true, view: window }));
        }
        if (typeof node.click === 'function') node.click();
        return true;
      };

      const clickItemByTitle = () => {
        const activePane =
          modalNode.querySelector('.arco-tabs-content-item-active') ||
          modalNode.querySelector(".arco-tabs-content-item[aria-hidden='false']") ||
          modalNode.querySelector('.category-choose-pane') ||
          modalNode;
        const titles = Array.from(activePane.querySelectorAll('.category-choose-item-title')).filter(isVisible);
        const hit = titles.find((node) => (node.textContent || '').trim() === targetTag);
        if (!hit) {
          return {
            ok: false,
            reason: 'tag_not_found_in_active_pane',
            availableTags: titles.map((node) => (node.textContent || '').trim()).filter(Boolean).slice(0, 80),
          };
        }
        const item = hit.closest('.category-choose-item');
        if (!item) return { ok: false, reason: 'tag_item_not_found' };
        clickLikeUser(item);
        return { ok: true };
      };
      const picked = clickItemByTitle();
      if (picked?.ok) {
        return { ok: true, mode: targetTab ? 'exact-tab' : 'current-tab' };
      }
      return {
        ok: false,
        reason: picked?.reason || 'tag_not_found',
        targetTab,
        targetTag,
        availableTags: picked?.availableTags || [],
      };
    },
    { targetTab: safeTab, targetTag: safeTag }
  );

  if (!result?.ok) return result || { ok: false, reason: 'unknown' };
  await page.waitForTimeout(180);
  return result;
}

async function confirmTagModal(page, config) {
  const confirm = await firstExistingLocator(page, [
    ...(config?.selectors?.tagModalConfirmButton || []),
    ".arco-modal-footer button:has-text('确认')",
    "button:has-text('确认')",
  ]);
  if (confirm) {
    await confirm.locator.click({ force: true }).catch(() => {});
    await page.waitForTimeout(220);
    return true;
  }
  await page.keyboard.press('Escape').catch(() => {});
  return false;
}

async function fillBookTags(page, config) {
  const tagPlan = normalizeTagPlan(config);
  if (!tagPlan.length) return { ok: true, skipped: true, selectedTags: [] };
  if (config?.book?.clearExistingTags) {
    await clearSelectedBookTags(page, config?.selectors || {});
  }

  const opened = await openTagModal(page, config);
  if (!opened.ok) {
    return { ok: false, reason: 'tag_trigger_not_found', selectedTags: [] };
  }

  const selectedTags = [];
  const failures = [];
  for (const item of tagPlan) {
    const picked = await pickTagFromModal(page, config, item.tab, item.value);
    if (picked?.ok) {
      selectedTags.push(item.tab ? `${item.tab}:${item.value}` : item.value);
      continue;
    }
    failures.push({
      tab: item.tab,
      value: item.value,
      reason: picked?.reason || 'pick_failed',
    });
  }
  const confirmed = await confirmTagModal(page, config);
  return {
    ok: selectedTags.length === tagPlan.length && confirmed,
    selectedTags,
    expectedTags: tagPlan.map((item) => (item.tab ? `${item.tab}:${item.value}` : item.value)),
    failures,
    confirmed,
  };
}

module.exports = {
  clickBySelectors,
  collectBookIdsFromPage,
  collectBookIdsFromResponses,
  ensureLoginState,
  fillBookTags,
  fillBySelectors,
  firstExistingLocator,
  launchBrowser,
  setupNetworkCapture,
  uploadFileBySelectors,
  waitForAnySelectorAcrossFrames,
};
