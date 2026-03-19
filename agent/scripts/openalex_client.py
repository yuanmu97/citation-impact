"""Async OpenAlex API client with rate limiting, pagination, and retry logic."""

from __future__ import annotations

import asyncio
import logging

import aiohttp

logger = logging.getLogger(__name__)

BASE_URL = "https://api.openalex.org"
MAILTO = "citation-impact@example.com"
MAX_CONCURRENT = 10
MAX_RETRIES = 3
BACKOFF_BASE = 1.5


class OpenAlexClient:
    """Async client for the OpenAlex API."""

    def __init__(self, session: aiohttp.ClientSession | None = None):
        self._external_session = session is not None
        self._session = session
        self._semaphore = asyncio.Semaphore(MAX_CONCURRENT)

    async def __aenter__(self):
        if self._session is None:
            self._session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if not self._external_session and self._session:
            await self._session.close()
            self._session = None

    def _build_params(self, extra: dict | None = None) -> dict:
        params = {"mailto": MAILTO}
        if extra:
            params.update(extra)
        return params

    async def _request_with_retry(self, url: str, params: dict) -> dict:
        """Execute a GET request with retry and exponential backoff."""
        last_exc = None
        for attempt in range(MAX_RETRIES):
            async with self._semaphore:
                try:
                    async with self._session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                        if resp.status == 200:
                            return await resp.json()
                        if resp.status == 429:
                            wait = BACKOFF_BASE ** (attempt + 1)
                            logger.warning("速率限制，%s 秒后重试 (第 %d 次)", wait, attempt + 1)
                            await asyncio.sleep(wait)
                            continue
                        if resp.status >= 500:
                            wait = BACKOFF_BASE ** (attempt + 1)
                            logger.warning("服务器错误 %d，%s 秒后重试", resp.status, wait)
                            await asyncio.sleep(wait)
                            continue
                        body = await resp.text()
                        raise aiohttp.ClientResponseError(
                            resp.request_info,
                            resp.history,
                            status=resp.status,
                            message=f"HTTP {resp.status}: {body[:200]}",
                        )
                except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                    last_exc = e
                    wait = BACKOFF_BASE ** (attempt + 1)
                    logger.warning("请求失败: %s，%s 秒后重试 (第 %d 次)", e, wait, attempt + 1)
                    await asyncio.sleep(wait)

        raise last_exc or RuntimeError("请求失败，已耗尽重试次数")

    @staticmethod
    def _extract_work(raw: dict) -> dict:
        """Extract relevant fields from a raw OpenAlex work object."""
        primary_loc = raw.get("primary_location") or {}
        source = primary_loc.get("source") or {}

        authorships = []
        for authorship in raw.get("authorships", []):
            author = authorship.get("author") or {}
            institutions = [
                inst.get("display_name", "")
                for inst in authorship.get("institutions", [])
                if inst.get("display_name")
            ]
            authorships.append({
                "author_name": author.get("display_name", ""),
                "institutions": institutions,
            })

        oa = raw.get("open_access") or {}

        return {
            "id": raw.get("id", ""),
            "title": raw.get("title", ""),
            "publication_year": raw.get("publication_year"),
            "doi": raw.get("doi", ""),
            "cited_by_count": raw.get("cited_by_count", 0),
            "venue": source.get("display_name", ""),
            "primary_location": {
                "source_display_name": source.get("display_name", ""),
            },
            "authorships": authorships,
            "open_access": {
                "oa_url": oa.get("oa_url"),
            },
        }

    async def get_work_details(self, work_id: str) -> dict:
        """Fetch details for a single work by OpenAlex ID or DOI.

        Args:
            work_id: OpenAlex work ID (e.g., "W2741809807") or a full URL/DOI.
        """
        if work_id.startswith("https://"):
            url = work_id
        else:
            url = f"{BASE_URL}/works/{work_id}"
        params = self._build_params()
        data = await self._request_with_retry(url, params)
        return self._extract_work(data)

    async def get_citing_works(self, work_id: str) -> list[dict]:
        """Fetch all works that cite the given work, with cursor pagination.

        Args:
            work_id: OpenAlex work ID (e.g., "W2741809807").
        """
        all_works = []
        cursor = "*"
        page_count = 0

        while cursor:
            params = self._build_params({
                "filter": f"cites:{work_id}",
                "per_page": "100",
                "cursor": cursor,
            })
            url = f"{BASE_URL}/works"
            data = await self._request_with_retry(url, params)

            results = data.get("results", [])
            for raw in results:
                all_works.append(self._extract_work(raw))

            page_count += 1
            meta = data.get("meta", {})
            cursor = meta.get("next_cursor")

            if not results:
                break

            logger.info(
                "分页 %d: 获取 %d 条引用 (累计 %d / %d)",
                page_count,
                len(results),
                len(all_works),
                meta.get("count", "?"),
            )

        return all_works
