"""Async Semantic Scholar API client — fallback source for citing papers."""

from __future__ import annotations

import asyncio
import logging

import aiohttp

logger = logging.getLogger(__name__)

S2_BASE = "https://api.semanticscholar.org/graph/v1"
MAX_RETRIES = 3
REQUEST_INTERVAL = 1.0  # S2 free tier: ~100 req / 5 min


class SemanticScholarClient:
    """Async client for the Semantic Scholar API."""

    def __init__(self, session: aiohttp.ClientSession):
        self._session = session
        self._last_request = 0.0

    async def _throttle(self):
        now = asyncio.get_event_loop().time()
        diff = REQUEST_INTERVAL - (now - self._last_request)
        if diff > 0:
            await asyncio.sleep(diff)
        self._last_request = asyncio.get_event_loop().time()

    async def _get(self, path: str, params: dict | None = None) -> dict | None:
        for attempt in range(MAX_RETRIES):
            await self._throttle()
            try:
                async with self._session.get(
                    f"{S2_BASE}{path}",
                    params=params,
                    timeout=aiohttp.ClientTimeout(total=30),
                ) as resp:
                    if resp.status == 200:
                        return await resp.json()
                    if resp.status == 429:
                        wait = 5 * (attempt + 1)
                        logger.warning("S2 速率限制, %ds 后重试", wait)
                        await asyncio.sleep(wait)
                        continue
                    if resp.status == 404:
                        return None
                    logger.warning("S2 HTTP %d: %s", resp.status, (await resp.text())[:200])
            except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                logger.warning("S2 请求失败: %s (第 %d 次)", e, attempt + 1)
                await asyncio.sleep(2 * (attempt + 1))
        return None

    async def search_paper(self, title: str, year: int | None = None) -> dict | None:
        """Search for a paper by title, return the best match with S2 paper ID."""
        data = await self._get("/paper/search", {
            "query": title,
            "limit": "5",
            "fields": "title,year,citationCount,externalIds",
        })
        if not data:
            return None

        needle = title.lower().strip()
        for p in data.get("data", []):
            hay = (p.get("title") or "").lower().strip()
            year_ok = not year or p.get("year") == year
            if (needle in hay or hay in needle) and year_ok:
                return p
        if data.get("data") and year:
            for p in data["data"]:
                if p.get("year") == year:
                    return p
        return data["data"][0] if data.get("data") else None

    async def get_citing_works(self, paper_id: str) -> list[dict]:
        """Get all papers citing the given paper. paper_id can be S2 ID, DOI:xxx, etc."""
        all_cites: list[dict] = []
        offset = 0
        limit = 500

        while True:
            data = await self._get(f"/paper/{paper_id}/citations", {
                "fields": "title,year,venue,externalIds,citationCount,authors",
                "offset": str(offset),
                "limit": str(limit),
            })
            if not data:
                break

            batch = data.get("data", [])
            if not batch:
                break

            for item in batch:
                citing = item.get("citingPaper", {})
                if not citing.get("title"):
                    continue

                ext_ids = citing.get("externalIds") or {}
                authors_raw = citing.get("authors") or []

                all_cites.append({
                    "id": ext_ids.get("DOI", "") or citing.get("paperId", ""),
                    "title": citing.get("title", ""),
                    "publication_year": citing.get("year"),
                    "doi": f"https://doi.org/{ext_ids['DOI']}" if ext_ids.get("DOI") else "",
                    "cited_by_count": citing.get("citationCount", 0),
                    "venue": citing.get("venue", ""),
                    "authorships": [
                        {"author_name": a.get("name", ""), "institutions": []}
                        for a in authors_raw
                    ],
                    "open_access": {"oa_url": None},
                    "primary_location": {"source_display_name": citing.get("venue", "")},
                    "_source": "semantic_scholar",
                })

            offset += len(batch)
            if len(batch) < limit:
                break

            logger.info("S2 引用分页: 已获取 %d 条", len(all_cites))

        return all_cites
