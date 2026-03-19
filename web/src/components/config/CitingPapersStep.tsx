import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import type { SelectedPaper, CitingPaper, TargetPaperWithCitings, OpenAlexWork } from '../../types';
import { resolveWorkByTitle, resolveByDoi, getCitingWorks } from '../../services/openalex';
import { getS2CitingPapers } from '../../services/semanticScholar';
import { lookupCCF } from '../../services/ccfLookup';

interface Props {
  selectedPapers: SelectedPaper[];
  onConfirm: (results: TargetPaperWithCitings[]) => void;
  onBack: () => void;
}

type Phase = 'resolving' | 'manual_resolve' | 'fetching' | 'ready';

interface ResolvedPaper {
  openalex_id: string;
  title: string;
  year: number;
  doi: string;
  venue: string;
  resolved: boolean;
}

function oaWorkToCiting(w: OpenAlexWork): CitingPaper {
  const venue = w.primary_location?.source?.display_name ?? '';
  const authors = (w.authorships ?? []).map((a) => a.author.display_name).join(', ');
  const doi = w.doi?.replace('https://doi.org/', '') ?? '';
  return {
    openalex_id: w.id.replace('https://openalex.org/', ''),
    title: w.title,
    year: w.publication_year,
    venue,
    doi,
    authors,
    ccf_rank: lookupCCF(venue),
    cited_by_count: w.cited_by_count,
    oa_url: w.open_access?.oa_url ?? '',
    pdf_source: w.open_access?.oa_url ? 'oa' : 'unknown',
    pdf_filename: '',
    pdf_folder: '',
  };
}

type SortKey = 'year' | 'cited' | 'title' | 'ccf';
type SortDir = 'asc' | 'desc';

const CCF_OPTS = ['A', 'B', 'C'] as const;

function normalizeDashes(s: string): string {
  return s.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\uFE58\uFE63\uFF0D]/g, '-');
}

function authorMatches(authors: string, name: string): boolean {
  return normalizeDashes(authors.toLowerCase()).includes(normalizeDashes(name.toLowerCase()));
}

function matchesFilter(
  c: CitingPaper,
  ccfFilter: Set<string>,
  yearFrom: string,
  yearTo: string,
  excludeAuthors: string[],
  includeAuthors: string[],
): boolean {
  if (ccfFilter.size > 0 && !ccfFilter.has(c.ccf_rank)) return false;
  if (yearFrom) {
    const from = parseInt(yearFrom, 10);
    if (!isNaN(from) && c.year < from) return false;
  }
  if (yearTo) {
    const to = parseInt(yearTo, 10);
    if (!isNaN(to) && c.year > to) return false;
  }
  if (excludeAuthors.length > 0) {
    for (const name of excludeAuthors) {
      if (authorMatches(c.authors, name)) return false;
    }
  }
  if (includeAuthors.length > 0) {
    if (!includeAuthors.some((name) => authorMatches(c.authors, name))) return false;
  }
  return true;
}

export default function CitingPapersStep({ selectedPapers, onConfirm, onBack }: Props) {
  const [phase, setPhase] = useState<Phase>('resolving');
  const [targets, setTargets] = useState<TargetPaperWithCitings[]>([]);
  const [resolveProgress, setResolveProgress] = useState({ done: 0, total: 0 });
  const [resolvedPapers, setResolvedPapers] = useState<ResolvedPaper[]>([]);
  const [manualDois, setManualDois] = useState<Record<number, string>>({});
  const [manualResolving, setManualResolving] = useState<Set<number>>(new Set());
  const [fetchProgress, setFetchProgress] = useState<Record<number, { loaded: number; status: string }>>({});
  const [activeTab, setActiveTab] = useState(0);
  const [selections, setSelections] = useState<Map<number, Set<string>>>(new Map());

  const [search, setSearch] = useState('');
  const [ccfFilter, setCcfFilter] = useState<Set<string>>(new Set());
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [excludeAuthorsText, setExcludeAuthorsText] = useState('');
  const [includeAuthorsText, setIncludeAuthorsText] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('year');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const excludeAuthors = useMemo(
    () => excludeAuthorsText.split(/[,\n]/).map((s) => s.trim()).filter(Boolean),
    [excludeAuthorsText],
  );
  const includeAuthors = useMemo(
    () => includeAuthorsText.split(/[,\n]/).map((s) => s.trim()).filter(Boolean),
    [includeAuthorsText],
  );

  const prevFilterRef = useRef({ ccf: new Set<string>(), yearFrom: '', yearTo: '', excludeAuthors: '', includeAuthors: '' });

  // Phase 1: auto-resolve paper IDs
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setPhase('resolving');
      const total = selectedPapers.length;
      setResolveProgress({ done: 0, total });

      const results: ResolvedPaper[] = [];

      for (let i = 0; i < selectedPapers.length; i++) {
        if (cancelled) return;
        const p = selectedPapers[i];
        let oaId = p.id.startsWith('gs-') ? '' : p.id;
        let doi = p.doi;

        if (!oaId || oaId.startsWith('gs-')) {
          const match = await resolveWorkByTitle(p.title, p.year);
          if (match) {
            oaId = match.openalex_id;
            doi = match.doi || doi;
          }
        }
        results.push({
          openalex_id: oaId,
          title: p.title,
          year: p.year,
          doi,
          venue: p.venue,
          resolved: !!oaId,
        });
        setResolveProgress({ done: i + 1, total });
      }

      if (!cancelled) {
        setResolvedPapers(results);
        const hasUnresolved = results.some((r) => !r.resolved);
        setPhase(hasUnresolved ? 'manual_resolve' : 'fetching');
      }
    }

    run();
    return () => { cancelled = true; };
  }, [selectedPapers]);

  // Phase 2 helper: manual DOI resolve for a single paper
  const handleManualResolve = useCallback(async (idx: number) => {
    const raw = (manualDois[idx] ?? '').trim();
    if (!raw) return;
    const cleanDoi = raw.replace(/^https?:\/\/doi\.org\//i, '').replace(/^doi:/i, '').trim();
    if (!cleanDoi) return;

    setManualResolving((prev) => new Set(prev).add(idx));
    try {
      const match = await resolveByDoi(cleanDoi);
      if (match) {
        setResolvedPapers((prev) =>
          prev.map((p, i) =>
            i === idx ? { ...p, openalex_id: match.openalex_id, doi: match.doi, resolved: true } : p
          )
        );
      } else {
        alert(`Could not find a paper with DOI "${cleanDoi}" in OpenAlex.`);
      }
    } catch {
      alert('Lookup failed. Please check the DOI and try again.');
    } finally {
      setManualResolving((prev) => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
    }
  }, [manualDois]);

  const handleResolveAll = useCallback(async () => {
    const unresolvedIdxs = resolvedPapers
      .map((p, i) => (!p.resolved && manualDois[i]?.trim() ? i : -1))
      .filter((i) => i >= 0);
    for (const idx of unresolvedIdxs) {
      await handleManualResolve(idx);
    }
  }, [resolvedPapers, manualDois, handleManualResolve]);

  const handleProceedToFetch = useCallback(() => {
    setPhase('fetching');
  }, []);

  // Phase 3: fetch citing papers (triggered when phase becomes 'fetching')
  useEffect(() => {
    if (phase !== 'fetching' || resolvedPapers.length === 0) return;
    let cancelled = false;

    async function fetchCitings() {
      const results: TargetPaperWithCitings[] = [];
      const initSelections = new Map<number, Set<string>>();

      for (let i = 0; i < resolvedPapers.length; i++) {
        if (cancelled) return;
        const t = resolvedPapers[i];
        setFetchProgress((prev) => ({ ...prev, [i]: { loaded: 0, status: 'fetching' } }));

        let citings: CitingPaper[] = [];

        if (t.openalex_id) {
          try {
            const works = await getCitingWorks(t.openalex_id, (n) => {
              if (!cancelled) setFetchProgress((prev) => ({ ...prev, [i]: { loaded: n, status: 'fetching' } }));
            });
            citings = works.map(oaWorkToCiting);
          } catch { /* fallback below */ }
        }

        if (citings.length === 0) {
          try {
            const s2papers = await getS2CitingPapers(t.title, t.year, (n) => {
              if (!cancelled) setFetchProgress((prev) => ({ ...prev, [i]: { loaded: n, status: 'fetching (S2)' } }));
            });
            citings = s2papers.map((p) => ({
              openalex_id: '',
              title: p.title,
              year: p.year,
              venue: p.venue,
              doi: p.doi,
              authors: p.authors,
              ccf_rank: lookupCCF(p.venue),
              cited_by_count: p.citationCount,
              oa_url: '',
              pdf_source: 'unknown' as const,
              pdf_filename: '',
              pdf_folder: '',
            }));
          } catch { /* no results */ }
        }

        setFetchProgress((prev) => ({ ...prev, [i]: { loaded: citings.length, status: 'done' } }));

        results.push({
          openalex_id: t.openalex_id,
          title: t.title,
          year: t.year,
          doi: t.doi,
          venue: t.venue,
          all_citings: citings,
          selected_citings: citings,
        });
        initSelections.set(i, new Set(citings.map((_, ci) => String(ci))));
      }

      if (!cancelled) {
        setTargets(results);
        setSelections(initSelections);
        setPhase('ready');
      }
    }

    fetchCitings();
    return () => { cancelled = true; };
  }, [phase, resolvedPapers]);

  // When filters change: deselect non-matching, re-select matching
  useEffect(() => {
    if (phase !== 'ready' || targets.length === 0) return;
    const prev = prevFilterRef.current;
    const ccfChanged = ccfFilter.size !== prev.ccf.size || [...ccfFilter].some((r) => !prev.ccf.has(r));
    const yearChanged = yearFrom !== prev.yearFrom || yearTo !== prev.yearTo;
    const exclChanged = excludeAuthorsText !== prev.excludeAuthors;
    const inclChanged = includeAuthorsText !== prev.includeAuthors;
    if (!ccfChanged && !yearChanged && !exclChanged && !inclChanged) return;

    prevFilterRef.current = { ccf: new Set(ccfFilter), yearFrom, yearTo, excludeAuthors: excludeAuthorsText, includeAuthors: includeAuthorsText };

    const hasAnyFilter = ccfFilter.size > 0 || yearFrom || yearTo || excludeAuthors.length > 0 || includeAuthors.length > 0;

    setSelections((prev) => {
      const next = new Map(prev);
      targets.forEach((t, ti) => {
        const s = new Set(next.get(ti) ?? []);
        t.all_citings.forEach((c, ci) => {
          const key = String(ci);
          if (hasAnyFilter) {
            if (matchesFilter(c, ccfFilter, yearFrom, yearTo, excludeAuthors, includeAuthors)) {
              s.add(key);
            } else {
              s.delete(key);
            }
          } else {
            s.add(key);
          }
        });
        next.set(ti, s);
      });
      return next;
    });
  }, [ccfFilter, yearFrom, yearTo, excludeAuthors, excludeAuthorsText, includeAuthors, includeAuthorsText, phase, targets]);

  const currentCitings = targets[activeTab]?.all_citings ?? [];

  // Sort + search (search hides for navigation; CCF/year filters only affect selection, not visibility)
  const displayed = useMemo(() => {
    let list = currentCitings;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.authors.toLowerCase().includes(q) ||
          c.venue.toLowerCase().includes(q) ||
          String(c.year).includes(q),
      );
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      if (sortKey === 'year') return (a.year - b.year) * dir;
      if (sortKey === 'cited') return (a.cited_by_count - b.cited_by_count) * dir;
      if (sortKey === 'title') return a.title.localeCompare(b.title) * dir;
      if (sortKey === 'ccf') {
        const rank = (r: string) => r === 'A' ? 1 : r === 'B' ? 2 : r === 'C' ? 3 : 4;
        return (rank(a.ccf_rank) - rank(b.ccf_rank)) * dir;
      }
      return 0;
    });
    return list;
  }, [currentCitings, search, sortKey, sortDir]);

  const currentSel = selections.get(activeTab) ?? new Set<string>();

  const toggleOne = useCallback((idx: number) => {
    setSelections((prev) => {
      const next = new Map(prev);
      const s = new Set(next.get(activeTab) ?? []);
      const key = String(idx);
      if (s.has(key)) s.delete(key); else s.add(key);
      next.set(activeTab, s);
      return next;
    });
  }, [activeTab]);

  const selectAllVisible = useCallback(() => {
    const indices = displayed.map((c) => String(currentCitings.indexOf(c)));
    const allSel = indices.length > 0 && indices.every((i) => currentSel.has(i));
    setSelections((prev) => {
      const next = new Map(prev);
      const s = new Set(next.get(activeTab) ?? []);
      if (allSel) {
        indices.forEach((i) => s.delete(i));
      } else {
        indices.forEach((i) => s.add(i));
      }
      next.set(activeTab, s);
      return next;
    });
  }, [activeTab, displayed, currentCitings, currentSel]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'title' ? 'asc' : 'desc');
    }
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-primary-600 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const allVisibleSelected = displayed.length > 0 && displayed.every((c) => currentSel.has(String(currentCitings.indexOf(c))));

  const totalSelected = useMemo(() => {
    let count = 0;
    selections.forEach((s) => { count += s.size; });
    return count;
  }, [selections]);

  function handleConfirm() {
    const results = targets.map((t, ti) => {
      const sel = selections.get(ti) ?? new Set<string>();
      const selectedCitings = t.all_citings.filter((_, ci) => sel.has(String(ci)));
      return { ...t, selected_citings: selectedCitings };
    });
    onConfirm(results);
  }

  const toggleCcf = (rank: string) => {
    setCcfFilter((prev) => {
      const next = new Set(prev);
      if (next.has(rank)) next.delete(rank); else next.add(rank);
      return next;
    });
  };

  const hasAnyFilter = ccfFilter.size > 0 || yearFrom || yearTo || excludeAuthors.length > 0 || includeAuthors.length > 0;

  if (phase === 'resolving') {
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium text-primary-700">
              Resolving paper IDs... ({resolveProgress.done}/{resolveProgress.total})
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${resolveProgress.total ? (resolveProgress.done / resolveProgress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'manual_resolve') {
    const unresolved = resolvedPapers
      .map((p, i) => ({ paper: p, idx: i }))
      .filter(({ paper }) => !paper.resolved);
    const resolvedCount = resolvedPapers.filter((p) => p.resolved).length;
    const doiFilledCount = unresolved.filter(({ idx }) => manualDois[idx]?.trim()).length;

    return (
      <div className="space-y-4">
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Resolve Paper IDs</h2>
            <span className="text-sm text-gray-500">
              {resolvedCount}/{resolvedPapers.length} resolved
            </span>
          </div>

          {resolvedCount > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
              {resolvedCount} paper{resolvedCount > 1 ? 's' : ''} matched successfully.
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-amber-700 font-medium">
                {unresolved.length} paper{unresolved.length > 1 ? 's' : ''} not auto-matched — enter DOI to resolve
              </p>
              {doiFilledCount > 0 && (
                <button
                  onClick={handleResolveAll}
                  disabled={manualResolving.size > 0}
                  className="rounded-lg bg-primary-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-primary-700 disabled:opacity-50 transition"
                >
                  Resolve All ({doiFilledCount})
                </button>
              )}
            </div>

            <div className="space-y-3">
              {unresolved.map(({ paper, idx }) => (
                <div key={idx} className="bg-white rounded-lg p-3 border border-amber-200">
                  <div className="font-medium text-gray-800 text-sm">{paper.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {paper.year}{paper.venue ? ` · ${paper.venue}` : ''}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      value={manualDois[idx] ?? ''}
                      onChange={(e) => setManualDois((prev) => ({ ...prev, [idx]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && handleManualResolve(idx)}
                      placeholder="e.g. 10.1145/3495243.3517016"
                      className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                      onClick={() => handleManualResolve(idx)}
                      disabled={!manualDois[idx]?.trim() || manualResolving.has(idx)}
                      className="rounded-lg bg-gray-800 text-white px-3 py-1.5 text-xs font-medium hover:bg-gray-700 disabled:opacity-40 transition whitespace-nowrap"
                    >
                      {manualResolving.has(idx) ? (
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Resolving
                        </span>
                      ) : 'Resolve'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-gray-500 text-xs">
              Find the DOI on the paper's publisher page, or search at{' '}
              <a href="https://search.crossref.org/" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline">
                crossref.org
              </a>.
              Unresolved papers will still be included — citing papers will be fetched via Semantic Scholar as fallback.
            </p>
          </div>
        </div>

        <div className="flex justify-between">
          <button
            onClick={onBack}
            className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium hover:bg-gray-50 transition"
          >
            Back
          </button>
          <button
            onClick={handleProceedToFetch}
            className="rounded-lg bg-primary-600 text-white px-5 py-2 text-sm font-medium hover:bg-primary-700 transition"
          >
            Continue to Fetch Citing Papers
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'fetching') {
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium text-primary-700">Fetching citing papers...</span>
          </div>
          {selectedPapers.map((p, i) => {
            const fp = fetchProgress[i];
            return (
              <div key={i} className="bg-white rounded-lg p-3 border border-blue-100">
                <div className="text-sm font-medium text-gray-700 truncate">{p.title}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {!fp ? 'Waiting...' : fp.status === 'done' ? `Done: ${fp.loaded} papers found` : `Fetching: ${fp.loaded} papers loaded...`}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Step 3: Select Citing Papers</h2>
          <span className="text-sm text-gray-500">{totalSelected} citing papers selected</span>
        </div>

        {/* Tabs for target papers */}
        {targets.length > 1 && (
          <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
            {targets.map((t, i) => {
              const sel = selections.get(i)?.size ?? 0;
              return (
                <button
                  key={i}
                  onClick={() => setActiveTab(i)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                    activeTab === i
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t.title.length > 40 ? t.title.slice(0, 40) + '...' : t.title}
                  <span className="ml-1 opacity-70">({sel}/{t.all_citings.length})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Filter panel */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 space-y-2">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title, authors, venue..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              />
            </div>
            <div className="flex gap-2 items-center">
              {CCF_OPTS.map((r) => (
                <label key={r} className="flex items-center gap-1 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ccfFilter.has(r)}
                    onChange={() => toggleCcf(r)}
                    className="accent-primary-600"
                  />
                  CCF-{r}
                </label>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={yearFrom}
                onChange={(e) => setYearFrom(e.target.value)}
                placeholder="From"
                className="w-20 border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              />
              <span className="text-gray-400 text-xs">—</span>
              <input
                type="number"
                value={yearTo}
                onChange={(e) => setYearTo(e.target.value)}
                placeholder="To"
                className="w-20 border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 whitespace-nowrap">Exclude authors:</span>
            <input
              type="text"
              value={excludeAuthorsText}
              onChange={(e) => setExcludeAuthorsText(e.target.value)}
              placeholder="e.g. Mu Yuan, John Smith (comma-separated)"
              className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 whitespace-nowrap">Include authors:</span>
            <input
              type="text"
              value={includeAuthorsText}
              onChange={(e) => setIncludeAuthorsText(e.target.value)}
              placeholder="e.g. Alice Wang, Bob Lee (comma-separated, only select these)"
              className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            />
          </div>
        </div>

        <div className="text-xs text-gray-500 mb-2">
          {search.trim()
            ? `Showing ${displayed.length} of ${currentCitings.length} citing papers (search filtered)`
            : `${currentCitings.length} citing papers total`}
        </div>

        {/* Table */}
        <div className="max-h-[32rem] overflow-y-auto border border-gray-100 rounded-lg">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-left text-xs text-gray-500 uppercase">
              <tr>
                <th className="p-3 w-8">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={selectAllVisible}
                    className="accent-primary-600"
                  />
                </th>
                <th className="p-3 cursor-pointer hover:text-gray-700 select-none" onClick={() => handleSort('title')}>
                  Title{sortIcon('title')}
                </th>
                <th className="p-3 w-16 cursor-pointer hover:text-gray-700 select-none" onClick={() => handleSort('year')}>
                  Year{sortIcon('year')}
                </th>
                <th className="p-3 w-40">Venue</th>
                <th className="p-3 w-16 cursor-pointer hover:text-gray-700 select-none" onClick={() => handleSort('ccf')}>
                  CCF{sortIcon('ccf')}
                </th>
                <th className="p-3 w-16 text-right cursor-pointer hover:text-gray-700 select-none" onClick={() => handleSort('cited')}>
                  Cited{sortIcon('cited')}
                </th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((c) => {
                const globalIdx = currentCitings.indexOf(c);
                const key = String(globalIdx);
                const isSelected = currentSel.has(key);
                const isFilterMatch = matchesFilter(c, ccfFilter, yearFrom, yearTo, excludeAuthors, includeAuthors);
                const dimmed = hasAnyFilter && !isFilterMatch;
                return (
                  <tr
                    key={key}
                    onClick={() => toggleOne(globalIdx)}
                    className={`border-t border-gray-50 cursor-pointer transition ${
                      isSelected
                        ? 'bg-primary-50'
                        : dimmed
                          ? 'bg-gray-50/50'
                          : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(globalIdx)}
                        className="accent-primary-600"
                      />
                    </td>
                    <td className={`p-3 ${dimmed ? 'opacity-50' : ''}`}>
                      <div className="font-medium text-sm">{c.title}</div>
                      {c.authors && (
                        <div className="text-xs text-gray-400 mt-0.5 truncate max-w-lg">{c.authors}</div>
                      )}
                    </td>
                    <td className={`p-3 text-gray-500 ${dimmed ? 'opacity-50' : ''}`}>{c.year || '—'}</td>
                    <td className={`p-3 text-gray-500 truncate max-w-[10rem] ${dimmed ? 'opacity-50' : ''}`} title={c.venue}>{c.venue || '—'}</td>
                    <td className={`p-3 ${dimmed ? 'opacity-50' : ''}`}>
                      {c.ccf_rank ? (
                        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${
                          c.ccf_rank === 'A' ? 'bg-red-100 text-red-700' :
                          c.ccf_rank === 'B' ? 'bg-orange-100 text-orange-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {c.ccf_rank}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className={`p-3 text-right text-gray-500 ${dimmed ? 'opacity-50' : ''}`}>{c.cited_by_count}</td>
                  </tr>
                );
              })}
              {displayed.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-400">
                    No citing papers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium hover:bg-gray-50 transition"
        >
          Back
        </button>
        <button
          onClick={handleConfirm}
          disabled={totalSelected === 0}
          className="rounded-lg bg-primary-600 text-white px-5 py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition"
        >
          Next: PDF Preparation ({totalSelected} papers)
        </button>
      </div>
    </div>
  );
}
