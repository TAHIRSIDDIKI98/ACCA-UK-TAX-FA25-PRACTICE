import React, { useMemo, useState } from 'react';
import { Highlighter } from 'lucide-react';
import { parseScenarioSegments } from '../engine/workedSolutionParser';

interface ScenarioTextProps {
  text: string;
  label?: string;
}

const TRIGGER_REGEX =
  /(£[\d,]+(?:\.\d+)?|\b\d+(?:\.\d+)?%|\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b|\b20\d{2}\/\d{2}\b|\b(?:exempt|private use|privately|connected|unmarried|furnished|unfurnished|gross|net|excluding|including|part-time|pro-rated|diesel|electric|RDE2|married|civil partner|non-UK|ceased|commenced)\b)/gi;

const NUMERIC_SCENARIO_CELL_RE =
  /^[-−–]?\(?[£$]?[\d,]+(?:\.\d+)?%?\)?(?:\s*×\s*\d+%)?$|^[£$%]$/;
const HEADER_OR_UNIT_CELL_RE =
  /^(?:(?:\d+\s+months?|year|period|quarter|tax\s+year)(?:\s+(?:ended|to))?(?:\s+.*)?|as\s+at.*|months?|notes?|£m?|%|\$|(?:\d{1,2}\s+)?(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|20\d{2}(?:\/\d{2})?)$/i;

function highlightTextChunk(chunk: string, highlightTriggers: boolean): React.ReactNode {
  if (!highlightTriggers) return chunk;
  const parts = chunk.split(TRIGGER_REGEX);
  return parts.map((part, idx) => {
    if (!part) return null;
    if (idx % 2 === 1) {
      return (
        <mark
          key={idx}
          className="rounded bg-amber-200/75 px-1 py-0.5 font-semibold text-amber-950 dark:bg-amber-800/50 dark:text-amber-100"
        >
          {part}
        </mark>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function refoldScenarioProse(text: string): string {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) return text.trim();
  const out: string[] = [lines[0]];
  for (let i = 1; i < lines.length; i++) {
    const prev = out[out.length - 1];
    const cur = lines[i];
    const prevEndsHard = /[.!?:;]$/.test(prev) || /^(?:Workings?|Notes?|Required:?|\(?W\d+\)?)/i.test(prev);
    const curStartsBreak =
      /^(?:\(?[a-z0-9]{1,3}\)|Note\s*\d*|Workings?\b|Required\b|[-–•*]|Part\b|\d+\.)/i.test(cur) ||
      /^[A-Z][a-z]+\s+[A-Z]/.test(cur) && prev.length < 48;
    if (!prevEndsHard && !curStartsBreak && (/[,a-z0-9’')%£]$/.test(prev))) {
      out[out.length - 1] = `${prev} ${cur}`;
    } else {
      out.push(cur);
    }
  }
  return out.join('\n');
}

export const ScenarioText: React.FC<ScenarioTextProps> = ({
  text,
  label = 'Scenario',
}) => {
  const [highlightTriggers, setHighlightTriggers] = useState(false);

  const segments = useMemo(() => parseScenarioSegments(text), [text]);

  return (
    <div className="rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] p-4 sm:p-5 dark:border-[#262C36] dark:bg-[#12161D]">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          {label}
        </span>
        <button
          type="button"
          aria-pressed={highlightTriggers}
          onClick={() => setHighlightTriggers((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
            highlightTriggers
              ? 'border-amber-400 bg-amber-100 text-amber-950 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200'
              : 'border-[#D8D4C8] bg-white text-neutral-700 hover:bg-neutral-50 dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-300'
          }`}
        >
          <Highlighter className="h-3 w-3" />
          {highlightTriggers ? 'Triggers Highlighted' : 'Spot Trap Triggers'}
        </button>
      </div>
      <div className="space-y-3 text-sm leading-relaxed text-[#1E2328] dark:text-[#E5E9F0]">
        {segments.map((seg, sIdx) => {
          if (seg.type === 'prose') {
            return (
              <div key={sIdx} className="whitespace-pre-line">
                {highlightTextChunk(refoldScenarioProse(seg.text), highlightTriggers)}
              </div>
            );
          }
          const maxCols = seg.rows.reduce((m, r) => Math.max(m, r.cells.length), 1);
          const isNoteListTable =
            maxCols === 2 &&
            seg.rows.some((r) => /^[1-9]\d?$|^–$/.test(r.cells[0] ?? '') && (r.cells[1]?.length ?? 0) > 25);

          return (
            <div
              key={sIdx}
              className="overflow-x-auto rounded-lg border border-[#E6E4DD] bg-white dark:border-[#262C36] dark:bg-[#0D1117]"
            >
              <table className="min-w-full border-collapse font-mono text-xs leading-snug">
                <tbody>
                  {seg.rows.map((row, rIdx) => {
                    const shouldPadLeft =
                      !isNoteListTable &&
                      row.cells.length < maxCols &&
                      row.cells.every(
                        (c) =>
                          c === '' ||
                          NUMERIC_SCENARIO_CELL_RE.test(c) ||
                          HEADER_OR_UNIT_CELL_RE.test(c)
                      );
                    const padOffset = shouldPadLeft ? maxCols - row.cells.length : 0;
                    const padded = Array.from({ length: maxCols }, (_, cIdx) =>
                      cIdx < padOffset ? '' : row.cells[cIdx - padOffset] ?? ''
                    );
                    return (
                      <tr
                        key={rIdx}
                        className={[
                          row.ruleAbove
                            ? 'border-t-2 border-neutral-400 dark:border-neutral-600'
                            : rIdx > 0
                            ? 'border-t border-[#F0EEE8] dark:border-[#1E242E]'
                            : '',
                          row.ruleBelow
                            ? 'border-b-2 border-neutral-400 font-semibold dark:border-neutral-600'
                            : '',
                        ].join(' ')}
                      >
                        {padded.map((cell, cIdx) => {
                          const trimmed = cell.trim();
                          const looksNumericOrHeader =
                            NUMERIC_SCENARIO_CELL_RE.test(trimmed) ||
                            HEADER_OR_UNIT_CELL_RE.test(trimmed);
                          const isNoteIndex = isNoteListTable && cIdx === 0;
                          const isRightAligned =
                            !isNoteListTable &&
                            !isNoteIndex &&
                            (looksNumericOrHeader || (cIdx > 0 && trimmed.length <= 24));
                          return (
                            <td
                              key={cIdx}
                              className={`px-3 py-1.5 ${
                                isNoteIndex
                                  ? 'w-8 align-top text-left font-mono font-bold text-[#0F5132] dark:text-emerald-400'
                                  : isRightAligned
                                  ? 'text-right tabular-nums text-[#14171A] dark:text-neutral-100 whitespace-nowrap'
                                  : 'text-left font-sans text-[#14171A] dark:text-neutral-200 whitespace-normal'
                              }`}
                            >
                              {highlightTextChunk(cell, highlightTriggers)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
};
