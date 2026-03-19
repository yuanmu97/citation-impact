import type { OpenAlexAuthor, OpenAlexWork } from '../types';

const BASE = 'https://api.openalex.org';
const PROXY = 'https://corsproxy.io/?';
const MAILTO = 'mailto=citation-impact@example.com';

async function fetchJson(endpoint: string): Promise<unknown> {
  const url = `${BASE}${endpoint}${endpoint.includes('?') ? '&' : '?'}${MAILTO}`;
  try {
    const res = await fetch(url);
    if (res.ok) return res.json();
    throw new Error(`HTTP ${res.status}`);
  } catch {
    const proxyUrl = `${PROXY}${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`);
    return res.json();
  }
}

export async function searchAuthorByName(name: string): Promise<OpenAlexAuthor[]> {
  const data = (await fetchJson(
    `/authors?search=${encodeURIComponent(name)}&per_page=10&select=id,display_name,works_count,cited_by_count,last_known_institutions`
  )) as { results: OpenAlexAuthor[] };
  return data.results ?? [];
}

export async function getAuthorByOpenAlexId(oaId: string): Promise<OpenAlexAuthor | null> {
  const id = oaId.startsWith('http') ? oaId.split('/').pop()! : oaId;
  try {
    const data = (await fetchJson(
      `/authors/${id}?select=id,display_name,works_count,cited_by_count,last_known_institutions`
    )) as OpenAlexAuthor;
    return data.id ? data : null;
  } catch {
    return null;
  }
}

export async function getAuthorWorks(
  authorId: string,
  cursor: string = '*'
): Promise<{ works: OpenAlexWork[]; nextCursor: string | null }> {
  const shortId = authorId.replace('https://openalex.org/', '');
  const data = (await fetchJson(
    `/works?filter=authorships.author.id:${shortId}&per_page=100&cursor=${cursor}&sort=publication_year:desc&select=id,title,publication_year,doi,cited_by_count,primary_location,authorships,open_access`
  )) as { results: OpenAlexWork[]; meta: { next_cursor: string | null } };
  return {
    works: data.results ?? [],
    nextCursor: data.meta?.next_cursor ?? null,
  };
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function titleSimilar(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  // One title might be an abbreviation (e.g. "InFi" vs full title)
  // Check if the shorter one appears as the first word(s) of the longer
  const [short, long] = na.length < nb.length ? [na, nb] : [nb, na];
  if (short.length >= 3 && long.startsWith(short + ' ')) return true;
  return false;
}

async function resolveByOpenAlexSearch(
  title: string,
  year?: number
): Promise<{ openalex_id: string; doi: string } | null> {
  try {
    const data = (await fetchJson(
      `/works?search=${encodeURIComponent(title)}&per_page=10&select=id,title,publication_year,doi`
    )) as { results: Array<{ id: string; title: string; publication_year: number; doi?: string }> };

    for (const w of data.results ?? []) {
      const yearOk = !year || Math.abs(w.publication_year - year) <= 1;
      if (titleSimilar(title, w.title ?? '') && yearOk) {
        return {
          openalex_id: w.id.replace('https://openalex.org/', ''),
          doi: w.doi?.replace('https://doi.org/', '') ?? '',
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

type ResolveResult = { openalex_id: string; doi: string } | null;
const doiCache = new Map<string, ResolveResult>();
const titleCache = new Map<string, ResolveResult>();

export async function resolveByDoi(
  doi: string
): Promise<ResolveResult> {
  const key = doi.toLowerCase().trim();
  if (doiCache.has(key)) return doiCache.get(key)!;
  try {
    const data = (await fetchJson(
      `/works/doi:${doi}?select=id,doi`
    )) as { id: string; doi?: string };
    if (data.id) {
      const result: ResolveResult = {
        openalex_id: data.id.replace('https://openalex.org/', ''),
        doi: data.doi?.replace('https://doi.org/', '') ?? doi,
      };
      doiCache.set(key, result);
      return result;
    }
    doiCache.set(key, null);
    return null;
  } catch {
    return null;
  }
}

/** Resolve a paper to its OpenAlex ID. Tries OpenAlex search first, then Semantic Scholar for DOI, then OpenAlex by DOI. */
export async function resolveWorkByTitle(
  title: string,
  year?: number
): Promise<ResolveResult> {
  const cacheKey = `${normalize(title)}|${year ?? ''}`;
  if (titleCache.has(cacheKey)) return titleCache.get(cacheKey)!;

  const oaResult = await resolveByOpenAlexSearch(title, year);
  if (oaResult) {
    titleCache.set(cacheKey, oaResult);
    return oaResult;
  }

  const { searchPaperByTitle } = await import('./semanticScholar');
  const s2Result = await searchPaperByTitle(title, year);
  if (s2Result?.doi) {
    const doiResult = await resolveByDoi(s2Result.doi);
    if (doiResult) {
      titleCache.set(cacheKey, doiResult);
      return doiResult;
    }
  }

  titleCache.set(cacheKey, null);
  return null;
}

export async function getAllAuthorWorks(authorId: string): Promise<OpenAlexWork[]> {
  const all: OpenAlexWork[] = [];
  let cursor: string | null = '*';
  while (cursor) {
    const { works, nextCursor } = await getAuthorWorks(authorId, cursor);
    all.push(...works);
    cursor = nextCursor;
    if (works.length === 0) break;
  }
  return all;
}

const citingWorksCache = new Map<string, OpenAlexWork[]>();

export async function getCitingWorks(
  workId: string,
  onProgress?: (loaded: number) => void
): Promise<OpenAlexWork[]> {
  const shortId = workId.replace('https://openalex.org/', '');
  if (citingWorksCache.has(shortId)) {
    const cached = citingWorksCache.get(shortId)!;
    onProgress?.(cached.length);
    return cached;
  }
  const all: OpenAlexWork[] = [];
  let cursor: string | null = '*';
  while (cursor) {
    const data = (await fetchJson(
      `/works?filter=cites:${shortId}&per_page=100&cursor=${cursor}&sort=publication_year:desc&select=id,title,publication_year,doi,cited_by_count,primary_location,authorships,open_access`
    )) as { results: OpenAlexWork[]; meta: { next_cursor: string | null } };
    const works = data.results ?? [];
    all.push(...works);
    onProgress?.(all.length);
    cursor = data.meta?.next_cursor ?? null;
    if (works.length === 0) break;
  }
  citingWorksCache.set(shortId, all);
  return all;
}
