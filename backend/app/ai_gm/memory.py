"""
Long-term GM memory management.

Memory events are stored in GameSession.memory_events (persisted as JSON).
Significant events are tagged and retrieved before context window assembly.

Significance heuristics:
  - Combat started / ended
  - Boss defeated
  - Quest updated (any status change)
  - NPC interaction (start_battle with named NPC, quest_update with NPC name)
  - Player deceived (deception action keywords)
  - Level up (add_xp triggers level change)
  - Condition set (significant conditions: paralyzed, unconscious, etc.)
"""
from __future__ import annotations

from typing import List, Optional
from uuid import uuid4

from app.models.domain import GameSession, MemoryEvent, StateChanges


# Conditions that are significant enough to record
_SIGNIFICANT_CONDITIONS = {
    "paralyzed", "unconscious", "dead", "petrified", "stunned", "charmed", "frightened",
}

# Keywords in the narrative that hint at deception / diplomacy
_DECEPTION_KEYWORDS = {"lie", "deceiv", "bluff", "trick", "disguise", "impersonat"}


def should_record_event(changes: StateChanges, narrative: str) -> bool:
    """Return True if this turn's outcome is significant enough to memorize."""
    if changes.start_battle:
        return True
    if changes.end_battle:
        return True
    if changes.quest_update:
        return True
    if changes.add_xp and changes.add_xp >= 100:
        return True
    if changes.set_condition and changes.set_condition in _SIGNIFICANT_CONDITIONS:
        return True
    low = narrative.lower()
    if any(kw in low for kw in _DECEPTION_KEYWORDS):
        return True
    return False


def build_event_summary(
    changes: StateChanges,
    narrative: str,
    turn: int,
    player_action: str,
) -> Optional[MemoryEvent]:
    """
    Build a MemoryEvent from this turn's data. Returns None if not significant.
    """
    if not should_record_event(changes, narrative):
        return None

    tags: List[str] = []
    parts: List[str] = []

    if changes.start_battle:
        names = [e.get("name", "Unknown") for e in changes.start_battle]
        parts.append(f"Combat started vs {', '.join(names)}")
        tags.extend([f"enemy:{n.lower().replace(' ', '_')}" for n in names])
        tags.append("combat:start")

    if changes.end_battle:
        parts.append("Combat ended")
        tags.append("combat:end")

    if changes.quest_update:
        q = changes.quest_update
        status = q.get("status", "")
        title = q.get("title", "unknown")
        parts.append(f"Quest '{title}' → {status}")
        tags.append(f"quest:{title.lower().replace(' ', '_')}")
        tags.append(f"quest_status:{status}")

    if changes.add_xp and changes.add_xp >= 100:
        parts.append(f"Earned {changes.add_xp} XP")
        tags.append("xp_gain")

    if changes.set_condition and changes.set_condition in _SIGNIFICANT_CONDITIONS:
        parts.append(f"Player became {changes.set_condition}")
        tags.append(f"condition:{changes.set_condition}")

    low = narrative.lower()
    if any(kw in low for kw in _DECEPTION_KEYWORDS):
        # Extract a short snippet around the keyword
        parts.append(f"Player action involved deception: '{player_action[:80]}'")
        tags.append("deception")

    event_text = "; ".join(parts) if parts else f"Significant event at turn {turn}"
    return MemoryEvent(
        id=str(uuid4()),
        event=event_text,
        turn=turn,
        tags=tags,
    )


def add_memory_event(session: GameSession, event: MemoryEvent) -> GameSession:
    """Append a memory event to the session. Returns a new session."""
    return session.model_copy(update={
        "memory_events": list(session.memory_events) + [event]
    })


def get_recent_memory_events(session: GameSession, max_events: int) -> List[MemoryEvent]:
    """Return the `max_events` most recent memory events."""
    return list(session.memory_events[-max_events:])


def format_memory_for_prompt(events: List[MemoryEvent]) -> str:
    """Render memory events as a readable string for inclusion in the GM prompt."""
    if not events:
        return ""
    lines = []
    for e in events:
        tag_str = f"  [tags: {', '.join(e.tags)}]" if e.tags else ""
        lines.append(f"Turn {e.turn}: {e.event}{tag_str}")
    return "\n".join(lines)
