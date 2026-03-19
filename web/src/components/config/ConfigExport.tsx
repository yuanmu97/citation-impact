import { useMemo, useState, useEffect, useRef } from 'react';
import yaml from 'js-yaml';
import type { TargetPaperWithCitings } from '../../types';
import type { AuthorInfo } from '../../pages/ConfigPage';
import { writeTextFile } from '../../services/fsAccess';

interface Props {
  author: AuthorInfo;
  targets: TargetPaperWithCitings[];
  pdfDir: string;
  dirHandle: FileSystemDirectoryHandle | null;
  onBack: () => void;
}

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-blue-900">{label}</div>
      <div
        className="relative group bg-white border border-blue-200 rounded-lg px-4 py-3 font-mono text-sm cursor-pointer hover:bg-blue-50/50 transition"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        <span className="text-gray-800 break-all">{text}</span>
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition">
          {copied ? '✓ Copied' : 'Click to copy'}
        </span>
      </div>
    </div>
  );
}

export default function ConfigExport({ author, targets, pdfDir, dirHandle, onBack }: Props) {
  const [copied, setCopied] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');

  const totalCiting = useMemo(
    () => targets.reduce((sum, t) => sum + t.selected_citings.length, 0),
    [targets],
  );

  const config = useMemo(() => {
    const obj = {
      version: '2.0',
      researcher: {
        name: author.name,
        google_scholar_id: author.googleScholarId || '',
        openalex_id: author.openalexId || '',
      },
      target_papers: targets.map((t) => ({
        openalex_id: t.openalex_id,
        title: t.title,
        year: t.year,
        doi: t.doi,
        citing_papers: t.selected_citings.map((c) => ({
          openalex_id: c.openalex_id,
          title: c.title,
          year: c.year,
          doi: c.doi,
          venue: c.venue,
          ccf_rank: c.ccf_rank,
          authors: c.authors,
          pdf_source: c.pdf_source,
          pdf_folder: c.pdf_folder,
        })),
      })),
      options: {
        // 固定为 "."：流水线在工作区根目录执行，citation_pdfs 即 <workspace>/citation_pdfs/
        pdf_dir: '.',
        output_dir: './citation_output',
      },
    };
    return yaml.dump(obj, { lineWidth: 120, noRefs: true });
  }, [author, targets]);

  const savingRef = useRef(false);

  // Auto-save config.yaml to working directory
  useEffect(() => {
    if (!dirHandle || savingRef.current || saveStatus !== 'idle') return;
    savingRef.current = true;

    async function save() {
      setSaveStatus('saving');
      try {
        await writeTextFile(dirHandle!, 'config.yaml', config);
        setSaveStatus('saved');
      } catch (e) {
        setSaveStatus('error');
        setSaveError(e instanceof Error ? e.message : String(e));
      }
    }
    save();
  }, [dirHandle, config]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCopy() {
    await navigator.clipboard.writeText(config);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    const blob = new Blob([config], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.yaml';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleResave() {
    if (!dirHandle) return;
    setSaveStatus('saving');
    try {
      await writeTextFile(dirHandle, 'config.yaml', config);
      setSaveStatus('saved');
    } catch (e) {
      setSaveStatus('error');
      setSaveError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Step 5: Export Configuration</h2>
          <span className="text-xs text-gray-400">
            {targets.length} target papers, {totalCiting} citing papers
          </span>
        </div>

        {/* Auto-save status */}
        {dirHandle && (
          <div className={`rounded-lg p-3 text-sm ${
            saveStatus === 'saved'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : saveStatus === 'error'
                ? 'bg-red-50 border border-red-200 text-red-800'
                : 'bg-blue-50 border border-blue-200 text-blue-800'
          }`}>
            {saveStatus === 'saving' && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                Saving config.yaml...
              </div>
            )}
            {saveStatus === 'saved' && (
              <span>
                <span className="font-medium">config.yaml saved</span> to{' '}
                <code className="bg-green-100 px-1 rounded">{dirHandle.name}/config.yaml</code>
              </span>
            )}
            {saveStatus === 'error' && (
              <span>
                <span className="font-medium">Save failed:</span> {saveError}{' '}
                <button onClick={handleResave} className="underline hover:no-underline ml-2">Retry</button>
              </span>
            )}
          </div>
        )}

        <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto leading-relaxed max-h-96 overflow-y-auto">
          <code>{config}</code>
        </pre>

        <div className="flex gap-3">
          <button
            onClick={handleCopy}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 transition"
          >
            {copied ? '✓ Copied!' : 'Copy to Clipboard'}
          </button>
          {!dirHandle && (
            <button
              onClick={handleDownload}
              className="rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700 transition"
            >
              Download config.yaml
            </button>
          )}
          {dirHandle && saveStatus === 'saved' && (
            <button
              onClick={handleResave}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 transition"
            >
              Re-save to folder
            </button>
          )}
        </div>
      </div>

      {/* Next step */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-sm space-y-4">
        <h3 className="font-semibold text-blue-900">Next: Run the Analysis</h3>
        <p className="text-xs text-blue-700">
          Open your working directory
          {dirHandle ? <> (<code className="bg-blue-100 px-1 rounded">{dirHandle.name}/</code>)</> : ''} in
          Cursor or Claude Code, and paste the prompt below. The agent skill handles everything automatically.
        </p>

        <CopyBlock
          label="Cursor / Claude Code"
          text={`Analyze my citation impact using ${dirHandle ? `${dirHandle.name}/config.yaml` : 'config.yaml'}`}
        />

        <details className="text-xs text-gray-600">
          <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
            First time? Install the skill (one-time setup)
          </summary>
          <div className="mt-3 space-y-3">
            <CopyBlock
              label="Cursor"
              text="git clone https://github.com/yuanmu97/citation-impact.git ~/.cursor/skills/citation-impact"
            />
            <CopyBlock
              label="Claude Code"
              text="git clone https://github.com/yuanmu97/citation-impact.git ~/.claude/skills/citation-impact"
            />
          </div>
        </details>
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium hover:bg-gray-50 transition"
        >
          Back
        </button>
      </div>
    </div>
  );
}
