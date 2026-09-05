from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    postgres_user: str = "voice_app"
    postgres_password: str = "change_me"
    postgres_db: str = "voice_app"
    postgres_host: str = "db"
    postgres_port: int = 5432

    database_url: str | None = None

    backend_cors_origins: str = "http://localhost:5173"
    public_base_url: str = "http://localhost:8000"

    hunar_api_key: str = ""
    hunar_api_base_url: str = "https://api.voice.hunar.ai/external/v1"
    hunar_hiring_agent_id: str = ""
    hunar_reachout_agent_id: str = ""
    hunar_webhook_secret: str = ""

    people_search_provider: str = "pdl"
    pdl_api_key: str = ""
    apollo_api_key: str = ""
    proxycurl_api_key: str = ""
    coresignal_api_key: str = ""

    # LLM used for JD-criteria extraction and candidate ranking (Groq, OpenAI-compatible API)
    groq_api_key: str = ""
    groq_model: str = "qwen/qwen3.8-27b"
    groq_api_base_url: str = "https://api.groq.com/openai/v1"

    @property
    def effective_database_url(self) -> str:
        if self.database_url and self.database_url.strip():
            url = self.database_url.strip()
            # Render / Heroku compatibility: convert postgres:// to postgresql://
            if url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql://", 1)
            # Ensure psycopg2 driver if dialect is plain postgresql://
            if url.startswith("postgresql://") and not url.startswith("postgresql+"):
                url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
            return url
        return (
            f"postgresql+psycopg2://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.backend_cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
