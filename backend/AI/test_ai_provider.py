import json
from unittest.mock import patch

import pytest

from backend.AI import AI_pipeline


def test_groq_provider_uses_groq_endpoint_and_schema():
    with (
        patch.object(AI_pipeline.requests, "post") as post,
        patch.dict("os.environ", {"AI_PROVIDER": "groq"}),
        patch.object(AI_pipeline, "GROQ_API_KEY", "test-groq-key"),
    ):
        post.return_value.ok = True
        post.return_value.status_code = 200
        result = AI_pipeline.request_ai(
            "test prompt",
            "test_schema",
            {"type": "object"},
            request_id="request-1",
            stage="test",
        )

    assert result is post.return_value
    _, kwargs = post.call_args
    assert kwargs["url"] == "https://api.groq.com/openai/v1/chat/completions"
    assert kwargs["headers"]["Authorization"] == "Bearer test-groq-key"
    payload = json.loads(kwargs["data"])
    assert payload["model"] == "openai/gpt-oss-20b"
    assert payload["max_completion_tokens"] == 12000
    assert payload["response_format"]["json_schema"] == {
        "name": "test_schema",
        "strict": True,
        "schema": {"type": "object"},
    }


def test_openrouter_remains_default_provider():
    with (
        patch.object(AI_pipeline.requests, "post") as post,
        patch.dict("os.environ", {}, clear=True),
        patch.object(AI_pipeline, "OPENROUTER_API_KEY", "test-openrouter-key"),
    ):
        post.return_value.ok = True
        post.return_value.status_code = 200
        AI_pipeline.request_ai(
            "test prompt", "test_schema", {"type": "object"}
        )

    _, kwargs = post.call_args
    assert kwargs["url"] == "https://openrouter.ai/api/v1/chat/completions"
    assert kwargs["headers"]["Authorization"] == "Bearer test-openrouter-key"
    payload = json.loads(kwargs["data"])
    assert payload["model"] == "nvidia/nemotron-3-ultra-550b-a55b:free"
    assert "response_format" not in payload


def test_groq_provider_requires_api_key():
    with (
        patch.dict("os.environ", {"AI_PROVIDER": "groq"}),
        patch.object(AI_pipeline, "GROQ_API_KEY", None),
        patch.object(AI_pipeline.requests, "post") as post,
    ):
        with pytest.raises(RuntimeError, match="groq_api_key is not configured"):
            AI_pipeline.request_ai(
                "test prompt", "test_schema", {"type": "object"}
            )

    post.assert_not_called()


def test_unknown_ai_provider_is_rejected():
    with patch.dict("os.environ", {"AI_PROVIDER": "unknown"}):
        with pytest.raises(ValueError, match="Unsupported AI_PROVIDER"):
            AI_pipeline.request_ai(
                "test prompt", "test_schema", {"type": "object"}
            )
