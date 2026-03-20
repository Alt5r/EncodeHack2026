import unittest

from bridge.codex_events import CodexStreamAggregator, parse_json_line
from bridge.supervisor import build_kiro_validation_prompt


class PacketMarkdownTest(unittest.TestCase):
    def test_markdown_contains_expected_sections(self) -> None:
        lines = [
            '{"type":"thread.started","thread_id":"thread_demo"}',
            '{"type":"turn.started"}',
            '{"type":"agent_message.delta","delta":"Inspecting files. "}',
            '{"type":"message.completed","message":"Final answer."}',
            '{"type":"turn.completed"}',
        ]
        aggregator = CodexStreamAggregator(task="demo", source="mock")
        for line in lines:
            aggregator.consume(parse_json_line(line) or {})

        packet = aggregator.finalize()
        markdown = packet.to_markdown()

        self.assertIn("CODEX_WORKER_PACKET", markdown)
        self.assertIn("task: demo", markdown)
        self.assertIn("visible_output:", markdown)
        self.assertIn("errors:", markdown)

    def test_validation_prompt_requests_confidence_and_action(self) -> None:
        lines = [
            '{"type":"thread.started","thread_id":"thread_demo"}',
            '{"type":"turn.started"}',
            '{"type":"agent_message.delta","delta":"Inspecting files. "}',
            '{"type":"message.completed","message":"Final answer."}',
            '{"type":"turn.completed"}',
        ]
        aggregator = CodexStreamAggregator(task="demo", source="mock")
        for line in lines:
            aggregator.consume(parse_json_line(line) or {})

        packet = aggregator.finalize()
        prompt = build_kiro_validation_prompt(packet)

        self.assertIn("confidence_score:", prompt)
        self.assertIn("recommended_action:", prompt)


if __name__ == "__main__":
    unittest.main()
