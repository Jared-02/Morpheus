# Parity Gap Closure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the three remaining post-parity gaps by supporting `character_decisions`, aligning backend Graph defaults with the frontend, and correcting README runtime/feature-flag wording.

**Architecture:** Keep this patch narrow. The backend change is a schema-and-parser closure: add a small `CharacterDecision` model, let `ChapterPlan` carry it, and only normalize structured JSON payloads while safely degrading malformed input to `[]`. The feature-flag change is a default flip in backend settings plus targeted tests. The documentation change is factual only: describe DeepSeek as the default provider path, not the only runtime, and clarify that Graph/L4 exposure is enabled by default but still configurable.

**Tech Stack:** Python 3.11, FastAPI, Pydantic v2, pytest, Markdown docs

---

## Before You Start

Read these first:
- `docs/plans/2026-03-21-parity-gap-closure-design.md`
- `.claude/plan/pro-feature-migration.md:117-139`

Do **not** change these unless a test proves they are wrong:
- `frontend/src/config/features.ts:1-11` — frontend Graph/L4 defaults already use `true`
- `backend/.env.example:64-66` — example env already documents `GRAPH_FEATURE_ENABLED=true`

Keep scope tight:
- No new UI
- No scoring heuristic redesign
- No refactor outside the touched parser/settings/docs paths
- No new compatibility shims

---

### Task 1: Support `character_decisions` in `ChapterPlan` parsing

**Files:**
- Modify: `backend/tests/test_studio_plan_parser.py:124-161`
- Modify: `backend/models/__init__.py:118-128`
- Modify: `backend/agents/studio.py:15,535-545,1295-1409`

**Step 1: Write the failing tests**

Replace the two “ignore character_decisions” tests with positive + robustness coverage.

```python
from models import AgentRole, Chapter, ChapterPlan, CharacterDecision, EntityState, EventEdge


def test_extract_plan_payload_accepts_character_decisions(self):
    workflow = self._workflow()
    chapter = self._chapter()
    text = json.dumps(
        {
            "title": chapter.title,
            "beats": ["陈砚潜入旧镜城节点并切断追踪锚点。"],
            "conflicts": ["外部：守卫逼近。", "内部：是否暴露盟友身份。"],
            "foreshadowing": ["旧镜城回路中埋着童年线索。"],
            "callback_targets": ["回收六边形符号来源。"],
            "role_goals": {"陈砚": "拿到真实入口坐标。"},
            "character_decisions": [
                {
                    "character": "陈砚",
                    "beat_index": 0,
                    "choice": "断开主链路",
                    "cost": "暴露当前位置",
                    "rejected_alternative": "继续潜伏等待"
                }
            ],
        },
        ensure_ascii=False,
    )

    parsed = workflow._extract_plan_payload(text, chapter)

    assert parsed["character_decisions"] == [
        {
            "character": "陈砚",
            "beat_index": 0,
            "choice": "断开主链路",
            "cost": "暴露当前位置",
            "rejected_alternative": "继续潜伏等待",
        }
    ]


def test_extract_plan_payload_invalid_character_decisions_falls_back_to_empty_list(self):
    workflow = self._workflow()
    chapter = self._chapter()
    text = json.dumps(
        {
            "title": chapter.title,
            "beats": ["陈砚潜入旧镜城节点并切断追踪锚点。"],
            "character_decisions": [
                "bad-item",
                {"character": "", "beat_index": 0, "choice": "断开主链路"},
                {"character": "陈砚", "beat_index": -1, "choice": "断开主链路"},
            ],
        },
        ensure_ascii=False,
    )

    parsed = workflow._extract_plan_payload(text, chapter)

    assert parsed["character_decisions"] == []


def test_chapter_plan_model_accepts_character_decisions(self):
    plan = ChapterPlan.model_validate(
        {
            "id": "plan-1",
            "chapter_id": 1,
            "title": "密钥的最后一次校准",
            "goal": "定位初始密钥",
            "beats": ["陈砚切断追踪锚点。"],
            "character_decisions": [
                {
                    "character": "陈砚",
                    "beat_index": 0,
                    "choice": "断开主链路",
                    "cost": "暴露当前位置",
                    "rejected_alternative": "继续潜伏等待",
                }
            ],
        }
    )

    assert plan.model_dump()["character_decisions"] == [
        {
            "character": "陈砚",
            "beat_index": 0,
            "choice": "断开主链路",
            "cost": "暴露当前位置",
            "rejected_alternative": "继续潜伏等待",
        }
    ]
```

**Step 2: Run the tests to verify they fail**

Run:
```bash
cd backend && python -m pytest \
  tests/test_studio_plan_parser.py::StudioPlanParserTest::test_extract_plan_payload_accepts_character_decisions \
  tests/test_studio_plan_parser.py::StudioPlanParserTest::test_extract_plan_payload_invalid_character_decisions_falls_back_to_empty_list \
  tests/test_studio_plan_parser.py::StudioPlanParserTest::test_chapter_plan_model_accepts_character_decisions \
  -v
```

Expected:
- FAIL because `parsed` does not contain `character_decisions`
- FAIL because `ChapterPlan.model_dump()` still drops the field

**Step 3: Write the minimal implementation**

Add a small Pydantic model in `backend/models/__init__.py` and extend `ChapterPlan`.

```python
class CharacterDecision(BaseModel):
    character: str = Field(min_length=1)
    beat_index: int = Field(ge=0)
    choice: str = Field(min_length=1)
    cost: str = ""
    rejected_alternative: str = ""


class ChapterPlan(BaseModel):
    id: str
    chapter_id: int
    title: str
    goal: str
    beats: List[str] = Field(default_factory=list)
    conflicts: List[str] = Field(default_factory=list)
    foreshadowing: List[str] = Field(default_factory=list)
    callback_targets: List[str] = Field(default_factory=list)
    role_goals: Dict[str, str] = Field(default_factory=dict)
    character_decisions: List[CharacterDecision] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)
```

Update `backend/agents/studio.py` imports and parsing path. Keep normalization narrow: only accept list-of-dict structured payloads, ignore malformed items, and default to `[]` anywhere else.

```python
from models import AgentRole, AgentDecision, AgentTrace, ChapterPlan, Chapter, CharacterDecision


def _normalize_character_decisions(self, value: Any) -> List[Dict[str, Any]]:
    if not isinstance(value, list):
        return []
    normalized: List[Dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        try:
            decision = CharacterDecision.model_validate(item)
        except Exception:
            continue
        normalized.append(decision.model_dump())
    return normalized
```

Wire it into `_extract_plan_payload_with_quality()`.

```python
if payload:
    normalized = {
        "title": (payload.get("title") or "").strip() or None,
        "beats": self._normalize_list(payload.get("beats")),
        "conflicts": self._normalize_list(payload.get("conflicts")),
        "foreshadowing": self._normalize_list(payload.get("foreshadowing")),
        "callback_targets": self._normalize_list(payload.get("callback_targets")),
        "role_goals": self._normalize_role_goals(payload.get("role_goals")),
        "character_decisions": self._normalize_character_decisions(payload.get("character_decisions")),
    }
else:
    normalized = {
        "title": None,
        "beats": beats,
        "conflicts": conflicts,
        "foreshadowing": foreshadowing,
        "callback_targets": callback_targets,
        "role_goals": role_goals,
        "character_decisions": [],
    }
```

Wire it into `ChapterPlan(...)` construction.

```python
plan = ChapterPlan(
    id=str(uuid4()),
    chapter_id=chapter.chapter_number,
    title=chapter.title,
    goal=chapter.goal,
    beats=parsed_plan["beats"],
    conflicts=parsed_plan["conflicts"],
    foreshadowing=parsed_plan["foreshadowing"],
    callback_targets=parsed_plan["callback_targets"],
    role_goals=parsed_plan["role_goals"],
    character_decisions=parsed_plan["character_decisions"],
)
```

Do **not** add new scoring logic in this round.

**Step 4: Run the tests to verify they pass**

Run:
```bash
cd backend && python -m pytest \
  tests/test_studio_plan_parser.py::StudioPlanParserTest::test_extract_plan_payload_accepts_character_decisions \
  tests/test_studio_plan_parser.py::StudioPlanParserTest::test_extract_plan_payload_invalid_character_decisions_falls_back_to_empty_list \
  tests/test_studio_plan_parser.py::StudioPlanParserTest::test_chapter_plan_model_accepts_character_decisions \
  -v
```

Expected:
- PASS
- No old “ignore character_decisions” expectation remains

**Step 5: Run the focused parser regression slice**

Run:
```bash
cd backend && python -m pytest tests/test_studio_plan_parser.py -v
```

Expected:
- PASS for the whole parser test file
- No regressions in draft-quality or setter-constraint tests

**Step 6: Commit**

```bash
git add backend/tests/test_studio_plan_parser.py backend/models/__init__.py backend/agents/studio.py
git commit -m "fix(backend): support character decisions in chapter plans"
```

---

### Task 2: Align backend Graph defaults with the frontend defaults

**Files:**
- Modify: `backend/tests/test_l4_feature_flags.py:7-47`
- Modify: `backend/api/main.py:105-107`

**Step 1: Write the failing tests**

Extend the feature-flag tests so backend defaults explicitly match the frontend’s `true` default and still honor env overrides.

```python
class TestL4FeatureFlags(unittest.TestCase):
    def _make_settings(self, **env_overrides):
        keys = ["GRAPH_FEATURE_ENABLED", "L4_PROFILE_ENABLED", "L4_AUTO_EXTRACT_ENABLED"]
        ...

    def test_graph_feature_enabled_default_true(self):
        s = self._make_settings()
        self.assertTrue(s.graph_feature_enabled)

    def test_graph_feature_disabled_via_env(self):
        s = self._make_settings(GRAPH_FEATURE_ENABLED="false")
        self.assertFalse(s.graph_feature_enabled)
```

**Step 2: Run the tests to verify they fail**

Run:
```bash
cd backend && python -m pytest \
  tests/test_l4_feature_flags.py::TestL4FeatureFlags::test_graph_feature_enabled_default_true \
  tests/test_l4_feature_flags.py::TestL4FeatureFlags::test_graph_feature_disabled_via_env \
  -v
```

Expected:
- `test_graph_feature_enabled_default_true` FAILS because current backend default is `False`
- The env override test may already pass; keep it because it guards the intended behavior

**Step 3: Write the minimal implementation**

Update backend settings only. Do not change frontend defaults.

```python
class Settings(BaseSettings):
    ...
    graph_feature_enabled: bool = True
    l4_profile_enabled: bool = True
    l4_auto_extract_enabled: bool = True
```

Keep the `_make_settings()` helper cleanup list in sync with the new graph tests.

**Step 4: Run the tests to verify they pass**

Run:
```bash
cd backend && python -m pytest tests/test_l4_feature_flags.py -v
```

Expected:
- PASS for the whole feature-flag file
- Confirms default `True` plus env-based disable path

**Step 5: Run one Graph/L4 regression slice**

Run:
```bash
cd backend && python -m pytest tests/test_l4_api.py -v
```

Expected:
- PASS
- Confirms no obvious Graph/L4 breakage after the default alignment

**Step 6: Commit**

```bash
git add backend/tests/test_l4_feature_flags.py backend/api/main.py
git commit -m "fix(backend): align graph feature defaults"
```

---

### Task 3: Correct README runtime and feature-flag wording

**Files:**
- Modify: `README.md:84-88`
- Modify: `README.md:132-170`
- Modify: `README.md:187`
- Modify: `README.md:242-249`
- Modify: `README.md:331-335`

**Step 1: Verify the stale wording exists before editing**

Run:
```bash
grep -nE "单 LLM：DeepSeek|唯一运行时 LLM|运行时 LLM 固定为 DeepSeek|DeepSeek（唯一运行时 LLM）" README.md
```

Expected:
- Matches exist before the edit

**Step 2: Edit the README minimally**

Make only factual wording changes that are already supported by code:
- Replace “DeepSeek only” wording with “DeepSeek default + OpenAI-compatible providers supported”
- Keep DeepSeek as the documented default path
- Clarify Graph/L4 is feature-flag controlled, but default exposure is enabled unless env disables it

Target wording shape:

```md
**后端**
- FastAPI + Pydantic 2 + Uvicorn
- SQLite + LanceDB
- DeepSeek 默认运行时 + OpenAI-compatible provider 支持
- SSE（Server-Sent Events）
```

```md
**运行时特点**
- 默认 LLM provider：DeepSeek
- 同时支持 OpenAI-compatible providers（如通过 `LLM_PROVIDER` 切换）
- API Key 缺失时自动降级到本地 fallback
- 章节与整书生成通过 SSE 推送进度和正文片段
- 推荐 `API_WORKERS=2+`，避免长生成阻塞读接口
```

```md
### 5. 知识图谱
- 图谱不是独立于记忆的“第四层主架构”，而是建立在 L4 角色档案、图节点覆盖层与审计日志之上的独立子系统
- 默认暴露由前后端 feature flag 控制；可通过 `GRAPH_FEATURE_ENABLED` / `VITE_GRAPH_FEATURE_ENABLED` 关闭
```

Also fix the later “DeepSeek only” references in the architecture and conventions sections so the README is internally consistent.

**Step 3: Verify the new wording**

Run:
```bash
grep -nE "OpenAI-compatible|默认 LLM provider|GRAPH_FEATURE_ENABLED|VITE_GRAPH_FEATURE_ENABLED" README.md
```

Expected:
- Matches for the new runtime/flag wording

Run:
```bash
if grep -nE "单 LLM：DeepSeek|唯一运行时 LLM|运行时 LLM 固定为 DeepSeek|DeepSeek（唯一运行时 LLM）" README.md; then exit 1; fi
```

Expected:
- Exit 0 with no output

**Step 4: Commit**

```bash
git add README.md
git commit -m "docs(readme): align runtime and graph defaults"
```

---

## Final Verification

Run these commands before claiming completion:

```bash
cd backend && python -m pytest tests/test_studio_plan_parser.py tests/test_l4_feature_flags.py tests/test_l4_api.py -v
```

Expected:
- PASS

Run:
```bash
git diff --check
```

Expected:
- No whitespace or conflict-marker issues

Run:
```bash
grep -nE "OpenAI-compatible|默认 LLM provider|GRAPH_FEATURE_ENABLED|VITE_GRAPH_FEATURE_ENABLED" README.md
```

Expected:
- Confirms the README contains the corrected runtime/flag wording

Run:
```bash
if grep -nE "单 LLM：DeepSeek|唯一运行时 LLM|运行时 LLM 固定为 DeepSeek|DeepSeek（唯一运行时 LLM）" README.md; then exit 1; fi
```

Expected:
- Exit 0 with no stale wording left

---

## Notes for the Implementer

- `character_decisions` should be a supported stored field, not a hidden trace blob and not a scoring project in this round.
- Prefer default-empty fallback over clever recovery. Invalid items should be dropped, not partially repaired.
- The frontend default is already correct. The backend default is the one that must move.
- The README must only claim behavior that is visible in `backend/core/llm_client.py` and current env/config paths.
- Keep commits atomic. Do not batch docs and backend behavior into one commit.
