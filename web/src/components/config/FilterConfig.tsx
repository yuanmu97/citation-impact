import { useState } from 'react';
import type { FilterConfig } from '../../types';

interface Props {
  filters: FilterConfig;
  onConfirm: (f: FilterConfig) => void;
  onBack: () => void;
}

const CCF_OPTIONS = ['CCF-A', 'CCF-B', 'CCF-C'];

export default function FilterConfigPanel({ filters: initial, onConfirm, onBack }: Props) {
  const [rankings, setRankings] = useState<string[]>(initial.venue_rankings);
  const [yearFrom, setYearFrom] = useState<string>(initial.year_range.from?.toString() ?? '');
  const [yearTo, setYearTo] = useState<string>(initial.year_range.to?.toString() ?? '');
  const [showAuthors, setShowAuthors] = useState(initial.authors.length > 0);
  const [authorsText, setAuthorsText] = useState(initial.authors.join('\n'));
  const [showAffiliations, setShowAffiliations] = useState(initial.affiliations.length > 0);
  const [affiliationsText, setAffiliationsText] = useState(initial.affiliations.join('\n'));

  function toggleRanking(r: string) {
    setRankings((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }

  function parseList(text: string): string[] {
    return text
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function handleConfirm() {
    onConfirm({
      venue_rankings: rankings,
      year_range: {
        from: yearFrom ? parseInt(yearFrom, 10) : null,
        to: yearTo ? parseInt(yearTo, 10) : null,
      },
      authors: showAuthors ? parseList(authorsText) : [],
      affiliations: showAffiliations ? parseList(affiliationsText) : [],
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-6">
        <h2 className="text-lg font-semibold">Step 3: Filter Conditions</h2>
        <p className="text-sm text-gray-500">
          Leave all empty to include all citing papers without filtering.
        </p>

        {/* CCF Rankings */}
        <div>
          <label className="block text-sm font-medium mb-2">Venue CCF Ranking</label>
          <div className="flex gap-4">
            {CCF_OPTIONS.map((r) => (
              <label key={r} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={rankings.includes(r)}
                  onChange={() => toggleRanking(r)}
                  className="accent-primary-600"
                />
                {r}
              </label>
            ))}
          </div>
        </div>

        {/* Year range */}
        <div>
          <label className="block text-sm font-medium mb-2">Publication Year Range</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={yearFrom}
              onChange={(e) => setYearFrom(e.target.value)}
              placeholder="From"
              className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <span className="text-gray-400">—</span>
            <input
              type="number"
              value={yearTo}
              onChange={(e) => setYearTo(e.target.value)}
              placeholder="To"
              className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Authors */}
        <div>
          <button
            type="button"
            onClick={() => setShowAuthors((v) => !v)}
            className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-800"
          >
            <span className={`transition-transform ${showAuthors ? 'rotate-90' : ''}`}>▶</span>
            Filter by Author Names
          </button>
          {showAuthors && (
            <div className="mt-2">
              <textarea
                value={authorsText}
                onChange={(e) => setAuthorsText(e.target.value)}
                placeholder="One author per line, or separate by commas"
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          )}
        </div>

        {/* Affiliations */}
        <div>
          <button
            type="button"
            onClick={() => setShowAffiliations((v) => !v)}
            className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-800"
          >
            <span className={`transition-transform ${showAffiliations ? 'rotate-90' : ''}`}>▶</span>
            Filter by Author Affiliations
          </button>
          {showAffiliations && (
            <div className="mt-2">
              <textarea
                value={affiliationsText}
                onChange={(e) => setAffiliationsText(e.target.value)}
                placeholder="One institution per line, or separate by commas"
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          )}
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
          className="rounded-lg bg-primary-600 text-white px-5 py-2 text-sm font-medium hover:bg-primary-700 transition"
        >
          Next: Export Config
        </button>
      </div>
    </div>
  );
}
