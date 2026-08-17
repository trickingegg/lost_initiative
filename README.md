# Lost Initiative — DnD AI Game Master

Текстовая D&D 5e с ИИ-мастером. **Правила считает backend** (`backend/app/game_engine`). AI только описывает уже посчитанный факт. Ключ провайдера живёт только в `backend/.env`, во фронт не попадает.

Клиент — React/Vite в каталоге `frontend/`.

## Что нужно

- Python 3.11+
- Node.js 20+
- Ключ AI-провайдера (Gemini по умолчанию). Без ключа UI живой: GM отвечает fallback-текстом, игра не падает.

## Запуск

```bash
# 1. Backend
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # впишите GEMINI_API_KEY или смените AI_PROVIDER
uvicorn app.main:app --reload --port 8000

# 2. Frontend (другой терминал)
cd frontend
npm install
npm run dev                 # Vite: http://localhost:3000
```

Откройте **http://localhost:3000**. Vite проксирует `/api`, `/health` и `/ws` на `127.0.0.1:8000`.

## Переменные окружения (`backend/.env`)

См. `backend/.env.example`. Минимум:

```
AI_PROVIDER=gemini
GEMINI_API_KEY=...
DATABASE_URL=sqlite+aiosqlite:///./game.db
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Другие провайдеры (DeepSeek, Groq, OpenRouter, Ollama) закомментированы в `.env.example`.

## Игровой контур

Меню → сеттинг + story template → создание персонажа → ходы через HTTP `/api/session/{id}/action`. Бросок по запросу GM, Long/Short Rest кнопками, сейвы слотов 1–3 (с именем и датой). Клиент не стримит WebSocket: нарратив приходит целиком и печатается в логе.

## Тесты backend

```bash
cd backend
source .venv/bin/activate
pytest
```

Тесты не ходят в живой Gemini. API-фикстура использует in-memory SQLite и не трогает ваш `game.db`.
