import os
import unittest
from datetime import datetime
from typing import cast
from unittest.mock import patch
from uuid import uuid4

os.environ["REMOTE_LLM_ENABLED"] = "false"
os.environ["REMOTE_EMBEDDING_ENABLED"] = "false"
os.environ["GRAPH_FEATURE_ENABLED"] = "true"

from api.main import finalize_generated_draft
from agents.studio import AgentStudio
from memory import MemoryStore
from models import AgentTrace, Chapter, ChapterPlan, ChapterStatus, Project


class _DummyStudio:
    def __init__(self):
        self.llm_client = object()
        self.conflicts = []

    def add_conflict(self, conflict):
        self.conflicts.append(conflict)


class _DummyThreeLayer:
    def get_identity(self) -> str:
        return "# IDENTITY"

    def add_log(self, _message: str) -> None:
        return None


class _DummyStore:
    def __init__(self):
        self.three_layer = _DummyThreeLayer()

    def get_all_entities(self):
        return []

    def get_all_events(self):
        return []

    def sync_file_memories(self) -> None:
        return None


class TitleGenerationFlowTest(unittest.TestCase):
    def test_finalize_generated_draft_replaces_plan_title_with_content_title(self):
        project = Project(
            id=f"project-{uuid4().hex[:8]}",
            name="测试项目",
            genre="奇幻",
            style="冷峻",
            target_length=300000,
        )
        chapter = Chapter(
            id=f"chapter-{uuid4().hex[:8]}",
            project_id=project.id,
            chapter_number=8,
            title="计划阶段标题",
            goal="主角在镜海边界确认追兵方位并决定是否暴露底牌。",
        )
        chapter.plan = ChapterPlan(
            id=f"plan-{uuid4().hex[:8]}",
            chapter_id=chapter.chapter_number,
            title=chapter.title,
            goal=chapter.goal,
            beats=["他在镜海边界拆解残存讯号，并确认真正的追兵已经逼近。"],
            conflicts=["外部：追兵逼近。", "内部：是否立刻暴露底牌。"],
        )
        trace = AgentTrace(
            id=f"trace-{uuid4().hex[:8]}",
            chapter_id=chapter.chapter_number,
            decisions=[],
            memory_hits=[{"item_id": "memory-1", "summary": "命中记忆"}],
            conflicts_detected=[],
            final_draft=None,
        )
        store = _DummyStore()
        studio = _DummyStudio()
        draft = "他在镜海边界捞起最后一枚熄灭的信标，余烬照亮了追兵靠近的轮廓。"
        final_title = "镜海余烬"

        with patch("api.main.generate_unique_title_from_chapter_content", return_value=final_title):
            with patch(
                "api.main.ConsistencyEngine.check",
                return_value={
                    "can_submit": True,
                    "total_conflicts": 0,
                    "p0_count": 0,
                    "p1_count": 0,
                    "p2_count": 0,
                    "conflicts": [],
                    "p0_conflicts": [],
                    "p1_conflicts": [],
                    "p2_conflicts": [],
                },
            ):
                with patch(
                    "api.main.upsert_graph_from_chapter",
                    side_effect=lambda *_args, **_kwargs: None,
                ):
                    with patch(
                        "api.main.upsert_chapter_memory",
                        side_effect=lambda *_args, **_kwargs: None,
                    ):
                        with patch(
                            "api.main.save_trace",
                            side_effect=lambda *_args, **_kwargs: None,
                        ):
                            with patch(
                                "api.main.save_chapter",
                                side_effect=lambda *_args, **_kwargs: None,
                            ):
                                with patch(
                                    "api.main.write_metric",
                                    side_effect=lambda *_args, **_kwargs: None,
                                ):
                                    with patch("api.main.chapter_list", return_value=[chapter]):
                                        with patch("api.main.MemoryContextService"):
                                            result = finalize_generated_draft(
                                                chapter=chapter,
                                                project=project,
                                                store=cast(MemoryStore, cast(object, store)),
                                                studio=cast(AgentStudio, cast(object, studio)),
                                                trace=trace,
                                                draft=draft,
                                                started=datetime.now(),
                                                source_label="测试流",
                                            )

        self.assertEqual(chapter.title, final_title)
        self.assertNotEqual(chapter.title, chapter.plan.title)
        self.assertEqual(chapter.draft, draft)
        self.assertEqual(chapter.word_count, len(draft))
        self.assertEqual(chapter.status, ChapterStatus.REVIEWING)
        self.assertEqual(chapter.memory_hit_count, 1)
        self.assertEqual(result["draft"], draft)
        self.assertEqual(result["word_count"], len(draft))
        self.assertTrue(result["can_submit"])


if __name__ == "__main__":
    unittest.main()
