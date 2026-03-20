import { useState, useCallback } from 'react';
import type { PaperItem, SelectedPaper, TargetPaperWithCitings } from '../types';
import { useLocale } from '../i18n';
import StepWizard from '../components/config/StepWizard';
import AuthorSearch from '../components/config/AuthorSearch';
import PaperSelector from '../components/config/PaperSelector';
import CitingPapersStep from '../components/config/CitingPapersStep';
import PdfPreparationStep from '../components/config/PdfPreparationStep';
import ConfigExport from '../components/config/ConfigExport';
import { isFileSystemAccessSupported, pickDirectory } from '../services/fsAccess';

export interface AuthorInfo {
  name: string;
  googleScholarId: string;
  openalexId: string;
}

export default function ConfigPage() {
  const { t } = useLocale();
  const cfg = t.config;

  const [step, setStep] = useState(0);

  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [dirName, setDirName] = useState('');
  const fsSupported = isFileSystemAccessSupported();

  const [authorInfo, setAuthorInfo] = useState<AuthorInfo>({ name: '', googleScholarId: '', openalexId: '' });
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [selectedPapers, setSelectedPapers] = useState<SelectedPaper[]>([]);
  const [targetsWithCitings, setTargetsWithCitings] = useState<TargetPaperWithCitings[]>([]);
  const handlePickDir = useCallback(async () => {
    try {
      const handle = await pickDirectory();
      setDirHandle(handle);
      setDirName(handle.name);
    } catch {
      // user cancelled
    }
  }, []);

  const handleAuthorConfirmed = useCallback(
    (info: AuthorInfo, allPapers: PaperItem[]) => {
      setAuthorInfo(info);
      setPapers(allPapers);
      setStep(1);
    },
    [],
  );

  const handlePapersSelected = useCallback((sel: SelectedPaper[]) => {
    setSelectedPapers(sel);
    setStep(2);
  }, []);

  const handleCitingsConfirmed = useCallback((results: TargetPaperWithCitings[]) => {
    setTargetsWithCitings(results);
    setStep(3);
  }, []);

  const handlePdfConfirmed = useCallback((updated: TargetPaperWithCitings[], _dir: string) => {
    setTargetsWithCitings(updated);
    setStep(4);
  }, []);

  const stepLabels = cfg.steps;

  const isLocal = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6 text-center">{cfg.title}</h1>

      {!isLocal && (
        <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          {cfg.onlineBannerBefore}{' '}
          <a
            href={cfg.readmeQuickStartUrl}
            target="_blank"
            rel="noreferrer"
            className="font-semibold underline hover:text-amber-900"
          >
            {cfg.onlineBannerLink}
          </a>
          {cfg.onlineBannerAfter}
        </div>
      )}

      {/* Working directory selector — always visible */}
      <div className="mb-6 bg-white border border-gray-200 rounded-xl px-5 py-3 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-medium text-gray-700 shrink-0">{cfg.workingDir}</span>
          {dirHandle ? (
            <span className="text-sm text-primary-700 font-mono truncate">{dirName}/</span>
          ) : (
            <span className="text-sm text-gray-400 italic">{cfg.notSelected}</span>
          )}
        </div>
        {fsSupported ? (
          <button
            onClick={handlePickDir}
            className="shrink-0 rounded-lg bg-gray-800 text-white px-4 py-1.5 text-sm font-medium hover:bg-gray-700 transition"
          >
            {dirHandle ? cfg.change : cfg.chooseFolder}
          </button>
        ) : (
          <span className="text-xs text-amber-600 shrink-0">{cfg.fsUnsupported}</span>
        )}
      </div>

      <StepWizard steps={stepLabels} current={step} onStepClick={(i) => i < step && setStep(i)} />

      <div className="mt-8">
        {step === 0 && <AuthorSearch onConfirm={handleAuthorConfirmed} />}
        {step === 1 && (
          <PaperSelector papers={papers} onConfirm={handlePapersSelected} onBack={() => setStep(0)} />
        )}
        {step === 2 && (
          <CitingPapersStep
            selectedPapers={selectedPapers}
            onConfirm={handleCitingsConfirmed}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <PdfPreparationStep
            targets={targetsWithCitings}
            dirHandle={dirHandle}
            onConfirm={handlePdfConfirmed}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && (
          <ConfigExport
            author={authorInfo}
            targets={targetsWithCitings}
            dirHandle={dirHandle}
            onBack={() => setStep(3)}
          />
        )}
      </div>
    </div>
  );
}
