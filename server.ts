import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const PORT = Number(process.env.PORT || 3000);
const KIT_PDF_PATH = path.resolve(
  process.cwd(),
  'public/assets/aistudio/e262d9c0-398e-4951-b7ff-9b59c2dac61e_TX_Exam_Kit_FA25_d304777f.pdf'
);

interface StudyTextState {
  loaded: boolean;
  fileName: string | null;
  pageCount: number;
  uploadedAt: string | null;
  sampleHeadings: string[];
}

const studyTextMemory: StudyTextState = {
  loaded: false,
  fileName: null,
  pageCount: 0,
  uploadedAt: null,
  sampleHeadings: [],
};

let cachedKitDocPromise: Promise<any> | null = null;
const kitLookupCache = new Map<number, { bookPage: number | null; snippet: string }>();

async function getCachedKitPdfDoc() {
  if (!cachedKitDocPromise) {
    cachedKitDocPromise = (async () => {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const data = new Uint8Array(fs.readFileSync(KIT_PDF_PATH));
      return pdfjs.getDocument({ data, verbosity: 0 }).promise;
    })().catch((err) => {
      cachedKitDocPromise = null;
      throw err;
    });
  }
  return cachedKitDocPromise;
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const msg = err instanceof Error ? err.message : 'Gemini request failed';
  if (/403|PERMISSION_DENIED|API_KEY_INVALID/i.test(msg)) {
    return {
      status: 403,
      message: 'Gemini API key permission denied or invalid. Check Settings > Secrets.',
    };
  }
  if (/429|RESOURCE_EXHAUSTED/i.test(msg)) {
    return {
      status: 429,
      message: 'Gemini quota limit reached right now. Please wait a moment and retry.',
    };
  }
  return { status: 500, message: msg };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '35mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      examKitPresent: fs.existsSync(KIT_PDF_PATH),
      studyTextLoaded: studyTextMemory.loaded,
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  app.get('/api/study-text/status', (_req, res) => {
    res.json({
      examKitPresent: fs.existsSync(KIT_PDF_PATH),
      examKitName: 'Kaplan TX-UK FA25 Exam Kit (Q1–306 + Specimen, 684 pages)',
      studyText: studyTextMemory,
    });
  });

  app.post('/api/study-text/upload', async (req, res) => {
    try {
      const { fileName, base64Data } = req.body as { fileName?: string; base64Data?: string };
      if (!fileName || !base64Data) {
        res.status(400).json({ ok: false, error: 'Missing fileName or base64Data' });
        return;
      }
      const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
      const bytes = Buffer.from(cleanBase64, 'base64');

      // Lightweight page count & heading inspection via pdfjs-dist
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
      const sampleHeadings: string[] = [];
      const checkPages = Math.min(doc.numPages, 15);
      for (let p = 1; p <= checkPages; p++) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        const line = content.items
          .map((it) => ('str' in it ? it.str : ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        const chapterMatch = line.match(/Chapter\s+\d+[:\s-]+[A-Za-z0-9 ,&/()-]{4,60}/i);
        if (chapterMatch && !sampleHeadings.includes(chapterMatch[0])) {
          sampleHeadings.push(chapterMatch[0]);
        }
      }

      studyTextMemory.loaded = true;
      studyTextMemory.fileName = fileName;
      studyTextMemory.pageCount = doc.numPages;
      studyTextMemory.uploadedAt = new Date().toISOString();
      studyTextMemory.sampleHeadings = sampleHeadings.slice(0, 8);

      res.json({ ok: true, studyText: studyTextMemory });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to parse uploaded Study Text PDF',
      });
    }
  });

  // On-demand snippet lookup from the on-disk Exam Kit PDF for Kit Q1–306 & Specimen
  app.get('/api/kit/lookup', async (req, res) => {
    try {
      const rawQuery = String(req.query.q || '').trim().toUpperCase();
      if (!fs.existsSync(KIT_PDF_PATH)) {
        res.status(404).json({ ok: false, error: 'Exam Kit PDF not found on disk' });
        return;
      }

      const isSpecimen = rawQuery.startsWith('SPEC') || /^S\d+$/.test(rawQuery);
      if (isSpecimen) {
        const doc = await getCachedKitPdfDoc();
        const specNum = Math.min(33, Math.max(1, Number(rawQuery.replace(/[^\d]/g, '')) || 1));
        const isCase = rawQuery.includes('CASE');
        const label = isCase ? `Specimen Case ${specNum}` : `Specimen Q${specNum}`;
        let foundBookPage: number | null = null;
        let snippet = '';
        for (let p = 655; p <= Math.min(672, doc.numPages); p++) {
          const page = await doc.getPage(p);
          const content = await page.getTextContent();
          const text = content.items
            .map((it: unknown) =>
              it && typeof it === 'object' && 'str' in it ? String((it as { str: unknown }).str) : ''
            )
            .join(' ')
            .replace(/\s+/g, ' ');
          const searchToken = isCase
            ? specNum === 1
              ? 'Dub Ltd'
              : specNum === 2
              ? 'Opal'
              : 'Glacier Ltd'
            : String(specNum);
          const matched = isCase
            ? text.includes(searchToken)
            : new RegExp(`(?:^|\\s)${specNum}\\s+[A-Z]`).test(text);
          if (matched) {
            foundBookPage = p - 46;
            snippet = text.slice(0, 1400);
            break;
          }
        }
        res.json({
          ok: true,
          cached: false,
          label,
          bookPage: foundBookPage,
          snippet:
            snippet || `${label} lives in the Kaplan TX-UK FA25 Specimen Exam (pages 609–622).`,
        });
        return;
      }

      const qNum = Number(rawQuery.replace(/[^\d]/g, '') || 0);
      if (!qNum || qNum < 1 || qNum > 306) {
        res.status(400).json({ ok: false, error: 'Specify q=1..306 or SPEC-Q1..33' });
        return;
      }
      const cached = kitLookupCache.get(qNum);
      if (cached) {
        res.json({
          ok: true,
          cached: true,
          qNum,
          label: `Kit Q${qNum}`,
          bookPage: cached.bookPage,
          snippet: cached.snippet,
        });
        return;
      }

      const doc = await getCachedKitPdfDoc();

      // Locate exact PDF page range based on Exam Kit question block (+46 front-matter offset)
      let startPdf = 47;
      let endPdf = 120;
      if (qNum >= 128 && qNum <= 179) {
        startPdf = 119;
        endPdf = 156;
      } else if (qNum >= 180 && qNum <= 212) {
        startPdf = 155;
        endPdf = 180;
      } else if (qNum >= 213 && qNum <= 270) {
        startPdf = 179;
        endPdf = 228;
      } else if (qNum >= 271) {
        startPdf = 227;
        endPdf = 258;
      }

      let foundBookPage: number | null = null;
      let snippet = '';
      for (let p = startPdf; p <= Math.min(endPdf, doc.numPages); p++) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        const text = content.items
          .map((it: unknown) => (it && typeof it === 'object' && 'str' in it ? String((it as { str: unknown }).str) : ''))
          .join(' ')
          .replace(/\s+/g, ' ');
        const regex = new RegExp(`(?:^|\\s)${qNum}\\s+[A-Z][A-Za-z0-9'()\\- ]{2,60}`);
        if (regex.test(text)) {
          foundBookPage = p - 46;
          snippet = text.slice(0, 1400);
          break;
        }
      }

      const resolvedSnippet =
        snippet ||
        `Question Q${qNum} lives in the Kaplan TX-UK FA25 Exam Kit PDF (pages ${startPdf - 46}–${endPdf - 46}).`;
      kitLookupCache.set(qNum, { bookPage: foundBookPage, snippet: resolvedSnippet });

      res.json({
        ok: true,
        cached: false,
        qNum,
        label: `Kit Q${qNum}`,
        bookPage: foundBookPage,
        snippet: resolvedSnippet,
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'PDF lookup error',
      });
    }
  });

  // Server-side Gemini CR examiner feedback (uses GEMINI_API_KEY exclusively on backend)
  app.post('/api/coach/grade-cr', async (req, res) => {
    const ai = getGeminiClient();
    const { questionTitle, requirement, modelSolution, userResponse, marks } = req.body as {
      questionTitle?: string;
      requirement?: string;
      modelSolution?: string;
      userResponse?: string;
      marks?: number;
    };

    if (!userResponse || !userResponse.trim()) {
      res.status(400).json({ ok: false, error: 'Please write your working before requesting examiner feedback.' });
      return;
    }

    if (!ai) {
      res.json({
        ok: true,
        source: 'deterministic',
        feedback:
          'Server GEMINI_API_KEY is not configured in this preview environment. Use the deterministic Easy-Marks Audit, CBE Presentation Coach, and interactive Step-by-Step Self-Marking Checkboxes below to mark every 0.5-mark step against the Kaplan model solution.',
      });
      return;
    }

    try {

      const prompt = `You are an ACCA TX-UK (Finance Act 2025) Senior Marker.
Question: ${questionTitle || 'Constructed Response'} (${marks || 10} marks)
Requirement: ${requirement || ''}
Official Kaplan Model Solution:
${(modelSolution || '').slice(0, 3500)}

Student's Working:
${userResponse.slice(0, 3000)}

Provide concise, exam-serious bullet feedback (max 150 words):
1. Estimated marks earned out of ${marks || 10} (apply ACCA own-figure credit).
2. Specific lines done well or easy marks captured (headings, zeros, PAYE, dates).
3. Exact missing steps or FA25 rule slips with pounds (£) figures.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
      });

      res.json({
        ok: true,
        source: 'gemini',
        feedback: response.text ?? 'Unable to generate critique.',
      });
    } catch (err) {
      res.json({
        ok: true,
        source: 'deterministic',
        feedback: `AI critique unavailable (${err instanceof Error ? err.message : 'network error'}). Please mark line-by-line using the ACCA Step Mark Scheme below.`,
      });
    }
  });

  // 1. Gemini Mistake Bank Pattern Diagnosis (batch root-cause analysis)
  app.post('/api/coach/mistake-diagnosis', async (req, res) => {
    const { recentMistakes, topTraps } = req.body as {
      recentMistakes?: Array<{
        questionId: string;
        topicName: string;
        ruleMissed: string;
        userAnswerSummary: string;
        correctAnswerSummary: string;
        kitCitation: string;
        srsStage: number;
      }>;
      topTraps?: Array<{
        trapCategory: string;
        hitCount: number;
        avoidedCount: number;
        ruleSummary: string;
        questionIds: string[];
      }>;
    };

    if (!Array.isArray(recentMistakes) || recentMistakes.length === 0) {
      res.status(400).json({ ok: false, error: 'Log at least one missed question first to run AI pattern diagnosis.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        ok: false,
        configured: false,
        error: 'Gemini server key is not active in this runtime. Showing offline rule diagnosis instead.',
      });
      return;
    }

    try {
      const prompt = `You are an expert ACCA TX-UK (Finance Act 2025 / Tax Year 2025/26) Revision Coach diagnosing a student's Mistake Bank ahead of the 8 December 2026 sitting.

Logged Mistakes (recent ${recentMistakes.length}):
${JSON.stringify(recentMistakes, null, 2)}

Repeat Trap Ledger Hits:
${JSON.stringify(topTraps ?? [], null, 2)}

Identify the student's recurring conceptual errors, give exact Finance Act 2025 (£ and date) rule fixes, order the top 3-5 question IDs to re-drill first, and state one sharp exam-day guardrail.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'Be concise, quantitative, and strictly accurate to Finance Act 2025 (2025/26 UK tax rules: PA £12,570, CGT AEA £3,000, IHT NRB £325k, VAT reg £90k, Class 1 Ee 8%/2%, Er 15% >£5k, CT 19%/25% with £50k/£250k thresholds). Never invent statutes.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            required: ['headline', 'rootCauses', 'priorityOrder', 'examDayRule'],
            properties: {
              headline: { type: Type.STRING },
              rootCauses: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  required: ['title', 'ruleFix', 'questionIds'],
                  properties: {
                    title: { type: Type.STRING },
                    ruleFix: { type: Type.STRING },
                    questionIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                },
              },
              priorityOrder: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              examDayRule: { type: Type.STRING },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        headline?: string;
        rootCauses?: Array<{ title?: string; ruleFix?: string; questionIds?: string[] }>;
        priorityOrder?: string[];
        examDayRule?: string;
      };

      const normalizedCauses = Array.isArray(parsed.rootCauses)
        ? parsed.rootCauses.slice(0, 4).map((rc, idx) => ({
            title: String(rc?.title || `Pattern ${idx + 1}`),
            ruleFix: String(rc?.ruleFix || 'Review the Finance Act 2025 proforma steps for this question.'),
            questionIds: Array.isArray(rc?.questionIds) ? rc.questionIds.map(String) : [],
          }))
        : [];

      res.json({
        ok: true,
        diagnosis: {
          source: 'gemini',
          headline: parsed.headline || 'Mistake Bank pattern diagnosis complete.',
          rootCauses: normalizedCauses,
          priorityOrder: Array.isArray(parsed.priorityOrder) ? parsed.priorityOrder.slice(0, 5).map(String) : [],
          examDayRule: parsed.examDayRule || 'Verify dates, gross/net qualifiers, and FA25 thresholds before locking any answer.',
        },
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ ok: false, configured: true, error: formatted.message });
    }
  });

  // 2. Gemini Per-Mistake Interactive Socratic Tutor
  app.post('/api/coach/mistake-tutor', async (req, res) => {
    const { mistake, questionContext, messages } = req.body as {
      mistake?: {
        questionId: string;
        topicName: string;
        ruleMissed: string;
        userAnswerSummary: string;
        correctAnswerSummary: string;
        kitCitation: string;
      };
      questionContext?: {
        scenario?: string;
        requirement?: string;
        fullWorkedSolution?: string;
        trapOfQuestion?: string;
        speedTrick?: string;
      };
      messages?: Array<{ role: 'user' | 'assistant'; text: string }>;
    };

    if (!mistake || !mistake.questionId) {
      res.status(400).json({ ok: false, error: 'Missing mistake entry context.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        ok: false,
        configured: false,
        error: 'Gemini server key is not configured in this environment.',
      });
      return;
    }

    try {
      const systemInstruction = `You are a patient, crystal-clear ACCA TX-UK (Finance Act 2025, tax year 2025/26) Revision Clinic tutor helping a student fix a specific mistake from their Mistake Bank.

Question: ${mistake.questionId} (${mistake.topicName}, ${mistake.kitCitation})
Scenario: ${(questionContext?.scenario ?? '').slice(0, 1800)}
Requirement: ${(questionContext?.requirement ?? '').slice(0, 500)}
Student's Wrong Answer: ${mistake.userAnswerSummary}
Official Correct Answer: ${mistake.correctAnswerSummary}
Rule / Trap Summary: ${mistake.ruleMissed}
Official Worked Solution: ${(questionContext?.fullWorkedSolution ?? '').slice(0, 2200)}
${questionContext?.speedTrick ? `Examiner Speed Trick: ${questionContext.speedTrick}` : ''}

Keep answers concise (under 180 words), show exact £ workings cleanly line by line, explicitly pinpoint why the student's answer differed, and end with a quick mental check so they don't repeat the trap.`;

      const historyText =
        Array.isArray(messages) && messages.length > 0
          ? messages
              .slice(-8)
              .map((m) => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.text}`)
              .join('\n\n')
          : 'Student: Break down step-by-step why my answer differed from the correct Finance Act 2025 answer, and tell me the fastest way to check this rule in the exam.';

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: historyText,
        config: { systemInstruction },
      });

      res.json({
        ok: true,
        reply: (response.text ?? 'Unable to generate explanation right now.').trim(),
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ ok: false, configured: true, error: formatted.message });
    }
  });

  // 3. Gemini Adaptive Re-Check Practice Drill for a Specific Missed Rule
  app.post('/api/coach/mistake-drill', async (req, res) => {
    const { mistake, questionContext } = req.body as {
      mistake?: {
        questionId: string;
        topicName: string;
        ruleMissed: string;
        correctAnswerSummary: string;
      };
      questionContext?: {
        scenario?: string;
        requirement?: string;
        fullWorkedSolution?: string;
      };
    };

    if (!mistake || !mistake.questionId) {
      res.status(400).json({ ok: false, error: 'Missing mistake entry context.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        ok: false,
        configured: false,
        error: 'Gemini server key is not configured in this environment.',
      });
      return;
    }

    try {
      const prompt = `Create ONE brand-new ACCA TX-UK (Finance Act 2025, Tax Year 2025/26) Section A 2-mark multiple-choice verification question testing the EXACT same rule the student missed on ${mistake.questionId} (${mistake.topicName}), using DIFFERENT realistic UK figures/dates so they cannot rely on memorising the old answer.

Rule Missed: ${mistake.ruleMissed}
Original Scenario Reference: ${(questionContext?.scenario ?? '').slice(0, 1000)}
Original Worked Solution Reference: ${(questionContext?.fullWorkedSolution ?? '').slice(0, 1200)}

Double-check all arithmetic so the correct option matches the exact Finance Act 2025 calculation and all three distractors represent realistic ACCA mistakes.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'You are an ACCA TX-UK Finance Act 2025 question writer. Always verify arithmetic carefully under 2025/26 rates before assigning correctKey.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            required: ['stem', 'requirement', 'options', 'correctKey', 'explanation'],
            properties: {
              stem: { type: Type.STRING },
              requirement: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  required: ['key', 'text'],
                  properties: {
                    key: { type: Type.STRING },
                    text: { type: Type.STRING },
                  },
                },
              },
              correctKey: { type: Type.STRING },
              explanation: { type: Type.STRING },
            },
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      const parsed = JSON.parse(rawText) as {
        stem?: string;
        requirement?: string;
        options?: Array<{ key: string; text: string }>;
        correctKey?: string;
        explanation?: string;
      };

      res.json({
        ok: true,
        drill: {
          source: 'gemini',
          stem: parsed.stem ?? '',
          requirement: parsed.requirement ?? '',
          options: Array.isArray(parsed.options) ? parsed.options.slice(0, 4) : [],
          correctKey: String(parsed.correctKey ?? 'A').toUpperCase(),
          explanation: parsed.explanation ?? '',
        },
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ ok: false, configured: true, error: formatted.message });
    }
  });

  // Serve frontend via Vite middleware (dev) or static dist (production)
  const distDir = path.resolve(process.cwd(), 'dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distDir);

  if (isProd) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TX Mastercoach server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
