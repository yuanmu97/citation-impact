"""Generate a Markdown citation impact report from collected data."""

import json
import logging
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)


def _format_authors(authorships: list[dict]) -> str:
    """Format author names as a comma-separated string."""
    names = [a.get("author_name", "") for a in authorships if a.get("author_name")]
    if len(names) > 5:
        return ", ".join(names[:5]) + f" 等 ({len(names)} 人)"
    return ", ".join(names) if names else "未知"


def _format_institutions(authorships: list[dict]) -> str:
    """Format unique institutions from all authors."""
    institutions = set()
    for a in authorships:
        for inst in a.get("institutions", []):
            if inst:
                institutions.add(inst)
    if not institutions:
        return "未知"
    inst_list = sorted(institutions)
    if len(inst_list) > 3:
        return ", ".join(inst_list[:3]) + f" 等 ({len(inst_list)} 个机构)"
    return ", ".join(inst_list)


def _format_context(context: str) -> str:
    """Format context text for table display, preserving full content for agent analysis."""
    if not context:
        return "—"
    return context.replace("\n", " ").replace("|", "\\|")


def generate_report(output_dir: str, config: dict) -> str:
    """Generate a complete Markdown citation impact report.

    Reads summary.json files from each paper's subdirectory under output_dir
    and compiles them into a single report.

    Args:
        output_dir: Path to the output directory containing paper subdirectories.
        config: The parsed configuration dict.

    Returns:
        Path to the generated report file.
    """
    output_path = Path(output_dir)
    researcher_name = config.get("researcher_name", "未指定")

    paper_dirs = sorted(
        [d for d in output_path.iterdir() if d.is_dir() and (d / "summary.json").exists()]
    )

    total_filtered = 0
    paper_sections = []

    for idx, paper_dir in enumerate(paper_dirs, 1):
        summary_path = paper_dir / "summary.json"
        with open(summary_path, "r", encoding="utf-8") as f:
            summary = json.load(f)

        target = summary.get("target_paper", {})
        title = target.get("title", "未知论文")
        venue = target.get("venue", "未知")
        year = target.get("publication_year", "未知")
        doi = target.get("doi", "")
        total_citations = target.get("cited_by_count", 0)

        filtered = summary.get("filtered_citations", [])
        filtered_count = len(filtered)
        total_filtered += filtered_count

        section_lines = [
            f"## 论文 {idx}: {title}",
            "",
            f"- **发表于**: {venue} {year}",
            f"- **DOI**: {doi if doi else '无'}",
            f"- **总被引次数**: {total_citations} | **符合条件**: {filtered_count} 次",
            "",
            "### 他引详情",
            "",
            "| # | 他引论文 | 作者 | 机构 | 发表出处 | 年份 | 评级 | 引用原文 | 评价类型 | 分析说明 |",
            "|---|---------|------|------|---------|------|------|---------|---------|---------|",
        ]

        for i, citation in enumerate(filtered, 1):
            citing_title = citation.get("title", "未知")
            authors = _format_authors(citation.get("authorships", []))
            institutions = _format_institutions(citation.get("authorships", []))
            citing_venue = citation.get("venue", "未知")
            citing_year = citation.get("publication_year", "未知")
            ccf_rank = citation.get("ccf_rank") or "—"

            citation_contexts = citation.get("citation_contexts", [])
            if citation_contexts:
                ctx_text = _format_context(citation_contexts[0].get("context", ""))
            else:
                ctx_text = "(未提取到)"

            pipe = "|"
            esc_pipe = "\\|"
            citing_title_safe = citing_title.replace(pipe, esc_pipe)
            authors_safe = authors.replace(pipe, esc_pipe)
            institutions_safe = institutions.replace(pipe, esc_pipe)
            venue_safe = citing_venue.replace(pipe, esc_pipe)

            row = (
                f"| {i} "
                f"| {citing_title_safe} "
                f"| {authors_safe} "
                f"| {institutions_safe} "
                f"| {venue_safe} "
                f"| {citing_year} "
                f"| {ccf_rank} "
                f"| {ctx_text} "
                f"| (待Agent分析) "
                f"| (待Agent填写) |"
            )
            section_lines.append(row)

        if not filtered:
            section_lines.append("| — | 无符合条件的他引论文 | — | — | — | — | — | — | — | — |")

        paper_sections.append("\n".join(section_lines))

    report_lines = [
        "# 学术论文被引情况报告",
        "",
        f"**研究者**: {researcher_name}",
        f"**生成日期**: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        f"**分析论文数**: {len(paper_dirs)} 篇",
        f"**总符合条件被引次数**: {total_filtered} 次",
        "",
        "---",
        "",
    ]

    report_lines.append("\n\n---\n\n".join(paper_sections))

    report_content = "\n".join(report_lines) + "\n"

    report_path = output_path / "citation_report.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_content)

    logger.info("报告已生成: %s", report_path)
    return str(report_path)
