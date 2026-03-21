# Memory Browser Panel Shell Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give the Memory Browser browse view a shared panel shell so the search and file panels no longer look visually glued to the grid.

**Architecture:** Keep the layout stable. Add one shared CSS hook to the two browse-view panels in `MemoryBrowserPage.tsx`, then centralize the shell styling in `index.css` using the existing glass-panel token pattern already used elsewhere in the frontend. Verify the change with a targeted DOM-level test plus a frontend build.

**Tech Stack:** React, TypeScript, Vitest, CSS

---

## Before You Start

Read these first:
- `docs/plans/2026-03-21-memory-browser-panel-shell-design.md`
- `frontend/src/pages/MemoryBrowserPage.tsx:380-615`
- `frontend/src/index.css:3508-3668`
- `frontend/src/pages/__tests__/MemoryBrowserPage.test.tsx:122-160`

Reuse the existing visual token pattern instead of inventing new colors or effects:
- `frontend/src/index.css:1477-1483` (`.writing-toc`)
- `frontend/src/index.css:1590-1597` (`.writing-logs`)

Keep scope tight:
- No DOM wrappers
- No layout redesign
- No changes outside browse view
- No card-level restyling unless a test or manual check proves it is required

---

### Task 1: Add a failing test for the shared panel-shell hook

**Files:**
- Modify: `frontend/src/pages/__tests__/MemoryBrowserPage.test.tsx:122-128`
- Reference: `frontend/src/pages/MemoryBrowserPage.tsx:380-382,574-574`

**Step 1: Write the failing test**

Add this test near the existing “defaults to browse view with search and file panels” coverage:

```ts
it('applies shared panel shell styling hooks to browse view panels', async () => {
  renderPage()

  await waitFor(() => {
    expect(screen.getByText('语义搜索')).toBeInTheDocument()
    expect(screen.getByText('记忆文件')).toBeInTheDocument()
  })

  expect(document.querySelector('.mb-search-panel')).toHaveClass('mb-panel-shell')
  expect(document.querySelector('.mb-files-panel')).toHaveClass('mb-panel-shell')
})
```

**Step 2: Run the test to verify it fails**

Run:
```bash
cd /Volumes/Work/Projects/Morpheus/frontend && npm run test -- src/pages/__tests__/MemoryBrowserPage.test.tsx -t "applies shared panel shell styling hooks to browse view panels"
```

Expected:
- FAIL because neither section has the `mb-panel-shell` class yet

**Step 3: Stop after the red test**

Do not edit implementation in this task.

---

### Task 2: Add the shared shell class in `MemoryBrowserPage.tsx`

**Files:**
- Modify: `frontend/src/pages/MemoryBrowserPage.tsx:380-382`
- Modify: `frontend/src/pages/MemoryBrowserPage.tsx:574-574`
- Test: `frontend/src/pages/__tests__/MemoryBrowserPage.test.tsx`

**Step 1: Update the search panel class**

Change:
```tsx
<section className="mb-search-panel" aria-label="记忆搜索">
```

To:
```tsx
<section className="mb-search-panel mb-panel-shell" aria-label="记忆搜索">
```

**Step 2: Update the files panel class**

Change:
```tsx
<section className="mb-files-panel" aria-label="记忆文件总览">
```

To:
```tsx
<section className="mb-files-panel mb-panel-shell" aria-label="记忆文件总览">
```

**Step 3: Re-run the targeted test**

Run:
```bash
cd /Volumes/Work/Projects/Morpheus/frontend && npm run test -- src/pages/__tests__/MemoryBrowserPage.test.tsx -t "applies shared panel shell styling hooks to browse view panels"
```

Expected:
- PASS

**Step 4: Checkpoint**

No commit unless the user explicitly asks for one.

---

### Task 3: Implement the shared shell styling in `index.css`

**Files:**
- Modify: `frontend/src/index.css:3543-3546`
- Modify: `frontend/src/index.css:3649-3652`
- Add/Modify: `frontend/src/index.css:3521-3668`
- Reference: `frontend/src/index.css:1477-1483,1590-1597`

**Step 1: Replace the duplicated bare panel rules with one shared shell rule**

Add a shared rule near the browse-grid section:

```css
.mb-panel-shell {
  min-width: 0;
  overflow: hidden;
  padding: 14px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  background: var(--glass);
  backdrop-filter: blur(20px);
  box-shadow: var(--shadow-sm);
}
```

**Step 2: Keep panel-specific classes only for panel-specific behavior**

If `mb-search-panel` and `mb-files-panel` have no unique rules left, delete the old duplicated two-line blocks instead of keeping dead CSS.

**Step 3: Add a narrow-screen padding adjustment only if needed**

Inside the existing `@media (max-width: 900px)` block, add this only if the desktop padding feels too heavy on one-column mobile layout:

```css
.mb-panel-shell {
  padding: 12px;
}
```

Do **not** touch `mb-browse-grid` gap unless manual verification shows the shell alone is insufficient.

**Step 4: Run the targeted page tests**

Run:
```bash
cd /Volumes/Work/Projects/Morpheus/frontend && npm run test -- src/pages/__tests__/MemoryBrowserPage.test.tsx
```

Expected:
- PASS

**Step 5: Run the frontend build**

Run:
```bash
cd /Volumes/Work/Projects/Morpheus/frontend && npm run build
```

Expected:
- PASS with no TypeScript or CSS build errors

---

### Task 4: Manual visual verification of the browse view

**Files:**
- Verify: `frontend/src/pages/MemoryBrowserPage.tsx`
- Verify: `frontend/src/index.css`

**Step 1: Start the frontend with the backend-aligned proxy**

Run:
```bash
cd /Volumes/Work/Projects/Morpheus/frontend && VITE_API_PROXY_TARGET=http://localhost:8000 npm run dev
```

**Step 2: Open the Memory Browser browse view**

Navigate to the project’s memory browser page and confirm:
- search panel and file panel have visible container boundaries
- panel content no longer feels flush with the outer edges
- browse layout still remains two columns on desktop
- browse layout still collapses to one column below `900px`

**Step 3: Verify non-goals stayed untouched**

Confirm:
- search still works
- file refresh still works
- file list expansion still works
- identity view is unchanged

**Step 4: Checkpoint**

No commit unless the user explicitly asks for one.
