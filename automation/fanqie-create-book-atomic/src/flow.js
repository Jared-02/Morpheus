const PREVENT_CREATE_PATTERNS = [
  /一天只能创建/i,
  /每日只能创建/i,
  /每天只能创建/i,
  /今日.*已创建/i,
  /今日.*创建.*上限/i,
];

function analyzePreflightSignals({ candidateIds, pageText, bindOnlyOnPreflightHit }) {
  const ids = Array.isArray(candidateIds) ? candidateIds.filter(Boolean) : [];
  const normalizedText = String(pageText || '').replace(/\s+/g, ' ').trim();
  const matchedSignals = [];

  for (const pattern of PREVENT_CREATE_PATTERNS) {
    if (pattern.test(normalizedText)) {
      matchedSignals.push(`limit:${pattern.source}`);
    }
  }

  if (ids.length > 0) {
    matchedSignals.push(`existing-book-ids:${ids.length}`);
  }

  const hitLimitPattern = matchedSignals.some((item) => item.startsWith('limit:'));
  const bindOnly = bindOnlyOnPreflightHit !== false && hitLimitPattern;
  const allowCreate = !bindOnly;
  const reasons = [];

  if (hitLimitPattern) reasons.push('page limit signal detected');
  if (ids.length > 0) reasons.push(`detected visible book ids (note only): ${ids.join(', ')}`);
  if (allowCreate) reasons.push('no bind-only signal detected');

  return {
    allowCreate,
    bindOnly,
    reasons,
    matchedSignals,
  };
}

function makeStepResult({
  ok,
  step,
  nextStep,
  notes = [],
  artifacts = {},
  detectedIds = {},
  sessionPath = '',
  extra = {},
}) {
  return {
    ok: !!ok,
    step,
    next_step: nextStep || '',
    notes: Array.isArray(notes) ? notes : [String(notes || '')].filter(Boolean),
    artifacts,
    detected_ids: detectedIds,
    session_path: sessionPath,
    ...extra,
  };
}

module.exports = {
  analyzePreflightSignals,
  makeStepResult,
};
