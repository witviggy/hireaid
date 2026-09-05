"""Thin client for JD-criteria extraction and candidate ranking via Groq's
OpenAI-compatible chat completions API."""
import asyncio
import json
import re
from typing import Any, Optional

import httpx

from ..config import get_settings

settings = get_settings()


class LLMError(RuntimeError):
    pass


def _extract_json(text: str) -> Any:
    """Best-effort JSON extraction in case the model wraps output in prose/markdown."""
    text = text.strip()

    # Strip reasoning tags that reasoning models may emit even in JSON mode
    if "<think>" in text and "</think>" in text:
        text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()

    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    start = min((i for i in (text.find("{"), text.find("[")) if i != -1), default=-1)
    end = max(text.rfind("}"), text.rfind("]"))
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError as exc:
            raise LLMError(f"Could not parse JSON from LLM response: {text[:300]}") from exc
    raise LLMError(f"Could not parse JSON from LLM response: {text[:300]}")


async def _post_groq(payload: dict[str, Any]) -> dict[str, Any]:
    """Helper to send request to Groq with rate-limit backoff and valid fallback models."""
    primary_model = payload.get("model") or settings.groq_model
    # Models available on this Groq account in priority order (120B parameter flagship first)
    candidate_models = [primary_model, "openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"]
    seen: set = set()
    models_chain = [m for m in candidate_models if m and not (m in seen or seen.add(m))]

    last_resp = None
    for model_name in models_chain:
        payload["model"] = model_name
        for attempt in range(3):
            # Explicit connect + read timeouts so DNS/connection failures don't hang indefinitely
            timeout = httpx.Timeout(connect=10.0, read=60.0, write=10.0, pool=5.0)
            async with httpx.AsyncClient(timeout=timeout) as client:
                try:
                    resp = await client.post(
                        f"{settings.groq_api_base_url}/chat/completions",
                        headers={
                            "Authorization": f"Bearer {settings.groq_api_key}",
                            "Content-Type": "application/json",
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                        },
                        json=payload,
                    )
                except httpx.TimeoutException as exc:
                    if attempt == 2:
                        raise LLMError(f"Groq API timed out for model {model_name}") from exc
                    await asyncio.sleep(2 ** (attempt + 1))
                    continue
            last_resp = resp
            if resp.status_code == 200:
                return resp.json()
            if resp.status_code == 429:
                # Exponential backoff: 2s, 4s, 8s
                await asyncio.sleep(2 ** (attempt + 1))
                continue
            # For 404/400 model errors, immediately try next model in chain
            break

    if last_resp is not None and last_resp.status_code >= 400:
        raise LLMError(f"Groq API error {last_resp.status_code}: {last_resp.text}")

    raise LLMError("Groq API request failed without response")


async def chat_json(system_prompt: str, user_prompt: str, max_tokens: int = 8192) -> Any:
    if not settings.groq_api_key:
        raise LLMError("GROQ_API_KEY is not configured")

    payload = {
        "model": settings.groq_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.1,
        "max_tokens": max_tokens,
        "response_format": {"type": "json_object"},
    }
    data = await _post_groq(payload)
    content = data["choices"][0]["message"]["content"]
    return _extract_json(content)


async def chat_messages(messages: list[dict[str, str]], temperature: float = 0.3, max_tokens: int = 1024) -> str:
    """Multi-turn text generation via Groq chat completions."""
    if not settings.groq_api_key:
        raise LLMError("GROQ_API_KEY is not configured")

    payload = {
        "model": settings.groq_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    data = await _post_groq(payload)
    choice = data.get("choices", [{}])[0]
    msg = choice.get("message", {})
    content = msg.get("content") or ""
    content = content.strip()

    # Clean any internal reasoning tags if emitted
    if "<think>" in content and "</think>" in content:
        import re
        content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()

    # Fallback if reasoning consumed token budget without generating final content
    if not content and msg.get("reasoning"):
        content = "Understood. Thank you for sharing that with me."

    return content


async def chat_json_messages(messages: list[dict[str, str]], temperature: float = 0.1, max_tokens: int = 2048) -> Any:
    """Multi-turn JSON response via Groq chat completions."""
    if not settings.groq_api_key:
        raise LLMError("GROQ_API_KEY is not configured")

    payload = {
        "model": settings.groq_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "response_format": {"type": "json_object"},
    }
    data = await _post_groq(payload)
    choice = data.get("choices", [{}])[0]
    msg = choice.get("message", {})
    content = msg.get("content") or "{}"

    # Strip reasoning tags that reasoning models may emit even in JSON mode
    if "<think>" in content and "</think>" in content:
        content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
    if not content:
        content = "{}"

    return _extract_json(content)




