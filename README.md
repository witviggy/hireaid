# HireAId

HireAId is an AI recruiting workspace for managing roles, sourcing and ranking candidates and running voice screening workflows. Recruiters work from a single dashboard backed by a FastAPI API, PostgreSQL, Hunar voice agents and an optional Groq-compatible LLM.

## What it does

- Create and manage requisitions with structured job criteria, skills, seniority, location and pipeline status.
- Configure multi-stage hiring pipelines and stage-specific call scripts.
- Search for candidates through the configured people-search provider, or use the built-in sandbox data for development.
- Rank candidates against the role and review scorecards, recommendations, transcripts, recordings and call results.
- Place and track outbound AI voice calls through Hunar.
- Receive Hunar webhook events and keep call state synchronized in PostgreSQL.
- Test screening prompts in the Digital Twin Lab with simulated candidate personas before using them in live calls.
- Review funnel metrics, screening decisions, calls, roles, candidates and system settings from the web app.

The frontend is a React + TypeScript application built with Vite and Tailwind CSS. The backend is a Python 3.12 FastAPI service using SQLAlchemy and PostgreSQL. Both services are containerized for local development and deployment.

## Architecture

```text
React/Vite frontend :5173
               |
               v
FastAPI backend :8000 ---- PostgreSQL :5432
               |
               +---- Hunar voice agents and webhooks
               +---- Groq-compatible LLM for extraction, ranking and transcription
               +---- People search provider or sandbox data
```

The browser talks only to the backend. Provider credentials stay server-side. On startup, the API creates missing tables and applies a small set of compatibility changes for this project; use proper migrations before making production schema changes.

## Repository structure

```text
backend/
   app/
      main.py                 FastAPI application and startup hooks
      config.py               Environment-backed settings
      models.py               SQLAlchemy models
      routers/                Roles, stages, candidates, calls, webhooks and more
      services/               Hunar, LLM, search, sync and digital-twin services
   Dockerfile
   requirements.txt
frontend/
   src/
      pages/                  Dashboard, roles, candidates, calls, lab and settings
      components/             Shared application and UI components
      api.ts                  Backend API client
   Dockerfile
docker-compose.yml          Local PostgreSQL, backend and frontend services
render.yaml                 Render backend and PostgreSQL configuration
vercel.json                 Frontend deployment configuration
```

## Quick start with Docker

### 1. Create `.env`

There is no committed `.env.example` in this repository. Create a file named `.env` in the repository root. The database defaults in `docker-compose.yml` work locally, but provider credentials must be added for live integrations.

```dotenv
POSTGRES_USER=voice_app
POSTGRES_PASSWORD=change_me
POSTGRES_DB=voice_app
POSTGRES_HOST=db
POSTGRES_PORT=5432

BACKEND_CORS_ORIGINS=http://localhost:5173
PUBLIC_BASE_URL=http://localhost:8000

# Hunar voice integration
HUNAR_API_KEY=
HUNAR_API_BASE_URL=https://api.voice.hunar.ai/external/v1
HUNAR_HIRING_AGENT_ID=
HUNAR_REACHOUT_AGENT_ID=
HUNAR_WEBHOOK_SECRET=

# LLM features: JD extraction, ranking and transcription
GROQ_API_KEY=
GROQ_MODEL=qwen/qwen3.8-27b
GROQ_API_BASE_URL=https://api.groq.com/openai/v1

# Use sandbox for local development, or pdl for a live provider
PEOPLE_SEARCH_PROVIDER=sandbox
PDL_API_KEY=
APOLLO_API_KEY=
PROXYCURL_API_KEY=
CORESIGNAL_API_KEY=
```

Never commit `.env` or paste live credentials into source control. Rotate any credential that has been exposed.

### 2. Start the stack

```bash
docker compose up --build
```

Open the application at [http://localhost:5173](http://localhost:5173). The backend provides [Swagger API docs](http://localhost:8000/docs), [ReDoc](http://localhost:8000/redoc) and a health check at [http://localhost:8000/api/health](http://localhost:8000/api/health).

To stop the services while keeping the database volume:

```bash
docker compose down
```

To remove the local PostgreSQL data as well, use `docker compose down -v`.

## Local development without Docker

Start PostgreSQL separately, then run the backend and frontend from two terminals.

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Set `POSTGRES_HOST=localhost` when the database is running outside Docker. The backend reads `.env` from its working directory, so run it from `backend` or provide the environment values through your shell/deployment platform.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

The Vite app uses `VITE_API_BASE_URL` when it is set; otherwise it targets `http://localhost:8000`.

Useful frontend commands:

```bash
npm run build
npm run preview
```

## Hunar webhooks and live calls

Hunar must be able to reach the backend from the public internet. A localhost URL is not reachable by Hunar and Hunar callback validation requires HTTPS. For local live-call testing, expose port 8000 through an HTTPS tunnel and set, for example:

```dotenv
PUBLIC_BASE_URL=https://your-tunnel.example
```

The backend sends callbacks to `POST /api/webhooks/hunar`. Set `HUNAR_WEBHOOK_SECRET` in shared environments to verify `X-Hunar-Signature` and `X-Hunar-Timestamp` headers. Signature verification is skipped when the secret is empty, which is intended only for local development.

Calls can still be created without a public callback URL, but their status and results will need to be synchronized through the API rather than received automatically.

## Provider configuration

`PEOPLE_SEARCH_PROVIDER` selects the source used by the candidate search flow:

- `sandbox`: deterministic local data; recommended for development and demos.
- `pdl`: People Data Labs integration; requires `PDL_API_KEY`.
- `apollo`, `proxycurl` and `coresignal`: configuration points exist for these providers, but their adapters may require additional implementation in `backend/app/services/people_search_client.py`.

Groq is used through its OpenAI-compatible chat and audio endpoints for job-description criteria extraction, candidate ranking and transcription. Keep `GROQ_MODEL` aligned with a model available to your account.

## Deployment

- **Backend and database:** `render.yaml` defines a Render web service and PostgreSQL database. Configure all secret values in Render; do not put them in the YAML file.
- **Frontend:** `vercel.json` contains the Vercel deployment configuration. Set `VITE_API_BASE_URL` to the deployed backend URL and configure the backend `BACKEND_CORS_ORIGINS` to include the deployed frontend origin.
- **Production callbacks:** set `PUBLIC_BASE_URL` to the deployed backend's HTTPS URL and configure the Hunar webhook URL accordingly.

## API surface

The exact request and response schemas are available from the running OpenAPI document at `/openapi.json`. Main API areas include:

- Roles and role stages
- Candidates and candidate details
- Call scripts and outbound calls
- Dashboard metrics
- Digital Twin personas, simulations and experiment history
- Application settings
- Hunar webhook ingestion

## Security and production notes

- Keep Hunar, Groq and people-search keys in environment variables only.
- Use a strong PostgreSQL password and a managed database in production.
- Set `HUNAR_WEBHOOK_SECRET` before accepting production callbacks.
- Replace startup `create_all` and compatibility SQL with versioned Alembic migrations as the schema evolves.
- Review call recording, transcript, candidate data and retention requirements before using the system with real applicants.
