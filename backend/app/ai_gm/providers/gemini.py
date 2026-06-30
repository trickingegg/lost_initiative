"""
Google Gemini provider.

Uses response_mime_type="application/json" for structured output.
Sync SDK calls are wrapped in asyncio.to_thread to avoid blocking the event loop.
"""
from __future__ import annotations

import asyncio
from typing import AsyncIterator

import google.generativeai as genai

from app.ai_gm.providers.base import AIProvider


class GeminiProvider(AIProvider):
    def __init__(self, api_key: str, model: str = "gemini-1.5-flash") -> None:
        if not api_key:
            raise ValueError("GEMINI_API_KEY is required for GeminiProvider")
        genai.configure(api_key=api_key)
        self._model_name = model
        self._generation_config = genai.GenerationConfig(
            temperature=0.9,
            response_mime_type="application/json",
        )

    @property
    def name(self) -> str:
        return f"gemini/{self._model_name}"

    def _make_model(self) -> genai.GenerativeModel:
        return genai.GenerativeModel(
            model_name=self._model_name,
            generation_config=self._generation_config,
        )

    async def generate(self, prompt: str) -> str:
        def _sync_call() -> str:
            model = self._make_model()
            response = model.generate_content(prompt)
            return response.text

        return await asyncio.to_thread(_sync_call)

    async def stream(self, prompt: str) -> AsyncIterator[str]:
        def _sync_stream():
            model = self._make_model()
            return model.generate_content(prompt, stream=True)

        response = await asyncio.to_thread(_sync_stream)
        # Gemini sync streaming — iterate in a thread-safe way
        for chunk in response:
            if chunk.text:
                yield chunk.text
