# Non-Commercial Parity Tail Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the remaining high-value non-commercial Morpheus parity gaps without reopening already-stable merge-ready work or expanding into optional edge features.

**Architecture:** Tighten the backend one-shot contract around the canonical `batch_direction` field, wire bounded structured memory (`entities` / `events`) into every generation path, and finish the embedding client migration onto the existing OpenAI-compatible runtime. On the frontend, remove leftover compatibility-only fields and drive first-chapter onboarding from `has_persisted_content` instead of raw chapter count so placeholder chapters do not suppress onboarding.

**Tech Stack:** FastAPI, Pydantic v2, OpenAI Python SDK, React, TypeScript, Zustand, pytest, Vitest

**Execution Notes:** Use `@superpowers:test-driven-development` for Tasks 1-4, `@superpowers:requesting-code-review` after each task-sized commit, and `@superpowers:verification-before-completion` before Task 5 completion claims.

---

### Task 1: Narrow the one-shot contract and make `scope` real

**Files:**
- Modify: `backend/api/main.py:1645-1735`
- Modify: `backend/api/main.py:2836-2850`
- Modify: `backend/api/main.py:4220-4274`
- Modify: `backend/api/main.py:4630-4669`
- Modify: `backend/tests/test_api_smoke.py:1542-1560`
- Modify: `backend/tests/test_v2_semantics.py:52-130`

**Step 1: Write the failing tests**

Add these tests.

```python
# backend/tests/test_api_smoke.py

def test_build_outline_messages_include_scope_and_batch_direction(self):
    project_id = self._create_project()
    project = projects[project_id]

    messages = build_outline_messages(
        prompt="雪夜复仇",
        chapter_count=4,
        project=project,
        identity="IDENTITY",
        continuation_mode=False,
        batch_direction="主角潜伏反击",
        scope="volume",
    )

    payload = json.loads(messages[1]["content"])
    self.assertEqual(payload["scope"], "volume")
    self.assertIn("主角潜伏反击", messages[1]["content"])
```

```python
# backend/tests/test_v2_semantics.py

def test_one_shot_book_rejects_legacy_prompt_field(self):
    create_res = self.client.post(
        "/api/projects",
        json={
            "name": f"旧prompt项目-{uuid4().hex[:8]}",
            "genre": "奇幻",
            "style": "冷峻",
            "target_length": 300000,
            "taboo_constraints": [],
        },
    )
    self.assertEqual(create_res.status_code, 200)
    project_id = create_res.json()["id"]

    batch_res = self.client.post(
        f"/api/projects/{project_id}/one-shot-book",
        json={
            "prompt": "旧字段",
            "mode": "quick",
            "chapter_count": 1,
            "words_per_chapter": 700,
        },
    )
    self.assertEqual(batch_res.status_code, 422)


def test_one_shot_book_rejects_unknown_fields(self):
    create_res = self.client.post(
        "/api/projects",
        json={
            "name": f"未知字段项目-{uuid4().hex[:8]}",
            "genre": "奇幻",
            "style": "冷峻",
            "target_length": 300000,
            "taboo_constraints": [],
        },
    )
    self.assertEqual(create_res.status_code, 200)
    project_id = create_res.json()["id"]

    batch_res = self.client.post(
        f"/api/projects/{project_id}/one-shot-book",
        json={
            "batch_direction": "测试未知字段被拒绝。",
            "mode": "quick",
            "chapter_count": 1,
            "words_per_chapter": 700,
            "start_chapter_number": 99,
        },
    )
    self.assertEqual(batch_res.status_code, 422)
```

**Step 2: Run test to verify it fails**

Run:

```bash
cd /Volumes/Work/Projects/Morpheus/backend && poetry run python -m pytest tests/test_api_smoke.py tests/test_v2_semantics.py -v
```

Expected: FAIL because `scope` is not yet present in the outline payload and the one-shot request model still ignores legacy/unknown fields.

**Step 3: Write minimal implementation**

Update `backend/api/main.py` so the one-shot endpoints use `batch_direction` as the only canonical story-direction field while still allowing explicit `scope`.

```python
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class OneShotBookRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    batch_direction: str = Field(min_length=1)
    scope: Literal["volume", "book"] | None = None
    mode: GenerationMode = GenerationMode.STUDIO
    chapter_count: int | None = Field(default=None, ge=1, le=60)
    words_per_chapter: int = Field(default=1600, ge=300, le=12000)
    auto_approve: bool = False
    continuation_mode: bool = False
```

```python
def build_outline_messages(
    *,
    prompt: str,
    chapter_count: int,
    project: Project,
    identity: str,
    continuation_mode: bool = False,
    batch_direction: str | None = None,
    scope: str | None = None,
) -> List[Dict[str, str]]:
    ...
    payload = {
        "task": "根据一句话梗概拆成章节蓝图",
        "chapter_count": chapter_count,
        "prompt": prompt,
        "genre": project.genre,
        "style": project.style,
        "identity": identity,
        "continuation_mode": continuation_mode,
        "scope": scope,
        ...
    }
```

```python
async def generate_one_shot_book(project_id: str, req: OneShotBookRequest):
    direction = req.batch_direction.strip()
    if not direction:
        raise HTTPException(status_code=400, detail="batch_direction is required")
    ...
```

Also pass `scope=req.scope` into `build_chapter_outline(...)` and keep `PromptPreviewRequest` untouched.

**Step 4: Run test to verify it passes**

Run:

```bash
cd /Volumes/Work/Projects/Morpheus/backend && poetry run python -m pytest tests/test_api_smoke.py tests/test_v2_semantics.py -v
```

Expected: PASS.

**Step 5: Commit**

```bash
git add backend/api/main.py backend/tests/test_api_smoke.py backend/tests/test_v2_semantics.py
git commit -m "fix(api): 收口 one-shot 契约并接通 scope 提示"
```

---

### Task 2: Inject bounded structured `entities` / `events` into all generation paths

**Files:**
- Modify: `backend/core/chapter_craft.py:472-595`
- Modify: `backend/api/main.py:1894-1906`
- Modify: `backend/api/main.py:2207-2226`
- Modify: `backend/api/main.py:2598-2616`
- Modify: `backend/api/main.py:5397-5412`
- Modify: `backend/api/main.py:5556-5571`
- Modify: `backend/tests/test_api_smoke.py`
- Modify: `backend/tests/test_studio_plan_parser.py:1-160`

**Step 1: Write the failing tests**

Add a focused helper test for bounded structured memory and a payload test for one-shot generation.

```python
# backend/tests/test_studio_plan_parser.py

def test_build_generation_memory_window_returns_bounded_entities_and_events(self):
    entities = [
        EntityState(
            name="陈砚",
            type="character",
            attrs={"status": "负伤", "location": "旧镜城"},
            constraints=["不能暴露身份"],
            first_seen_chapter=1,
            last_seen_chapter=6,
        )
    ]
    events = [
        EventEdge(
            subject="陈砚",
            relation="encountered",
            object="旧镜城守卫",
            chapter=5,
            confidence=0.95,
            description="在钟楼下短暂交锋",
        )
    ]

    window = build_generation_memory_window(
        entities=entities,
        events=events,
        chapter_number=6,
        beats=["陈砚在旧镜城躲避守卫并处理伤势。"],
    )

    self.assertEqual(window["entities"][0]["name"], "陈砚")
    self.assertTrue(window["events"])
```

```python
# backend/tests/test_api_smoke.py

def test_build_one_shot_messages_include_structured_entities_and_events(self):
    project_id = self._create_project()
    chapter_id = self._create_chapter(project_id)
    chapter = chapters[chapter_id]
    store = get_or_create_store(project_id)

    store.entity_states = [
        EntityState(
            name="陈砚",
            type="character",
            attrs={"status": "负伤", "location": "旧镜城"},
            constraints=["不能暴露身份"],
            first_seen_chapter=1,
            last_seen_chapter=1,
        )
    ]
    store.event_edges = [
        EventEdge(
            subject="陈砚",
            relation="encountered",
            object="守卫",
            chapter=1,
            confidence=0.95,
            description="钟楼交锋",
        )
    ]

    messages = build_one_shot_messages(
        chapter=chapter,
        project=projects[project_id],
        store=store,
        premise="继续写",
        req=OneShotRequest(prompt="继续写", target_words=1600),
    )

    payload = json.loads(messages[1]["content"])
    self.assertIn("entities", payload)
    self.assertIn("events", payload)
```

**Step 2: Run test to verify it fails**

Run:

```bash
cd /Volumes/Work/Projects/Morpheus/backend && poetry run python -m pytest tests/test_api_smoke.py tests/test_studio_plan_parser.py -v
```

Expected: FAIL because the bounded structured memory helper does not exist yet and the generation payloads only include `locked_facts` / `setter_constraints`.

**Step 3: Write minimal implementation**

Add one bounded serializer in `backend/core/chapter_craft.py`, then reuse it everywhere.

```python
def build_generation_memory_window(
    *,
    entities: List["EntityState"],
    events: List["EventEdge"],
    chapter_number: int,
    beats: List[str],
    window: int = 3,
) -> Dict[str, List[Dict[str, Any]]]:
    active_entities = ...
    recent_events = ...
    return {
        "entities": [
            {
                "name": entity.name,
                "type": entity.type,
                "attrs": entity.attrs,
                "constraints": entity.constraints[:3],
            }
            for entity in active_entities[:5]
        ],
        "events": [
            {
                "subject": event.subject,
                "relation": event.relation,
                "object": event.object,
                "chapter": event.chapter,
                "description": event.description,
            }
            for event in recent_events[:6]
        ],
    }
```

```python
def _build_generation_constraints(store: MemoryStore, chapter: "Chapter") -> Dict[str, Any]:
    entities = store.get_all_entities() if settings.graph_feature_enabled else []
    events = store.get_all_events() if settings.graph_feature_enabled else []
    structured = build_generation_memory_window(
        entities=entities,
        events=events,
        chapter_number=chapter.chapter_number,
        beats=chapter.plan.beats if chapter.plan else [],
    )
    return {
        "locked_facts": build_locked_facts(...),
        "setter_constraints": build_setter_constraints(...),
        "entities": structured["entities"],
        "events": structured["events"],
    }
```

Then add `entities` and `events` to:
- `build_one_shot_messages(...)`
- one-shot draft context in `backend/api/main.py:2598-2616`
- draft regeneration context in `backend/api/main.py:5397-5412`
- stream draft context in `backend/api/main.py:5556-5571`

**Step 4: Run test to verify it passes**

Run:

```bash
cd /Volumes/Work/Projects/Morpheus/backend && poetry run python -m pytest tests/test_api_smoke.py tests/test_studio_plan_parser.py -v
```

Expected: PASS.

**Step 5: Commit**

```bash
git add backend/core/chapter_craft.py backend/api/main.py backend/tests/test_api_smoke.py backend/tests/test_studio_plan_parser.py
git commit -m "feat(context): 注入结构化实体事件上下文"
```

---

### Task 3: Finish the embedding runtime migration onto the OpenAI-compatible client

**Files:**
- Modify: `backend/core/llm_client.py:393-455`
- Modify: `backend/tests/test_llm_client.py:1-145`

**Step 1: Write the failing tests**

Extend `backend/tests/test_llm_client.py` with explicit embedding client tests.

```python
class FakeEmbeddingsClient:
    def __init__(self, response=None, exc=None):
        self._response = response
        self._exc = exc
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if self._exc:
            raise self._exc
        return self._response


def test_embed_text_uses_openai_embeddings_client():
    fake_embeddings = FakeEmbeddingsClient(
        response=types.SimpleNamespace(
            data=[types.SimpleNamespace(embedding=[0.1, 0.2, 0.3])]
        )
    )
    client = LLMClient(LLMConfig(provider=LLMProvider.OPENAI_COMPATIBLE, api_key="k", model="gpt-4o"))
    client._client = types.SimpleNamespace(embeddings=fake_embeddings)

    assert client.embed_text("hello") == [0.1, 0.2, 0.3]
    assert fake_embeddings.calls[0]["model"] == client.config.embedding_model


def test_embed_batch_falls_back_to_offline_when_embeddings_create_fails():
    fake_embeddings = FakeEmbeddingsClient(exc=RuntimeError("boom"))
    client = LLMClient(LLMConfig(provider=LLMProvider.OPENAI_COMPATIBLE, api_key="k", model="gpt-4o"))
    client._client = types.SimpleNamespace(embeddings=fake_embeddings)

    result = client.embed_batch(["a", "b"])

    assert len(result) == 2
    assert all(isinstance(item, list) for item in result)
```

**Step 2: Run test to verify it fails**

Run:

```bash
cd /Volumes/Work/Projects/Morpheus/backend && poetry run python -m pytest tests/test_llm_client.py -v
```

Expected: FAIL because embeddings still use raw `requests.post(...)` instead of the existing SDK client.

**Step 3: Write minimal implementation**

Reuse the already-lazy SDK client for embeddings too.

```python
def _embed_via_api(self, text: str) -> List[float]:
    if not self.config.api_key:
        self._warn_offline_once("embedding_missing_api_key")
        return self._offline_embedding(text)
    try:
        client = self._get_openai_client()
        response = client.embeddings.create(
            model=self.config.embedding_model,
            input=text,
        )
        embedding = response.data[0].embedding if response.data else None
        if not isinstance(embedding, list):
            raise ValueError("embedding response missing embedding")
        return embedding
    except Exception as exc:
        self._logger.warning(...)
        return self._offline_embedding(text)
```

```python
def _embed_batch_via_api(self, texts: List[str]) -> List[List[float]]:
    if not self.config.api_key:
        self._warn_offline_once("embedding_batch_missing_api_key")
        return [self._offline_embedding(text) for text in texts]
    try:
        client = self._get_openai_client()
        response = client.embeddings.create(
            model=self.config.embedding_model,
            input=texts,
        )
        return [item.embedding for item in response.data]
    except Exception as exc:
        self._logger.warning(...)
        return [self._offline_embedding(text) for text in texts]
```

Delete the now-unused request-header-only embedding path if it becomes dead code.

**Step 4: Run test to verify it passes**

Run:

```bash
cd /Volumes/Work/Projects/Morpheus/backend && poetry run python -m pytest tests/test_llm_client.py -v
```

Expected: PASS.

**Step 5: Commit**

```bash
git add backend/core/llm_client.py backend/tests/test_llm_client.py
git commit -m "refactor(llm): 统一 embedding 走 OpenAI 兼容客户端"
```

---

### Task 4: Drive first-chapter onboarding from persisted content and remove leftover frontend compatibility fields

**Files:**
- Modify: `frontend/src/stores/useProjectStore.ts:37-46`
- Modify: `frontend/src/stores/useStreamStore.ts:36-46`
- Modify: `frontend/src/pages/WritingConsolePage.tsx:161-167`
- Modify: `frontend/src/pages/WritingConsolePage.tsx:305-331`
- Modify: `frontend/src/pages/WritingConsolePage.tsx:517-535`
- Modify: `frontend/src/hooks/useSSEStream.ts:293-300` if type inference needs help after `GenerationForm` tightening
- Modify: `frontend/src/pages/__tests__/WritingConsolePage.test.tsx:276-328`
- Modify: `frontend/src/hooks/__tests__/useSSEStream.test.ts:243-275`

**Step 1: Write the failing tests**

Update the onboarding tests to distinguish placeholder chapters from persisted chapters.

```tsx
it('entry=first-chapter 且仅有空壳章节时仍显示首章引导', async () => {
    mockApiGet.mockResolvedValue({
        data: [{ id: 'ch-1', chapter_number: 1, has_persisted_content: false }],
    })
    renderPage('/project/proj-1/write?entry=first-chapter')
    await waitFor(() => {
        expect(screen.getByText('开始你的第一章')).toBeTruthy()
    })
})

it('entry=first-chapter 且已有持久化正文时不显示首章引导', async () => {
    mockApiGet.mockResolvedValue({
        data: [{ id: 'ch-1', chapter_number: 1, has_persisted_content: true }],
    })
    renderPage('/project/proj-1/write?entry=first-chapter')
    await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalled()
    })
    expect(screen.queryByText('开始你的第一章')).toBeNull()
})
```

Keep the canonical SSE payload test, but let TypeScript prove that `GenerationForm` no longer carries `prompt` / `scope` / `start_chapter_number`.

**Step 2: Run test to verify it fails**

Run:

```bash
cd /Volumes/Work/Projects/Morpheus/frontend && npx vitest run src/pages/__tests__/WritingConsolePage.test.tsx src/hooks/__tests__/useSSEStream.test.ts
```

Expected: FAIL because onboarding still uses `list.length === 0` and the frontend store types do not expose `has_persisted_content`.

**Step 3: Write minimal implementation**

Tighten the frontend types and switch onboarding to the persisted-content check.

```ts
// frontend/src/stores/useProjectStore.ts
export interface ChapterItem {
    id: string
    chapter_number: number
    title: string
    goal: string
    synopsis: string
    status: string
    word_count: number
    conflict_count: number
    has_persisted_content?: boolean
}
```

```ts
// frontend/src/stores/useStreamStore.ts
export interface GenerationForm {
    batch_direction: string
    mode: 'studio' | 'quick' | 'cinematic'
    chapter_count: number
    words_per_chapter: number
    auto_approve: boolean
    continuation_mode?: boolean
}
```

```ts
// frontend/src/pages/WritingConsolePage.tsx
api.get(`/projects/${projectId}/chapters`)
    .then((res) => {
        const list = Array.isArray(res.data) ? res.data : []
        const hasPersistedChapter = list.some((item) => Boolean(item?.has_persisted_content))
        if (!hasPersistedChapter) {
            setFirstChapterMode(true)
            setForm((prev) => ({ ...prev, chapter_count: 1 }))
            setChapterCountInput('1')
            addToast('info', '首次创作：已为你预设生成 1 章，填写创作方向后点击「开始生成」即可。')
        }
        firstChapterCheckedRef.current = true
        clearFirstChapterEntry(setSearchParams)
    })
```

Do not reintroduce `scope`, `prompt`, or `start_chapter_number` to the frontend form state.

**Step 4: Run test to verify it passes**

Run:

```bash
cd /Volumes/Work/Projects/Morpheus/frontend && npx vitest run src/pages/__tests__/WritingConsolePage.test.tsx src/hooks/__tests__/useSSEStream.test.ts && npx tsc --noEmit
```

Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/stores/useProjectStore.ts frontend/src/stores/useStreamStore.ts frontend/src/pages/WritingConsolePage.tsx frontend/src/hooks/useSSEStream.ts frontend/src/pages/__tests__/WritingConsolePage.test.tsx frontend/src/hooks/__tests__/useSSEStream.test.ts
git commit -m "fix(frontend): 用 persisted content 驱动首章引导并清理表单残留"
```

---

### Task 5: Run full parity-tail verification and one more review pass

**Files:**
- Verify the files changed in Tasks 1-4 only

**Step 1: Run backend verification**

Run:

```bash
cd /Volumes/Work/Projects/Morpheus/backend && poetry run python -m pytest tests/test_api_smoke.py tests/test_llm_client.py tests/test_studio_plan_parser.py tests/test_v2_semantics.py -v
```

Expected: PASS.

**Step 2: Run focused frontend verification**

Run:

```bash
cd /Volumes/Work/Projects/Morpheus/frontend && npx vitest run src/pages/__tests__/WritingConsolePage.test.tsx src/hooks/__tests__/useSSEStream.test.ts
```

Expected: PASS.

**Step 3: Run full frontend verification**

Run:

```bash
cd /Volumes/Work/Projects/Morpheus/frontend && npx vitest run
```

Expected: PASS.

**Step 4: Run frontend type verification**

Run:

```bash
cd /Volumes/Work/Projects/Morpheus/frontend && npx tsc --noEmit
```

Expected: PASS.

**Step 5: Request one more code review and commit follow-up fixes if needed**

Run `@superpowers:requesting-code-review` on the final diff. If review or verification forces a tiny follow-up change, commit it with:

```bash
git add <changed-files>
git commit -m "fix(parity): 收敛尾部回归与复核问题"
```

If no follow-up changes are needed, do not create an empty commit.

---

## Deferred After This Round

- `character_decisions` is intentionally **deferred** for now.
- Do **not** add `CharacterDecision` or expand `ChapterPlan` schema in this round.
- If the user wants that feature later, create a separate design/plan first because it changes the Director output contract, stored plan schema, and draft-quality heuristics together.
