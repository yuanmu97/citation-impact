"""Parse and validate YAML configuration files for citation impact analysis."""
from __future__ import annotations

from pathlib import Path

import yaml


def _default_pdf_options(options: dict) -> dict:
    """Conservative defaults: many publishers (ACM DL, IEEE, etc.) rate-limit by IP."""
    return {
        "pdf_download_concurrency": max(1, int(options.get("pdf_download_concurrency", 1))),
        "pdf_download_delay_seconds": max(0.0, float(options.get("pdf_download_delay_seconds", 1.5))),
        "pdf_pause_between_sources_seconds": max(
            0.0, float(options.get("pdf_pause_between_sources_seconds", 0.75))
        ),
    }


def _parse_v1(raw: dict) -> dict:
    """Parse legacy v1.0 config format."""
    if "papers" not in raw or not isinstance(raw["papers"], list) or not raw["papers"]:
        raise ValueError("配置文件中 papers 必须是非空列表")

    papers = []
    for i, p in enumerate(raw["papers"]):
        if not isinstance(p, dict):
            raise ValueError(f"papers[{i}] 必须是字典")
        oa_id = p.get("id", "") or p.get("openalex_id", "")
        if not oa_id and not p.get("doi") and not p.get("title"):
            raise ValueError(f"papers[{i}] 至少需要 id、doi 或 title 之一")
        papers.append({
            "openalex_id": oa_id,
            "title": p.get("title", ""),
            "year": p.get("year"),
            "venue": p.get("venue", ""),
            "doi": p.get("doi", ""),
        })

    raw_filters = raw.get("filters") or {}
    venue_rankings_raw = raw_filters.get("venue_rankings", []) or []
    ccf_rankings = []
    for v in venue_rankings_raw:
        rank = v.replace("CCF-", "").strip().upper() if isinstance(v, str) else str(v)
        if rank in ("A", "B", "C"):
            ccf_rankings.append(rank)

    year_range = raw_filters.get("year_range") or {}
    yr_from = year_range.get("from") or year_range.get("start")
    yr_to = year_range.get("to") or year_range.get("end")

    filters = {
        "ccf_rankings": ccf_rankings,
        "year_range": {"start": yr_from, "end": yr_to} if (yr_from or yr_to) else {},
        "authors": raw_filters.get("authors", []) or [],
        "affiliations": raw_filters.get("affiliations", []) or [],
    }

    researcher = raw.get("researcher") or {}
    options = raw.get("options") or {}
    if not isinstance(options, dict):
        options = {}

    pdf = _default_pdf_options(options)

    return {
        "version": "1.0",
        "researcher_name": researcher.get("name", "未指定") if isinstance(researcher, dict) else str(researcher),
        "google_scholar_id": researcher.get("google_scholar_id", "") if isinstance(researcher, dict) else "",
        "openalex_author_id": researcher.get("openalex_id", "") if isinstance(researcher, dict) else "",
        "papers": papers,
        "filters": filters,
        "download_pdfs": options.get("download_pdfs", True),
        "output_dir": options.get("output_dir", "./citation_output"),
        **pdf,
    }


def _parse_v2(raw: dict) -> dict:
    """Parse v2.0 config format with pre-built citing paper lists."""
    target_papers_raw = raw.get("target_papers")
    if not isinstance(target_papers_raw, list) or not target_papers_raw:
        raise ValueError("v2.0 配置文件中 target_papers 必须是非空列表")

    target_papers = []
    for i, tp in enumerate(target_papers_raw):
        if not isinstance(tp, dict):
            raise ValueError(f"target_papers[{i}] 必须是字典")
        citing_raw = tp.get("citing_papers", []) or []
        citing_papers = []
        for j, cp in enumerate(citing_raw):
            if not isinstance(cp, dict):
                continue
            citing_papers.append({
                "openalex_id": cp.get("openalex_id", ""),
                "title": cp.get("title", ""),
                "year": cp.get("year"),
                "doi": cp.get("doi", ""),
                "venue": cp.get("venue", ""),
                "ccf_rank": cp.get("ccf_rank", ""),
                "authors": cp.get("authors", ""),
                "pdf_source": cp.get("pdf_source", "unknown"),
                "pdf_folder": cp.get("pdf_folder", ""),
            })

        target_papers.append({
            "openalex_id": tp.get("openalex_id", ""),
            "title": tp.get("title", ""),
            "year": tp.get("year"),
            "doi": tp.get("doi", ""),
            "citing_papers": citing_papers,
        })

    researcher = raw.get("researcher") or {}
    options = raw.get("options") or {}
    if not isinstance(options, dict):
        options = {}

    pdf = _default_pdf_options(options)

    return {
        "version": "2.0",
        "researcher_name": researcher.get("name", "未指定") if isinstance(researcher, dict) else str(researcher),
        "google_scholar_id": researcher.get("google_scholar_id", "") if isinstance(researcher, dict) else "",
        "openalex_author_id": researcher.get("openalex_id", "") if isinstance(researcher, dict) else "",
        "target_papers": target_papers,
        "pdf_dir": options.get("pdf_dir") or ".",
        "output_dir": options.get("output_dir", "./citation_output"),
        **pdf,
    }


def load_config(path: str) -> dict:
    """Load, validate, and normalize a YAML config file.

    Supports both v1.0 (legacy) and v2.0 (with pre-built citing paper lists) formats.
    """
    config_path = Path(path)
    if not config_path.exists():
        raise FileNotFoundError(f"配置文件不存在: {path}")

    with open(config_path, "r", encoding="utf-8") as f:
        raw = yaml.safe_load(f)

    if not isinstance(raw, dict):
        raise ValueError("配置文件格式错误: 顶层必须是字典")

    version = str(raw.get("version", "1.0"))
    if version.startswith("2"):
        return _parse_v2(raw)
    return _parse_v1(raw)
