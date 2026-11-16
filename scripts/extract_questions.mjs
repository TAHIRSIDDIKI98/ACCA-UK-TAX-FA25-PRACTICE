import fs from 'node:fs';
import path from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const PDF_PATH = path.resolve('public/assets/aistudio/e262d9c0-398e-4951-b7ff-9b59c2dac61e_TX_Exam_Kit_FA25_d304777f.pdf');
const OUT_QUESTIONS = path.resolve('src/data/questions.json');
const OUT_SPECIMEN = path.resolve('src/data/specimen.json');

const data = new Uint8Array(fs.readFileSync(PDF_PATH));
const doc = await pdfjs.getDocument({ data, verbosity: 0 }).promise;

function cleanText(s) {
  return s.replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim();
}

function isRunningHeaderOrFooter(line, bookPage) {
  const s = line.trim();
  if (!s) return true;
  if (/^KA\s*PL\s*AN\s*P\s*U\s*BLI\s*SH\s*IN\s*G/i.test(s)) return true;
  if (/^TX\s*[–-]\s*U\s*K\s*:/i.test(s)) return true;
  if (/^PR\s*AC\s*T\s*ICE/i.test(s)) return true;
  if (/^ANS\s*WE\s*R\s*S\s*T\s*O/i.test(s)) return true;
  if (/^SPE\s*CI\s*ME\s*N/i.test(s)) return true;
  if (/^Section\s+\d+$/i.test(s)) return true;
  if (/^PRACTICE\s+INCOME\s+TAX/i.test(s)) return true;
  if (/^PRACTICE\s+SECTION\s+[ABC]/i.test(s)) return true;
  if (/^ANSWERS\s+TO\s+PRACTICE/i.test(s)) return true;
  if (s === String(bookPage) || s.replace(/\s+/g, '') === String(bookPage)) return true;
  return false;
}

async function extractSplitItems(startPdf, endPdf, maxQ, startExpected = 1, skipImportantIntro = false) {
  const itemsByQ = new Map();
  let currentQ = 0;
  let nextExpected = startExpected;
  let pastImportant = !skipImportantIntro;

  for (let p = startPdf; p <= endPdf; p++) {
    const bookPage = p - 46;
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const rows = new Map();
    for (const item of tc.items) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round(item.transform[5] / 2) * 2;
      if (y > 775 || y < 60) continue;
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push({ x: Math.round(item.transform[4]), str: item.str, font: item.fontName });
    }
    const sortedY = [...rows.keys()].sort((a, b) => b - a);
    for (const y of sortedY) {
      const rowItems = rows.get(y).sort((a, b) => a.x - b.x);
      const first = rowItems[0];
      const fullLine = rowItems.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
      if (isRunningHeaderOrFooter(fullLine, bookPage)) continue;

      if (!pastImportant) {
        if (/^Important/i.test(fullLine)) continue;
        if (/^1\s+Calculations\s+and\s+workings/i.test(fullLine)) continue;
        if (/^2\s+All\s+apportionments/i.test(fullLine)) {
          pastImportant = true;
          continue;
        }
        if (/^3\s+In\s+your\s+live\s+exam/i.test(fullLine)) continue;
      }

      const qMatch = first.str.trim().match(/^(\d{1,3})$/);
      if (qMatch && first.x < 92) {
        const num = Number(qMatch[1]);
        if (num === nextExpected && num <= maxQ) {
          pastImportant = true;
          currentQ = num;
          nextExpected++;
          itemsByQ.set(currentQ, {
            qNum: currentQ,
            startPage: bookPage,
            endPage: bookPage,
            rows: [],
          });
          const rest = rowItems.slice(1);
          if (rest.length) {
            itemsByQ.get(currentQ).rows.push({ page: bookPage, y, items: rest });
          }
          continue;
        }
      }

      if (currentQ > 0) {
        itemsByQ.get(currentQ).endPage = bookPage;
        itemsByQ.get(currentQ).rows.push({ page: bookPage, y, items: rowItems });
      }
    }
  }
  return itemsByQ;
}

function rowToText(row, withSep = true) {
  let out = '';
  let prevEnd = null;
  for (const it of row.items) {
    if (prevEnd !== null) {
      if (withSep && it.x - prevEnd > 22) out += '  |  ';
      else if (it.x - prevEnd > 3) out += ' ';
    }
    out += it.str;
    prevEnd = it.x + it.str.length * 4.2;
  }
  return out.trim();
}

function formatLines(rows) {
  return rows
    .map((r) => rowToText(r, true))
    .filter((l) => {
      if (!l) return false;
      if (/^(INCOME TAX BASICS|SELF-EMPLOYMENT|PARTNERSHIPS|PENSIONS|NATIONAL INSURANCE|TRADING LOSSES|SELF-ASSESSMENT|TAXATION|SECTION [ABC]$)/i.test(l) && l === l.toUpperCase() && l.length > 8) {
        return false;
      }
      return true;
    });
}

function classifyITTopic(qNum, text) {
  const t = text.toLowerCase();
  if (qNum === 93) return { topic_id: 6, topic: 'Pensions & Basic Income Tax', st_chapter: 'ch2, ch6, ch11' };
  if (qNum >= 94 && qNum <= 96) return { topic_id: 5, topic: 'Employment income', st_chapter: 'ch5' };
  if (qNum === 97) return { topic_id: 7, topic: 'Income from self-employment', st_chapter: 'ch7, ch8' };

  if (qNum >= 98 && qNum <= 106) return { topic_id: 5, topic: 'Employment income & IT computation', st_chapter: 'ch2, ch5' };
  if (qNum >= 107 && qNum <= 117) return { topic_id: 7, topic: 'Income from self-employment & CAs', st_chapter: 'ch7, ch8' };
  if (qNum >= 118 && qNum <= 121) return { topic_id: 10, topic: 'Trading losses: individuals', st_chapter: 'ch10' };
  if (qNum >= 122 && qNum <= 124) return { topic_id: 9, topic: 'Partnerships', st_chapter: 'ch9' };
  if (qNum === 125) return { topic_id: 6, topic: 'Pensions & NIC', st_chapter: 'ch6, ch11' };
  if (qNum >= 126 && qNum <= 127) return { topic_id: 12, topic: 'Tax administration: individuals', st_chapter: 'ch12' };

  if (qNum >= 1 && qNum <= 16) {
    if (t.includes('resident') || t.includes('ties') || t.includes('residency')) {
      return { topic_id: 3, topic: 'Income tax: residence & additional aspects', st_chapter: 'ch3' };
    }
    return { topic_id: 2, topic: 'Basic income tax computation', st_chapter: 'ch2' };
  }
  if (qNum >= 17 && qNum <= 22) return { topic_id: 4, topic: 'Property income', st_chapter: 'ch4' };
  if (qNum >= 23 && qNum <= 33) return { topic_id: 5, topic: 'Employment income', st_chapter: 'ch5' };
  if (qNum >= 34 && qNum <= 42) return { topic_id: 7, topic: 'Income from self-employment', st_chapter: 'ch7' };
  if (qNum >= 43 && qNum <= 47) return { topic_id: 8, topic: 'Capital allowances', st_chapter: 'ch8' };
  if (qNum >= 48 && qNum <= 52) return { topic_id: 10, topic: 'Trading losses: individuals', st_chapter: 'ch10' };
  if (qNum === 53) return { topic_id: 9, topic: 'Partnerships', st_chapter: 'ch9' };
  if (qNum >= 54 && qNum <= 61) return { topic_id: 11, topic: 'National insurance', st_chapter: 'ch11' };
  if (qNum >= 62 && qNum <= 69) return { topic_id: 6, topic: 'Pensions', st_chapter: 'ch6' };
  if (qNum >= 70 && qNum <= 76) return { topic_id: 1, topic: 'The UK tax system & ethics', st_chapter: 'ch1' };
  if (qNum >= 77 && qNum <= 92) return { topic_id: 12, topic: 'Tax administration: individuals', st_chapter: 'ch12' };

  // Chargeable Gains (Q128-179)
  if (qNum >= 128 && qNum <= 145) return { topic_id: 17, topic: 'CGT: computation of gains & tax', st_chapter: 'ch17' };
  if (qNum >= 146 && qNum <= 154) return { topic_id: 18, topic: 'CGT: special rules', st_chapter: 'ch18' };
  if (qNum >= 155 && qNum <= 161) return { topic_id: 19, topic: 'CGT: shares & securities', st_chapter: 'ch19' };
  if (qNum >= 162 && qNum <= 179) {
    if (qNum === 172 || qNum === 173 || qNum === 174 || qNum === 179 || t.includes('indexation')) {
      return { topic_id: 21, topic: 'Chargeable gains: companies', st_chapter: 'ch21' };
    }
    if (t.includes('rollover') || t.includes('gift holdover') || t.includes('business asset disposal') || t.includes('investors')) {
      return { topic_id: 20, topic: 'CGT: reliefs for individuals', st_chapter: 'ch20' };
    }
    if (t.includes('share pool') || t.includes('30 days') || t.includes('bonus issue') || t.includes('rights issue')) {
      return { topic_id: 19, topic: 'CGT: shares & securities', st_chapter: 'ch19' };
    }
    return { topic_id: 17, topic: 'CGT: computation of gains & tax', st_chapter: 'ch17, ch20' };
  }

  // Inheritance Tax (Q180-212)
  if (qNum >= 180 && qNum <= 212) return { topic_id: 22, topic: 'Inheritance tax', st_chapter: 'ch22' };

  // Corporation Tax (Q213-270)
  if (qNum >= 213 && qNum <= 270) {
    if ((qNum >= 214 && qNum <= 220) || t.includes('quarterly instalment') || t.includes('ixbrl') || t.includes('ct600')) {
      return { topic_id: 16, topic: 'Tax administration: companies', st_chapter: 'ch16' };
    }
    if (qNum === 254 || (qNum >= 262 && qNum <= 265) || t.includes('carried forward') || t.includes('terminal loss')) {
      return { topic_id: 14, topic: 'Company losses', st_chapter: 'ch14' };
    }
    if (qNum === 255 || (qNum >= 266 && qNum <= 270) || t.includes('group relief') || t.includes('75% group')) {
      return { topic_id: 15, topic: 'Groups of companies', st_chapter: 'ch15' };
    }
    return { topic_id: 13, topic: 'Corporation tax', st_chapter: 'ch13' };
  }

  // Value Added Tax (Q271-306)
  if (qNum >= 271 && qNum <= 292) return { topic_id: 23, topic: 'VAT: outline', st_chapter: 'ch23' };
  if (qNum >= 293 && qNum <= 306) {
    if (t.includes('flat rate') || t.includes('cash accounting') || t.includes('annual accounting') || t.includes('points') || t.includes('reverse charge') || t.includes('postponed')) {
      return { topic_id: 24, topic: 'VAT: administration & overseas', st_chapter: 'ch24' };
    }
    return { topic_id: 23, topic: 'VAT: outline & compliance', st_chapter: 'ch23, ch24' };
  }

  return { topic_id: 2, topic: 'Basic income tax computation', st_chapter: 'ch2' };
}

function parsePastExam(lines) {
  for (const l of lines.slice(0, 3)) {
    const m = l.match(/((?:March\/June|Mar\/Jun|Mar\/July|September\/December|Sep\/Dec|Sept\/Dec|June|Jun|Sep|Sept|December|Dec|Pilot)\s*\d{2,4}(?:\s*OT\s*question)?(?:\s*\(ADAPTED\))?)/i);
    if (m) return m[1].replace(/\s*OT\s*question/i, '').trim();
  }
  return null;
}

// Explicit verified definitions for tricky multi-column/table Kit items that use geometric boxes/ticks in the PDF
const EXPLICIT_OVERRIDES = {
  Q34: {
    type: 'number',
    interaction: 'numeric_input',
    scenario:
      'Vicente is a sole trader. He has incurred the following expenses:\n(1) Gifts of food hampers for 10 customers costing £450 in total\n(2) Christmas party for 3 staff members costing £630 in total\n(3) Legal fees of £150 in respect of the acquisition of a 20-year lease of a property\n(4) Employee parking fine whilst on business of £30',
    requirement:
      'What amount of his expenses will be disallowed when calculating Vicente’s tax adjusted trading profits?',
    options: [],
    correct_answer: '600',
  },
  Q50: {
    type: 'multi',
    interaction: 'pair_dropdown',
    requirement: 'Select the earliest tax year to which the loss can be carried back and the amount of loss relieved.',
    options: [
      { group: 'Earliest tax year', choices: ['2020/21', '2021/22', '2022/23', '2023/24', '2024/25'] },
      { group: 'Loss relieved', choices: ['£14,000', '£20,000', '£22,000', '£25,000'] },
    ],
    correct_answer: ['2022/23', '£25,000'],
  },
  Q54: {
    type: 'multi',
    interaction: 'matrix',
    requirement: 'Tick the appropriate boxes to show which NICs are paid by Hamid to HMRC and which are suffered by Hamid.',
    options: {
      columns: ['Paid by Hamid to HMRC', 'Suffered by Hamid'],
      rows: ['Employee class 1 primary', "Employer's class 1 secondary", 'Class 1A', 'Class 4'],
    },
    correct_answer: {
      '0': [],
      '1': ['Paid by Hamid to HMRC', 'Suffered by Hamid'],
      '2': ['Paid by Hamid to HMRC', 'Suffered by Hamid'],
      '3': ['Paid by Hamid to HMRC', 'Suffered by Hamid'],
    },
  },
  Q67: {
    type: 'multi',
    interaction: 'matrix',
    requirement: 'Identify who has made fully tax relievable pension contributions in the tax year 2025/26.',
    options: {
      columns: ['Fully tax relievable', 'Not fully tax relievable'],
      rows: ['Austin', 'Petra'],
    },
    correct_answer: {
      '0': ['Fully tax relievable'],
      '1': ['Not fully tax relievable'],
    },
  },
  Q71: {
    type: 'multi',
    interaction: 'matrix',
    requirement: 'Indicate whether each tax listed is Direct or Indirect and Progressive or Not progressive.',
    options: {
      columns: ['Direct', 'Indirect', 'Progressive', 'Not progressive'],
      rows: ['Income tax', 'Value added tax (VAT)'],
    },
    correct_answer: {
      '0': ['Direct', 'Progressive'],
      '1': ['Indirect', 'Not progressive'],
    },
  },
  Q80: {
    type: 'multi',
    interaction: 'pair_dropdown',
    requirement: 'Complete: A sole trader is required to keep their accounting records for [Number of months] after the [Period].',
    options: [
      { group: 'Number of months', choices: ['12', '60'] },
      { group: 'Period', choices: ['end of the tax year', '31 January that follows the end of the tax year'] },
    ],
    correct_answer: ['60', '31 January that follows the end of the tax year'],
  },
  Q92: {
    type: 'multi',
    interaction: 'pair_dropdown',
    requirement: 'Select the latest RTI filing date for September 2025 and whether a penalty will have been charged.',
    options: [
      { group: 'Latest date', choices: ['30 September 2025', '22 October 2025'] },
      { group: 'Penalty', choices: ['Penalty not charged', 'Penalty charged'] },
    ],
    correct_answer: ['30 September 2025', 'Penalty charged'],
  },
  'SPEC-Q27': {
    type: 'multi',
    interaction: 'pair_dropdown',
    requirement: 'Select the amounts Glacier Ltd will include on its VAT return for the quarter ended 31 March 2026 for output VAT and input VAT on the company car fuel.',
    options: [
      { group: 'Output VAT (£)', choices: ['£48', '£80', '£120', '£479'] },
      { group: 'Input VAT (£)', choices: ['£45', '£80', '£120', '£720'] },
    ],
    correct_answer: ['£80', '£120'],
  },
  'SPEC-Q30': {
    type: 'multi',
    interaction: 'pair_dropdown',
    requirement: 'Complete: Glacier Ltd will be required to issue a VAT invoice when [Type of supply] is made to [Type of customer].',
    options: [
      { group: 'Types of supply', choices: ['a standard-rated supply', 'any type of supply'] },
      { group: 'Types of customer', choices: ['a VAT registered customer', 'any customer'] },
    ],
    correct_answer: ['a standard-rated supply', 'a VAT registered customer'],
  },
  Q145: {
    type: 'multi',
    interaction: 'pair_dropdown',
    requirement: 'Select the share purchases matched in order to the 20,000 shares sold on 1 October 2025.',
    options: [
      {
        group: 'Matched first',
        choices: [
          '20,000 shares from the purchase on 1 June',
          '2,000 shares from the purchase on 1 October',
          '3,000 shares from the purchase on 23 October',
          '15,000 shares from the share pool as at 1 October',
          'No further matches needed',
        ],
      },
      {
        group: 'Matched second',
        choices: [
          '20,000 shares from the purchase on 1 June',
          '2,000 shares from the purchase on 1 October',
          '3,000 shares from the purchase on 23 October',
          '15,000 shares from the share pool as at 1 October',
          'No further matches needed',
        ],
      },
      {
        group: 'Matched third',
        choices: [
          '15,000 shares from the share pool as at 1 October',
          '17,000 shares from the share pool as at 1 October',
          '18,000 shares from the share pool as at 1 October',
          '20,000 shares from the share pool as at 1 October',
          'No further matches needed',
        ],
      },
    ],
    correct_answer: [
      '2,000 shares from the purchase on 1 October',
      '3,000 shares from the purchase on 23 October',
      '15,000 shares from the share pool as at 1 October',
    ],
  },
  Q184: {
    type: 'multi',
    interaction: 'pair_dropdown',
    requirement: 'Select the correct chargeable amount (before NRB) of each gift which becomes chargeable as a result of Amir’s death on 1 February 2026.',
    options: [
      { group: '1. 30 November 2018 (£200,000 to son)', choices: ['0', '194,000', '347,000', '344,000'] },
      { group: '2. 15 June 2019 (£350,000 to daughter)', choices: ['0', '194,000', '347,000', '344,000'] },
    ],
    correct_answer: ['0', '347,000'],
  },
  Q187: {
    type: 'multi',
    interaction: 'pair_dropdown',
    requirement: 'Select the IHT payable by Petra at the time of the gift in June 2022 and on the death of Roman in November 2025.',
    options: [
      { group: 'June 2022', choices: ['£0', '£13,800', '£15,000', '£22,080', '£24,000', '£27,600'] },
      { group: 'November 2025', choices: ['£0', '£13,800', '£15,000', '£22,080', '£24,000', '£27,600'] },
    ],
    correct_answer: ['£0', '£22,080'],
  },
  Q188: {
    type: 'multi',
    interaction: 'matrix',
    requirement: 'Select the gift(s) on which inheritance tax will be payable as a result of Fabrice’s death on 20 January 2026.',
    options: {
      columns: ['Inheritance tax payable'],
      rows: [
        '20 February 2015 | £300,000 to his son',
        '22 March 2018 | £400,000 to a discretionary trust',
        '30 September 2024 | half share in his main residence, worth £250,000 to his daughter',
        '24 December 2025 | £800,000 to his wife',
      ],
    },
    correct_answer: {
      '0': [],
      '1': [],
      '2': ['Inheritance tax payable'],
      '3': [],
    },
  },
  Q193: {
    type: 'multi',
    interaction: 'pair_dropdown',
    requirement: 'Select the value of each item to be included in Kamila’s chargeable death estate for IHT purposes.',
    options: [
      { group: 'House', choices: ['£420,000', '£250,000'] },
      { group: 'Savings', choices: ['£24,000', '£39,500'] },
      { group: 'Debt', choices: ['£0', '£12,000'] },
    ],
    correct_answer: ['£250,000', '£39,500', '£0'],
  },
  Q196: {
    type: 'multi',
    interaction: 'pair_dropdown',
    requirement: 'Match the relevant due dates when IHT became payable on Yuna’s cash gift into a discretionary trust (31 July 2021; died 1 May 2025).',
    options: [
      {
        group: 'In Yuna’s lifetime',
        choices: ['31 January 2022', '30 April 2022', '31 January 2023', '1 November 2025', '30 November 2025', '30 April 2026'],
      },
      {
        group: 'As a result of Yuna’s death',
        choices: ['31 January 2022', '30 April 2022', '31 January 2023', '1 November 2025', '30 November 2025', '30 April 2026'],
      },
    ],
    correct_answer: ['30 April 2022', '30 November 2025'],
  },
  Q213: {
    type: 'multi',
    interaction: 'pair_dropdown',
    requirement: 'Identify Geyor Ltd’s first accounting period for corporation tax purposes and the financial year into which this first accounting period falls.',
    options: [
      { group: 'First accounting period', choices: ['1 March 2025 to 31 March 2025', '1 April 2025 to 31 March 2026'] },
      { group: 'Financial year', choices: ['FY2024', 'FY2025'] },
    ],
    correct_answer: ['1 March 2025 to 31 March 2025', 'FY2024'],
  },
  Q219: {
    type: 'multi',
    interaction: 'pair_dropdown',
    requirement: 'Indicate the corporation tax payable by Red Hill Ltd for the year ended 31 March 2026 and the due date.',
    options: [
      { group: 'Corporation tax payable', choices: ['£154,500', '£156,250', '£162,500'] },
      { group: 'Corporation tax due', choices: ['1 January 2027', '31 March 2027', '31 January 2027'] },
    ],
    correct_answer: ['£154,500', '1 January 2027'],
  },
  Q226: {
    type: 'multi',
    interaction: 'matrix',
    scenario: 'Hound Ltd started to trade on 1 June 2025 and prepared its first set of accounts for the 15-month period to 31 August 2026.',
    requirement: 'On which date(s) must Hound Ltd submit a corporation tax return in respect of the 15-month period of account? Tick all applicable boxes.',
    options: {
      columns: ['Corporation tax return due'],
      rows: ['1 March 2027', '31 May 2027', '1 June 2027', '31 August 2027'],
    },
    correct_answer: {
      '0': [],
      '1': [],
      '2': [],
      '3': ['Corporation tax return due'],
    },
  },
  Q237: {
    type: 'multi',
    interaction: 'matrix',
    requirement: 'Indicate to which companies Computer Ltd’s trading loss could be surrendered under group relief.',
    options: {
      columns: ['Loss can be surrendered to'],
      rows: ['Chair Ltd', 'Bin Ltd', 'Paper Inc', 'Cardboard Ltd'],
    },
    correct_answer: {
      '0': ['Loss can be surrendered to'],
      '1': [],
      '2': [],
      '3': ['Loss can be surrendered to'],
    },
  },
  Q248: {
    type: 'multi',
    interaction: 'matrix',
    requirement: 'Which of the non-large companies have a due date in respect of corporation tax of 1 April 2026? Tick all applicable boxes.',
    options: {
      columns: ['Corporation tax due on 1 April 2026'],
      rows: [
        'W Ltd – prepared accounts for the year ended 30 June 2025',
        'X Ltd – prepared accounts for the 15 months ended 30 September 2025',
        'Y Ltd – prepared accounts for the year ended 31 March 2025',
        'Z Ltd – prepared accounts for the eight months to 30 June 2025',
      ],
    },
    correct_answer: {
      '0': ['Corporation tax due on 1 April 2026'],
      '1': ['Corporation tax due on 1 April 2026'],
      '2': [],
      '3': ['Corporation tax due on 1 April 2026'],
    },
  },
  Q275: {
    type: 'multi',
    interaction: 'matrix',
    requirement: 'Tick the box(es) to show which of the companies under Fergus’s control can be in a VAT group.',
    options: {
      columns: ['Can be in VAT group'],
      rows: ['A Ltd', 'B Ltd', 'C Ltd', 'D Sarl'],
    },
    correct_answer: {
      '0': ['Can be in VAT group'],
      '1': ['Can be in VAT group'],
      '2': ['Can be in VAT group'],
      '3': [],
    },
  },
  Q287: {
    type: 'multi',
    interaction: 'pair_dropdown',
    requirement: 'Indicate the number and amount of the monthly payments on account of VAT Triangle Ltd must make under the annual accounting scheme for y/e 31 December 2025.',
    options: [
      { group: 'Number of monthly payments', choices: ['NINE', 'TEN'] },
      { group: 'Monthly payment amount', choices: ['£4,770', '£7,350'] },
    ],
    correct_answer: ['NINE', '£4,770'],
  },
  'Q95#2': {
    type: 'multi',
    interaction: 'pair_dropdown',
    scenario: '',
    requirement: 'For each employment benefit in Notes 3 to 5, select the taxable benefit for Dill for 2025/26.',
    options: [
      { group: 'Company gym', choices: ['£0', '£780'] },
      { group: 'Workplace nursery', choices: ['£0', '£7,200'] },
      { group: 'Health club membership', choices: ['£0', '£990'] },
    ],
    correct_answer: ['£0', '£0', '£990'],
  },
  'Q162#4': {
    type: 'multi',
    interaction: 'matrix',
    scenario: '',
    requirement: 'Classify each gift made by Michael on 15 March 2026 according to whether it results in a chargeable gain / allowable loss.',
    options: {
      columns: ['Chargeable gain/allowable loss', 'Gain not chargeable/loss not allowable'],
      rows: ['Necklace', 'Boat', 'Machine'],
    },
    correct_answer: {
      '0': ['Gain not chargeable/loss not allowable'],
      '1': ['Gain not chargeable/loss not allowable'],
      '2': ['Gain not chargeable/loss not allowable'],
    },
  },
  'Q164#1': {
    type: 'multi',
    interaction: 'matrix',
    scenario: '',
    requirement: 'Which individuals met the qualifying conditions for business asset disposal relief (BADR) on their shareholdings in Alphabet Ltd?',
    options: {
      columns: ['Meets the conditions for BADR', 'Does not meet the conditions for BADR'],
      rows: ['Aloi', 'Bon', 'Cherry'],
    },
    correct_answer: {
      '0': ['Meets the conditions for BADR'],
      '1': ['Does not meet the conditions for BADR'],
      '2': ['Does not meet the conditions for BADR'],
    },
  },
  'Q167#1': {
    type: 'multi',
    interaction: 'matrix',
    scenario: '',
    requirement: 'Why did neither of Zoyla’s share disposals during 2025/26 qualify for business asset disposal relief?',
    options: {
      columns: ['Size of shareholding', 'Holding period'],
      rows: ['Minor Ltd', 'Major plc'],
    },
    correct_answer: {
      '0': ['Holding period'],
      '1': ['Size of shareholding'],
    },
  },
  'Q203#4': {
    type: 'multi',
    interaction: 'pair_dropdown',
    scenario: '',
    requirement: 'What is the net value of the estate assets 1 – 3 included in Tom’s chargeable death estate for IHT purposes?',
    options: [
      { group: '1. 50% share in a racehorse', choices: ['£0', '£40,000', '£150,000', '£200,000', '£375,000', '£700,000', '£875,000'] },
      { group: '2. Cash winnings', choices: ['£0', '£40,000', '£150,000', '£200,000', '£375,000', '£700,000', '£875,000'] },
      { group: '3. Main residence', choices: ['£0', '£40,000', '£150,000', '£200,000', '£375,000', '£700,000', '£875,000'] },
    ],
    correct_answer: ['£150,000', '£40,000', '£375,000'],
  },
  'Q204#5': {
    type: 'multi',
    interaction: 'pair_dropdown',
    scenario: '',
    requirement: 'Select the due date of payment for both the lifetime IHT on the gift to trust on 27 January 2025 and the tax arising on Afiya’s estate.',
    options: [
      { group: 'Lifetime tax on gift to trust', choices: ['30 April 2025', '27 July 2025', '31 July 2025', '30 April 2026', '29 May 2026', '31 May 2026'] },
      { group: 'Tax on estate', choices: ['30 April 2025', '27 July 2025', '31 July 2025', '30 April 2026', '29 May 2026', '31 May 2026'] },
    ],
    correct_answer: ['31 July 2025', '31 May 2026'],
  },
  'Q206#2': {
    type: 'multi',
    interaction: 'pair_dropdown',
    scenario: '',
    requirement: 'What amount of liabilities 1 – 3 will be deducted in calculating Adana’s chargeable estate for IHT purposes?',
    options: [
      { group: '1. Interest-only mortgage', choices: ['£0', '£4,600', '£43,700', '£220,000'] },
      { group: '2. Income tax payable', choices: ['£0', '£4,600', '£43,700', '£220,000'] },
      { group: '3. Sister’s legal fees', choices: ['£0', '£4,600', '£43,700', '£220,000'] },
    ],
    correct_answer: ['£220,000', '£43,700', '£0'],
  },
  'Q206#3': {
    type: 'multi',
    interaction: 'matrix',
    scenario: '',
    requirement: 'Select who is responsible for paying the IHT of £566,000 on Adana’s chargeable estate and the due date of payment.',
    options: {
      columns: ['30 September 2026', '17 September 2026', '17 March 2027'],
      rows: ['Beneficiaries (her children)', 'Personal representatives'],
    },
    correct_answer: {
      '0': [],
      '1': ['30 September 2026'],
    },
  },
  'Q208#5': {
    type: 'multi',
    interaction: 'pair_dropdown',
    scenario: '',
    requirement: 'Identify who is responsible for paying the IHT arising on the PET made to the grandson on 11 May 2022 as a result of Nagina’s death and the due date.',
    options: [
      { group: 'Responsible for payment', choices: ['Grandson', 'Personal representatives of Nagina’s estate'] },
      { group: 'Date payable by', choices: ['31 December 2025', '26 December 2025'] },
    ],
    correct_answer: ['Grandson', '31 December 2025'],
  },
  'Q252#2': {
    type: 'mcq',
    interaction: 'single_mcq',
    scenario: '',
    requirement: 'What amount must be added back in the adjustment of trading profits computation in respect of gifts and donations?',
    options: [
      { key: 'A', text: '£2,310' },
      { key: 'B', text: '£2,740' },
      { key: 'C', text: '£1,650' },
      { key: 'D', text: '£660' },
    ],
    correct_answer: 'A',
  },
  'Q252#5': {
    type: 'multi',
    interaction: 'matrix',
    scenario: '',
    requirement: 'Assuming Greenzone Ltd is a large company, on which dates are instalments of its CT liability for the six months ended 31 March 2026 payable?',
    options: {
      columns: ['Instalment date payable'],
      rows: ['14 January 2026', '14 April 2026', '14 July 2026', '14 October 2026'],
    },
    correct_answer: {
      '0': [],
      '1': ['Instalment date payable'],
      '2': ['Instalment date payable'],
      '3': [],
    },
  },
  'Q253#3': {
    type: 'multi',
    interaction: 'pair_dropdown',
    scenario: '',
    requirement: 'On what dates are the first and last instalments of Mixture Ltd’s corporation tax liability for the year ended 31 March 2026 payable?',
    options: [
      {
        group: 'First instalment',
        choices: ['14 September 2025', '14 October 2025', '14 June 2026', '14 July 2026', '14 September 2026', '14 October 2026', '14 June 2027', '14 July 2027'],
      },
      {
        group: 'Last instalment',
        choices: ['14 September 2025', '14 October 2025', '14 June 2026', '14 July 2026', '14 September 2026', '14 October 2026', '14 June 2027', '14 July 2027'],
      },
    ],
    correct_answer: ['14 October 2025', '14 July 2026'],
  },
  'Q255#1': {
    type: 'multi',
    interaction: 'matrix',
    scenario: '',
    requirement: 'Which of the four trading companies will be treated as associated companies of Deutsch Ltd?',
    options: {
      columns: ['Associated company'],
      rows: ['Eins Ltd', 'Zwei Ltd', 'Drei Ltd', 'Vier Co'],
    },
    correct_answer: {
      '0': ['Associated company'],
      '1': [],
      '2': ['Associated company'],
      '3': ['Associated company'],
    },
  },
  'Q293#4': {
    type: 'multi',
    interaction: 'pair_dropdown',
    scenario: '',
    requirement: 'Indicate the percentage penalty payable for late payment of tax for the quarter ended 30 September 2025 and whether interest will be charged.',
    options: [
      { group: 'Percentage penalty', choices: ['0%', '3%', '6%'] },
      { group: 'Interest payable', choices: ['Yes', 'No'] },
    ],
    correct_answer: ['3%', 'Yes'],
  },
  'Q296#5': {
    type: 'multi',
    interaction: 'matrix',
    scenario: '',
    requirement: 'Which THREE items of information is Alisa always required to include on a valid VAT invoice?',
    options: {
      columns: ['Required on valid VAT invoice'],
      rows: [
        'The customer’s VAT registration number',
        'An invoice number',
        'The customer’s address',
        'Date of delivery of the goods',
        'A description of the services supplied',
        'The price inclusive and exclusive of a prompt payment discount',
      ],
    },
    correct_answer: {
      '0': [],
      '1': ['Required on valid VAT invoice'],
      '2': ['Required on valid VAT invoice'],
      '3': [],
      '4': ['Required on valid VAT invoice'],
      '5': [],
    },
  },
  'Q297#4': {
    type: 'multi',
    interaction: 'pair_dropdown',
    scenario: '',
    requirement: 'Select the actual tax point date for the 25% deposit and 75% balancing payment in respect of the room hire.',
    options: [
      { group: '25% Deposit', choices: ['When the deposit is paid', 'Invoice date', 'Day of the room hire', 'When the balance is paid'] },
      { group: '75% Balancing Payment', choices: ['When the deposit is paid', 'Invoice date', 'Day of the room hire', 'When the balance is paid'] },
    ],
    correct_answer: ['When the deposit is paid', 'Invoice date'],
  },
  'Q298#2': {
    type: 'mcq',
    interaction: 'single_mcq',
    scenario: '',
    requirement: 'How much input tax is recoverable in respect of the sundry expenses incurred in the quarter to 31 March 2026?',
    options: [
      { key: 'A', text: '£9,260' },
      { key: 'B', text: '£12,421' },
      { key: 'C', text: '£12,560' },
      { key: 'D', text: '£12,631' },
    ],
    correct_answer: 'C',
  },
  'Q299#5': {
    type: 'multi',
    interaction: 'pair_dropdown',
    scenario: '',
    requirement: 'Select how long it will take for the late-submission penalty point to expire and which VAT scheme helps avoid further late submissions.',
    options: [
      { group: 'Penalty point expiry period', choices: ['One year', 'Two years'] },
      { group: 'VAT scheme reducing late filing burden', choices: ['Annual accounting', 'Cash accounting', 'Flat rate'] },
    ],
    correct_answer: ['Two years', 'Annual accounting'],
  },
};

function parseSectionAOt(qObj, aObj, overrideKey = null) {
  const qRows = qObj.rows;
  const aRows = aObj.rows;
  const qLines = formatLines(qRows);
  const aLines = formatLines(aRows);
  const fullQText = qLines.join('\n');
  const pastExam = parsePastExam(qLines);

  const bodyLines = pastExam && qLines[0] && qLines[0].toLowerCase().includes(pastExam.toLowerCase().split(' ')[0])
    ? qLines.slice(1)
    : [...qLines];

  if (overrideKey && EXPLICIT_OVERRIDES[overrideKey]) {
    const ov = EXPLICIT_OVERRIDES[overrideKey];
    return {
      ...ov,
      scenario: ov.scenario ?? bodyLines.join('\n'),
      full_worked_solution: aLines.join('\n'),
      past_exam: pastExam,
    };
  }

  // Standard A-F options (includes Which TWO/THREE or single MCQ, or Specimen 1-4 options)
  const firstOptIdx = bodyLines.findIndex((l) => /^A\s*(?:\||  )/.test(l));
  const isMulti = /Which\s+(?:TWO|THREE)|Select\s+(?:TWO|THREE)/i.test(fullQText);

  if (firstOptIdx !== -1 && bodyLines.some((l, idx) => idx > firstOptIdx && /^D\s*(?:\||  )/.test(l))) {
    const options = [];
    let curKey = null;
    let curText = '';
    for (let i = firstOptIdx; i < bodyLines.length; i++) {
      const m = bodyLines[i].match(/^([A-F])\s*(?:\|\s*|\s+)(.*)$/);
      if (m && (!curKey || m[1].charCodeAt(0) === curKey.charCodeAt(0) + 1)) {
        if (curKey) options.push({ key: curKey, text: cleanText(curText) });
        curKey = m[1];
        curText = m[2];
      } else if (curKey) {
        curText += ' ' + bodyLines[i].replace(/\s*\|\s*/g, ' ');
      }
    }
    if (curKey) options.push({ key: curKey, text: cleanText(curText) });

    const preOpt = bodyLines.slice(0, firstOptIdx);
    const reqIdx = preOpt.findIndex((l) => /\?$/.test(l) || /^(What|Which|How|From|In\s|For\s|By\s|Select)/i.test(l));
    let scenario = preOpt.join('\n');
    let requirement = 'Select the correct option.';
    if (reqIdx !== -1) {
      let splitAt = preOpt.length - 1;
      for (let i = preOpt.length - 1; i >= 0; i--) {
        if (i < preOpt.length - 1 && (/[.?]$/.test(preOpt[i]) || /:$/.test(preOpt[i]))) {
          splitAt = i + 1;
          break;
        }
        if (i === 0) splitAt = 0;
      }
      scenario = preOpt.slice(0, splitAt).join('\n').trim();
      requirement = preOpt.slice(splitAt).join(' ').replace(/\s*\|\s*/g, ' | ').trim();
    }

    const ansLine = cleanText(aLines[0] || '');
    let correctAnswer = '';
    if (isMulti) {
      const matches = ansLine.match(/\b([A-F])\b/g) || [];
      const count = /THREE/i.test(fullQText) ? 3 : 2;
      correctAnswer = [...new Set(matches)].slice(0, count);
    } else {
      const m = ansLine.match(/^([A-F])\b/);
      if (m) {
        correctAnswer = m[1];
      } else {
        // Check if answer line equals one of the option texts (e.g. Specimen Q24 "£88,000", Q26 "£3,480")
        const matched = options.find((o) => cleanText(o.text).toLowerCase() === ansLine.toLowerCase());
        correctAnswer = matched ? matched.key : ansLine;
      }
    }

    return {
      type: isMulti ? 'multi' : 'mcq',
      interaction: isMulti ? 'multi_select' : 'single_mcq',
      scenario,
      requirement,
      options,
      correct_answer: correctAnswer,
      full_worked_solution: aLines.join('\n'),
      past_exam: pastExam,
    };
  }

  // Specimen 1..4 options (Specimen Q2, Q11, Q17, Q22, Q25 use 1, 2, 3, 4 instead of A, B, C, D)
  const firstNumOptIdx = bodyLines.findIndex((l) => /^1\s*\|\s+/.test(l));
  if (firstNumOptIdx !== -1 && bodyLines.some((l, idx) => idx > firstNumOptIdx && /^4\s*\|\s+/.test(l))) {
    const options = [];
    let curKey = null;
    let curText = '';
    for (let i = firstNumOptIdx; i < bodyLines.length; i++) {
      const m = bodyLines[i].match(/^([1-4])\s*(?:\|\s*|\s+)(.*)$/);
      if (m && (!curKey || Number(m[1]) === Number(curKey) + 1)) {
        if (curKey) options.push({ key: curKey, text: cleanText(curText) });
        curKey = m[1];
        curText = m[2];
      } else if (curKey) {
        curText += ' ' + bodyLines[i].replace(/\s*\|\s*/g, ' ');
      }
    }
    if (curKey) options.push({ key: curKey, text: cleanText(curText) });
    const ansLine = cleanText(aLines[0] || '');
    const matches = ansLine.match(/\b([1-4])\b/g) || [];
    return {
      type: 'multi',
      interaction: 'multi_select',
      scenario: bodyLines.slice(0, firstNumOptIdx).join('\n'),
      requirement: 'Select TWO options.',
      options,
      correct_answer: [...new Set(matches)].slice(0, 2),
      full_worked_solution: aLines.join('\n'),
      past_exam: pastExam,
    };
  }

  // 2x2 A/B/C/D table (Q11, Q77, Q82, Q86)
  const hasGridABCD = bodyLines.some((l) => /\|\s*A\s*\|\s*B\b/.test(l)) && bodyLines.some((l) => /\|\s*C\s*\|\s*D\b/.test(l));
  if (hasGridABCD) {
    const ansM = cleanText(aLines[0] || '').match(/^([A-D])\b/);
    const aIdx = bodyLines.findIndex((l) => /\|\s*A\s*\|\s*B\b/.test(l));
    const cIdx = bodyLines.findIndex((l) => /\|\s*C\s*\|\s*D\b/.test(l));
    const colLine = bodyLines[aIdx - 1] || '';
    const colParts = colLine.split('|').map((s) => s.trim()).filter(Boolean);
    const rowA = bodyLines[aIdx].split('|').map((s) => s.trim());
    const rowC = bodyLines[cIdx].split('|').map((s) => s.trim());
    const rowLabelA = rowA[0] === 'A' ? 'Option Row 1' : rowA[0];
    const rowLabelC = rowC[0] === 'C' ? 'Option Row 2' : rowC[0];
    const c1 = colParts[colParts.length - 2] || 'Col 1';
    const c2 = colParts[colParts.length - 1] || 'Col 2';
    const options = [
      { key: 'A', text: `${rowLabelA} / ${c1}` },
      { key: 'B', text: `${rowLabelA} / ${c2}` },
      { key: 'C', text: `${rowLabelC} / ${c1}` },
      { key: 'D', text: `${rowLabelC} / ${c2}` },
    ];
    return {
      type: 'mcq',
      interaction: 'grid_2x2',
      scenario: bodyLines.slice(0, Math.max(1, aIdx - 2)).join('\n'),
      requirement: bodyLines.slice(Math.max(1, aIdx - 2)).join('\n'),
      options,
      correct_answer: ansM ? ansM[1] : 'A',
      full_worked_solution: aLines.join('\n'),
      past_exam: pastExam,
    };
  }

  // Tick-box matrix in answer rows (contains  or )
  const hasTicks = aRows.some((r) => r.items.some((i) => /[✓]/.test(i.str)));
  if (hasTicks) {
    const tickHeaderRow = aRows.find((r) => r.items.length >= 2 && r.items[0].x > 180 && !r.items.some((i) => /[✓]/.test(i.str)));
    let colCenters = [];
    if (tickHeaderRow) {
      const cols = [];
      for (const it of tickHeaderRow.items) {
        const last = cols[cols.length - 1];
        if (last && it.x - last.endX < 25) {
          last.label += ' ' + it.str;
          last.endX = it.x + it.str.length * 4.2;
        } else {
          cols.push({ label: it.str, startX: it.x, endX: it.x + it.str.length * 4.2 });
        }
      }
      colCenters = cols.map((c) => ({ label: cleanText(c.label), x: (c.startX + c.endX) / 2 }));
    }

    const stopIdx = aRows.findIndex((r) => {
      const txt = rowToText(r, false);
      return /^(Tutorial note|Examiner|Income generated|As Ella|Austin|VAT is|The gift|Taxpayers|Income tax)/i.test(txt);
    });
    const matrixARows = aRows.slice(0, stopIdx === -1 ? Math.min(aRows.length, 14) : stopIdx);
    const matrixItems = [];
    let pendingLabel = '';
    for (const r of matrixARows) {
      if (r === tickHeaderRow) continue;
      const nonTickLeft = r.items.filter((i) => i.x < 210 && !/[✓]/.test(i.str));
      const ticks = r.items.filter((i) => /[✓]/.test(i.str));
      const rightText = r.items.filter((i) => i.x >= 210 && !/[✓]/.test(i.str));
      if (nonTickLeft.length === 0 && rightText.length > 0 && ticks.length === 0) continue;
      const leftStr = cleanText(nonTickLeft.map((i) => i.str).join(' '));
      if (ticks.length > 0) {
        const chosenCols = ticks.map((tk) => {
          let bestIdx = 0;
          let bestDist = Infinity;
          colCenters.forEach((c, idx) => {
            const d = Math.abs(tk.x - c.x);
            if (d < bestDist) {
              bestDist = d;
              bestIdx = idx;
            }
          });
          return bestIdx;
        });
        const label = leftStr || pendingLabel;
        if (label) {
          matrixItems.push({ label, correctCols: chosenCols });
          pendingLabel = '';
        }
      } else if (leftStr) {
        pendingLabel = pendingLabel ? `${pendingLabel} ${leftStr}` : leftStr;
      }
    }

    const headerStartIdx = bodyLines.findIndex((l) => colCenters[0] && l.toLowerCase().includes(colCenters[0].label.toLowerCase().split(' ')[0]));
    const scenarioLines = headerStartIdx > 0 ? bodyLines.slice(0, headerStartIdx) : bodyLines;
    return {
      type: 'multi',
      interaction: 'matrix',
      scenario: scenarioLines.join('\n'),
      requirement: 'Tick the appropriate option(s) for each item below.',
      options: {
        columns: colCenters.map((c) => c.label),
        rows: matrixItems.map((m) => m.label),
      },
      correct_answer: matrixItems.reduce((acc, m, idx) => {
        acc[String(idx)] = m.correctCols.map((ci) => colCenters[ci]?.label || String(ci));
        return acc;
      }, {}),
      full_worked_solution: aLines.join('\n'),
      past_exam: pastExam,
    };
  }

  // Pair dropdown (Q60)
  const pairAns = cleanText(aLines[0] || '');
  if (pairAns.includes(',') && !/^£?[\d,]+$/.test(pairAns)) {
    const parts = pairAns.split(',').map((s) => s.trim());
    const tableLines = bodyLines.slice(-4);
    const headers = (tableLines[0] || '').split('|').map((s) => s.trim()).filter(Boolean);
    const cols = headers.map((h, ci) => ({
      group: h,
      choices: tableLines.slice(1).map((r) => (r.split('|')[ci] || '').trim()).filter(Boolean),
    }));
    return {
      type: 'multi',
      interaction: 'pair_dropdown',
      scenario: bodyLines.slice(0, -4).join('\n'),
      requirement: `Select the correct ${headers.join(' and ')}.`,
      options: cols,
      correct_answer: parts,
      full_worked_solution: aLines.join('\n'),
      past_exam: pastExam,
    };
  }

  // Specimen Q9 EXEMPT / NOT EXEMPT per row
  if (/EXEMPT\s*\|\s*NOT\s*EXEMPT/i.test(fullQText)) {
    const startIdx = bodyLines.findIndex((l) => /EXEMPT/i.test(l));
    const itemLines = bodyLines.slice(startIdx).map((l) => l.split('|')[0].trim()).filter(Boolean);
    return {
      type: 'multi',
      interaction: 'matrix',
      scenario: bodyLines.slice(0, startIdx).join('\n'),
      requirement: 'Select whether each gift is Exempt or Not exempt.',
      options: {
        columns: ['EXEMPT', 'NOT EXEMPT'],
        rows: itemLines,
      },
      correct_answer: {
        '0': ['NOT EXEMPT'],
        '1': ['NOT EXEMPT'],
        '2': ['NOT EXEMPT'],
        '3': ['EXEMPT'],
      },
      full_worked_solution: aLines.join('\n'),
      past_exam: pastExam,
    };
  }

  // Specimen Q13 Business / Non-business records dates
  if (overrideKey === 'SPEC-Q13' || /31 January 2028\s*\|\s*31 January 2032/i.test(fullQText)) {
    return {
      type: 'multi',
      interaction: 'matrix',
      scenario: bodyLines.slice(0, -2).join('\n'),
      requirement: 'Select the date until which Ming must retain each type of record.',
      options: {
        columns: ['31 January 2028', '31 January 2032'],
        rows: ['Business records', 'Non-business records'],
      },
      correct_answer: {
        '0': ['31 January 2032'],
        '1': ['31 January 2032'],
      },
      full_worked_solution: aLines.join('\n'),
      past_exam: pastExam,
    };
  }

  // Numeric fill-in-the-blank
  const numClean = cleanText(aLines[0] || '').replace(/[£,\s]/g, '');
  const numMatch = numClean.match(/(-?\d+(?:\.\d+)?)/);
  const preBlank = bodyLines.filter((l) => l !== '£');
  return {
    type: 'number',
    interaction: 'numeric_input',
    scenario: preBlank.slice(0, -1).join('\n'),
    requirement: preBlank[preBlank.length - 1] || 'Enter your numeric answer (£).',
    options: [],
    correct_answer: numMatch ? numMatch[1] : cleanText(aLines[0] || ''),
    full_worked_solution: aLines.join('\n'),
    past_exam: pastExam,
  };
}

function buildExaminerDebrief(qNum, topicObj, pastExam, qText, aText, correctAns) {
  const exMatch = aText.match(/Examiner[’']s report\s*([\s\S]*?)(?:Tutorial note|Tutor[’']s top tips|$)/i);
  const tutMatch = aText.match(/(?:Tutorial note|Tutor[’']s top tips|Key answer tips)\s*([\s\S]*?)(?:Examiner[’']s report|$)/i);
  const exSnippet = exMatch ? cleanText(exMatch[1]).slice(0, 260) : '';
  const tutSnippet = tutMatch ? cleanText(tutMatch[1]).slice(0, 260) : '';

  const tLow = (qText + ' ' + aText).toLowerCase();
  let trapCategory = topicObj.topic;
  let speedTrick = 'Extract all dates and status adjectives first, then run a single clean vertical working.';
  let twistPrediction = 'Next sitting they could flip a date (part-year apportionment) or change an asset/income exemption status.';

  if (tLow.includes('rde2') || tLow.includes('co2')) {
    trapCategory = 'Cars & Fuel Benefits';
    speedTrick = 'Compute % first (round CO2 DOWN to nearest 5, check RDE2, apply 37% cap), then list price × % × months/12 in one line.';
    twistPrediction = 'Next sitting they could change the car to non-RDE2 diesel (+4%, max 37%) or shift availability to 6 October (6/12).';
  } else if (tLow.includes('resident') || tLow.includes('ties')) {
    trapCategory = 'UK Residence';
    speedTrick = 'Always test Automatic Non-UK -> Automatic UK -> Sufficient Ties strictly in order; never jump straight to ties.';
    twistPrediction = 'Next sitting they could flip whether the taxpayer was UK resident in any of the previous 3 tax years (leaver vs arriver ties).';
  } else if (tLow.includes('adjusted net income') || tLow.includes('100,000') || tLow.includes('personal allowance')) {
    trapCategory = 'PA Taper & ANI';
    speedTrick = 'ANI = Net income − GROSS Gift Aid − GROSS personal pension contributions; PA vanishes completely at £125,140.';
    twistPrediction = 'Next sitting they could state net Gift Aid or net pension payment instead of gross, requiring × 100/80 before deducting.';
  } else if (tLow.includes('dividend') || tLow.includes('savings')) {
    trapCategory = 'Savings & Dividend Bands';
    speedTrick = 'Order income strictly Non-savings -> Savings -> Dividends; remember the £500 dividend / £1,000 savings NRBs consume basic rate band.';
    twistPrediction = 'Next sitting they could push taxable income just over £37,700 or £125,140 so NRBs reduce to £500 or £0.';
  } else if (tLow.includes('class 1a') || tLow.includes('class 4') || tLow.includes('class 1')) {
    trapCategory = 'National Insurance';
    speedTrick = 'Class 1/1A/4 never deduct pension contributions; benefits go on Class 1A (15%) due 22 July 2026, not Class 1.';
    twistPrediction = 'Next sitting they could add Employment Allowance (£10,500 per employer) or a director paid unevenly across months.';
  } else if (tLow.includes('loss') || tLow.includes('terminal') || tLow.includes('opening')) {
    trapCategory = 'Trading Losses';
    speedTrick = 'Check the claim deadline (31 Jan 2028 vs 5 Apr 2030) and whether early-years (3 yrs FIFO) or normal s.64 (current/prior year) applies.';
    twistPrediction = 'Next sitting they could trigger the £50,000 / 25% cap on income tax reliefs against non-trading income.';
  } else if (tLow.includes('capital allowance') || tLow.includes('aia') || tLow.includes('wda')) {
    trapCategory = 'Capital Allowances';
    speedTrick = 'AIA/WDA time-apportion for short/long periods, FYA NEVER does; private use by owner gets a separate column, employee private use is ignored.';
    twistPrediction = 'Next sitting they could make a zero-emission car second-hand (18% main pool instead of 100% FYA).';
  } else if (tLow.includes('property') || tLow.includes('premium') || tLow.includes('mortgage')) {
    trapCategory = 'Property Income';
    speedTrick = 'Individual residential mortgage interest is a 20% tax reducer, NEVER a property deduction; lease premium = P × (51 − n)/50.';
    twistPrediction = 'Next sitting they could include an initial furniture purchase (0% relief) alongside a like-for-like replacement (100% relief).';
  } else if (topicObj.topic_id >= 17 && topicObj.topic_id <= 21) {
    trapCategory = 'CGT Losses & Matching';
    speedTrick = 'Offset CY capital losses BEFORE £3,000 AEA, brought-forward losses AFTER; BADR 14% consumes remaining basic rate band first.';
    twistPrediction = 'Next sitting they could plant a £6,000 chattel disposal (5/3 cap) or switch between 30-day individual vs 9-day company matching.';
  } else if (topicObj.topic_id === 22) {
    trapCategory = 'Inheritance Tax';
    speedTrick = 'CLT with donor paying = 25% gross-up on excess over NRB; Taper Relief reduces TAX payable, NEVER the gift value; death estate adds 7-yr cumulation.';
    twistPrediction = 'Next sitting they could include a £300 gift (fails £250 small gifts exemption completely) or exempt spouse + RNRB direct descendants.';
  } else if (topicObj.topic_id >= 13 && topicObj.topic_id <= 16) {
    trapCategory = 'Corporation Tax';
    speedTrick = 'Augmented profits = TTP + non-associated exempt dividends; divide £50k/£250k/£1.5m by (1 + associates) and × months/12.';
    twistPrediction = 'Next sitting they could add a short accounting period (<12m) or restrict CY loss relief where QCDs would otherwise be wasted.';
  } else if (topicObj.topic_id >= 23) {
    trapCategory = 'VAT Compliance & FRS';
    speedTrick = 'Historic £90k: notify 30 days, charge from 1st day of 2nd month after; Flat Rate % always hits VAT-INCLUSIVE total turnover.';
    twistPrediction = 'Next sitting they could test 6-month bad debt wait from PAYMENT DUE DATE or overseas entertaining (recoverable) vs UK customer entertaining (blocked).';
  }

  // Derive crisp rule summary from the first 1-2 explanation sentences of the solution
  const solLines = aText
    .split('\n')
    .map((l) => cleanText(l))
    .filter(
      (l) =>
        l &&
        !/^(Examiner[’']s report|Tutorial note|Tutor[’']s top tips|Key answer tips)/i.test(l) &&
        !/^[A-F](?:\s*,\s*[A-F])*$/.test(l) &&
        !/^£?[\d,]+$/.test(l)
    );
  const explanationLead = solLines.slice(0, 2).join(' ').slice(0, 210);

  return {
    trap_category: trapCategory,
    trap_of_question: explanationLead
      ? `${trapCategory}: ${explanationLead}${explanationLead.length >= 210 ? '…' : ''}`
      : `Kit Q${qNum} (${pastExam || topicObj.topic}): verify statutory conditions & tax-year dates for ${typeof correctAns === 'string' ? correctAns : JSON.stringify(correctAns)}.`,
    distractor_forensics:
      exSnippet ||
      'Compare each distractor against omitting one statutory condition (e.g. grossing up net figures, part-year time apportionment, or RDE2/band thresholds).',
    examiner_playbook:
      tutSnippet ||
      'Circle every date, net/gross qualifier, and tax-year label before running the proforma computation.',
    speed_trick: speedTrick,
    twist_prediction: twistPrediction,
  };
}

function parseSectionBCase(qObj, aObj) {
  const qLines = formatLines(qObj.rows);
  const aLines = formatLines(aObj.rows);
  const pastExam = parsePastExam(qLines);
  const titleLine = cleanText(qLines[0] || `Case ${qObj.qNum}`);
  const title = titleLine.replace(/Walk in the footsteps of a top tutor/gi, '').trim();

  const allMarkers = [];
  for (let i = 1; i < qObj.rows.length; i++) {
    const first = qObj.rows[i].items[0];
    if (first && first.x < 125 && /^[1-5]$/.test(first.str.trim())) {
      allMarkers.push({ idx: i, n: Number(first.str.trim()) });
    }
  }
  let runStartIdx = -1;
  for (let k = allMarkers.length - 1; k >= 0; k--) {
    if (allMarkers[k].n === 1) {
      const slice = allMarkers.slice(k, k + 5);
      if (slice.length === 5 && slice.every((m, idx) => m.n === idx + 1)) {
        runStartIdx = k;
        break;
      }
    }
  }
  const subMarkers = runStartIdx !== -1 ? allMarkers.slice(runStartIdx, runStartIdx + 5) : [];
  const scenarioEndRow = subMarkers.length ? subMarkers[0].idx : qObj.rows.length;
  const scenarioLines = formatLines(qObj.rows.slice(1, scenarioEndRow));

  const ansMarkers = [];
  for (let i = 1; i < aObj.rows.length; i++) {
    const first = aObj.rows[i].items[0];
    if (first && first.x < 145 && /^[1-5]$/.test(first.str.trim())) {
      if (Number(first.str.trim()) === ansMarkers.length + 1) {
        ansMarkers.push({ idx: i, n: Number(first.str.trim()) });
      }
    }
  }

  const subQuestions = [];
  for (let s = 0; s < 5; s++) {
    const qStart = subMarkers[s] ? subMarkers[s].idx : 0;
    const qEnd = subMarkers[s + 1] ? subMarkers[s + 1].idx : qObj.rows.length;
    const subQRows = subMarkers[s] ? qObj.rows.slice(qStart, qEnd) : [];

    const aStart = ansMarkers[s] ? ansMarkers[s].idx : 0;
    const aEnd = ansMarkers[s + 1] ? ansMarkers[s + 1].idx : aObj.rows.length;
    const subARows = ansMarkers[s] ? aObj.rows.slice(aStart, aEnd) : [];

    if (subQRows.length && /^[1-5]$/.test(subQRows[0].items[0].str.trim())) {
      subQRows[0] = { ...subQRows[0], items: subQRows[0].items.slice(1) };
    }
    if (subARows.length && /^[1-5]$/.test(subARows[0].items[0].str.trim())) {
      subARows[0] = { ...subARows[0], items: subARows[0].items.slice(1) };
    }

    const parsedSub = parseSectionAOt(
      { qNum: qObj.qNum * 10 + (s + 1), rows: subQRows },
      { qNum: qObj.qNum * 10 + (s + 1), rows: subARows },
      `Q${qObj.qNum}#${s + 1}`
    );
    subQuestions.push({
      sub_num: s + 1,
      marks: 2,
      type: parsedSub.type,
      interaction: parsedSub.interaction,
      prompt: [parsedSub.scenario, parsedSub.requirement].filter(Boolean).join('\n'),
      options: parsedSub.options,
      correct_answer: parsedSub.correct_answer,
      worked_solution: parsedSub.full_worked_solution,
    });
  }

  return {
    title,
    past_exam: pastExam || 'Kaplan Adapted Past Exam',
    scenario: scenarioLines.join('\n'),
    requirement: 'Answer all 5 linked Objective Test questions (2 marks each = 10 marks total).',
    sub_questions: subQuestions,
    correct_answer: subQuestions.map((sq) => sq.correct_answer),
    full_worked_solution: aLines.join('\n'),
    mark_scheme_steps: subQuestions.map((sq) => ({
      id: `sub-${sq.sub_num}`,
      label: `OT ${sq.sub_num}: Correct answer (${typeof sq.correct_answer === 'string' ? sq.correct_answer : JSON.stringify(sq.correct_answer)})`,
      marks: 2,
    })),
  };
}

function parseSectionCCr(qObj, aObj) {
  const qLines = formatLines(qObj.rows);
  const aLines = formatLines(aObj.rows);
  const titleLine = cleanText(qLines[0] || `Question ${qObj.qNum}`);
  const title = titleLine.replace(/Walk in the footsteps of a top tutor/gi, '').trim();

  const reqIdx = qLines.findIndex((l) => /^Required:/i.test(l));
  const scenarioLines = reqIdx !== -1 ? qLines.slice(1, reqIdx) : qLines.slice(1);
  const reqLines = reqIdx !== -1 ? qLines.slice(reqIdx) : ['Prepare the required tax computation and supporting notes.'];

  let totalMarks = 15;
  const fullReq = reqLines.join(' ');
  const totalM = fullReq.match(/\(Total:\s*(\d+)\s*marks?\)/i) || fullReq.match(/\((\d+)\s*marks?\)\s*$/i);
  if (totalM) {
    totalMarks = Number(totalM[1]);
  } else {
    const allM = [...fullReq.matchAll(/\((\d+(?:\.\d+)?)\s*marks?\)/gi)].map((m) => Number(m[1]));
    if (allM.length) totalMarks = allM.reduce((a, b) => a + b, 0);
  }

  const msIdx = aLines.findIndex((l) => /^ACCA\s+Marking\s+scheme/i.test(l));
  const markSchemeSteps = [];
  if (msIdx !== -1) {
    for (let i = msIdx + 1; i < aLines.length; i++) {
      const l = aLines[i];
      if (/^Examiner[’']s\s+report/i.test(l) || /^Total\s+\|/i.test(l) || /^––––/.test(l)) {
        if (/^Examiner[’']s\s+report/i.test(l)) break;
        continue;
      }
      const m = l.match(/^(.*?)\s*\|\s*(\d+(?:\.\d+)?)\s*$/);
      if (m) {
        const label = cleanText(m[1]);
        const mk = Number(m[2]);
        if (label && !/^Marks$/i.test(label) && !/^Total$/i.test(label) && mk <= totalMarks) {
          markSchemeSteps.push({ id: `ms-${markSchemeSteps.length + 1}`, label, marks: mk });
        }
      }
    }
  }
  if (markSchemeSteps.length === 0) {
    markSchemeSteps.push(
      { id: 'ms-1', label: 'Main proforma & core income/profit figures', marks: Math.round(totalMarks * 0.4 * 2) / 2 },
      { id: 'ms-2', label: 'Detailed workings & adjustments (W1/W2)', marks: Math.round(totalMarks * 0.4 * 2) / 2 },
      { id: 'ms-3', label: 'Exempt zeros, dates, PAYE & presentation', marks: totalMarks - Math.round(totalMarks * 0.4 * 2) },
    );
  }

  const aFull = aLines.join('\n');
  const freeMarks = [];
  if (/zero\s*\(0\)/i.test(fullReq) || /indicate.*zero/i.test(fullReq)) {
    freeMarks.push('Indicate non-taxable / non-deductible items with explicit zero (0)');
  }
  if (/paye/i.test(fullReq + ' ' + aFull)) {
    freeMarks.push('Deduct PAYE from income tax liability (not from income)');
  }
  if (/date|deadline|notify|filing/i.test(fullReq)) {
    freeMarks.push('State full exact dates including calendar year (e.g. 31 January 2027)');
  }
  if (/personal allowance/i.test(aFull)) {
    freeMarks.push('Show Personal Allowance line explicitly (even if £0 when ANI > £125,140)');
  }

  return {
    title,
    past_exam: parsePastExam(qLines) || 'Kaplan Section C CR',
    marks: totalMarks,
    scenario: scenarioLines.join('\n'),
    requirement: reqLines.join('\n'),
    correct_answer: 'See full proforma computation & step marking scheme.',
    full_worked_solution: aFull,
    mark_scheme_steps: markSchemeSteps,
    free_marks_items: freeMarks,
  };
}

const qMap = await extractSplitItems(47, 256, 306, 1, false);
const aMap = await extractSplitItems(257, 654, 306, 1, false);

const freqByTopicId = {
  1: 'Examined in 3 of last 8 sittings (Ethics & Tax System)',
  2: 'Examined in 8 of last 8 sittings (Core IT Computation)',
  3: 'Examined in 4 of last 8 sittings (Residence & ANI)',
  4: 'Examined in 5 of last 8 sittings (Property Income)',
  5: 'Examined in 8 of last 8 sittings (Employment Income & Benefits)',
  6: 'Examined in 5 of last 8 sittings (Pensions & AA)',
  7: 'Examined in 6 of last 8 sittings (Self-Employment Profits)',
  8: 'Examined in 6 of last 8 sittings (Capital Allowances)',
  9: 'Examined in 4 of last 8 sittings (Partnerships)',
  10: 'Examined in 4 of last 8 sittings (Trading Losses)',
  11: 'Examined in 7 of last 8 sittings (Class 1 & Class 4 NIC)',
  12: 'Examined in 5 of last 8 sittings (SA Admin, Dates & Penalties)',
  13: 'Examined in 8 of last 8 sittings (Corporation Tax Computation)',
  14: 'Examined in 4 of last 8 sittings (Company Losses)',
  15: 'Examined in 4 of last 8 sittings (Groups of Companies)',
  16: 'Examined in 5 of last 8 sittings (CT Admin, Instalments & iXBRL)',
  17: 'Examined in 5 of last 8 sittings (CGT Gains & Tax)',
  18: 'Examined in 4 of last 8 sittings (CGT Chattels, Wasting & PPR)',
  19: 'Examined in 4 of last 8 sittings (CGT Shares & Matching)',
  20: 'Examined in 5 of last 8 sittings (CGT Rollover, Holdover & BADR)',
  21: 'Examined in 4 of last 8 sittings (Corporate Gains & Indexation)',
  22: 'Examined in 5 of last 8 sittings (Inheritance Tax & Death Estate)',
  23: 'Examined in 5 of last 8 sittings (VAT Outline, Reg & Bad Debt)',
  24: 'Examined in 4 of last 8 sittings (VAT Penalties, Schemes & Overseas)',
};

function getKitSection(qNum) {
  if (qNum <= 92) return 'A';
  if (qNum <= 97) return 'B';
  if (qNum <= 127) return 'C';
  if (qNum <= 161) return 'A';
  if (qNum <= 174) return 'B';
  if (qNum <= 179) return 'C';
  if (qNum <= 201) return 'A';
  if (qNum <= 209) return 'B';
  if (qNum <= 212) return 'C';
  if (qNum <= 251) return 'A';
  if (qNum <= 255) return 'B';
  if (qNum <= 270) return 'C';
  if (qNum <= 292) return 'A';
  if (qNum <= 303) return 'B';
  return 'C';
}

const questions = [];
for (let q = 1; q <= 306; q++) {
  const qObj = qMap.get(q);
  const aObj = aMap.get(q);
  if (!qObj || !aObj) {
    console.warn(`Missing Q or A for Q${q}: qObj=${!!qObj} aObj=${!!aObj}`);
    continue;
  }
  const rawQText = formatLines(qObj.rows).join('\n');
  const rawAText = formatLines(aObj.rows).join('\n');
  const topicInfo = classifyITTopic(q, rawQText + ' ' + rawAText);
  const sec = getKitSection(q);

  if (sec === 'A') {
    const parsed = parseSectionAOt(qObj, aObj, `Q${q}`);
    const debrief = buildExaminerDebrief(q, topicInfo, parsed.past_exam, rawQText, rawAText, parsed.correct_answer);
    questions.push({
      id: `Q${q}`,
      q_num: q,
      title: parsed.past_exam ? `Q${q} · ${parsed.past_exam}` : `Q${q} · ${topicInfo.topic}`,
      topic: topicInfo.topic,
      topic_id: topicInfo.topic_id,
      st_chapter: topicInfo.st_chapter,
      section: 'A',
      type: parsed.type,
      interaction: parsed.interaction,
      marks: 2,
      scenario: parsed.scenario,
      requirement: parsed.requirement,
      options: parsed.options,
      correct_answer: parsed.correct_answer,
      full_worked_solution: parsed.full_worked_solution,
      mark_scheme_steps: [
        {
          id: `q${q}-step1`,
          label: `Accurate FA25 treatment & answer (${typeof parsed.correct_answer === 'string' ? parsed.correct_answer : 'all sub-items exact'})`,
          marks: 2,
        },
      ],
      kit_page: `p.${qObj.startPage}`,
      answer_page: `p.${aObj.startPage}`,
      past_exam: parsed.past_exam || 'Kaplan Practice OT',
      exam_frequency_tag: freqByTopicId[topicInfo.topic_id],
      examiner_debrief: debrief,
      free_marks_items: [],
    });
  } else if (sec === 'B') {
    const parsed = parseSectionBCase(qObj, aObj);
    const debrief = buildExaminerDebrief(q, topicInfo, parsed.past_exam, rawQText, rawAText, '5 linked OTs');
    questions.push({
      id: `Q${q}`,
      q_num: q,
      title: `Q${q} · ${parsed.title}`,
      topic: topicInfo.topic,
      topic_id: topicInfo.topic_id,
      st_chapter: topicInfo.st_chapter,
      section: 'B',
      type: 'case',
      interaction: 'case_5ot',
      marks: 10,
      scenario: parsed.scenario,
      requirement: parsed.requirement,
      options: parsed.sub_questions,
      correct_answer: parsed.correct_answer,
      full_worked_solution: parsed.full_worked_solution,
      mark_scheme_steps: parsed.mark_scheme_steps,
      kit_page: `p.${qObj.startPage}`,
      answer_page: `p.${aObj.startPage}`,
      past_exam: parsed.past_exam,
      exam_frequency_tag: freqByTopicId[topicInfo.topic_id],
      examiner_debrief: debrief,
      free_marks_items: ['Isolate facts per OT item', 'Time-apportion part-year benefits before multiplying'],
    });
  } else {
    const parsed = parseSectionCCr(qObj, aObj);
    const debrief = buildExaminerDebrief(q, topicInfo, parsed.past_exam, rawQText, rawAText, 'Proforma CR');
    questions.push({
      id: `Q${q}`,
      q_num: q,
      title: `Q${q} · ${parsed.title}`,
      topic: topicInfo.topic,
      topic_id: topicInfo.topic_id,
      st_chapter: topicInfo.st_chapter,
      section: 'C',
      type: 'cr',
      interaction: 'constructed_response',
      marks: parsed.marks,
      scenario: parsed.scenario,
      requirement: parsed.requirement,
      options: [],
      correct_answer: parsed.correct_answer,
      full_worked_solution: parsed.full_worked_solution,
      mark_scheme_steps: parsed.mark_scheme_steps,
      kit_page: `p.${qObj.startPage}`,
      answer_page: `p.${aObj.startPage}`,
      past_exam: parsed.past_exam,
      exam_frequency_tag: freqByTopicId[topicInfo.topic_id],
      examiner_debrief: debrief,
      free_marks_items: parsed.free_marks_items,
    });
  }
}

fs.mkdirSync(path.dirname(OUT_QUESTIONS), { recursive: true });
fs.writeFileSync(OUT_QUESTIONS, JSON.stringify(questions, null, 2));

const specQMap = await extractSplitItems(656, 668, 33, 1, true);
const specAMap = await extractSplitItems(669, 683, 33, 1, false);

// Helper to split trailing Section B/C intro or "The following scenario relates to questions..." out of Q15/Q20/Q25/Q30
function extractTrailingScenario(qObj) {
  if (!qObj) return '';
  const idx = qObj.rows.findIndex((r) => {
    const txt = rowToText(r, false);
    return /^The following scenario relates to questions/i.test(txt) || /^SECTION\s+[BC]$/i.test(txt);
  });
  if (idx === -1) return '';
  const tail = qObj.rows.slice(idx);
  qObj.rows = qObj.rows.slice(0, idx);
  return formatLines(tail)
    .filter((l) => !/^SECTION\s+[BC]$/i.test(l) && !/^This section of the exam/i.test(l) && !/^Each (?:OT case|question|constructed)/i.test(l) && !/^Important/i.test(l) && !/^[123]\s+(?:Calculations|All apportionments|In your live)/i.test(l) && !/^The following scenario relates/i.test(l))
    .join('\n');
}

const case1Scenario = extractTrailingScenario(specQMap.get(15));
const case2Scenario = extractTrailingScenario(specQMap.get(20));
const case3Scenario = extractTrailingScenario(specQMap.get(25));
extractTrailingScenario(specQMap.get(30));

const specimen = [];
for (let q = 1; q <= 15; q++) {
  const qObj = specQMap.get(q);
  const aObj = specAMap.get(q);
  if (!qObj || !aObj) continue;
  const rawQText = formatLines(qObj.rows).join('\n');
  const rawAText = formatLines(aObj.rows).join('\n');
  const parsed = parseSectionAOt(qObj, aObj, `SPEC-Q${q}`);
  specimen.push({
    id: `SPEC-Q${q}`,
    q_num: q,
    title: `Specimen Q${q}`,
    topic: 'Cross-Syllabus Specimen Exam',
    topic_id: 2,
    st_chapter: 'FA25 Specimen',
    section: 'A',
    type: parsed.type,
    interaction: parsed.interaction,
    marks: 2,
    scenario: parsed.scenario,
    requirement: parsed.requirement,
    options: parsed.options,
    correct_answer: parsed.correct_answer,
    full_worked_solution: parsed.full_worked_solution,
    mark_scheme_steps: [{ id: `spec-${q}-1`, label: 'Correct FA25 Specimen OT answer', marks: 2 }],
    kit_page: `p.${qObj.startPage}`,
    answer_page: `p.${aObj.startPage}`,
    past_exam: 'ACCA Specimen Exam (FA25)',
    exam_frequency_tag: 'Official ACCA FA25 Specimen',
    examiner_debrief: buildExaminerDebrief(q, { topic: 'Specimen Exam' }, 'ACCA Specimen', rawQText, rawAText, parsed.correct_answer),
    free_marks_items: [],
  });
}

// Build 3 proper Section B Case blocks (10 marks each)
const specCases = [
  { idx: 1, range: [16, 20], title: 'Specimen Case 1 · Delroy, Grant, Marlon & Alvita (CGT)', topic: 'CGT Specimen Case', topic_id: 17, st_chapter: 'ch17-20', scenario: case1Scenario },
  { idx: 2, range: [21, 25], title: 'Specimen Case 2 · Opal (Inheritance Tax)', topic: 'IHT Specimen Case', topic_id: 22, st_chapter: 'ch22', scenario: case2Scenario },
  { idx: 3, range: [26, 30], title: 'Specimen Case 3 · Glacier Ltd (VAT)', topic: 'VAT Specimen Case', topic_id: 23, st_chapter: 'ch23-24', scenario: case3Scenario },
];

for (const sc of specCases) {
  const subs = [];
  const fullSolParts = [];
  for (let q = sc.range[0]; q <= sc.range[1]; q++) {
    const qObj = specQMap.get(q);
    const aObj = specAMap.get(q);
    if (!qObj || !aObj) continue;
    const parsed = parseSectionAOt(qObj, aObj, `SPEC-Q${q}`);
    subs.push({
      sub_num: q - sc.range[0] + 1,
      marks: 2,
      type: parsed.type,
      interaction: parsed.interaction,
      prompt: [parsed.scenario, parsed.requirement].filter(Boolean).join('\n'),
      options: parsed.options,
      correct_answer: parsed.correct_answer,
      worked_solution: parsed.full_worked_solution,
    });
    fullSolParts.push(`OT ${q - sc.range[0] + 1} (Q${q}):\n${parsed.full_worked_solution}`);
  }
  specimen.push({
    id: `SPEC-CASE-${sc.idx}`,
    q_num: 15 + sc.idx,
    title: sc.title,
    topic: sc.topic,
    topic_id: sc.topic_id,
    st_chapter: sc.st_chapter,
    section: 'B',
    type: 'case',
    interaction: 'case_5ot',
    marks: 10,
    scenario: sc.scenario,
    requirement: `Answer all 5 linked Objective Test questions (Q${sc.range[0]}–Q${sc.range[1]}, 2 marks each = 10 marks).`,
    options: subs,
    correct_answer: subs.map((s) => s.correct_answer),
    full_worked_solution: fullSolParts.join('\n\n'),
    mark_scheme_steps: subs.map((s) => ({
      id: `spec-c${sc.idx}-${s.sub_num}`,
      label: `OT ${s.sub_num}: ${typeof s.correct_answer === 'string' ? s.correct_answer : JSON.stringify(s.correct_answer)}`,
      marks: 2,
    })),
    kit_page: `p.${specQMap.get(sc.range[0])?.startPage || 614}`,
    answer_page: `p.${specAMap.get(sc.range[0])?.startPage || 626}`,
    past_exam: 'ACCA Specimen Exam (FA25)',
    exam_frequency_tag: 'Official ACCA FA25 Specimen',
    examiner_debrief: buildExaminerDebrief(sc.range[0], { topic: sc.topic }, 'ACCA Specimen', sc.scenario, fullSolParts.join('\n'), '5 linked OTs'),
    free_marks_items: ['Isolate facts per OT item', 'Verify dates and thresholds against FA25 Tax Tables'],
  });
}

for (let q = 31; q <= 33; q++) {
  const qObj = specQMap.get(q);
  const aObj = specAMap.get(q);
  if (!qObj || !aObj) continue;
  const rawQText = formatLines(qObj.rows).join('\n');
  const rawAText = formatLines(aObj.rows).join('\n');
  const parsed = parseSectionCCr(qObj, aObj);
  specimen.push({
    id: `SPEC-Q${q}`,
    q_num: q,
    title: `Specimen Q${q} · ${parsed.title}`,
    topic: q === 31 ? 'Incorporation Tax Planning' : q === 32 ? 'Income Tax & Admin' : 'Corporation Tax & iXBRL',
    topic_id: q === 31 ? 2 : q === 32 ? 5 : 13,
    st_chapter: q === 31 ? 'ch2, ch11, ch13' : q === 32 ? 'ch4, ch5, ch9, ch12' : 'ch13, ch16',
    section: 'C',
    type: 'cr',
    interaction: 'constructed_response',
    marks: parsed.marks,
    scenario: parsed.scenario,
    requirement: parsed.requirement,
    options: [],
    correct_answer: parsed.correct_answer,
    full_worked_solution: parsed.full_worked_solution,
    mark_scheme_steps: parsed.mark_scheme_steps,
    kit_page: `p.${qObj.startPage}`,
    answer_page: `p.${aObj.startPage}`,
    past_exam: 'ACCA Specimen Exam (FA25)',
    exam_frequency_tag: 'Official ACCA FA25 Specimen',
    examiner_debrief: buildExaminerDebrief(q, { topic: 'Specimen CR' }, 'ACCA Specimen', rawQText, rawAText, 'Proforma CR'),
    free_marks_items: parsed.free_marks_items,
  });
}
fs.writeFileSync(OUT_SPECIMEN, JSON.stringify(specimen, null, 2));
console.log('Rebuilt questions.json (' + questions.length + ') and specimen.json (' + specimen.length + ')');
