# DnD AI Game Master — Architecture Reference

## Цель

Полноценная текстовая DnD 5e игра с ИИ в роли Game Master.
ИИ-GM должен: вести нарратив, помнить долгосрочный контекст, применять шаблоны реальных GM-ов, реагировать на решения игрока с последствиями.
Правила D&D считает **код**, AI только описывает результаты словами.

Первый этап — текст. После стабилизации — голос (STT/TTS).

---

## Стек

| Слой | Технология |
|---|---|
| Backend | Python 3.11 + FastAPI + Pydantic v2 |
| Persistence | SQLite (SQLAlchemy async) |
| AI | Google Gemini API — **structured output / JSON mode** |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Realtime | WebSocket (стриминг нарратива) |
| Тесты | pytest (backend), Vitest (frontend) |

Переменные окружения:
```
GEMINI_API_KEY=...
DATABASE_URL=sqlite+aiosqlite:///./game.db
CORS_ORIGINS=http://localhost:5173
MAX_HISTORY_MESSAGES=25
MAX_MEMORY_EVENTS=10
```

---

## Структура проекта

```
backend/
  app/
    main.py
    models/           — Pydantic domain models (Character, GameSession, GMResponse...)
    game_engine/      — Чистая D&D механика, без AI
      dice.py
      combat.py
      character.py
      spells.py
      conditions.py
    ai_gm/            — AI Game Master сервис
      gm_service.py   — buildContextWindow → callGemini → validateResponse
      context_manager.py
      memory.py
      prompts.py      — system prompt + story templates
      schemas.py      — Pydantic схемы structured output
    db/
      session.py
      models.py       — ORM модели
      crud.py
    api/
      routes/
        game.py
        character.py
        ws.py
  tests/

frontend/
  src/
    components/       — UI (CharacterSheet, BattleTracker, StoryLog, DiceRoll...)
    store/            — Zustand или useReducer, NO god-component
    api/              — HTTP + WebSocket клиент
    types/            — TypeScript типы
```

---

## Главный принцип: правила считает код, AI описывает

```python
# НЕПРАВИЛЬНО (как в прототипе): AI сам решает "[DAMAGE:5]"

# ПРАВИЛЬНО:
result = combat_engine.resolve_attack(attacker=goblin, target=player, roll=14)
gm_context = f"Goblin rolled 14 vs player AC {player.ac}. {'Hit' if result.hit else 'Miss'}. Damage: {result.damage}."
# AI берёт этот факт и описывает его драматически
```

---

## Structured Output — никакого regex

AI возвращает строго типизированный JSON. Pydantic валидирует.

```python
# backend/app/ai_gm/schemas.py

class RollRequest(BaseModel):
    type: Literal["ABILITY_CHECK", "SAVING_THROW", "ATTACK_ROLL"]
    ability: str
    dc: int
    reason: str

class StateChanges(BaseModel):
    damage: Optional[int] = None
    heal: Optional[int] = None
    add_xp: Optional[int] = None
    add_items: List[dict] = []
    remove_items: List[dict] = []
    start_battle: Optional[List[dict]] = None  # список врагов с name/hp/ac/initiative_bonus/cr
    end_battle: bool = False
    await_roll: Optional[RollRequest] = None
    quest_update: Optional[dict] = None        # {"title": "...", "description": "...", "status": "active|completed|failed"}
    long_rest: bool = False
    short_rest: bool = False
    set_condition: Optional[str] = None        # "poisoned", "prone", etc.
    clear_condition: Optional[str] = None
    cast_spell: Optional[dict] = None          # {"name": "...", "level": 1}
    use_ki: Optional[int] = None

class GMResponse(BaseModel):
    narrative: str
    state_changes: StateChanges
    image_prompt: Optional[str] = None    # для Imagen если сцена новая
    image_key: Optional[str] = None       # уникальный ключ для кеширования
    internal_gm_notes: str = ""           # не видно игроку, передаётся в следующий ход
    suggested_actions: List[str] = []     # необязательные подсказки игроку
```

Если Gemini вернул невалидный JSON — повторить запрос с уточнением (до 2 попыток), затем friendly error.

---

## Память GM — два уровня

**Рабочий контекст (каждый ход):**
- Последние `MAX_HISTORY_MESSAGES` сообщений
- Полный character sheet
- Активные квесты и conditions
- Текущий battle state
- `internal_gm_notes` из предыдущего хода

**Долгосрочная память:**
- После каждого значимого события (boss killed, quest update, NPC interaction, player deception) — сохранять summary в БД
- Перед формированием промпта — загружать последние `MAX_MEMORY_EVENTS` событий сессии
- Формат: `{"event": "Player lied to Guard Captain", "turn": 14, "tags": ["npc:guard_captain", "deception"]}`

```python
# context_manager.py — алгоритм сборки контекста
def build_context_window(session: GameSession) -> str:
    # 1. system prompt + character sheet + battle state (всегда)
    # 2. relevant memory events (из БД)
    # 3. последние N сообщений (до лимита токенов)
    # 4. internal_gm_notes
```

---

## Domain Models (ключевые)

```python
class Character(BaseModel):
    id: str
    name: str
    race: str
    char_class: str
    subclass: Optional[str] = None
    background: str
    level: int = 1
    xp: int = 0
    hp_current: int
    hp_max: int
    ac: int
    speed: int = 30
    abilities: AbilityScores          # str/dex/con/int/wis/cha
    proficiency_bonus: int = 2
    skills: List[str] = []
    features: List[dict] = []
    inventory: List[dict] = []
    spells_known: List[str] = []
    spell_slots: Dict[int, SpellSlot] = {}
    ki_current: Optional[int] = None
    ki_max: Optional[int] = None
    conditions: List[str] = []
    death_saves: dict = {"successes": 0, "failures": 0}
    quests: List[dict] = []

class GameSession(BaseModel):
    id: str
    character: Character
    setting: str
    story_template: str               # "three_act" | "hex_crawl" | "dungeon_delve" | "political_intrigue"
    chat_history: List[ChatMessage] = []
    battle_state: Optional[BattleState] = None
    world_events: List[dict] = []
    gm_internal_notes: str = ""
    images_cache: Dict[str, str] = {}
    turn_count: int = 0
```

---

## Game Engine — что реализовать

Всё в `backend/app/game_engine/`. Чистые функции, никакого AI, 100% покрытие тестами.

**dice.py:** `roll(sides, count)`, `roll_with_advantage(sides)`, `roll_with_disadvantage(sides)`, `roll_damage("2d6+3")`

**character.py:**
- `calculate_modifier(score) -> int`
- `calculate_proficiency_bonus(level) -> int`
- `calculate_ac(character) -> int` — учитывает броню из инвентаря
- `calculate_skill_bonus(character, skill) -> int` — с proficiency
- `apply_long_rest(character) -> Character` — HP + слоты + Ki
- `apply_short_rest(character, hit_dice_spent) -> Character`
- `level_up(character) -> tuple[Character, LevelUpChoices]`
- XP thresholds до уровня 20

**combat.py:**
- `roll_initiative(combatants) -> List[Combatant]`
- `resolve_attack(attacker, target, roll) -> AttackResult`
- `apply_damage(target, damage, type) -> tuple[Character, bool]` — bool = is_dead
- `check_death_saves(character, roll) -> Character`
- `calculate_xp_reward(enemies, party_level) -> int`

**spells.py:**
- `can_cast_spell(character, spell_level) -> bool`
- `expend_spell_slot(character, level) -> Character`
- `FULL_CASTER_SLOTS` — уровни 1–20
- `HALF_CASTER_SLOTS` — Paladin, Ranger (с уровня 2 класса)
- `WARLOCK_SLOTS` — pact magic (восстанавливается на short rest)

**conditions.py:** все 14 условий D&D 5e (Blinded, Charmed, Frightened, Paralyzed, Poisoned, Prone, Stunned и т.д.), `apply_condition`, `get_condition_description`

---

## API Endpoints

```
POST   /api/session/start           — создать сессию
GET    /api/session/{id}            — получить состояние
POST   /api/session/{id}/action     — действие игрока → GMResponse
POST   /api/session/{id}/roll       — результат броска → GMResponse
POST   /api/session/{id}/rest       — {"type": "short"|"long"}
POST   /api/session/{id}/save       — сохранить в слот (минимум 3 слота)
POST   /api/session/{id}/load       — загрузить из слота
POST   /api/image/generate          — генерация изображения (Imagen)
WS     /ws/session/{id}/stream      — стриминг нарратива
```

---

## System Prompt (структура)

```
You are an expert D&D 5e Game Master running a {story_template} campaign.

You narrate the world and portray NPCs.
You do NOT calculate mechanics — the game engine does that and provides you the results.
You take those results and describe them dramatically.

Narrative style: second-person present tense, 1-3 paragraphs, end with a situation to react to.

Story template: {story_template_name}
{story_template_instructions}

World: {setting}
Relevant history: {memory_events}
GM notes (previous turn): {internal_gm_notes}

Respond ONLY with valid JSON matching GMResponse schema. No markdown, no extra text.
```

Story templates: `three_act`, `hex_crawl`, `dungeon_delve`, `political_intrigue` — каждый с инструкциями по структуре нарратива.

---

## Классы персонажа

**Этап 1 (запуск):** Fighter, Wizard, Rogue, Cleric, Monk, Necromancer (как вариант Wizard)
**Этап 2:** Barbarian, Paladin, Ranger, Sorcerer, Warlock, Bard, Druid

**Расы этап 1:** Human, Elf, Dwarf, Halfling, Half-Elf, Tiefling
**Расы этап 2:** Dragonborn, Gnome, Half-Orc, Aasimar

---

## Что взять из прототипа (папка `/workspace`)

| Что | Откуда | Действие |
|---|---|---|
| UI компоненты | `components/*.tsx` | Переработать, подключить к API |
| D&D константы | `constants.ts` | Портировать в Python |
| Идеи system prompt | `services/geminiService.ts` | Переработать под structured output |
| Типы как референс | `types.ts` | При написании Pydantic моделей |
| `App.tsx` | — | Выбросить (god component) |
| `utils/commandProcessor.ts` | — | Выбросить (regex → structured output) |

---

## Этапы разработки

**Этап 1 — Backend Core**
Настройка проекта → game_engine модули с тестами → Pydantic модели → SQLite persistence → базовые API endpoints

**Этап 2 — AI GM**
`gm_service.py` с structured output → context_manager → memory → `/action` endpoint → тесты с мок Gemini

**Этап 3 — Frontend**
Адаптировать компоненты из прототипа → подключить к API → WebSocket стриминг → несколько слотов сохранений

**Этап 4 — Полная механика**
Death saves UI → Conditions → Short rest → Все классы этапа 2 → Spell slots 6–9 → Proper AC

**Этап 5 — Voice**
STT: Whisper API → TTS: ElevenLabs/Google TTS → поле `speaker_voice` в GMResponse → аудио через WebSocket

---

## Критические требования

1. **Никакого regex** для парсинга AI ответов — только Pydantic + structured output
2. **Никаких мутаций** вложенных объектов — всегда новые объекты
3. **Game Engine не зависит от AI** — чистые функции, тестируемые без моков
4. **API key только на backend** — никогда не передавать на frontend
5. **Каждый game_engine модуль** покрыт тестами перед переходом к следующему
6. **WebSocket стриминг** — нарратив появляется постепенно, не ждать полного ответа
7. **Graceful degradation** — невалидный JSON от Gemini → retry (2 попытки) → friendly error
