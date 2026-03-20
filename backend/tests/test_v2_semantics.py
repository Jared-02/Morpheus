import os
import unittest
from uuid import uuid4

from fastapi.testclient import TestClient

os.environ["REMOTE_LLM_ENABLED"] = "false"
os.environ["REMOTE_EMBEDDING_ENABLED"] = "false"
os.environ["GRAPH_FEATURE_ENABLED"] = "true"

from api.main import app


class V2SemanticsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_project_creation_writes_project_type_and_synopsis_into_identity(self):
        create_res = self.client.post(
            "/api/projects",
            json={
                "name": f"类型项目-{uuid4().hex[:8]}",
                "genre": "奇幻",
                "style": "冷峻现实主义",
                "template_id": "novel-standard",
                "target_length": 90000,
                "taboo_constraints": ["禁止时间回溯"],
                "synopsis": "主角在霜城发现王室血脉秘密，并被迫在家国与私情之间做出选择。",
            },
        )
        self.assertEqual(create_res.status_code, 200)
        project_id = create_res.json()["id"]

        project_res = self.client.get(f"/api/projects/{project_id}")
        self.assertEqual(project_res.status_code, 200)
        project_payload = project_res.json()
        self.assertEqual(project_payload.get("template_id"), "novel-standard")
        self.assertEqual(
            project_payload.get("synopsis"),
            "主角在霜城发现王室血脉秘密，并被迫在家国与私情之间做出选择。",
        )

        identity_res = self.client.get(f"/api/identity/{project_id}")
        self.assertEqual(identity_res.status_code, 200)
        identity = identity_res.json().get("content", "")
        self.assertIn("Story Template", identity)
        self.assertIn("长篇小说（Novel）", identity)
        self.assertIn("Story Synopsis", identity)
        self.assertIn("主角在霜城发现王室血脉秘密", identity)

    def test_one_shot_book_accepts_batch_direction_alias(self):
        create_res = self.client.post(
            "/api/projects",
            json={
                "name": f"批次项目-{uuid4().hex[:8]}",
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
                "batch_direction": "主角在雪夜被背叛后潜伏反击，最终揪出幕后主使。",
                "mode": "quick",
                "chapter_count": 1,
                "words_per_chapter": 700,
            },
        )
        self.assertEqual(batch_res.status_code, 200)
        payload = batch_res.json()
        self.assertEqual(payload["generated_chapters"], 1)
        self.assertEqual(payload["prompt"], "主角在雪夜被背叛后潜伏反击，最终揪出幕后主使。")

    def test_one_shot_book_accepts_scope_field(self):
        create_res = self.client.post(
            "/api/projects",
            json={
                "name": f"旧scope项目-{uuid4().hex[:8]}",
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
                "batch_direction": "测试scope字段可接受。",
                "scope": "volume",
                "mode": "quick",
                "chapter_count": 1,
                "words_per_chapter": 700,
            },
        )
        self.assertEqual(batch_res.status_code, 200)

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


if __name__ == "__main__":
    unittest.main()
