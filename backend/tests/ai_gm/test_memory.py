"""Tests for ai_gm/memory.py"""
import pytest

from app.ai_gm.memory import (
    add_memory_event,
    build_event_summary,
    format_memory_for_prompt,
    get_recent_memory_events,
    should_record_event,
)
from app.models.domain import (
    AbilityScores,
    Character,
    DeathSaves,
    GameSession,
    MemoryEvent,
    StateChanges,
)


def make_session(**kwargs) -> GameSession:
    char = Character(
        id="char-1",
        name="Lyra",
        race="Elf",
        char_class="Rogue",
        background="Criminal",
        level=3,
        xp=900,
        hp_current=20,
        hp_max=20,
        ac=14,
        abilities=AbilityScores(),
        death_saves=DeathSaves(),
    )
    defaults = dict(
        character=char,
        setting="City of Shadows",
        story_template="political_intrigue",
        memory_events=[],
    )
    defaults.update(kwargs)
    return GameSession(**defaults)


class TestShouldRecordEvent:
    def test_start_battle_is_significant(self):
        changes = StateChanges(start_battle=[{"name": "Goblin", "hp": 7, "ac": 15}])
        assert should_record_event(changes, "A goblin appears.") is True

    def test_end_battle_is_significant(self):
        changes = StateChanges(end_battle=True)
        assert should_record_event(changes, "The combat ends.") is True

    def test_quest_update_is_significant(self):
        changes = StateChanges(quest_update={"title": "Find the key", "status": "completed"})
        assert should_record_event(changes, "You found the key.") is True

    def test_large_xp_gain_is_significant(self):
        changes = StateChanges(add_xp=200)
        assert should_record_event(changes, "You gain experience.") is True

    def test_small_xp_not_significant(self):
        changes = StateChanges(add_xp=10)
        assert should_record_event(changes, "Small reward.") is False

    def test_deception_keyword_in_narrative(self):
        changes = StateChanges()
        assert should_record_event(changes, "You lie to the guard captain.") is True

    def test_boring_turn_not_significant(self):
        changes = StateChanges()
        assert should_record_event(changes, "You look around the room.") is False

    def test_significant_condition_is_recorded(self):
        changes = StateChanges(set_condition="paralyzed")
        assert should_record_event(changes, "A spell hits you.") is True

    def test_minor_condition_not_recorded(self):
        changes = StateChanges(set_condition="grappled")
        assert should_record_event(changes, "You are grabbed.") is False


class TestBuildEventSummary:
    def test_battle_start_event(self):
        changes = StateChanges(start_battle=[{"name": "Orc", "hp": 15, "ac": 13}])
        event = build_event_summary(changes, "An orc attacks!", turn=5, player_action="I fight")
        assert event is not None
        assert "Orc" in event.event
        assert event.turn == 5
        assert "combat:start" in event.tags

    def test_quest_complete_event(self):
        changes = StateChanges(quest_update={"title": "Slay the Dragon", "status": "completed"})
        event = build_event_summary(changes, "You defeat it.", turn=20, player_action="I attack")
        assert event is not None
        assert "completed" in event.event
        assert any("quest_status:completed" in t for t in event.tags)

    def test_insignificant_returns_none(self):
        changes = StateChanges()
        event = build_event_summary(changes, "You explore the room.", turn=1, player_action="look")
        assert event is None

    def test_deception_captured(self):
        changes = StateChanges()
        event = build_event_summary(
            changes,
            "You successfully deceive the merchant.",
            turn=8,
            player_action="I lie about the stolen goods",
        )
        assert event is not None
        assert "deception" in event.tags


class TestAddMemoryEvent:
    def test_appends_event(self):
        session = make_session()
        event = MemoryEvent(event="Test event", turn=1, tags=["test"])
        updated = add_memory_event(session, event)
        assert len(updated.memory_events) == 1
        assert updated.memory_events[0].event == "Test event"

    def test_original_unchanged(self):
        session = make_session()
        event = MemoryEvent(event="Test event", turn=1)
        add_memory_event(session, event)
        assert len(session.memory_events) == 0


class TestGetRecentMemoryEvents:
    def test_returns_last_n(self):
        session = make_session(
            memory_events=[
                MemoryEvent(event=f"Event {i}", turn=i) for i in range(10)
            ]
        )
        recent = get_recent_memory_events(session, 3)
        assert len(recent) == 3
        assert recent[-1].event == "Event 9"

    def test_returns_all_when_fewer_than_max(self):
        session = make_session(
            memory_events=[MemoryEvent(event="Only one", turn=1)]
        )
        recent = get_recent_memory_events(session, 10)
        assert len(recent) == 1


class TestFormatMemoryForPrompt:
    def test_empty_returns_empty_string(self):
        assert format_memory_for_prompt([]) == ""

    def test_formats_correctly(self):
        events = [
            MemoryEvent(event="Killed a goblin", turn=3, tags=["combat:end"]),
            MemoryEvent(event="Met the innkeeper", turn=5, tags=["npc:innkeeper"]),
        ]
        result = format_memory_for_prompt(events)
        assert "Turn 3" in result
        assert "Killed a goblin" in result
        assert "combat:end" in result
        assert "Turn 5" in result
