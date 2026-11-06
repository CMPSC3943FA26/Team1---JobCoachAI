import json
from unittest.mock import patch

import pytest

from backend.AI import AI_pipeline


def test_groq_provider_uses_groq_endpoint_and_schema():
    with (
        patch.object(AI_pipeline.requests, "post") as post,
        patch.object(AI_pipeline, "AI_PROVIDER", "groq"),
        patch.object(AI_pipeline, "GROQ_API_KEY", "test-groq-key"),
    ):
        post.return_value.ok = True
        post.return_value.status_code = 200
        post.return_value.json.return_value = {}
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
    assert payload["model"] == "qwen/qwen3.8-27b"
    assert payload["max_completion_tokens"] == 12000
    assert payload["response_format"]["json_schema"] == {
        "name": "test_schema",
        "strict": True,
        "schema": {"type": "object"},
    }


def test_openrouter_remains_default_provider():
    with (
        patch.object(AI_pipeline.requests, "post") as post,
        patch.object(AI_pipeline, "AI_PROVIDER", "openrouter"),
        patch.object(AI_pipeline, "OPENROUTER_API_KEY", "test-openrouter-key"),
    ):
        post.return_value.ok = True
        post.return_value.status_code = 200
        post.return_value.json.return_value = {}
        AI_pipeline.request_ai(
            "test prompt", "test_schema", {"type": "object"}
        )

    _, kwargs = post.call_args
    assert kwargs["url"] == "https://openrouter.ai/api/v1/chat/completions"
    assert kwargs["headers"]["Authorization"] == "Bearer test-openrouter-key"
    payload = json.loads(kwargs["data"])
    assert payload["model"] == "nvidia/nemotron-3-ultra-550b-a55b:free"
    assert "response_format" not in payload


def test_cerebras_uses_eight_thousand_token_cap_and_reasoning_effort():
    with (
        patch.object(AI_pipeline.requests, "post") as post,
        patch.object(AI_pipeline, "AI_PROVIDER", "cerebras"),
        patch.object(AI_pipeline, "CEREBRAS_API_KEY", "test-cerebras-key"),
    ):
        post.return_value.ok = True
        post.return_value.status_code = 200
        post.return_value.json.return_value = {}
        AI_pipeline.request_ai(
            "test prompt",
            "test_schema",
            {"type": "object"},
            reasoning_effort="none",
        )

    _, kwargs = post.call_args
    assert kwargs["url"] == "https://api.cerebras.ai/v1/chat/completions"
    payload = json.loads(kwargs["data"])
    assert payload["model"] == "qwen-3.8-27b"
    assert payload["max_completion_tokens"] == 8000
    assert payload["reasoning_effort"] == "none"
    assert "reasoning_budget" not in payload


def test_provider_response_capture_writes_complete_response_to_configured_folder(tmp_path):
    provider_response = {
        "choices": [{
            "message": {
                "content": '{"suggestions":[{"text":"complete response"}]}',
            },
        }],
        "usage": {"completion_tokens": 17},
    }
    with (
        patch.object(AI_pipeline.requests, "post") as post,
        patch.object(AI_pipeline, "AI_PROVIDER", "cerebras"),
        patch.object(AI_pipeline, "CEREBRAS_API_KEY", "test-cerebras-key"),
        patch.dict("os.environ", {
            "AI_CAPTURE_RESPONSES": "1",
            "AI_RESPONSE_CAPTURE_DIR": str(tmp_path),
        }),
    ):
        post.return_value.ok = True
        post.return_value.status_code = 200
        post.return_value.json.return_value = provider_response
        AI_pipeline.request_ai(
            "test prompt",
            "test_schema",
            {"type": "object"},
            request_id="capture-request",
            stage="resume_suggestions",
        )

    captures = list(tmp_path.glob("*_resume_suggestions.json"))
    assert len(captures) == 1
    capture = json.loads(captures[0].read_text(encoding="utf-8"))
    assert capture["request_id"] == "capture-request"
    assert capture["provider"] == "cerebras"
    assert capture["stage"] == "resume_suggestions"
    assert capture["status"] == 200
    assert capture["response"] == provider_response


def test_groq_provider_requires_api_key():
    with (
        patch.object(AI_pipeline, "AI_PROVIDER", "groq"),
        patch.object(AI_pipeline, "GROQ_API_KEY", None),
        patch.object(AI_pipeline.requests, "post") as post,
    ):
        with pytest.raises(RuntimeError, match="groq_api_key is not configured"):
            AI_pipeline.request_ai(
                "test prompt", "test_schema", {"type": "object"}
            )

    post.assert_not_called()


def test_unknown_ai_provider_is_rejected():
    with patch.object(AI_pipeline, "AI_PROVIDER", "unknown"):
        with pytest.raises(ValueError, match="Unsupported AI_PROVIDER"):
            AI_pipeline.request_ai(
                "test prompt", "test_schema", {"type": "object"}
            )
