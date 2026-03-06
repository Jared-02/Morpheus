# V2 Responsibility Split and Semantic Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Finish the V2 responsibility split by making project creation own long-term story constraints, making WritingConsolePage the only batch-production surface, and making ChapterWorkbenchPage the only review-and-rewrite surface.

**Architecture:** Deliver this in two phases. Phase A first aligns product semantics and API contracts (project type in L1, synopsis handling, prompt naming, continuation rules). Phase B then removes mixed responsibilities from the chapter workbench and tightens the writing console around production-only actions.

**Tech Stack:** React + TypeScript + Zustand + Vitest (frontend), FastAPI + Pydantic + pytest (backend), L1/L2/L3 memory system.

---

## Decision Baseline

This plan incorporates the following approved product decisions:

1. **Project type is chosen at project creation time** and must be written into **L1 identity memory** as a long-term constraint.
2. **Do not preserve an explicit `start_chapter_number` user-facing control.** Continuation means “continue from the current latest chapter + 1” and should remain implicit.
3. **Responsibility split is accepted in full.**
   - `WritingConsolePage` = generate new content / batch continuation / generation monitoring
   - `ChapterWorkbenchPage` = review, edit, rewrite, approve existing content

---

## Current vs V2 vs Revised Decision Table

| Area | Current Codebase | Original V2 Draft | Revised Decision for Implementation |
|---|---|---|---|
| Project creation | Has `template_id` and `synopsis` in frontend form; backend persists template metadata but does not clearly persist synopsis into L1 | Template choice + synopsis moved to project creation | Keep project-type/template selection in project creation; make it the long-term source of truth and explicitly write project type and synopsis-related identity context into L1 |
| Writing console input | Frontend uses `batch_direction`; backend batch API still uses `prompt` | Replace old prompt/synopsis input with batch-level creative direction | Formalize batch-level direction as the console’s only narrative input; unify naming across frontend/backend |
| Continuation start | Frontend currently computes latest chapter + 1 and sends `start_chapter_number` | Original V2 also proposed explicit `start_chapter` field | Keep continuation implicit; no explicit start chapter control in UI; backend may still compute internally if needed, but user does not set it |
| Scope (`volume` / `book`) | Still present in frontend and backend, and template presets recommend it | Original V2 wanted to remove console scope controls | Remove scope from user-facing decision-making if product confirms continuation/generation style is sufficiently expressed by project type + batch direction + chapter count; if backend still needs internal scope, derive it rather than exposing it |
| Chapter workbench | Still mixes one-shot creation, streaming creation, review, editing, approval, publish | Review + modify only | Remove from-scratch creation entry points from workbench; keep blueprint review, rewrite, draft edit, conflict inspection, approval, export, publish |
| Chapter rewrite hint | No `direction_hint` field in current API contract | Add chapter-level modification hint | Add explicit chapter-level rewrite direction only if needed for plan regeneration and chapter redo; keep it separate from batch direction |

---

## Phase A - Semantic and Protocol Cleanup

### Task 1: Freeze the canonical product semantics

**Files:**
- Modify: `docs/writing-console-simplification-plan.md`
- Create: `docs/plans/2026-03-06-v2-responsibility-split-plan.md`

**Step 1: Write a decision checklist into the plan**

Document these rules explicitly:

- Project type is chosen only at project creation.
- Project type contributes to long-term identity/L1 constraints.
- Writing console accepts batch direction, not story synopsis.
- Continuation is always latest chapter + 1.
- Chapter workbench never creates new chapters from scratch.

**Step 2: Review the wording against current code paths**

Check these files while drafting:

- `frontend/src/components/project/ProjectCreateModal.tsx`
- `frontend/src/pages/WritingConsolePage.tsx`
- `frontend/src/pages/ChapterWorkbenchPage.tsx`
- `backend/api/main.py`

**Step 3: Confirm plan language avoids hidden extra scope**

Make sure the plan does **not** promise:

- arbitrary chapter insertion
- multiple competing template systems
- reusing batch direction as a chapter rewrite hint

---

### Task 2: Make project type the single long-term source of truth

**Files:**
- Modify: `frontend/src/components/project/ProjectCreateModal.tsx`
- Modify: `frontend/src/stores/useProjectStore.ts`
- Modify: `backend/api/main.py`
- Modify: `backend/models/__init__.py`
- Modify: `backend/core/story_templates.py`
- Test: `backend/tests/test_api_smoke.py`

**Step 1: Write the failing backend test**

Add a test that creates a project with:

- `template_id`
- `synopsis`
- project type semantics

Then assert the resulting project identity/L1 payload contains the durable project-type constraint and the project synopsis context expected by the revised product rule.

**Step 2: Run the targeted test to verify it fails**

Run:

```bash
cd backend && python -m pytest tests/test_api_smoke.py -k "template or synopsis or identity" -v
```

Expected: the new identity assertion fails.

**Step 3: Add the minimal request/model support**

Implement only what is needed to satisfy the product decision:

- accept the necessary project creation fields in backend request parsing
- persist the needed project-level fields if they must survive reloads
- write the approved project-type and synopsis-derived context into L1 identity

**Step 4: Re-run the targeted backend tests**

Run:

```bash
cd backend && python -m pytest tests/test_api_smoke.py -k "template or synopsis or identity" -v
```

Expected: PASS.

**Step 5: Run broader backend safety checks**

Run:

```bash
cd backend && python -m pytest tests/test_api_smoke.py -v
cd backend && python -m mypy .
```

Expected: project creation, template identity, and related typing remain green.

---

### Task 3: Unify batch-generation request semantics

**Files:**
- Modify: `frontend/src/stores/useStreamStore.ts`
- Modify: `frontend/src/hooks/useSSEStream.ts`
- Modify: `frontend/src/pages/WritingConsolePage.tsx`
- Modify: `backend/api/main.py`
- Test: `frontend/src/hooks/__tests__/useSSEStream.test.ts`
- Test: `backend/tests/test_api_smoke.py`

**Step 1: Write the failing contract tests**

Add or update tests so they assert the agreed contract for batch generation:

- frontend sends the canonical field name
- backend accepts that canonical field name
- prompt preview / one-shot book endpoints use the same semantic label

**Step 2: Run frontend and backend targeted tests**

Run:

```bash
cd frontend && npm run test -- useSSEStream
cd backend && python -m pytest tests/test_api_smoke.py -k "one_shot_book or prompt_preview" -v
```

Expected: one side fails until the contract is unified.

**Step 3: Implement the minimal naming cleanup**

Choose one canonical term and make the other either:

- a compatibility alias during migration, or
- fully removed if the change is atomic

The implementation must keep these semantics distinct:

- batch direction = guidance for a batch of new chapters
- chapter rewrite hint = guidance for reworking one existing chapter

**Step 4: Re-run the targeted tests**

Run the same commands and confirm PASS.

**Step 5: Verify continuation semantics still work**

Confirm that continuation still derives from latest chapter + 1 and does not expose explicit user chapter-start controls.

---

### Task 4: Remove explicit continuation-start UX from the plan and UI contract

**Files:**
- Modify: `frontend/src/pages/WritingConsolePage.tsx`
- Modify: `frontend/src/stores/useStreamStore.ts`
- Modify: `backend/api/main.py`
- Test: `frontend/src/pages/__tests__/WritingConsolePage.test.tsx`
- Test: `backend/tests/test_api_smoke.py`

**Step 1: Write the failing tests**

Cover:

- continuation button uses latest chapter + 1
- no explicit start chapter control is rendered in the writing console
- backend still returns correct next chapter numbering for continuation

**Step 2: Run the targeted tests**

Run:

```bash
cd frontend && npm run test -- WritingConsolePage
cd backend && python -m pytest tests/test_api_smoke.py -k "continuation" -v
```

Expected: fail if old explicit-control assumptions still remain.

**Step 3: Implement the cleanup**

Keep continuation as a single product action:

- read current latest chapter number
- start next batch from latest + 1
- avoid exposing start chapter as a manual user input

**Step 4: Re-run the targeted tests**

Expected: PASS.

---

## Phase B - Responsibility Split and UI Refactor

### Task 5: Remove from-scratch creation flows from ChapterWorkbenchPage

**Files:**
- Modify: `frontend/src/pages/ChapterWorkbenchPage.tsx`
- Test: `frontend/src/pages/__tests__/ChapterWorkbenchPage.test.tsx`

**Step 1: Write the failing tests**

Add/update tests asserting the workbench no longer exposes:

- one-shot chapter creation entry
- initial stream-create button
- continue-stream-create button
- clear creation workspace button

and still exposes:

- blueprint inspection
- draft edit/save
- conflict list
- approval / reopen review
- export / publish

**Step 2: Run the targeted test file**

Run:

```bash
cd frontend && npm run test -- ChapterWorkbenchPage
```

Expected: FAIL until creation controls are removed.

**Step 3: Remove the mixed-responsibility state and handlers**

Delete or refactor only the state and handlers tied to from-scratch creation:

- one-shot creation state
- initial creation button paths
- continue creation button paths
- any misleading CTA text that implies new-chapter production belongs here

**Step 4: Re-run the same tests**

Expected: PASS.

---

### Task 6: Add explicit chapter-level modification direction where needed

**Files:**
- Modify: `frontend/src/pages/ChapterWorkbenchPage.tsx`
- Modify: `backend/api/main.py`
- Test: `frontend/src/pages/__tests__/ChapterWorkbenchPage.test.tsx`
- Test: `backend/tests/test_api_smoke.py`

**Step 1: Write failing tests for rewrite-specific guidance**

Cover these cases:

- workbench allows entering a chapter-level modification direction
- plan regeneration uses chapter-level guidance
- redo-this-chapter uses chapter-level guidance
- this guidance is not reused as batch generation direction

**Step 2: Run targeted tests**

Run:

```bash
cd frontend && npm run test -- ChapterWorkbenchPage
cd backend && python -m pytest tests/test_api_smoke.py -k "plan or draft or one_shot" -v
```

**Step 3: Implement minimal request support**

Add only the narrow contract needed for chapter rewrite guidance. Prefer the smallest change that preserves current endpoint structure and streaming behavior.

**Step 4: Re-run the targeted tests**

Expected: PASS.

---

### Task 7: Tighten WritingConsolePage into the production-only page

**Files:**
- Modify: `frontend/src/pages/WritingConsolePage.tsx`
- Modify: `frontend/src/index.css`
- Test: `frontend/src/pages/__tests__/WritingConsolePage.test.tsx`

**Step 1: Write the failing UI/behavior tests**

Assert that the console now presents:

- batch direction input
- production-only actions (start, continue from latest, stop, clear current streamed preview if still desired)
- generation monitoring (preview, logs, stats, TOC)

and does **not** present project-core inputs that belong to project creation.

**Step 2: Run the targeted tests**

Run:

```bash
cd frontend && npm run test -- WritingConsolePage
```

**Step 3: Refactor the UI minimally**

Apply the agreed product model:

- writing console = production surface only
- project type / synopsis = project creation only
- chapter rewrite = workbench only

**Step 4: Re-run tests and inspect affected selectors**

Expected: PASS.

---

### Task 8: Decide and implement final user-facing treatment of scope

**Files:**
- Modify: `frontend/src/pages/WritingConsolePage.tsx`
- Modify: `frontend/src/config/storyTemplates.ts`
- Modify: `backend/core/story_templates.py`
- Modify: `backend/api/main.py`
- Test: `frontend/src/pages/__tests__/WritingConsolePage.test.tsx`
- Test: `backend/tests/test_api_smoke.py`

**Step 1: Write failing tests for the chosen scope behavior**

Two valid final states are acceptable, but choose one and test it explicitly:

- scope removed from user-facing UI and derived internally, or
- scope kept only as a backend/internal preset concept, not as a prominent authoring choice

**Step 2: Run the targeted tests**

Run:

```bash
cd frontend && npm run test -- WritingConsolePage
cd backend && python -m pytest tests/test_api_smoke.py -k "one_shot_book or prompt_preview" -v
```

**Step 3: Implement the smallest consistent model**

Do not leave three competing meanings in the system:

- UI scope toggle
- template recommended scope
- backend required scope

Pick one source of truth and make the rest derived or compatibility-only.

**Step 4: Re-run tests**

Expected: PASS.

---

## Final Verification

### Task 9: Full regression pass for both phases

**Files:**
- Verify all touched files from Tasks 2-8

**Step 1: Run frontend targeted suites**

```bash
cd frontend && npm run test -- WritingConsolePage
cd frontend && npm run test -- ChapterWorkbenchPage
cd frontend && npm run test -- useSSEStream
```

**Step 2: Run backend targeted suites**

```bash
cd backend && python -m pytest tests/test_api_smoke.py -v
cd backend && python -m mypy .
```

**Step 3: Run lint/build checks**

```bash
cd frontend && npm run build
cd frontend && npm run lint
cd backend && python -m ruff check .
```

**Step 4: Manual verification checklist**

Confirm manually:

- project creation owns project type and synopsis
- project identity/L1 reflects long-term project constraints
- writing console starts new batch generation and continuation only
- continuation uses latest chapter + 1 without explicit chapter-start UI
- chapter workbench no longer creates new chapters from scratch
- workbench can still edit, regenerate plan, redo chapter, inspect conflicts, approve, and publish

---

## Risks to Watch During Implementation

1. **Template split-brain risk**
   - frontend local presets and backend project identity can drift unless explicitly unified.

2. **Silent field-drop risk**
   - frontend may send fields the backend ignores unless request models are updated and covered by tests.

3. **Responsibility wording drift**
   - removing buttons is not enough; helper text, empty states, and CTA copy must reinforce the new boundary.

4. **Continuation regression risk**
   - removing explicit chapter-start UX must not break implicit chapter-number progression.

---

## Suggested Commit Boundaries

1. Project creation + L1 identity persistence cleanup
2. Batch generation request contract cleanup
3. Continuation UX simplification
4. Workbench creation-removal refactor
5. Chapter rewrite guidance support
6. Writing console production-only refactor
7. Scope cleanup and final regression

---

Plan complete and saved to `docs/plans/2026-03-06-v2-responsibility-split-plan.md`.

Two execution options:

**1. Subagent-Driven (this session)** - dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - open a new session with executing-plans, batch execution with checkpoints
