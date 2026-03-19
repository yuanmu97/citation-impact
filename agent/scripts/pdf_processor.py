"""Async PDF download from multiple sources and text extraction via PyMuPDF."""

from __future__ import annotations

import logging
import re
from pathlib import Path

import aiohttp
import fitz  # PyMuPDF

logger = logging.getLogger(__name__)

DOWNLOAD_TIMEOUT = aiohttp.ClientTimeout(total=60)
HEADERS = {
    "User-Agent": "CitationImpactBot/1.0 (mailto:citation-impact@example.com)",
    "Accept": "application/pdf",
}


async def _try_download(session: aiohttp.ClientSession, url: str, save_path: str) -> bool:
    """Attempt to download a PDF from the given URL."""
    try:
        async with session.get(url, headers=HEADERS, timeout=DOWNLOAD_TIMEOUT, allow_redirects=True) as resp:
            if resp.status != 200:
                return False
            content_type = resp.headers.get("Content-Type", "")
            data = await resp.read()
            if len(data) < 1024:
                return False
            if not data[:5] == b"%PDF-" and "pdf" not in content_type.lower():
                return False
            Path(save_path).parent.mkdir(parents=True, exist_ok=True)
            with open(save_path, "wb") as f:
                f.write(data)
            return True
    except (aiohttp.ClientError, TimeoutError, Exception) as e:
        logger.debug("下载失败 (%s): %s", url, e)
        return False


def _extract_doi_id(doi: str) -> str | None:
    """Extract the DOI identifier from a full DOI URL or string."""
    if not doi:
        return None
    match = re.search(r"(10\.\d{4,}/[^\s]+)", doi)
    return match.group(1) if match else None


async def download_pdf(
    session: aiohttp.ClientSession, work: dict, save_path: str
) -> bool:
    """Try multiple sources to download a PDF for the given work.

    Sources tried in order:
      1. Open access URL from OpenAlex
      2. DOI redirect (https://doi.org/{doi})
      3. Unpaywall API

    Args:
        session: Active aiohttp session.
        work: Work dict with open_access.oa_url, doi fields.
        save_path: Local path to save the PDF.

    Returns:
        True if download succeeded, False otherwise.
    """
    oa_url = (work.get("open_access") or {}).get("oa_url")
    if oa_url:
        logger.info("尝试 OA 链接: %s", oa_url)
        if await _try_download(session, oa_url, save_path):
            logger.info("通过 OA 链接下载成功")
            return True

    doi = work.get("doi", "")
    doi_id = _extract_doi_id(doi)

    if doi_id:
        doi_url = f"https://doi.org/{doi_id}"
        logger.info("尝试 DOI 重定向: %s", doi_url)
        if await _try_download(session, doi_url, save_path):
            logger.info("通过 DOI 重定向下载成功")
            return True

    if doi_id:
        unpaywall_url = f"https://api.unpaywall.org/v2/{doi_id}?email=citation-impact@example.com"
        try:
            async with session.get(unpaywall_url, timeout=DOWNLOAD_TIMEOUT) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    best_oa = data.get("best_oa_location") or {}
                    pdf_url = best_oa.get("url_for_pdf") or best_oa.get("url")
                    if pdf_url:
                        logger.info("尝试 Unpaywall: %s", pdf_url)
                        if await _try_download(session, pdf_url, save_path):
                            logger.info("通过 Unpaywall 下载成功")
                            return True
        except Exception as e:
            logger.debug("Unpaywall 查询失败: %s", e)

    logger.warning("所有下载源均失败: %s", work.get("title", "未知"))
    return False


def _dehyphenate(text: str) -> str:
    """Rejoin words broken by end-of-line hyphens (e.g. 'multi-\\nstream' → 'multi-stream')."""
    return re.sub(r"(\w)-\n(\w)", r"\1-\2", text)


def _clean_extracted_text(text: str) -> str:
    """Normalize whitespace and fix common PDF extraction artefacts."""
    text = _dehyphenate(text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text


def extract_first_pages(pdf_path: str, n: int = 2) -> str:
    """Extract text from the first N pages (for author/affiliation info)."""
    doc = fitz.open(pdf_path)
    pages = []
    for i in range(min(n, len(doc))):
        pages.append(doc[i].get_text("text", sort=True))
    doc.close()
    return _clean_extracted_text("\n".join(pages))


def extract_text(pdf_path: str) -> str:
    """Extract text content from a PDF file using PyMuPDF.

    Uses sort=True for proper reading order in multi-column layouts (e.g. IEEE two-column).
    Falls back to default extraction if sort produces shorter output.

    Args:
        pdf_path: Path to the PDF file.

    Returns:
        Extracted text with page markers.
    """
    doc = fitz.open(pdf_path)
    pages = []
    for page_num in range(len(doc)):
        page = doc[page_num]
        text_sorted = page.get_text("text", sort=True)
        text_default = page.get_text("text")
        text = text_sorted if len(text_sorted) >= len(text_default) * 0.8 else text_default
        pages.append(f"\n--- Page {page_num + 1} ---\n{text}")
    doc.close()
    full = "".join(pages)
    return _clean_extracted_text(full)
