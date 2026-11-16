import React, { useMemo, useState } from 'react';
import { Calculator, Delete, X } from 'lucide-react';
import { evaluateArithmeticExpression } from '../engine/taxCalculators';

interface TaxCalculatorPadProps {
  expr: string;
  onChangeExpr: (next: string) => void;
  onApplyRounded?: (rounded: number) => void;
  canApplyRounded?: boolean;
  onClose?: () => void;
}

const KEY_BUTTONS = [
  ['7', '8', '9', '/'],
  ['4', '5', '6', '*'],
  ['1', '2', '3', '-'],
  ['0', '.', '(', ')'],
];

const FA25_SHORTCUTS = [
  { label: '×19% CT', append: ' * 19%' },
  { label: '×25% CT', append: ' * 25%' },
  { label: '×20% BR', append: ' * 20%' },
  { label: '×40% HR', append: ' * 40%' },
  { label: '÷6 VAT', append: ' / 6' },
  { label: '×11/12', append: ' * 11 / 12' },
];

export const TaxCalculatorPad: React.FC<TaxCalculatorPadProps> = ({
  expr,
  onChangeExpr,
  onApplyRounded,
  canApplyRounded = false,
  onClose,
}) => {
  const [memoryVal, setMemoryVal] = useState<number | null>(null);
  const result = useMemo(() => evaluateArithmeticExpression(expr), [expr]);

  const appendToken = (tok: string) => onChangeExpr(`${expr}${tok}`);

  return (
    <div className="rounded-xl border border-[#E2DFD5] bg-white p-4 shadow-sm dark:border-[#2A313D] dark:bg-[#161B22]">
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#EFECE4] dark:border-[#262C36]">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-[#0F5132] dark:text-emerald-400" />
          <span className="text-xs font-bold text-[#14171A] dark:text-[#F0F3F6]">
            CBE Scientific &amp; FA25 Tax Calculator
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            aria-label="Close calculator"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-2.5">
          <input
            type="text"
            aria-label="CBE calculator expression"
            value={expr}
            onChange={(e) => onChangeExpr(e.target.value)}
            placeholder="Type or tap keys: e.g. 36000 * 36% * 11 / 12"
            className="w-full rounded-lg border border-[#D8D4C8] bg-[#FAF9F6] px-3 py-2 font-mono text-sm font-semibold text-[#14171A] focus:border-[#0F5132] focus:outline-none dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
          />

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#F3F1EA] px-3 py-2 text-xs dark:bg-[#0D1117]">
            {expr.trim() ? (
              result.ok ? (
                <>
                  <span className="font-mono font-bold text-[#14171A] dark:text-[#F0F3F6] tabular-nums">
                    = {result.value.toLocaleString(undefined, { maximumFractionDigits: 4 })}{' '}
                    <span className="text-[#0F5132] dark:text-emerald-400">
                      (Nearest £{result.rounded.toLocaleString()})
                    </span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setMemoryVal(result.value)}
                      className="rounded border border-[#D8D4C8] bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-[#303846] dark:bg-[#1F2631] dark:text-neutral-200"
                    >
                      M+
                    </button>
                    {canApplyRounded && onApplyRounded && (
                      <button
                        type="button"
                        onClick={() => onApplyRounded(result.rounded)}
                        className="rounded bg-[#0F5132] px-2.5 py-1 font-mono text-[11px] font-semibold text-white hover:bg-[#0B3D26] dark:bg-emerald-600 dark:hover:bg-emerald-500"
                      >
                        Use £{result.rounded.toLocaleString()}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <span className="font-mono text-red-700 dark:text-red-400">{result.error}</span>
              )
            ) : (
              <span className="text-neutral-500 dark:text-neutral-400">
                Supports +, −, ×, ÷, %, parentheses &amp; FA25 rate keys
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {FA25_SHORTCUTS.map((sc) => (
              <button
                key={sc.label}
                type="button"
                onClick={() => appendToken(sc.append)}
                className="rounded-md border border-[#D8D4C8] bg-[#FAF9F6] px-2.5 py-1 font-mono text-[11px] font-semibold text-[#1E3A5F] hover:border-[#0F5132] hover:bg-emerald-50/60 dark:border-[#303846] dark:bg-[#1F2631] dark:text-emerald-300 dark:hover:border-emerald-500"
              >
                {sc.label}
              </button>
            ))}
            {memoryVal !== null && (
              <button
                type="button"
                onClick={() => appendToken(String(memoryVal))}
                className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 font-mono text-[11px] font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
              >
                MR ({memoryVal.toLocaleString(undefined, { maximumFractionDigits: 2 })})
              </button>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 grid grid-cols-4 gap-1.5 font-mono text-xs">
          {KEY_BUTTONS.flat().map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => appendToken(key)}
              className="rounded-md border border-[#E2DFD5] bg-[#FAF9F6] py-2 font-semibold text-[#14171A] hover:bg-[#EFECE4] dark:border-[#2A313D] dark:bg-[#1F2631] dark:text-[#F0F3F6] dark:hover:bg-[#2A313D]"
            >
              {key === '*' ? '×' : key === '/' ? '÷' : key}
            </button>
          ))}
          <button
            type="button"
            onClick={() => appendToken('+')}
            className="rounded-md border border-[#E2DFD5] bg-[#EFECE4] py-2 font-bold text-[#14171A] hover:bg-[#E5E1D6] dark:border-[#303846] dark:bg-[#262E3B] dark:text-[#F0F3F6]"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => appendToken('%')}
            className="rounded-md border border-[#E2DFD5] bg-[#EFECE4] py-2 font-bold text-[#14171A] hover:bg-[#E5E1D6] dark:border-[#303846] dark:bg-[#262E3B] dark:text-[#F0F3F6]"
          >
            %
          </button>
          <button
            type="button"
            aria-label="Backspace calculator"
            onClick={() => onChangeExpr(expr.slice(0, -1))}
            className="inline-flex items-center justify-center rounded-md border border-[#E2DFD5] bg-[#FAF9F6] py-2 font-semibold text-neutral-700 hover:bg-[#EFECE4] dark:border-[#2A313D] dark:bg-[#1F2631] dark:text-neutral-200"
          >
            <Delete className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onChangeExpr('')}
            className="rounded-md border border-red-200 bg-red-50 py-2 font-bold text-red-800 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          >
            AC
          </button>
        </div>
      </div>
    </div>
  );
};
