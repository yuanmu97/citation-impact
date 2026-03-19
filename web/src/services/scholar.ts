export interface GoogleScholarPaper {
  title: string;
  authors: string;
  venue: string;
  year: number;
  cited: number;
}

export interface GoogleScholarProfile {
  name: string;
  affiliation: string;
  interests: string[];
  citations: { all: number; recent: number };
  hIndex: { all: number; recent: number };
  papers: GoogleScholarPaper[];
}

const FETCH_TIMEOUT = 12_000;
const MAX_PROXY_ATTEMPTS = 2;

const profileCache = new Map<string, GoogleScholarProfile>();

type ProxyFn = (url: string) => string;

const CORS_PROXIES: ProxyFn[] = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isValidGsHtml(text: string): boolean {
  return text.includes('gsc_prf_in');
}

/**
 * Try local Vite dev proxy first (no CORS issues, uses your own network).
 * Falls back to public CORS proxies when dev proxy is not available.
 */
async function fetchGsPage(gsPath: string): Promise<string> {
  // Strategy 1: Local dev proxy (works when running `npm run dev`)
  try {
    const res = await fetchWithTimeout(`/scholar-proxy${gsPath}`, 8_000);
    if (res.ok) {
      const text = await res.text();
      if (isValidGsHtml(text)) return text;
    }
  } catch { /* not running dev server or proxy not configured */ }

  // Strategy 2: Public CORS proxies (fallback when dev proxy unavailable)
  const targetUrl = `https://scholar.google.com${gsPath}`;
  const errors: string[] = [];

  for (let attempt = 0; attempt < MAX_PROXY_ATTEMPTS; attempt++) {
    for (const mkProxy of CORS_PROXIES) {
      try {
        const res = await fetchWithTimeout(mkProxy(targetUrl), FETCH_TIMEOUT);
        if (!res.ok) { errors.push(`HTTP ${res.status}`); continue; }
        const text = await res.text();
        if (isValidGsHtml(text)) return text;
        if (text.includes('<title>Sorry')) { errors.push('CAPTCHA'); continue; }
        errors.push(`no profile data (${text.length}b)`);
      } catch (e) {
        errors.push(e instanceof DOMException && e.name === 'AbortError' ? 'timeout' : String(e));
      }
    }
    if (attempt < MAX_PROXY_ATTEMPTS - 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  throw new Error(
    `Failed to fetch Google Scholar profile.\nLast errors: ${errors.slice(-3).join('; ')}`
  );
}

function stripTags(html: string): string {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el.textContent?.trim() ?? '';
}

export async function fetchGoogleScholarProfile(gsId: string): Promise<GoogleScholarProfile> {
  const cached = profileCache.get(gsId);
  if (cached) return cached;

  const path = `/citations?user=${encodeURIComponent(gsId)}&hl=en&cstart=0&pagesize=100`;
  const html = await fetchGsPage(path);

  const nameMatch = html.match(/<div id="gsc_prf_in"[^>]*>(.*?)<\/div>/);
  if (!nameMatch) throw new Error('Could not parse Google Scholar profile');
  const name = stripTags(nameMatch[1]);

  const affMatch = html.match(/<div class="gsc_prf_il">(.*?)<\/div>/);
  const affiliation = affMatch ? stripTags(affMatch[1]) : '';

  const interests = Array.from(
    html.matchAll(/class="gsc_prf_inta gs_ibl"[^>]*>(.*?)<\/a>/g),
    (m) => stripTags(m[1])
  );

  const stats = Array.from(
    html.matchAll(/<td class="gsc_rsb_std">(\d+)<\/td>/g),
    (m) => parseInt(m[1], 10)
  );
  const citations = { all: stats[0] ?? 0, recent: stats[1] ?? 0 };
  const hIndex = { all: stats[2] ?? 0, recent: stats[3] ?? 0 };

  const papers: GoogleScholarPaper[] = [];
  const rowRegex = /<tr class="gsc_a_tr">(.*?)<\/tr>/gs;
  for (const rowMatch of html.matchAll(rowRegex)) {
    const row = rowMatch[1];

    const titleMatch = row.match(/<a[^>]*class="gsc_a_at"[^>]*>(.*?)<\/a>/);
    const title = titleMatch ? stripTags(titleMatch[1]) : '';
    if (!title) continue;

    const grayDivs = Array.from(
      row.matchAll(/<div class="gs_gray">(.*?)<\/div>/gs),
      (m) => m[1]
    );
    const authors = grayDivs[0] ? stripTags(grayDivs[0]) : '';
    const venueRaw = grayDivs[1] ?? '';
    const venueClean = stripTags(venueRaw.replace(/<span[^>]*>.*?<\/span>/g, '')).replace(/,\s*$/, '').trim();

    const yearMatch = row.match(/<span class="gsc_a_h gsc_a_hc gs_ibl">(\d{4})<\/span>/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : 0;

    const citedMatch = row.match(/<a[^>]*class="gsc_a_ac gs_ibl"[^>]*>(\d*)<\/a>/);
    const cited = citedMatch && citedMatch[1] ? parseInt(citedMatch[1], 10) : 0;

    papers.push({ title, authors, venue: venueClean, year, cited });
  }

  const profile = { name, affiliation, interests, citations, hIndex, papers };
  profileCache.set(gsId, profile);
  return profile;
}
