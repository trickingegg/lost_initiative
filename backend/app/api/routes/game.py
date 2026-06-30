"""
Game session endpoints.
AI GM is called here; in Stage 1 it returns a placeholder response.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.crud import (
    create_session,
    get_last_gm_response,
    get_session,
    load_slot,
    save_slot,
    update_session,
)
from app.db.session import get_db
from app.models.domain import (
    ActionResponse,
    CreateSessionRequest,
    GMResponse,
    LoadSlotRequest,
    PlayerActionRequest,
    RestRequest,
    RollResultRequest,
    SaveSlotRequest,
    SessionResponse,
    StateChanges,
)
from app.services.session_service import apply_state_changes

router = APIRouter(prefix="/session", tags=["session"])


@router.post("/start", response_model=SessionResponse)
async def start_session(
    request: CreateSessionRequest,
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    from app.models.domain import GameSession
    session = GameSession(
        character=request.character,
        setting=request.setting,
        story_template=request.story_template,
    )
    await create_session(db, session)
    return SessionResponse(session=session)


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session_state(
    session_id: str,
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    session = await get_session(db, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    last_response = await get_last_gm_response(db, session_id)
    return SessionResponse(session=session, last_gm_response=last_response)


@router.post("/{session_id}/action", response_model=ActionResponse)
async def player_action(
    session_id: str,
    request: PlayerActionRequest,
    db: AsyncSession = Depends(get_db),
) -> ActionResponse:
    """
    Process a player action. Stage 1: returns a stub GM response.
    Stage 2 will call gm_service.process_action().
    """
    session = await get_session(db, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    # Stage 1 stub — no AI yet
    gm_response = GMResponse(
        narrative=(
            "The Game Master is processing your action... "
            "(AI GM integration coming in Stage 2)"
        ),
        state_changes=StateChanges(),
        suggested_actions=["Look around", "Wait", "Proceed"],
    )

    updated_session = apply_state_changes(session, gm_response.state_changes)
    from app.models.domain import ChatMessage
    updated_session = updated_session.model_copy(update={
        "chat_history": list(session.chat_history) + [
            ChatMessage(role="player", content=request.action),
            ChatMessage(role="gm", content=gm_response.narrative),
        ]
    })

    await update_session(db, updated_session, gm_response)
    return ActionResponse(session=updated_session, gm_response=gm_response)


@router.post("/{session_id}/roll", response_model=ActionResponse)
async def submit_roll(
    session_id: str,
    request: RollResultRequest,
    db: AsyncSession = Depends(get_db),
) -> ActionResponse:
    session = await get_session(db, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    gm_response = GMResponse(
        narrative=f"You rolled a {request.roll}. The outcome will be determined by the AI GM in Stage 2.",
        state_changes=StateChanges(),
    )

    updated_session = apply_state_changes(session, gm_response.state_changes)
    await update_session(db, updated_session, gm_response)
    return ActionResponse(session=updated_session, gm_response=gm_response)


@router.post("/{session_id}/rest", response_model=ActionResponse)
async def take_rest(
    session_id: str,
    request: RestRequest,
    db: AsyncSession = Depends(get_db),
) -> ActionResponse:
    session = await get_session(db, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    if request.type == "long":
        changes = StateChanges(long_rest=True)
        narrative = "You take a long rest and recover your strength."
    else:
        changes = StateChanges(short_rest=True)
        narrative = f"You take a short rest, spending {request.hit_dice_spent} hit dice."

    gm_response = GMResponse(narrative=narrative, state_changes=changes)

    from app.game_engine.character import apply_short_rest
    from app.services.session_service import _to_engine_char, _from_engine_char

    if request.type == "short" and request.hit_dice_spent > 0:
        ec = _to_engine_char(session.character)
        ec = apply_short_rest(ec, request.hit_dice_spent)
        char = _from_engine_char(ec, session.character)
        session = session.model_copy(update={"character": char})

    updated_session = apply_state_changes(session, gm_response.state_changes)
    await update_session(db, updated_session, gm_response)
    return ActionResponse(session=updated_session, gm_response=gm_response)


@router.post("/{session_id}/save", response_model=dict)
async def save_game(
    session_id: str,
    request: SaveSlotRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    session = await get_session(db, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    await save_slot(db, session_id, request.slot, session)
    return {"saved": True, "slot": request.slot}


@router.post("/{session_id}/load", response_model=SessionResponse)
async def load_game(
    session_id: str,
    request: LoadSlotRequest,
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    loaded = await load_slot(db, session_id, request.slot)
    if loaded is None:
        raise HTTPException(status_code=404, detail=f"No save in slot {request.slot}")
    await update_session(db, loaded)
    return SessionResponse(session=loaded)
