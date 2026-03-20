from pathlib import Path
import unittest

from bridge.codex_events import CodexStreamAggregator, load_mock_events, parse_json_line


ROOT = Path(__file__).resolve().parent.parent


class CodexEventsTest(unittest.TestCase):
    def test_parse_on_topic_fixture(self) -> None:
        raw_lines, events = load_mock_events(ROOT / "fixtures/mock_codex_on_topic.jsonl")
        aggregator = CodexStreamAggregator(task="inspect repo", source="mock")
        for line in raw_lines:
            parsed = parse_json_line(line)
            if parsed is None:
                aggregator.add_non_json_output(line)
                continue
            aggregator.consume(parsed)

        packet = aggregator.finalize()

        self.assertEqual(packet.status, "completed")
        self.assertEqual(packet.thread_id, "thread_mock_on_topic")
        self.assertGreaterEqual(packet.turn_count, 1)
        self.assertTrue(packet.visible_output)
        self.assertTrue(packet.final_message.startswith("WORKER_CHECKPOINT"))
        self.assertEqual(len(packet.tool_activity), 2)
        self.assertEqual(packet.tool_activity[0].name, "shell")
        self.assertEqual(packet.reasoning_signals[0].event_type, "reasoning_item.created")

    def test_parse_rogue_fixture(self) -> None:
        raw_lines, events = load_mock_events(ROOT / "fixtures/mock_codex_rogue.jsonl")
        aggregator = CodexStreamAggregator(task="inspect repo", source="mock")
        for line in raw_lines:
            parsed = parse_json_line(line)
            if parsed is None:
                aggregator.add_non_json_output(line)
                continue
            aggregator.consume(parsed)

        packet = aggregator.finalize()

        self.assertEqual(packet.status, "failed")
        self.assertIn("off-topic activity observed", packet.errors[0])
        self.assertIn("restaurant", packet.final_message.lower())
        self.assertEqual(packet.tool_activity[0].name, "web_search")


if __name__ == "__main__":
    unittest.main()

