"""Tests for OpenAICompatibleProvider."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


class TestOpenAICompatibleProvider:
    def _make_provider(self, **kwargs):
        from app.ai_gm.providers.openai_compatible import OpenAICompatibleProvider
        defaults = dict(
            api_key="sk-test",
            model="deepseek-chat",
            base_url="https://api.deepseek.com",
        )
        defaults.update(kwargs)
        with patch("app.ai_gm.providers.openai_compatible.AsyncOpenAI"):
            return OpenAICompatibleProvider(**defaults)

    def test_name_contains_host_and_model(self):
        provider = self._make_provider()
        assert "deepseek" in provider.name
        assert "deepseek-chat" in provider.name

    def test_raises_on_empty_api_key(self):
        from app.ai_gm.providers.openai_compatible import OpenAICompatibleProvider
        with patch("app.ai_gm.providers.openai_compatible.AsyncOpenAI"):
            with pytest.raises(ValueError, match="API key"):
                OpenAICompatibleProvider(api_key="", model="gpt-4", base_url="https://x.com")

    @pytest.mark.asyncio
    async def test_generate_returns_text(self):
        from app.ai_gm.providers.openai_compatible import OpenAICompatibleProvider

        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = '{"narrative": "test"}'
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

        with patch("app.ai_gm.providers.openai_compatible.AsyncOpenAI", return_value=mock_client):
            provider = OpenAICompatibleProvider(
                api_key="sk-test",
                model="deepseek-chat",
                base_url="https://api.deepseek.com",
            )

        result = await provider.generate("test prompt")
        assert result == '{"narrative": "test"}'

    @pytest.mark.asyncio
    async def test_generate_without_json_mode(self):
        from app.ai_gm.providers.openai_compatible import OpenAICompatibleProvider

        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "response text"
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

        with patch("app.ai_gm.providers.openai_compatible.AsyncOpenAI", return_value=mock_client):
            provider = OpenAICompatibleProvider(
                api_key="sk-test",
                model="llama3",
                base_url="http://localhost:11434/v1",
                supports_json_mode=False,
            )

        await provider.generate("prompt")
        call_kwargs = mock_client.chat.completions.create.call_args.kwargs
        assert "response_format" not in call_kwargs
