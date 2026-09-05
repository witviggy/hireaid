from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db
from ..services.call_sync import evaluate_call_internal, sync_call
from ..services.transcription import transcribe_call_audio

router = APIRouter(prefix="/api/calls", tags=["calls"])


@router.get("", response_model=list[schemas.CallOut])
def list_calls(role_id: str | None = None, db: Session = Depends(get_db)):
    q = db.query(models.Call).options(
        joinedload(models.Call.screening),
        joinedload(models.Call.retry_entries),
        joinedload(models.Call.stage),
        joinedload(models.Call.role_candidate).joinedload(models.RoleCandidate.candidate),
        joinedload(models.Call.role_candidate).joinedload(models.RoleCandidate.role).joinedload(models.Role.stages),
    )
    if role_id:
        q = q.filter(models.Call.role_id == role_id)
    return q.order_by(models.Call.created_at.desc()).all()


@router.get("/{call_id}", response_model=schemas.CallOut)
def get_call(call_id: str, db: Session = Depends(get_db)):
    call = (
        db.query(models.Call)
        .options(
            joinedload(models.Call.screening),
            joinedload(models.Call.retry_entries),
            joinedload(models.Call.stage),
            joinedload(models.Call.role_candidate).joinedload(models.RoleCandidate.candidate),
            joinedload(models.Call.role_candidate).joinedload(models.RoleCandidate.role).joinedload(models.Role.stages),
        )
        .filter(models.Call.id == call_id)
        .first()
    )
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    return call


@router.post("/{call_id}/sync", response_model=schemas.CallOut)
async def sync_call_now(call_id: str, db: Session = Depends(get_db)):
    """Pull the latest status/result/recording from Hunar for this call right now,
    and automatically transcribe if recording is available."""
    call = (
        db.query(models.Call)
        .options(
            joinedload(models.Call.role_candidate).joinedload(models.RoleCandidate.candidate),
            joinedload(models.Call.role_candidate).joinedload(models.RoleCandidate.role),
        )
        .filter(models.Call.id == call_id)
        .first()
    )
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    call = await sync_call(db, call)

    # If call has recording but no transcript yet, auto-transcribe
    if call.recording_url and not call.transcript:
        callee = call.candidate_name or "Candidate"
        tx = await transcribe_call_audio(call.recording_url, callee_name=callee)
        if tx.get("transcript"):
            call.transcript = tx["transcript"]
            call.transcript_turns = tx.get("transcript_turns", [])
            db.add(call)
            db.commit()

    db.refresh(call)
    return call


@router.post("/{call_id}/transcribe", response_model=schemas.CallOut)
async def transcribe_call_endpoint(call_id: str, db: Session = Depends(get_db)):
    """Transcribe or re-transcribe call recording using Groq Whisper."""
    call = (
        db.query(models.Call)
        .options(
            joinedload(models.Call.role_candidate).joinedload(models.RoleCandidate.candidate),
            joinedload(models.Call.role_candidate).joinedload(models.RoleCandidate.role),
            joinedload(models.Call.screening),
        )
        .filter(models.Call.id == call_id)
        .first()
    )
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    if not call.recording_url:
        raise HTTPException(status_code=400, detail="Call has no recording URL to transcribe")

    callee = call.candidate_name or "Candidate"
    tx = await transcribe_call_audio(call.recording_url, callee_name=callee)
    if tx.get("transcript"):
        call.transcript = tx["transcript"]
        call.transcript_turns = tx.get("transcript_turns", [])
        db.add(call)
        db.commit()
        db.refresh(call)
        # Automatically update screening scorecard using new transcript
        try:
            await evaluate_call_internal(db, call)
            db.refresh(call)
        except Exception:
            pass

    return call


@router.post("/{call_id}/evaluate", response_model=schemas.CallOut)
async def evaluate_call_endpoint(call_id: str, db: Session = Depends(get_db)):
    """Evaluate or re-evaluate screening scorecard for this call using its transcript and role criteria."""
    call = (
        db.query(models.Call)
        .options(
            joinedload(models.Call.screening),
            joinedload(models.Call.retry_entries),
            joinedload(models.Call.role_candidate).joinedload(models.RoleCandidate.candidate),
            joinedload(models.Call.role_candidate).joinedload(models.RoleCandidate.role),
        )
        .filter(models.Call.id == call_id)
        .first()
    )
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    await evaluate_call_internal(db, call)
    db.refresh(call)
    return call


@router.post("/{call_id}/cancel-retry", response_model=schemas.CallOut)
def cancel_call_retry(call_id: str, db: Session = Depends(get_db)):
    """Cancel any pending reschedule/retry for this call and update candidate status."""
    call = (
        db.query(models.Call)
        .options(
            joinedload(models.Call.screening),
            joinedload(models.Call.retry_entries),
            joinedload(models.Call.role_candidate).joinedload(models.RoleCandidate.candidate),
            joinedload(models.Call.role_candidate).joinedload(models.RoleCandidate.role),
        )
        .filter(models.Call.id == call_id)
        .first()
    )
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    for r in call.retry_entries:
        if r.status == models.RetryStatus.PENDING:
            r.status = models.RetryStatus.CANCELLED
            db.add(r)

    if call.role_candidate and call.role_candidate.status == models.PipelineStatus.RETRY_PENDING:
        call.role_candidate.status = models.PipelineStatus.UNREACHABLE
        db.add(call.role_candidate)

    db.commit()
    db.refresh(call)
    return call


@router.patch("/{call_id}/status", response_model=schemas.CallOut)
def update_call_status(call_id: str, payload: schemas.UpdateCallStatusRequest, db: Session = Depends(get_db)):
    """Manually update the call's status (and optionally candidate pipeline status),
    cancelling any pending retry if requested."""
    call = (
        db.query(models.Call)
        .options(
            joinedload(models.Call.screening),
            joinedload(models.Call.retry_entries),
            joinedload(models.Call.role_candidate).joinedload(models.RoleCandidate.candidate),
            joinedload(models.Call.role_candidate).joinedload(models.RoleCandidate.role),
        )
        .filter(models.Call.id == call_id)
        .first()
    )
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    call.status = payload.status
    db.add(call)

    if payload.cancel_pending_retry:
        for r in call.retry_entries:
            if r.status == models.RetryStatus.PENDING:
                r.status = models.RetryStatus.CANCELLED
                db.add(r)

    if payload.pipeline_status and call.role_candidate:
        try:
            call.role_candidate.status = models.PipelineStatus(payload.pipeline_status)
            db.add(call.role_candidate)
        except ValueError:
            pass

    db.commit()
    db.refresh(call)
    return call


@router.delete("/{call_id}")
def delete_call(call_id: str, db: Session = Depends(get_db)):
    """Delete a call record."""
    call = db.query(models.Call).filter(models.Call.id == call_id).first()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    rc = call.role_candidate
    db.delete(call)
    db.commit()

    if rc:
        remaining_calls = db.query(models.Call).filter(models.Call.role_candidate_id == rc.id).count()
        if remaining_calls == 0 and rc.status in {
            models.PipelineStatus.CALLING,
            models.PipelineStatus.RETRY_PENDING,
            models.PipelineStatus.NO_ANSWER,
        }:
            rc.status = models.PipelineStatus.SOURCED
            db.add(rc)
            db.commit()

    return {"ok": True, "deleted_call_id": call_id}


@router.post("/seed-demo-activity")
def seed_demo_activity(db: Session = Depends(get_db)):
    """Seed high-fidelity calls, dialogues, AI screening scorecards, and shortlisted candidates."""
    from datetime import datetime, timedelta, timezone

    now = datetime.now(timezone.utc)

    # Fetch candidates with pipeline entries
    candidates = (
        db.query(models.Candidate)
        .options(
            joinedload(models.Candidate.pipeline_entries).joinedload(models.RoleCandidate.role).joinedload(models.Role.stages)
        )
        .all()
    )

    cand_by_name = {c.full_name: c for c in candidates}

    # Data specifications for demo calls and transcripts
    rich_demo_data = [
        {
            "name": "Vikramaditya Sharma",
            "role_title": "Senior Software Engineer",
            "status": models.PipelineStatus.SHORTLISTED,
            "fit_score": 93,
            "fit_strengths": ["6.5 yrs designing distributed payment architectures", "Deep Kafka, Go, and PostgreSQL mastery at Razorpay", "Strong concurrency and high-throughput design intuition"],
            "fit_gaps": ["60-day notice period (standard fintech policy, willing to negotiate early exit)"],
            "fit_summary": "Top-tier senior engineer with exceptional systems design knowledge and proven leadership track record.",
            "duration": "285",
            "transcript_turns": [
                {"speaker": "AI", "text": "Hi Vikramaditya! This is Alex calling from TechFlow Systems. I came across your impressive backend work at Razorpay and wanted to reach out regarding our Senior Software Engineer role. Do you have a few minutes to chat?"},
                {"speaker": "Candidate", "text": "Hi Alex! Yes, good timing. I was just wrapping up a sprint planning session. I'd love to hear what TechFlow is building."},
                {"speaker": "AI", "text": "Fantastic. To start off, our core distributed infrastructure processes over 50,000 requests per second across microservices. What has been your focus at Razorpay regarding high-throughput systems?"},
                {"speaker": "Candidate", "text": "At Razorpay, I lead the core ledger and transaction settlement platform. We handle peak traffic bursts exceeding 120,000 transactions per minute using Go, Kafka for event streaming, and PostgreSQL with customized read replicas and connection pooling. We brought p99 latency down from 240ms to under 45ms."},
                {"speaker": "AI", "text": "That is seriously impressive latency optimization. What is your current notice period and are you actively exploring new opportunities right now?"},
                {"speaker": "Candidate", "text": "Yes, I am actively exploring. My official notice period on paper is 60 days, but I have sufficient accrued leaves and buyout clearance with my director, so I can comfortably transition within 30 to 45 days."},
                {"speaker": "AI", "text": "Understood, that works well with our quarterly hiring timeline. What are your expectations in terms of compensation and CTC?"},
                {"speaker": "Candidate", "text": "I am currently at around 32 LPA fixed. For this next challenge, given the scope and architectural ownership, I am looking for a total package in the range of 38 to 42 LPA."},
                {"speaker": "AI", "text": "Thank you Vikramaditya, that aligns with our compensation bracket for Senior Engineers. Are you comfortable with a hybrid model in our San Francisco or Bangalore office?"},
                {"speaker": "Candidate", "text": "Yes, absolutely. I enjoy collaborating in-person 2 to 3 days a week with the engineering team."},
                {"speaker": "AI", "text": "Wonderful. Based on your strong systems design experience and alignment on timelines, I'm recommending your profile directly to our Engineering Director for Round 2 Technical Assessment. You'll receive a calendar invite within 24 hours. Thanks for your time!"},
                {"speaker": "Candidate", "text": "Thank you so much Alex! Looking forward to the conversation. Have a great day."}
            ],
            "screening": {
                "interest_level": "high",
                "notice_period_days": 45,
                "expected_ctc_min": 3800000,
                "expected_ctc_max": 4200000,
                "location_confirmed": "exact",
                "open_to_relocation": True,
                "reason_for_switching": "Seeking architectural ownership over next-generation distributed systems and global platform scaling.",
                "concerns": ["60-day contractual notice period; candidate confirmed feasibility of 30-45 day buyout"],
                "competing_offers": False,
                "skill_assessments": {
                    "Distributed Systems": 95,
                    "Go & Python": 92,
                    "PostgreSQL Optimization": 94,
                    "Kafka & Event-driven Architecture": 96,
                    "System Design & Scalability": 94
                },
                "score_technical": 95,
                "score_experience": 94,
                "score_location": 90,
                "score_compensation": 92,
                "score_availability": 85,
                "score_overall": 93,
                "recommendation": models.Recommendation.ADVANCE,
                "ai_summary": "Outstanding candidate. Proven track record scaling fintech infrastructure to 120k TPM at Razorpay with p99 sub-50ms latency. Confident, articulate, and completely aligned on compensation.",
                "ai_concerns": "Confirm notice period buyout terms early during the interview loop."
            }
        },
        {
            "name": "Aditya Nair",
            "role_title": "Applied AI Engineer",
            "status": models.PipelineStatus.SHORTLISTED,
            "fit_score": 95,
            "fit_strengths": ["4.5 yrs production GenAI and RAG pipelines at InMobi", "Deep experience with PyTorch, LangChain, vector DBs, and LLM fine-tuning", "Reduced latency of real-time AI responses by 60%"],
            "fit_gaps": ["Requires clear roadmap on model training compute budget"],
            "fit_summary": "Exceptional Applied AI engineer with deep technical rigor in LLM serving, agentic orchestration, and RAG evaluation.",
            "duration": "310",
            "transcript_turns": [
                {"speaker": "AI", "text": "Hi Aditya, this is Alex calling from Cognitive AI Labs. I noticed your recent work deploying production GenAI agents at InMobi. Are you free for a brief chat?"},
                {"speaker": "Candidate", "text": "Hey Alex! Yes, absolutely. I'm very familiar with Cognitive AI Labs and the papers your research team has published on multi-modal reasoning."},
                {"speaker": "AI", "text": "That's great to hear! We're building real-time generative assistants and multi-agent workflows. What has been your core experience with RAG and LLM latency optimization?"},
                {"speaker": "Candidate", "text": "At InMobi, I designed and rolled out our enterprise knowledge retrieval system using a hybrid BM25 and dense vector search on Qdrant. We fine-tuned LLaMA-3 8B and Mistral with LoRA for specialized query reformulation, and utilized vLLM with PagedAttention to cut time-to-first-token down to 180ms."},
                {"speaker": "AI", "text": "180ms TTFT is phenomenal for production RAG. How do you approach automated hallucination detection and model evaluation?"},
                {"speaker": "Candidate", "text": "We implemented Ragas and TruLens evaluation frameworks in our CI pipeline. Every prompt iteration and model checkpoint is benchmarked for context relevancy, faithfulness, and answer relevance with an automated threshold of 0.88."},
                {"speaker": "AI", "text": "Remarkable. What does your current timeline and notice period look like?"},
                {"speaker": "Candidate", "text": "I have a 30-day notice period at InMobi, and my expected CTC is in the ballpark of 34 to 36 LPA."},
                {"speaker": "AI", "text": "That fits right into our budget. Since this role is fully remote with team syncs, does that match your preferred work style?"},
                {"speaker": "Candidate", "text": "Yes, I've been working in a high-performing remote setup for over two years. Remote collaboration suits me well."},
                {"speaker": "AI", "text": "Excellent! Aditya, your background is a near-perfect match for our Applied AI roadmap. I am shortlisting you directly and moving you forward to our AI Architecture Round. Thank you so much!"},
                {"speaker": "Candidate", "text": "Awesome! Thanks Alex, looking forward to speaking with the AI team."}
            ],
            "screening": {
                "interest_level": "high",
                "notice_period_days": 30,
                "expected_ctc_min": 3400000,
                "expected_ctc_max": 3600000,
                "location_confirmed": "exact",
                "open_to_relocation": True,
                "reason_for_switching": "Desire to work exclusively on advanced generative AI agent architecture and custom model serving.",
                "concerns": [],
                "competing_offers": False,
                "skill_assessments": {
                    "LLMs & Prompt Engineering": 96,
                    "RAG & Vector Databases": 97,
                    "vLLM & Latency Optimization": 94,
                    "PyTorch & Fine-Tuning": 92,
                    "LangChain & Multi-Agent Frameworks": 95
                },
                "score_technical": 96,
                "score_experience": 95,
                "score_location": 98,
                "score_compensation": 94,
                "score_availability": 92,
                "score_overall": 95,
                "recommendation": models.Recommendation.ADVANCE,
                "ai_summary": "Top 1% candidate for Applied AI Engineer. Deep, battle-tested expertise in hybrid RAG, vLLM optimization, and continuous LLM evaluation frameworks. 30-day notice and realistic salary expectations.",
                "ai_concerns": "Strongly recommended for expedited technical deep dive."
            }
        },
        {
            "name": "Rhea Chawla",
            "role_title": "UI/UX Developer",
            "status": models.PipelineStatus.SHORTLISTED,
            "fit_score": 94,
            "fit_strengths": ["4 yrs leading design systems at CRED", "Pixel-perfect Figma to React/Tailwind translations", "Deep focus on micro-interactions, WCAG accessibility, and Framer Motion"],
            "fit_gaps": ["Prefers Figma design tokens already structured"],
            "fit_summary": "Outstanding UI/UX Engineer with top-tier craft, design system governance, and frontend engineering capability.",
            "duration": "260",
            "transcript_turns": [
                {"speaker": "AI", "text": "Hello Rhea, this is Alex from CreativePulse Studios! I was reviewing your portfolio and your design systems contributions at CRED. Do you have a couple minutes to speak?"},
                {"speaker": "Candidate", "text": "Hi Alex! Yes, I do. Thanks for reaching out — I love CreativePulse's focus on user empathy and polished aesthetics."},
                {"speaker": "AI", "text": "We pride ourselves on craft. Could you share how you bridge Figma design tokens into clean React and Tailwind components at CRED?"},
                {"speaker": "Candidate", "text": "Definitely. At CRED, I built and maintain our core Neo-design system used across 14 product squads. We use Style Dictionary to transform Figma tokens directly into Tailwind CSS variables and TypeScript types. All components are built with Radix UI primitives for full WCAG 2.1 AA accessibility, accompanied by fluid Framer Motion animations."},
                {"speaker": "AI", "text": "That's exceptional rigor. How do you handle accessibility and performance with dynamic animations?"},
                {"speaker": "Candidate", "text": "We test every component using axe-core and screen readers like NVDA. For animations, we strictly honor 'prefers-reduced-motion' and ensure GPU-accelerated CSS transforms so there is zero frame dropping on lower-end mobile devices."},
                {"speaker": "AI", "text": "Love that attention to detail. What is your current availability and expected CTC?"},
                {"speaker": "Candidate", "text": "My notice period is 30 days. For my next role, I am looking for around 24 to 26 LPA, which reflects the design systems ownership I bring."},
                {"speaker": "AI", "text": "That is right on target for us. Our team works remotely across India with flexible sync hours. Does that suit your routine?"},
                {"speaker": "Candidate", "text": "Yes, that is exactly what I'm looking for!"},
                {"speaker": "AI", "text": "Fantastic! Rhea, I'm shortlisting you and scheduling you for our Portfolio and Live Code Review session. Have a wonderful rest of your day!"},
                {"speaker": "Candidate", "text": "Thank you Alex, can't wait! Talk soon."}
            ],
            "screening": {
                "interest_level": "high",
                "notice_period_days": 30,
                "expected_ctc_min": 2400000,
                "expected_ctc_max": 2600000,
                "location_confirmed": "exact",
                "open_to_relocation": True,
                "reason_for_switching": "Looking to architect a greenfield design system for a rapidly growing creative product.",
                "concerns": [],
                "competing_offers": False,
                "skill_assessments": {
                    "Design Systems & Tokens": 98,
                    "Figma to Code Implementation": 96,
                    "React & TypeScript": 92,
                    "Tailwind CSS & Styling": 95,
                    "Accessibility (WCAG) & Motion": 93
                },
                "score_technical": 94,
                "score_experience": 93,
                "score_location": 96,
                "score_compensation": 94,
                "score_availability": 92,
                "score_overall": 94,
                "recommendation": models.Recommendation.ADVANCE,
                "ai_summary": "World-class design technologist from CRED. Rare combination of immaculate aesthetic taste, Figma token architecture, and production-grade accessible React engineering.",
                "ai_concerns": "None. Advance immediately."
            }
        },
        {
            "name": "Aarav Patel",
            "role_title": "Full Stack Web Developer",
            "status": models.PipelineStatus.SHORTLISTED,
            "fit_score": 90,
            "fit_strengths": ["4 yrs full-stack development at Freshworks", "High-performance React/Next.js and Node.js REST/GraphQL APIs", "Solid relational modeling and Redis caching"],
            "fit_gaps": ["Less exposure to Kubernetes cluster management, mostly used managed ECS"],
            "fit_summary": "Strong, dependable full-stack engineer with clean coding practices and agile product execution.",
            "duration": "240",
            "transcript_turns": [
                {"speaker": "AI", "text": "Hi Aarav! This is Alex from Nexus Digital. I'm calling about our Full Stack Web Developer opening. Do you have a few minutes to talk about your recent work at Freshworks?"},
                {"speaker": "Candidate", "text": "Hello Alex! Sure, I have time. I'd be happy to share more about what I've been doing."},
                {"speaker": "AI", "text": "Awesome. Our stack is React, TypeScript, Node.js, and PostgreSQL. What has been your primary architectural focus recently?"},
                {"speaker": "Candidate", "text": "At Freshworks, I work on our CRM customer analytics module. I build responsive frontends with React 18 and TypeScript, while managing Node.js microservices with PostgreSQL. I recently led the migration of our reporting dashboard from legacy REST endpoints to GraphQL with DataLoader, which reduced over-fetching by 40% and cut dashboard load time by half."},
                {"speaker": "AI", "text": "That's a very tangible performance win. What is your notice period and current compensation expectation?"},
                {"speaker": "Candidate", "text": "My notice period is 30 days. In terms of CTC, I am targeting 22 to 24 LPA."},
                {"speaker": "AI", "text": "That matches our salary band nicely. Are you comfortable with a hybrid setup or flexible remote arrangement?"},
                {"speaker": "Candidate", "text": "Yes, hybrid or remote works great for me. I'm based in Chennai and very comfortable with distributed team syncs."},
                {"speaker": "AI", "text": "Great! Based on our chat, I'm shortlisting you and advancing your profile to Round 2 with our Engineering Lead. You will receive the details via email shortly. Thanks Aarav!"},
                {"speaker": "Candidate", "text": "Thanks a lot Alex, appreciate it!"}
            ],
            "screening": {
                "interest_level": "high",
                "notice_period_days": 30,
                "expected_ctc_min": 2200000,
                "expected_ctc_max": 2400000,
                "location_confirmed": "exact",
                "open_to_relocation": True,
                "reason_for_switching": "Seeking more product autonomy and greenfield feature development in a fast-paced environment.",
                "concerns": [],
                "competing_offers": False,
                "skill_assessments": {
                    "React & TypeScript": 92,
                    "Node.js & Backend Architecture": 90,
                    "PostgreSQL & Database Design": 88,
                    "GraphQL & API Optimization": 93,
                    "Docker & CI/CD": 85
                },
                "score_technical": 90,
                "score_experience": 89,
                "score_location": 92,
                "score_compensation": 92,
                "score_availability": 90,
                "score_overall": 90,
                "recommendation": models.Recommendation.ADVANCE,
                "ai_summary": "Solid full-stack engineer with clear understanding of modern frontend state management, GraphQL optimization, and robust PostgreSQL schemas. High communication clarity.",
                "ai_concerns": "Verify depth in backend horizontal scaling during technical interview."
            }
        },
        {
            "name": "Pooja Iyer",
            "role_title": "Junior Marketing Associate",
            "status": models.PipelineStatus.SHORTLISTED,
            "fit_score": 88,
            "fit_strengths": ["1.5 yrs growth marketing at Swiggy", "Hands-on experience with CleverTap, push notifications, and GA4", "Strong creative copywriting and campaign execution"],
            "fit_gaps": ["Developing paid acquisition budget management experience"],
            "fit_summary": "High-potential growth marketer with quick analytical instincts and clear grasp of retention loops.",
            "duration": "220",
            "transcript_turns": [
                {"speaker": "AI", "text": "Hi Pooja! This is Alex calling from Acme Growth Media. I'm reaching out about our Junior Marketing Associate role. Is now a good time to speak for 3-4 minutes?"},
                {"speaker": "Candidate", "text": "Hi Alex! Yes, absolutely. I'm available to talk."},
                {"speaker": "AI", "text": "Wonderful! We're expanding our multi-channel user acquisition campaigns. What marketing channels have you managed during your time at Swiggy?"},
                {"speaker": "Candidate", "text": "At Swiggy, I primarily worked on lifecycle marketing and user re-engagement. I managed our weekly push notification and email marketing campaigns using CleverTap, crafted copy that achieved a 14% open rate, and tracked funnel drop-offs using Google Analytics 4. I also coordinated cross-promotional campaigns with restaurant partners."},
                {"speaker": "AI", "text": "A 14% push open rate is well above industry averages. What is your current notice period and CTC expectation?"},
                {"speaker": "Candidate", "text": "My notice period is 30 days. My expected CTC is 8 to 9 LPA."},
                {"speaker": "AI", "text": "That fits comfortably into our hiring plan. Pooja, your proactive campaign mindset is exactly what our growth team is looking for. I am shortlisting your application and forwarding your notes to our Marketing Director. Look out for an email soon!"},
                {"speaker": "Candidate", "text": "Thank you so much Alex! Have a wonderful day!"}
            ],
            "screening": {
                "interest_level": "high",
                "notice_period_days": 30,
                "expected_ctc_min": 800000,
                "expected_ctc_max": 900000,
                "location_confirmed": "exact",
                "open_to_relocation": True,
                "reason_for_switching": "Looking to take ownership over full-funnel acquisition campaigns in a high-growth company.",
                "concerns": [],
                "competing_offers": False,
                "skill_assessments": {
                    "Content & Copywriting": 92,
                    "Lifecycle Marketing (CleverTap)": 90,
                    "Google Analytics & Data Analysis": 86,
                    "Social Media & Campaign Coordination": 87
                },
                "score_technical": 88,
                "score_experience": 86,
                "score_location": 92,
                "score_compensation": 94,
                "score_availability": 90,
                "score_overall": 88,
                "recommendation": models.Recommendation.ADVANCE,
                "ai_summary": "Energetic, articulate junior marketer from Swiggy with proven results in retention and email/push campaigns. Clear alignment on culture, salary, and availability.",
                "ai_concerns": "Assess depth in paid search (Google Ads) during team interview."
            }
        },
        {
            "name": "Sneha Reddy",
            "role_title": "Senior Software Engineer",
            "status": models.PipelineStatus.SCREENED,
            "fit_score": 89,
            "fit_strengths": ["7 yrs low-latency microservices at PhonePe", "AWS Kubernetes, Go, and fault-tolerant architecture", "Strong on-call incident response discipline"],
            "fit_gaps": ["Requires firm clarity on equity/ESOP vesting schedule"],
            "fit_summary": "High-caliber senior systems engineer with massive scale experience in UPI transaction processing.",
            "duration": "270",
            "transcript_turns": [
                {"speaker": "AI", "text": "Hello Sneha, this is Alex calling from TechFlow Systems. I'm reaching out regarding our Senior Software Engineer role. Is this a convenient time to chat?"},
                {"speaker": "Candidate", "text": "Hi Alex! Yes, I have a few minutes before my standup."},
                {"speaker": "AI", "text": "Great. Could you briefly describe your architecture responsibilities at PhonePe?"},
                {"speaker": "Candidate", "text": "At PhonePe, I architect our core UPI routing gateway. We maintain 99.999% availability across multi-region AWS deployments using Go, gRPC, and Cassandra for persistent state. I led the disaster recovery redesign that reduced failover time from 8 minutes to 15 seconds."},
                {"speaker": "AI", "text": "A 15-second multi-region failover is world-class. What are your availability and salary expectations?"},
                {"speaker": "Candidate", "text": "My notice period is 30 days. Expected CTC is around 42 LPA."},
                {"speaker": "AI", "text": "Understood Sneha. Your experience is exceptional. I am logging this screening as verified and advancing you to the engineering panel. Thank you!"},
                {"speaker": "Candidate", "text": "Thank you Alex, speak soon."}
            ],
            "screening": {
                "interest_level": "high",
                "notice_period_days": 30,
                "expected_ctc_min": 4000000,
                "expected_ctc_max": 4400000,
                "location_confirmed": "exact",
                "open_to_relocation": True,
                "reason_for_switching": "Seeking new challenge in distributed infrastructure with global product reach.",
                "concerns": [],
                "competing_offers": False,
                "skill_assessments": {
                    "Distributed Systems & Concurrency": 94,
                    "Go & Microservices": 92,
                    "Kubernetes & Cloud Infrastructure": 91,
                    "Fault Tolerance & Disaster Recovery": 96
                },
                "score_technical": 93,
                "score_experience": 92,
                "score_location": 90,
                "score_compensation": 88,
                "score_availability": 90,
                "score_overall": 89,
                "recommendation": models.Recommendation.ADVANCE,
                "ai_summary": "Deep systems engineer with exceptional experience in fault tolerance, high-availability architecture, and low-latency UPI networks at PhonePe.",
                "ai_concerns": "Compensation expectation is on the higher end of the band; confirm flexibility."
            }
        }
    ]

    seeded_calls = []

    for item in rich_demo_data:
        cand = cand_by_name.get(item["name"])
        if not cand or not cand.pipeline_entries:
            continue

        # Find matching pipeline entry for this role
        rc = next((e for e in cand.pipeline_entries if e.role and e.role.title == item["role_title"]), cand.pipeline_entries[0])

        # Update RoleCandidate pipeline status & AI fit
        rc.status = item["status"]
        rc.fit_score = item["fit_score"]
        rc.fit_strengths = item["fit_strengths"]
        rc.fit_gaps = item["fit_gaps"]
        rc.fit_summary = item["fit_summary"]
        db.add(rc)

        # Check if a call already exists for this entry
        existing_call = db.query(models.Call).filter(models.Call.role_candidate_id == rc.id).first()
        if existing_call:
            call = existing_call
        else:
            call = models.Call(
                role_candidate_id=rc.id,
                role_id=rc.role_id,
                candidate_id=cand.id,
                stage_id=rc.current_stage_id,
                attempt_number=1,
                hunar_call_id=f"hunar_demo_{cand.id[:8]}",
                status="COMPLETED",
                lifecycle_status="COMPLETED",
                recording_url="https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg",
                duration_seconds=item["duration"],
                started_at=now - timedelta(hours=2),
                ended_at=now - timedelta(hours=2, seconds=-int(item["duration"])),
            )
            db.add(call)
            db.commit()
            db.refresh(call)

        # Update transcript & turns
        formatted_txt = "\n\n".join([f"{t['speaker']}: {t['text']}" for t in item["transcript_turns"]])
        call.transcript = formatted_txt
        call.transcript_turns = item["transcript_turns"]
        call.status = "COMPLETED"
        call.duration_seconds = item["duration"]
        db.add(call)

        # Check or create Screening
        existing_screening = db.query(models.Screening).filter(models.Screening.call_id == call.id).first()
        sc_data = item["screening"]
        if existing_screening:
            sc = existing_screening
        else:
            sc = models.Screening(
                call_id=call.id,
                role_candidate_id=rc.id,
            )

        sc.interest_level = sc_data["interest_level"]
        sc.notice_period_days = sc_data["notice_period_days"]
        sc.expected_ctc_min = sc_data["expected_ctc_min"]
        sc.expected_ctc_max = sc_data["expected_ctc_max"]
        sc.location_confirmed = sc_data["location_confirmed"]
        sc.open_to_relocation = sc_data["open_to_relocation"]
        sc.reason_for_switching = sc_data["reason_for_switching"]
        sc.concerns = sc_data["concerns"]
        sc.competing_offers = sc_data["competing_offers"]
        sc.skill_assessments = sc_data["skill_assessments"]
        sc.score_technical = sc_data["score_technical"]
        sc.score_experience = sc_data["score_experience"]
        sc.score_location = sc_data["score_location"]
        sc.score_compensation = sc_data["score_compensation"]
        sc.score_availability = sc_data["score_availability"]
        sc.score_overall = sc_data["score_overall"]
        sc.recommendation = sc_data["recommendation"]
        sc.ai_summary = sc_data["ai_summary"]
        sc.ai_concerns = sc_data["ai_concerns"]
        db.add(sc)
        db.commit()
        seeded_calls.append({"candidate": cand.full_name, "role": item["role_title"], "status": rc.status.value, "score": item["fit_score"]})

    return {
        "status": "success",
        "seeded_count": len(seeded_calls),
        "seeded_details": seeded_calls
    }


