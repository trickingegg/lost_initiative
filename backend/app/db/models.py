"""
SQLAlchemy ORM models. Sessions and save slots are stored as JSON blobs
to avoid schema migrations when domain models evolve during development.
"""
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class GameSessionRecord(Base):
    __tablename__ = "game_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    data: Mapped[str] = mapped_column(Text, nullable=False)          # JSON blob of GameSession
    last_gm_response: Mapped[str] = mapped_column(Text, nullable=True)  # JSON blob of GMResponse
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )


class SaveSlotRecord(Base):
    __tablename__ = "save_slots"
    __table_args__ = (
        UniqueConstraint("session_id", "slot", name="uq_save_slots_session_slot"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    slot: Mapped[int] = mapped_column(Integer, nullable=False)
    data: Mapped[str] = mapped_column(Text, nullable=False)         # JSON blob of GameSession
    saved_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
