"""
Provider factory. Reads AI_PROVIDER from settings and instantiates the right class.

Supported AI_PROVIDER values:
  gemini              — Google Gemini (default)
  openai              — OpenAI
  deepseek            — DeepSeek (OpenAI-compatible, api.deepseek.com)
  groq                — Groq (OpenAI-compatible, api.groq.com)
  openrouter          — OpenRouter (OpenAI-compatible, openrouter.ai)
  ollama              — Ollama local server (no auth required)
  openai_compatible   — Generic: reads OPENAI_BASE_URL + OPENAI_API_KEY + OPENAI_MODEL

Singleton: the provider is built once per process and cached.
Call reset_provider() in tests to get a fresh instance.
"""
from __future__ import annotations

import logging
from typing import Optional

from app.ai_gm.providers.base import AIProvider
from app.config import settings

logger = logging.getLogger(__name__)

_provider_instance: Optional[AIProvider] = None

# Known presets: (base_url, default_model, supports_json_mode)
_PRESETS: dict[str, tuple[str, str, bool]] = {
    "openai":     ("https://api.openai.com/v1",        "gpt-4o-mini",           True),
    "deepseek":   ("https://api.deepseek.com",          "deepseek-chat",         True),
    "groq":       ("https://api.groq.com/openai/v1",   "llama3-8b-8192",        False),
    "openrouter": ("https://openrouter.ai/api/v1",     "openai/gpt-4o-mini",    False),
    "ollama":     ("http://localhost:11434/v1",         "llama3",                False),
}


def get_provider() -> AIProvider:
    global _provider_instance
    if _provider_instance is None:
        _provider_instance = _build_provider()
    return _provider_instance


def reset_provider() -> None:
    """Force re-creation on next get_provider() call. Use in tests."""
    global _provider_instance
    _provider_instance = None


def _build_provider() -> AIProvider:
    provider_name = settings.ai_provider.lower().strip()
    logger.info("Building AI provider: %s", provider_name)

    if provider_name == "gemini":
        from app.ai_gm.providers.gemini import GeminiProvider
        return GeminiProvider(
            api_key=settings.gemini_api_key,
            model=settings.gemini_model,
        )

    if provider_name in _PRESETS or provider_name == "openai_compatible":
        from app.ai_gm.providers.openai_compatible import OpenAICompatibleProvider

        if provider_name in _PRESETS:
            preset_url, preset_model, preset_json = _PRESETS[provider_name]
            base_url = settings.openai_base_url or preset_url
            model = settings.openai_model or preset_model
            supports_json = preset_json
            api_key = settings.openai_api_key or "no-key-required"
        else:
            # openai_compatible — fully manual config
            base_url = settings.openai_base_url
            model = settings.openai_model
            supports_json = settings.openai_json_mode
            api_key = settings.openai_api_key
            if not base_url:
                raise ValueError(
                    "AI_PROVIDER=openai_compatible requires OPENAI_BASE_URL to be set"
                )

        return OpenAICompatibleProvider(
            api_key=api_key,
            model=model,
            base_url=base_url,
            supports_json_mode=supports_json,
        )

    raise ValueError(
        f"Unknown AI_PROVIDER='{provider_name}'. "
        f"Supported: gemini, openai, deepseek, groq, openrouter, ollama, openai_compatible"
    )
