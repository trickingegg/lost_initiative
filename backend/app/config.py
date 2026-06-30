from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── AI Provider selection ─────────────────────────────────────────────
    # Supported: gemini | openai | deepseek | groq | openrouter | ollama | openai_compatible
    ai_provider: str = "gemini"

    # ── Gemini ────────────────────────────────────────────────────────────
    gemini_api_key: str = ""
    gemini_model: str = "gemini-1.5-flash"

    # ── OpenAI-compatible (OpenAI, DeepSeek, Groq, Ollama, etc.) ─────────
    openai_api_key: str = ""
    openai_base_url: str = ""         # leave empty to use preset for known providers
    openai_model: str = ""            # leave empty to use preset default model
    openai_json_mode: bool = True     # set False if the model doesn't support it

    # ── Persistence ───────────────────────────────────────────────────────
    database_url: str = "sqlite+aiosqlite:///./game.db"

    # ── Server / CORS ─────────────────────────────────────────────────────
    cors_origins: str = "http://localhost:5173"

    # ── Context window limits ─────────────────────────────────────────────
    max_history_messages: int = 25
    max_memory_events: int = 10

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
