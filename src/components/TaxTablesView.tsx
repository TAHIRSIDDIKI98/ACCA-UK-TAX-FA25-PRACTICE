import React, { useEffect, useState } from 'react';
import { Download, Upload, X } from 'lucide-react';
import { parseImportedState, serializeStateForExport } from '../engine/mastery';
import type { AppState } from '../types/tx';
import { FA25TaxTables } from './FA25TaxTables';

export { FA25TaxTables };

interface TaxTablesViewProps {
  appState: AppState;
  onImportState: (next: AppState) => void;
  onOpenTopic?: (topicId: number) => void;
  onOpenQuestionById?: (questionId: string) => void;
}

export const TaxTablesView: React.FC<TaxTablesViewProps> = ({
  appState,
  onImportState,
  onOpenTopic,
  onOpenQuestionById,
}) => {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pasteJson, setPasteJson] = useState('');
  const [showImportBox, setShowImportBox] = useState(false);

  const handleExportJson = () => {
    const jsonStr = serializeStateForExport(appState);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tx-mastercoach-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage('Progress backup JSON downloaded.');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = parseImportedState(String(reader.result ?? ''));
      if (res.ok) {
        onImportState(res.state);
        setStatusMessage(
          `Restored ${file.name} (${res.state.attempts.length} attempts, ${res.state.mistakes.length} mistakes).`
        );
      } else {
        setStatusMessage(`Import error: ${res.error}`);
      }
    };
    reader.readAsText(file);
  };

  const handlePasteImport = () => {
    const res = parseImportedState(pasteJson);
    if (res.ok) {
      onImportState(res.state);
      setShowImportBox(false);
      setPasteJson('');
      setStatusMessage(`State restored (${res.state.attempts.length} attempts loaded).`);
    } else {
      setStatusMessage(`Import error: ${res.error}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-[#E6E4DD] bg-white p-5 lg:flex-row lg:items-center lg:justify-between dark:border-[#262C36] dark:bg-[#161B22]">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold text-[#14171A] dark:text-[#F0F3F6]">
            FA25 Complete Revision Hub &amp; Tax Tables
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
            Every Finance Act 2025 rate, threshold, CBE vs Must-Memorise rule, interactive benefit/capital-allowance checker, worked example, and deadline (Kit P.37–46).
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#D8D4C8] bg-[#FAF9F6] px-3 py-2 text-xs font-semibold text-[#14171A] hover:bg-[#EFECE4] dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-200"
          >
            <Download className="h-3.5 w-3.5" />
            Save Backup JSON
          </button>

          <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#D8D4C8] bg-[#FAF9F6] px-3 py-2 text-xs font-semibold text-[#14171A] hover:bg-[#EFECE4] dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-200">
            <Upload className="h-3.5 w-3.5" />
            Restore Backup JSON
            <input type="file" accept="application/json" onChange={handleFileUpload} className="hidden" />
          </label>

          <button
            type="button"
            onClick={() => setShowImportBox((v) => !v)}
            className="inline-flex shrink-0 items-center whitespace-nowrap rounded-lg border border-[#D8D4C8] bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-200"
          >
            Paste JSON
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="rounded-xl border border-[#D4DFD7] bg-emerald-50/70 px-4 py-2.5 text-sm font-medium text-[#0F5132] dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
          {statusMessage}
        </div>
      )}

      {showImportBox && (
        <div className="rounded-2xl border border-[#E6E4DD] bg-white p-4 space-y-3 dark:border-[#262C36] dark:bg-[#161B22]">
          <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            Paste previously exported TX Mastercoach JSON:
          </p>
          <textarea
            rows={4}
            value={pasteJson}
            onChange={(e) => setPasteJson(e.target.value)}
            className="w-full rounded-xl border border-[#D8D4C8] bg-[#FAF9F6] p-2.5 font-mono text-xs text-[#14171A] focus:border-[#0F5132] focus:outline-none dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
            placeholder='{"version": 1, ...}'
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowImportBox(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePasteImport}
              className="rounded-lg bg-[#0F5132] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0B3D26] dark:bg-emerald-600"
            >
              Restore State
            </button>
          </div>
        </div>
      )}

      <FA25TaxTables onOpenTopic={onOpenTopic} onOpenQuestionById={onOpenQuestionById} />
    </div>
  );
};

interface TaxTablesDrawerProps {
  open: boolean;
  onClose: () => void;
  onOpenQuestionById?: (questionId: string) => void;
}

export const TaxTablesDrawer: React.FC<TaxTablesDrawerProps> = ({
  open,
  onClose,
  onOpenQuestionById,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[1px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-3xl flex-col bg-[#F7F6F2] shadow-2xl dark:bg-[#0D1117]"
      >
        <div className="flex items-center justify-between border-b border-[#E6E4DD] bg-white px-5 py-4 dark:border-[#262C36] dark:bg-[#161B22]">
          <div>
            <h2 className="font-display text-base font-semibold text-[#14171A] dark:text-[#F0F3F6]">
              FA25 Exam Tables, Rules &amp; Examples (Kit P.37–46)
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Quick lookup drawer — toggle Worked Examples or Live Checkers anytime
            </p>
          </div>
          <button
            type="button"
            aria-label="Close exam tables"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E6E4DD] text-neutral-600 hover:bg-neutral-100 dark:border-[#262C36] dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <FA25TaxTables
            compact
            onOpenQuestionById={
              onOpenQuestionById
                ? (qId) => {
                    onClose();
                    onOpenQuestionById(qId);
                  }
                : undefined
            }
          />
        </div>
      </div>
    </div>
  );
};

