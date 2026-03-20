from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
import json
import queue
import subprocess
import threading
import time
from pathlib import Path
from typing import Any


class KiroACPError(RuntimeError):
    """Raised when Kiro ACP returns an error."""


@dataclass
class PromptTurn:
    session_id: str
    stop_reason: str
    updates: list[dict[str, Any]] = field(default_factory=list)
    final_text: str = ""


class KiroACPClient:
    def __init__(
        self,
        *,
        cwd: Path,
        agent: str | None = None,
        model: str | None = None,
        trust_all_tools: bool = False,
    ) -> None:
        self.cwd = Path(cwd)
        self.agent = agent
        self.model = model
        self.trust_all_tools = trust_all_tools
        self._proc: subprocess.Popen[str] | None = None
        self._stdout_thread: threading.Thread | None = None
        self._stderr_thread: threading.Thread | None = None
        self._next_id = 0
        self._pending: dict[int, queue.Queue[dict[str, Any]]] = {}
        self._session_updates: dict[str, list[dict[str, Any]]] = defaultdict(list)
        self._stderr_lines: list[str] = []
        self._lock = threading.Lock()

    def start(self) -> dict[str, Any]:
        args = ["kiro-cli", "acp"]
        if self.agent:
            args.extend(["--agent", self.agent])
        if self.model:
            args.extend(["--model", self.model])
        if self.trust_all_tools:
            args.append("--trust-all-tools")

        self._proc = subprocess.Popen(
            args,
            cwd=str(self.cwd),
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )
        self._stdout_thread = threading.Thread(target=self._read_stdout, daemon=True)
        self._stderr_thread = threading.Thread(target=self._read_stderr, daemon=True)
        self._stdout_thread.start()
        self._stderr_thread.start()
        return self.initialize()

    @property
    def stderr_lines(self) -> list[str]:
        return list(self._stderr_lines)

    def close(self) -> None:
        if not self._proc:
            return
        if self._proc.poll() is None:
            self._proc.terminate()
            try:
                self._proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                self._proc.kill()
        self._proc = None

    def initialize(self) -> dict[str, Any]:
        response = self.request(
            "initialize",
            {
                "protocolVersion": 1,
                "clientCapabilities": {
                    "fs": {"readTextFile": True, "writeTextFile": True},
                    "terminal": True,
                },
                "clientInfo": {"name": "codex-kiro-bridge", "version": "0.1.0"},
            },
        )
        return response

    def new_session(self) -> str:
        response = self.request(
            "session/new",
            {"cwd": str(self.cwd), "mcpServers": []},
        )
        session_id = response.get("sessionId")
        if not isinstance(session_id, str):
            raise KiroACPError(f"Unexpected session/new response: {response}")
        return session_id

    def prompt(self, session_id: str, text: str, timeout: float = 180.0) -> PromptTurn:
        start_index = len(self._session_updates[session_id])
        response = self.request(
            "session/prompt",
            {"sessionId": session_id, "prompt": [{"type": "text", "text": text}]},
            timeout=timeout,
        )
        stop_reason = str(response.get("stopReason", "unknown"))
        time.sleep(0.2)
        updates = self._session_updates[session_id][start_index:]
        final_text = "".join(self._extract_message_chunks(update) for update in updates).strip()
        return PromptTurn(
            session_id=session_id,
            stop_reason=stop_reason,
            updates=updates,
            final_text=final_text,
        )

    def request(self, method: str, params: dict[str, Any], timeout: float = 30.0) -> dict[str, Any]:
        if not self._proc or not self._proc.stdin:
            raise KiroACPError("ACP process is not running")

        with self._lock:
            request_id = self._next_id
            self._next_id += 1
            response_queue: queue.Queue[dict[str, Any]] = queue.Queue()
            self._pending[request_id] = response_queue
            payload = {"jsonrpc": "2.0", "id": request_id, "method": method, "params": params}
            self._proc.stdin.write(json.dumps(payload) + "\n")
            self._proc.stdin.flush()

        try:
            response = response_queue.get(timeout=timeout)
        except queue.Empty as exc:
            raise KiroACPError(f"Timed out waiting for {method} response") from exc
        finally:
            self._pending.pop(request_id, None)

        error = response.get("error")
        if isinstance(error, dict):
            message = error.get("message", "unknown ACP error")
            raise KiroACPError(f"{method} failed: {message}")

        result = response.get("result")
        if not isinstance(result, dict):
            raise KiroACPError(f"Unexpected {method} response: {response}")
        return result

    def _read_stdout(self) -> None:
        assert self._proc is not None
        assert self._proc.stdout is not None
        for raw_line in self._proc.stdout:
            line = raw_line.strip()
            if not line:
                continue
            try:
                payload = json.loads(line)
            except json.JSONDecodeError:
                self._stderr_lines.append(f"non-json stdout: {line}")
                continue
            if "id" in payload:
                request_id = payload["id"]
                pending = self._pending.get(request_id)
                if pending is not None:
                    pending.put(payload)
                continue
            if payload.get("method") == "session/update":
                params = payload.get("params", {})
                session_id = params.get("sessionId")
                update = params.get("update")
                if isinstance(session_id, str) and isinstance(update, dict):
                    self._session_updates[session_id].append(update)

    def _read_stderr(self) -> None:
        assert self._proc is not None
        assert self._proc.stderr is not None
        for raw_line in self._proc.stderr:
            line = raw_line.strip()
            if line:
                self._stderr_lines.append(line)

    @staticmethod
    def _extract_message_chunks(update: dict[str, Any]) -> str:
        if update.get("sessionUpdate") != "agent_message_chunk":
            return ""
        content = update.get("content", {})
        if not isinstance(content, dict):
            return ""
        text = content.get("text")
        return text if isinstance(text, str) else ""
