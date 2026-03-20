import { useLocale } from '../../i18n';

const icons = ['🔍', '📋', '📄', '🤖', '⚡', '🛠️'];

export default function Features() {
  const { t } = useLocale();

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-12">{t.features.sectionTitle}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {t.features.items.map((f, i) => (
            <div
              key={f.title}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition"
            >
              <div className="text-3xl mb-3">{icons[i] ?? '•'}</div>
              <h3 className="font-semibold text-lg mb-1">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
