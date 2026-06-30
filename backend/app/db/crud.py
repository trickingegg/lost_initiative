"""
CRUD operations for game sessions and save slots.
All functions are async, accept an SQLAlchemy AsyncSession.
"""
from __future__ import annotations

import json
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import GameSessionRecord, SaveSlotRecord
from app.models.domain import GameSession, GMResponse


async def create_session(db: AsyncSession, session: GameSession) -> GameSession:
    record = GameSessionRecord(
        id=session.id,
        data=session.model_dump_json(),
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return session


async def get_session(db: AsyncSession, session_id: str) -> Optional[GameSession]:
    result = await db.execute(
        select(GameSessionRecord).where(GameSessionRecord.id == session_id)
    )
    record = result.scalar_one_or_none()
    if record is None:
        return None
    return GameSession.model_validate_json(record.data)


async def update_session(
    db: AsyncSession,
    session: GameSession,
    gm_response: Optional[GMResponse] = None,
) -> GameSession:
    result = await db.execute(
        select(GameSessionRecord).where(GameSessionRecord.id == session.id)
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise ValueError(f"Session {session.id} not found")

    record.data = session.model_dump_json()
    if gm_response is not None:
        record.last_gm_response = gm_response.model_dump_json()

    await db.commit()
    return session


async def get_last_gm_response(
    db: AsyncSession, session_id: str
) -> Optional[GMResponse]:
    result = await db.execute(
        select(GameSessionRecord).where(GameSessionRecord.id == session_id)
    )
    record = result.scalar_one_or_none()
    if record is None or not record.last_gm_response:
        return None
    return GMResponse.model_validate_json(record.last_gm_response)


async def save_slot(
    db: AsyncSession, session_id: str, slot: int, session: GameSession
) -> None:
    result = await db.execute(
        select(SaveSlotRecord).where(
            SaveSlotRecord.session_id == session_id,
            SaveSlotRecord.slot == slot,
        )
    )
    record = result.scalar_one_or_none()

    if record is None:
        record = SaveSlotRecord(
            session_id=session_id,
            slot=slot,
            data=session.model_dump_json(),
        )
        db.add(record)
    else:
        record.data = session.model_dump_json()

    await db.commit()


async def load_slot(
    db: AsyncSession, session_id: str, slot: int
) -> Optional[GameSession]:
    result = await db.execute(
        select(SaveSlotRecord).where(
            SaveSlotRecord.session_id == session_id,
            SaveSlotRecord.slot == slot,
        )
    )
    record = result.scalar_one_or_none()
    if record is None:
        return None
    return GameSession.model_validate_json(record.data)
