import { useState } from 'react';
import type { OpenAlexAuthor, PaperItem } from '../../types';
import type { AuthorInfo } from '../../pages/ConfigPage';
import {
  searchAuthorByName,
  getAuthorByOpenAlexId,
  getAllAuthorWorks,
} from '../../services/openalex';
import { fetchGoogleScholarProfile, type GoogleScholarProfile } from '../../services/scholar';

interface Props {
  onConfirm: (author: AuthorInfo, papers: PaperItem[]) => void;
}

type SearchType = 'name' | 'gs' | 'openalex';

const placeholders: Record<SearchType, string> = {
  name: 'e.g. John Smith',
  gs: 'e.g. zzy5JCIAAAAJ',
  openalex: 'e.g. A5100390075',
};

function openAlexWorksToPaperItems(works: import('../../types').OpenAlexWork[]): PaperItem[] {
  return works.map((w, i) => ({
    uid: w.id || `oa-${i}`,
    title: w.title ?? '',
    authors: w.authorships?.map((a) => a.author.display_name).join(', ') ?? '',
    year: w.publication_year,
    venue: w.primary_location?.source?.display_name ?? '',
    cited: w.cited_by_count,
    doi: w.doi?.replace('https://doi.org/', '') ?? '',
    openalex_id: w.id.replace('https://openalex.org/', ''),
  }));
}

function gsProfileToPaperItems(profile: GoogleScholarProfile): PaperItem[] {
  return profile.papers.map((p, i) => ({
    uid: `gs-${i}`,
    title: p.title,
    authors: p.authors,
    year: p.year,
    venue: p.venue,
    cited: p.cited,
    doi: '',
    openalex_id: '',
  }));
}

export default function AuthorSearch({ onConfirm }: Props) {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('gs');
  const [oaResults, setOaResults] = useState<OpenAlexAuthor[]>([]);
  const [gsProfile, setGsProfile] = useState<GoogleScholarProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [loadingWorks, setLoadingWorks] = useState(false);
  const [error, setError] = useState('');

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setOaResults([]);
    setGsProfile(null);
    setStatusMsg('');

    try {
      if (searchType === 'gs') {
        await handleGoogleScholarSearch(query.trim());
      } else if (searchType === 'openalex') {
        const author = await getAuthorByOpenAlexId(query.trim());
        setOaResults(author ? [author] : []);
        if (!author) setError('No author found for this OpenAlex ID.');
      } else {
        const authors = await searchAuthorByName(query.trim());
        setOaResults(authors);
        if (authors.length === 0) setError('No authors found.');
      }
    } catch {
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleScholarSearch(gsId: string) {
    setStatusMsg('Fetching Google Scholar profile (trying multiple proxies)...');
    let profile: GoogleScholarProfile;
    try {
      profile = await fetchGoogleScholarProfile(gsId);
    } catch (e) {
      const detail = e instanceof Error ? e.message : '';
      setError(detail.includes('timeout') || detail.includes('Failed to fetch')
        ? 'gs_timeout' : 'gs_fetch_failed');
      return;
    }
    setGsProfile(profile);
    setStatusMsg('');
  }

  function handleGsConfirm() {
    if (!gsProfile) return;
    const info: AuthorInfo = {
      name: gsProfile.name,
      googleScholarId: query.trim(),
      openalexId: '',
    };
    onConfirm(info, gsProfileToPaperItems(gsProfile));
  }

  async function handleSelectOpenAlexAuthor(author: OpenAlexAuthor) {
    setLoadingWorks(true);
    setError('');
    try {
      const works = await getAllAuthorWorks(author.id);
      const info: AuthorInfo = {
        name: author.display_name,
        googleScholarId: '',
        openalexId: author.id.replace('https://openalex.org/', ''),
      };
      onConfirm(info, openAlexWorksToPaperItems(works));
    } catch {
      setError('Failed to load works. Please try again.');
    } finally {
      setLoadingWorks(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Step 1: Search Author</h2>

        <div className="flex flex-wrap gap-4 mb-4">
          {([
            ['gs', 'Google Scholar ID'],
            ['name', 'Author Name'],
            ['openalex', 'OpenAlex ID'],
          ] as [SearchType, string][]).map(([value, label]) => (
            <label key={value} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="radio"
                checked={searchType === value}
                onChange={() => { setSearchType(value); setError(''); setOaResults([]); setGsProfile(null); setStatusMsg(''); }}
                className="accent-primary-600"
              />
              {label}
            </label>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={placeholders[searchType]}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="rounded-lg bg-primary-600 text-white px-5 py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {statusMsg && (
          <p className="text-primary-600 text-sm mt-3 animate-pulse">{statusMsg}</p>
        )}

        {searchType === 'gs' && !loading && !error && !gsProfile && (
          <p className="text-gray-400 text-xs mt-3">
            From your profile URL: scholar.google.com/citations?user=<strong>YOUR_ID</strong>
          </p>
        )}
      </div>

      {/* Google Scholar Profile Card */}
      {gsProfile && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-lg text-gray-900">{gsProfile.name}</h3>
              {gsProfile.affiliation && (
                <p className="text-sm text-gray-600 mt-0.5">{gsProfile.affiliation}</p>
              )}
              {gsProfile.interests.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {gsProfile.interests.map((tag) => (
                    <span
                      key={tag}
                      className="bg-white/70 text-gray-600 text-xs px-2 py-0.5 rounded-full border border-blue-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="text-right text-sm text-gray-500 shrink-0 ml-4">
              <div>Citations: <strong className="text-gray-700">{gsProfile.citations.all.toLocaleString()}</strong></div>
              <div>h-index: <strong className="text-gray-700">{gsProfile.hIndex.all}</strong></div>
              <div className="text-xs mt-1">{gsProfile.papers.length} papers</div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-blue-600 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Profile loaded from Google Scholar
            </span>
            <button
              onClick={handleGsConfirm}
              className="rounded-lg bg-primary-600 text-white px-5 py-2 text-sm font-medium hover:bg-primary-700 transition"
            >
              Continue with {gsProfile.papers.length} papers
            </button>
          </div>
        </div>
      )}

      {/* Error states */}
      {(error === 'gs_fetch_failed' || error === 'gs_timeout') && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm space-y-3">
          <p className="text-amber-700 font-medium">
            {error === 'gs_timeout'
              ? 'Request timed out — proxy servers may be slow right now.'
              : 'Could not fetch Google Scholar profile.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSearch}
              className="rounded-lg bg-primary-600 text-white px-4 py-1.5 text-sm font-medium hover:bg-primary-700 transition"
            >
              Retry
            </button>
            <a
              href={`https://scholar.google.com/citations?user=${encodeURIComponent(query)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium hover:bg-gray-50 transition"
            >
              Open GS Profile
            </a>
          </div>
          <p className="text-gray-500 text-xs">
            Or switch to <strong>Author Name</strong> search and type your name directly.
          </p>
        </div>
      )}

      {error && !error.startsWith('gs_') && (
        <p className="text-red-500 text-sm">{error}</p>
      )}

      {/* OpenAlex author results (for name / openalex_id search) */}
      {loadingWorks && (
        <div className="text-center py-8 text-gray-500">Loading papers...</div>
      )}

      {oaResults.length > 0 && !loadingWorks && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Select an author to continue:</p>
          {oaResults.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => handleSelectOpenAlexAuthor(a)}
              className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:border-primary-400 hover:shadow-md transition"
            >
              <div className="font-semibold">{a.display_name}</div>
              <div className="text-sm text-gray-500 mt-1">
                {a.last_known_institutions?.[0]?.display_name ?? 'Unknown institution'}
                {' · '}
                {a.works_count} works · {a.cited_by_count.toLocaleString()} citations
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
