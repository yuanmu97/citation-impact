"""Extract citation contexts from full-text papers."""

from __future__ import annotations

import re
import logging

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Reference section detection
# ---------------------------------------------------------------------------

REFERENCE_SECTION_PATTERNS = [
    r"\n\s*R\s*E\s*F\s*E\s*R\s*E\s*N\s*C\s*E\s*S\s*\n",
    r"\n\s*References?\s*\n",
    r"\n\s*REFERENCES?\s*\n",
    r"\nReferences?\s*\n",
    r"\nREFERENCES?\s*\n",
    r"\n\s*Bibliography\s*\n",
    r"\n\s*BIBLIOGRAPHY\s*\n",
    r"\n\s*Works Cited\s*\n",
    r"\n\s*Literature Cited\s*\n",
]

SENTENCE_BOUNDARY = re.compile(r"(?<=[.!?])\s+(?=[A-Z\[\(])")


def _find_references_split(text: str) -> tuple[str, str]:
    """Split text into body and references section.

    Uses three strategies in order:
      1. Explicit header pattern (REFERENCES, Bibliography, etc.)
      2. Detect a cluster of sequential [N] reference entries in the latter half
      3. Return (text, "") if nothing found

    Returns (body, references).
    """
    text_len = max(len(text), 1)
    best_pos = -1

    for pattern in REFERENCE_SECTION_PATTERNS:
        for match in re.finditer(pattern, text):
            pos = match.start()
            if pos / text_len > 0.3 and pos > best_pos:
                best_pos = pos

    if best_pos != -1:
        return text[:best_pos], text[best_pos:]

    ref_entry_re = re.compile(r"\[(\d+)\]\s+[A-Z]\.\s")
    matches = list(ref_entry_re.finditer(text))

    cluster_start = -1
    for i, m in enumerate(matches):
        if m.start() / text_len < 0.5:
            continue
        num = int(m.group(1))
        if num <= 3:
            streak = 1
            for j in range(i + 1, min(i + 6, len(matches))):
                nxt = int(matches[j].group(1))
                if nxt == num + streak or nxt == num + streak + 1:
                    streak += 1
                else:
                    break
            if streak >= 3:
                cluster_start = m.start()
                break

    if cluster_start != -1:
        logger.info("通过 [N] 条目集群检测到参考文献段 (pos=%d, rel=%.2f)", cluster_start, cluster_start / text_len)
        return text[:cluster_start], text[cluster_start:]

    return text, ""


# ---------------------------------------------------------------------------
# Author / title helpers
# ---------------------------------------------------------------------------

def _get_author_last_names(target_paper: dict) -> list[str]:
    """Extract last names from the target paper's authorships."""
    names = []
    for authorship in target_paper.get("authorships", []):
        full_name = authorship.get("author_name", "")
        if not full_name:
            continue
        parts = full_name.strip().split()
        if parts:
            names.append(parts[-1].lower())
    return names


_STOP_WORDS = {
    "a", "an", "the", "of", "in", "on", "for", "and", "or", "to",
    "is", "are", "was", "were", "with", "from", "by", "at", "as",
    "its", "their", "this", "that", "these", "those", "via", "using",
    "based", "through", "not", "can", "may", "will", "been", "has",
    "have", "had", "being", "more", "most", "than", "also", "such",
}


def _get_title_keywords(target_paper: dict) -> list[str]:
    """Extract significant keywords from the title."""
    title = target_paper.get("title", "")
    if not title:
        return []
    words = re.findall(r"[a-zA-Z]+", title.lower())
    return [w for w in words if w not in _STOP_WORDS and len(w) > 2]


# ---------------------------------------------------------------------------
# Reference number detection (robust multi-line)
# ---------------------------------------------------------------------------

def _parse_reference_entries(references: str) -> list[tuple[str, str]]:
    """Parse reference section into (number, full_entry_text) tuples.

    Handles multi-line entries by grouping text between consecutive [N] markers.
    """
    pattern = re.compile(r"\[(\d+)\]")
    matches = list(pattern.finditer(references))
    if not matches:
        return []

    entries = []
    for i, m in enumerate(matches):
        num = m.group(1)
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(references)
        entry_text = references[start:end]
        entries.append((num, entry_text))
    return entries


def _find_reference_number(references: str, target_paper: dict) -> str | None:
    """Find the numeric reference label for the target paper in the references section.

    Works with multi-line entries by grouping all text between consecutive [N] markers.
    """
    entries = _parse_reference_entries(references)
    if not entries:
        return None

    last_names = _get_author_last_names(target_paper)
    title_keywords = _get_title_keywords(target_paper)
    year = target_paper.get("publication_year")
    title_lower = (target_paper.get("title") or "").lower()

    best_num = None
    best_score = 0

    for num, entry_text in entries:
        entry_lower = entry_text.lower()
        score = 0.0

        if last_names:
            name_matches = sum(1 for name in last_names if name in entry_lower)
            score += name_matches / len(last_names) * 3

        if title_keywords:
            kw_matches = sum(1 for kw in title_keywords if kw in entry_lower)
            score += kw_matches / len(title_keywords) * 3

        if year and str(year) in entry_text:
            score += 1

        if title_lower and len(title_lower) > 10:
            clean_title = re.sub(r"[^a-z0-9 ]", "", title_lower).strip()
            clean_entry = re.sub(r"[^a-z0-9 ]", "", entry_lower).strip()
            if clean_title[:40] in clean_entry:
                score += 5

        if score > best_score:
            best_score = score
            best_num = num

    if best_score < 1.5:
        logger.debug("参考文献匹配分数不足 (best=%.1f), 无法定位引用编号", best_score)
        return None

    logger.info("定位到引用编号 [%s] (score=%.1f)", best_num, best_score)
    return best_num


# ---------------------------------------------------------------------------
# Context extraction helpers
# ---------------------------------------------------------------------------

def _get_current_page(text: str, position: int) -> str:
    """Determine the page number for a given position in the text."""
    page_markers = list(re.finditer(r"--- Page (\d+) ---", text[:position]))
    if page_markers:
        return page_markers[-1].group(1)
    return "?"


def _guess_section(context: str) -> str:
    """Guess the paper section based on context keywords."""
    ctx_lower = context.lower()
    section_keywords = {
        "Abstract": ["abstract"],
        "Introduction": ["introduction", "in this paper", "we propose", "recently"],
        "Related Work": ["related work", "previous work", "prior work", "literature review"],
        "Methodology": ["method", "methodology", "approach", "algorithm", "framework", "model"],
        "Experiments": ["experiment", "evaluation", "result", "performance", "benchmark", "dataset", "table", "figure"],
        "Discussion": ["discussion", "limitation", "future work", "analysis"],
        "Conclusion": ["conclusion", "summary", "in summary", "we have presented"],
    }
    for section, keywords in section_keywords.items():
        if any(kw in ctx_lower for kw in keywords):
            return section
    return "Body"


def _extract_surrounding_context(text: str, position: int, span_length: int) -> str:
    """Extract 2-3 sentences before and after the citation position."""
    window_start = max(0, position - 600)
    window_end = min(len(text), position + span_length + 600)
    window = text[window_start:window_end]

    sentences = SENTENCE_BOUNDARY.split(window)
    if not sentences:
        return window.strip()

    citation_offset = position - window_start
    cumulative = 0
    center_idx = 0
    for idx, s in enumerate(sentences):
        cumulative += len(s) + 1
        if cumulative >= citation_offset:
            center_idx = idx
            break

    start_idx = max(0, center_idx - 2)
    end_idx = min(len(sentences), center_idx + 3)
    context = " ".join(sentences[start_idx:end_idx]).strip()

    context = re.sub(r"\s*--- Page \d+ ---\s*", " ", context)
    context = re.sub(r"\s+", " ", context)
    return context


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def find_citation_contexts(full_text: str, target_paper: dict) -> list[dict]:
    """Find all contexts where the target paper is cited in the full text.

    Strategy (in order):
      1. Locate the reference number (e.g. [31]) from the references section.
         Search the body for bracket citations containing that number.
      2. Fallback: author-year pattern matching (e.g. "Yuan et al. 2023").
      3. Fallback: title keyword proximity matching.

    Args:
        full_text: The full text of the citing paper (with page markers).
        target_paper: Dict with info about the paper being cited.

    Returns:
        List of dicts, each with keys: context, section, page.
    """
    body, references = _find_references_split(full_text)
    contexts = []

    logger.info(
        "文本长度: %d, 正文: %d, 参考文献: %d",
        len(full_text), len(body), len(references),
    )

    # --- Strategy 1: Reference number + bracket matching ---
    ref_num = _find_reference_number(references, target_paper) if references else None

    if ref_num:
        num_esc = re.escape(ref_num)
        bracket_patterns = [
            re.compile(r"\[" + num_esc + r"\]"),
            re.compile(r"\[" + num_esc + r"(?:\s*[,–\-]\s*\d+)+\]"),
            re.compile(r"\[(?:\d+\s*[,–\-]\s*)*" + num_esc + r"(?:\s*[,–\-]\s*\d+)*\]"),
            re.compile(r"\[(?:\d+\s*,\s*)*" + num_esc + r"(?:\s*,\s*\d+)*\]"),
        ]
        found_positions: set[int] = set()
        for pat in bracket_patterns:
            for match in pat.finditer(body):
                pos = match.start()
                if any(abs(pos - p) < 20 for p in found_positions):
                    continue
                found_positions.add(pos)
                ctx_text = _extract_surrounding_context(full_text, pos, match.end() - match.start())
                page = _get_current_page(full_text, pos)
                section = _guess_section(ctx_text)
                contexts.append({
                    "context": ctx_text,
                    "section": section,
                    "page": page,
                })
    else:
        logger.info("未在参考文献中定位到引用编号")

    # --- Strategy 2: Author-year pattern (e.g. "Yuan et al. 2023") ---
    last_names = _get_author_last_names(target_paper)
    year = target_paper.get("publication_year")
    if last_names and year:
        if len(last_names) == 1:
            author_part = re.escape(last_names[0].capitalize())
        elif len(last_names) == 2:
            author_part = (
                re.escape(last_names[0].capitalize())
                + r"\s+(?:and|&)\s+"
                + re.escape(last_names[1].capitalize())
            )
        else:
            author_part = re.escape(last_names[0].capitalize()) + r"\s+et\s+al\."

        author_year_pattern = re.compile(
            r"\(?" + author_part + r"[,\s]+(?:et\s+al\.\s*[,\s]*)?" + str(year) + r"\)?"
        )

        existing_positions = {c.get("_pos") for c in contexts}
        for match in author_year_pattern.finditer(body):
            pos = match.start()
            if any(abs(pos - p) < 50 for p in existing_positions if p is not None):
                continue
            ctx_text = _extract_surrounding_context(full_text, pos, match.end() - match.start())
            if ctx_text[:50] in {c["context"][:50] for c in contexts}:
                continue
            page = _get_current_page(full_text, pos)
            section = _guess_section(ctx_text)
            contexts.append({
                "context": ctx_text,
                "section": section,
                "page": page,
            })

    # --- Strategy 3: Title keyword proximity matching ---
    if not contexts:
        logger.info("未找到显式引用上下文，尝试关键词匹配")
        title_keywords = _get_title_keywords(target_paper)
        if len(title_keywords) >= 3:
            core_kws = title_keywords[:5]
            pattern_str = r"(?i)" + r".{0,40}".join(re.escape(kw) for kw in core_kws)
            for match in re.finditer(pattern_str, body):
                pos = match.start()
                ctx_text = _extract_surrounding_context(full_text, pos, match.end() - match.start())
                page = _get_current_page(full_text, pos)
                section = _guess_section(ctx_text)
                contexts.append({
                    "context": ctx_text,
                    "section": section,
                    "page": page,
                })
                if len(contexts) >= 3:
                    break

    logger.info("共找到 %d 条引用上下文", len(contexts))
    return contexts
