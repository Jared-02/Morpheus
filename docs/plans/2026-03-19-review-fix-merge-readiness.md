# Review Fixes for Merge Readiness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all validated review findings from the Morpheus-pro migration until the branch is mergeable.

**Architecture:** Apply targeted, test-first fixes in five slices: backend LLM streaming/runtime, backend approval and PATCH consistency, studio scoring and constraint extraction, frontend SSE session isolation and UX wiring, then full verification plus repeat Codex review. Each slice stays minimal and only addresses validated issues.

**Tech Stack:** FastAPI, Pydantic v2, requests/OpenAI SDK, React, TypeScript, Zustand, Vitest, pytest

---

### Task 1: Backend LLM stream fallback and provider defaults

**Files:**
- Modify: `backend/core/llm_client.py`
- Create: `backend/tests/test_llm_client.py`
- Verify: `backend/pyproject.toml`

**Step 1: Write the failing tests**

Add tests for:
- `chat_stream_text()` yields offline text when remote stream creation fails
- `LLMConfig(provider=OPENAI_COMPATIBLE)` uses OpenAI-compatible defaults when model fields are omitted
- `chat_stream_text(..., on_usage=...)` marks fallback usage as estimated and uses actual emitted text for estimation

**Step 2: Run test to verify it fails**

Run: `cd backend && poetry run python -m pytest tests/test_llm_client.py -v`
Expected: FAIL on empty stream / wrong defaults / wrong estimation behavior

**Step 3: Write minimal implementation**

Update `backend/core/llm_client.py` to:
- separate non-stream `chat()` fallback from stream iteration behavior
- avoid treating offline string as SDK chunk iterator
- set OpenAI-compatible default chat/embedding models when provider is `OPENAI_COMPATIBLE`
- request stream usage if supported and estimate completion tokens from real emitted text
- close stream response if it exposes `close()`

**Step 4: Run test to verify it passes**

Run: `cd backend && poetry run python -m pytest tests/test_llm_client.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/core/llm_client.py backend/tests/test_llm_client.py
git commit -m "fix(llm): 修复流式回退空输出与 OpenAI 兼容默认值"
```

### Task 2: Review approval and project PATCH consistency

**Files:**
- Modify: `backend/api/main.py`
- Modify: `backend/tests/test_api_smoke.py`
- Modify: `backend/tests/test_v2_semantics.py` if API semantics assertions need updates

**Step 1: Write the failing tests**

Add tests for:
- `RESCAN` on empty draft cannot be approved
- `PATCH /api/projects/{project_id}` updates identity-derived content after changing synopsis/style/taboos
- `PATCH /api/projects/{project_id}` normalizes `fanqie_book_id`
- unsupported/no-op payload returns a non-success validation error if intended by the new contract

**Step 2: Run test to verify it fails**

Run: `cd backend && poetry run python -m pytest tests/test_api_smoke.py -v`
Expected: FAIL on approval flow and PATCH consistency cases

**Step 3: Write minimal implementation**

Update `backend/api/main.py` to:
- block approval when no persisted draft/final exists
- rebuild/sync identity after PATCH updates that affect derived identity
- reuse fanqie normalization/binding helper
- tighten PATCH response semantics for unsupported/no-op bodies without regressing accepted `scope` behavior on one-shot endpoints

**Step 4: Run test to verify it passes**

Run: `cd backend && poetry run python -m pytest tests/test_api_smoke.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/api/main.py backend/tests/test_api_smoke.py backend/tests/test_v2_semantics.py
git commit -m "fix(api): 修复审核空稿通过与项目补丁派生状态不同步"
```

### Task 3: Studio scoring and constraint extraction correctness

**Files:**
- Modify: `backend/agents/studio.py`
- Modify: `backend/core/chapter_craft.py`
- Modify: `backend/tests/test_api_smoke.py`
- Modify or create focused tests near plan/scoring logic if better isolated

**Step 1: Write the failing tests**

Add tests for:
- draft quality scoring uses actual `target_words`
- quality scoring/retry failures degrade to first draft instead of failing request
- `build_locked_facts()` recognizes localized `状态`
- `build_setter_constraints()` actually narrows by `beats`
- `character_decisions` is either fully wired through parse/build path or deliberately removed from migration surface with tests reflecting the chosen state

**Step 2: Run test to verify it fails**

Run: `cd backend && poetry run python -m pytest tests/test_api_smoke.py -v`
Expected: FAIL on target word propagation / constraints behavior

**Step 3: Write minimal implementation**

Update backend generation code to:
- include `target_words` in `draft_context`
- guard optional scoring/retry path with fallback-to-first-draft behavior
- make constraint extraction match documented contract
- keep prompt payload data-shaped and bounded
- resolve `character_decisions` consistency one way or the other without half-wired schema drift

**Step 4: Run test to verify it passes**

Run: `cd backend && poetry run python -m pytest tests/test_api_smoke.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/agents/studio.py backend/core/chapter_craft.py backend/tests/test_api_smoke.py backend/models/__init__.py
git commit -m "fix(studio): 修复质量评分链路与约束提取正确性"
```

### Task 4: Frontend SSE session isolation and UX wiring

**Files:**
- Modify: `frontend/src/hooks/useSSEStream.ts`
- Modify: `frontend/src/pages/WritingConsolePage.tsx`
- Modify: `frontend/src/pages/ChapterWorkbenchPage.tsx`
- Modify: `frontend/src/stores/useProjectStore.ts`
- Modify: `frontend/src/pages/__tests__/WritingConsolePage.test.tsx`
- Create or modify: `frontend/src/hooks/__tests__/useSSEStream.test.ts`

**Step 1: Write the failing tests**

Add tests for:
- `stop()` then immediate restart does not allow stale events from prior stream to mutate state
- `guideGenerationError()` is used to present guided UI errors
- first-chapter onboarding recovers cleanly when chapter fetch fails
- `book_id` input reflects store updates after save/fetch

**Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/hooks/__tests__/useSSEStream.test.ts src/pages/__tests__/WritingConsolePage.test.tsx`
Expected: FAIL on stale stream and onboarding/error wiring cases

**Step 3: Write minimal implementation**

Update frontend code to:
- capture and validate session revision around every SSE write path
- wire guided error presentation into start/continue flows
- make first-chapter onboarding effect retry-safe and dependency-correct
- convert `book_id` input to controlled state or otherwise keep it synchronized with project store refreshes

**Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/hooks/__tests__/useSSEStream.test.ts src/pages/__tests__/WritingConsolePage.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/hooks/useSSEStream.ts frontend/src/pages/WritingConsolePage.tsx frontend/src/pages/ChapterWorkbenchPage.tsx frontend/src/stores/useProjectStore.ts frontend/src/pages/__tests__/WritingConsolePage.test.tsx frontend/src/hooks/__tests__/useSSEStream.test.ts
git commit -m "fix(frontend): 修复流会话隔离与错误引导接线"
```

### Task 5: Full verification and repeat Codex review

**Files:**
- Verify current modified files only

**Step 1: Run backend verification**

Run: `cd backend && poetry run python -m pytest -v`
Expected: PASS

**Step 2: Run frontend verification**

Run: `cd frontend && npx vitest run`
Expected: PASS

**Step 3: Run focused lint/type verification as needed**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

**Step 4: Repeat Codex-only review on current diff**

Run the same Codex review workflow against the new diff.
Expected: no Critical issues; only minor/non-blocking suggestions acceptable

**Step 5: Commit any final follow-up fixes**

```bash
git add <changed-files>
git commit -m "fix(review): 收敛复核问题并达到可合并状态"
```
