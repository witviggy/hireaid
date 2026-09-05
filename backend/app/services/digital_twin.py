"""Digital Twin Simulation & Stress-Testing Service (Phase 3).

Simulates multi-turn voice interviews between configured AI Agent roles
and realistic synthetic candidate personas (e.g. evasive candidates,
salary pushers, rambling architects, distracted drivers). Evaluates
agent resilience and generates actionable prompt improvement recommendations.
"""
from typing import Any, Optional
from sqlalchemy.orm import Session

from .. import models
from .llm_client import LLMError, chat_json_messages, chat_messages
from .hunar_agent import assemble_agent_prompt

DEFAULT_PERSONAS = [
    {
        "name": "The Evasive Candidate (Mr. Deflector)",
        "description": "Dodges direct questions about notice period and compensation; answers with counter-questions to test agent tenacity.",
        "difficulty": "HARD",
        "system_prompt": """You are a candidate participating in a phone screening interview with an AI recruiter for the target role.
YOUR BEHAVIORAL CHARACTER & RULES:
- You are polite, professional, but intentionally evasive about notice period and compensation numbers.
- When asked about your current or expected compensation, do NOT give numbers on first try. Instead deflect: "I'd really prefer to hear what the budget band for this position is first," or "It depends on the total compensation and benefits package."
- When asked about your notice period, deflect initially: "My notice period is pretty flexible depending on when the offer comes through."
- Only if the recruiter asks firmly a second time, reveal: Notice is 60 days, Expected compensation is at the higher end of the market band.
- Answer questions about your background and experience competently in 1-2 sentences, but remain protective of timeline and salary details.
- Keep responses natural, conversational, and concise (under 40 words per turn).""",
        "candidate_profile": {
            "notice_period": "60 days (reluctant to share)",
            "target_ctc": "Higher end of market band",
            "key_traits": ["polite", "deflective", "protective of numbers"],
            "objections": ["Prefers recruiter to state budget band first", "Claims notice period is 'flexible'"],
        },
        "is_builtin": True,
    },
    {
        "name": "The Aggressive Salary Maximizer",
        "description": "Demands top-of-market compensation immediately, asks about bonuses and perks, and rejects below-budget numbers.",
        "difficulty": "MEDIUM",
        "system_prompt": """You are a candidate receiving an initial phone screening call for the target role.
YOUR BEHAVIORAL CHARACTER & RULES:
- You know your market worth and are solely motivated by high compensation and career leverage.
- Early in the call, ask: "Before we go further, what is the approved salary ceiling for this position?"
- If the recruiter mentions numbers below top-of-market or asks for your current salary, push back: "I am only considering opportunities at the top of the market band with strong fixed compensation."
- Notice period is 30 days.
- You answer background and experience questions with high confidence and slight condescension.
- Keep answers concise (under 40 words) as if on a fast, businesslike call.""",
        "candidate_profile": {
            "notice_period": "30 days",
            "target_ctc": "Top of market fixed",
            "key_traits": ["assertive", "compensation-focused", "confident"],
            "objections": ["Demands salary ceiling upfront", "Will not consider below-market offers"],
        },
        "is_builtin": True,
    },
    {
        "name": "The Verbose Rambler",
        "description": "Gives verbose, rambling monologues with excessive background detail that derails recruiter timekeeping and tests agent steering.",
        "difficulty": "HARD",
        "system_prompt": """You are a candidate participating in an initial screening call for the target role.
YOUR BEHAVIORAL CHARACTER & RULES:
- You love talking at length about your background, theories, and granular procedural details.
- When asked any question about your experience or skills, launch into a detailed, long-winded answer with excessive backstory, philosophical musings, and tangential anecdotes.
- Use 50-70 words per response, wandering slightly off-topic before wrapping back.
- If the recruiter politely interrupts or redirects you to the specific question, be gracious and cooperative: "Ah yes, apologies, back to your question..." If asked for specific numbers a second time, share: Notice period is 45 days; Expected compensation is aligned with the market average for this level.
- Never repeat the same phrases or sentences verbatim. Keep each response distinct.
- Notice period: 45 days. Expected compensation: well-aligned with market average.
- Keep your tone warm, intellectual, and slightly absent-minded.""",
        "candidate_profile": {
            "notice_period": "45 days",
            "target_ctc": "Market standard",
            "key_traits": ["verbose", "tangent-prone", "academic"],
            "objections": ["Tends to give lengthy answers to simple questions"],
        },
        "is_builtin": True,
    },
    {
        "name": "The Distracted Driver",
        "description": "Driving in traffic, background noise, asks who is calling, and tests agent self-healing & callback protocols.",
        "difficulty": "EXTREME",
        "system_prompt": """You are a candidate who answered your mobile phone while driving in heavy city traffic.
YOUR BEHAVIORAL CHARACTER & RULES:
- You are distracted, multitasking, and in a noisy environment.
- On turn 1, say: "Hello? Hey, who is this again? What company? I'm in traffic right now."
- On turn 2, ask the recruiter to speak up or repeat themselves: "Sorry, a truck honked, could you repeat that?"
- If the recruiter asks multiple heavy questions, say: "Listen, I'm driving right now. Can this be a 2-minute quick check or can you call me back later?"
- If the recruiter keeps it quick and simple, answer: 30 days notice, standard market compensation expected.
- Keep all turns under 25 words with a distracted, conversational, hurried cadence.""",
        "candidate_profile": {
            "notice_period": "30 days",
            "target_ctc": "Standard market",
            "key_traits": ["distracted", "traffic noise", "rushed"],
            "objections": ["Driving in traffic", "Didn't catch company name", "May request callback"],
        },
        "is_builtin": True,
    },
    {
        "name": "The High-Caliber Star Match",
        "description": "Articulate, cooperative, and concise baseline candidate. Serves as positive benchmark control.",
        "difficulty": "EASY",
        "system_prompt": """You are an ideal candidate interviewing for the target role.
YOUR BEHAVIORAL CHARACTER & RULES:
- You are enthusiastic, polite, and articulate.
- Notice period is exactly 15 days (buyout available).
- Expected compensation is well aligned with the role's market standard.
- Open to relocate or work hybrid/onsite if required.
- You give crisp, 2-sentence answers showcasing strong practical competency and cultural fit for the role.
- Keep answers under 35 words.""",
        "candidate_profile": {
            "notice_period": "15 days",
            "target_ctc": "Market standard",
            "key_traits": ["articulate", "cooperative", "available soon"],
            "objections": [],
        },
        "is_builtin": True,
    },
]


def seed_default_personas(db: Session) -> list[models.DigitalTwinPersona]:
    """Ensure standard built-in role-agnostic character personas exist and are kept up to date."""
    # Handle legacy name migrations from prior builds
    legacy_renames = {
        "The Rambling Senior Architect": "The Verbose Rambler",
        "The Distracted Driver with Noise": "The Distracted Driver",
    }
    for old_name, new_name in legacy_renames.items():
        legacy_p = db.query(models.DigitalTwinPersona).filter(
            models.DigitalTwinPersona.name == old_name
        ).first()
        if legacy_p:
            legacy_p.name = new_name

    seeded = False
    for p_data in DEFAULT_PERSONAS:
        existing = db.query(models.DigitalTwinPersona).filter(
            models.DigitalTwinPersona.name == p_data["name"]
        ).first()
        if not existing:
            p = models.DigitalTwinPersona(
                name=p_data["name"],
                description=p_data["description"],
                difficulty=p_data["difficulty"],
                system_prompt=p_data["system_prompt"],
                candidate_profile=p_data["candidate_profile"],
                is_builtin=True,
            )
            db.add(p)
            seeded = True
        elif existing.is_builtin:
            # Sync built-in definitions with role-agnostic character rules
            existing.description = p_data["description"]
            existing.difficulty = p_data["difficulty"]
            existing.system_prompt = p_data["system_prompt"]
            existing.candidate_profile = p_data["candidate_profile"]
            seeded = True

    if seeded:
        db.commit()
    return db.query(models.DigitalTwinPersona).order_by(
        models.DigitalTwinPersona.is_builtin.desc(),
        models.DigitalTwinPersona.created_at.asc()
    ).all()


async def generate_persona_from_prompt(user_prompt: str) -> dict[str, Any]:
    """Use Groq LLM to convert a recruiter's rough concept into a structured, role-agnostic persona."""
    meta_prompt = f"""You are an expert AI simulation designer for automated voice recruiters.
Convert the user's idea for a candidate persona into a stress-testing profile.

CRITICAL REQUIREMENT:
The persona MUST define behavioral character traits, objections, speech quirks, and personality, INDEPENDENT of any specific job role or technical domain, so that the persona can be applied to test ANY role (engineering, marketing, sales, design, nursing, etc.).

User Idea: "{user_prompt}"

Return ONLY a JSON object with this exact shape:
{{
  "name": "Catchy Character Name (e.g. The Overconfident Junior, The Sarcastic Skeptic, The Fast-Talking Hustler)",
  "description": "1-2 sentence description of why this character archetype tests agent resilience",
  "difficulty": "EASY|MEDIUM|HARD|EXTREME",
  "system_prompt": "Detailed persona character instructions for an LLM acting as this candidate in a phone call for the target role. Include speech quirks, conversational rules, response length limits (<40 words), and pushback strategies. Do NOT hardcode a specific job title.",
  "candidate_profile": {{
    "notice_period": "Stated or unstated notice period",
    "target_ctc": "Expected compensation attitude",
    "key_traits": ["trait 1", "trait 2", "trait 3"],
    "objections": ["Objection or pushback point 1", "Objection 2"]
  }}
}}"""

    messages = [
        {"role": "system", "content": "You are a specialized simulation persona architect. Always reply in valid JSON."},
        {"role": "user", "content": meta_prompt},
    ]
    return await chat_json_messages(messages, temperature=0.2)


async def simulate_digital_twin_dialogue(
    role: models.Role,
    stage: Optional[models.RoleStage],
    script: models.CallScript,
    global_settings: Optional[models.GlobalSettings],
    persona: models.DigitalTwinPersona,
    max_turns: int = 6,
) -> list[dict[str, str]]:
    """Execute a simulated multi-turn phone interview between Agent Prompt and Candidate Persona."""
    agent_system_prompt = assemble_agent_prompt(
        role=role,
        script=script,
        stage=stage,
    ).replace("{candidate_memory}", "Digital Twin Simulation Benchmark - First Round Baseline.")

    # Dynamically contextualize the role-agnostic character persona with the specific role being tested
    role_context = f"TARGET ROLE CONTEXT:\nYou are participating as a candidate interviewing for the position of '{role.title}'."
    role_overview = getattr(role, "description", None) or getattr(role, "ai_summary", None) or getattr(role, "jd_raw_text", "")
    if role_overview:
        role_context += f"\nRole Overview: {role_overview[:250]}."
    
    candidate_rules = (
        "\n\nGENERAL CONVERSATION RULES:\n"
        "- Never repeat prior responses or stock sentences verbatim; vary your phrasing naturally.\n"
        "- When the interviewer wraps up the call or says goodbye, do NOT introduce new topics or ask questions; "
        "provide a brief, courteous parting remark wishing them well (under 12 words)."
    )
    candidate_system_prompt = f"{role_context}\n\n{persona.system_prompt}{candidate_rules}"

    dialogue: list[dict[str, str]] = []

    # Turn 1: Agent speaks first with greeting/intro
    intro = script.introduction or f"Hi! I'm {script.ai_name or 'Alex'} calling from HireAId regarding the {role.title} position. Do you have a couple of minutes to chat?"
    intro_rendered = (
        intro.replace("{candidate_name}", "Candidate")
        .replace("{persona_name}", script.ai_name or "Alex")
        .replace("{ai_name}", script.ai_name or "Alex")
        .replace("{role_title}", role.title)
        .replace("{company_name}", global_settings.company_name if global_settings else "HireAId")
    )

    dialogue.append({"speaker": "AGENT", "text": intro_rendered})

    closing_text = (
        script.closing_interested
        or f"Great - based on our conversation I'll be sharing your notes with our hiring team who will follow up on next steps within two business days. Thanks for your time and have a wonderful day!"
    )

    # Alternate turns
    for turn_idx in range(1, max_turns):
        is_final_round = (turn_idx == max_turns - 1)

        # 1. Candidate's turn to reply to Agent's last statement
        candidate_messages = [
            {"role": "system", "content": candidate_system_prompt},
        ]
        for t in dialogue:
            role_tag = "user" if t["speaker"] == "AGENT" else "assistant"
            candidate_messages.append({"role": role_tag, "content": t["text"]})

        candidate_reply = await chat_messages(candidate_messages, temperature=0.4, max_tokens=600)
        if not candidate_reply or not candidate_reply.strip():
            candidate_reply = "I understand. I think that clarifies what I needed to know, thank you."
        dialogue.append({"speaker": "CANDIDATE", "text": candidate_reply})

        # Only trigger candidate early termination on explicit hang-up / disconnecting
        lower_clean = lower_reply.strip()
        is_explicit_hangup = (
            lower_clean.startswith(("bye", "goodbye", "i have to hang up"))
            or "hanging up now" in lower_clean
            or "please stop calling" in lower_clean
        )
        if is_explicit_hangup and turn_idx >= 2:
            # Recruiter delivers quick polite exit
            agent_messages = [
                {"role": "system", "content": (
                    f"{agent_system_prompt}\n\n"
                    f"CRITICAL DIRECTIVE - CALL CONCLUDED:\n"
                    f"The candidate has hung up or asked to end the call. Deliver a polite, 1-sentence parting acknowledgment wishing them well (under 15 words). DO NOT ask any questions."
                )},
            ]
            for t in dialogue:
                role_tag = "user" if t["speaker"] == "CANDIDATE" else "assistant"
                agent_messages.append({"role": role_tag, "content": t["text"]})
            agent_reply = await chat_messages(agent_messages, temperature=0.2, max_tokens=300)
            if not agent_reply or not agent_reply.strip():
                agent_reply = "Understood. Thank you for your time today, and have a great day!"
            dialogue.append({"speaker": "AGENT", "text": agent_reply})
            break

        # 2. Agent's turn to respond to Candidate
        if is_final_round:
            agent_messages = [
                {"role": "system", "content": (
                    f"{agent_system_prompt}\n\n"
                    f"CRITICAL DIRECTIVE - FINAL TURN (CALL CONCLUDED):\n"
                    f"This is the final turn of the screening interview. The interview is now OVER.\n"
                    f"- DO NOT ASK ANY QUESTIONS.\n"
                    f"- DO NOT ASK 'do you have any questions?'.\n"
                    f"- Acknowledge the candidate's last answer in 5-8 words.\n"
                    f"- Deliver the closing statement: \"{closing_text}\"\n"
                    f"- Conclude with \"Have a great day!\""
                )},
            ]
        else:
            agent_messages = [
                {"role": "system", "content": agent_system_prompt},
            ]

        for t in dialogue:
            role_tag = "user" if t["speaker"] == "CANDIDATE" else "assistant"
            agent_messages.append({"role": role_tag, "content": t["text"]})

        agent_reply = await chat_messages(agent_messages, temperature=0.2, max_tokens=600)
        
        # Robust fallback if model produces empty content due to prompt constraints or token limits
        if not agent_reply or not agent_reply.strip():
            agent_reply = f"Thank you for sharing that with me. {closing_text}"
            dialogue.append({"speaker": "AGENT", "text": agent_reply})
            call_concluded = True
        else:
            dialogue.append({"speaker": "AGENT", "text": agent_reply})

        # Check if Agent explicitly executed a Dealbreaker Fast-Exit before final round
        lower_agent = agent_reply.lower()
        dealbreaker_signals = [
            "wish you the best in your search",
            "wish you all the best in your search",
            "we will not be moving forward",
            "won't be able to move forward with your application",
            "end our conversation here",
            "conclude our discussion here",
            "conclude our call here",
        ]
        call_concluded = is_final_round or any(signal in lower_agent for signal in dealbreaker_signals)

        if call_concluded:
            # Let candidate deliver a final polite parting acknowledgment
            cand_farewell_msgs = [
                {"role": "system", "content": (
                    f"{candidate_system_prompt}\n\n"
                    f"CRITICAL DIRECTIVE: The recruiter has just concluded the call and said goodbye. "
                    f"Respond with a brief, polite farewell wishing them well (under 12 words). Do not ask questions."
                )},
            ]
            for t in dialogue:
                role_tag = "user" if t["speaker"] == "AGENT" else "assistant"
                cand_farewell_msgs.append({"role": role_tag, "content": t["text"]})
            cand_farewell = await chat_messages(cand_farewell_msgs, temperature=0.3, max_tokens=250)
            if cand_farewell and cand_farewell.strip():
                dialogue.append({"speaker": "CANDIDATE", "text": cand_farewell.strip()})
            break

    return dialogue


async def evaluate_digital_twin_run(
    turns: list[dict[str, str]],
    role: models.Role,
    stage: Optional[models.RoleStage],
    persona: models.DigitalTwinPersona,
) -> dict[str, Any]:
    """Evaluate agent performance against the simulated persona and generate concrete prompt patches."""
    formatted_transcript = "\n".join([f"{t['speaker']}: {t['text']}" for t in turns])

    stage_title = stage.name if stage else "Round 1: Screening"

    eval_prompt = f"""You are a master AI Conversation Architect.
Review this simulated phone interview between an AI Recruiter Agent and a challenging candidate persona.

Role: {role.title} ({stage_title})
Persona Tested: {persona.name} (Difficulty: {persona.difficulty})
Persona Description: {persona.description}

Dialogue Transcript:
\"\"\"
{formatted_transcript}
\"\"\"

Assess the AI Agent's performance rigorously.
Did the agent maintain composure? Did it get deflected? Did it ask repetitive questions?
Did it manage to extract mandatory criteria (notice period, salary, skills) or handle the persona's objections?

Respond with ONLY a JSON object with this exact structure:
{{
  "score_resilience": <integer 0-100, ability to handle pushback/deflection/quirks>,
  "score_clarity": <integer 0-100, question sharpness and professional pace>,
  "score_information_capture": <integer 0-100, did it obtain notice period, CTC, tech competencies>,
  "score_overall": <integer 0-100>,
  "strengths": ["bullet point 1", "bullet point 2"],
  "weaknesses": ["bullet point 1", "bullet point 2"],
  "ai_analysis": "Detailed 2-3 sentence analysis of how the agent navigated this persona's challenge.",
  "prompt_recommendation": "A concise, ready-to-use rule or directive that the recruiter should add to the agent's Additional Instructions to fix the weaknesses detected in this test."
}}"""

    messages = [
        {"role": "system", "content": "You are a conversation evaluation expert. Always reply in valid JSON format."},
        {"role": "user", "content": eval_prompt},
    ]

    result = await chat_json_messages(messages, temperature=0.1)
    return {
        "score_resilience": int(result.get("score_resilience") or 70),
        "score_clarity": int(result.get("score_clarity") or 75),
        "score_information_capture": int(result.get("score_information_capture") or 70),
        "score_overall": int(result.get("score_overall") or 72),
        "strengths": result.get("strengths") or ["Maintained professional tone"],
        "weaknesses": result.get("weaknesses") or ["Could probe more firmly on ambiguous answers"],
        "ai_analysis": result.get("ai_analysis") or "Agent completed the dialogue but has room to improve resilience.",
        "prompt_recommendation": result.get("prompt_recommendation") or "Add a firm probing rule when candidate provides vague compensation or availability answers.",
    }
