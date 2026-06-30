"""Tests for ai_gm/providers/factory.py"""
import pytest
from unittest.mock import patch, MagicMock

from app.ai_gm.providers.factory import get_provider, reset_provider


@pytest.fixture(autouse=True)
def clear_provider_cache():
    reset_provider()
    yield
    reset_provider()


class TestGetProvider:
    def test_gemini_provider_selected(self):
        with patch("app.config.settings") as mock_settings:
            mock_settings.ai_provider = "gemini"
            mock_settings.gemini_api_key = "fake-gemini-key"
            mock_settings.gemini_model = "gemini-1.5-flash"

            with patch("app.ai_gm.providers.gemini.genai"):
                from app.ai_gm.providers.gemini import GeminiProvider
                with patch("app.ai_gm.providers.factory._build_provider") as mock_build:
                    mock_build.return_value = MagicMock(spec=GeminiProvider)
                    provider = get_provider()
                    mock_build.assert_called_once()

    def test_returns_same_instance_on_second_call(self):
        mock_provider = MagicMock()
        with patch("app.ai_gm.providers.factory._build_provider", return_value=mock_provider):
            p1 = get_provider()
            p2 = get_provider()
        assert p1 is p2

    def test_reset_forces_rebuild(self):
        mock_provider_1 = MagicMock(name="provider1")
        mock_provider_2 = MagicMock(name="provider2")
        calls = [mock_provider_1, mock_provider_2]

        def side_effect():
            return calls.pop(0)

        with patch("app.ai_gm.providers.factory._build_provider", side_effect=side_effect):
            p1 = get_provider()
            reset_provider()
            p2 = get_provider()

        assert p1 is not p2

    def test_unknown_provider_raises(self):
        with patch("app.ai_gm.providers.factory._build_provider") as mock_build:
            mock_build.side_effect = ValueError("Unknown AI_PROVIDER='foobar'")
            with pytest.raises(ValueError, match="Unknown"):
                get_provider()

    def test_build_deepseek_preset(self):
        from app.config import Settings

        fake_settings = Settings(
            ai_provider="deepseek",
            openai_api_key="sk-deepseek-test",
        )
        with patch("app.ai_gm.providers.factory.settings", fake_settings):
            from app.ai_gm.providers.openai_compatible import OpenAICompatibleProvider
            with patch.object(OpenAICompatibleProvider, "__init__", return_value=None) as mock_init:
                from app.ai_gm.providers import factory as f
                provider = f._build_provider()
                mock_init.assert_called_once()
                call_kwargs = mock_init.call_args.kwargs
                assert "deepseek.com" in call_kwargs.get("base_url", "")
                assert call_kwargs.get("model") == "deepseek-chat"

    def test_build_openai_preset(self):
        from app.config import Settings

        fake_settings = Settings(
            ai_provider="openai",
            openai_api_key="sk-openai-test",
        )
        with patch("app.ai_gm.providers.factory.settings", fake_settings):
            from app.ai_gm.providers.openai_compatible import OpenAICompatibleProvider
            with patch.object(OpenAICompatibleProvider, "__init__", return_value=None) as mock_init:
                from app.ai_gm.providers import factory as f
                f._build_provider()
                call_kwargs = mock_init.call_args.kwargs
                assert "openai.com" in call_kwargs.get("base_url", "")

    def test_openai_compatible_requires_base_url(self):
        from app.config import Settings

        fake_settings = Settings(
            ai_provider="openai_compatible",
            openai_api_key="key",
            openai_base_url="",   # missing — should raise
            openai_model="some-model",
        )
        with patch("app.ai_gm.providers.factory.settings", fake_settings):
            from app.ai_gm.providers import factory as f
            with pytest.raises(ValueError, match="OPENAI_BASE_URL"):
                f._build_provider()

    def test_build_ollama_no_key_required(self):
        from app.config import Settings

        fake_settings = Settings(
            ai_provider="ollama",
            openai_api_key="",   # Ollama doesn't need a key
            openai_model="",
        )
        with patch("app.ai_gm.providers.factory.settings", fake_settings):
            from app.ai_gm.providers.openai_compatible import OpenAICompatibleProvider
            with patch.object(OpenAICompatibleProvider, "__init__", return_value=None) as mock_init:
                from app.ai_gm.providers import factory as f
                f._build_provider()
                call_kwargs = mock_init.call_args.kwargs
                assert "localhost" in call_kwargs.get("base_url", "")
