# HireAId

**Your AI recruiting team, on call 24/7.**

HireAId is an AI-powered recruiting workspace that replaces the most exhausting part of hiring — chasing candidates on the phone — with a voice AI recruiter that sources, screens, scores, and shortlists candidates for you, at a scale no human team can match. Post a role, and HireAId takes it from job description to a ranked shortlist of screened, interview-ready candidates, automatically, then keeps every round of your interview process moving forward on its own.

Recruiters no longer have to be the ones dialing numbers, listening to recordings, or manually deciding who deserves a second call. HireAId does the first pass of every conversation, so your team only spends time on the candidates who are actually worth their attention.

## Table of contents

- [What makes HireAId different](#what-makes-hireaid-different)
- [Who it's for](#whos-its-for)
- [The HireAId experience](#the-hireaid-experience)
- [Running HireAId with Docker](#running-hireaid-with-docker)
- [Everyday usage tips](#everyday-usage-tips)

## What makes HireAId different

### 🎙️ An AI recruiter that actually calls candidates
Most hiring tools stop at emails and job board applications. HireAId's voice AI dials candidates directly, introduces your company by name, runs a natural, conversational screening interview, asks your custom qualifying questions, and handles pushback — all without a human recruiter ever picking up the phone.

**Speciality:** the AI recruiter isn't reading a rigid script. It adapts to how the candidate responds, handles objections gracefully, and still makes sure every mandatory question gets answered before the call wraps up.

**Example:** a candidate says *"I'm actually driving right now, can we talk later?"* — HireAId doesn't mark that as a rejection. It recognizes the difference between "not interested" and "bad timing," logs it for a callback, and keeps the candidate in play instead of silently dropping them from your pipeline.

### ⚡ From job description to shortlist in minutes
Paste in a job description and HireAId instantly extracts the must-have skills, seniority level, location, and hiring criteria — no manual tagging, no spreadsheets. It then sources matching candidates, ranks them against your role's actual requirements, and lines them up in a ready-to-call pipeline.

**Speciality:** ranking isn't a keyword match. Every sourced candidate gets a fit score out of 100, with a visible breakdown of exactly which strengths matched and which requirements are gaps — so you know *why* someone is ranked where they are, not just that they are.

**Example:** post a "Senior Backend Engineer" role requiring Python and distributed systems experience, and HireAId will surface candidates with that exact background ranked highest, while candidates with only adjacent experience (say, frontend-only engineers) are ranked lower with the gap clearly called out.

### 🧠 Every candidate is scored, not just logged
After every completed call, HireAId automatically generates a full scorecard: an overall fit score, a list of strengths, a list of gaps, a plain-English summary of the conversation, and a clear recommendation — **Advance**, **Hold**, or **Reject**. No more listening to call recordings just to figure out who's worth a second look.

**Speciality:** the scorecard is generated straight from the actual call transcript, so the recommendation always reflects what the candidate really said — not a guess based on résumé keywords.

**Example:** two candidates both "pass" a call. One scores 82/100 with strong answers on every required skill; the other scores 58/100 because they hedged on their notice period and couldn't speak to a key requirement. Instead of both landing in the same generic "completed" bucket, HireAId tells your team exactly who to prioritize first.

### 🔁 Smart, human-like follow-up
Candidates don't always pick up on the first try — and even when they do, not every call is a clean pass or fail. HireAId tells these situations apart and gives your team the right next action every time, instead of a single generic "retry" button that means something different every time you click it:

- **Recall** — the candidate didn't answer or the call was cut short. Redial them fresh, with no memory carried over, since there was no real conversation to remember.
- **Rechance** — the candidate completed the call but didn't clear the bar. Give them a second, fair shot at the same round rather than auto-rejecting on one bad call.
- **Call (next round)** — the candidate passed with a good score. Move them straight into the next round, and their AI interviewer already knows everything from the previous conversation.

**Example:** a candidate misses two calls in a row (no answer). HireAId keeps offering **Recall** and automatically flags the candidate once a configurable retry limit is hit, so your team doesn't waste effort chasing someone who's gone silent — while a candidate who *did* talk but scored low still gets a fair, clearly-labeled second chance instead of being auto-rejected.

### 🧪 Rehearse your screening before it ever reaches a real candidate
The **Digital Twin Lab** lets you test-drive your AI recruiter against realistic simulated candidate personas — enthusiastic, skeptical, evasive, or straight-up difficult — so you can perfect your screening flow before a single real candidate ever hears it.

**Speciality:** you're not just proofreading a script, you're running a full simulated conversation and getting the same scorecard, transcript, and recommendation your real candidates would generate — so you catch a badly-worded question or a confusing objection-handling response before it costs you a real applicant's goodwill.

**Example:** before launching a new role, run your screening script against a "skeptical senior candidate" persona who pushes back on every question. If the AI recruiter stumbles or gives a robotic answer, you'll see it in the simulation and can fix the script — instead of finding out from a real candidate's bad experience.

### 🪜 Multi-round pipelines that carry context forward
Design multi-stage interview pipelines — screening, technical, culture-fit, whatever your process needs — with each round having its own AI voice persona and call script. Crucially, each round's AI carries forward context from earlier conversations, so candidates never have to repeat themselves.

**Speciality:** advancing a candidate isn't just a status change. It's a handoff — the next round's AI recruiter is briefed with what the candidate already said, so the second call picks up naturally instead of starting from zero.

**Example:** a candidate mentions in Round 1 that they're relocating for the role. In Round 2 (a deeper technical or culture-fit round), the AI doesn't ask the relocation question again — it already knows, because that context carried forward automatically.

### 📊 A real-time view of your entire funnel
See every open role, every candidate, every call outcome, and every pipeline stage from one clean dashboard. Know exactly who's been called, who's shortlisted, who needs a decision, and who's stuck — without digging through spreadsheets, inboxes, or call logs.

**Speciality:** the dashboard isn't a static report — it reflects live call activity, so a call that just finished shows up with its scorecard immediately, not after some nightly batch job.

**Example:** open the pipeline for a role and instantly see a breakdown like "5 sourced, 3 called, 2 shortlisted, 1 needs review" — with one click into any candidate to see their full call history and transcript.

### 🔒 Built for how recruiting teams actually work
Manage requisitions, candidate pipelines, call scripts, and screening outcomes as a team, with a shared, always-up-to-date view of every role's progress from sourcing to offer — so nobody is working off a stale spreadsheet or asking "did we already call this person?"

## Who it's for

- **Startups and growing teams** who need to screen a high volume of applicants without hiring a dedicated screening team.
- **Talent acquisition teams** who want every candidate interaction to be consistent, on-brand, and fully logged, no matter which recruiter is technically "on point."
- **Recruiters** who are tired of playing phone tag and want their pipeline to move itself forward while they focus on the candidates who matter most.

## The HireAId experience

1. **Post a role.** Describe the job in plain language — HireAId figures out the must-have skills, seniority, and hiring criteria for you.
2. **Source and rank.** Candidates are found, scored against your role, and added to your pipeline automatically, ranked by fit.
3. **Let AI make the calls.** Your voice recruiter screens every candidate the same way, every time, asking your questions and handling objections naturally.
4. **Review the results.** Scorecards, transcripts, and clear Advance/Hold/Reject recommendations are ready the moment the call ends.
5. **Move the best forward.** Recall a missed call, give a borderline candidate another chance, or send your top performers straight into the next round — memory and all — all with one click.

## Running HireAId with Docker

The fastest way to run the full application (frontend, backend, and database together) locally is with Docker.

### 1. Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

### 2. Configure your environment

Copy the provided example environment file and fill in any values you have:

```powershell
copy .env.example .env
```

The database and local URLs already have working defaults — you only need to add credentials for the optional live integrations (voice calling and AI-powered features) if you want to use them. Without any keys filled in, the app still runs fully in a local sandbox mode with mock data, so you can explore every screen and workflow immediately.

### 3. Start the full stack

From the repository root, run:

```powershell
docker compose up --build
```

This brings up three containers together:

- **Database** — PostgreSQL, with your data persisted between restarts.
- **Backend** — the application server, available at `http://localhost:8000`.
- **Frontend** — the web app itself, available at `http://localhost:5173`.

Once everything is up, open **[http://localhost:5173](http://localhost:5173)** in your browser to start using HireAId.

### 4. Stop the stack

To stop everything while keeping your data:

```powershell
docker compose down
```

To also wipe the local database and start completely fresh:

```powershell
docker compose down -v
```

### Rebuilding after pulling new changes

If you pull new code changes, rebuild the images before starting again so the containers pick up the latest version:

```powershell
docker compose up --build
```

## Everyday usage tips

- **Roles** is where every requisition lives — create a role, review the AI-extracted criteria, then jump into its pipeline.
- **People & Pipeline** on a role is where you source, rank, call, and manage candidates for that specific role.
- **Rounds & Voice Scripts** is where you configure each interview round's AI persona, questions, and objection handling.
- **Digital Twin Lab** is your rehearsal space — always worth a quick run before turning a new script loose on real candidates.
- **Candidates** and **Calls** give you a cross-role view when you want to check on a specific person or a specific call rather than browsing role by role.
- **Dashboard** is your at-a-glance health check across every open role.

---

*HireAId — hire faster, screen smarter, never miss a great candidate again.*
