# DnD AI Game Master

Полноценная текстовая D&D 5e игра с ИИ в роли Game Master.

**Правила считает код, ИИ описывает результат.** Никакого regex-парсинга AI-ответов — только structured JSON output через Pydantic v2.

## Архитектура

```text
player text ──→ POST /api/session/{id}/action ──→ AI GM (Gemini/DeepSeek/OpenAI/...)
                                                         │
                                           ┌─────────────┘
                                           ▼
                              structured JSON: narrative + state_changes
                                           │
                         ┌─────────────────┘
                         ▼
              game_engine (чистая D&D механика)
              └─ dice, combat, spells, conditions, character
                         │
                         ▼
              обновлённая GameSession → ответ игроку
```

Подробнее: [`ARCHITECTURE.md`](ARCHITECTURE.md)

## Статус

| Этап | Статус |
|------|--------|
| 1 — Backend Core (game engine, API, DB) | ✅ Готово |
| 2 — AI Game Master (structured output, память, провайдеры) | ✅ Готово |
| 3 — Frontend (React SPA) | 🔲 В работе |
| 4 — Полная механика (классы, расы, реакции) | 🔲 Предстоит |
| 5 — Voice (STT/TTS) | 🔲 Предстоит |

Подробный прогресс: [`PROGRESS.md`](PROGRESS.md)

## Быстрый старт

### Бэкенд

```bash
cd backend
cp .env.example .env          # выбрать AI-провайдера, добавить API-ключ
uv venv && uv pip install -r requirements.txt
uv run uvicorn app.main:app --reload --port 8000
```

Swagger UI: http://localhost:8000/docs

### Тесты

```bash
cd backend
uv run pytest
# 247 тестов в game_engine, ai_gm и API
```

### Поддерживаемые AI-провайдеры

```bash
AI_PROVIDER=gemini      # Google Gemini (по умолчанию, нужен GEMINI_API_KEY)
AI_PROVIDER=deepseek    # DeepSeek (нужен OPENAI_API_KEY)
AI_PROVIDER=openai      # OpenAI
AI_PROVIDER=groq        # Groq (быстрый Llama3)
AI_PROVIDER=openrouter  # OpenRouter (100+ моделей)
AI_PROVIDER=ollama      # Ollama локально (ключ не нужен)
AI_PROVIDER=openai_compatible  # любой кастомный endpoint
```

Минимальная конфигурация для DeepSeek:

```bash
AI_PROVIDER=deepseek
OPENAI_API_KEY=sk-xxxxxxxx
```

Без API-ключа (через локальный Ollama):

```bash
AI_PROVIDER=ollama
OPENAI_MODEL=llama3
OPENAI_JSON_MODE=false
```

## Структура проекта

```text
backend/                  # Python/FastAPI backend
  app/
    game_engine/          # Чистая D&D механика (dice, combat, spells, ...)
    ai_gm/                # AI Game Master (prompts, память, провайдеры)
    api/routes/           # REST + WebSocket endpoints
    db/                   # SQLite persistence (SQLAlchemy async)
    models/               # Pydantic v2 domain models
    services/             # Бизнес-логика
  tests/                  # 247 тестов

frontend-prototype/       # Прототип (React 19), будет заменён на frontend/
frontend/                 # Целевой SPA (React + TypeScript + Vite, etapa 3)
```

## Лицензия

MIT
