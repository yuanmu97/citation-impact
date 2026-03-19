export interface OpenAlexAuthor {
  id: string;
  display_name: string;
  works_count: number;
  cited_by_count: number;
  last_known_institutions?: Array<{
    id: string;
    display_name: string;
    country_code: string;
  }>;
}

export interface OpenAlexWork {
  id: string;
  title: string;
  publication_year: number;
  doi?: string;
  cited_by_count: number;
  primary_location?: {
    source?: {
      display_name: string;
    };
  };
  authorships?: Array<{
    author: { id: string; display_name: string };
    institutions: Array<{ display_name: string }>;
  }>;
  open_access?: {
    oa_url?: string;
  };
}

/** Unified paper item used throughout the UI (populated from either OpenAlex or Google Scholar) */
export interface PaperItem {
  uid: string;
  title: string;
  authors: string;
  year: number;
  venue: string;
  cited: number;
  doi: string;
  openalex_id: string;
}

export interface SelectedPaper {
  id: string;
  title: string;
  year: number;
  venue: string;
  doi: string;
}

export interface CitingPaper {
  openalex_id: string;
  title: string;
  year: number;
  venue: string;
  doi: string;
  authors: string;
  ccf_rank: string;
  cited_by_count: number;
  oa_url: string;
  pdf_source: 'oa' | 'local' | 'unknown';
  pdf_filename: string;
  pdf_folder: string;
}

export interface TargetPaperWithCitings {
  openalex_id: string;
  title: string;
  year: number;
  doi: string;
  venue: string;
  all_citings: CitingPaper[];
  selected_citings: CitingPaper[];
}

export interface FilterConfig {
  venue_rankings: string[];
  year_range: { from: number | null; to: number | null };
  authors: string[];
  affiliations: string[];
}

export interface AppConfigV2 {
  version: '2.0';
  researcher: {
    name: string;
    google_scholar_id: string;
    openalex_id: string;
  };
  target_papers: Array<{
    openalex_id: string;
    title: string;
    year: number;
    doi: string;
    citing_papers: Array<{
      openalex_id: string;
      title: string;
      year: number;
      doi: string;
      venue: string;
      ccf_rank: string;
      authors: string;
      pdf_source: string;
      pdf_folder: string;
    }>;
  }>;
  options: {
    pdf_dir: string;
    output_dir: string;
  };
}

/** @deprecated Use AppConfigV2 for new configs */
export interface AppConfig {
  version: string;
  researcher: {
    name: string;
    google_scholar_id: string;
    openalex_id: string;
  };
  papers: SelectedPaper[];
  filters: FilterConfig;
  options: {
    download_pdfs: boolean;
    output_dir: string;
  };
}

export interface CCFRankings {
  journals: Record<string, { fullname: string; rank: string; field: string }>;
  conferences: Record<string, { fullname: string; rank: string; field: string }>;
  all_by_name: Record<string, string>;
}
