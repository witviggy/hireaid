import logging
from typing import Any, Optional

import httpx

from ..config import get_settings
from .llm_client import LLMError, chat_json

logger = logging.getLogger("transcription")
settings = get_settings()

SPEAKER_DIARIZATION_SYSTEM_PROMPT = """You are an expert dialogue parser for phone screening interviews.
Given a raw verbatim audio transcript between an AI voice recruiter (who introduced themselves and asked screening questions) and a job candidate (who answered questions), format the conversation into chronological dialogue turns.

Respond with ONLY a JSON object of this exact shape:
{
  "turns": [
    {
      "speaker": "AI",
      "text": "Exact or cleaned-up text spoken by the AI recruiter"
    },
    {
      "speaker": "Candidate",
      "text": "Exact or cleaned-up text spoken by the candidate"
    }
  ]
}
Rules:
- "speaker" MUST be either "AI" or "Candidate".
- Do not omit questions or answers. Keep the chronological flow intact.
- If unsure who spoke, use conversation context: questions about notice period, CTC, experience, and role introduction are by "AI"; answers giving details are by "Candidate"."""


async def transcribe_call_audio(
    recording_url: str,
    persona_name: str = "Alex",
    callee_name: str = "Candidate",
) -> dict[str, Any]:
    """Transcribes an audio file via Groq Whisper and formats it into structured dialogue turns."""
    if not settings.groq_api_key:
        logger.warning("GROQ_API_KEY is not configured; cannot transcribe audio.")
        return {"transcript": "", "transcript_turns": []}

    try:
        # 1. Download audio bytes
        async with httpx.AsyncClient(timeout=45) as client:
            resp = await client.get(recording_url)
            if resp.status_code != 200:
                logger.error("Failed to download recording from %s (status %d)", recording_url, resp.status_code)
                return {"transcript": "", "transcript_turns": []}
            audio_bytes = resp.content

        # 2. Call Groq Whisper API
        files = {"file": ("recording.wav", audio_bytes, "audio/wav")}
        data = {"model": "whisper-large-v3-turbo"}
        headers = {"Authorization": f"Bearer {settings.groq_api_key}"}

        async with httpx.AsyncClient(timeout=60) as client:
            whisper_resp = await client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers=headers,
                files=files,
                data=data,
            )

        if whisper_resp.status_code != 200:
            logger.error("Groq Whisper error %d: %s", whisper_resp.status_code, whisper_resp.text)
            return {"transcript": "", "transcript_turns": []}

        raw_transcript = whisper_resp.json().get("text", "").strip()
        if not raw_transcript:
            return {"transcript": "", "transcript_turns": []}

        # 3. Format into structured turns using Groq LLM
        user_prompt = (
            f"AI Recruiter Name: {persona_name}\n"
            f"Candidate Name: {callee_name}\n\n"
            f"Raw Transcript:\n{raw_transcript}"
        )
        try:
            diarized = await chat_json(SPEAKER_DIARIZATION_SYSTEM_PROMPT, user_prompt)
            turns = diarized.get("turns", []) or []
        except LLMError as err:
            logger.warning("LLM diarization failed: %s; falling back to raw text", err)
            turns = [{"speaker": "Transcript", "text": raw_transcript}]

        return {
            "transcript": raw_transcript,
            "transcript_turns": turns,
        }

    except Exception as exc:
        logger.exception("Error while transcribing audio from %s: %s", recording_url, exc)
        return {"transcript": "", "transcript_turns": []}

