"""People-search provider integrations.

Supported providers:
- People Data Labs (PDL) - fully implemented (Person Search API).
- Apollo.io, Proxycurl, Coresignal - thin adapters with a clear TODO; add your
  API mapping once you have credentials/plan access. Each raises
  ``NotImplementedError`` with guidance until implemented.
"""
from typing import Any, Optional

import httpx

from ..config import get_settings
from .sandbox_data import search_sandbox_candidates

settings = get_settings()


class PeopleSearchError(RuntimeError):
    pass


class Person(dict):
    """Normalized person record: full_name, job_title, company, location,
    email, phone_number, linkedin_url, raw_data."""


def _normalize_pdl_record(r: dict[str, Any]) -> dict[str, Any]:
    phone = None
    if r.get("mobile_phone"):
        phone = r["mobile_phone"]
    elif r.get("phone_numbers"):
        phone = r["phone_numbers"][0]

    email = None
    if r.get("work_email"):
        email = r["work_email"]
    elif r.get("emails"):
        email = r["emails"][0] if isinstance(r["emails"][0], str) else r["emails"][0].get("address")

    return {
        "full_name": r.get("full_name") or f"{r.get('first_name', '')} {r.get('last_name', '')}".strip(),
        "job_title": r.get("job_title"),
        "company": r.get("job_company_name"),
        "location": r.get("location_name"),
        "email": email,
        "phone_number": phone,
        "linkedin_url": r.get("linkedin_url"),
        "source_provider": "pdl",
        "raw_data": r,
    }


async def search_pdl(
    job_title: str,
    required_skills: Optional[str],
    location: Optional[str],
    target_company: Optional[str],
    limit: int,
) -> list[dict[str, Any]]:
    if not settings.pdl_api_key:
        raise PeopleSearchError("PDL_API_KEY is not configured")

    must: list[dict[str, Any]] = []
    if job_title:
        must.append({"match": {"job_title": job_title}})
    if location:
        must.append({"match": {"location_name": location}})
    if target_company:
        must.append({"match": {"job_company_name": target_company}})

    should: list[dict[str, Any]] = []
    if required_skills:
        for skill in [s.strip() for s in required_skills.split(",") if s.strip()]:
            should.append({"match": {"skills": skill}})

    query: dict[str, Any] = {"bool": {"must": must}}
    if should:
        query["bool"]["should"] = should
        query["bool"]["minimum_should_match"] = 1

    body = {"query": query, "size": min(limit, 100)}

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.peopledatalabs.com/v5/person/search",
            headers={"X-Api-Key": settings.pdl_api_key, "Content-Type": "application/json"},
            json=body,
        )

    if resp.status_code >= 400:
        raise PeopleSearchError(f"PDL error {resp.status_code}: {resp.text}")

    data = resp.json()
    records = data.get("data", [])
    return [_normalize_pdl_record(r) for r in records]


def _normalize_apollo_record(r: dict[str, Any]) -> dict[str, Any]:
    phone = None
    if r.get("mobile_phone"):
        phone = r["mobile_phone"]
    elif r.get("sanitized_phone_number"):
        phone = r["sanitized_phone_number"]
    elif r.get("phone_number"):
        phone = r["phone_number"]
    elif r.get("corporate_phone"):
        phone = r["corporate_phone"]
    elif r.get("phone_numbers") and isinstance(r["phone_numbers"], list):
        # Prioritize mobile phone
        for p in r["phone_numbers"]:
            if isinstance(p, dict) and p.get("type") == "mobile":
                phone = p.get("sanitized_number") or p.get("raw_number") or p.get("number")
                if phone:
                    break
        if not phone and len(r["phone_numbers"]) > 0:
            first = r["phone_numbers"][0]
            if isinstance(first, dict):
                phone = first.get("sanitized_number") or first.get("raw_number") or first.get("number")
            elif isinstance(first, str):
                phone = first

    email = r.get("email") or r.get("sanitized_email")
    if not email and r.get("contact_emails") and isinstance(r["contact_emails"], list) and len(r["contact_emails"]) > 0:
        email = r["contact_emails"][0]

    company = None
    if isinstance(r.get("organization"), dict):
        company = r["organization"].get("name")
    elif r.get("organization_name"):
        company = r["organization_name"]
    elif r.get("company"):
        company = r["company"]

    loc_parts = [p for p in [r.get("city"), r.get("state"), r.get("country")] if p]
    location = ", ".join(loc_parts) if loc_parts else (r.get("formatted_address") or r.get("location"))

    full_name = r.get("name")
    if not full_name:
        parts = [p for p in [r.get("first_name"), r.get("last_name")] if p]
        full_name = " ".join(parts) if parts else "Unknown"

    return {
        "full_name": full_name,
        "job_title": r.get("title") or r.get("headline"),
        "company": company,
        "location": location,
        "email": email,
        "phone_number": phone,
        "linkedin_url": r.get("linkedin_url"),
        "source_provider": "apollo",
        "raw_data": r,
    }


async def search_apollo(
    job_title: str,
    required_skills: Optional[str],
    location: Optional[str],
    target_company: Optional[str],
    limit: int,
) -> list[dict[str, Any]]:
    if not settings.apollo_api_key:
        raise PeopleSearchError("APOLLO_API_KEY is not configured")

    params: list[tuple[str, str]] = [
        ("api_key", settings.apollo_api_key),
        ("per_page", str(min(limit, 100))),
        ("page", "1"),
    ]
    if job_title:
        params.append(("person_titles[]", job_title))
    if location:
        params.append(("person_locations[]", location))
    if target_company:
        params.append(("q_organization_domains", target_company))
    if required_skills:
        params.append(("q_keywords", required_skills))

    headers = {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": settings.apollo_api_key,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.apollo.io/api/v1/mixed_people/search",
            params=params,
            headers=headers,
        )

    if resp.status_code >= 400:
        raise PeopleSearchError(f"Apollo error {resp.status_code}: {resp.text}")

    data = resp.json()
    records = data.get("people") or data.get("contacts") or []
    return [_normalize_apollo_record(r) for r in records]


PROVIDERS = {
    "sandbox": search_sandbox_candidates,
    "apollo": search_apollo,
    "pdl": search_pdl,
}


async def search_people(
    provider: Optional[str],
    job_title: str,
    required_skills: Optional[str],
    location: Optional[str],
    target_company: Optional[str],
    limit: int,
) -> list[dict[str, Any]]:
    provider_name = (provider or settings.people_search_provider or "sandbox").lower()
    fn = PROVIDERS.get(provider_name)
    if not fn:
        raise PeopleSearchError(f"Unknown or unsupported provider '{provider_name}'. Supported providers: sandbox, apollo, pdl")
    return await fn(job_title, required_skills, location, target_company, limit)

