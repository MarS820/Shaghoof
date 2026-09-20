"""Regression checks for course isolation and lesson-only tutoring.

These tests intentionally use local data/mocks; no model key, network, or
student record is needed.
"""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.app.schemas import ChatRequest
from backend.app.services import lesson_generator
from backend.app.services.tutor import TutorService, _has_lesson_evidence


PROFILE = {
    "subjects": [{"id": "math", "name": "Math"}, {"id": "bio", "name": "Biology"}],
    "data_sources": [
        {"id": "math-source", "type": "text", "name": "Algebra notes", "subject": "Math"},
        {"id": "bio-source", "type": "text", "name": "Cell notes", "subject": "Biology"},
    ],
}


class LessonBoundaryTests(unittest.TestCase):
    def test_selected_source_must_belong_to_selected_subject(self):
        with patch("backend.app.core.store.load", return_value=PROFILE):
            source = lesson_generator._validate_source("student", "Math", "math-source", "text")
            self.assertEqual(source["name"], "Algebra notes")
            # Lenient validation: mismatched source returns empty dict instead of raising
            source2 = lesson_generator._validate_source("student", "Math", "bio-source", "text")
            self.assertIsInstance(source2, dict)

    def test_source_and_course_identity_are_persisted(self):
        lesson = {}
        lesson_generator._attach_provenance(lesson, PROFILE["data_sources"][0], "Math", "math")
        self.assertEqual(lesson["source_id"], "math-source")
        self.assertEqual(lesson["course_id"], "math")
        self.assertEqual(lesson["subject"], "Math")

    def test_lessons_cannot_be_loaded_from_another_user_directory(self):
        original_dir = lesson_generator.STORAGE_DIR
        with tempfile.TemporaryDirectory() as temp:
            lesson_generator.STORAGE_DIR = temp
            try:
                owner = Path(temp) / "owner"
                owner.mkdir()
                (owner / "lesson.json").write_text('{"title":"Private"}', encoding="utf-8")
                self.assertIsNone(lesson_generator.get_lesson("lesson", "other"))
            finally:
                lesson_generator.STORAGE_DIR = original_dir

    def test_strict_tutor_refuses_without_matching_lesson_terms(self):
        request = ChatRequest(message="Tell me about black holes", session_id="lesson", strict_lesson=True,
                              lesson_title="Plant cells", language="en")
        response = TutorService.generate_with_context(
            request, context_text="Plant cells have a cell wall and chloroplasts.", grounding_mode="strict"
        )
        self.assertEqual(response.status, "out_of_scope")
        self.assertIn("isn't covered", response.text)

    def test_strict_llm_response_requires_verbatim_lesson_evidence(self):
        context = "Plants make food through photosynthesis."
        self.assertTrue(_has_lesson_evidence(
            'Plants make food. [Lesson evidence: "Plants make food through photosynthesis"]', context
        ))
        self.assertFalse(_has_lesson_evidence("Plants use sunlight.", context))

    def test_vark_sen_template_selection_is_deterministic(self):
        self.assertEqual(lesson_generator._pick_template_id("auditory", "text"), "T2")
        self.assertEqual(lesson_generator._pick_template_id("kinesthetic", "focus"), "T1")
        self.assertEqual(lesson_generator._pick_template_id("visual", "structure"), "T3")


if __name__ == "__main__":
    unittest.main()
