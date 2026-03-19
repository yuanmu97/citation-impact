import { Link, useLocation } from 'react-router-dom';

export default function Navbar() {
  const { pathname } = useLocation();
  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg text-primary-700">
          <span className="text-2xl">📊</span>
          Citation&nbsp;Impact
        </Link>
        <div className="flex items-center gap-6 text-sm font-medium">
          <Link
            to="/"
            className={`transition ${pathname === '/' ? 'text-primary-600' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Home
          </Link>
          <Link
            to="/config"
            className={`transition ${pathname === '/config' ? 'text-primary-600' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Config Tool
          </Link>
          <a
            href="https://github.com/your-username/citation-impact"
            target="_blank"
            rel="noreferrer"
            className="text-gray-500 hover:text-gray-900 transition"
          >
            GitHub
          </a>
        </div>
      </div>
    </nav>
  );
}
