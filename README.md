# Citation Impact Analyzer

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Citation Impact Analyzer** helps researchers understand *how* their papers are cited. It uses a local web UI to configure the analysis, then an AI agent (Cursor / Claude Code) to run the pipeline — downloading PDFs, extracting citation contexts, and classifying each citation as high praise, neutral reference, or critical mention.

## How It Works

```
┌─────────────┐     config.yaml       ┌─────────────┐  citation_report.md
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
>
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

## Example

A complete working example is included in the [`example/`](example/) folder:

- [`example/config.yaml`](example/config.yaml) — input configuration
- [`example/citation_report.md`](example/citation_report.md) — generated report

Below is a condensed view of the report for [PacketGame (ACM SIGCOMM 2023)](https://doi.org/10.1145/3603269.3604825):

> **研究者**: Mu Yuan (袁牧) &nbsp;|&nbsp; **分析论文数**: 1 篇 &nbsp;|&nbsp; **符合条件被引**: 5 次

| # | 他引论文                                            | 机构                    | 发表出处 | 年份 | 评级 | 评价类型           | 分析说明                                        |
| - | --------------------------------------------------- | ----------------------- | -------- | ---- | ---- | ------------------ | ----------------------------------------------- |
| 1 | Déjà Vu: Efficient Video-Language Query Engine... | Korea University        | VLDB     | 2025 | B    | 一般引用           | 视频推理领域相关工作引用                        |
| 2 | Empower Vision Applications with LoRA LMM           | Nanjing Univ.; Tsinghua | EuroSys  | 2025 | A    | **高度评价** | 3 个章节中 3 次引用，作为实时视频分析代表性工作 |
| 3 | Palantir: Towards Efficient Super Resolution...     | Tsinghua; Simon Fraser  | MMSys    | 2025 | A    | 一般引用           | DAG Construction 中作为背景事实引用             |
| 4 | AMRE: Adaptive Multilevel Redundancy Elimination... | Tianjin Univ.           | IEEE TMC | 2025 | A    | 一般引用           | Related Work 中以列举方式归类为输入区域优化工作 |
| 5 | Online Container Caching with Late-Warm...          | USTC; MSRA              | ICDE     | 2024 | A    | 一般引用           | Introduction 中作为 IoT 推理任务示例            |

> 高度评价 1 (20%) · 一般引用 4 (80%) · 批评性引用 0

The agent extracts full citation contexts from PDFs, identifies author institutions, and classifies each citation with reasoning. See the [full report](example/citation_report.md) for all details.

## Config Format (v2.0)

The web tool generates v2.0 configs. See [`example/config.yaml`](example/config.yaml) for a real example.

| Field                          | Description                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------- |
| `version`                    | Config schema version (`"2.0"`)                                                |
| `researcher`                 | Author identity — name, Google Scholar ID, OpenAlex ID                          |
| `target_papers`              | Papers to analyze, each with a pre-built `citing_papers` list                  |
| `citing_papers[].pdf_source` | `"oa"` (auto-download), `"local"` (user placed), or `"unknown"` (try both) |
| `citing_papers[].pdf_folder` | Subfolder under `citation_pdfs/` — place your PDF here                        |
| `options.pdf_dir`            | Must be `"."` — `citation_pdfs/` lives at workspace root                    |
| `options.output_dir`         | Output directory for results                                                     |

## Requirements

- **Node.js 18+** — for the local config web UI
- **Python 3.9+** — for the analysis pipeline (installed automatically by the agent)
- **Chrome or Edge** — recommended for File System Access API support in the web UI
- **Cursor or Claude Code** — AI agent to run the analysis

## License

[MIT License](LICENSE)
