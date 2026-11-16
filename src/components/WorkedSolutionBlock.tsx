import React, { useMemo } from 'react';
import { parseWorkedSolutionBlocks } from '../engine/workedSolutionParser';

interface WorkedSolutionBlockProps {
  text: string;
  compact?: boolean;
}

const NUMERIC_CELL_RE = /^[-−–]?\(?[£$]?[\d,]+(?:\.\d+)?%?\)?$|^[£$]|^✓$|^✗$|^—$|^Nil$/i;

export const WorkedSolutionBlock: React.FC<WorkedSolutionBlockProps> = ({
  text,
  compact = false,
}) => {
  const blocks = useMemo(() => parseWorkedSolutionBlocks(text), [text]);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className={compact ? 'space-y-2.5 text-xs' : 'space-y-3 text-xs'}>
      {blocks.map((block, bIdx) => {
        if (block.type === 'heading') {
          return (
            <h4
              key={bIdx}
              className="border-b border-[#E6E4DD] pb-1 pt-1 font-mono text-[11px] font-bold uppercase tracking-wider text-[#0F5132] dark:border-[#262C36] dark:text-emerald-400"
            >
              {block.text}
            </h4>
          );
        }

        if (block.type === 'table') {
          const maxCols = block.rows.reduce((m, r) => Math.max(m, r.cells.length), 1);
          return (
            <div
              key={bIdx}
              className="overflow-x-auto rounded-lg border border-[#E6E4DD] bg-white dark:border-[#262C36] dark:bg-[#0D1117]"
            >
              <table className="min-w-full border-collapse font-mono text-[12px] leading-snug">
                <tbody>
                  {block.rows.map((row, rIdx) => {
                    const padded = Array.from({ length: maxCols }, (_, cIdx) => {
                      if (row.cells.length === 2 && maxCols > 2 && cIdx > 0 && cIdx < maxCols - 1) {
                        return '';
                      }
                      if (row.cells.length === 2 && maxCols > 2 && cIdx === maxCols - 1) {
                        return row.cells[1];
                      }
                      return row.cells[cIdx] ?? '';
                    });

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
                          const isNumeric = cIdx > 0 || NUMERIC_CELL_RE.test(cell.trim());
                          const isCheck = cell.trim() === '✓';
                          return (
                            <td
                              key={cIdx}
                              className={`px-3 py-1.5 ${
                                cIdx === 0 && !NUMERIC_CELL_RE.test(cell.trim())
                                  ? 'text-left text-[#14171A] dark:text-neutral-200'
                                  : isNumeric
                                  ? 'text-right tabular-nums text-[#14171A] dark:text-neutral-100 whitespace-nowrap'
                                  : 'text-left text-[#14171A] dark:text-neutral-200'
                              } ${isCheck ? 'font-bold text-[#0F5132] dark:text-emerald-400' : ''}`}
                            >
                              {cell}
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
        }

        return (
          <p
            key={bIdx}
            className="whitespace-pre-line font-sans text-xs leading-relaxed text-[#1E2328] dark:text-neutral-200"
          >
            {block.text}
          </p>
        );
      })}
    </div>
  );
};
