"""Maps a Role's CallScript configuration onto a dedicated Hunar Agent.

Hunar has no per-call prompt override — the agent_prompt/introduction/result_schema
live on the Agent (POST/PUT /agents/), not on individual calls. So every Role gets
its own Agent, created on first save and updated in place afterwards.
"""
import re
from typing import Any, Optional

from .. import models
from .hunar_client import HunarClient

TONE_INSTRUCTIONS = {
    "PROFESSIONAL": (
        "Tone: Professional. Be formal, structured, and direct. Do not small talk. "
        "Get to the point quickly."
    ),
    "CONVERSATIONAL": (
        "Tone: Conversational. Be warm but efficient. Acknowledge answers before moving on. "
        "Sound like a real recruiter having a natural conversation."
    ),
    "CASUAL": (
        "Tone: Casual. Be relaxed and friendly, use contractions, keep energy light. "
        "Best suited for informal/startup-style outreach."
    ),
}

PACE_INSTRUCTIONS = {
    "STANDARD": "Allow 2-3 seconds of silence before prompting again.",
    "GIVE_SPACE": "Wait longer than usual before prompting - give the candidate time to think before answering.",
}

DEFAULT_QUESTIONS = [
    {"text": "What's your current notice period?", "type": "Open-ended", "required": True, "is_system": True, "key": "notice_period"},
    {"text": "What's your expected CTC?", "type": "Open-ended", "required": True, "is_system": True, "key": "expected_ctc"},
    {"text": "Are you open to relocating for this role, if needed?", "type": "Yes-No", "required": True, "is_system": True, "key": "open_to_relocation"},
    {"text": "Are you actively exploring new opportunities right now?", "type": "Yes-No", "required": True, "is_system": True, "key": "actively_exploring"},
]

DEFAULT_OBJECTION_HANDLERS = [
    {
        "trigger": "Candidate says they're not looking right now",
        "response": "Totally understand. Would you be open to just hearing a bit about the role? Sometimes the right opportunity changes that.",
    },
    {
        "trigger": "Candidate asks for more details about the company",
        "response": "Happy to share more after we go through a few quick questions. Does that work?",
    },
    {
        "trigger": "Candidate says they already have an offer",
        "response": "Congratulations - that's great. Would you still be open to a quick conversation? It's always worth exploring all options before you commit.",
    },
    {
        "trigger": "Candidate asks who is calling / is this a bot",
        "response": "I'm an AI recruiter - I handle initial screening calls for {company_name}. Everything we discuss goes directly to the hiring team. Happy to continue if that's okay with you.",
    },
]


def _slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")
    return slug[:40] or "answer"


def default_call_script_fields(role_title: str) -> dict[str, Any]:
    return {
        "ai_name": "Alex",
        "tone": "CONVERSATIONAL",
        "language": "ENGLISH",
        "pace": "STANDARD",
        "introduction": (
            "Hi {candidate_name}, this is {persona_name} calling from {company_name}. "
            f"I'm reaching out about a {role_title} opportunity we're currently hiring for. "
            "Is this a good time to chat for a few minutes?"
        ),
        "questions": DEFAULT_QUESTIONS,
        "objection_handlers": DEFAULT_OBJECTION_HANDLERS,
        "closing_interested": "Great - based on our conversation I'll be sharing your profile with the team. You should hear back within 2 business days. Thanks for your time, {candidate_name}.",
        "closing_not_interested": "No problem at all. Thanks for taking the time. If anything changes or another role comes up that's a better fit, we'll be in touch.",
        "closing_handoff": "I'd like to connect you with one of our recruiters directly for a follow-up. They'll reach out to you within the next few hours.",
        "additional_instructions": "",
    }


def build_result_schema(questions: list[dict[str, Any]]) -> dict[str, str]:
    schema: dict[str, str] = {"summary": "string", "interest_level": "string"}
    for q in questions or []:
        key = q.get("key") or _slugify(q.get("text", "answer"))
        q_type = (q.get("type") or "Open-ended").lower()
        schema[key] = "boolean" if "yes" in q_type else "number" if q_type == "numeric" else "string"
    return schema


ADAPTIVE_CONVERSATION_PROTOCOL = """CONVERSATION PRINCIPLES & ADAPTIVE INTELLIGENCE:
1. Dynamic Topic Pivoting (The agent knows when to break its script):
   - If the candidate volunteers unexpected high-value information (e.g. they mention leading a team, holding a competing offer from a top firm, building a critical architecture, or having non-standard salary/location constraints):
     * DO NOT ignore it or rigidly plow into the next pre-planned question.
     * Acknowledge the revelation naturally (e.g. "That's very interesting—how soon do you need to decide on that offer?" or "You mentioned leading a team, what was the team size?").
     * Ask 1 targeted follow-up to capture the context.
     * Then smoothly bridge back to the remaining interview objectives (e.g. "That makes sense. Coming back to the role requirements...").

2. Self-Healing & Conversational Recovery:
   - Confusion Recovery: If the candidate says "What do you mean?", "I don't understand", or gives an uncertain answer:
     * Never repeat the exact same sentence verbatim.
     * Rephrase simply using a concise, real-world 1-sentence example.
   - Glitch / Repeat Recovery: If the candidate says "Can you repeat that?", "You broke up", or "Pardon?":
     * Re-state only the core question in 5 to 8 words without repeating introductory conversational filler.
   - Correction Recovery: If the candidate corrects you ("That's not what I said", "Actually, I meant..."):
     * Gracefully validate the correction with humility (e.g. "Understood, my mistake—thank you for clarifying that").
     * Update your mental understanding and proceed without debating.
   - Deflection & Rush Handling: If the candidate sounds rushed, distracted, or in transit:
     * Acknowledge immediately: "I hear you're on the move. Let's cover just the single most critical point: [Key question], and we can follow up on the rest later."

3. Dealbreaker Fast-Exit:
   - Notice period, mandatory location/relocation, and work eligibility are foundational requirements.
   - If the candidate explicitly states a non-negotiable mismatch (e.g., a 90-day notice period when the role strictly requires immediate availability), do not force them through 15 more minutes of deep technical interrogation.
   - Politely and warmly wrap up the call using the appropriate closing.

4. Anti-Looping & Evasion Progression (Max 2 Attempts Rule):
   - Never ask for the exact same information or probe on the same question more than twice.
   - If the candidate deflects, gives vague philosophy, or avoids sharing specific details after 1 follow-up, DO NOT ask a third time.
   - Gracefully acknowledge (e.g. "Understood, we can keep that high-level for now") and immediately move on to the next question or wrap up.

5. Call Arc & Wrap-Up Execution:
   - Start Phase: Confirm availability warmly and set the call's purpose in under 30 words.
   - Spoken Word Budget: Keep all spoken replies punchy, natural, and under 40 words (1-2 sentences).
   - Closing Phase: When concluding or when instructed to wrap up, NEVER ask a new question or invite open-ended questions. Deliver the closing statement outlining next steps and bid a warm farewell.

6. Anti-Echo Rule (No Answer Parroting):
   - NEVER repeat or paraphrase the candidate's full answer back to them. This wastes the candidate's time and sounds robotic.
   - BAD: "Thanks for sharing that. Your current CTC is 6 lakhs and your expected CTC is 10 lakhs, that's helpful to know."
   - GOOD: "Got it." then immediately ask the next question.
   - The ONLY exception: if you need to confirm a single critical number (e.g. a specific notice period or compensation figure you may have misheard), confirm in 5 words or fewer — e.g. "15 days — perfect." or "10 lakhs noted." — then move on immediately.
   - Brief micro-acknowledgments before the next question are fine: "Got it.", "Perfect.", "Thanks.", "Noted." — these are at most 2 words."""

CROSS_ROUND_MEMORY_DIRECTIVE = """CANDIDATE CONTEXT & PREVIOUS ROUND MEMORY:
{candidate_memory}
Instructions for utilizing previous round memory:
- If verified facts from previous rounds are present above (such as confirmed notice period, compensation, or technical competencies), DO NOT re-ask those questions.
- Reference their journey naturally (e.g., "Building on your initial screening discussion...").
- Spend this conversation drilling into the unverified competencies and specific focus areas for this round."""


def assemble_agent_prompt(
    role: models.Role, script: models.CallScript, stage: Optional[models.RoleStage] = None
) -> str:
    stage_header = f" - {stage.name}" if stage else ""
    parts = [
        f"You are an AI recruiting assistant conducting an interview for the role: {role.title}{stage_header}.",
        TONE_INSTRUCTIONS.get(script.tone, TONE_INSTRUCTIONS["CONVERSATIONAL"]),
        PACE_INSTRUCTIONS.get(script.pace, PACE_INSTRUCTIONS["STANDARD"]),
    ]
    if stage and stage.description:
        parts.append(f"Stage objective and focus: {stage.description}")
    if role.ai_summary:
        parts.append(f"Ideal candidate profile: {role.ai_summary}")
    if role.must_have_skills:
        parts.append(f"Must-have skills to probe for: {', '.join(role.must_have_skills)}")
    if role.preferred_skills:
        parts.append(f"Preferred (nice-to-have) skills: {', '.join(role.preferred_skills)}")

    # Phase 2: Cross-Round Memory Slot
    parts.append(CROSS_ROUND_MEMORY_DIRECTIVE.strip())

    # Phase 1: Adaptive Conversation Protocol & Self-Healing
    parts.append(ADAPTIVE_CONVERSATION_PROTOCOL.strip())

    if script.questions:
        parts.append("Interview Objectives & Questions to Explore:")
        for i, q in enumerate(script.questions, 1):
            line = f"{i}. {q.get('text')}"
            if q.get("follow_up"):
                line += f" (If the answer is vague, follow up with: {q['follow_up']})"
            if q.get("ai_note"):
                line += f" [Evaluation guidance, do not say aloud: {q['ai_note']}]"
            if q.get("required"):
                line += " [Core milestone question]"
            parts.append(line)

    if script.objection_handlers:
        parts.append("Objection handling:")
        for h in script.objection_handlers:
            parts.append(f"- If {h.get('trigger')}: respond with \"{h.get('response')}\"")

    if script.closing_interested:
        parts.append(f"If the candidate is interested, close with: \"{script.closing_interested}\"")
    if script.closing_not_interested:
        parts.append(f"If the candidate is not interested, close with: \"{script.closing_not_interested}\"")
    if script.closing_handoff:
        parts.append(f"If a human handoff is needed, say: \"{script.closing_handoff}\"")

    if script.additional_instructions:
        parts.append(f"Additional instructions: {script.additional_instructions}")

    parts.append(
        "Always produce a structured result at the end capturing the interview answers and an overall summary."
    )
    return "\n\n".join(parts)


def build_result_prompt(role: models.Role, stage: Optional[models.RoleStage] = None) -> str:
    stage_info = f" [{stage.name}]" if stage else ""
    return (
        f"Extract structured screening data from this call for the '{role.title}' role{stage_info}: "
        "the candidate's answers to each asked question, their overall interest level "
        "(high/medium/low/not_interested), and a one-sentence summary of the conversation."
    )


async def sync_role_agent(
    role: models.Role, script: models.CallScript, stage: Optional[models.RoleStage] = None
) -> str:
    """Create or update the Hunar Agent backing this role/stage's call script. Returns the agent_id."""
    client = HunarClient()
    agent_prompt = assemble_agent_prompt(role, script, stage=stage)
    result_schema = build_result_schema(script.questions or [])

    stage_suffix = f" [{stage.name}]" if stage else ""
    agent_name = f"HireAId — {role.title}{stage_suffix}"[:64]
    objective = (
        stage.description
        if stage and stage.description
        else (role.ai_summary or f"Screen candidates for the {role.title} role.")
    )

    payload = {
        "name": agent_name,
        "language": script.language,
        "voice_persona": "NEHA",
        "persona_name": script.ai_name,
        "agent_prompt": agent_prompt,
        "objective": objective,
        "introduction": script.introduction or default_call_script_fields(role.title)["introduction"],
        "result_prompt": build_result_prompt(role, stage=stage),
        "result_schema": result_schema,
    }

    if script.hunar_agent_id:
        agent = await client.update_agent(script.hunar_agent_id, payload)
    else:
        agent = await client.create_agent(payload)
    return agent["id"]

