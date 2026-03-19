import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { TargetPaperWithCitings, CitingPaper } from '../../types';
import { ensureSubDir } from '../../services/fsAccess';

interface Props {
  targets: TargetPaperWithCitings[];
  dirHandle: FileSystemDirectoryHandle | null;
  onConfirm: (updated: TargetPaperWithCitings[], pdfDir: string) => void;
  onBack: () => void;
}

function sanitizeFolderName(title: string): string {
  return title
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

const PDF_ROOT_FOLDER = 'citation_pdfs';

type CreationStatus = 'idle' | 'creating' | 'done' | 'error';
type PdfStatus = 'oa' | 'found' | 'missing';

async function folderHasPdf(dirHandle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    for await (const [name] of (dirHandle as any).entries()) {
      if (typeof name === 'string' && name.toLowerCase().endsWith('.pdf')) return true;
    }
  } catch { /* permission or other error */ }
  return false;
}

export default function PdfPreparationStep({ targets, dirHandle, onConfirm, onBack }: Props) {
  const [manualPath, setManualPath] = useState('');
  const [creationStatus, setCreationStatus] = useState<CreationStatus>('idle');
  const [createdCount, setCreatedCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [expandedTarget, setExpandedTarget] = useState<number | null>(0);
  const [pdfStatusMap, setPdfStatusMap] = useState<Map<string, PdfStatus>>(new Map());
  const [scanning, setScanning] = useState(false);

  const allCitings = useMemo(() => {
    const list: Array<{ targetIdx: number; citing: CitingPaper; folder: string }> = [];
    targets.forEach((t, ti) => {
      t.selected_citings.forEach((c) => {
        list.push({
          targetIdx: ti,
          citing: c,
          folder: sanitizeFolderName(c.title),
        });
      });
    });
    return list;
  }, [targets]);

  const scanPdfStatus = useCallback(async () => {
    if (!dirHandle) return;
    setScanning(true);
    const statusMap = new Map<string, PdfStatus>();
    try {
      const pdfRoot = await dirHandle.getDirectoryHandle(PDF_ROOT_FOLDER);
      for (const item of allCitings) {
        if (item.citing.oa_url) {
          statusMap.set(item.folder, 'oa');
          continue;
        }
        try {
          const sub = await pdfRoot.getDirectoryHandle(item.folder);
          const has = await folderHasPdf(sub);
          statusMap.set(item.folder, has ? 'found' : 'missing');
        } catch {
          statusMap.set(item.folder, 'missing');
        }
      }
    } catch {
      for (const item of allCitings) {
        statusMap.set(item.folder, item.citing.oa_url ? 'oa' : 'missing');
      }
    }
    setPdfStatusMap(statusMap);
    setScanning(false);
  }, [dirHandle, allCitings]);

  const oaCount = useMemo(() => allCitings.filter((c) => c.citing.oa_url).length, [allCitings]);
  const foundCount = useMemo(() => {
    let n = 0;
    pdfStatusMap.forEach((v) => { if (v === 'found') n++; });
    return n;
  }, [pdfStatusMap]);
  const missingCount = allCitings.length - oaCount - foundCount;

  const creatingRef = useRef(false);

  useEffect(() => {
    if (!dirHandle || creatingRef.current || creationStatus !== 'idle') return;
    creatingRef.current = true;

    async function createFolders() {
      setCreationStatus('creating');
      setCreatedCount(0);
      try {
        const pdfRoot = await ensureSubDir(dirHandle!, PDF_ROOT_FOLDER);
        let count = 0;
        for (const item of allCitings) {
          await ensureSubDir(pdfRoot, item.folder);
          count++;
          setCreatedCount(count);
        }
        setCreationStatus('done');
      } catch (e) {
        setCreationStatus('error');
        setErrorMsg(e instanceof Error ? e.message : String(e));
      }
    }

    createFolders();
  }, [dirHandle, allCitings]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scan after folder creation completes
  useEffect(() => {
    if (creationStatus === 'done' && dirHandle) {
      scanPdfStatus();
    }
  }, [creationStatus, dirHandle, scanPdfStatus]);

  function handleConfirm() {
    const updated = targets.map((t) => ({
      ...t,
      selected_citings: t.selected_citings.map((c) => {
        const folder = sanitizeFolderName(c.title);
        const status = pdfStatusMap.get(folder);
        return {
          ...c,
          pdf_folder: folder,
          pdf_source: c.oa_url ? ('oa' as const) : status === 'found' ? ('local' as const) : ('unknown' as const),
        };
      }),
    }));
    onConfirm(updated, manualPath || dirHandle?.name || '');
  }

  const pdfRootLabel = dirHandle
    ? `${dirHandle.name}/${PDF_ROOT_FOLDER}`
    : `<working_dir>/${PDF_ROOT_FOLDER}`;

  function statusBadge(folder: string, isOa: boolean) {
    if (isOa) {
      return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-700/30 text-green-300">OA</span>;
    }
    const st = pdfStatusMap.get(folder);
    if (st === 'found') {
      return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-700/30 text-blue-300">PDF found</span>;
    }
    return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-700/30 text-amber-300">missing</span>;
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-5">
        <h2 className="text-lg font-semibold">Step 4: PDF Preparation</h2>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-700">{oaCount}</div>
            <div className="text-xs text-green-600">Open Access</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-700">{foundCount}</div>
            <div className="text-xs text-blue-600">PDF found locally</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-amber-700">{missingCount < 0 ? 0 : missingCount}</div>
            <div className="text-xs text-amber-600">PDF missing</div>
          </div>
        </div>

        {/* Folder creation status */}
        {dirHandle ? (
          <div className={`rounded-lg p-4 text-sm ${
            creationStatus === 'done'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : creationStatus === 'error'
                ? 'bg-red-50 border border-red-200 text-red-800'
                : 'bg-blue-50 border border-blue-200 text-blue-800'
          }`}>
            {creationStatus === 'creating' && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                Creating folder structure... ({createdCount}/{allCitings.length})
              </div>
            )}
            {creationStatus === 'done' && (
              <div className="flex items-center justify-between">
                <span>
                  <span className="font-medium">Folder structure ready.</span>{' '}
                  {allCitings.length} folders under <code className="bg-green-100 px-1 rounded">{pdfRootLabel}/</code>
                </span>
                <button
                  onClick={scanPdfStatus}
                  disabled={scanning}
                  className="shrink-0 flex items-center gap-1.5 rounded-lg border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-800 hover:bg-green-50 transition disabled:opacity-50"
                >
                  {scanning ? (
                    <>
                      <div className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh Status
                    </>
                  )}
                </button>
              </div>
            )}
            {creationStatus === 'error' && (
              <div>
                <span className="font-medium">Error creating folders:</span> {errorMsg}
                <button
                  onClick={() => { creatingRef.current = false; setCreationStatus('idle'); }}
                  className="ml-3 underline hover:no-underline"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            <span className="font-medium">No working directory selected.</span>{' '}
            Go back to the top of the page to choose a folder. Without it, you'll need to create folders manually.
            <div className="mt-2">
              <label className="block text-xs font-medium mb-1">Or enter the path manually (for config only):</label>
              <input
                type="text"
                value={manualPath}
                onChange={(e) => setManualPath(e.target.value)}
                placeholder="e.g. /Users/yuanmu/Desktop/my-project"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        )}

        {/* Folder structure with PDF status */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium">Folder structure</h3>
            {pdfStatusMap.size > 0 && (
              <span className="text-xs text-gray-400">
                {oaCount} OA + {foundCount} found + {missingCount < 0 ? 0 : missingCount} missing = {allCitings.length} total
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mb-3">
            For non-OA papers, download the PDF and place it in the corresponding folder, then click <strong>Refresh Status</strong>.
          </p>
          <div className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto leading-relaxed">
            <div className="text-gray-400">{pdfRootLabel}/</div>
            {targets.map((t, ti) => {
              const citings = t.selected_citings;
              const isExpanded = expandedTarget === ti;
              const visibleCount = isExpanded ? citings.length : Math.min(3, citings.length);
              return (
                <div key={ti} className="mt-2">
                  <div
                    className="text-blue-300 cursor-pointer hover:text-blue-200 flex items-center gap-1"
                    onClick={() => setExpandedTarget(isExpanded ? null : ti)}
                  >
                    <span className="text-gray-500">{isExpanded ? '▼' : '▶'}</span>
                    <span className="text-yellow-300">[{t.title.slice(0, 50)}{t.title.length > 50 ? '...' : ''}]</span>
                    <span className="text-gray-500 ml-2">({citings.length} papers)</span>
                  </div>
                  {citings.slice(0, visibleCount).map((c, ci) => {
                    const folder = sanitizeFolderName(c.title);
                    const isOa = !!c.oa_url;
                    const st = pdfStatusMap.get(folder);
                    const folderColor = isOa
                      ? 'text-green-400'
                      : st === 'found'
                        ? 'text-blue-400'
                        : 'text-amber-400';
                    return (
                      <div key={ci} className="ml-6 flex items-center gap-2">
                        <span className="text-gray-500">├── </span>
                        <span className={folderColor}>{folder}/</span>
                        {statusBadge(folder, isOa)}
                      </div>
                    );
                  })}
                  {!isExpanded && citings.length > 3 && (
                    <div
                      className="ml-6 text-gray-500 cursor-pointer hover:text-gray-400"
                      onClick={() => setExpandedTarget(ti)}
                    >
                      └── ... {citings.length - 3} more
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-1">
          <p className="font-medium">Workflow:</p>
          <ol className="list-decimal list-inside space-y-0.5 text-xs">
            <li>OA papers will be auto-downloaded by the agent.</li>
            <li>For non-OA papers (amber), download the PDF and place it in the subfolder (any filename is fine).</li>
            <li>Click <strong>Refresh Status</strong> to verify PDFs are detected.</li>
            <li>Proceed to export config when ready.</li>
          </ol>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium hover:bg-gray-50 transition"
        >
          Back
        </button>
        <button
          onClick={handleConfirm}
          disabled={!dirHandle && !manualPath.trim()}
          className="rounded-lg bg-primary-600 text-white px-5 py-2 text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next: Export Config
        </button>
      </div>
    </div>
  );
}
