import React, { useMemo, useState } from 'react';
import { Highlighter } from 'lucide-react';

interface ScenarioTextProps {
  text: string;
  label?: string;
}

const TRIGGER_REGEX =
  /(£[\d,]+(?:\.\d+)?|\b\d+(?:\.\d+)?%|\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b|\b20\d{2}\/\d{2}\b|\b(?:exempt|private use|privately|connected|unmarried|furnished|unfurnished|gross|net|excluding|including|part-time|pro-rated|diesel|electric|RDE2|married|civil partner|non-UK|ceased|commenced)\b)/gi;

export const ScenarioText: React.FC<ScenarioTextProps> = ({
  text,
  label = 'Scenario',
}) => {
  const [highlightTriggers, setHighlightTriggers] = useState(false);

  const renderedContent = useMemo(() => {
    if (!highlightTriggers) return text;
    const parts = text.split(TRIGGER_REGEX);
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
  }, [text, highlightTriggers]);

  return (
    <div className="rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] p-4 sm:p-5 dark:border-[#262C36] dark:bg-[#12161D]">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          {label}
        </span>
        <button
          type="button"
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
      <div className="whitespace-pre-line text-sm leading-relaxed text-[#1E2328] dark:text-[#E5E9F0]">
        {renderedContent}
      </div>
    </div>
  );
};
