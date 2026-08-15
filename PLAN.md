# План доработки — DnD AI Game Master

Живой трекер. Контракт архитектуры — [`ARCHITECTURE.md`](./ARCHITECTURE.md).  
Статус сверен с кодом **2026-08-15**. После каждого закрытого шага обновлять этот файл: чекбокс + дата + PR.

Как отмечать:

- `[x]` — сделано и проверено в коде / тестами / ручным прогоном
- `[~]` — есть в коде, но дырявое, неполное или не подключено к игроку
- `[ ]` — не сделано

Не вычёркивать историю: если шаг переоткрыли, снять галку и кратко написать почему.

---

## Сейчас

- **Этап 2.5 закрыт** (2026-08-15, [PR #5](https://github.com/trickingegg/lost_initiative/pull/5)). XP/level сохраняются, `combatant_damage`, CORS+proxy, API-тесты без живого Gemini.
- **Этап 3A в работе** — UI ходит в FastAPI: setup + story template, create → start → opening action, лист с сервера, save/load слотов 1–3. Ключ убран из Vite `define`.
- Не начинать 3B/3C/4/5, пока 3A не закрыт ручным прогоном.

---

## Зачем этот документ

Сейчас в репозитории **два несклеенных продукта**:

1. Браузерный прототип (React в корне): сам ходит в Gemini, сам парсит `[DAMAGE:5]`, сейв в `localStorage`.
2. Backend Stages 1–2 (FastAPI): правила, сессия, SQLite, structured GM JSON.

Цель плана — довести это до **одной играбельной игры**, где:

- правила считает `backend/app/game_engine`;
- AI только описывает уже посчитанный факт;
- ключ провайдера живёт только на сервере;
- игроку приятно: понятный ввод, броски, лист, бой, сохранения, ошибки без краша.

Переписывать бэкенд и UI с нуля **не надо**. Выбросить надо прототипную механику, не экраны.

---

## Правила, которые нельзя нарушать

Из `ARCHITECTURE.md`, плюс игровой DX:

1. Ответ AI — только Pydantic / JSON schema. Никакого regex-парсинга команд.
2. Состояние иммутабельно: всегда новый объект, не мутировать вложенные поля.
3. `game_engine` не знает про AI. Тесты движка — без моков провайдера.
4. API-ключ только на backend. Во фронт не попадает даже через Vite `define`.
5. Новый модуль движка не считается готовым без тестов.
6. Ошибки GM не роняют игру: retry → понятное сообщение → можно повторить ход.
7. Источник правды сессии — сервер. `localStorage` максимум для UI-настроек (громкость, температура отображения).
8. Сначала играбельный вертикальный срез, потом полировка и этап 4–5. Не тащить голос, Imagen и новые классы в срез «можно играть».

---

## Снимок по этапам

| Этап | Что это | Статус |
|---|---|---|
| 1. Backend Core | движок, модели, SQLite, HTTP сессии | **сделан** |
| 2. AI GM | structured output, память, `/action`, провайдеры | **сделан, с дырами** |
| 2.5 Backend hardening | баги, из-за которых игра врёт или не клеится с UI | **закрыт (2026-08-15, PR #5)** |
| 3A. Играбельный контур | фронт ходит в FastAPI, один полный ход | **в работе** |
| 3B. Приятно играть | подсказки, броски, rest, сейвы, ошибки, стрим | **не начат** |
| 3C. Убрать прототип | выкинуть Gemini-в-браузере, regex, god-`App.tsx` | **не начат** |
| 4. Полная механика | death saves UI, conditions, классы этапа 2, AC | **не начинать до 3B** |
| 5. Голос | STT/TTS | **не начинать до стабильного текста** |

Отдельно (не этап архитектуры, но уже в работе):

| PR | Суть | Статус |
|---|---|---|
| [#3](https://github.com/trickingegg/lost_initiative/pull/3) | фронт не падает без `GEMINI_API_KEY` | **смержен в `main`** |
| [#4](https://github.com/trickingegg/lost_initiative/pull/4) | живой `PLAN.md` | **смержен в `main`** |
| [#5](https://github.com/trickingegg/lost_initiative/pull/5) | этап 2.5: XP, бой, CORS, моки тестов | **смержен в `main`** |

---

## Этап 1 — Backend Core

- [x] FastAPI + Pydantic v2 + SQLite async (`backend/app/`)
- [x] Domain-модели: `Character`, `GameSession`, `GMResponse`, `StateChanges`
- [x] `game_engine/dice.py`
- [x] `game_engine/character.py` (формулы, rest, XP 1–20)
- [x] `game_engine/combat.py` (инициатива, урон, death saves)
- [x] `game_engine/spells.py` (full / half / warlock)
- [x] `game_engine/conditions.py` (14 условий SRD + служебные)
- [x] Persistence: сессия JSON-блобом, слоты 1–3
- [x] HTTP: `/health`, `/api/session/*`, `/api/character/*`
- [x] Тесты движка и API-каркаса (`pytest`, 266 на момент закрытия 2.5)

Ограничения, с которыми живём (не блокеры этапа 1):

- `resolve_attack` принимает бонус/AC/кости, не объекты персонажей — ок, если вызывать из `session_service`.
- Hit dice как ресурс на short rest почти не ведутся.
- `level_up` не наполняет `new_features`.
- У слотов сохранения нет unique-constraint `(session_id, slot)` в БД — upsert на уровне CRUD.

---

## Этап 2 — AI GM

- [x] `gm_service.py`: контекст → провайдер → валидация JSON → fallback
- [x] `context_manager.py` + `memory.py`
- [x] 4 story template: `three_act`, `hex_crawl`, `dungeon_delve`, `political_intrigue`
- [x] Провайдеры: Gemini, OpenAI-compatible (DeepSeek / Groq / OpenRouter / Ollama)
- [x] `/api/session/{id}/action` и `/roll`
- [x] WS-маршрут `/ws/session/{id}/stream` **существует**
- [x] Unit-тесты GM с моком `_call_provider`

Дыры этапа 2 (перенесены в 2.5, не считать закрытыми):

- [ ] WS стримит сырые JSON-токены, а не нарратив — для игрока бесполезно → этап 3B
- [ ] `POST /api/image/generate` нет → не блокер 3A
- [x] `test_api.py::test_player_action` бьёт в живой провайдер, а не в мок — закрыто в 2.5
- [x] CORS по умолчанию `localhost:5173`, Vite слушает **3000** — закрыто в 2.5
- [x] `_from_engine_char` не копирует `xp`/`level` → `add_xp` теряется — закрыто в 2.5

---

## Этап 2.5 — Backend hardening (делать до или вместе с 3A)

Без этого «игра» будет врать в числах и плохо стыковаться с UI.

Закрыто 2026-08-15. Следующий код — этап 3A.

### Корректность состояния

- [x] `apply_state_changes`: XP и level возвращаются в domain `Character`
- [x] После XP — проверка порога и `level_up` (механические HP/proficiency; `session.pending_level_up` для UI-выборов, без молчаливого подкласса)
- [x] Урон врагам: поле `combatant_damage: [{id, amount}]`. `damage`/`heal` — только игрок. Движок не резолвит атаку сам (это этап 4)
- [x] `start_battle` кладёт игрока в `combatants` и считает инициативу; `turn_order` полный. Стыковка с `BattleTracker` — 3A
- [x] Unknown `set_condition` пишется в `gm_internal_notes` с префиксом `[ENGINE]` и в лог

### Контракт API для клиента

- [x] CORS: `http://localhost:3000`, `http://127.0.0.1:3000` + 5173
- [x] Vite proxy `/api` и `/ws` на `127.0.0.1:8000`
- [x] Ответ `/action` содержит `session` + `gm_response`
- [x] `POST /session/start` не вызывает AI — первый ход шлёт клиент
- [x] Story template выбирается на UI (сейчас экран сеттинга отдаёт только текст мира) → 3A

### Тесты, без которых нельзя клеить фронт

- [x] Замокать провайдер в `test_player_action` / `test_roll`
- [x] Тест: `add_xp` сохраняется в сессии
- [x] Тест: long rest через `/rest` и через `state_changes.long_rest`
- [x] Тест: `start_battle` заполняет `turn_order`
- [x] Не тащить живой Gemini в CI

Критерий готовности 2.5: ручной `curl` контур `start → action → rest → save/load` с мок-провайдером или ключом даёт согласованный `character` (HP, XP, инвентарь).

---

## Этап 3A — Играбельный контур ← текущий этап

2.5 закрыт. Пишем клиент. Один сценарий, без Zustand «потому что в доке», без переезда каталогов в первом PR.

Игрок должен суметь:

1. Открыть UI без ключа во фронте.
2. Выбрать сеттинг + story template.
3. Создать Fighter/Wizard/Rogue/Cleric/Monk/Necromancer.
4. Начать сессию на сервере.
5. Увидеть стартовый нарратив GM.
6. Ввести действие, получить ответ, увидеть обновлённый лист (HP/инвентарь/квест).
7. Сохранить и загрузить слот.

### Клиентский каркас

- [x] HTTP-клиент (`api/client.ts`): start / get / action / roll / rest / save / load
- [x] Типы фронта = зеркало Pydantic (`hp_current`, `char_class`, `role`/`content`). Старый `types.ts` только для формы создания
- [x] Маппер creation-формы → `CreateSessionRequest` (`api/mappers.ts`)
- [x] Ключ Gemini **убрать** из `vite.config.ts` `define`; proxy `/health` + `/api` + `/ws`
- [x] Экран «backend недоступен» на меню, без чёрного экрана
- [x] `App.tsx` больше не вызывает `getGameMasterResponse` и не гоняет `commandProcessor`

### Экраны (оставить визуал, сменить данные)

- [x] Меню: New / Load (слоты 1–3 на текущий `session_id`) / Settings
- [x] Setup: сеттинг + story template
- [x] Character creation: текущая форма, submit → `POST /api/character/create` → `POST /api/session/start`
- [x] Game: `StoryLog` + `CharacterSheet` читают `session`
- [x] Broсок: если `await_roll` в ответе — `DiceRollPrompt` → `POST /roll`
- [x] Кнопка Rest → `POST /rest` (чат пишется на сервере, не через `[LONG_REST]`)

### Что сознательно не делать в 3A

- Перенос всего дерева в `frontend/` (сделать в 3C, одним механическим PR)
- Zustand, если хватает одного session-state в корне
- WebSocket
- Картинки
- Новые классы/расы
- Vitest на весь UI — достаточно контрактных тестов API + один ручной прогон сценария выше

Критерий готовности 3A: с ключом на **backend** можно пройти 10–15 ходов без открытия DevTools. Без ключа UI живой и пишет честную ошибку GM.

---

## Этап 3B — Приятно играть

Полировка контура, не новая механика D&D.

- [ ] `suggested_actions` кликабельны под полем ввода
- [ ] Печать нарратива: либо HTTP + посимвольный reveal, либо **нормальный** WS (стримить `narrative`, не JSON)
- [ ] Индикатор «GM думает» без блокировки всего экрана навечно; кнопка Retry
- [ ] Бросок: анимация уже есть; добавить proficiency на skill check; crit 1/20 как system-line
- [ ] Боевой трекер читает `session.battle_state` (ход, HP врагов)
- [ ] Ход врага не отдельным браузерным `useEffect` в Gemini, а серверным правилом: либо клиент шлёт `It is the goblin's turn`, либо backend сам резолвит NPC-ход после `/roll`
- [ ] Три слота сохранения с датой и именем персонажа, confirm перед затиранием
- [ ] Conditions и death saves хотя бы как текст на листе (полный UI — этап 4)
- [ ] Убрать `alert()`: save/load/ошибки — тост или inline
- [ ] Мобильная вёрстка: поле ввода не уезжает, лист сворачивается
- [ ] README: как поднять backend + frontend + `.env`

Критерий готовности 3B: посторонний человек с ключом проходит бой и отдых, не читая этот файл.

### WebSocket — отдельным шагом внутри 3B

Текущий `/ws/session/{id}/stream` **не использовать как есть**. Сначала:

- [ ] Стримить только поле `narrative` (или копить JSON молча и пушить `chunk` уже из `narrative`)
- [ ] После полного JSON — те же `state_changes` / `done`, что и HTTP
- [ ] Retry как в `gm_service` (сейчас у WS его нет)
- [ ] Тест на протокол WS

Пока это не готово, клиент играет через HTTP. Два транспорта в UI одновременно не плодить.

---

## Этап 3C — Убрать прототипную механику

Когда 3A+3B живут на API:

- [ ] Удалить `services/geminiService.ts` из игрового пути (или весь файл)
- [ ] Удалить `utils/commandProcessor.ts`
- [ ] Разобрать god-`App.tsx`: экраны + session store, без боевого FSM и regex
- [ ] Перенести клиент в `frontend/` как в архитектуре (один PR, без смены поведения)
- [ ] Tailwind: убрать CDN, собрать как PostCSS (или оставить CDN до отдельного PR, но не оба способа)
- [ ] Портировать нужные куски `constants.ts` в Python, чтобы `/api/character/*` отдавал классы/расы/заклинания, а фронт не держал вторую таблицу правды
- [ ] `.gitignore`: `.venv`, корневой `.env`

---

## Этап 4 — Полная механика

Не начинать, пока 3B не закрыт. Иначе снова разъедутся два клиента.

- [ ] Death saves UI (движок уже есть)
- [ ] Conditions: иконки/тултипы, не только строка
- [ ] Short rest: выбор hit dice
- [ ] Правильный AC по броне из инвентаря (функция есть, данные брони должны быть каноничными)
- [ ] Spell slots 6–9, списки заклинаний не только Wizard/Necromancer
- [ ] Классы этапа 2: Barbarian, Paladin, Ranger, Sorcerer, Warlock, Bard, Druid
- [ ] Расы этапа 2: Dragonborn, Gnome, Half-Orc, Aasimar
- [ ] Half-Elf и Tiefling в UI создания (backend список уже содержит)

---

## Этап 5 — Голос

Только после стабильного текста.

- [ ] STT (Whisper или аналог)
- [ ] TTS, `speaker_voice` в `GMResponse`
- [ ] Аудиоканал поверх того же WS, не вместо текста

---

## KEEP / THROW

Брать из прототипа:

| Оставить | Путь | Как |
|---|---|---|
| Экраны UI | `components/*.tsx` | Подключить к session API |
| Идеи промпта | `services/geminiService.ts` | Уже частично в `prompts.py` |
| Таблицы классов/рас/заклинаний | `constants.ts` | Порт в Python на 3C |
| Формулы как референс | `utils/dnd.ts` | Сверять с `game_engine`, не держать вторую реализацию |

Выбросить, не «рефакторить»:

| Выбросить | Почему |
|---|---|
| `App.tsx` как игровой движок | God component, бой и AI в одном месте |
| `utils/commandProcessor.ts` | Regex-команды, нарушает правило 1 |
| Браузерный Gemini + Vite `define` ключа | Нарушает правило 4 |
| `localStorage` как сейв игры | Нет слотов, нет серверного стейта |
| Парсер `[START_BATTLE:json]` | Есть `state_changes.start_battle` |

---

## Definition of Done

### «Можно играть» (конец 3A)

- Ключ только в `backend/.env`
- Меню → сеттинг → персонаж → игра без чёрного экрана
- Ход игрока меняет нарратив **и** лист с сервера
- Broсок по запросу GM работает
- Save/load слота 1 не теряет HP и историю
- Backend-тесты зелёные, `/action` в тестах не ходит в сеть

### «Приятно играть» (конец 3B)

- Подсказки действий
- Понятный бой: чей ход, кто жив
- Rest кнопкой, не заклинанием в чат
- Ошибка GM с Retry, без `alert`
- Сессия переживает обновление страницы (`GET /session/{id}`)

---

## Что не делать, пока не закрыт 3A

- Новые AI-провайдеры «на всякий случай»
- Imagen / картинки сцен
- Голос
- Полный переезд на Zustand + Vitest + `frontend/src` одним коммитом
- Генерация классов этапа 2
- Параллельная доработка прототипного Gemini-клиента «пока клеим API» — это снова два продукта

---

## Порядок следующих PR

1. ~~Backend 2.5: XP/CORS/моки тестов~~ — закрыто, [PR #5](https://github.com/trickingegg/lost_initiative/pull/5).
2. **Сейчас: фронт 3A** — HTTP-клиент + session-driven `App` + создание персонажа. Прототипный Gemini ещё можно оставить мёртвым кодом до 3C, но не в runtime-пути.
3. 3B: подсказки, rest, слоты, ошибки, бой.
4. WS-стриминг нарратива.
5. 3C: выпилить прототип, перенести `frontend/`.
