import { Link } from 'react-router-dom';

const steps = [
  {
    num: '1',
    title: 'Configure Locally',
    desc: 'Run this web UI on your machine. Search your profile, pick papers, and set filter conditions.',
  },
  {
    num: '2',
    title: 'Export Config',
    desc: 'Config and PDF folders are saved directly to your local project directory.',
  },
  {
    num: '3',
    title: 'Run the Agent',
    desc: 'Open the directory in Cursor or Claude Code and let the agent analyze your citations.',
  },
];

export default function QuickStart() {
  return (
    <section className="py-20">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold mb-12">Quick Start</h2>
        <div className="grid sm:grid-cols-3 gap-8 mb-12">
          {steps.map((s) => (
            <div key={s.num}>
              <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 font-bold text-lg flex items-center justify-center mx-auto mb-4">
                {s.num}
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
          Open Config Tool <span aria-hidden="true">&rarr;</span>
        </Link>
      </div>
    </section>
  );
}
