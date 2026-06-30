"""
Abstract interface for AI providers. Any new provider must implement AIProvider.

generate()       — one-shot call, returns full response text
stream()         — async generator that yields text chunks as they arrive

Both methods receive the full assembled prompt string.
The caller (gm_service) is responsible for JSON parsing and validation.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import AsyncIterator


class AIProvider(ABC):

    @abstractmethod
    async def generate(self, prompt: str) -> str:
        """Return the full AI response as a string."""
        ...

    @abstractmethod
    async def stream(self, prompt: str) -> AsyncIterator[str]:
        """Yield response chunks as they arrive."""
        ...

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable provider name, used in logs."""
        ...
