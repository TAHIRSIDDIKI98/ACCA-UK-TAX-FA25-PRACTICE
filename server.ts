import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

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

  // On-demand snippet lookup from the on-disk Exam Kit PDF for blocks beyond Q1–127 (CGT/IHT/CT/VAT)
  app.get('/api/kit/lookup', async (req, res) => {
    try {
      const qNum = Number(req.query.q || 0);
      if (!qNum || qNum < 1 || qNum > 306) {
        res.status(400).json({ ok: false, error: 'Specify q=1..306' });
        return;
      }
      if (!fs.existsSync(KIT_PDF_PATH)) {
        res.status(404).json({ ok: false, error: 'Exam Kit PDF not found on disk' });
        return;
      }
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const data = new Uint8Array(fs.readFileSync(KIT_PDF_PATH));
      const doc = await pdfjs.getDocument({ data, verbosity: 0 }).promise;

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
          .map((it) => ('str' in it ? it.str : ''))
          .join(' ')
          .replace(/\s+/g, ' ');
        const regex = new RegExp(`(?:^|\\s)${qNum}\\s+[A-Z][A-Za-z0-9'()\\- ]{2,60}`);
        if (regex.test(text)) {
          foundBookPage = p - 46;
          snippet = text.slice(0, 1400);
          break;
        }
      }

      res.json({
        ok: true,
        qNum,
        bookPage: foundBookPage,
        snippet:
          snippet ||
          `Question Q${qNum} lives in the Kaplan TX-UK FA25 Exam Kit PDF (pages ${startPdf - 46}–${endPdf - 46}).`,
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
    const apiKey = process.env.GEMINI_API_KEY;
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

    if (!apiKey) {
      res.json({
        ok: true,
        source: 'deterministic',
        feedback:
          'Server GEMINI_API_KEY is not configured in this preview environment. Use the deterministic Easy-Marks Audit, CBE Presentation Coach, and interactive Step-by-Step Self-Marking Checkboxes below to mark every 0.5-mark step against the Kaplan model solution.',
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

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
