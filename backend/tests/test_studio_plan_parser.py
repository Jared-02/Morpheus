import asyncio
import json
import os
import unittest
from typing import cast
from unittest.mock import patch

from agents.studio import Agent, AgentStudio, StudioWorkflow
from core import chapter_craft
from core.chapter_craft import build_locked_facts, build_setter_constraints
from models import AgentDecision, AgentRole, Chapter, ChapterPlan, EntityState, EventEdge


class _ScriptedAgent(Agent):
    def __init__(self, responses, *, role: AgentRole = AgentRole.DIRECTOR):
        super().__init__(role=role, name="stub", description="stub", system_prompt="")
        self._responses = list(responses)

    async def think(self, context):
        if not self._responses:
            raise AssertionError("unexpected think call")
        response = self._responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response

    def decide(self, context, input_refs):
        return AgentDecision(
            id="decision-stub",
            agent_role=self.role,
            chapter_id=0,
            input_refs=input_refs,
            decision_text="",
            reasoning="",
        )


class _FakeStudio:
    def __init__(self, agents):
        self._agents = agents
        self.trace = None
        self.enforce_remote_mode = False
        self.final_draft = None

    def get_agent(self, role):
        return self._agents[role]

    def add_memory_hits(self, hits):
        return None

    def add_decision(self, decision):
        return None

    def set_final_draft(self, draft: str):
        self.final_draft = draft


class StudioPlanParserTest(unittest.TestCase):
    def _workflow(self) -> StudioWorkflow:
        return StudioWorkflow(
            studio=cast(AgentStudio, cast(object, _FakeStudio({}))),
            memory_search_func=lambda *_args, **_kwargs: [],
        )

    def _chapter(self) -> Chapter:
        return Chapter(
            id="ch-1",
            project_id="p-1",
            chapter_number=1,
            title="密钥的最后一次校准",
            goal="陈砚在数据洪流中定位到备份神谕的初始密钥，并在校准时触发深网防御机制。",
        )

    def test_extract_plan_payload_from_markdown_sections(self):
        workflow = self._workflow()
        chapter = self._chapter()
        text = """
节拍
1. 陈砚完成初步定位，但发现密钥信号被人为伪装。
2. 他在封锁窗口期强行校准，触发深网防御反制。
3. 章尾确认密钥只是诱饵，真正入口转向旧镜城节点。

冲突点
- 外部：深网防御系统与追踪者双向夹击。
- 内部：陈砚必须在救同伴与保线索之间二选一。

伏笔
- 旧镜城节点坐标与陈砚童年记忆重叠。

回收目标
- 回收上一章“六边形符号”来源。

角色目标
陈砚：在接口崩溃前拿到真实入口坐标。
"""
        parsed = workflow._extract_plan_payload(text, chapter)
        self.assertGreaterEqual(len(parsed["beats"]), 3)
        self.assertTrue(any("旧镜城节点" in item for item in parsed["beats"]))
        self.assertTrue(any("外部" in item for item in parsed["conflicts"]))
        self.assertEqual(parsed["role_goals"].get("陈砚"), "在接口崩溃前拿到真实入口坐标。")

    def test_extract_plan_payload_fallback_is_not_rigid_template(self):
        workflow = self._workflow()
        chapter = self._chapter()
        parsed = workflow._extract_plan_payload("（模型返回异常）", chapter)
        self.assertGreaterEqual(len(parsed["beats"]), 3)
        self.assertNotIn("中段制造冲突并推进人物关系", parsed["beats"])
        self.assertNotIn("结尾留下悬念或下一章引子", parsed["beats"])
        self.assertNotIn("主角目标与外部阻力发生碰撞", parsed["conflicts"])

    def test_extract_plan_quality_marks_template_output(self):
        workflow = self._workflow()
        chapter = self._chapter()
        template_text = """
{
  "beats": [
    "开场建立章节目标",
    "中段制造冲突并推进人物关系",
    "结尾留下悬念或下一章引子"
  ],
  "conflicts": [
    "主角目标与外部阻力发生碰撞",
    "内部价值观冲突抬升"
  ],
  "foreshadowing": [],
  "callback_targets": [],
  "role_goals": {}
}
"""
        _, quality = workflow._extract_plan_payload_with_quality(template_text, chapter)
        self.assertIn(quality["status"], {"warn", "bad"})
        self.assertGreaterEqual(quality.get("template_phrase_hits", 0), 2)
        self.assertTrue(any("模板化" in item for item in quality.get("issues", [])))

    def test_extract_plan_payload_accepts_character_decisions_json(self):
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
                    {"character": "陈砚", "beat_index": 0, "choice": "断开主链路"}
                ],
            },
            ensure_ascii=False,
        )

        parsed = workflow._extract_plan_payload(text, chapter)

        self.assertEqual(
            parsed["character_decisions"],
            [
                {
                    "character": "陈砚",
                    "beat_index": 0,
                    "choice": "断开主链路",
                    "cost": "",
                    "rejected_alternative": "",
                }
            ],
        )
        self.assertEqual(parsed["role_goals"].get("陈砚"), "拿到真实入口坐标。")

    def test_extract_plan_payload_drops_malformed_character_decisions(self):
        workflow = self._workflow()
        chapter = self._chapter()
        malformed_text = json.dumps(
            {
                "title": chapter.title,
                "beats": ["陈砚潜入旧镜城节点并切断追踪锚点。"],
                "conflicts": ["外部：守卫逼近。"],
                "character_decisions": [
                    {"character": "陈砚", "choice": "断开主链路"},
                    {"character": "", "beat_index": 0, "choice": "断开主链路"},
                    "断开主链路",
                ],
            },
            ensure_ascii=False,
        )

        parsed = workflow._extract_plan_payload(malformed_text, chapter)
        markdown_parsed = workflow._extract_plan_payload("节拍\n1. 陈砚切断追踪锚点。", chapter)

        self.assertEqual(parsed["character_decisions"], [])
        self.assertEqual(markdown_parsed["character_decisions"], [])

    def test_generate_plan_applies_llm_title_as_first_stage_title(self):
        chapter = self._chapter()
        planned_title = "雾墙后的密钥"
        director_plan = json.dumps(
            {
                "title": planned_title,
                "beats": [
                    "陈砚穿过雾墙，发现备份神谕的初始密钥被伪装成旧镜城钟楼残骸。",
                    "他在封锁窗口期强行校准密钥，触发深网防御系统反制。",
                    "章尾确认钟楼残骸只是诱饵，真正入口转向旧镜城地底。",
                ],
                "conflicts": [
                    "外部：深网防御系统与追踪者双向夹击。",
                    "内部：陈砚必须在救同伴与保线索之间二选一。",
                ],
                "foreshadowing": ["旧镜城地底入口与陈砚童年记忆重叠。"],
                "callback_targets": ["回收上一章的六边形符号来源。"],
                "role_goals": {"陈砚": "在接口崩溃前拿到真实入口坐标。"},
                "character_decisions": [
                    {
                        "character": "陈砚",
                        "beat_index": 1,
                        "choice": "提前校准密钥",
                        "cost": "暴露当前位置",
                        "rejected_alternative": "撤出钟楼等待支援",
                    }
                ],
            },
            ensure_ascii=False,
        )

        studio = _FakeStudio(
            {
                AgentRole.DIRECTOR: _ScriptedAgent([director_plan]),
            }
        )
        workflow = StudioWorkflow(
            studio=cast(AgentStudio, cast(object, studio)),
            memory_search_func=lambda *_args, **_kwargs: [],
        )

        plan = asyncio.run(
            workflow.generate_plan(
                chapter,
                {
                    "project_info": {"name": "测试项目"},
                    "identity_core": "# IDENTITY",
                    "runtime_state": "",
                    "memory_compact": "",
                    "open_threads": [],
                    "previous_chapters": [],
                },
            )
        )

        self.assertEqual(plan.title, planned_title)
        self.assertEqual(chapter.title, planned_title)
        self.assertEqual(plan.character_decisions[0].character, "陈砚")
        self.assertEqual(plan.character_decisions[0].choice, "提前校准密钥")

    def test_chapter_plan_model_accepts_and_dumps_character_decisions(self):
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
                        "cost": "暴露伤势",
                        "rejected_alternative": "继续潜伏",
                    }
                ],
            }
        )

        self.assertEqual(
            plan.model_dump()["character_decisions"],
            [
                {
                    "character": "陈砚",
                    "beat_index": 0,
                    "choice": "断开主链路",
                    "cost": "暴露伤势",
                    "rejected_alternative": "继续潜伏",
                }
            ],
        )

    def test_generate_draft_quality_uses_actual_target_words(self):
        chapter = self._chapter()
        plan = ChapterPlan(
            id="plan-1",
            chapter_id=1,
            title=chapter.title,
            goal=chapter.goal,
            beats=["陈砚进入旧镜城节点并发现诱饵密钥正在倒计时。"],
            conflicts=["外部：深网防御系统压缩撤离窗口。"],
        )
        director_text = "陈砚进入旧镜城节点并发现诱饵密钥正在倒计时。"
        setter_text = "保持旧镜城坐标与上一章一致。"
        stylist_text = "钟楼风声像倒计时一样压在他耳边。"
        final_text = "甲" * 1600

        studio = _FakeStudio(
            {
                AgentRole.DIRECTOR: _ScriptedAgent([director_text]),
                AgentRole.SETTER: _ScriptedAgent([setter_text]),
                AgentRole.STYLIST: _ScriptedAgent([stylist_text]),
                AgentRole.ARBITER: _ScriptedAgent([final_text]),
            }
        )
        workflow = StudioWorkflow(
            studio=cast(AgentStudio, cast(object, studio)),
            memory_search_func=lambda *_args, **_kwargs: [],
        )
        captured: dict[str, object] = {}

        def fake_assess(_draft, _chapter, _plan, context):
            captured.update(context)
            return {"score": 100, "length": 5}

        with patch.object(workflow, "_assess_draft_quality", side_effect=fake_assess):
            with patch.dict(os.environ, {"DRAFT_QUALITY_SCORING": "1"}, clear=False):
                asyncio.run(
                    workflow.generate_draft(
                        chapter,
                        plan,
                        {
                            "identity": "# IDENTITY",
                            "project_style": "冷峻",
                            "target_words": 3000,
                            "entities": [{"name": "陈砚", "type": "character"}],
                            "events": [
                                {"subject": "陈砚", "relation": "encountered", "chapter": 1}
                            ],
                        },
                    )
                )

        self.assertEqual(captured.get("target_words"), 3000)
        self.assertEqual(captured.get("entities"), [{"name": "陈砚", "type": "character"}])
        self.assertEqual(
            captured.get("events"),
            [{"subject": "陈砚", "relation": "encountered", "chapter": 1}],
        )

    def test_generate_draft_quality_retry_failure_falls_back_to_first_draft(self):
        chapter = self._chapter()
        plan = ChapterPlan(
            id="plan-1",
            chapter_id=1,
            title=chapter.title,
            goal=chapter.goal,
            beats=["陈砚在雪夜潜入旧镜城节点，强行校准密钥。"],
            conflicts=["外部：守卫追至钟楼。"],
        )
        director_text = "陈砚在雪夜潜入旧镜城节点，强行校准密钥，钟楼回声催促他加快动作。"
        setter_text = "保持旧镜城坐标与上一章一致。"
        stylist_text = "雪粒敲在护栏上，像在给倒计时敲拍子。"
        final_text = "甲" * 400

        studio = _FakeStudio(
            {
                AgentRole.DIRECTOR: _ScriptedAgent([director_text]),
                AgentRole.SETTER: _ScriptedAgent([setter_text]),
                AgentRole.STYLIST: _ScriptedAgent([stylist_text]),
                AgentRole.ARBITER: _ScriptedAgent([final_text, RuntimeError("retry failed")]),
            }
        )
        workflow = StudioWorkflow(
            studio=cast(AgentStudio, cast(object, studio)),
            memory_search_func=lambda *_args, **_kwargs: [],
        )

        with patch.dict(os.environ, {"DRAFT_QUALITY_SCORING": "1"}, clear=False):
            result = asyncio.run(
                workflow.generate_draft(
                    chapter,
                    plan,
                    {
                        "identity": "# IDENTITY",
                        "project_style": "冷峻",
                        "target_words": 1600,
                    },
                )
            )

        self.assertEqual(result, workflow._sanitize_draft(final_text, chapter, plan))
        self.assertEqual(studio.final_draft, final_text)
        self.assertTrue(chapter.metadata.get("draft_quality_retried"))
        self.assertEqual(chapter.metadata.get("draft_quality_retry_error"), "retry failed")

    def test_assess_draft_quality_requires_target_words(self):
        workflow = self._workflow()
        chapter = self._chapter()
        plan = ChapterPlan(
            id="plan-1",
            chapter_id=1,
            title=chapter.title,
            goal=chapter.goal,
            beats=["陈砚进入旧镜城节点并发现诱饵密钥正在倒计时。"],
            conflicts=["外部：深网防御系统压缩撤离窗口。"],
        )

        with self.assertRaises(ValueError):
            workflow._assess_draft_quality("甲" * 1600, chapter, plan, {})

    def test_build_locked_facts_recognizes_localized_status(self):
        entity = EntityState(
            entity_id="e-1",
            entity_type="character",
            name="陈砚",
            attrs={"状态": "死亡"},
            constraints=[],
            first_seen_chapter=1,
            last_seen_chapter=3,
        )

        facts = build_locked_facts(
            entities=[entity],
            events=[],
            conflicts=[],
            current_chapter=4,
        )

        self.assertTrue(any("角色已死亡" in item and "陈砚" in item for item in facts))

    def test_build_setter_constraints_filters_by_beats(self):
        entity_hit = EntityState(
            entity_id="e-1",
            entity_type="character",
            name="陈砚",
            attrs={"状态": "重伤", "位置": "旧镜城"},
            constraints=[],
            first_seen_chapter=1,
            last_seen_chapter=5,
        )
        entity_miss = EntityState(
            entity_id="e-2",
            entity_type="character",
            name="苏离",
            attrs={"状态": "潜伏", "位置": "南港"},
            constraints=[],
            first_seen_chapter=1,
            last_seen_chapter=5,
        )
        event_hit = EventEdge(
            event_id="ev-1",
            subject="陈砚",
            relation="抵达",
            object="旧镜城",
            chapter=4,
            description="陈砚潜入旧镜城布置假线索。",
            confidence=1.0,
        )
        event_miss = EventEdge(
            event_id="ev-2",
            subject="苏离",
            relation="潜伏",
            object="南港",
            chapter=4,
            description="苏离仍留在南港观察商会。",
            confidence=1.0,
        )

        constraints = build_setter_constraints(
            entities=[entity_hit, entity_miss],
            events=[event_hit, event_miss],
            chapter_number=5,
            beats=["陈砚在旧镜城钟楼切断追踪锚点。"],
        )

        joined = "\n".join(constraints)
        self.assertIn("陈砚", joined)
        self.assertIn("旧镜城", joined)
        self.assertNotIn("苏离", joined)
        self.assertNotIn("南港", joined)

    def test_build_setter_constraints_zero_match_does_not_fallback_to_full_window(self):
        entity = EntityState(
            entity_id="e-1",
            entity_type="character",
            name="苏离",
            attrs={"状态": "潜伏", "位置": "南港"},
            constraints=[],
            first_seen_chapter=1,
            last_seen_chapter=5,
        )
        event = EventEdge(
            event_id="ev-1",
            subject="苏离",
            relation="潜伏",
            object="南港",
            chapter=4,
            description="苏离仍留在南港观察商会。",
            confidence=1.0,
        )

        constraints = build_setter_constraints(
            entities=[entity],
            events=[event],
            chapter_number=5,
            beats=["陈砚在旧镜城钟楼切断追踪锚点。"],
        )

        self.assertEqual(constraints, [])

    def test_build_setter_constraints_caps_entity_output(self):
        entities = [
            EntityState(
                entity_id=f"e-{idx}",
                entity_type="character",
                name=f"角色{idx}",
                attrs={"状态": "待命", "位置": "旧镜城"},
                constraints=[],
                first_seen_chapter=1,
                last_seen_chapter=5,
            )
            for idx in range(1, 9)
        ]

        constraints = build_setter_constraints(
            entities=entities,
            events=[],
            chapter_number=5,
            beats=["旧镜城局势骤然收紧。"],
        )

        state_lines = [item for item in constraints if "当前状态" in item]
        self.assertLessEqual(len(state_lines), 5)

    def test_build_generation_memory_window_returns_bounded_entities_and_events(self):
        entities = [
            EntityState(
                entity_id="e-1",
                entity_type="character",
                name="陈砚",
                attrs={
                    "status": "负伤",
                    "location": "旧镜城",
                    "mood": "警戒",
                    "ability": "镜折潜行",
                    "extra": "应被裁剪",
                },
                constraints=["不能暴露身份", "不能丢失密钥", "避免正面交战", "额外约束应被裁剪"],
                first_seen_chapter=1,
                last_seen_chapter=6,
            ),
            EntityState(
                entity_id="e-2",
                entity_type="organization",
                name="旧镜城守卫",
                attrs={"status": "搜捕", "location": "钟楼区"},
                constraints=[],
                first_seen_chapter=2,
                last_seen_chapter=5,
            ),
            EntityState(
                entity_id="e-3",
                entity_type="character",
                name="无关角色",
                attrs={"status": "待命", "location": "南港"},
                constraints=[],
                first_seen_chapter=1,
                last_seen_chapter=2,
            ),
        ]
        events = [
            EventEdge(
                event_id="ev-1",
                subject="陈砚",
                relation="encountered",
                object="旧镜城守卫",
                chapter=5,
                confidence=0.95,
                description="在钟楼下短暂交锋并暴露伤势细节需要裁剪到合理长度",
            ),
            EventEdge(
                event_id="ev-2",
                subject="无关角色",
                relation="rested",
                object="南港",
                chapter=2,
                confidence=0.5,
                description="与当前节拍无关",
            ),
        ]

        window = chapter_craft.build_generation_memory_window(
            entities=entities,
            events=events,
            chapter_number=6,
            beats=["陈砚在旧镜城躲避守卫并处理伤势。"],
        )

        self.assertEqual(len(window["entities"]), 1)
        self.assertEqual(window["entities"][0]["name"], "陈砚")
        self.assertEqual(window["entities"][0]["type"], "character")
        self.assertEqual(
            set(window["entities"][0]["attrs"].keys()), {"status", "location", "mood", "ability"}
        )
        self.assertEqual(len(window["entities"][0]["constraints"]), 3)
        self.assertEqual(window["events"][0]["subject"], "陈砚")
        self.assertEqual(window["events"][0]["chapter"], 5)
        self.assertLessEqual(len(window["events"][0]["description"]), 80)
        self.assertTrue(all(item["subject"] != "无关角色" for item in window["events"]))

    def test_build_generation_memory_window_excludes_current_chapter_events(self):
        events = [
            EventEdge(
                event_id="ev-prev",
                subject="陈砚",
                relation="encountered",
                object="旧镜城守卫",
                chapter=5,
                confidence=0.95,
                description="上一章在钟楼下短暂交锋。",
            ),
            EventEdge(
                event_id="ev-current",
                subject="陈砚",
                relation="escaped",
                object="旧镜城守卫",
                chapter=6,
                confidence=0.95,
                description="本章旧稿里已经写过一次的逃脱动作。",
            ),
        ]

        window = chapter_craft.build_generation_memory_window(
            entities=[],
            events=events,
            chapter_number=6,
            beats=["陈砚在旧镜城躲避守卫并处理伤势。"],
        )

        self.assertEqual([item["chapter"] for item in window["events"]], [5])


if __name__ == "__main__":
    unittest.main()
