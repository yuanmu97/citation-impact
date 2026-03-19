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
  const name = title
    .replace(/[/<>:"\\|?*\x00-\x1f\x7f]/g, '')
    .replace(/[\u200B-\u200F\uFEFF\u00A0]/g, '')
    .replace(/[：／＼｜＊？＂＜＞]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 80)
    .trim();
  return name || 'untitled';
}

const PDF_ROOT_FOLDER = 'citation_pdfs';

type CreationStatus = 'idle' | 'creating' | 'done' | 'error';
type PdfStatus = 'oa' | 'oa_downloaded' | 'found' | 'missing';

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

  const [dlStatus, setDlStatus] = useState<'idle' | 'downloading' | 'done'>('idle');
  const [dlProgress, setDlProgress] = useState({ done: 0, failed: 0, total: 0 });
  const [dlFailedItems, setDlFailedItems] = useState<Array<{ title: string; folder: string; url: string }>>([]);

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
        try {
          const sub = await pdfRoot.getDirectoryHandle(item.folder);
          const has = await folderHasPdf(sub);
          if (has) {
            statusMap.set(item.folder, item.citing.oa_url ? 'oa_downloaded' : 'found');
            continue;
          }
        } catch { /* folder doesn't exist yet */ }
        statusMap.set(item.folder, item.citing.oa_url ? 'oa' : 'missing');
      }
    } catch {
      for (const item of allCitings) {
        statusMap.set(item.folder, item.citing.oa_url ? 'oa' : 'missing');
      }
    }
    setPdfStatusMap(statusMap);
    setScanning(false);
  }, [dirHandle, allCitings]);

  const oaTotal = useMemo(() => allCitings.filter((c) => c.citing.oa_url).length, [allCitings]);
  const oaDownloadedCount = useMemo(() => {
    let n = 0;
    pdfStatusMap.forEach((v) => { if (v === 'oa_downloaded') n++; });
    return n;
  }, [pdfStatusMap]);
  const oaPendingCount = oaTotal - oaDownloadedCount;
  const foundCount = useMemo(() => {
    let n = 0;
    pdfStatusMap.forEach((v) => { if (v === 'found') n++; });
    return n;
  }, [pdfStatusMap]);
  const readyCount = oaDownloadedCount + foundCount;
  const missingCount = allCitings.length - oaTotal - foundCount;

  const downloadOaPdfs = useCallback(async () => {
    if (!dirHandle) return;
    const oaItems = allCitings.filter(
      (c) => c.citing.oa_url && pdfStatusMap.get(c.folder) !== 'oa_downloaded',
    );
    if (oaItems.length === 0) return;

    setDlStatus('downloading');
    const progress = { done: 0, failed: 0, total: oaItems.length };
    setDlProgress({ ...progress });
    const failed: Array<{ title: string; folder: string; url: string }> = [];

    try {
      const pdfRoot = await dirHandle.getDirectoryHandle(PDF_ROOT_FOLDER, { create: true });
      for (const item of oaItems) {
        try {
          const subDir = await pdfRoot.getDirectoryHandle(item.folder, { create: true });
          const already = await folderHasPdf(subDir);
          if (already) { progress.done++; setDlProgress({ ...progress }); continue; }

          const resp = await fetch(item.citing.oa_url);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const contentType = resp.headers.get('content-type') || '';
          if (!contentType.includes('pdf') && !contentType.includes('octet-stream')) {
            throw new Error('Not a PDF response');
          }
          const blob = await resp.blob();

          const fileName = sanitizeFolderName(item.citing.title).slice(0, 60) + '.pdf';
          const fileHandle = await subDir.getFileHandle(fileName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          progress.done++;
        } catch {
          progress.failed++;
          failed.push({ title: item.citing.title, folder: item.folder, url: item.citing.oa_url });
        }
        setDlProgress({ ...progress });
      }
    } catch { /* pdfRoot error */ }

    setDlFailedItems(failed);
    setDlStatus('done');
    scanPdfStatus();
  }, [dirHandle, allCitings, pdfStatusMap, scanPdfStatus]);

  const creatingRef = useRef(false);

  useEffect(() => {
    if (!dirHandle || creatingRef.current || creationStatus !== 'idle') return;
    creatingRef.current = true;

    async function createFolders() {
      setCreationStatus('creating');
      setCreatedCount(0);
      const errors: string[] = [];
      try {
        const pdfRoot = await ensureSubDir(dirHandle!, PDF_ROOT_FOLDER);
        let count = 0;
        for (const item of allCitings) {
          try {
            await ensureSubDir(pdfRoot, item.folder);
          } catch (e) {
            errors.push(`"${item.folder}": ${e instanceof Error ? e.message : String(e)}`);
          }
          count++;
          setCreatedCount(count);
        }
        if (errors.length > 0) {
          setCreationStatus('error');
          setErrorMsg(`${errors.length} folder(s) failed:\n${errors.join('\n')}`);
        } else {
          setCreationStatus('done');
        }
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
          pdf_source: (status === 'oa_downloaded' || status === 'found')
            ? ('local' as const)
            : c.oa_url
              ? ('oa' as const)
              : ('unknown' as const),
        };
      }),
    }));
    onConfirm(updated, manualPath || dirHandle?.name || '');
  }

  const pdfRootLabel = dirHandle
    ? `${dirHandle.name}/${PDF_ROOT_FOLDER}`
    : `<working_dir>/${PDF_ROOT_FOLDER}`;

  function statusBadge(folder: string) {
    const st = pdfStatusMap.get(folder);
    if (st === 'oa_downloaded') {
      return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-700/30 text-green-300">OA downloaded</span>;
    }
    if (st === 'oa') {
      return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-700/30 text-cyan-300">OA</span>;
    }
    if (st === 'found') {
      return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-700/30 text-blue-300">PDF found</span>;
    }
    return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-700/30 text-amber-300">missing</span>;
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-5">
        <h2 className="text-lg font-semibold">Step 4: PDF Preparation</h2>

        <div className="grid grid-cols-4 gap-3">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-700">{readyCount}</div>
            <div className="text-xs text-green-600">PDF Ready</div>
          </div>
          <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-cyan-700">{oaPendingCount < 0 ? 0 : oaPendingCount}</div>
            <div className="text-xs text-cyan-600">OA (pending)</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-amber-700">{missingCount < 0 ? 0 : missingCount}</div>
            <div className="text-xs text-amber-600">Non-OA missing</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-gray-700">{allCitings.length}</div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
        </div>

        {/* OA download */}
        {dirHandle && oaPendingCount > 0 && (
          <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-800">
            {dlStatus === 'idle' && (
              <div className="flex items-center justify-between">
                <span>{oaPendingCount} OA paper(s) can be downloaded automatically.</span>
                <button
                  onClick={downloadOaPdfs}
                  className="shrink-0 rounded-lg bg-cyan-600 text-white px-4 py-1.5 text-xs font-semibold hover:bg-cyan-700 transition"
                >
                  Download OA PDFs
                </button>
              </div>
            )}
            {dlStatus === 'downloading' && (
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                <span>
                  Downloading... {dlProgress.done + dlProgress.failed}/{dlProgress.total}
                  {dlProgress.failed > 0 && <span className="text-red-600 ml-1">({dlProgress.failed} failed)</span>}
                </span>
              </div>
            )}
            {dlStatus === 'done' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span>
                    Downloaded {dlProgress.done}/{dlProgress.total} OA PDF(s).
                    {dlProgress.failed > 0 && (
                      <span className="text-amber-700 ml-1">
                        {dlProgress.failed} could not be fetched directly.
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => { setDlStatus('idle'); setDlProgress({ done: 0, failed: 0, total: 0 }); setDlFailedItems([]); }}
                    className="shrink-0 rounded-lg border border-cyan-300 bg-white px-3 py-1.5 text-xs font-medium text-cyan-800 hover:bg-cyan-50 transition"
                  >
                    Retry
                  </button>
                </div>
                {dlFailedItems.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                    <p className="text-xs text-amber-800 font-medium">
                      Please download these PDFs manually, save to the indicated folder, then click Refresh Status:
                    </p>
                    <div className="space-y-1.5">
                      {dlFailedItems.map((item, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <span className="text-amber-600 shrink-0 mt-0.5">{i + 1}.</span>
                          <div className="min-w-0">
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium text-blue-700 underline hover:text-blue-900 break-all"
                            >
                              {item.title.length > 80 ? item.title.slice(0, 80) + '...' : item.title}
                            </a>
                            <div className="text-amber-600 mt-0.5">
                              Save to: <code className="bg-amber-100 px-1 rounded">{PDF_ROOT_FOLDER}/{item.folder}/</code>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {dirHandle && oaPendingCount === 0 && oaTotal > 0 && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            All {oaTotal} OA paper(s) downloaded.
          </div>
        )}

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
                {readyCount} ready + {oaPendingCount < 0 ? 0 : oaPendingCount} OA pending + {missingCount < 0 ? 0 : missingCount} missing = {allCitings.length} total
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
                    const st = pdfStatusMap.get(folder);
                    const folderColor = st === 'oa_downloaded' || st === 'found'
                      ? 'text-green-400'
                      : st === 'oa'
                        ? 'text-cyan-400'
                        : 'text-amber-400';
                    const needsManual = st === 'missing';
                    return (
                      <div key={ci} className="ml-6 flex items-center gap-2 flex-wrap">
                        <span className="text-gray-500">├── </span>
                        <span className={folderColor}>{folder}/</span>
                        {statusBadge(folder)}
                        {needsManual && (
                          <span className="flex items-center gap-1.5 font-sans">
                            {c.doi && (
                              <a
                                href={`https://doi.org/${c.doi}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-700/30 text-violet-300 hover:bg-violet-600/40 transition"
                                title={`Open DOI: ${c.doi}`}
                              >
                                DOI
                              </a>
                            )}
                            <a
                              href={`https://scholar.google.com/scholar?q=${encodeURIComponent(c.title)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-600/30 text-gray-300 hover:bg-gray-500/40 transition"
                              title="Search on Google Scholar"
                            >
                              Scholar
                            </a>
                          </span>
                        )}
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
            <li>Click <strong>Download OA PDFs</strong> to auto-download open-access papers. If some fail due to CORS, the agent will handle them later.</li>
            <li>For non-OA papers (amber), download the PDF manually and place it in the subfolder (any filename is fine).</li>
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
