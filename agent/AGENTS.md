# Citation Impact Analyzer

Analyze how academic papers are cited — extract citation contexts from PDFs and classify each citation as high praise, neutral reference, or critical mention.

## When to Use

When the user asks to "analyze citations", "analyze citation impact", or provides/mentions a `config.yaml` for citation analysis.

## Prerequisites

Python 3.9+ required. Install dependencies before first run:
```bash
pip install -r agent/requirements.txt
```

## Workflow

### Step 1: Locate config.yaml

Find the `config.yaml` in the user's workspace. If the user specifies a path, use that. Otherwise look in the current working directory.

Read the config to understand:
- Which target papers to analyze
- The pre-selected citing papers for each target (v2.0 configs have these pre-built)
- Where PDFs are stored: **workspace root** `citation_pdfs/` (config uses `options.pdf_dir: "."`; never use a subfolder name)
- Where to write output (`options.output_dir`, defaults to `./citation_output`)

### Step 2: Install dependencies (if needed)

```bash
pip install -r agent/requirements.txt
```

### Step 3: Run the pipeline

```bash
python agent/scripts/main.py --config <path-to-config.yaml>
```

The script will:
- Create the output directory structure
- For v2.0 configs: use the pre-selected citing papers (no API calls needed for filtering)
- Create per-paper folders under **workspace root** `citation_pdfs/`
- Download Open Access PDFs automatically
- Find user-placed PDFs in `citation_pdfs/<paper_folder>/` under the workspace root
- Extract text from each PDF using PyMuPDF
- Locate citation contexts (sentences referencing the target paper)
- Generate `summary.json` files and an initial `citation_report.md`

### Step 4: Analyze and complete the report

After the script completes, read each paper's `summary.json` under `<output_dir>/<paper_name>/summary.json`.

For each citing paper, fill in **three columns** in `<output_dir>/citation_report.md`:

**机构 (institutions)**:
- Read `first_pages_text` from `summary.json` — it contains the first 2 pages where author affiliations typically appear.
- If unclear, **read the PDF directly** from `citation_pdfs/<pdf_folder>/`.

**评价类型 (sentiment)** — classify each citation as one of:

| Sentiment | Chinese Label | Description |
|-----------|--------------|-------------|
| High praise | 高度评价 | Explicitly praises, builds upon, or highlights the contribution as significant/influential |
| Neutral | 一般引用 | Standard reference for background, comparison, methodology, or related work |
| Critical | 批评性引用 | Critiques, identifies limitations, proposes improvements, or disagrees |

Consider the full context: look for words like "seminal", "groundbreaking", "builds upon" (praise), "proposed", "introduced", "similar to" (neutral), or "fails to", "limited", "outperforms" with the target as the weaker method (critical).

**分析说明 (reasoning)** — briefly explain the classification (e.g. which section, how the target paper is referenced, any praise or criticism).

For citations without extracted context (PDF unavailable), mark context as "(未提取到)" and classify as "一般引用" by default.

### Step 5: Add summary statistics

At the end of each paper's table, add:

```markdown
### 总结
- 高度评价: X citations (XX.X%)
- 一般引用: X citations (XX.X%)
- 批评性引用: X citations (XX.X%)
```

Add a final overall summary section at the end of the report.

## Config Format (v2.0)

The web tool generates v2.0 configs where citing papers are pre-selected:

```yaml
version: '2.0'
researcher:
  name: "Researcher Name"
target_papers:
  - openalex_id: W1234567890
    title: "Paper Title"
    year: 2023
    doi: 10.xxxx/xxxxx
    citing_papers:
      - title: "Citing Paper Title"
        year: 2025
        doi: 10.yyyy/yyyyy
        venue: "ICML"
        ccf_rank: A
        authors: "Alice, Bob"
        pdf_source: oa
        pdf_folder: "Citing Paper Title"
options:
  pdf_dir: "."    # Must be "." so citation_pdfs is under workspace root. Do not use workspace name or any subpath.
  output_dir: "./citation_output"
```

Key points:
- **pdf_dir**: Must be `"."`. When generating or editing config, always set `options.pdf_dir: "."`. PDFs go in **workspace root** `citation_pdfs/<pdf_folder>/`.
- `pdf_source: oa` — auto-download from Open Access URL
- `pdf_source: local` — user placed PDF in workspace root `citation_pdfs/<pdf_folder>/`
- `pdf_source: unknown` — try online first, then check local folder
- Any `.pdf` file in the subfolder is accepted (filename doesn't matter)

## Output Structure

```
citation_output/
├── citation_report.md          # Final report (you fill in sentiment)
├── Paper Title 1/
│   ├── summary.json            # Structured data with citation contexts
│   └── pdfs/
└── Paper Title 2/
    ├── summary.json
    └── pdfs/
```

## Report Table Format

| # | 他引论文 | 作者 | 机构 | 发表出处 | 年份 | 评级 | 引用原文 | 评价类型 | 分析说明 |
|---|---------|------|------|---------|------|------|---------|---------|---------|

Your job is to fill:
- "机构" — extract from `first_pages_text` in summary.json, or read the PDF directly
- "评价类型" — 高度评价 / 一般引用 / 批评性引用
- "分析说明" — 简要说明判定理由（如：在哪个章节、以什么方式引用、是否有褒贬倾向）
