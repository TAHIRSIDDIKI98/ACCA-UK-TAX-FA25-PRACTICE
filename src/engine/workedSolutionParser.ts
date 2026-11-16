export type WorkedSolutionBlockItem =
  | { type: 'heading'; text: string }
  | {
      type: 'table';
      rows: Array<{ cells: string[]; ruleAbove?: boolean; ruleBelow?: boolean }>;
    }
  | { type: 'paragraph'; text: string };

const HEADING_RE =
  /^(?:Tutorial note|Tutor[’']s top tips|Key answer tips|Examiner[’']s report|Mark scheme|Suggested solution|Notes?:?|Requirement\s*\(?[a-z0-9]+\)?(?:\s*\([ivx]+\))?|Part\s*\(?[a-z0-9]+\)?|Working\s*\d+(?:\s*[-–:]\s*.*)?|W\d+\s*[-–:].*)$/i;

const DASH_RULE_RE = /^[–—\-_=]{3,}$/;
const TUTOR_BANNER_RE = /^[^|]+\|\s*W\s*alk in the footsteps of a top tutor\s*$/i;

function isDashRule(line: string): boolean {
  const t = line.trim();
  return t.length >= 3 && DASH_RULE_RE.test(t);
}

/**
 * Parses raw Kaplan worked-solution plaintext (containing `|` column delimiters,
 * `––––` subtotal lines, and Tutor/Examiner notes) into structured blocks so proformas
 * and mark schemes render cleanly instead of ASCII wall-of-text.
 */
export function parseWorkedSolutionBlocks(rawText: string): WorkedSolutionBlockItem[] {
  if (!rawText || !rawText.trim()) return [];
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  const blocks: WorkedSolutionBlockItem[] = [];

  let i = 0;
  let paragraphBuf: string[] = [];

  const flushParagraph = () => {
    const joined = paragraphBuf.join('\n').trim();
    if (joined) {
      blocks.push({ type: 'paragraph', text: joined });
    }
    paragraphBuf = [];
  };

  while (i < lines.length) {
    const line = lines[i].trim();

    if (!line) {
      flushParagraph();
      i++;
      continue;
    }

    if (TUTOR_BANNER_RE.test(line)) {
      flushParagraph();
      i++;
      continue;
    }

    // Start of a pipe-delimited table block (or currency/unit line right before a table row)
    const nextLine = (lines[i + 1] ?? '').trim();
    const isTableStart =
      line.includes('|') ||
      ((line === '£' || line === '£m' || line === '$' || line === '%') && nextLine.includes('|'));

    if (isTableStart) {
      flushParagraph();
      const rows: Array<{ cells: string[]; ruleAbove?: boolean; ruleBelow?: boolean }> = [];
      let pendingRuleAbove = false;

      while (i < lines.length) {
        const cur = lines[i].trim();
        if (!cur) break;
        if (TUTOR_BANNER_RE.test(cur)) {
          i++;
          continue;
        }

        if (isDashRule(cur)) {
          if (rows.length > 0) {
            rows[rows.length - 1].ruleBelow = true;
          } else {
            pendingRuleAbove = true;
          }
          i++;
          continue;
        }

        if (cur.includes('|')) {
          const cells = cur
            .split('|')
            .map((c) => c.trim())
            .filter((c, idx, arr) => !(idx === arr.length - 1 && c === ''));
          if (cells.length > 0 && cells.every((c) => c === '' || DASH_RULE_RE.test(c))) {
            if (rows.length > 0) {
              rows[rows.length - 1].ruleBelow = true;
            } else {
              pendingRuleAbove = true;
            }
            i++;
            continue;
          }
          if (cells.length > 0) {
            rows.push({
              cells,
              ruleAbove: pendingRuleAbove || undefined,
            });
            pendingRuleAbove = false;
          }
          i++;
          continue;
        }

        // Standalone unit header (`£`, `%`) or multi-digit/currency total line before another dash/table row
        const lookAhead = (lines[i + 1] ?? '').trim();
        const isUnit = cur === '£' || cur === '£m' || cur === '%';
        const isMultiDigitTotal = /^\(?£?[\d,]{2,}\)?$/.test(cur);
        const isOrphanFootnoteDigit = /^[1-9]$/.test(cur) && lookAhead.includes('|');
        if (isOrphanFootnoteDigit) {
          i++;
          continue;
        }
        if ((isUnit || isMultiDigitTotal) && (lookAhead.includes('|') || isDashRule(lookAhead))) {
          rows.push({
            cells: isUnit ? ['', cur] : ['Total', cur],
            ruleAbove: pendingRuleAbove || undefined,
          });
          pendingRuleAbove = false;
          i++;
          continue;
        }

        break;
      }

      if (rows.length > 0) {
        blocks.push({ type: 'table', rows });
      }
      continue;
    }

    if (isDashRule(line)) {
      flushParagraph();
      i++;
      continue;
    }

    if (HEADING_RE.test(line)) {
      flushParagraph();
      blocks.push({ type: 'heading', text: line });
      i++;
      continue;
    }

    paragraphBuf.push(line);
    i++;
  }

  flushParagraph();
  return blocks;
}

/**
 * Converts raw JSON-serialized OT answers inside Section B mark scheme step labels
 * (e.g. `OT 5: Correct answer ({"0":["True"],"1":["False"]})`) into readable text.
 */
export function formatMarkSchemeLabel(label: string): string {
  const match = label.match(/^(.*?\()(\{.*\}|\[.*\])(\)\s*)$/);
  if (!match) return label;
  const [, prefix, jsonBody, suffix] = match;
  try {
    const parsed = JSON.parse(jsonBody) as unknown;
    if (Array.isArray(parsed)) {
      return `${prefix}${parsed.map((v) => String(v)).join(' · ')}${suffix}`;
    }
    if (parsed && typeof parsed === 'object') {
      const entries = Object.entries(parsed as Record<string, unknown>)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([k, v]) => {
          const idxNum = Number(k);
          const rowPrefix = Number.isFinite(idxNum) ? `Row ${idxNum + 1}` : k;
          const valStr = Array.isArray(v) ? v.join(', ') : String(v);
          return `${rowPrefix}: ${valStr}`;
        });
      if (entries.length > 0) {
        return `${prefix}${entries.join(' · ')}${suffix}`;
      }
    }
  } catch {
    // Fall back to original label if not valid JSON
  }
  return label;
}

export type ScenarioSegment =
  | { type: 'prose'; text: string }
  | {
      type: 'table';
      rows: Array<{ cells: string[]; ruleAbove?: boolean; ruleBelow?: boolean }>;
    };

/**
 * Parses scenario text into prose blocks and structured accounting exhibits,
 * keeping standalone unit (`£`, `%`) and dash-rule (`––––`) lines unified
 * inside the surrounding exhibit table.
 */
export function parseScenarioSegments(rawText: string): ScenarioSegment[] {
  if (!rawText || !rawText.trim()) return [];
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  const segments: ScenarioSegment[] = [];
  let proseBuf: string[] = [];

  const flushProse = () => {
    const joined = proseBuf.join('\n').trim();
    if (joined) segments.push({ type: 'prose', text: joined });
    proseBuf = [];
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    const nextLine = (lines[i + 1] ?? '').trim();
    const isUnitStart =
      (line === '£' || line === '£m' || line === '$' || line === '%') &&
      (nextLine.includes('|') || isDashRule(nextLine));

    if (line.includes('|') || isUnitStart) {
      flushProse();
      const rows: Array<{ cells: string[]; ruleAbove?: boolean; ruleBelow?: boolean }> = [];
      let pendingRuleAbove = false;

      while (i < lines.length) {
        const cur = lines[i].trim();
        if (!cur) break;

        if (isDashRule(cur)) {
          if (rows.length > 0) {
            rows[rows.length - 1].ruleBelow = true;
          } else {
            pendingRuleAbove = true;
          }
          i++;
          continue;
        }

        if (cur.includes('|')) {
          const cells = cur
            .split('|')
            .map((c) => c.trim())
            .filter((c, idx, arr) => !(idx === arr.length - 1 && c === '' && cur.endsWith('|')));
          if (cells.length > 0 && cells.every((c) => c === '' || DASH_RULE_RE.test(c))) {
            if (rows.length > 0) {
              rows[rows.length - 1].ruleBelow = true;
            } else {
              pendingRuleAbove = true;
            }
            i++;
            continue;
          }
          if (cells.length > 1) {
            rows.push({
              cells,
              ruleAbove: pendingRuleAbove || undefined,
            });
            pendingRuleAbove = false;
            i++;
            continue;
          }
          break;
        }

        const lookAhead = (lines[i + 1] ?? '').trim();
        const isUnit = cur === '£' || cur === '£m' || cur === '$' || cur === '%';
        const isSubtotalVal = /^\(?£?[\d,]{2,}\)?$/.test(cur);
        if ((isUnit || isSubtotalVal) && (lookAhead.includes('|') || isDashRule(lookAhead))) {
          rows.push({
            cells: isUnit ? [cur] : ['Total', cur],
            ruleAbove: pendingRuleAbove || undefined,
          });
          pendingRuleAbove = false;
          i++;
          continue;
        }

        break;
      }

      if (rows.length > 0) {
        segments.push({ type: 'table', rows });
      }
      continue;
    }

    if (isDashRule(line)) {
      i++;
      continue;
    }

    proseBuf.push(lines[i]);
    i++;
  }

  flushProse();
  return segments;
}
