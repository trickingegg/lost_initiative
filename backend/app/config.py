from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    gemini_api_key: str = ""
    database_url: str = "sqlite+aiosqlite:///./game.db"
    cors_origins: str = "http://localhost:5173"
    max_history_messages: int = 25
    max_memory_events: int = 10

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
