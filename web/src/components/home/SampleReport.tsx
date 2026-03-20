import { Fragment } from 'react';
import { useLocale } from '../../i18n';
import type { Locale } from '../../i18n/translations';

type SentimentKey = 'high' | 'neutral' | 'critical';

type HighPraiseDetail = {
  scholars: { name: string; titles: string }[];
  institutions: string[];
};

const citations: {
  num: number;
  title: string;
  authors: string;
  institution: string;
  venue: string;
  year: number;
  rank: string;
  context: string;
  sentimentKey: SentimentKey;
  reasoning: Record<Locale, string>;
  highPraiseDetail?: Record<Locale, HighPraiseDetail>;
}[] = [
  {
    num: 1,
    title: 'Déjà Vu: Efficient Video-Language Query Engine with Learning-Based Inter-Frame Computation Reuse',
    authors: 'Jinwoo Hwang et al. (11)',
    institution: 'Korea University',
    venue: 'VLDB',
    year: 2025,
    rank: 'B',
    context: '"PacketGame [115] cited as related work in video inference computation reuse."',
    sentimentKey: 'neutral',
    reasoning: {
      en: 'Standard background citation in video inference.',
      zh: '视频推理领域相关工作引用，属标准背景引用。',
    },
  },
  {
    num: 2,
    title: 'Empower Vision Applications with LoRA LMM',
    authors: 'Liang Mi et al. (13)',
    institution: 'Nanjing Univ.; Tsinghua',
    venue: 'EuroSys',
    year: 2025,
    rank: 'A',
    context:
      '"Real-time video analytics application [92, 93] needs low latency..." / "...image classification [92], vehicle counting [57]..." / "...like prior work [79, 92]."',
    sentimentKey: 'high',
    reasoning: {
      en: 'Cited three times across sections as representative real-time video analytics work.',
      zh: '3 个章节中 3 次引用，作为实时视频分析领域的代表性工作。',
    },
    highPraiseDetail: {
      en: {
        scholars: [
          {
            name: 'Yunxin Liu',
            titles: 'IEEE Fellow; Deputy Dean, Tsinghua AIR; former MSRA Principal Research Manager',
          },
          {
            name: 'Guihai Chen',
            titles: 'IEEE Fellow, CCF Fellow; NSFC Distinguished Young Scholar',
          },
          {
            name: 'Haipeng Dai',
            titles: 'Ministry of Education Young Changjiang Scholar; IET Fellow',
          },
        ],
        institutions: [
          'Nanjing University — State Key Lab for Novel Software Technology; top-tier CS department (CSRankings)',
          'Tsinghua Institute for AI Industry Research (AIR)',
        ],
      },
      zh: {
        scholars: [
          { name: 'Yunxin Liu / 刘云新', titles: 'IEEE Fellow, 清华 AIR 副院长, 原 MSRA' },
          { name: 'Guihai Chen / 陈贵海', titles: 'IEEE Fellow, CCF Fellow, 国家杰青' },
          { name: 'Haipeng Dai / 戴海鹏', titles: '教育部青年长江学者, IET Fellow' },
        ],
        institutions: [
          '南京大学 — 计算机科学国家重点实验室, CSRankings 中国 Top-5',
          '清华大学智能产业研究院 (AIR)',
        ],
      },
    },
  },
  {
    num: 3,
    title: 'Palantir: Towards Efficient Super Resolution for Ultra-high-definition Live Streaming',
    authors: 'Xinqi Jin et al. (9)',
    institution: 'Tsinghua; Simon Fraser',
    venue: 'MMSys',
    year: 2025,
    rank: 'A',
    context:
      '"Commodity cameras...are typically not programmable [49] and thus not suitable for...DAG construction."',
    sentimentKey: 'neutral',
    reasoning: {
      en: 'Factual background in §6.1; no evaluative language.',
      zh: '§6.1 中作为背景事实引用，无褒贬。',
    },
  },
  {
    num: 4,
    title: 'AMRE: Adaptive Multilevel Redundancy Elimination for Multimodal Mobile Inference',
    authors: 'Qixuan Cai et al. (8)',
    institution: 'Tianjin University',
    venue: 'IEEE TMC',
    year: 2025,
    rank: 'A',
    context: '"Some works reduce model computation by minimizing certain input regions [29], [30], [31]."',
    sentimentKey: 'neutral',
    reasoning: {
      en: 'Listed in Related Work as input-region optimization.',
      zh: 'Related Work 中以列举方式归类为输入区域优化工作。',
    },
  },
  {
    num: 5,
    title: 'Online Container Caching with Late-Warm for IoT Data Processing',
    authors: 'Guopeng Li et al. (7)',
    institution: 'USTC; MSRA',
    venue: 'ICDE',
    year: 2024,
    rank: 'A',
    context: '"...experiences a surge in frequency when more objects are detected [16], [17]."',
    sentimentKey: 'neutral',
    reasoning: {
      en: 'Example IoT inference workload in the Introduction.',
      zh: 'Introduction 中作为 IoT 推理任务的示例引用。',
    },
  },
];

const sentimentStyle: Record<SentimentKey, string> = {
  high: 'bg-green-50 text-green-700 ring-green-200',
  neutral: 'bg-blue-50 text-blue-700 ring-blue-200',
  critical: 'bg-red-50 text-red-700 ring-red-200',
};

const rankStyle: Record<string, string> = {
  A: 'bg-red-50 text-red-600 ring-red-200',
  B: 'bg-amber-50 text-amber-600 ring-amber-200',
  C: 'bg-gray-50 text-gray-600 ring-gray-200',
};

function sentimentLabel(key: SentimentKey, t: { sentiment: { high: string; neutral: string; critical: string } }) {
  return t.sentiment[key];
}

export default function SampleReport() {
  const { locale, t } = useLocale();
  const s = t.sampleReport;

  return (
    <section className="py-20">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-3">{s.sectionTitle}</h2>
        <p className="text-center text-gray-500 mb-10 max-w-2xl mx-auto">
          {s.subtitleBeforeLink}{' '}
          <a
            href="https://doi.org/10.1145/3603269.3604825"
            target="_blank"
            rel="noreferrer"
            className="text-primary-600 underline hover:text-primary-700"
          >
            {s.linkPacketGame}
          </a>
          {s.subtitleAfterLink}
        </p>

        <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <h3 className="font-bold text-lg text-gray-900">{s.reportTitle}</h3>
              <span className="text-sm text-gray-500">{s.metaResearcher}</span>
              <span className="text-sm text-gray-500">{s.metaPapers}</span>
              <span className="text-sm text-gray-500">{s.metaCitations}</span>
            </div>
          </div>

          <div className="px-6 py-4 border-b border-gray-100 bg-white">
            <p className="font-semibold text-gray-800">{s.targetTitle}</p>
            <p className="text-sm text-gray-500 mt-1">{s.targetMeta}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-600">
                  <th className="px-4 py-3 font-semibold w-8">{s.table.num}</th>
                  <th className="px-4 py-3 font-semibold">{s.table.citingPaper}</th>
                  <th className="px-4 py-3 font-semibold">{s.table.institution}</th>
                  <th className="px-4 py-3 font-semibold">{s.table.venue}</th>
                  <th className="px-4 py-3 font-semibold w-12">{s.table.year}</th>
                  <th className="px-4 py-3 font-semibold w-12">{s.table.rank}</th>
                  <th className="px-4 py-3 font-semibold min-w-[220px]">{s.table.context}</th>
                  <th className="px-4 py-3 font-semibold w-24">{s.table.sentiment}</th>
                  <th className="px-4 py-3 font-semibold min-w-[180px]">{s.table.analysis}</th>
                </tr>
              </thead>
              <tbody>
                {citations.map((c) => {
                  const detail = c.highPraiseDetail?.[locale];
                  const reasoning = c.reasoning[locale];
                  const label = sentimentLabel(c.sentimentKey, s);
                  const isHigh = c.sentimentKey === 'high';
                  return (
                    <Fragment key={c.num}>
                      <tr
                        className={`border-t align-top ${isHigh ? 'border-green-200 bg-green-50/40' : 'border-gray-100'}`}
                      >
                        <td className="px-4 py-3 text-gray-400">{c.num}</td>
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {c.title.length > 60 ? c.title.slice(0, 60) + '...' : c.title}
                          <br />
                          <span className="text-xs text-gray-400">{c.authors}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{c.institution}</td>
                        <td className="px-4 py-3 text-gray-600">{c.venue}</td>
                        <td className="px-4 py-3 text-gray-600">{c.year}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2 py-0.5 text-xs font-bold rounded ring-1 ${rankStyle[c.rank] || ''}`}
                          >
                            {c.rank}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 leading-relaxed">
                          <span className="italic text-xs">{c.context}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ring-1 ${sentimentStyle[c.sentimentKey]}`}
                          >
                            {label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs leading-relaxed">{reasoning}</td>
                      </tr>
                      {detail && (
                        <tr className="bg-gradient-to-r from-green-50 to-emerald-50/50">
                          <td colSpan={9} className="px-4 py-0">
                            <div className="mx-4 my-3 rounded-lg border border-green-200 bg-white/80 shadow-sm px-5 py-4">
                              <div className="flex items-center gap-2 mb-3">
                                <span className="text-green-600 text-base">★</span>
                                <span className="text-sm font-bold text-green-800">{s.highPraiseCard}</span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                    {s.notableAuthors}
                                  </p>
                                  <ul className="space-y-1.5">
                                    {detail.scholars.map((sch) => (
                                      <li key={sch.name} className="text-sm text-gray-700">
                                        <span className="font-semibold text-gray-900">{sch.name}</span>
                                        <br />
                                        <span className="text-xs text-gray-500">{sch.titles}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                    {s.topInstitutions}
                                  </p>
                                  <ul className="space-y-1.5">
                                    {detail.institutions.map((inst, idx) => (
                                      <li key={idx} className="text-sm text-gray-700">
                                        {inst}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-400" />
                <span className="text-gray-600">
                  {s.summary.high} 1 (20%)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-400" />
                <span className="text-gray-600">
                  {s.summary.neutral} 4 (80%)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-orange-400" />
                <span className="text-gray-600">
                  {s.summary.critical} 0
                </span>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">{s.summary.footnote}</p>
          </div>
        </div>

        <p className="text-center mt-6 text-sm text-gray-400">
          <a
            href="https://github.com/yuanmu97/citation-impact/blob/main/example/citation_report.md"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-gray-600"
          >
            {s.viewFull}
          </a>
        </p>
      </div>
    </section>
  );
}
