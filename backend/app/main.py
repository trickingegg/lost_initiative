from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.session import init_db
from app.api.routes import game, character, ws


@asynccontextmanager
async def lifespan(application: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="DnD AI Game Master",
    description="D&D 5e game with AI Game Master powered by Google Gemini",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(game.router, prefix="/api")
app.include_router(character.router, prefix="/api")
app.include_router(ws.router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
