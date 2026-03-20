# 学术论文被引情况报告

**研究者**: Mu Yuan (袁牧)
**生成日期**: 2026-03-20
**分析论文数**: 1 篇
**总符合条件被引次数**: 5 次

---

## 论文 1: Packetgame: Multi-stream packet gating for concurrent video inference at scale

- **发表于**: ACM SIGCOMM 2023
- **DOI**: 10.1145/3603269.3604825
- **总被引次数**: 5 | **符合条件**: 5 次

### 他引详情

| # | 他引论文 | 作者 | 机构 | 发表出处 | 年份 | 评级 | 引用原文 | 评价类型 | 分析说明 |
|---|---------|------|------|---------|------|------|---------|---------|---------|
| 1 | Déjà Vu: Efficient Video-Language Query Engine with Learning-Based Inter-Frame Computation Reuse | Jinwoo Hwang, D. Kim, Sangyeop Lee, Yoonsung Kim, Guseul Heo 等 (11 人) | Korea University | Proceedings of the VLDB Endowment | 2025 | B | (引用编号 [115]，正文引用位置在未完整提取的页面中) | 一般引用 | 参考文献列表中收录了 PacketGame [115]，论文主题为视频语言查询引擎的帧间计算复用，PacketGame 作为视频推理领域的相关工作被引用，属标准背景引用。 |
| 2 | Empower Vision Applications with LoRA LMM | Liang Mi, Weijun Wang, Wutao Tu, Qingfeng He, Rui Kong 等 (13 人) | Nanjing University; Tsinghua University | EuroSys 2025 | 2025 | A | "Real-time video analytics application [92, 93] needs low latency, while visual retrieval [45] prefers high throughput." / "Current applications yet stay on the simple combination of vision tasks such as image classification [92], vehicle counting [57], and target detection [31]." / "Video analytics ingests and analyzes each RGB frame from the video, then outputs results of fixed vision tasks, including object detection and video understanding like prior work [79, 92]." | 高度评价 | 在 Introduction、Background、Experimental Setup 三个章节中共 3 次引用 PacketGame [92]，均将其作为实时视频分析领域的代表性工作列举，跨章节多次引用表明作者视其为该领域的重要基础性工作。 |
| 3 | Palantir: Towards Efficient Super Resolution for Ultra-high-definition Live Streaming | Xinqi Jin, Zhui Zhu, Xikai Sun, Fan Dang, Jiangchuan Liu 等 (9 人) | Tsinghua University; Simon Fraser University | ACM MMSys 2025 | 2025 | A | "Commodity cameras can capture the HR data in the place, but they are typically not programmable [49] and thus not suitable for processing the task of DAG construction." | 一般引用 | §6.1 DAG Construction 中引用 PacketGame [49]，用于说明普通摄像头的不可编程性，作为背景事实引用，无褒贬。 |
| 4 | AMRE: Adaptive Multilevel Redundancy Elimination for Multimodal Mobile Inference | Qixuan Cai, Rui Chu, Kaixuan Zhang, Xiulong Liu, Xinyu Tong 等 (8 人) | Tianjin University; Xiamen Intretech Inc. | IEEE Transactions on Mobile Computing | 2025 | A | "Partial elimination: Some works reduce model computation by minimizing certain input regions [29], [30], [31]." | 一般引用 | Related Work 的 IRE 小节中，以 [29],[30],[31] 列举方式引用 PacketGame，归类为"通过最小化输入区域减少计算"的工作之一，属标准背景引用，无褒贬。 |
| 5 | Online Container Caching with Late-Warm for IoT Data Processing | Guopeng Li, Haisheng Tan, Xuan Zhang, Chi Zhang, Ruiting Zhou 等 (7 人) | USTC; Southeast University; Microsoft Research Asia | IEEE ICDE 2024 | 2024 | A | "An object detection and recognition task using a motion-activated camera is triggered by motion, completes within 5 seconds, and experiences a surge in frequency when more objects are detected [16], [17]." | 一般引用 | Introduction 中引用 PacketGame [16] 作为 IoT 场景下物体检测任务的示例，说明动态相机触发的推理任务特征，属标准背景引用。 |

> **#2 高度评价背景**:
> - **知名作者**: Yunxin Liu / 刘云新（IEEE Fellow, 清华大学智能产业研究院副院长, 原 MSRA 首席研究经理）; Guihai Chen / 陈贵海（IEEE Fellow, CCF Fellow, 国家杰青）; Haipeng Dai / 戴海鹏（教育部青年长江学者, IET Fellow）
> - **头部机构**: 南京大学计算机科学与技术系（国家重点实验室, CSRankings 中国 Top-5）; 清华大学智能产业研究院 (AIR)

### 总结
- 高度评价: 1 citations (20.0%)
- 一般引用: 4 citations (80.0%)
- 批评性引用: 0 citations (0.0%)

---

## 整体总结

| 评价类型 | 次数 | 占比 |
|---------|------|------|
| 高度评价 | 1 | 20.0% |
| 一般引用 | 4 | 80.0% |
| 批评性引用 | 0 | 0.0% |

**总体分析**: PacketGame 在 5 篇引用论文中被广泛引用，覆盖实时视频分析 (VaLoRA, EuroSys'25)、视频语言查询 (Déjà Vu, VLDB'25)、超高清直播超分辨率 (Palantir, MMSys'25)、多模态移动推理 (AMRE, IEEE TMC'25)、IoT 容器缓存 (OnCoLa, ICDE'24) 等多个方向。其中 VaLoRA 在三个章节中 3 次引用 PacketGame 作为实时视频分析的代表性工作，体现了较高的学术认可度。整体而言，PacketGame 被定位为并发视频推理领域的重要基础性工作，无批评性引用。高度评价引用中包含 3 位知名学者（IEEE Fellow: Yunxin Liu、Guihai Chen; 国家杰青: Guihai Chen; 青年长江: Haipeng Dai）和 2 所头部机构（南京大学国家重点实验室、清华大学 AIR），进一步表明 PacketGame 获得了领域内顶尖团队的认可。
