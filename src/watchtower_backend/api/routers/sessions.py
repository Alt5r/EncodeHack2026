"""Session lifecycle and realtime routes."""

from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from watchtower_backend.api.dependencies import SessionManagerDependency
from watchtower_backend.api.schemas.sessions import SessionCreateRequest, SessionDetail, SessionRead
from watchtower_backend.domain.models.simulation import TerrainCell

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionDetail, summary="Create and start a WATCHTOWER session")
async def create_session(
    payload: SessionCreateRequest,
    session_manager: SessionManagerDependency,
) -> SessionDetail:
    """Create and start a new game session."""
    terrain_grid: list[list[TerrainCell]] | None = None
    if payload.terrain_grid is not None:
        terrain_grid = [
            [
                TerrainCell(
                    elevation=cell.elevation,
                    vegetation=cell.vegetation,
                    water=cell.water,
                )
                for cell in row
            ]
            for row in payload.terrain_grid
        ]
    session_state = await session_manager.create_session(
        doctrine_text=payload.doctrine_text,
        doctrine_title=payload.doctrine_title,
        terrain_grid=terrain_grid,
    )
    return SessionDetail.from_state(session_state=session_state)


@router.get("", response_model=list[SessionRead], summary="List active WATCHTOWER sessions")
async def list_sessions(session_manager: SessionManagerDependency) -> list[SessionRead]:
    """List active session summaries."""
    sessions = await session_manager.list_sessions()
    return [SessionRead.from_state(session_state=session) for session in sessions]


@router.get("/{session_id}", response_model=SessionDetail, summary="Get one session")
async def get_session(session_id: str, session_manager: SessionManagerDependency) -> SessionDetail:
    """Return detailed state for one active session."""
    session_state = await session_manager.get_session(session_id=session_id)
    return SessionDetail.from_state(session_state=session_state)


@router.post("/{session_id}/terminate", response_model=SessionDetail, summary="Stop a session")
async def terminate_session(
    session_id: str,
    session_manager: SessionManagerDependency,
) -> SessionDetail:
    """Terminate a running session and persist its result."""
    session_state = await session_manager.stop_session(session_id=session_id)
    return SessionDetail.from_state(session_state=session_state)


@router.websocket("/{session_id}/ws")
async def session_stream(
    websocket: WebSocket,
    session_id: str,
    session_manager: SessionManagerDependency,
) -> None:
    """Stream snapshots and events for a session."""
    await websocket.accept()
    subscriber_manager = await session_manager.subscribe(session_id=session_id)
    try:
        async with subscriber_manager as queue:
            while True:
                envelope = await queue.get()
                await websocket.send_json(envelope.model_dump(mode="json"))
    except WebSocketDisconnect:
        return
