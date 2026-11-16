import React, { useMemo, useState } from 'react';
import { Download, Search, Upload, X } from 'lucide-react';
import { FA25_RATES_TABLES, TIME_LIMITS_CARDS } from '../data/taxReference';
import { parseImportedState, serializeStateForExport } from '../engine/mastery';
import type { AppState } from '../types/tx';

interface TaxTablesContentProps {
  compact?: boolean;
}

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
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter FA25 rates, allowances, thresholds, or deadlines (e.g. RDE2, 100,000, POA)..."
            className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
          />
        </div>

        <div className="inline-flex rounded-md border border-slate-200 bg-slate-100 p-0.5">
          {(['all', 'rates', 'dates'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setSectionView(tab)}
              className={`whitespace-nowrap rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                sectionView === tab
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab === 'all' ? 'All Tables' : tab === 'rates' ? 'Rates (P.37–42)' : 'Time Limits (P.43+)'}
            </button>
          ))}
        </div>
      </div>

      {(sectionView === 'all' || sectionView === 'rates') && (
        <div className={compact ? 'space-y-4' : 'grid grid-cols-1 gap-5 lg:grid-cols-2'}>
          {filteredRates.map((tbl) => (
            <div key={tbl.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                <h3 className="font-display text-sm font-bold text-slate-900">{tbl.title}</h3>
                <span className="font-mono text-xs text-slate-500">{tbl.kitPage}</span>
              </div>
              <div className="divide-y divide-slate-100">
                {tbl.rows.map((row, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 items-start gap-2 px-4 py-2.5 text-sm"
                  >
                    <div className="col-span-5 font-medium text-slate-800">{row.item}</div>
                    <div className="col-span-4 font-mono text-xs font-semibold text-blue-800 tabular-nums">
                      {row.rateOrLimit}
                    </div>
                    <div className="col-span-3 text-xs text-slate-500">{row.note ?? ''}</div>
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
            <div key={card.area} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                <h3 className="font-display text-sm font-bold text-slate-900">{card.area}</h3>
                <span className="font-mono text-xs text-slate-500">{card.kitPage}</span>
              </div>
              <div className="divide-y divide-slate-100">
                {card.items.map((it, idx) => (
                  <div key={idx} className="px-4 py-2.5 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium text-slate-900">{it.action}</span>
                      <span className="font-mono text-xs font-semibold text-teal-700 tabular-nums">
                        {it.deadline}
                      </span>
                    </div>
                    {it.example2526 && (
                      <p className="mt-1 text-xs text-slate-500">2025/26 example: {it.example2526}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {filteredRates.length === 0 && filteredDates.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-xs text-slate-600">
          No FA25 tax rates or time limits match &ldquo;{query}&rdquo;.{' '}
          <button
            type="button"
            onClick={() => setQuery('')}
            className="font-semibold text-blue-700 hover:underline"
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
      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900">
            FA25 Tax Rates, Allowances & Election Deadlines
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Canonical reference extracted directly from Kaplan TX-UK FA25 Exam Kit P.37–46 (2025/26 tax year).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" />
            Save Backup JSON
          </button>

          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50">
            <Upload className="h-3.5 w-3.5" />
            Restore Backup JSON
            <input type="file" accept="application/json" onChange={handleFileUpload} className="hidden" />
          </label>

          <button
            type="button"
            onClick={() => setShowImportBox((v) => !v)}
            className="inline-flex items-center rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Paste JSON
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-900">
          {statusMessage}
        </div>
      )}

      {showImportBox && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-700">Paste previously exported TX Mastercoach JSON:</p>
          <textarea
            rows={4}
            value={pasteJson}
            onChange={(e) => setPasteJson(e.target.value)}
            className="w-full rounded-md border border-slate-300 p-2 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            placeholder='{"version": 1, ...}'
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowImportBox(false)}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePasteImport}
              className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
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
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[1px]">
      <div className="flex h-full w-full max-w-2xl flex-col bg-slate-50 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">
              FA25 Exam Tables & Deadlines (Kit P.37–46)
            </h2>
            <p className="text-xs text-slate-500">Provided inside the ACCA CBE workspace</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
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
