const features = [
  {
    icon: '🔍',
    title: 'Smart Scholar Search',
    desc: 'Find researchers via Google Scholar ID or name using the OpenAlex academic graph.',
  },
  {
    icon: '📋',
    title: 'Flexible Filtering',
    desc: 'Filter citing papers by CCF ranking (A/B/C), publication year, author, and affiliation.',
  },
  {
    icon: '📄',
    title: 'PDF Analysis',
    desc: 'Automatically downloads open-access PDFs and extracts the exact citation context.',
  },
  {
    icon: '🤖',
    title: 'AI Sentiment',
    desc: 'The agent analyzes whether each citation is a high praise, neutral reference, or critique.',
  },
  {
    icon: '⚡',
    title: 'Parallel Processing',
    desc: 'Processes multiple papers concurrently for maximum speed.',
  },
  {
    icon: '🛠️',
    title: 'Multi-Platform',
    desc: 'Works as both a Cursor Agent Skill and a Claude Code Agent Skill.',
  },
];

export default function Features() {
  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-12">Key Features</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition"
            >
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-lg mb-1">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
