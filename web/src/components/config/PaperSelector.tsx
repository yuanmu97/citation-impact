import { useState, useMemo } from 'react';
import type { PaperItem, SelectedPaper } from '../../types';

interface Props {
  papers: PaperItem[];
  onConfirm: (papers: SelectedPaper[]) => void;
  onBack: () => void;
}

type SortKey = 'default' | 'year' | 'cited' | 'title';
type SortDir = 'asc' | 'desc';

export default function PaperSelector({ papers, onConfirm, onBack }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('default');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'title' ? 'asc' : 'desc');
    }
  }

  const processed = useMemo(() => {
    let list = papers;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          String(p.year).includes(q) ||
          p.venue.toLowerCase().includes(q) ||
          p.authors.toLowerCase().includes(q),
      );
    }
    if (sortKey !== 'default') {
      const dir = sortDir === 'asc' ? 1 : -1;
      list = [...list].sort((a, b) => {
        if (sortKey === 'year') return (a.year - b.year) * dir;
        if (sortKey === 'cited') return (a.cited - b.cited) * dir;
        if (sortKey === 'title') return a.title.localeCompare(b.title) * dir;
        return 0;
      });
    }
    return list;
  }, [papers, search, sortKey, sortDir]);

  const allFilteredSelected = processed.length > 0 && processed.every((p) => selected.has(p.uid));

  function toggleAll() {
    if (allFilteredSelected) {
      const next = new Set(selected);
      processed.forEach((p) => next.delete(p.uid));
      setSelected(next);
    } else {
      const next = new Set(selected);
      processed.forEach((p) => next.add(p.uid));
      setSelected(next);
    }
  }

  function toggle(uid: string) {
    const next = new Set(selected);
    if (next.has(uid)) next.delete(uid);
    else next.add(uid);
    setSelected(next);
  }

  function handleConfirm() {
    const sel: SelectedPaper[] = papers
      .filter((p) => selected.has(p.uid))
      .map((p) => ({
        id: p.openalex_id || p.uid,
        title: p.title,
        year: p.year,
        venue: p.venue,
        doi: p.doi,
      }));
    onConfirm(sel);
  }

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-primary-600 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Step 2: Select Papers</h2>
          <span className="text-sm text-gray-500">
            {selected.size} / {papers.length} selected
          </span>
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by title, year, venue, or authors..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />

        <div className="max-h-[28rem] overflow-y-auto border border-gray-100 rounded-lg">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-left text-xs text-gray-500 uppercase">
              <tr>
                <th className="p-3 w-8">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleAll}
                    className="accent-primary-600"
                  />
                </th>
                <th
                  className="p-3 cursor-pointer hover:text-gray-700 select-none"
                  onClick={() => handleSort('title')}
                >
                  Title{sortIcon('title')}
                </th>
                <th
                  className="p-3 w-20 cursor-pointer hover:text-gray-700 select-none"
                  onClick={() => handleSort('year')}
                >
                  Year{sortIcon('year')}
                </th>
                <th className="p-3 w-48">Venue</th>
                <th
                  className="p-3 w-20 text-right cursor-pointer hover:text-gray-700 select-none"
                  onClick={() => handleSort('cited')}
                >
                  Cited{sortIcon('cited')}
                </th>
              </tr>
            </thead>
            <tbody>
              {processed.map((p) => (
                <tr
                  key={p.uid}
                  onClick={() => toggle(p.uid)}
                  className={`border-t border-gray-50 cursor-pointer transition ${selected.has(p.uid) ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
                >
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(p.uid)}
                      onChange={() => toggle(p.uid)}
                      className="accent-primary-600"
                    />
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{p.title}</div>
                    {p.authors && (
                      <div className="text-xs text-gray-400 mt-0.5 truncate max-w-lg">{p.authors}</div>
                    )}
                  </td>
                  <td className="p-3 text-gray-500">{p.year || '—'}</td>
                  <td className="p-3 text-gray-500 truncate max-w-[12rem]">
                    {p.venue || '—'}
                  </td>
                  <td className="p-3 text-right text-gray-500">{p.cited}</td>
                </tr>
              ))}
              {processed.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-400">
                    No papers match your filter.
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
          disabled={selected.size === 0}
          className="rounded-lg bg-primary-600 text-white px-5 py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition"
        >
          Confirm ({selected.size} papers)
        </button>
      </div>
    </div>
  );
}
