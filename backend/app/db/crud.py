"""
CRUD operations for game sessions and save slots.
All functions are async, accept an SQLAlchemy AsyncSession.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import GameSessionRecord, SaveSlotRecord
from app.models.domain import GameSession, GMResponse, SaveSlotInfo


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

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if record is None:
        record = SaveSlotRecord(
            session_id=session_id,
            slot=slot,
            data=session.model_dump_json(),
            saved_at=now,
        )
        db.add(record)
    else:
        record.data = session.model_dump_json()
        record.saved_at = now

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


async def list_slots(db: AsyncSession, session_id: str) -> List[SaveSlotInfo]:
    result = await db.execute(
        select(SaveSlotRecord)
        .where(SaveSlotRecord.session_id == session_id)
        .order_by(SaveSlotRecord.slot)
    )
    infos: List[SaveSlotInfo] = []
    for record in result.scalars().all():
        session = GameSession.model_validate_json(record.data)
        saved_at = record.saved_at.isoformat() if record.saved_at else ""
        infos.append(SaveSlotInfo(
            slot=record.slot,
            character_name=session.character.name,
            turn_count=session.turn_count,
            saved_at=saved_at,
        ))
    return infos
