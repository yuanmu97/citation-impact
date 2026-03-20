# Citation Impact Analyzer（被引影响力分析）

**Language / 语言:** [English](README.md) · [简体中文](README.zh-CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Homepage](https://img.shields.io/badge/主页-GitHub%20Pages-blue?logo=github)](https://yuanmu97.github.io/citation-impact/)

> **[在线演示与说明](https://yuanmu97.github.io/citation-impact/)** — 打开项目主页使用交互式配置工具与快速入门说明。

**Citation Impact Analyzer** 帮助研究者了解他人**如何**引用自己的论文：先用本地 Web 界面完成配置，再由 AI Agent（Cursor / Claude Code）运行流水线——下载 PDF、抽取引用语境，并将每条引用归类为**高度评价**、**一般引用**或**批评性引用**。

## 工作原理

```
┌─────────────┐     config.yaml       ┌─────────────┐  citation_report.md
│  本地 Web   │  ──────────────────>  │  AI Agent   │  ──────────────────>  📊 报告
│  配置界面   │  + citation_pdfs/     │ (Cursor /   │
│  (浏览器)   │                       │ Claude Code)│
└─────────────┘                       └─────────────┘
```

1. **配置** — 在本地启动 Web UI，检索论文、选择他引论文并导出 `config.yaml`
2. **分析** — AI Agent 读取配置、下载 PDF、抽取引用并生成报告

## 快速开始

### 步骤 1：克隆仓库

```bash
git clone https://github.com/yuanmu97/citation-impact.git
cd citation-impact
```

### 步骤 2：启动本地配置界面

```bash
cd web
npm install
npm run dev
```

在浏览器中打开 **http://localhost:5173/citation-impact/**（建议使用 Chrome 或 Edge 以使用文件夹访问 API）。

在 Web UI 中：

1. **选择工作目录** — 顶部点击「选择文件夹」，选定本地项目目录；`config.yaml` 与 `citation_pdfs/` 将创建于此。
2. **搜索作者** — 输入 Google Scholar ID 加载论文列表。
3. **选择论文** — 勾选要分析的目标论文。
4. **他引论文** — 工具通过 OpenAlex 获取他引列表，可按 CCF、年份、作者等筛选。
5. **PDF 准备** — 在工作目录下创建 `citation_pdfs/<论文>/` 子文件夹；非 OA 论文请自行下载 PDF 放入对应目录。
6. **导出** — `config.yaml` 会自动保存到工作目录，之后可关闭 Web UI。

### 步骤 3：安装 Agent 技能

**Cursor：**

```bash
git clone https://github.com/yuanmu97/citation-impact.git ~/.cursor/skills/citation-impact
```

**Claude Code：**

```bash
git clone https://github.com/yuanmu97/citation-impact.git ~/.claude/skills/citation-impact
```

> 若已在步骤 1 克隆过仓库，也可使用符号链接：
>
> ```bash
> ln -s /path/to/citation-impact ~/.cursor/skills/citation-impact
> ```

### 步骤 4：运行分析

在 Cursor 或 Claude Code 中打开**步骤 2 所选的工作目录**，对 Agent 说：

```
根据 config.yaml 分析我的被引影响力
```

或使用英文：

```
Analyze my citation impact using config.yaml
```

Agent 将：

- 安装 Python 依赖（`aiohttp`、`PyMuPDF`、`pyyaml`）
- 运行抽取流水线（下载 OA PDF、抽取文本与引用语境）
- 阅读 PDF 首页等信息以识别作者机构
- 将每条引用归类为 高度评价 / 一般引用 / 批评性引用
- 对**高度评价**检索作者头衔（IEEE/ACM Fellow、杰青等）并判断机构影响力
- 生成完整的 `citation_output/citation_report.md`

## 示例

完整示例见 [`example/`](example/) 目录：

- [`example/config.yaml`](example/config.yaml) — 输入配置
- [`example/citation_report.md`](example/citation_report.md) — 生成报告

以下为 [PacketGame (ACM SIGCOMM 2023)](https://doi.org/10.1145/3603269.3604825) 报告的精简展示：

> **研究者**: Mu Yuan (袁牧) &nbsp;|&nbsp; **分析论文数**: 1 篇 &nbsp;|&nbsp; **符合条件被引**: 5 次

| # | 他引论文                                            | 机构                              | 出处              | 年份 | 评级        | 评价类型              | 分析说明                              |
| - | --------------------------------------------------- | --------------------------------- | ----------------- | ---- | ----------- | --------------------- | ------------------------------------- |
| 1 | Déjà Vu: Efficient Video-Language Query Engine... | Korea University                  | VLDB              | 2025 | B           | 一般引用              | 视频推理领域相关工作引用              |
| 2 | **Empower Vision Applications with LoRA LMM** | **Nanjing Univ.; Tsinghua** | **EuroSys** | 2025 | **A** | **⭐ 高度评价** | 3 个章节中 3 次引用，作为代表性工作   |
| 3 | Palantir: Towards Efficient Super Resolution...     | Tsinghua; Simon Fraser            | MMSys             | 2025 | A           | 一般引用              | DAG Construction 中作为背景事实引用   |
| 4 | AMRE: Adaptive Multilevel Redundancy Elimination... | Tianjin Univ.                     | IEEE TMC          | 2025 | A           | 一般引用              | Related Work 中列举为输入区域优化工作 |
| 5 | Online Container Caching with Late-Warm...          | USTC; MSRA                        | ICDE              | 2024 | A           | 一般引用              | Introduction 中作为 IoT 推理任务示例  |

> **⭐ #2 高度评价深度标注**
>
> |                    | 信息                                                        |
> | ------------------ | ----------------------------------------------------------- |
> | **知名作者** | Yunxin Liu / 刘云新 (IEEE Fellow, 清华 AIR 副院长, 原 MSRA) |
> |                    | Guihai Chen / 陈贵海 (IEEE Fellow, CCF Fellow, 国家杰青)    |
> |                    | Haipeng Dai / 戴海鹏 (教育部青年长江学者, IET Fellow)       |
> | **头部机构** | 南京大学 — 计算机科学国家重点实验室, CSRankings 中国 Top-5 |
> |                    | 清华大学智能产业研究院 (AIR)                                |
>
> 高度评价 1 (20%) · 一般引用 4 (80%) · 批评性引用 0

Agent 会抽取完整引用原文、识别机构、撰写分析说明，并对**高度评价**补充知名学者与头部机构等背景。详见[完整报告](example/citation_report.md)。

## 配置格式 (v2.0)

Web 工具生成 v2.0 配置，真实样例见 [`example/config.yaml`](example/config.yaml)。

| 字段                           | 说明                                                                      |
| ------------------------------ | ------------------------------------------------------------------------- |
| `version`                    | 配置版本（`"2.0"`）                                                     |
| `researcher`                 | 作者身份：姓名、Google Scholar ID、OpenAlex ID                            |
| `target_papers`              | 待分析论文及预构建的 `citing_papers` 列表                               |
| `citing_papers[].pdf_source` | `"oa"`（自动下载）、`"local"`（用户放置）或 `"unknown"`（两者尝试） |
| `citing_papers[].pdf_folder` | `citation_pdfs/` 下的子目录名，PDF 放于此                               |
| `options.pdf_dir`            | 必须为 `"."`，即 `citation_pdfs/` 位于工作区根目录                    |
| `options.output_dir`         | 结果输出目录                                                              |

## 环境要求

- **Node.js 18+** — 本地配置 Web UI
- **Python 3.9+** — 分析流水线（可由 Agent 自动安装依赖）
- **Chrome 或 Edge** — 推荐，以支持 Web UI 的文件系统访问 API
- **Cursor 或 Claude Code** — 用于运行分析的 AI Agent

## 许可证

[MIT License](LICENSE)
