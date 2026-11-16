import React from 'react';

export function renderInlineFormatted(line: string): React.ReactNode[] {
  const tokens = line.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g);
  return tokens.map((tok, idx) => {
    if (tok.startsWith('**') && tok.endsWith('**') && tok.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-[#14171A] dark:text-white">
          {tok.slice(2, -2)}
        </strong>
      );
    }
    if (tok.startsWith('*') && tok.endsWith('*') && tok.length > 2) {
      return (
        <em key={idx} className="italic text-neutral-600 dark:text-neutral-300">
          {tok.slice(1, -1)}
        </em>
      );
    }
    if (tok.startsWith('`') && tok.endsWith('`') && tok.length > 2) {
      return (
        <code
          key={idx}
          className="rounded bg-[#EFECE4] px-1 py-0.5 font-mono text-[11px] text-[#0F5132] dark:bg-[#1C222B] dark:text-emerald-300"
        >
          {tok.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{tok}</React.Fragment>;
  });
}

export const FormattedCoachText: React.FC<{ text?: string | null }> = ({ text }) => {
  const safeText = typeof text === 'string' ? text : String(text ?? '');
  if (!safeText.trim()) return null;
  const lines = safeText.split(/\r?\n/);
  return (
    <div className="space-y-1.5">
      {lines.map((rawLine, idx) => {
        const trimmed = rawLine.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;
        const bulletMatch = trimmed.match(/^(?:[-•*]|\d+\.)\s+(.*)$/);
        if (bulletMatch) {
          const marker = trimmed.match(/^(\d+\.)/)?.[1] ?? '•';
          return (
            <div key={idx} className="flex items-start gap-2">
              <span className="font-mono text-[11px] font-bold text-[#0F5132] dark:text-emerald-400 shrink-0">
                {marker}
              </span>
              <span>{renderInlineFormatted(bulletMatch[1])}</span>
            </div>
          );
        }
        return <p key={idx}>{renderInlineFormatted(trimmed)}</p>;
      })}
    </div>
  );
};
