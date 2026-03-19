import ccfData from '../data/ccf_rankings.json';

interface CCFEntry {
  abbr: string;
  fullname: string;
  rank: string;
}

type VenueInfo = { fullname?: string; rank?: string; [k: string]: unknown };
const data = ccfData as Record<string, Record<string, VenueInfo | string>>;

const entries: CCFEntry[] = [];
const abbrMap = new Map<string, string>();
const fullnameMap = new Map<string, string>();

for (const category of ['journals', 'conferences'] as const) {
  const section = data[category] ?? {};
  for (const [abbr, info] of Object.entries(section)) {
    if (typeof info === 'string') continue;
    const rank = info.rank ?? '';
    const fullname = info.fullname ?? '';
    abbrMap.set(abbr.toLowerCase(), rank);
    if (fullname) fullnameMap.set(fullname.toLowerCase(), rank);
    entries.push({ abbr: abbr.toLowerCase(), fullname: fullname.toLowerCase(), rank });
  }
}

export function lookupCCF(venueName: string): string {
  if (!venueName) return '';
  const name = venueName.trim().toLowerCase();

  const byAbbr = abbrMap.get(name);
  if (byAbbr) return byAbbr;

  const byFull = fullnameMap.get(name);
  if (byFull) return byFull;

  for (const e of entries) {
    if (e.abbr && name.includes(e.abbr)) return e.rank;
  }
  for (const e of entries) {
    if (e.fullname && name.includes(e.fullname)) return e.rank;
  }
  for (const e of entries) {
    if (name && e.fullname.includes(name)) return e.rank;
  }

  return '';
}
