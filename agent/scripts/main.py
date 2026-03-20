"""Main entry point for citation impact analysis.

Usage: python main.py --config path/to/config.yaml
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from datetime import datetime
from pathlib import Path

import aiohttp

from config_parser import load_config
from openalex_client import OpenAlexClient
from semantic_scholar_client import SemanticScholarClient
from ccf_lookup import CCFLookup
from pdf_processor import download_pdf, extract_text, extract_first_pages
from citation_extractor import find_citation_contexts
from report_generator import generate_report

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


def _sanitize_dirname(title: str) -> str:
    """Create a safe directory name from a paper title."""
    safe = "".join(c if c.isalnum() or c in " _-" else "_" for c in title)
    return safe.strip()[:80] or "paper"


def _apply_filters(citations: list[dict], config: dict, ccf: CCFLookup) -> list[dict]:
    """Apply configured filters to citing works and annotate with CCF rank."""
    filters = config.get("filters", {})
    result = []

    for c in citations:
        c["ccf_rank"] = ccf.lookup(c.get("venue", ""))

        if "ccf_rankings" in filters and filters["ccf_rankings"]:
            required = set(filters["ccf_rankings"])
            if c["ccf_rank"] not in required:
                continue

        yr = c.get("publication_year")
        if "year_range" in filters:
            yr_filter = filters["year_range"]
            if yr and "start" in yr_filter and yr < yr_filter["start"]:
                continue
            if yr and "end" in yr_filter and yr > yr_filter["end"]:
                continue

        if "authors" in filters and filters["authors"]:
            target_authors = {a.lower() for a in filters["authors"]}
            citing_authors = {
                auth.get("author_name", "").lower()
                for auth in c.get("authorships", [])
            }
            if not target_authors & citing_authors:
                continue

        if "affiliations" in filters and filters["affiliations"]:
            target_affils = {a.lower() for a in filters["affiliations"]}
            citing_affils = set()
            for auth in c.get("authorships", []):
                for inst in auth.get("institutions", []):
                    citing_affils.add(inst.lower())
            if not target_affils & citing_affils:
                continue

        result.append(c)

    return result


# ---------------------------------------------------------------------------
# v1.0 processing (legacy: fetches citing papers from APIs)
# ---------------------------------------------------------------------------

async def _process_paper_v1(
    paper_cfg: dict,
    client: OpenAlexClient,
    s2_client: SemanticScholarClient,
    ccf: CCFLookup,
    config: dict,
    output_dir: Path,
    session: aiohttp.ClientSession,
) -> dict:
    """Process a single target paper (v1.0): fetch citations, filter, download PDFs, extract contexts."""

    paper_id = paper_cfg.get("openalex_id") or paper_cfg.get("doi") or paper_cfg.get("title")
    print(f"\n{'='*60}")
    print(f"  Processing: {paper_id}")
    print(f"{'='*60}")

    if paper_cfg.get("openalex_id"):
        target = await client.get_work_details(paper_cfg["openalex_id"])
    elif paper_cfg.get("doi"):
        target = await client.get_work_details(f"https://doi.org/{paper_cfg['doi']}")
    else:
        target = {"title": paper_cfg.get("title", "未知"), "id": "", "doi": ""}

    title = target.get("title", "未知论文")
    print(f"  Title: {title}")
    print(f"  Cited by: {target.get('cited_by_count', 0)}")

    paper_dir = output_dir / _sanitize_dirname(title)
    paper_dir.mkdir(parents=True, exist_ok=True)
    pdf_dir = paper_dir / "pdfs"
    pdf_dir.mkdir(exist_ok=True)

    work_id = target.get("id", "").split("/")[-1] if target.get("id") else None
    if not work_id and paper_cfg.get("openalex_id"):
        work_id = paper_cfg["openalex_id"]

    all_citations: list[dict] = []
    source_used = "none"

    if work_id:
        print(f"  Fetching citing papers (OpenAlex ID: {work_id})...")
        all_citations = await client.get_citing_works(work_id)
        source_used = "openalex"

    if not all_citations:
        doi = paper_cfg.get("doi") or target.get("doi", "")
        s2_query = f"DOI:{doi.split('doi.org/')[-1]}" if "doi.org/" in doi or (doi and "/" in doi) else None

        if not s2_query:
            s2_paper = await s2_client.search_paper(
                paper_cfg.get("title", title),
                paper_cfg.get("year"),
            )
            if s2_paper:
                s2_query = s2_paper.get("paperId")
                ext = s2_paper.get("externalIds") or {}
                if ext.get("DOI"):
                    s2_query = f"DOI:{ext['DOI']}"
                print(f"  Semantic Scholar found: {s2_paper.get('title', '')[:60]}")

        if s2_query:
            print(f"  Fetching citing papers (Semantic Scholar: {s2_query})...")
            all_citations = await s2_client.get_citing_works(s2_query)
            source_used = "semantic_scholar"

    if not all_citations:
        print("  Warning: No citing papers found from either source")

    print(f"  Found {len(all_citations)} citing papers (source: {source_used})")

    citing_path = paper_dir / "citing_papers.json"
    with open(citing_path, "w", encoding="utf-8") as f:
        json.dump(all_citations, f, ensure_ascii=False, indent=2)

    filtered = _apply_filters(all_citations, config, ccf)
    print(f"  After filtering: {len(filtered)} papers match criteria")

    filtered_path = paper_dir / "filtered_citations.json"
    with open(filtered_path, "w", encoding="utf-8") as f:
        json.dump(filtered, f, ensure_ascii=False, indent=2)

    if config.get("download_pdfs", True) and filtered:
        await _download_and_extract(
            filtered,
            target,
            pdf_dir,
            session,
            pdf_concurrency=config.get("pdf_download_concurrency", 1),
            pdf_delay_seconds=config.get("pdf_download_delay_seconds", 1.5),
            pdf_pause_between_sources=config.get("pdf_pause_between_sources_seconds", 0.75),
        )
    else:
        for c in filtered:
            c["citation_contexts"] = []

    for c in filtered:
        c.pop("_pdf_path", None)

    summary = {
        "target_paper": target,
        "total_citing": len(all_citations),
        "filtered_count": len(filtered),
        "filtered_citations": filtered,
        "processed_at": datetime.now().isoformat(),
    }
    summary_path = paper_dir / "summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print(f"  Done! Results saved to: {paper_dir}")
    return summary


# ---------------------------------------------------------------------------
# v2.0 processing (pre-built citing paper lists from web UI)
# ---------------------------------------------------------------------------

PDF_ROOT_FOLDER = "citation_pdfs"


def _v2_citing_to_standard(cp: dict) -> dict:
    """Convert a v2.0 citing paper dict to the standard format for report generation."""
    authors_str = cp.get("authors", "")
    authorships = []
    if authors_str:
        for name in authors_str.split(", "):
            name = name.strip()
            if name:
                authorships.append({"author_name": name, "institutions": []})
    return {
        "id": cp.get("openalex_id", ""),
        "title": cp.get("title", ""),
        "publication_year": cp.get("year"),
        "doi": cp.get("doi", ""),
        "venue": cp.get("venue", ""),
        "ccf_rank": cp.get("ccf_rank", ""),
        "authorships": authorships,
        "pdf_source": cp.get("pdf_source", "unknown"),
        "pdf_folder": cp.get("pdf_folder", ""),
        "citation_contexts": [],
    }


def _find_local_pdf(folder: Path) -> str | None:
    """Find any PDF file inside the given folder."""
    if not folder.is_dir():
        return None
    pdfs = list(folder.glob("*.pdf"))
    if pdfs:
        return str(pdfs[0])
    return None


async def _process_paper_v2(
    target_cfg: dict,
    pdf_root: Path | None,
    output_dir: Path,
    session: aiohttp.ClientSession,
    researcher_name: str = "",
    *,
    pdf_concurrency: int = 1,
    pdf_delay_seconds: float = 1.5,
    pdf_pause_between_sources: float = 0.75,
) -> dict:
    """Process a single target paper (v2.0): uses pre-built citing paper list.

    PDF structure:  <pdf_root>/<pdf_folder>/  — one folder per citing paper.
    The agent creates folders, downloads OA PDFs into them, and looks for
    user-placed PDFs in folders for non-OA papers.
    """

    title = target_cfg.get("title", "未知论文")
    print(f"\n{'='*60}")
    print(f"  Processing: {title}")
    print(f"{'='*60}")

    citing_papers_raw = target_cfg.get("citing_papers", [])
    citations = [_v2_citing_to_standard(cp) for cp in citing_papers_raw]
    print(f"  Pre-selected citing papers: {len(citations)}")

    paper_dir = output_dir / _sanitize_dirname(title)
    paper_dir.mkdir(parents=True, exist_ok=True)

    authorships = []
    if researcher_name:
        for name in researcher_name.split(","):
            name = name.strip()
            if name:
                clean = name.split("(")[0].split("（")[0].strip()
                authorships.append({"author_name": clean, "institutions": []})

    target = {
        "title": title,
        "id": target_cfg.get("openalex_id", ""),
        "doi": target_cfg.get("doi", ""),
        "publication_year": target_cfg.get("year"),
        "cited_by_count": len(citations),
        "venue": "",
        "authorships": authorships,
    }

    if citations and pdf_root:
        pdf_root.mkdir(parents=True, exist_ok=True)
        for c in citations:
            folder_name = c.get("pdf_folder", "") or _sanitize_dirname(c.get("title", "unknown"))
            folder = pdf_root / folder_name
            folder.mkdir(parents=True, exist_ok=True)
            c["_pdf_dir"] = str(folder)

        print(f"  Created {len(citations)} paper folders under {pdf_root}")
        print(
            f"  Downloading OA PDFs / checking local folders "
            f"(concurrency={pdf_concurrency}, delay={pdf_delay_seconds}s between remote downloads)..."
        )
        sem = asyncio.Semaphore(pdf_concurrency)

        async def _download_one(citation: dict) -> tuple[dict, bool]:
            async with sem:
                folder = Path(citation["_pdf_dir"])

                local = _find_local_pdf(folder)
                if local:
                    citation["_pdf_path"] = local
                    return citation, True

                if pdf_delay_seconds > 0:
                    await asyncio.sleep(pdf_delay_seconds)

                save_path = str(folder / "paper.pdf")
                ok = await download_pdf(
                    session,
                    citation,
                    save_path,
                    pause_between_sources_seconds=pdf_pause_between_sources,
                )
                if ok:
                    citation["_pdf_path"] = save_path
                return citation, ok

        tasks = [_download_one(c) for c in citations]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        downloaded = 0
        missing_folders: list[str] = []
        for res in results:
            if isinstance(res, Exception):
                logger.error("PDF download error: %s", res)
                continue
            citation, ok = res
            if ok:
                downloaded += 1
            else:
                missing_folders.append(citation.get("_pdf_dir", ""))
        print(f"  Downloaded/found {downloaded}/{len(citations)} PDFs")

        if missing_folders:
            print(f"\n  ⚠ {len(missing_folders)} papers need manual PDF download.")
            print(f"  Place the PDF file into the corresponding folder:")
            for f in missing_folders[:10]:
                print(f"    → {f}")
            if len(missing_folders) > 10:
                print(f"    ... and {len(missing_folders) - 10} more")
            print()

        print("  Extracting text and finding citation contexts...")
        for citation in citations:
            pdf_path = citation.get("_pdf_path")
            if not pdf_path or not Path(pdf_path).exists():
                citation["citation_contexts"] = []
                citation["first_pages_text"] = ""
                continue
            try:
                text = extract_text(pdf_path)
                contexts = find_citation_contexts(text, target)
                citation["citation_contexts"] = contexts
                citation["first_pages_text"] = extract_first_pages(pdf_path, 2)
                if contexts:
                    print(f"    Found {len(contexts)} context(s): {citation.get('title', '?')[:50]}...")
            except Exception as e:
                logger.error("Text extraction failed: %s", e)
                citation["citation_contexts"] = []
                citation["first_pages_text"] = ""

    for c in citations:
        c.pop("_pdf_path", None)
        c.pop("_pdf_dir", None)

    summary = {
        "target_paper": target,
        "total_citing": len(citations),
        "filtered_count": len(citations),
        "filtered_citations": citations,
        "processed_at": datetime.now().isoformat(),
    }
    summary_path = paper_dir / "summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print(f"  Done! Results saved to: {paper_dir}")
    return summary


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

async def _download_and_extract(
    filtered: list[dict],
    target: dict,
    pdf_dir: Path,
    session: aiohttp.ClientSession,
    *,
    pdf_concurrency: int = 1,
    pdf_delay_seconds: float = 1.5,
    pdf_pause_between_sources: float = 0.75,
) -> None:
    """Download PDFs and extract citation contexts for filtered papers."""
    print(
        f"  Downloading PDFs (concurrency={pdf_concurrency}, "
        f"delay={pdf_delay_seconds}s between remote downloads)..."
    )
    sem = asyncio.Semaphore(pdf_concurrency)

    async def _download_one(citation: dict) -> tuple[dict, bool, str]:
        async with sem:
            if pdf_delay_seconds > 0:
                await asyncio.sleep(pdf_delay_seconds)
            doi = citation.get("doi", "")
            doi_id = doi.split("doi.org/")[-1] if "doi.org/" in doi else doi
            safe_name = doi_id.replace("/", "_") if doi_id else citation.get("id", "unknown").split("/")[-1]
            pdf_path = str(pdf_dir / f"{safe_name}.pdf")
            ok = await download_pdf(
                session,
                citation,
                pdf_path,
                pause_between_sources_seconds=pdf_pause_between_sources,
            )
            return citation, ok, pdf_path

    tasks = [_download_one(c) for c in filtered]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    downloaded = 0
    for res in results:
        if isinstance(res, Exception):
            logger.error("PDF download error: %s", res)
            continue
        citation, ok, pdf_path = res
        if ok:
            downloaded += 1
            citation["_pdf_path"] = pdf_path
    print(f"  Downloaded {downloaded}/{len(filtered)} PDFs")

    print("  Extracting text and finding citation contexts...")
    for citation in filtered:
        pdf_path = citation.get("_pdf_path")
        if not pdf_path or not Path(pdf_path).exists():
            citation["citation_contexts"] = []
            citation["first_pages_text"] = ""
            continue
        try:
            text = extract_text(pdf_path)
            contexts = find_citation_contexts(text, target)
            citation["citation_contexts"] = contexts
            citation["first_pages_text"] = extract_first_pages(pdf_path, 2)
            if contexts:
                print(f"    Found {len(contexts)} context(s): {citation.get('title', '?')[:50]}...")
        except Exception as e:
            logger.error("Text extraction failed: %s", e)
            citation["citation_contexts"] = []


# ---------------------------------------------------------------------------
# Entry points
# ---------------------------------------------------------------------------

async def run(config_path: str):
    """Main async entry point."""
    print("=" * 60)
    print("  Citation Impact Analysis Tool")
    print("=" * 60)

    config = load_config(config_path)
    version = config.get("version", "1.0")
    print(f"\n  Config version: {version}")
    print(f"  Researcher: {config.get('researcher_name', 'N/A')}")

    output_dir = Path(config.get("output_dir", "./citation_output"))
    output_dir.mkdir(parents=True, exist_ok=True)
    print(f"  Output directory: {output_dir.resolve()}")

    if version == "2.0":
        target_papers = config.get("target_papers", [])
        print(f"  Target papers: {len(target_papers)}")
        total_citing = sum(len(tp.get("citing_papers", [])) for tp in target_papers)
        print(f"  Total pre-selected citing papers: {total_citing}")

        # 空或不设时使用当前目录，使 citation_pdfs 位于工作区根目录，避免误用子目录名（如 test-run）导致路径错位
        pdf_dir_str = config.get("pdf_dir", "") or "."
        pdf_root = Path(pdf_dir_str).resolve() / PDF_ROOT_FOLDER
        print(f"  PDF root: {pdf_root}")
        print(
            f"  PDF download policy: concurrency={config.get('pdf_download_concurrency', 1)}, "
            f"inter-download delay={config.get('pdf_download_delay_seconds', 1.5)}s"
        )

        researcher_name = config.get("researcher_name", "")

        async with aiohttp.ClientSession() as session:
            tasks = [
                _process_paper_v2(
                    tp,
                    pdf_root,
                    output_dir,
                    session,
                    researcher_name,
                    pdf_concurrency=config.get("pdf_download_concurrency", 1),
                    pdf_delay_seconds=config.get("pdf_download_delay_seconds", 1.5),
                    pdf_pause_between_sources=config.get("pdf_pause_between_sources_seconds", 0.75),
                )
                for tp in target_papers
            ]
            summaries = await asyncio.gather(*tasks, return_exceptions=True)
    else:
        papers = config.get("papers", [])
        print(f"  Papers to analyze: {len(papers)}")
        print(f"  Filters: {json.dumps(config.get('filters', {}), ensure_ascii=False)}")

        ccf = CCFLookup()
        async with aiohttp.ClientSession() as session:
            async with OpenAlexClient(session) as client:
                s2_client = SemanticScholarClient(session)
                tasks = [
                    _process_paper_v1(paper, client, s2_client, ccf, config, output_dir, session)
                    for paper in papers
                ]
                summaries = await asyncio.gather(*tasks, return_exceptions=True)

    errors = [s for s in summaries if isinstance(s, Exception)]
    successes = [s for s in summaries if not isinstance(s, Exception)]

    if errors:
        print(f"\n  {len(errors)} paper(s) failed:")
        for e in errors:
            print(f"    - {e}")

    report_path = generate_report(str(output_dir), config)

    print(f"\n{'='*60}")
    print("  Analysis Complete!")
    print(f"{'='*60}")
    print(f"  Processed: {len(successes)} papers")
    print(f"  Failed: {len(errors)} papers")
    total_filtered = sum(s.get("filtered_count", 0) for s in successes)
    print(f"  Total citing papers analyzed: {total_filtered}")
    print(f"  Report: {report_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Citation Impact Analysis Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Example: python main.py --config config.yaml",
    )
    parser.add_argument(
        "--config", "-c",
        required=True,
        help="YAML configuration file path",
    )
    args = parser.parse_args()
    asyncio.run(run(args.config))


if __name__ == "__main__":
    main()
