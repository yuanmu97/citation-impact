import { Link } from 'react-router-dom';

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-accent-600 text-white">
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_50%,white_0%,transparent_60%)]" />
      <div className="relative max-w-5xl mx-auto px-4 py-24 text-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
          Analyze Your Paper's
          <br />
          Citation&nbsp;Impact
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-white/80 max-w-2xl mx-auto leading-relaxed">
          An AI-powered agent skill that automatically retrieves, filters, and
          analyzes how your academic papers are cited — complete with CCF
          rankings and sentiment analysis.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/config"
            className="inline-flex items-center gap-2 rounded-lg bg-white text-primary-700 px-6 py-3 font-semibold shadow-lg hover:shadow-xl transition"
          >
            Open Config Tool
            <span aria-hidden="true">&rarr;</span>
          </Link>
          <a
            href="https://github.com/yuanmu97/citation-impact"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-6 py-3 font-semibold hover:bg-white/10 transition"
          >
            View on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}
