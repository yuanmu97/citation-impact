const S2_BASE = 'https://api.semanticscholar.org/graph/v1';

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function s2Fetch(path: string, retries = 2): Promise<unknown> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${S2_BASE}${path}`);
    if (res.ok) return res.json();
    if (res.status === 429 && attempt < retries) {
      await delay(3000 * (attempt + 1));
      continue;
    }
    throw new Error(`S2 HTTP ${res.status}`);
  }
  throw new Error('S2 retries exhausted');
}

export interface S2PaperResult {
  paperId: string;
  title: string;
  year: number;
  doi: string;
  citationCount: number;
}

export interface S2CitingPaper {
  paperId: string;
  title: string;
  year: number;
  doi: string;
  venue: string;
  authors: string;
  citationCount: number;
}

const s2CitingCache = new Map<string, S2CitingPaper[]>();

export async function getS2CitingPapers(
  title: string,
  year?: number,
  onProgress?: (loaded: number) => void
): Promise<S2CitingPaper[]> {
  const paper = await searchPaperByTitle(title, year);
  if (!paper) return [];

  if (s2CitingCache.has(paper.paperId)) {
    const cached = s2CitingCache.get(paper.paperId)!;
    onProgress?.(cached.length);
    return cached;
  }

  const all: S2CitingPaper[] = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    try {
      const data = (await s2Fetch(
        `/paper/${paper.paperId}/citations?offset=${offset}&limit=${limit}&fields=title,year,externalIds,venue,authors,citationCount`
      )) as { data?: Array<{ citingPaper: { paperId: string; title: string; year: number; externalIds?: { DOI?: string }; venue?: string; authors?: Array<{ name: string }>; citationCount?: number } }> };
      const items = data.data ?? [];
      if (items.length === 0) break;
      for (const item of items) {
        const cp = item.citingPaper;
        if (!cp || !cp.title) continue;
        all.push({
          paperId: cp.paperId,
          title: cp.title,
          year: cp.year ?? 0,
          doi: cp.externalIds?.DOI ?? '',
          venue: cp.venue ?? '',
          authors: (cp.authors ?? []).map((a) => a.name).join(', '),
          citationCount: cp.citationCount ?? 0,
        });
      }
      onProgress?.(all.length);
      offset += items.length;
      if (items.length < limit) break;
    } catch {
      break;
    }
  }
  s2CitingCache.set(paper.paperId, all);
  return all;
}

const s2SearchCache = new Map<string, S2PaperResult | null>();

export async function searchPaperByTitle(
  title: string,
  year?: number
): Promise<S2PaperResult | null> {
  const cacheKey = `${title.toLowerCase().trim()}|${year ?? ''}`;
  if (s2SearchCache.has(cacheKey)) return s2SearchCache.get(cacheKey)!;
  try {
    const data = (await s2Fetch(
      `/paper/search?query=${encodeURIComponent(title)}&limit=5&fields=title,year,citationCount,externalIds`
    )) as { data?: Array<{ paperId: string; title: string; year: number; citationCount: number; externalIds?: { DOI?: string } }> };

    const needle = title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    for (const p of data.data ?? []) {
      const hay = (p.title ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const yearOk = !year || p.year === year;
      if ((hay === needle || hay.includes(needle) || needle.includes(hay)) && yearOk) {
        const result: S2PaperResult = {
          paperId: p.paperId,
          title: p.title,
          year: p.year,
          doi: p.externalIds?.DOI ?? '',
          citationCount: p.citationCount,
        };
        s2SearchCache.set(cacheKey, result);
        return result;
      }
    }
    if (data.data?.length && year) {
      const first = data.data.find((p) => p.year === year);
      if (first) {
        const result: S2PaperResult = {
          paperId: first.paperId,
          title: first.title,
          year: first.year,
          doi: first.externalIds?.DOI ?? '',
          citationCount: first.citationCount,
        };
        s2SearchCache.set(cacheKey, result);
        return result;
      }
    }
    s2SearchCache.set(cacheKey, null);
    return null;
  } catch {
    return null;
  }
}
