import React, { useMemo, useState } from 'react';
import { Download, Search, Upload, X } from 'lucide-react';
import { FA25_RATES_TABLES, TIME_LIMITS_CARDS } from '../data/taxReference';
import { parseImportedState, serializeStateForExport } from '../engine/mastery';
import type { AppState } from '../types/tx';

interface TaxTablesContentProps {
  compact?: boolean;
}

const QUICK_TAGS = [
  'Income Tax',
  'NIC',
  'Capital Allowances',
  'Corporation Tax',
  'CGT',
  'IHT',
  'VAT',
  'RDE2',
  'POA',
];

export const TaxTablesContent: React.FC<TaxTablesContentProps> = ({ compact = false }) => {
  const [query, setQuery] = useState('');
  const [sectionView, setSectionView] = useState<'all' | 'rates' | 'dates'>('all');

  const qLower = query.trim().toLowerCase();

  const filteredRates = useMemo(() => {
    if (!qLower) return FA25_RATES_TABLES;
    return FA25_RATES_TABLES.map((tbl) => ({
      ...tbl,
      rows: tbl.rows.filter(
        (r) =>
          tbl.title.toLowerCase().includes(qLower) ||
          r.item.toLowerCase().includes(qLower) ||
          r.rateOrLimit.toLowerCase().includes(qLower) ||
          (r.note?.toLowerCase().includes(qLower) ?? false)
      ),
    })).filter((tbl) => tbl.rows.length > 0);
  }, [qLower]);

  const filteredDates = useMemo(() => {
    if (!qLower) return TIME_LIMITS_CARDS;
    return TIME_LIMITS_CARDS.map((card) => ({
      ...card,
      items: card.items.filter(
        (it) =>
          card.area.toLowerCase().includes(qLower) ||
          it.action.toLowerCase().includes(qLower) ||
          it.deadline.toLowerCase().includes(qLower) ||
          (it.example2526?.toLowerCase().includes(qLower) ?? false)
      ),
    })).filter((c) => c.items.length > 0);
  }, [qLower]);

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter FA25 rates, allowances, thresholds, or deadlines (e.g. RDE2, 100,000, POA)..."
              className="w-full rounded-xl border border-[#D8D4C8] bg-white py-2 pl-9 pr-3 text-sm text-[#14171A] placeholder:text-neutral-400 focus:border-[#0F5132] focus:outline-none dark:border-[#303846] dark:bg-[#12161D] dark:text-[#F0F3F6]"
            />
          </div>

          <div className="inline-flex rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] p-1 dark:border-[#262C36] dark:bg-[#12161D]">
            {(['all', 'rates', 'dates'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setSectionView(tab)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  sectionView === tab
                    ? 'bg-[#0F5132] text-white dark:bg-emerald-600'
                    : 'text-neutral-600 hover:text-[#14171A] dark:text-neutral-300'
                }`}
              >
                {tab === 'all' ? 'All Tables' : tab === 'rates' ? 'Rates (P.37–42)' : 'Time Limits (P.43+)'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {QUICK_TAGS.map((tag) => {
            const active = query.toLowerCase() === tag.toLowerCase();
            return (
              <button
                key={tag}
                type="button"
                onClick={() => setQuery(active ? '' : tag)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-[#0F5132] text-white dark:bg-emerald-600'
                    : 'bg-white border border-[#E6E4DD] text-neutral-600 hover:bg-[#FAF9F6] dark:border-[#262C36] dark:bg-[#161B22] dark:text-neutral-300'
                }`}
              >
                {tag}
              </button>
            );
          })}
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="px-2 py-1 text-xs font-semibold text-[#0F5132] hover:underline dark:text-emerald-400"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {(sectionView === 'all' || sectionView === 'rates') && (
        <div className={compact ? 'space-y-4' : 'grid grid-cols-1 gap-5 lg:grid-cols-2'}>
          {filteredRates.map((tbl) => (
            <div
              key={tbl.id}
              className="overflow-hidden rounded-2xl border border-[#E6E4DD] bg-white dark:border-[#262C36] dark:bg-[#161B22]"
            >
              <div className="flex items-center justify-between border-b border-[#EFECE4] bg-[#FAF9F6] px-4 py-3 dark:border-[#262C36] dark:bg-[#12161D]">
                <h3 className="font-display text-sm font-semibold text-[#14171A] dark:text-[#F0F3F6]">
                  {tbl.title}
                </h3>
                <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
                  {tbl.kitPage}
                </span>
              </div>
              <div className="divide-y divide-[#EFECE4] dark:divide-[#262C36]">
                {tbl.rows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-12 items-start gap-2 px-4 py-2.5 text-sm">
                    <div className="col-span-5 font-medium text-[#14171A] dark:text-[#F0F3F6]">
                      {row.item}
                    </div>
                    <div className="col-span-4 font-mono text-xs font-bold text-[#0F5132] dark:text-emerald-400 tabular-nums">
                      {row.rateOrLimit}
                    </div>
                    <div className="col-span-3 text-xs text-neutral-500 dark:text-neutral-400">
                      {row.note ?? ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {(sectionView === 'all' || sectionView === 'dates') && (
        <div className={compact ? 'space-y-4' : 'grid grid-cols-1 gap-5 lg:grid-cols-2'}>
          {filteredDates.map((card) => (
            <div
              key={card.area}
              className="overflow-hidden rounded-2xl border border-[#E6E4DD] bg-white dark:border-[#262C36] dark:bg-[#161B22]"
            >
              <div className="flex items-center justify-between border-b border-[#EFECE4] bg-[#FAF9F6] px-4 py-3 dark:border-[#262C36] dark:bg-[#12161D]">
                <h3 className="font-display text-sm font-semibold text-[#14171A] dark:text-[#F0F3F6]">
                  {card.area}
                </h3>
                <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
                  {card.kitPage}
                </span>
              </div>
              <div className="divide-y divide-[#EFECE4] dark:divide-[#262C36]">
                {card.items.map((it, idx) => (
                  <div key={idx} className="px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium text-[#14171A] dark:text-[#F0F3F6]">
                        {it.action}
                      </span>
                      <span className="font-mono text-xs font-bold text-[#0F5132] dark:text-emerald-400 tabular-nums">
                        {it.deadline}
                      </span>
                    </div>
                    {it.example2526 && (
                      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                        2025/26 example: {it.example2526}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredRates.length === 0 && filteredDates.length === 0 && (
        <div className="rounded-2xl border border-[#E6E4DD] bg-white p-6 text-center text-xs text-neutral-600 dark:border-[#262C36] dark:bg-[#161B22] dark:text-neutral-400">
          No FA25 tax rates or time limits match &ldquo;{query}&rdquo;.{' '}
          <button
            type="button"
            onClick={() => setQuery('')}
            className="font-semibold text-[#0F5132] hover:underline dark:text-emerald-400"
          >
            Clear filter
          </button>
        </div>
      )}
    </div>
  );
};

interface TaxTablesViewProps {
  appState: AppState;
  onImportState: (next: AppState) => void;
}

export const TaxTablesView: React.FC<TaxTablesViewProps> = ({ appState, onImportState }) => {
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
        setStatusMessage(`Restored ${file.name} (${res.state.attempts.length} attempts, ${res.state.mistakes.length} mistakes).`);
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
      <div className="flex flex-col gap-4 rounded-2xl border border-[#E6E4DD] bg-white p-5 sm:flex-row sm:items-center sm:justify-between dark:border-[#262C36] dark:bg-[#161B22]">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[#14171A] dark:text-[#F0F3F6]">
            FA25 Tax Rates, Allowances &amp; Election Deadlines
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
            Canonical reference extracted from Kaplan TX-UK FA25 Exam Kit P.37–46 (2025/26 tax year).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8D4C8] bg-[#FAF9F6] px-3 py-2 text-xs font-semibold text-[#14171A] hover:bg-[#EFECE4] dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-200"
          >
            <Download className="h-3.5 w-3.5" />
            Save Backup JSON
          </button>

          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#D8D4C8] bg-[#FAF9F6] px-3 py-2 text-xs font-semibold text-[#14171A] hover:bg-[#EFECE4] dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-200">
            <Upload className="h-3.5 w-3.5" />
            Restore Backup JSON
            <input type="file" accept="application/json" onChange={handleFileUpload} className="hidden" />
          </label>

          <button
            type="button"
            onClick={() => setShowImportBox((v) => !v)}
            className="inline-flex items-center rounded-lg border border-[#D8D4C8] bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-200"
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

      <TaxTablesContent />
    </div>
  );
};

interface TaxTablesDrawerProps {
  open: boolean;
  onClose: () => void;
}

export const TaxTablesDrawer: React.FC<TaxTablesDrawerProps> = ({ open, onClose }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[1px]">
      <div className="flex h-full w-full max-w-2xl flex-col bg-[#F7F6F2] shadow-2xl dark:bg-[#0D1117]">
        <div className="flex items-center justify-between border-b border-[#E6E4DD] bg-white px-5 py-4 dark:border-[#262C36] dark:bg-[#161B22]">
          <div>
            <h2 className="font-display text-base font-semibold text-[#14171A] dark:text-[#F0F3F6]">
              FA25 Exam Tables &amp; Deadlines (Kit P.37–46)
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Provided inside the ACCA CBE workspace
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
          <TaxTablesContent compact />
        </div>
      </div>
    </div>
  );
};
