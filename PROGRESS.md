# DnD AI Game Master — Прогресс разработки

## Текущий статус

**Ветка:** `cursor/dnd-ai-gm-3a5b`  
**Тесты:** backend 279 passed, 0 failed | frontend 13 passed, 0 failed  
**Готово к запуску:** backend (нужен API ключ), frontend — портирование завершено, WebSocket стриминг готов, полная D&D механика реализована

---

## ✅ Сделано

### Этап 1 — Backend Core

**Инфраструктура**
- Структура проекта `backend/app/{game_engine,models,db,api,services,ai_gm}`
- `requirements.txt`: FastAPI 0.111, Pydantic v2.7, SQLAlchemy 2.0 async, aiosqlite, pytest, openai, google-generativeai
- `config.py` через pydantic-settings — все настройки через env vars
- `main.py` — lifespan startup, CORS, router registration

**`game_engine/` — чистая D&D механика, без AI, 204 теста**

| Модуль | Что реализовано |
|---|---|
| `dice.py` | `roll`, `roll_with_advantage/disadvantage`, `roll_damage("2d6+3")` — regex-парсинг, min(0), критическое удвоение |
| `character.py` | `calculate_modifier/proficiency_bonus/ac/skill_bonus`, AC для всех типов брони + Monk/Barbarian unarmored defense, `apply_long/short_rest`, `level_up`, `get_level_for_xp`, XP-таблица до 20 уровня |
| `combat.py` | `roll_initiative`, `resolve_attack` (nat 1/20, critical hit double dice), `apply_damage` (player vs enemy death semantics), `check_death_saves` (3 успеха/провала, nat 1 = 2 провала, nat 20 = 1 HP), `calculate_xp_reward` по CR (DMG таблица) |
| `spells.py` | `FULL_CASTER_SLOTS` / `HALF_CASTER_SLOTS` / `WARLOCK_SLOTS` уровни 1–20, `can_cast_spell`, `expend_spell_slot` (берёт наименьший доступный слот ≥ уровню), `restore_warlock_slots_on_short_rest`, `build_initial_spell_slots` |
| `conditions.py` | Все 14 официальных условий SRD + dead/stable/concentrating, `apply/clear_condition`, `attacker_has_advantage_vs`, `creature_has_attack_disadvantage`, `is_incapacitated` |

**Pydantic v2 domain models** (`app/models/domain.py`)
- `Character`, `AbilityScores`, `SpellSlot`, `BattleState`, `Combatant`
- `GameSession`, `ChatMessage`, `MemoryEvent`
- `GMResponse`, `StateChanges`, `RollRequest` — точно по схемам ARCHITECTURE.md
- Все API request/response shapes

**DB layer** (`app/db/`)
- `GameSessionRecord` + `SaveSlotRecord` — JSON blobs, без миграций
- Async CRUD: create/get/update_session, save/load по 3 слотам

**API** (`app/api/routes/`)
```
POST   /api/session/start
GET    /api/session/{id}
POST   /api/session/{id}/action     ← AI GM
POST   /api/session/{id}/roll       ← AI GM
POST   /api/session/{id}/rest       (short / long)
POST   /api/session/{id}/save       (слоты 1–3)
POST   /api/session/{id}/load
POST   /api/character/create
GET    /api/character/classes
GET    /api/character/races
GET    /api/character/ability-modifier/{score}
WS     /ws/session/{id}/stream      ← стриминг нарратива
GET    /health
```

**`session_service.py`** — применение `StateChanges` к сессии: урон/хил, conditions, spell slots, ki, инвентарь, квесты, battle start/end с автоматическим roll_initiative

---

### Этап 2 — AI Game Master

**`ai_gm/schemas.py`** — Pydantic-схема валидации Gemini/LLM ответа (отделена от domain model)

**`ai_gm/prompts.py`** — `build_system_prompt()` с:
- Правилами GM (не считай механику, используй `await_roll`)
- 4 story templates: `three_act`, `hex_crawl`, `dungeon_delve`, `political_intrigue`
- Character sheet, battle state, memory events, GM notes
- JSON schema в промпте

**`ai_gm/memory.py`** — долгосрочная GM-память:
- Эвристики значимости: combat start/end, quest update, XP ≥100, critical conditions, deception keywords
- Тегированные `MemoryEvent` (tags: `combat:start`, `quest_status:completed`, `deception`, ...)
- `format_memory_for_prompt()` для включения в контекст

**`ai_gm/context_manager.py`** — `build_context_window()`:
1. System prompt + character sheet + battle state (всегда)
2. Последние `MAX_MEMORY_EVENTS` из session.memory_events
3. Последние `MAX_HISTORY_MESSAGES` сообщений
4. `internal_gm_notes` из предыдущего хода

**`ai_gm/gm_service.py`** — главный сервис:
- `process_action()` + `process_roll_result()`
- Retry до 2 раз с уточнением промпта при невалидном JSON
- Сетевые/auth ошибки → immediate fallback (graceful degradation)
- Strip markdown fences если LLM нарушил `response_mime_type`
- Сохраняет `internal_gm_notes` и memory events в сессию

**WebSocket стриминг** — `provider.stream()` с форвардом чанков, `state_changes` + `suggested_actions` по окончании, персистирование сессии

---

### Provider Abstraction — поддержка любого AI

**`ai_gm/providers/`**

| Файл | Что делает |
|---|---|
| `base.py` | `AIProvider` ABC: `async generate(prompt) -> str` + `async stream(prompt) -> AsyncIterator[str]` |
| `gemini.py` | Google Gemini через `asyncio.to_thread` (не блокирует event loop) |
| `openai_compatible.py` | `AsyncOpenAI` с настраиваемым `base_url` — один класс для всех |
| `factory.py` | `get_provider()` синглтон, preset-конфиги для 5 провайдеров |

**Поддерживаемые провайдеры** — переключение одной строкой в `.env`:

```bash
AI_PROVIDER=gemini      # Google Gemini (по умолчанию)
AI_PROVIDER=deepseek    # DeepSeek  — OPENAI_API_KEY=sk-...
AI_PROVIDER=openai      # OpenAI    — OPENAI_API_KEY=sk-...
AI_PROVIDER=groq        # Groq      — OPENAI_API_KEY=gsk_... (быстрый Llama3)
AI_PROVIDER=openrouter  # OpenRouter — доступ к 100+ моделям
AI_PROVIDER=ollama      # Ollama локально — ключ не нужен
AI_PROVIDER=openai_compatible  # любой кастомный endpoint
```

---

### Этап 3 — Frontend SPA

**`frontend/` — структурированный React SPA**
- React 18, TypeScript, Vite, Tailwind CSS 4, Zustand, React Router v6
- API-клиент (HTTP + WebSocket с поддержкой стриминга и heartbeat)
- Zustand store: все состояние игры, UI, персонаж, бой

**Компоненты:**
- `MainMenuScreen`, `AdventureSetupScreen`, `CharacterCreationScreen` (создание персонажа)
- `GameScreen` — главный экран с чатом, rest-кнопками, save/load
- `CharacterSheet` — HP/AC/abilities/spell slots/death saves/conditions/quests/inventory
- `StoryLog`, `DiceRollPrompt`, `BattleTracker`, `HealthBar`, `StatBlock`
- Vitest тесты: `HealthBar`, `StatBlock`, `StoryLog` (13 тестов)

---

### Этап 4 — Полная механика

**Новые модули game engine:**

| Модуль | Что реализовано |
|---|---|
| `concentration.py` | `start_concentration` / `end_concentration`, `check_concentration` — прерывание при уроне (Con save, DC = max(10, урон/2)) |
| `exhaustion.py` | 6 уровней exhaustion с кумулятивными штрафами: L1 — disadv. ability checks, L2 — speed halved, L3 — disadv. attacks/saves, L4 — HP max halved, L5 — speed 0, L6 — death. `apply_exhaustion`, `reduce_exhaustion`, `clear_exhaustion`, `get_effective_speed`, `get_effective_hp_max` |

**Domain-модели:**
- `Character.exhaustion: int = 0` — поле в Pydantic и EngineCharacter
- `StateChanges.exhaustion_change: int` — GM может изменять истощение
- `StateChanges.concentration_check` — GM может проверять концентрацию при уроне

**Классы/расы (этап 2):**
- Классы: Barbarian, Paladin, Ranger, Sorcerer, Warlock, Bard, Druid
- Расы: Dragonborn, Gnome, Half-Orc, Aasimar
- Spell slots 6-9 уровней уже в таблицах `FULL_CASTER_SLOTS` (были с Этапа 1)

**Death saves UI:**
- 6 кружков (3 зелёных успеха + 3 красных провала), пульсирующая анимация при 0 HP
- Черепная анимация заголовка

**Short rest UI:**
- Модальное окно с выбором количества hit dice (range slider 0–level)
- Отображение hit die (d8, d10, d12 в зависимости от класса) + CON mod

**Exhaustion UI:**
- Индикатор 6 уровней с цветовой градацией (жёлтый → оранжевый → красный)
- Текстовая подсказка текущего штрафа

---

## 🔲 Предстоит сделать

### Этап 5 — Voice

**Цель:** полностью голосовое управление.

- [ ] **STT:** Whisper API — голосовой ввод действий игрока (браузерный микрофон → /transcribe → текст в чат)
- [ ] **TTS:** ElevenLabs или Google TTS — озвучка нарратива GM
- [ ] Поле `speaker_voice` в GMResponse для выбора голоса NPC
- [ ] Аудио через WebSocket — параллельно с текстом
- [ ] Push-to-talk кнопка в UI
- [ ] Настройки голоса GM (темп, тон, персонаж)

---

## Быстрый старт

### Backend
```bash
cd backend
cp .env.example .env          # выбрать провайдер, добавить API ключ
uv venv && uv pip install -r requirements.txt
uv run uvicorn app.main:app --reload --port 8000
# Swagger UI: http://localhost:8000/docs
# Тесты:
uv run pytest
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# http://localhost:5173

# Тесты:
npm test
```

Минимальная конфигурация для DeepSeek (дешевле Gemini):
```bash
AI_PROVIDER=deepseek
OPENAI_API_KEY=sk-xxxxxxxx
```

Без API ключа (бесплатно, нужен Ollama):
```bash
AI_PROVIDER=ollama
OPENAI_MODEL=llama3
OPENAI_JSON_MODE=false
# ollama serve  (в отдельном терминале)
```
