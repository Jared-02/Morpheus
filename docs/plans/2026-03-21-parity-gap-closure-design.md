# Parity Gap Closure Design

## Goal

Close the three remaining post-parity issues identified in the current OSS vs. Morpheus-pro comparison:

1. Make `character_decisions` a real supported non-commercial feature instead of a deferred half-wired field.
2. Align Graph/L4 default exposure so frontend and backend defaults no longer disagree.
3. Update README/runtime documentation so it reflects the current provider/runtime reality.

## Scope

### In scope
- Backend schema, parsing, and generation-path support for `character_decisions`
- Targeted tests covering `character_decisions` acceptance and fallback behavior
- Graph/L4 default feature-flag alignment between backend defaults and frontend defaults
- README corrections for runtime/provider support and Graph/L4 default exposure notes

### Out of scope
- Commercial-only capabilities: auth, billing, workspaces, admin
- Large new frontend UI for character decision visualization
- Reworking quality scoring heuristics beyond the minimum required to stop treating `character_decisions` as unsupported
- New product surfaces unrelated to the three identified issues

## Context

The repository now has the parity-tail work merged, but three issues remain:

- `character_decisions` was explicitly deferred in `docs/plans/2026-03-20-non-commercial-parity-tail.md`, and tests currently assert that it is ignored.
- Backend defaults `graph_feature_enabled` to `False`, while frontend `GRAPH_FEATURE_ENABLED` defaults to `true`, producing a default exposure mismatch.
- README still describes the runtime as "单 LLM：DeepSeek" even though the code now supports DeepSeek plus OpenAI-compatible providers.

## Options Considered

### Option A — Minimal closure for all three issues (recommended)
Implement the smallest end-to-end support for `character_decisions`, align Graph/L4 defaults, and fix README/runtime docs.

**Pros**
- Fixes all three issues in one round
- Keeps scope bounded
- Avoids reopening already-stable parity-tail work

**Cons**
- `character_decisions` becomes minimally supported first, not a fully expanded UX feature

### Option B — Full `character_decisions` productization now
Implement the schema plus downstream scoring, richer UI, and deeper trace presentation in one pass.

**Pros**
- Gets closer to the commercial experience immediately

**Cons**
- Significantly higher risk and broader blast radius
- Reopens areas intentionally deferred in the prior parity-tail round

### Option C — Only fix defaults and docs
Leave `character_decisions` deferred and only align Graph/L4 exposure plus README.

**Pros**
- Lowest engineering risk

**Cons**
- Does not actually close all three identified issues

## Recommended Approach

Use **Option A**.

That means:
- Treat `character_decisions` as a minimal but real supported field
- Keep Graph/L4 configurable, but align defaults
- Correct documentation to match current runtime behavior

## Design

### 1. `character_decisions` support

#### Objectives
- Accept `character_decisions` in structured plan payloads
- Store it in `ChapterPlan`
- Preserve current robustness: malformed or missing values degrade safely to an empty list
- Stop relying on tests that assert this field is ignored

#### Planned changes
- Add `CharacterDecision` model to `backend/models/__init__.py`
- Extend `ChapterPlan` with `character_decisions: List[CharacterDecision] = []`
- Update plan parsing / normalization so this field is included when valid
- Update or replace tests that currently expect the field to be discarded
- Ensure Director-output consumers do not strip the field during normal parsing

#### Non-goals for this round
- No major new frontend UI for character decision inspection
- No broad redesign of draft-quality scoring unless required for compatibility
- No schema expansion beyond what is needed for the existing planned field shape

### 2. Graph/L4 default exposure alignment

#### Objectives
- Remove the default mismatch between frontend and backend
- Preserve environment variable control
- Make default behavior consistent for local/dev users and documentation readers

#### Planned changes
- Change backend default `graph_feature_enabled` from `False` to `True`
- Keep frontend defaults unchanged if already aligned with `true`
- Verify Graph/L4 tests still pass under the new default assumptions or under explicit overrides

#### Rationale
This is a default-behavior alignment fix, not a new feature rollout. The code already supports Graph/L4 capabilities; the mismatch only affects default exposure and creates confusing behavior.

### 3. README/runtime documentation alignment

#### Objectives
- Update README so it accurately describes current runtime/provider support
- Clarify that DeepSeek remains the default path while OpenAI-compatible providers are also supported
- Clarify Graph/L4 exposure and its feature-flag nature without implying the feature is absent

#### Planned changes
- Replace the outdated runtime wording in `README.md`
- Add short clarifications where Graph/L4 is described so defaults and config behavior are consistent with the codebase
- Keep documentation edits factual and minimal

## Data Flow / Behavior Impact

### `character_decisions`
- Director/plan payload can include `character_decisions`
- Parser normalizes it into `ChapterPlan`
- Storage and later consumers see a structured field instead of silently losing it
- Invalid or absent values continue to degrade safely

### Graph/L4 defaults
- Fresh default app startup exposes Graph/L4 consistently across frontend/backend
- Deployments can still disable via env flags

### README/runtime
- Documentation matches actual provider/runtime support and reduces misleading parity conclusions

## Risk Assessment

### Primary risks
1. `character_decisions` parsing could break existing plan parsing if implemented too broadly.
2. Changing Graph defaults could expose feature paths that assume different env setup in some local deployments.
3. README edits could accidentally overstate feature support.

### Mitigations
- Use TDD with focused parser/model tests before implementation
- Keep `character_decisions` shape minimal and optional
- Preserve safe fallback behavior to empty lists
- Restrict Graph/L4 work to default alignment, not logic rewrites
- Keep README edits narrowly tied to verified code behavior

## Testing Strategy

### Backend
- Update targeted parser/model tests for `character_decisions`
- Re-run relevant studio/parser tests
- Re-run relevant API/graph tests for default exposure assumptions

### Frontend
- Re-run targeted tests only if Graph default alignment affects frontend feature-flag behavior or rendering assumptions
- If README-only for frontend docs, no extra frontend logic changes beyond verification of any touched config path

### Final verification
- Run the smallest targeted suites required for each changed subsystem
- Run broader verification if the implementation touches shared behavior beyond the targeted boundaries

## Acceptance Criteria

The work is complete when:
- `character_decisions` is a supported `ChapterPlan` field and no longer intentionally ignored
- Existing defer-only tests are replaced with positive/robustness coverage
- Backend/frontend Graph/L4 default exposure is aligned
- README no longer incorrectly states the runtime is DeepSeek-only
- Verification passes for all touched areas

## Implementation Boundaries

- Keep changes limited to the three identified issues
- Avoid unrelated refactors while touching parser, flags, or docs
- Prefer targeted compatibility-preserving edits over broad redesign

## Expected Deliverable

A small multi-file patch that closes the three known residual issues without reopening the broader parity-tail surface.