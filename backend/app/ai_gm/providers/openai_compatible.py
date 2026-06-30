"""
OpenAI-compatible provider.

Works with any API that speaks the OpenAI Chat Completions protocol:
  - OpenAI              base_url=https://api.openai.com/v1  (default)
  - DeepSeek            base_url=https://api.deepseek.com
  - Groq                base_url=https://api.groq.com/openai/v1
  - OpenRouter          base_url=https://openrouter.ai/api/v1
  - Ollama (local)      base_url=http://localhost:11434/v1
  - LM Studio (local)   base_url=http://localhost:1234/v1
  - Any other provider  set OPENAI_BASE_URL accordingly

JSON mode is requested via response_format={"type":"json_object"}.
Not all models support this — if the model doesn't, the system prompt
already instructs it to return JSON, so it usually works anyway.
"""
from __future__ import annotations

from typing import AsyncIterator

from openai import AsyncOpenAI

from app.ai_gm.providers.base import AIProvider

_OPENAI_DEFAULT_BASE_URL = "https://api.openai.com/v1"


class OpenAICompatibleProvider(AIProvider):
    def __init__(
        self,
        api_key: str,
        model: str = "gpt-4o-mini",
        base_url: str = _OPENAI_DEFAULT_BASE_URL,
        supports_json_mode: bool = True,
    ) -> None:
        if not api_key:
            raise ValueError("API key is required for OpenAICompatibleProvider")
        self._client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        self._model = model
        self._base_url = base_url
        self._supports_json_mode = supports_json_mode

    @property
    def name(self) -> str:
        host = self._base_url.replace("https://", "").replace("http://", "").split("/")[0]
        return f"openai-compatible/{host}/{self._model}"

    async def generate(self, prompt: str) -> str:
        kwargs: dict = {
            "model": self._model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.9,
        }
        if self._supports_json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        response = await self._client.chat.completions.create(**kwargs)
        return response.choices[0].message.content or ""

    async def stream(self, prompt: str) -> AsyncIterator[str]:
        kwargs: dict = {
            "model": self._model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.9,
            "stream": True,
        }
        # json_mode + stream works on OpenAI; some providers don't support it
        if self._supports_json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        async with await self._client.chat.completions.create(**kwargs) as response:
            async for chunk in response:
                delta = chunk.choices[0].delta.content if chunk.choices else None
                if delta:
                    yield delta
