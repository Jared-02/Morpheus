#!/usr/bin/env node

const { ROOT, loadConfig } = require('./utils');
const { createSessionStore } = require('./sessionStore');
const { launchBrowser } = require('./browser');

const stepModules = {
  preflight: require('./steps/preflight'),
  'open-create': require('./steps/openCreate'),
  'fill-basic': require('./steps/fillBasic'),
  'fill-tags': require('./steps/fillTags'),
  'fill-intro': require('./steps/fillIntro'),
  'upload-cover': require('./steps/uploadCover'),
  'await-submit': require('./steps/awaitSubmit'),
  'capture-book-id': require('./steps/captureBookId'),
  'bind-book': require('./steps/bindBook'),
  'detect-existing-books': require('./steps/detectExistingBooks'),
};

const createSequence = [
  'open-create',
  'fill-basic',
  'fill-tags',
  'fill-intro',
  'upload-cover',
  'await-submit',
  'capture-book-id',
  'bind-book',
];

async function runStep(stepName, env) {
  const step = stepModules[stepName];
  if (!step) {
    throw new Error(`Unknown step: ${stepName}`);
  }
  console.log(`\n[step] ${stepName}`);
  const result = await step.run(env);
  console.log(JSON.stringify(result, null, 2));
  return result;
}

async function runGuided(config, store) {
  const runtime = await launchBrowser(ROOT, config);
  try {
    const baseEnv = {
      rootDir: ROOT,
      config,
      store,
      args: [],
      ...runtime,
    };

    const preflight = await runStep('preflight', baseEnv);
    if (preflight.preflight?.bind_only) {
      await runStep('detect-existing-books', baseEnv);
      await runStep('bind-book', {
        rootDir: ROOT,
        config: { ...config, flow: { ...(config.flow || {}), mode: 'guided' } },
        store,
        args: [],
      });
      return;
    }

    for (const stepName of createSequence) {
      if (stepName === 'bind-book') {
        await runStep(stepName, {
          rootDir: ROOT,
          config: { ...config, flow: { ...(config.flow || {}), mode: 'guided' } },
          store,
          args: [],
        });
      } else {
        await runStep(stepName, baseEnv);
      }
    }
  } finally {
    await runtime.context.close();
  }
}

async function runOpenLogin(config) {
  const runtime = await launchBrowser(ROOT, {
    ...config,
    browser: {
      ...(config.browser || {}),
      headless: false,
    },
  });
  const timeoutMs = Math.max(60_000, Number(config?.timeouts?.loginWindowMs || 600_000));
  const endAt = Date.now() + timeoutMs;
  try {
    await runtime.page.goto(config?.urls?.writerHome || 'https://fanqienovel.com/main/writer/?enter_from=author_zone', {
      waitUntil: 'domcontentloaded',
      timeout: Number(config?.timeouts?.defaultMs || 15000),
    });
    console.log('[info] fanqie login window opened');
    while (Date.now() < endAt) {
      const cookies = await runtime.context.cookies('https://fanqienovel.com').catch(() => []);
      const hasSession = cookies.some((cookie) => ['sessionid', 'sessionid_ss', 'sid_tt'].includes(cookie.name) && cookie.value);
      if (hasSession) {
        console.log('[result] login_ready=true');
        await runtime.page.waitForTimeout(1200);
        return;
      }
      await runtime.page.waitForTimeout(1000);
    }
    console.log('[warn] login window timeout without detected session cookie');
  } finally {
    await runtime.context.close().catch(() => {});
  }
}

async function main() {
  const mode = String(process.argv[2] || 'guided').trim();
  const extraArgs = process.argv.slice(3);
  const config = loadConfig(ROOT);
  const store = createSessionStore(ROOT, config);

  if (mode === 'guided') {
    await runGuided(config, store);
    return;
  }

  if (mode === 'open-login') {
    await runOpenLogin(config);
    return;
  }

  if (mode !== 'step') {
    throw new Error(`Unknown mode: ${mode}`);
  }

  const stepName = String(extraArgs[0] || '').trim();
  if (!stepName) {
    throw new Error('Usage: node src/index.js step <step-name> [args...]');
  }
  const args = extraArgs.slice(1);
  const step = stepModules[stepName];
  if (!step) {
    throw new Error(`Unknown step: ${stepName}`);
  }

  if (step.needsBrowser === false) {
    await runStep(stepName, {
      rootDir: ROOT,
      config,
      store,
      args,
    });
    return;
  }

  const runtime = await launchBrowser(ROOT, config);
  try {
    await runStep(stepName, {
      rootDir: ROOT,
      config,
      store,
      args,
      ...runtime,
    });
  } finally {
    await runtime.context.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
