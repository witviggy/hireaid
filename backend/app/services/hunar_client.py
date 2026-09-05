"""Thin client around the Hunar Voice Agents API.

Docs: https://api.voice.hunar.ai/docs/external/
"""
from typing import Any, Optional

import httpx

from ..config import get_settings

settings = get_settings()


class HunarAPIError(RuntimeError):
    def __init__(self, status_code: int, message: str, details: Any = None):
        super().__init__(f"Hunar API error {status_code}: {message}")
        self.status_code = status_code
        self.message = message
        self.details = details


class HunarClient:
    def __init__(self) -> None:
        self.base_url = settings.hunar_api_base_url.rstrip("/")
        self.headers = {
            "X-API-Key": settings.hunar_api_key,
            "Content-Type": "application/json",
        }

    async def _request(self, method: str, path: str, **kwargs) -> Any:
        url = f"{self.base_url}{path}"
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.request(method, url, headers=self.headers, **kwargs)
        if resp.status_code >= 400:
            try:
                body = resp.json()
            except ValueError:
                body = {"message": resp.text}
            raise HunarAPIError(resp.status_code, body.get("message", resp.text), body.get("details"))
        if resp.status_code == 204 or not resp.content:
            return None
        return resp.json()

    # ---- Agents ----

    async def list_agents(self, page: int = 1, page_size: int = 20) -> dict:
        return await self._request(
            "GET", "/agents/", params={"page": page, "page_size": page_size}
        )

    async def get_agent(self, agent_id: str) -> dict:
        return await self._request("GET", f"/agents/{agent_id}/")

    async def create_agent(self, payload: dict[str, Any]) -> dict:
        return await self._request("POST", "/agents/", json=payload)

    async def update_agent(self, agent_id: str, payload: dict[str, Any]) -> dict:
        return await self._request("PUT", f"/agents/{agent_id}/", json=payload)

    # ---- Calls ----

    def build_callback_config(self) -> Optional[dict[str, str]]:
        base = settings.public_base_url.rstrip("/")
        # Hunar rejects non-HTTPS callback URLs; skip webhooks until a public HTTPS URL (e.g. ngrok) is configured.
        if not base.startswith("https://"):
            return None
        webhook_url = f"{base}/api/webhooks/hunar"
        return {
            "call_status_callback_url": webhook_url,
            "call_recording_callback_url": webhook_url,
            "call_result_callback_url": webhook_url,
            "call_summary_callback_url": webhook_url,
        }

    async def create_call(
        self,
        agent_id: str,
        callee_name: str,
        mobile_number: str,
        custom_data: Optional[dict[str, Any]] = None,
        request_id: Optional[str] = None,
    ) -> dict:
        payload: dict[str, Any] = {
            "agent_id": agent_id,
            "callee_name": callee_name,
            "mobile_number": mobile_number,
            "custom_data": custom_data or {},
        }
        callback_config = self.build_callback_config()
        if callback_config:
            payload["callback_config"] = callback_config
        if request_id:
            payload["request_id"] = request_id
        return await self._request("POST", "/calls/", json=payload)

    async def get_call(self, call_id: str) -> dict:
        return await self._request("GET", f"/calls/{call_id}/")

    async def list_calls(self, **params) -> dict:
        return await self._request("GET", "/calls/", params=params)
