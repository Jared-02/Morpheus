# Memory Browser Browse Panel Shell Design

## Goal

Fix the browse view in Memory Browser so the search panel and file panel no longer feel visually pressed against the grid/container edges.

## Scope

### In scope
- Browse view only in `frontend/src/pages/MemoryBrowserPage.tsx`
- Visual treatment of `mb-search-panel` and `mb-files-panel`
- Reuse of existing glass-panel styling tokens already present in `frontend/src/index.css`
- Targeted frontend test coverage for the shared panel-shell hook

### Out of scope
- No change to browse view information architecture
- No DOM restructuring beyond adding a shared class
- No change to search/file interactions or data flow
- No restyle of result cards, file cards, or identity view

## Context

The current browse layout already has a grid gap:

- `frontend/src/index.css:3508-3513` defines `.mb-browse-grid` with `gap: 16px`
- `frontend/src/index.css:3543-3546` and `3649-3652` show that `mb-search-panel` and `mb-files-panel` currently only set `min-width: 0` and `overflow: hidden`

That means the main issue is not missing column gap. The issue is that both panels lack a shell: no padding, no border, no radius, and no surface separation from the page background.

## Options Considered

### Option A — Shared panel shell on both browse panels (recommended)
Add a shared class to both panels and centralize the shell styling in CSS.

**Pros**
- Smallest safe change
- Keeps layout and interactions intact
- Makes both panels feel intentionally grouped in the same design language
- Easy to verify with one targeted DOM-level test

**Cons**
- Solves presentation only; does not alter hierarchy or spacing system globally

### Option B — Add wrapper containers around each grid column
Introduce outer wrappers that own spacing and container visuals.

**Pros**
- Cleaner separation between layout and content responsibilities

**Cons**
- Requires JSX structure changes for a small issue
- Higher regression risk than necessary

### Option C — Only increase `mb-browse-grid` gap
Increase grid gap and maybe sprinkle panel margins.

**Pros**
- Fastest patch

**Cons**
- Treats the symptom, not the visual root cause
- Does not create clear panel boundaries

## Recommended Approach

Use **Option A**.

Add a shared `mb-panel-shell` class to both browse panels while keeping their existing semantic classes:

- `mb-search-panel mb-panel-shell`
- `mb-files-panel mb-panel-shell`

Then define the shell in `frontend/src/index.css` using the same token family already used by other glass containers such as `writing-toc` and `writing-logs`.

## Design

### 1. Shared shell hook in JSX
Update the two browse-view `<section>` nodes in `frontend/src/pages/MemoryBrowserPage.tsx` so they both opt into a common shell class.

This keeps the component structure stable while giving CSS a single reuse point.

### 2. Shared shell styling in CSS
Create a single `.mb-panel-shell` rule in `frontend/src/index.css` that provides:

- inner padding
- `1px` glass border
- large radius
- glass background
- backdrop blur
- subtle shadow

The browse grid itself should remain unchanged unless visual verification proves otherwise.

### 3. Responsive behavior
Keep the existing `@media (max-width: 900px)` one-column collapse for `mb-browse-grid`. On narrow screens, the shell should keep a slightly smaller padding so the panels do not feel bulky.

### 4. Testing strategy
Add one targeted test in `frontend/src/pages/__tests__/MemoryBrowserPage.test.tsx` that verifies both browse panels carry the shared `mb-panel-shell` class. This gives the visual fix a stable structural assertion without trying to test CSS pixel values in jsdom.

## Acceptance Criteria

The work is complete when:
- browse view still renders both panels
- both panels share the same `mb-panel-shell` hook
- the shell styling gives the panels visible breathing room and container boundaries
- identity view and browse interactions remain unchanged
- targeted Vitest coverage passes
- frontend build passes
