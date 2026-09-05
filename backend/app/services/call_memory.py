"""Candidate Conversation Memory Graph Service (Phase 2).

Aggregates verified facts, competencies, and interviewer notes across
sequential interview rounds into a persistent candidate memory graph.
Produces a dynamic briefing block for Hunar voice agent context injection.
"""
from typing import Any, Optional
from .. import models


def _get_field(obj: Any, key: str, default: Any = None) -> Any:
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def build_candidate_memory_graph(rc: models.RoleCandidate) -> dict[str, Any]:
    """Compile all historical call screenings and facts for this candidate on this role."""
    if not rc or not rc.calls:
        return {
            "candidate_id": rc.candidate_id if rc else "",
            "candidate_name": rc.candidate.full_name if rc and rc.candidate else "",
            "role_id": rc.role_id if rc else "",
            "role_title": rc.role.title if rc and rc.role else "",
            "total_rounds_completed": 0,
            "verified_facts": {},
            "skills_matrix": [],
            "rounds_history": [],
            "briefing_text": "First interview round. No prior call history. Collect all baseline criteria.",
        }

    all_calls = list(rc.calls or [])

    # Filter completed calls with screening data, sorted by creation date
    completed_calls = [
        c for c in all_calls
        if c.status == models.CallStatus.COMPLETED and c.screening
    ]
    completed_calls.sort(key=lambda c: c.created_at or "")

    verified_facts: dict[str, Any] = {}
    skills_by_name: dict[str, dict[str, Any]] = {}
    rounds_history: list[dict[str, Any]] = []

    for call in completed_calls:
        sc = call.screening
        stage_name = call.stage.name if call.stage else f"Round {call.attempt_number}"
        round_num = call.stage.round_number if call.stage else 1

        # Extract/overwrite verified facts with latest confirmed data
        np_days = _get_field(sc, "notice_period_days")
        if np_days is not None:
            verified_facts["notice_period_days"] = np_days

        ctc_min = _get_field(sc, "expected_ctc_min")
        ctc_max = _get_field(sc, "expected_ctc_max")
        if ctc_min is not None or ctc_max is not None:
            verified_facts["expected_ctc_min"] = ctc_min
            verified_facts["expected_ctc_max"] = ctc_max

        reloc = _get_field(sc, "open_to_relocation")
        if reloc is not None:
            verified_facts["open_to_relocation"] = reloc

        loc_conf = _get_field(sc, "location_confirmed")
        if loc_conf:
            verified_facts["location_confirmed"] = loc_conf

        switch_reason = _get_field(sc, "reason_for_switching")
        if switch_reason:
            verified_facts["reason_for_switching"] = switch_reason

        comp_offers = _get_field(sc, "competing_offers")
        if comp_offers is not None:
            verified_facts["competing_offers"] = comp_offers

        # Aggregate skill assessments
        skill_assessments = _get_field(sc, "skill_assessments") or []
        for sa in skill_assessments:
            name = _get_field(sa, "skill", "")
            if not name or not isinstance(name, str):
                continue
            name = name.strip()
            if not name:
                continue
            name_key = name.lower()
            years = _get_field(sa, "years")
            depth = _get_field(sa, "depth") or "unknown"
            if name_key not in skills_by_name:
                skills_by_name[name_key] = {
                    "skill": name,
                    "years": years,
                    "depth": depth,
                    "verified_in_round": round_num,
                }
            else:
                # Update with higher depth or years if discovered
                existing = skills_by_name[name_key]
                if years and (not existing.get("years") or years > existing["years"]):
                    existing["years"] = years
                if depth in ("deep", "working"):
                    existing["depth"] = depth

        rec_val = _get_field(sc, "recommendation")
        rec_str = rec_val.value if hasattr(rec_val, "value") else str(rec_val) if rec_val else "HOLD"

        rounds_history.append({
            "call_id": call.id,
            "round_number": round_num,
            "stage_name": stage_name,
            "date": call.created_at.isoformat() if call.created_at else None,
            "duration_seconds": call.duration_seconds,
            "recommendation": rec_str,
            "score_overall": _get_field(sc, "score_overall"),
            "summary": _get_field(sc, "ai_summary") or "",
            "concerns": _get_field(sc, "concerns") or [],
            "ai_concerns": _get_field(sc, "ai_concerns") or "",
        })

    # Format human/LLM-readable briefing text for voice agent injection
    if completed_calls:
        briefing_lines = [
            f"Candidate: {rc.candidate.full_name}",
            f"Role Requisition: {rc.role.title}",
            f"Previous Interview Rounds Completed: {len(rounds_history)}",
        ]

        if verified_facts.get("notice_period_days") is not None:
            briefing_lines.append(f"- Confirmed Notice Period: {verified_facts['notice_period_days']} days (DO NOT ask for notice period again).")
        if verified_facts.get("expected_ctc_min") or verified_facts.get("expected_ctc_max"):
            ctc_str = f"₹{verified_facts.get('expected_ctc_min') or verified_facts.get('expected_ctc_max')} LPA"
            briefing_lines.append(f"- Confirmed Expected CTC: {ctc_str} (DO NOT ask for expected CTC again).")
        if verified_facts.get("open_to_relocation") is not None:
            reloc = "Open to relocate" if verified_facts["open_to_relocation"] else "Not open to relocate"
            briefing_lines.append(f"- Relocation: {reloc}.")
        if verified_facts.get("reason_for_switching"):
            briefing_lines.append(f"- Reason for switching: {verified_facts['reason_for_switching']}.")
        if verified_facts.get("competing_offers"):
            briefing_lines.append("- Candidate mentioned active competing offers.")

        if skills_by_name:
            skill_strs = [
                f"{s['skill']} ({s.get('years') or '?'} yrs, {s.get('depth', 'verified')})"
                for s in skills_by_name.values()
            ]
            briefing_lines.append(f"- Skills already verified in previous rounds: {', '.join(skill_strs)}.")

        # Latest round summary & watchpoints
        latest_round = rounds_history[-1]
        briefing_lines.append(
            f"- Last Round ({latest_round['stage_name']}) Result: {latest_round['recommendation']} "
            f"({latest_round.get('score_overall') or '—'}/100). Summary: {latest_round['summary']}"
        )
        if latest_round.get("ai_concerns"):
            briefing_lines.append(f"- Key focus areas / watchpoints to probe in this round: {latest_round['ai_concerns']}")

        briefing_text = "\n".join(briefing_lines)
    else:
        briefing_text = "Initial screening round. No prior conversation history. Collect baseline criteria."

    return {
        "candidate_id": rc.candidate_id,
        "candidate_name": rc.candidate.full_name,
        "role_id": rc.role_id,
        "role_title": rc.role.title,
        "total_rounds_completed": len(rounds_history),
        "verified_facts": verified_facts,
        "skills_matrix": list(skills_by_name.values()),
        "rounds_history": rounds_history,
        "briefing_text": briefing_text,
    }
