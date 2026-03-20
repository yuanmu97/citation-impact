import { Link, useLocation } from 'react-router-dom';
import { useLocale } from '../../i18n';

export default function Navbar() {
  const { pathname } = useLocation();
  const { locale, setLocale, t } = useLocale();

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg text-primary-700">
          <span className="text-2xl">📊</span>
          Citation&nbsp;Impact
        </Link>
        <div className="flex items-center gap-4 sm:gap-6 text-sm font-medium">
          <div
            className="flex rounded-lg border border-gray-200 overflow-hidden bg-gray-50"
            role="group"
            aria-label="Language"
          >
            <button
              type="button"
              onClick={() => setLocale('en')}
              className={`px-2.5 py-1 text-xs font-semibold transition ${
                locale === 'en'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.nav.langEn}
            </button>
            <button
              type="button"
              onClick={() => setLocale('zh')}
              className={`px-2.5 py-1 text-xs font-semibold transition border-l border-gray-200 ${
                locale === 'zh'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.nav.langZh}
            </button>
          </div>
          <Link
            to="/config"
            className={`transition ${pathname === '/config' ? 'text-primary-600' : 'text-gray-500 hover:text-gray-900'}`}
          >
            {t.nav.configTool}
          </Link>
          <a
            href="https://github.com/yuanmu97/citation-impact"
            target="_blank"
            rel="noreferrer"
            className="text-gray-500 hover:text-gray-900 transition"
          >
            {t.nav.github}
          </a>
        </div>
      </div>
    </nav>
  );
}
