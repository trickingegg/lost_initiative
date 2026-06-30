"""
Applies GMResponse.StateChanges to a GameSession.
The game engine calculates the numbers; this service applies them to the domain model.
No AI logic here.
"""
from __future__ import annotations

from typing import List, Optional

from app.game_engine import character as char_engine
from app.game_engine import combat as combat_engine
from app.game_engine import conditions as cond_engine
from app.game_engine import spells as spell_engine
from app.game_engine.character import (
    AbilityScores as EngineAbilityScores,
    EngineCharacter,
    SpellSlot as EngineSpellSlot,
)
from app.models.domain import (
    BattleState,
    Character,
    Combatant,
    DeathSaves,
    GameSession,
    GMResponse,
    Item,
    MemoryEvent,
    Quest,
    SpellSlot,
    StateChanges,
)


# ---------------------------------------------------------------------------
# Conversion helpers between Pydantic domain ↔ engine types
# ---------------------------------------------------------------------------

def _to_engine_char(c: Character) -> EngineCharacter:
    return EngineCharacter(
        id=c.id,
        name=c.name,
        race=c.race,
        char_class=c.char_class,
        level=c.level,
        xp=c.xp,
        hp_current=c.hp_current,
        hp_max=c.hp_max,
        abilities=EngineAbilityScores(
            strength=c.abilities.strength,
            dexterity=c.abilities.dexterity,
            constitution=c.abilities.constitution,
            intelligence=c.abilities.intelligence,
            wisdom=c.abilities.wisdom,
            charisma=c.abilities.charisma,
        ),
        proficiency_bonus=c.proficiency_bonus,
        skills=tuple(c.skills),
        inventory=tuple({"name": item.name, "quantity": item.quantity} for item in c.inventory),
        spell_slots={
            lvl: EngineSpellSlot(current=slot.current, maximum=slot.maximum)
            for lvl, slot in c.spell_slots.items()
        },
        ki_current=c.ki_current,
        ki_max=c.ki_max,
        conditions=tuple(c.conditions),
        death_saves={"successes": c.death_saves.successes, "failures": c.death_saves.failures},
    )


def _from_engine_char(ec: EngineCharacter, original: Character) -> Character:
    return original.model_copy(update={
        "hp_current": ec.hp_current,
        "hp_max": ec.hp_max,
        "ki_current": ec.ki_current,
        "conditions": list(ec.conditions),
        "death_saves": DeathSaves(
            successes=ec.death_saves.get("successes", 0),
            failures=ec.death_saves.get("failures", 0),
        ),
        "spell_slots": {
            lvl: SpellSlot(current=slot.current, maximum=slot.maximum)
            for lvl, slot in ec.spell_slots.items()
        },
    })


# ---------------------------------------------------------------------------
# Main apply function
# ---------------------------------------------------------------------------

def apply_state_changes(session: GameSession, changes: StateChanges) -> GameSession:
    """
    Apply GMResponse StateChanges to a GameSession. Returns a new GameSession.
    The session is treated as immutable — always returns a fresh copy.
    """
    char = session.character
    ec = _to_engine_char(char)

    # 1. Direct HP changes
    if changes.damage is not None and changes.damage > 0:
        ec, _is_dead = combat_engine.apply_damage(ec, changes.damage)
    if changes.heal is not None and changes.heal > 0:
        new_hp = min(ec.hp_max, ec.hp_current + changes.heal)
        ec = ec.with_changes(hp_current=new_hp)

    # 2. XP
    if changes.add_xp is not None and changes.add_xp > 0:
        ec = ec.with_changes(xp=ec.xp + changes.add_xp)

    # 3. Conditions
    if changes.set_condition:
        try:
            ec = cond_engine.apply_condition(ec, changes.set_condition)
        except ValueError:
            pass  # unknown condition — silently ignore to not break the session
    if changes.clear_condition:
        ec = cond_engine.clear_condition(ec, changes.clear_condition)

    # 4. Spells
    if changes.cast_spell:
        spell_level = changes.cast_spell.get("level", 0)
        if spell_engine.can_cast_spell(ec, spell_level):
            ec = spell_engine.expend_spell_slot(ec, spell_level)

    # 5. Ki
    if changes.use_ki is not None and ec.ki_current is not None:
        ec = ec.with_changes(ki_current=max(0, ec.ki_current - changes.use_ki))

    # 6. Rests
    if changes.long_rest:
        ec = char_engine.apply_long_rest(ec)
    elif changes.short_rest:
        # Short rest with 0 hit dice — just restore Warlock slots
        ec = spell_engine.restore_warlock_slots_on_short_rest(ec)

    # Sync back to Pydantic character
    char = _from_engine_char(ec, char)

    # 7. Inventory
    if changes.add_items:
        existing = {item.name: item for item in char.inventory}
        for item_dict in changes.add_items:
            name = item_dict.get("name", "Unknown")
            qty = item_dict.get("quantity", 1)
            if name in existing:
                existing[name] = existing[name].model_copy(
                    update={"quantity": existing[name].quantity + qty}
                )
            else:
                existing[name] = Item(name=name, quantity=qty,
                                      description=item_dict.get("description"))
        char = char.model_copy(update={"inventory": list(existing.values())})

    if changes.remove_items:
        remove_names = {d.get("name") for d in changes.remove_items}
        kept = [item for item in char.inventory if item.name not in remove_names]
        char = char.model_copy(update={"inventory": kept})

    # 8. Quest updates
    if changes.quest_update:
        title = changes.quest_update.get("title")
        description = changes.quest_update.get("description", "")
        status = changes.quest_update.get("status", "active")
        existing_quests = {q.title: q for q in char.quests}
        if title:
            existing_quests[title] = Quest(title=title, description=description,
                                           status=status)
        char = char.model_copy(update={"quests": list(existing_quests.values())})

    # 9. Battle state
    battle_state = session.battle_state
    if changes.start_battle and session.battle_state is None:
        combatants_raw = [
            {
                "id": e.get("id", f"enemy_{i}"),
                "name": e.get("name", "Enemy"),
                "hp_current": e.get("hp", 10),
                "hp_max": e.get("hp", 10),
                "ac": e.get("ac", 12),
                "initiative_bonus": e.get("initiative_bonus", 0),
                "cr": e.get("cr", 1),
            }
            for i, e in enumerate(changes.start_battle)
        ] + [{
            "id": "player",
            "name": char.name,
            "hp_current": char.hp_current,
            "hp_max": char.hp_max,
            "ac": char.ac,
            "initiative_bonus": char_engine.calculate_modifier(char.abilities.dexterity),
            "is_player": True,
        }]
        rolled = combat_engine.roll_initiative(combatants_raw)
        turn_order = [c.id for c in rolled]
        combatants_pydantic = [
            Combatant(
                id=c.id,
                name=c.name,
                hp_current=c.hp_current,
                hp_max=c.hp_max,
                ac=c.ac,
                initiative=c.initiative,
                is_player=c.is_player,
            )
            for c in rolled
        ]
        battle_state = BattleState(
            combatants=combatants_pydantic,
            turn_order=turn_order,
        )

    if changes.end_battle:
        battle_state = None

    # Compose updated session
    new_session = session.model_copy(update={
        "character": char,
        "battle_state": battle_state,
        "turn_count": session.turn_count + 1,
    })
    return new_session
