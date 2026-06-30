"""Tests for ai_gm/context_manager.py"""
import pytest

from app.ai_gm.context_manager import (
    _format_character_sheet,
    _format_battle_state,
    _format_history,
    build_context_window,
)
from app.models.domain import (
    AbilityScores,
    BattleState,
    Character,
    ChatMessage,
    Combatant,
    DeathSaves,
    GameSession,
    MemoryEvent,
    SpellSlot,
)


def make_character(**kwargs) -> Character:
    defaults = dict(
        id="char-1",
        name="Theron",
        race="Human",
        char_class="Fighter",
        background="Soldier",
        level=5,
        xp=6500,
        hp_current=35,
        hp_max=45,
        ac=18,
        abilities=AbilityScores(strength=17, dexterity=12, constitution=14),
        proficiency_bonus=3,
        skills=["Athletics", "Perception"],
        death_saves=DeathSaves(),
        spell_slots={1: SpellSlot(current=4, maximum=4)},
    )
    defaults.update(kwargs)
    return Character(**defaults)


def make_session(**kwargs) -> GameSession:
    defaults = dict(
        character=make_character(),
        setting="The Underdark",
        story_template="dungeon_delve",
    )
    defaults.update(kwargs)
    return GameSession(**defaults)


class TestFormatCharacterSheet:
    def test_includes_character_name(self):
        char = make_character(name="Aria")
        sheet = _format_character_sheet(char)
        assert "Aria" in sheet

    def test_includes_hp_and_ac(self):
        char = make_character(hp_current=20, hp_max=45, ac=16)
        sheet = _format_character_sheet(char)
        assert "20/45" in sheet
        assert "16" in sheet

    def test_includes_spell_slots(self):
        char = make_character(spell_slots={1: SpellSlot(current=3, maximum=4)})
        sheet = _format_character_sheet(char)
        assert "L1:3/4" in sheet

    def test_includes_conditions(self):
        char = make_character(conditions=["poisoned", "prone"])
        sheet = _format_character_sheet(char)
        assert "poisoned" in sheet
        assert "prone" in sheet

    def test_no_conditions_shows_none(self):
        char = make_character(conditions=[])
        sheet = _format_character_sheet(char)
        assert "none" in sheet.lower()

    def test_ki_shown_when_present(self):
        char = make_character(ki_current=4, ki_max=5)
        sheet = _format_character_sheet(char)
        assert "Ki:" in sheet
        assert "4/5" in sheet


class TestFormatBattleState:
    def test_shows_round_number(self):
        battle = BattleState(
            combatants=[Combatant(id="g1", name="Goblin", hp_current=7, hp_max=7, ac=15)],
            turn_order=["g1"],
            round_number=3,
        )
        result = _format_battle_state(battle)
        assert "Round 3" in result

    def test_shows_current_turn_marker(self):
        battle = BattleState(
            combatants=[
                Combatant(id="p", name="Hero", hp_current=30, hp_max=30, ac=18, is_player=True),
                Combatant(id="g", name="Goblin", hp_current=7, hp_max=7, ac=15),
            ],
            turn_order=["p", "g"],
            current_turn_index=0,
        )
        result = _format_battle_state(battle)
        assert "CURRENT TURN" in result


class TestFormatHistory:
    def test_trims_to_max_messages(self):
        messages = [ChatMessage(role="player", content=f"Action {i}") for i in range(30)]
        result = _format_history(messages, max_messages=5)
        lines = [l for l in result.split("\n") if l.strip()]
        assert len(lines) == 5

    def test_includes_roles(self):
        messages = [
            ChatMessage(role="player", content="Hello"),
            ChatMessage(role="gm", content="Welcome"),
        ]
        result = _format_history(messages, max_messages=10)
        assert "PLAYER" in result
        assert "GM" in result


class TestBuildContextWindow:
    def test_contains_setting(self):
        session = make_session(setting="Dragon's Lair")
        context = build_context_window(session)
        assert "Dragon's Lair" in context

    def test_contains_character_name(self):
        session = make_session(character=make_character(name="Lyra"))
        context = build_context_window(session)
        assert "Lyra" in context

    def test_contains_story_template_name(self):
        session = make_session(story_template="hex_crawl")
        context = build_context_window(session)
        assert "hex" in context.lower() or "Hex" in context

    def test_contains_chat_history(self):
        session = make_session(
            chat_history=[
                ChatMessage(role="player", content="I open the door."),
                ChatMessage(role="gm", content="The door creaks open."),
            ]
        )
        context = build_context_window(session)
        assert "I open the door." in context

    def test_contains_memory_events(self):
        session = make_session(
            memory_events=[
                MemoryEvent(event="Killed the Goblin King", turn=7, tags=["combat:end"])
            ]
        )
        context = build_context_window(session)
        assert "Goblin King" in context

    def test_contains_gm_notes(self):
        session = make_session(gm_internal_notes="Player is looking for the lost sword.")
        context = build_context_window(session)
        assert "lost sword" in context

    def test_returns_non_empty_string(self):
        session = make_session()
        context = build_context_window(session)
        assert len(context) > 100
