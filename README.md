# Citation Impact Analyzer

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Citation Impact Analyzer** helps researchers understand *how* their papers are cited. It uses a local web UI to configure the analysis, then an AI agent (Cursor / Claude Code) to run the pipeline — downloading PDFs, extracting citation contexts, and classifying each citation as high praise, neutral reference, or critical mention.

## How It Works

```
┌─────────────┐     config.yaml      ┌─────────────┐     citation_report.md
│  Local Web  │  ──────────────────>  │  AI Agent   │  ──────────────────>  📊 Report
│  Config UI  │  + citation_pdfs/     │  (Cursor /  │
│  (browser)  │                       │ Claude Code)│
└─────────────┘                       └─────────────┘
```

1. **Configure** — Run the web UI locally to search your papers, select citing papers, and export `config.yaml`
2. **Analyze** — The AI agent reads the config, downloads PDFs, extracts citations, and produces a report

## Quick Start

### Step 1: Clone the repo

```bash
git clone https://github.com/yuanmu97/citation-impact.git
cd citation-impact
```

### Step 2: Start the local config UI

```bash
cd web
npm install
npm run dev
```

Open **http://localhost:5173/citation-impact/** in your browser (Chrome or Edge recommended for folder access).

In the web UI:

1. **Choose Working Directory** — Click "Choose Folder" at the top to select a local project folder. This is where `config.yaml` and `citation_pdfs/` will be created.
2. **Search Author** — Enter your Google Scholar ID to load your paper list.
3. **Select Papers** — Choose which papers to analyze.
4. **Citing Papers** — The tool fetches all citing papers via OpenAlex. Filter by CCF rank, year, authors.
5. **PDF Prep** — The tool creates `citation_pdfs/<paper>/` folders in your working directory. For non-OA papers, download the PDF and place it in the corresponding subfolder.
6. **Export** — `config.yaml` is automatically saved to your working directory. You can close the web UI now.

### Step 3: Install the agent skill

**Cursor:**
```bash
git clone https://github.com/yuanmu97/citation-impact.git ~/.cursor/skills/citation-impact
```

**Claude Code:**
```bash
git clone https://github.com/yuanmu97/citation-impact.git ~/.claude/skills/citation-impact
```

> If you already cloned in Step 1, you can symlink instead:
> ```bash
> ln -s /path/to/citation-impact ~/.cursor/skills/citation-impact
> ```

### Step 4: Run the analysis

Open your **working directory** (the one you chose in Step 2) in Cursor or Claude Code, and tell the agent:

```
Analyze my citation impact using config.yaml
```

The agent will:
- Install Python dependencies (`aiohttp`, `PyMuPDF`, `pyyaml`)
- Run the extraction pipeline (download OA PDFs, extract text, find citation contexts)
- Read each PDF's first pages to identify author institutions
- Classify each citation as 高度评价 / 一般引用 / 批评性引用
- Produce a complete `citation_output/citation_report.md`

## Config Format (v2.0)

The web tool generates v2.0 configs with pre-selected citing papers:

```yaml
version: '2.0'
researcher:
  name: "Jane Doe"
  google_scholar_id: "ABCDEFG"
  openalex_id: "A5012345678"
target_papers:
  - openalex_id: W1234567890
    title: "My Great Paper"
    year: 2023
    doi: 10.xxxx/xxxxx
    citing_papers:
      - openalex_id: W9876543210
        title: "Citing Paper"
        year: 2025
        doi: 10.yyyy/yyyyy
        venue: "ICML"
        ccf_rank: A
        authors: "Alice, Bob"
        pdf_source: oa
        pdf_folder: "Citing Paper"
options:
  pdf_dir: "."
  output_dir: "./citation_output"
```

| Field | Description |
|---|---|
| `version` | Config schema version (`"2.0"`) |
| `researcher` | Author identity — name, Google Scholar ID, OpenAlex ID |
| `target_papers` | Papers to analyze, each with a pre-built `citing_papers` list |
| `citing_papers[].pdf_source` | `"oa"` (auto-download), `"local"` (user placed), or `"unknown"` (try both) |
| `citing_papers[].pdf_folder` | Subfolder under `citation_pdfs/` — place your PDF here |
| `options.pdf_dir` | Must be `"."` — `citation_pdfs/` lives at workspace root |
| `options.output_dir` | Output directory for results |

## Report Sample

```markdown
# 学术论文被引情况报告
**研究者**: Jane Doe | **生成日期**: 2026-03-20

## 论文 1: My Great Paper
- **发表于**: NeurIPS 2023
- **总被引次数**: 42 | **符合条件**: 15 次

| # | 他引论文 | 作者 | 机构 | 发表出处 | 年份 | 评级 | 引用原文 | 评价类型 | 分析说明 |
|---|---------|------|------|---------|------|------|---------|---------|---------|
| 1 | Deep Analysis of X | A. Smith | MIT | ICML | 2024 | A | "...builds upon the seminal work..." | 高度评价 | Introduction 中明确称为 seminal work 并基于其方法扩展 |
| 2 | A Survey on Y | C. Wang | Tsinghua | CSUR | 2025 | A | "...proposed a method for..." | 一般引用 | Related Work 中作为同类方法列举 |

### 总结
- 高度评价: 5 (33.3%)
- 一般引用: 8 (53.3%)
- 批评性引用: 2 (13.3%)
```

## Requirements

- **Node.js 18+** — for the local config web UI
- **Python 3.9+** — for the analysis pipeline (installed automatically by the agent)
- **Chrome or Edge** — recommended for File System Access API support in the web UI
- **Cursor or Claude Code** — AI agent to run the analysis

## License

[MIT License](LICENSE)
