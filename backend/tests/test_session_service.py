"""
Unit tests for session_service.apply_state_changes.

These tests do not call AI. They pin the contract the frontend will rely on:
XP persists, level-up is mechanical, battles have a turn order, enemy HP changes
via combatant_damage.
"""
from app.game_engine.character import calculate_proficiency_bonus, get_level_for_xp
from app.models.domain import (
    AbilityScores,
    Character,
    CombatantDamage,
    GameSession,
    SpellSlot,
    StateChanges,
)
from app.services.session_service import apply_death_save, apply_state_changes, is_dying_character


def make_character(**kwargs) -> Character:
    defaults = dict(
        id="char-1",
        name="Aria",
        race="Elf",
        char_class="Wizard",
        background="Sage",
        level=3,
        xp=900,
        hp_current=18,
        hp_max=18,
        ac=12,
        abilities=AbilityScores(
            strength=8,
            dexterity=14,
            constitution=12,
            intelligence=17,
            wisdom=12,
            charisma=10,
        ),
        spell_slots={1: SpellSlot(current=2, maximum=4)},
    )
    defaults.update(kwargs)
    return Character(**defaults)


def make_session(**kwargs) -> GameSession:
    defaults = dict(
        character=make_character(),
        setting="Dark Forest",
        story_template="dungeon_delve",
    )
    defaults.update(kwargs)
    return GameSession(**defaults)


class TestXpAndLevel:
    def test_add_xp_is_copied_back_to_character(self):
        session = make_session()

        updated = apply_state_changes(session, StateChanges(add_xp=200))

        assert updated.character.xp == 1100
        assert updated.character.level == 3

    def test_xp_crossing_threshold_levels_up_and_sets_pending(self):
        session = make_session(character=make_character(
            char_class="Fighter",
            level=1,
            xp=0,
            hp_current=12,
            hp_max=12,
            proficiency_bonus=2,
            abilities=AbilityScores(strength=16, dexterity=14, constitution=14),
            spell_slots={},
        ))

        updated = apply_state_changes(session, StateChanges(add_xp=300))

        assert updated.character.xp == 300
        assert updated.character.level == 2
        assert get_level_for_xp(updated.character.xp) == 2
        assert updated.character.proficiency_bonus == calculate_proficiency_bonus(2)
        assert updated.character.hp_max > 12
        assert updated.pending_level_up is not None
        assert updated.pending_level_up.new_level == 2
        assert updated.pending_level_up.hp_increase == updated.character.hp_max - 12

    def test_does_not_clear_existing_pending_level_up_without_new_level(self):
        session = make_session()
        first = apply_state_changes(
            session,
            StateChanges(add_xp=1800),  # 900 + 1800 = 2700 → level 4
        )
        assert first.pending_level_up is not None
        pending = first.pending_level_up

        second = apply_state_changes(first, StateChanges(heal=1))

        assert second.pending_level_up == pending


class TestRestAndHp:
    def test_long_rest_via_state_changes_restores_hp_and_slots(self):
        session = make_session(character=make_character(
            hp_current=5,
            spell_slots={1: SpellSlot(current=0, maximum=4)},
        ))

        updated = apply_state_changes(session, StateChanges(long_rest=True))

        assert updated.character.hp_current == 18
        assert updated.character.spell_slots[1].current == 4

    def test_damage_and_heal(self):
        session = make_session()

        hurt = apply_state_changes(session, StateChanges(damage=6))
        assert hurt.character.hp_current == 12

        healed = apply_state_changes(hurt, StateChanges(heal=100))
        assert healed.character.hp_current == 18


class TestDeathSaves:
    def test_dropping_to_zero_adds_unconscious(self):
        session = make_session(character=make_character(hp_current=6))
        updated = apply_state_changes(session, StateChanges(damage=10))
        assert updated.character.hp_current == 0
        assert "unconscious" in updated.character.conditions
        assert is_dying_character(updated.character)

    def test_heal_wakes_dying_character(self):
        session = make_session(character=make_character(
            hp_current=0,
            conditions=["unconscious"],
        ))
        updated = apply_state_changes(session, StateChanges(heal=4))
        assert updated.character.hp_current == 4
        assert "unconscious" not in updated.character.conditions
        assert not is_dying_character(updated.character)

    def test_death_save_success_is_engine_resolved(self):
        session = make_session(character=make_character(
            hp_current=0,
            conditions=["unconscious"],
        ))
        updated, line = apply_death_save(session, 14)
        assert updated.character.death_saves.successes == 1
        assert "success" in line.lower()


class TestBattle:
    def test_start_battle_includes_player_and_turn_order(self):
        session = make_session()

        updated = apply_state_changes(session, StateChanges(start_battle=[
            {"name": "Goblin", "hp": 7, "ac": 15, "initiative_bonus": 2, "cr": 0.25},
            {"name": "Orc", "hp": 15, "ac": 13, "initiative_bonus": 1, "cr": 0.5},
        ]))

        battle = updated.battle_state
        assert battle is not None
        ids = {c.id for c in battle.combatants}
        assert "player" in ids
        assert "enemy_0" in ids
        assert "enemy_1" in ids
        assert len(battle.turn_order) == 3
        assert set(battle.turn_order) == ids
        player = next(c for c in battle.combatants if c.is_player)
        assert player.hp_current == 18
        goblin = next(c for c in battle.combatants if c.id == "enemy_0")
        assert goblin.hp_max == 7
        assert goblin.ac == 15
        assert goblin.cr == 0.25

    def test_combatant_damage_reduces_enemy_hp(self):
        session = apply_state_changes(make_session(), StateChanges(start_battle=[
            {"id": "goblin_1", "name": "Goblin", "hp": 7, "ac": 15},
        ]))

        updated = apply_state_changes(session, StateChanges(
            combatant_damage=[CombatantDamage(id="goblin_1", amount=5)],
        ))

        goblin = next(c for c in updated.battle_state.combatants if c.id == "goblin_1")
        assert goblin.hp_current == 2

    def test_combatant_damage_does_not_kill_below_zero(self):
        session = apply_state_changes(make_session(), StateChanges(start_battle=[
            {"id": "goblin_1", "name": "Goblin", "hp": 7, "ac": 15},
        ]))

        updated = apply_state_changes(session, StateChanges(
            combatant_damage=[CombatantDamage(id="goblin_1", amount=99)],
        ))

        goblin = next(c for c in updated.battle_state.combatants if c.id == "goblin_1")
        assert goblin.hp_current == 0
        assert updated.battle_state is not None

    def test_player_damage_syncs_battle_combatant(self):
        session = apply_state_changes(make_session(), StateChanges(start_battle=[
            {"name": "Goblin", "hp": 7, "ac": 15},
        ]))

        updated = apply_state_changes(session, StateChanges(damage=4))

        player = next(c for c in updated.battle_state.combatants if c.is_player)
        assert updated.character.hp_current == 14
        assert player.hp_current == 14

    def test_combatant_damage_on_player_id_is_ignored_and_noted(self):
        session = apply_state_changes(make_session(), StateChanges(start_battle=[
            {"name": "Goblin", "hp": 7, "ac": 15},
        ]))

        updated = apply_state_changes(session, StateChanges(
            combatant_damage=[CombatantDamage(id="player", amount=5)],
        ))

        assert updated.character.hp_current == 18
        assert "[ENGINE]" in updated.gm_internal_notes
        assert "player" in updated.gm_internal_notes

    def test_unknown_combatant_id_is_noted(self):
        session = apply_state_changes(make_session(), StateChanges(start_battle=[
            {"name": "Goblin", "hp": 7, "ac": 15},
        ]))

        updated = apply_state_changes(session, StateChanges(
            combatant_damage=[CombatantDamage(id="missing", amount=3)],
        ))

        assert "unknown id" in updated.gm_internal_notes

    def test_end_battle_clears_state(self):
        session = apply_state_changes(make_session(), StateChanges(start_battle=[
            {"name": "Goblin", "hp": 7, "ac": 15},
        ]))

        updated = apply_state_changes(session, StateChanges(end_battle=True))

        assert updated.battle_state is None


class TestConditions:
    def test_known_condition_is_applied(self):
        session = make_session()

        updated = apply_state_changes(session, StateChanges(set_condition="poisoned"))

        assert "poisoned" in updated.character.conditions

    def test_unknown_condition_is_logged_not_applied(self):
        session = make_session()

        updated = apply_state_changes(session, StateChanges(set_condition="on_fire_custom"))

        assert updated.character.conditions == []
        assert "Unknown condition ignored" in updated.gm_internal_notes
        assert "on_fire_custom" in updated.gm_internal_notes


class TestInventory:
    def test_add_items_persist(self):
        session = make_session()

        updated = apply_state_changes(session, StateChanges(
            add_items=[{"name": "Gold Pieces", "quantity": 10}],
        ))

        assert updated.character.inventory[0].name == "Gold Pieces"
        assert updated.character.inventory[0].quantity == 10
