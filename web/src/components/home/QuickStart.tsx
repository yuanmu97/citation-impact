import { Link } from 'react-router-dom';
import { useLocale } from '../../i18n';

export default function QuickStart() {
  const { t } = useLocale();

  return (
    <section className="py-20">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold mb-12">{t.quickStart.sectionTitle}</h2>
        <div className="grid sm:grid-cols-3 gap-8 mb-12">
          {t.quickStart.steps.map((s, i) => (
            <div key={s.title}>
              <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 font-bold text-lg flex items-center justify-center mx-auto mb-4">
                {String(i + 1)}
              </div>
              <h3 className="font-semibold mb-1">{s.title}</h3>
              <p className="text-sm text-gray-500">{s.desc}</p>
            </div>
          ))}
        </div>
        <Link
          to="/config"
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 text-white px-6 py-3 font-semibold hover:bg-primary-700 transition"
        >
          {t.quickStart.openConfig} <span aria-hidden="true">&rarr;</span>
        </Link>
        <p className="mt-4 text-xs text-gray-400">
          {t.quickStart.footnote}{' '}
          <a
            href={t.quickStart.readmeQuickStartUrl}
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-gray-600"
          >
            {t.quickStart.footnoteLink}
          </a>
          {t.quickStart.footnoteEnd}
        </p>
      </div>
    </section>
  );
}
