"""JD -> structured criteria extraction, and candidate ranking against those criteria."""
from typing import Any, Optional

from .llm_client import LLMError, chat_json

JD_ANALYSIS_SYSTEM_PROMPT = """You are a technical recruiting assistant. Given a job title, \
free-text job description, an optional comma-separated skills hint, and an optional location, \
extract structured hiring criteria.

Respond with ONLY a JSON object of this exact shape:
{
  "must_have_skills": ["..."],
  "preferred_skills": ["..."],
  "seniority": "Junior|Mid|Senior|Staff|Lead|Manager|Unknown",
  "min_years_experience": <integer or null>,
  "location_normalized": "<city, country or null>",
  "summary": "<one sentence description of the ideal candidate>"
}
Keep skill lists concise (max 8 items each), using canonical names (e.g. "AWS" not "amazon web services")."""


async def analyze_job_description(
    title: str, description: str, required_skills: Optional[str], location: Optional[str]
) -> dict[str, Any]:
    user_prompt = (
        f"Job title: {title}\n"
        f"Location hint: {location or 'not specified'}\n"
        f"Skills hint: {required_skills or 'not specified'}\n\n"
        f"Job description:\n{description}"
    )
    result = await chat_json(JD_ANALYSIS_SYSTEM_PROMPT, user_prompt)
    return {
        "must_have_skills": result.get("must_have_skills", []) or [],
        "preferred_skills": result.get("preferred_skills", []) or [],
        "seniority": result.get("seniority") or "Unknown",
        "min_years_experience": result.get("min_years_experience"),
        "location_normalized": result.get("location_normalized"),
        "summary": result.get("summary", ""),
    }


RANKING_SYSTEM_PROMPT = """You are a technical recruiting assistant scoring sourced candidates \
against a job's hiring criteria. For EACH candidate in the input list, produce a match score \
from 0-100 and short evidence, based only on the fields given (do not invent experience).

Respond with ONLY a JSON object of this exact shape:
{
  "results": [
    {
      "index": <candidate index from input, integer>,
      "match_score": <integer 0-100>,
      "strengths": ["short evidence bullet", "..."],
      "gaps": ["short evidence bullet", "..."],
      "summary": "<one sentence verdict>"
    }
  ]
}
Score conservatively: if a candidate's title/company/location data doesn't clearly show a \
skill or seniority match, treat it as a gap rather than assuming it. Order does not matter; \
include exactly one result per input candidate index."""


async def rank_candidates(
    job_criteria: dict[str, Any], candidates: list[dict[str, Any]]
) -> dict[int, dict[str, Any]]:
    """candidates: list of {index, full_name, job_title, company, location, raw_data-derived facts}."""
    if not candidates:
        return {}

    criteria_text = (
        f"Must-have skills: {', '.join(job_criteria.get('must_have_skills') or []) or 'none specified'}\n"
        f"Preferred skills: {', '.join(job_criteria.get('preferred_skills') or []) or 'none specified'}\n"
        f"Seniority: {job_criteria.get('seniority') or 'Unknown'}\n"
        f"Location: {job_criteria.get('location_normalized') or 'not specified'}\n"
        f"Ideal candidate summary: {job_criteria.get('summary') or 'n/a'}"
    )
    candidates_text = "\n".join(
        f"[{c['index']}] name={c.get('full_name')!r} title={c.get('job_title')!r} "
        f"company={c.get('company')!r} location={c.get('location')!r}"
        for c in candidates
    )
    user_prompt = f"Hiring criteria:\n{criteria_text}\n\nCandidates:\n{candidates_text}"

    try:
        result = await chat_json(RANKING_SYSTEM_PROMPT, user_prompt)
    except LLMError:
        return {}

    by_index: dict[int, dict[str, Any]] = {}
    for item in result.get("results", []):
        try:
            idx = int(item["index"])
        except (KeyError, TypeError, ValueError):
            continue
        by_index[idx] = {
            "match_score": max(0, min(100, int(item.get("match_score", 0)))),
            "strengths": item.get("strengths", []) or [],
            "gaps": item.get("gaps", []) or [],
            "summary": item.get("summary", ""),
        }
    return by_index


SCREENING_SYSTEM_PROMPT = """You are a technical recruiting evaluation assistant turning a completed AI screening call transcript into a thorough hiring scorecard.
You are provided the role's hiring criteria and the verbatim conversation transcript (plus any structured call data).
Evaluate the candidate accurately based on what they actually stated during the screening call. Extract verified facts (e.g. notice period in days, expected compensation in LPA or stated numbers, relocation willingness, tools, and technical experience).

Respond with ONLY a valid JSON object matching this schema:
{
  "interest_level": "high" | "medium" | "low" | "not_interested",
  "notice_period_days": <integer or null, e.g. 15 if candidate says 15 days or 30 if 1 month>,
  "expected_ctc_min": <integer or null, in LPA or role currency, e.g. 6 if candidate says 6 LPA>,
  "expected_ctc_max": <integer or null, e.g. 6 or 8>,
  "location_confirmed": "exact" | "open_to" | "mismatch" | "unknown",
  "open_to_relocation": <true | false | null>,
  "reason_for_switching": "<concise reason or null>",
  "concerns": ["concise concern bullet", "..."],
  "competing_offers": <true | false | null>,
  "skill_assessments": [{"skill": "...", "years": <int or null>, "depth": "surface" | "working" | "deep" | "unknown"}],
  "score_technical": <0-100 score based on must-have skills match>,
  "score_experience": <0-100 score based on seniority and background>,
  "score_location": <0-100 score based on location or relocation willingness>,
  "score_compensation": <0-100 score based on budget fit>,
  "score_availability": <0-100 score based on notice period, e.g. <=15 days = 95, 30 days = 80, >60 days = 50>,
  "score_overall": <0-100 weighted overall candidate fit>,
  "recommendation": "ADVANCE" | "HOLD" | "REJECT",
  "ai_summary": "<2-3 sentence recruiter evaluation summary of candidate's verified skills, experience, and role alignment>",
  "ai_concerns": "<1-2 sentence assessment of any gaps, seniority friction, or compensation considerations, or empty string if none>"
}
Guidelines:
- If the candidate explicitly answered questions in the transcript (such as notice period, expected CTC, relocation, experience with tools), extract those exact values.
- recommendation should be ADVANCE if score_overall >= 70, HOLD if 50-69, and REJECT if below 50.
- Ensure recommendation is strictly one of 'ADVANCE', 'HOLD', 'REJECT'."""


async def generate_screening(
    role_criteria: dict[str, Any],
    call_result: dict[str, Any],
    call_custom_data: Optional[dict[str, Any]] = None,
    transcript: Optional[str] = None,
    transcript_turns: Optional[list[dict[str, Any]]] = None,
) -> Optional[dict[str, Any]]:
    """Turn call transcript & structured data into a comprehensive screening scorecard via LLM."""
    criteria_text = (
        f"Role Title: {role_criteria.get('title') or 'Role'}\n"
        f"Must-have skills: {', '.join(role_criteria.get('must_have_skills') or []) or 'none specified'}\n"
        f"Preferred skills: {', '.join(role_criteria.get('preferred_skills') or []) or 'none specified'}\n"
        f"Seniority: {role_criteria.get('seniority') or 'Not specified'}\n"
        f"Location: {role_criteria.get('location_normalized') or 'Not specified'}\n"
        f"Ideal candidate summary: {role_criteria.get('summary') or role_criteria.get('ai_summary') or 'n/a'}"
    )

    # Ensure full verbatim transcript is included for accurate evaluation
    transcript_body = ""
    if transcript and transcript.strip():
        transcript_body = transcript.strip()
    elif transcript_turns:
        formatted_turns = [f"{t.get('speaker', 'Speaker')}: {t.get('text', '')}" for t in transcript_turns]
        transcript_body = "\n".join(formatted_turns)

    user_prompt = (
        f"Hiring criteria:\n{criteria_text}\n\n"
        f"Call custom data sent to agent: {call_custom_data or {}}\n"
        f"Structured call answers: {call_result or {}}\n\n"
        f"Full Call Transcript:\n{transcript_body if transcript_body.strip() else '[No transcript recorded for this call yet]'}"
    )
    try:
        result = await chat_json(SCREENING_SYSTEM_PROMPT, user_prompt)
    except LLMError:
        return None

    def _int_or_none(v):
        try:
            return int(v) if v is not None else None
        except (TypeError, ValueError):
            return None

    overall = _int_or_none(result.get("score_overall"))
    raw_rec = str(result.get("recommendation", "")).strip().upper()
    if raw_rec not in ("ADVANCE", "HOLD", "REJECT"):
        if overall is not None:
            raw_rec = "ADVANCE" if overall >= 70 else "HOLD" if overall >= 50 else "REJECT"
        else:
            raw_rec = "HOLD"

    return {
        "interest_level": result.get("interest_level") or "medium",
        "notice_period_days": _int_or_none(result.get("notice_period_days")),
        "expected_ctc_min": _int_or_none(result.get("expected_ctc_min")),
        "expected_ctc_max": _int_or_none(result.get("expected_ctc_max")),
        "location_confirmed": result.get("location_confirmed") or "unknown",
        "open_to_relocation": result.get("open_to_relocation"),
        "reason_for_switching": result.get("reason_for_switching"),
        "concerns": result.get("concerns", []) or [],
        "competing_offers": result.get("competing_offers"),
        "skill_assessments": result.get("skill_assessments", []) or [],
        "score_technical": _int_or_none(result.get("score_technical")),
        "score_experience": _int_or_none(result.get("score_experience")),
        "score_location": _int_or_none(result.get("score_location")),
        "score_compensation": _int_or_none(result.get("score_compensation")),
        "score_availability": _int_or_none(result.get("score_availability")),
        "score_overall": overall,
        "recommendation": raw_rec,
        "ai_summary": result.get("ai_summary", ""),
        "ai_concerns": result.get("ai_concerns", ""),
    }
