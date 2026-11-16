export interface Fa25RateRow {
  item: string;
  value: string;
  source: 'CBE' | 'Memorise';
  rule: string;
}

export interface Fa25WorkedExample {
  title: string;
  scenario: string;
  steps: { label: string; calc: string }[];
  answer: string;
  trapNote: string;
}

export interface Fa25MatrixBlock {
  title: string;
  headers: string[];
  rows: string[][];
}

export interface Fa25RevisionModule {
  id: string;
  shortLabel: string;
  title: string;
  kitPage: string;
  relatedTopicId: number;
  summary: string;
  rates: Fa25RateRow[];
  matrices?: Fa25MatrixBlock[];
  workedExamples: Fa25WorkedExample[];
  examTraps: string[];
}

export const FA25_REVISION_MODULES: Fa25RevisionModule[] = [
  {
    id: 'income-tax',
    shortLabel: 'Income Tax & PA',
    title: 'Income Tax Bands, PA Taper, Savings, Dividends & Child Benefit',
    kitPage: 'Kit P.37–38',
    relatedTopicId: 2,
    summary:
      'Master non-savings -> savings -> dividends stacking order, Gift Aid/PPC band extension & ANI tapering, and the 60% effective PA withdrawal zone.',
    rates: [
      {
        item: 'Basic rate band (£1 – £37,700)',
        value: '20% NS/Sav · 8.75% Div',
        source: 'CBE',
        rule: 'Extended by GROSS Gift Aid and GROSS personal pension contributions (PPCs).',
      },
      {
        item: 'Higher rate band (£37,701 – £125,140)',
        value: '40% NS/Sav · 33.75% Div',
        source: 'CBE',
        rule: '£87,440 wide before Gift Aid/PPC extension.',
      },
      {
        item: 'Additional rate band (£125,141+)',
        value: '45% NS/Sav · 39.35% Div',
        source: 'CBE',
        rule: 'Both savings NRB (£0) and dividend NRB (£500 at 0%) checked against total taxable income.',
      },
      {
        item: 'Personal allowance (PA) & Taper',
        value: '£12,570 (0 at £125,140 ANI)',
        source: 'CBE',
        rule: 'Reduced by £1 for every £2 of Adjusted Net Income (ANI) over £100,000.',
      },
      {
        item: 'Savings starting rate (0% on first £5,000)',
        value: '0% up to £5,000',
        source: 'CBE',
        rule: 'Only available to the extent non-savings TAXABLE income is below £5,000.',
      },
      {
        item: 'Savings & Dividend nil rate bands',
        value: 'Sav £1k/£500/£0 · Div £500',
        source: 'CBE',
        rule: 'Taxed at 0% BUT BOTH still consume space inside the basic / higher rate bands!',
      },
      {
        item: 'Marriage Allowance (Transferable PA)',
        value: '£1,260 (20% = £252 reducer)',
        source: 'CBE',
        rule: 'Recipient must be a basic-rate taxpayer only (never higher/additional rate).',
      },
      {
        item: 'High Income Child Benefit Charge',
        value: '£60,000 – £80,000 ANI',
        source: 'CBE',
        rule: '1% of child benefit per £200 of ANI over £60,000 (100% clawback at £80,000).',
      },
      {
        item: 'ISA limit / Rent-a-room relief',
        value: '£20,000 / £7,500 p.a.',
        source: 'CBE',
        rule: 'Rent-a-room: compare (gross rent − £7,500) vs (rent − actual expenses) and elect lower.',
      },
    ],
    workedExamples: [
      {
        title: 'PA Taper + Gift Aid Band Extension (Specimen Q3 Style)',
        scenario:
          'Martin has net income of £111,100 (all salary) and pays £800 net cash to a charity under Gift Aid in 2025/26.',
        steps: [
          { label: 'Gross up Gift Aid', calc: '£800 × 100/80 = £1,000' },
          { label: 'Adjusted Net Income (ANI)', calc: '£111,100 − £1,000 = £110,100' },
          { label: 'PA reduction', calc: '(£110,100 − £100,000) / 2 = £5,050 lost' },
          { label: 'Adjusted Personal Allowance', calc: '£12,570 − £5,050 = £7,520' },
          { label: 'Extended Basic Rate Band', calc: '£37,700 + £1,000 = £38,700' },
          { label: 'Taxable Income & IT', calc: '£111,100 − £7,520 = £103,580 -> £38,700×20% + £64,880×40% = £33,692' },
        ],
        answer: 'PA = £7,520 · Income Tax = £33,692',
        trapNote:
          'Do NOT deduct gross Gift Aid from Net Income when finding Taxable Income — Gift Aid ONLY reduces ANI (for PA/Child Benefit) and extends the basic/higher bands.',
      },
      {
        title: 'Savings Starting Rate + Savings NRB + Dividend NRB Stacking',
        scenario:
          'Priya has taxable non-savings income (after PA) of £3,200, bank interest of £4,500, and dividends of £35,000 in 2025/26.',
        steps: [
          { label: 'Total taxable income', calc: '£3,200 + £4,500 + £35,000 = £42,700 (Higher-rate taxpayer!)' },
          { label: 'Non-savings tax', calc: '£3,200 × 20% = £640' },
          { label: 'Savings starting rate remaining', calc: '£5,000 − £3,200 = £1,800 @ 0% = £0' },
          { label: 'Savings NRB (Higher rate = £500)', calc: '£500 @ 0% = £0 (consumes band!)' },
          { label: 'Remaining savings @ 20% BR', calc: '(£4,500 − £1,800 − £500) = £2,200 × 20% = £440' },
          { label: 'BR band left for dividends', calc: '£37,700 − (£3,200 + £4,500) = £30,000' },
          { label: 'Dividends tax', calc: '£500 × 0% (NRB) + £29,500 × 8.75% + £5,000 × 33.75% = £4,268.75 -> £4,269' },
        ],
        answer: 'Total Income Tax = £640 + £440 + £4,269 = £5,349',
        trapNote:
          'Even though £500 dividend NRB and £500 savings NRB are taxed at 0%, they USE UP basic rate band (£29,500 left at 8.75%, NOT £30,000!).',
      },
    ],
    examTraps: [
      'Gift Aid & Personal Pensions are ALWAYS given NET of 20% basic rate tax in questions unless stated gross -> multiply by 100/80.',
      'Child Benefit charge works on ANI (not gross income) and rounds the % DOWN if non-integer (£200 steps).',
      'Employer occupational pension contributions are deductibles before Net Income and do NOT extend the basic rate band.',
    ],
  },
  {
    id: 'residence-benefits',
    shortLabel: 'Residence & Benefits',
    title: 'UK Residence Ties, Company Cars, Fuel, Living Accommodation & Loans',
    kitPage: 'Kit P.37–38, P.41',
    relatedTopicId: 5,
    summary:
      'Verify statutory residence day-counts, exact CO2 car & hybrid electric range tiers, partial fuel traps, and accommodation >£75,000 formula.',
    rates: [
      {
        item: 'Zero-emission electric car (0 g/km)',
        value: '3% of list price',
        source: 'CBE',
        rule: '2025/26 rate (was 2% in prior years — always use 3% for FA25!).',
      },
      {
        item: 'Hybrid cars (1–50 g/km) by range',
        value: '3% / 6% / 9% / 13% / 15%',
        source: 'CBE',
        rule: 'Electric miles: ≥130m (3%), 70–129m (6%), 40–69m (9%), 30–39m (13%), <30m (15%).',
      },
      {
        item: 'Petrol / RDE2 diesel (51–54 / 55+ g/km)',
        value: '16% / 17% + 1% per full 5 g/km',
        source: 'CBE',
        rule: 'Round CO2 DOWN to nearest multiple of 5 before dividing by 5. Cap at 37%.',
      },
      {
        item: 'Non-RDE2 Diesel surcharge & Cap',
        value: '+4% surcharge · Max 37% cap',
        source: 'Memorise',
        rule: 'Memorise both! If diesel meets RDE2 standard, NO +4% surcharge applies.',
      },
      {
        item: 'Employee car capital contribution',
        value: 'Max £5,000 deduction',
        source: 'Memorise',
        rule: 'Reduces list price (even if employee paid £8,000 towards car, cap deduction at £5,000).',
      },
      {
        item: 'Car fuel benefit base',
        value: '£28,200 × car %',
        source: 'CBE',
        rule: 'ZERO reduction for partial private fuel contribution; time-apportioned only if withdrawn permanently.',
      },
      {
        item: 'Company Van & Van Fuel',
        value: '£4,020 van · £769 fuel (0% EV)',
        source: 'CBE',
        rule: 'Zero-emission electric vans attract £0 van benefit and £0 fuel benefit.',
      },
      {
        item: 'Official rate of interest',
        value: '3.75%',
        source: 'CBE',
        rule: 'Used for beneficial loans (>£10,000 limit) AND living accommodation >£75,000.',
      },
      {
        item: 'Beneficial loan de minimis & Asset use',
        value: 'Loans ≤ £10k exempt · Use = 20% MV',
        source: 'Memorise',
        rule: 'If loan ≤ £10,000 ALL year -> £0 benefit. Use of asset = 20% × MV when first provided.',
      },
      {
        item: 'Staff parties & Trivial benefits',
        value: '£150/head party · £50 trivial',
        source: 'Memorise',
        rule: 'Exceeding £150/head makes the ENTIRE cost taxable (not just the excess!).',
      },
    ],
    matrices: [
      {
        title: 'Statutory Residence Status (Tax Rates Table — Kit P.37)',
        headers: ['Days in UK in tax year', 'Previously UK resident (last 3 yrs)', 'NOT previously UK resident'],
        rows: [
          ['Less than 16 days', 'Automatically NOT resident', 'Automatically NOT resident'],
          ['16 to 45 days', 'Resident if 4 UK ties (or more)', 'Automatically NOT resident'],
          ['46 to 90 days', 'Resident if 3 UK ties (or more)', 'Resident if 4 UK ties'],
          ['91 to 120 days', 'Resident if 2 UK ties (or more)', 'Resident if 3 UK ties (or more)'],
          ['121 to 182 days', 'Resident if 1 UK tie (or more)', 'Resident if 2 UK ties (or more)'],
          ['183 days or more', 'Automatically resident', 'Automatically resident'],
        ],
      },
    ],
    workedExamples: [
      {
        title: 'Company Car + Non-RDE2 Diesel + Partial Fuel Trap (Kit Q27 Style)',
        scenario:
          'List price £32,000 (employee bought for £29,000 and made a £6,000 capital contribution). Non-RDE2 diesel emitting 128 g/km. Available 9 months; employee reimbursed £450 towards private fuel costing £1,200.',
        steps: [
          { label: 'Adjusted list price', calc: '£32,000 (NOT £29k) − £5,000 (cap) = £27,000' },
          { label: 'CO2 percentage', calc: '128 -> 125 g/km -> 17% + ((125−55)/5) = 31% + 4% (non-RDE2) = 35%' },
          { label: 'Car benefit (9/12)', calc: '£27,000 × 35% × 9/12 = £7,088' },
          { label: 'Fuel benefit (9/12)', calc: '£28,200 × 35% × 9/12 = £7,403 (IGNORE £450 partial payment!)' },
        ],
        answer: 'Car £7,088 + Fuel £7,403 = £14,491 total BIK',
        trapNote:
          'Never reduce fuel benefit for partial employee reimbursement! For car % > 37% after +4% diesel (e.g. 36% + 4% = 40%), cap strictly at 37%.',
      },
      {
        title: 'Living Accommodation > £75,000 & 6-Year Market Value Rule',
        scenario:
          'Employer bought a non-job-related house in 2016 for £190,000 (MV when first provided to employee in July 2025 was £310,000; improvements before 2025/26 were £15,000). Annual value is £4,800.',
        steps: [
          { label: 'Basic annual value benefit', calc: '£4,800 (full year or pro-rata if part-year)' },
          { label: 'Check > 6 year rule', calc: 'Bought 2016, first provided 2025 (> 6 years!) -> use MV £310,000!' },
          { label: 'Additional accommodation benefit', calc: '(£310,000 − £75,000) × 3.75% = £8,813' },
        ],
        answer: 'Total accommodation benefit (full year) = £4,800 + £8,813 = £13,613',
        trapNote:
          'When >6 years applies, improvements made BEFORE the tax year are already reflected in the MV at first occupation — do not add them again!',
      },
    ],
    examTraps: [
      'Automatic Overseas tests (<16d, <46d never resident, full-time overseas work) and Automatic UK tests (183+d, only home, full-time UK work) are checked BEFORE counting UK ties.',
      'Ongoing annual private fuel running-cost contributions by employee to reduce car benefit do NOT reduce car benefit unless required/made for the car itself — and private fuel contributions never reduce fuel benefit unless 100% reimbursed.',
      'Reimbursements at AMAP rate: up to 45p/10k + 25p/>10k is tax-free; paying 50p gives taxable excess of 5p × miles (and excess for NIC starts ONLY above 45p flat!).',
    ],
  },
  {
    id: 'pensions-property-losses',
    shortLabel: 'Pensions, Prop & Losses',
    title: 'Pension Annual Allowance, Property Cash Basis & Individual Trading Losses',
    kitPage: 'Kit P.38–39',
    relatedTopicId: 6,
    summary:
      'Carry forward 3 years of unused pension AA (member check!), 20% residential finance cost tax reducer, and the £50k/25% s.64/s.72 loss relief cap.',
    rates: [
      {
        item: 'Pension Annual Allowance (2023/24–25/26)',
        value: '£60,000 (2022/23: £40,000)',
        source: 'CBE',
        rule: 'Current year £60k used FIRST, then oldest unused AA (2022/23 -> 2023/24 -> 2024/25) if member in that year.',
      },
      {
        item: 'Tapered Annual Allowance',
        value: 'Min £10,000 (Adj. income > £260k)',
        source: 'CBE',
        rule: 'AA reduced by £1 per £2 over £260,000 adjusted income (when threshold income > £200,000) down to £10,000 at £360,000.',
      },
      {
        item: 'Max pension tax relief (no earnings)',
        value: '£3,600 gross (£2,880 net)',
        source: 'CBE',
        rule: 'Otherwise tax relief capped at 100% of relevant UK earnings (salary + trading profit, NOT property/dividends/savings).',
      },
      {
        item: 'Cap on Income Tax Reliefs (s.64 / s.72)',
        value: 'Greater of £50,000 or 25% of total income',
        source: 'CBE',
        rule: 'Applies when offsetting trading losses against OTHER income (total income before PA minus gross PPCs).',
      },
      {
        item: 'Individual Property Income Basis',
        value: 'Cash basis default (≤ £150k receipts)',
        source: 'Memorise',
        rule: 'Residential mortgage interest = 20% tax reducer ONLY (not an expense deduction). Relief restricted if non-savings tax is lower.',
      },
    ],
    workedExamples: [
      {
        title: 'Pension Annual Allowance Carry Forward & Relevant Earnings Limit',
        scenario:
          'Salaried manager earns £58,000 in 2025/26. Employer pays £14,000 into scheme and employee pays £36,000 gross PPC. Unused AA from 2023/24 (when a member) was £18,000; not a member in 2022/23.',
        steps: [
          { label: 'Total pension input 2025/26', calc: '£14,000 (Er) + £36,000 (Ee gross) = £50,000' },
          { label: 'Relevant earnings check (Ee)', calc: '£36,000 ≤ £58,000 salary (100% qualifies for tax relief!)' },
          { label: 'Annual allowance available', calc: '£60,000 (25/26) + £0 (22/23 non-member) + £18,000 (23/24) = £78,000' },
          { label: 'Excess AA charge', calc: '£50,000 ≤ £78,000 -> £0 AA charge!' },
        ],
        answer: '£0 AA charge · Unused AA carried forward = £18,000 (2023/24) + £10,000 (2025/26)',
        trapNote:
          '2022/23 unused AA can NEVER be carried forward if the taxpayer was NOT a member of a registered pension scheme in 2022/23!',
      },
      {
        title: 'Cap on s.64 Trading Loss Against General Income',
        scenario:
          'Taxpayer has £120,000 employment income and makes a £95,000 trading loss in 2025/26, claiming s.64 against 2025/26 income.',
        steps: [
          { label: 'Loss relief cap calculation', calc: 'Greater of £50,000 or 25% × £120,000 (£30,000) = £50,000' },
          { label: 'Loss allowed against salary', calc: '£50,000 (same-trade profits would be uncapped, but here general income = capped!)' },
          { label: 'Remaining loss c/f', calc: '£95,000 − £50,000 = £45,000 carried forward (uncapped against future trading profit)' },
        ],
        answer: 'Net income = £120,000 − £50,000 = £70,000 · Loss c/f = £45,000',
        trapNote:
          'The £50,000/25% cap NEVER restricts offsetting a trading loss against profits of the SAME trade (including prior year under s.64/s.72 if same trade profit)!',
      },
    ],
    examTraps: [
      'Property income is NEVER relevant UK earnings for pension tax relief — only employment, trading, and patent income count.',
      'Individual trading loss carry-back in opening years (s.72) is strictly 3 years FIFO (earliest year first: 2022/23 -> 2023/24 -> 2024/25) across first 4 tax years of trade.',
      'Individual s.64 claim against current/prior year income CANNOT be restricted to save the £12,570 Personal Allowance!',
    ],
  },
  {
    id: 'nic',
    shortLabel: 'NIC (1 / 1A / 4)',
    title: 'National Insurance Contributions (FA25: 8% / 15% / 6%)',
    kitPage: 'Kit P.41 & P.43',
    relatedTopicId: 11,
    summary:
      'Crucial FA25 rates: Employer Class 1 threshold dropped to £5,000 and rate jumped to 15%; Employment Allowance doubled to £10,500.',
    rates: [
      {
        item: 'Class 1 Employee (Primary)',
        value: '0% ≤ £12,570 · 8% £12,571–£50,270 · 2% > £50,270',
        source: 'CBE',
        rule: 'Charged on gross cash earnings, bonuses, cash vouchers, & mileage excess >45p. NO deduction for pensions.',
      },
      {
        item: 'Class 1 Employer (Secondary)',
        value: '0% ≤ £5,000 · 15% > £5,000',
        source: 'CBE',
        rule: 'FA25 change: £5,000 threshold (NOT £9,100) and 15% rate (NOT 13.8%)!',
      },
      {
        item: 'Employment Allowance (EA)',
        value: '£10,500 per employer',
        source: 'CBE',
        rule: 'Reduces Class 1 Employer NIC ONLY (NEVER Class 1A!). Not available to sole-director 1-employee companies.',
      },
      {
        item: 'Class 1A NIC (Employer on BIKs)',
        value: '15% × taxable non-cash benefits',
        source: 'CBE',
        rule: 'Paid solely by employer on car, fuel, medical insurance, living accommodation, loans. Due 22 July 2026.',
      },
      {
        item: 'Class 4 NIC (Self-employed)',
        value: '0% ≤ £12,570 · 6% £12,571–£50,270 · 2% > £50,270',
        source: 'CBE',
        rule: 'Trading profits ONLY (excludes property/interest/dividends). Collected via SA; NO Class 2 in TX-UK FA25.',
      },
    ],
    workedExamples: [
      {
        title: 'Employee + Director Class 1, Class 1A & Mileage Excess Trap',
        scenario:
          'Company employs 2 staff in 2025/26 (eligible for EA): Director earns £60,000 salary, receives £900 private medical insurance, and is reimbursed 50p/mile on 12,000 business miles.',
        steps: [
          { label: 'Mileage excess for NIC', calc: '12,000 × (50p − 45p) = £600 (Note: 45p applies to ALL miles for NIC, not just 10k!)' },
          { label: 'Class 1 cash earnings base', calc: '£60,000 + £600 = £60,600' },
          { label: 'Class 1 Employee', calc: '(£50,270 − £12,570)×8% + (£60,600 − £50,270)×2% = £3,016 + £207 = £3,223' },
          { label: 'Class 1 Employer (before EA)', calc: '(£60,600 − £5,000) × 15% = £8,340 (minus EA £10,500 -> £0 payable!)' },
          { label: 'Class 1A Employer (NOT EA eligible)', calc: '£900 × 15% = £135 (payable 22 July 2026)' },
        ],
        answer: 'Employee NIC £3,223 · Employer Class 1 £0 · Class 1A £135',
        trapNote:
          'Income Tax taxes mileage reimbursement vs (10,000×45p + 2,000×25p = £5,000 -> £1,000 taxable), WHEREAS NIC uses 45p flat on ALL 12,000 miles (£600 excess)!',
      },
      {
        title: 'Class 4 NIC (Specimen Q1 Style)',
        scenario:
          'William has tax-adjusted trading profit of £82,700, paid £4,000 gross personal pension, and has £12,000 UK property profit.',
        steps: [
          { label: 'Class 4 profit base', calc: '£82,700 (IGNORE £4,000 pension & IGNORE £12,000 property income)' },
          { label: 'Main band @ 6%', calc: '(£50,270 − £12,570) × 6% = £37,700 × 6% = £2,262' },
          { label: 'Upper band @ 2%', calc: '(£82,700 − £50,270) × 2% = £32,430 × 2% = £649' },
        ],
        answer: 'Class 4 NIC = £2,262 + £649 = £2,911',
        trapNote:
          'If William has a trading loss carried forward against future trading profits, that loss DOES reduce future Class 4 NIC (s.64 vs non-trading income does NOT!).',
      },
    ],
    examTraps: [
      'Employment Allowance (£10,500) cannot offset Class 1A NIC — and a company where the sole employee is also a director cannot claim EA.',
      'Shopping vouchers exchangeable for goods suffer Class 1 Employee & Employer NIC (NOT Class 1A!).',
      'Employer Class 1 NIC is deductible for the employer’s trading profit (see Specimen Q31 Sarah £3,750!).',
    ],
  },
  {
    id: 'capital-allowances',
    shortLabel: 'Capital Allowances',
    title: 'AIA, Full Expensing, Cars CO2 Tiers, SBA & Short/Long Periods',
    kitPage: 'Kit P.39',
    relatedTopicId: 8,
    summary:
      'Know what gets time-apportioned (AIA, WDA, small pools £1,000) vs what is NEVER time-apportioned (Full Expensing 100%, 50% FYA, new 0g car 100% FYA).',
    rates: [
      {
        item: 'Annual Investment Allowance (AIA)',
        value: '100% up to £1,000,000 p.a.',
        source: 'CBE',
        rule: 'Time-apportioned for short/long APs. Allocate to Special Rate Pool (6%) expenditure FIRST!',
      },
      {
        item: 'Companies Full Expensing & 50% FYA',
        value: '100% Main / 50% Special Rate',
        source: 'CBE',
        rule: 'Companies ONLY; NEW & unused P&M (NEVER cars!). NEVER time-apportioned for short periods.',
      },
      {
        item: 'Cars Capital Allowances tiers',
        value: '100% FYA (new 0g) · 18% · 6%',
        source: 'CBE',
        rule: '18%: 2nd-hand 0g or 1–50g; 6%: >50g CO2. Second-hand 0g car gets 18% Main Pool, NOT 100% FYA!',
      },
      {
        item: 'Main Pool / Special Rate WDA',
        value: '18% / 6% reducing balance',
        source: 'CBE',
        rule: 'Small pools write-off if TWDV before WDA ≤ £1,000 (time-apportioned for period length).',
      },
      {
        item: 'Structures & Buildings Allowance (SBA)',
        value: '3% straight-line',
        source: 'CBE',
        rule: 'Non-residential structures only (not land!). Time-apportioned from date brought into use.',
      },
      {
        item: 'High-emission Car Lease Disallowance',
        value: '15% disallowed if CO2 > 50 g/km',
        source: 'Memorise',
        rule: 'Applies to BOTH sole traders (further scaled by business use %) and companies.',
      },
    ],
    workedExamples: [
      {
        title: '9-Month Period: AIA Allocation + New vs Second-Hand Zero-Emission Cars',
        scenario:
          'Co Ltd (9-month AP to 31 Dec 2025) has Main Pool b/f £40,000. Buys: (1) Integral features (air con) £800,000, (2) New zero-emission car £45,000, (3) Second-hand electric car £20,000, (4) Petrol car (90g/km) £18,000.',
        steps: [
          { label: 'Time-apportioned AIA limit', calc: '£1,000,000 × 9/12 = £750,000' },
          { label: 'Special Rate (Air Con): AIA then 50% FYA', calc: '£750k AIA + (£50k × 50% FYA = £25k); remaining £25k carried forward in SRP (no WDA this period!)' },
          { label: 'New 0g car (100% FYA, never prorated)', calc: '£45,000 × 100% = £45,000' },
          { label: 'Main Pool (b/f £40k + £20k 2nd-hand EV)', calc: '£60,000 × 18% × 9/12 = £8,100' },
          { label: 'Special Rate Pool (£18k petrol car only)', calc: '£18,000 × 6% × 9/12 = £810 (TWDV c/f includes +£25k from 50% FYA balance)' },
        ],
        answer: 'Total CAs = £750k + £25k + £45k + £8,100 + £810 = £828,910',
        trapNote:
          '1) Second-hand electric cars DO NOT get 100% FYA — only 18% Main Pool! 2) Companies can claim 50% FYA on new special rate P&M above AIA!',
      },
    ],
    examTraps: [
      'Private use asset column applies ONLY to sole traders/partnerships (cars used privately by a director in a company get 100% CA in pool — director is taxed via BIK!).',
      'On cessation of trade: NO WDA, AIA, or FYA in final accounting period — only balancing allowances/charges.',
      'Sale proceeds subtracted from a pool are ALWAYS capped at original cost.',
    ],
  },
  {
    id: 'corp-tax',
    shortLabel: 'Corporation Tax',
    title: 'CT Rates, Marginal Relief (3/200), Associated Companies, Losses & Groups',
    kitPage: 'Kit P.39–40, P.45',
    relatedTopicId: 13,
    summary:
      'Augmented profits = TTP + exempt dividends (excluding 51%+ group associates); divide £50k/£250k/£1.5m by (1 + associates) and period length.',
    rates: [
      {
        item: 'Small profits rate (Augmented ≤ £50k)',
        value: '19%',
        source: 'CBE',
        rule: 'Pro-rate £50k for short AP (<12m) and divide by (1 + associated companies).',
      },
      {
        item: 'Main rate (Augmented > £250k)',
        value: '25%',
        source: 'CBE',
        rule: 'Marginal band (£50k–£250k) carries an effective 26.5% rate.',
      },
      {
        item: 'Marginal relief formula',
        value: '3/200 × (U − A) × (TTP / A)',
        source: 'CBE',
        rule: 'U = adjusted upper limit; A = Augmented Profits (TTP + non-51% exempt dividends).',
      },
      {
        item: 'Quarterly Instalments (QIPs) threshold',
        value: 'Augmented profits > £1,500,000',
        source: 'CBE',
        rule: 'Divide £1.5m by (1 + associates) & × m/12. Due 14th of months 7, 10, 13, 16 (unless 1st year < £10m).',
      },
      {
        item: 'Company Payment & Filing (Small/Med)',
        value: 'Pay 9m + 1d · File CT600 12m',
        source: 'Memorise',
        rule: 'e.g. 31 March 2026 YE -> Pay by 1 Jan 2027; File CT600 by 31 March 2027.',
      },
    ],
    workedExamples: [
      {
        title: 'Marginal Relief + 1 Associated Company + Dividends Received',
        scenario:
          'Alpha Ltd (12m AP to 31 Mar 2026) has 1 associated subsidiary (100% owned) AND owns 10% of Beta Ltd. Alpha Ltd has TTP of £70,000, receives a £15,000 dividend from its 100% subsidiary, and a £10,000 dividend from Beta Ltd.',
        steps: [
          { label: 'Adjusted Upper & Lower Limits (÷ 2)', calc: 'Lower = £25,000 · Upper = £125,000' },
          { label: 'Augmented Profits (A)', calc: '£70,000 + £10,000 (10% Beta ONLY; ignore 100% sub!) = £80,000' },
          { label: 'CT at 25% Main rate', calc: '£70,000 × 25% = £17,500' },
          { label: 'Less: Marginal relief', calc: '3/200 × (£125,000 − £80,000) × (70,000 / 80,000) = £590.63 -> £591' },
        ],
        answer: 'Corporation Tax Liability = £17,500 − £591 = £16,909',
        trapNote:
          '51%+ group dividends are EXCLUDED from Augmented Profits (even though counted in associates count)! Foreign associates ALSO count in (1 + associates)!',
      },
      {
        title: 'Long Period of Account (> 12 Months) Split',
        scenario:
          'Co Ltd prepares accounts for 15 months ended 31 March 2026: Trading profit £150,000 (before CAs), Bank interest £1,000/month, QCD paid £5,000 on 1 Dec 2025.',
        steps: [
          { label: 'Split into 12m + 3m CAPs', calc: 'CAP 1: 12m to 31 Dec 2025 · CAP 2: 3m to 31 Mar 2026' },
          { label: 'Time-apportion Trading profit (12:3)', calc: 'CAP 1: £120,000 · CAP 2: £30,000 (BEFORE separate CAs!)' },
          { label: 'Capital allowances', calc: 'Computed SEPARATELY for 12m CAP and 3m CAP (never time-apportion pool CAs together!)' },
          { label: 'Bank interest & QCDs', calc: 'Interest accrued (12k / 3k); QCD deducted strictly on DATE PAID (CAP 1: £5,000)!' },
        ],
        answer: 'CAP 1 limits = £50k/£250k · CAP 2 limits = £12,500 / £62,500',
        trapNote:
          'Capital gains fall into the CAP in which the disposal occurred; QCDs are relieved in the CAP in which they were PAID!',
      },
    ],
    examTraps: [
      'Current year & 12m carry-back trading loss claims for companies are ALL-OR-NOTHING (cannot preserve QCDs!), whereas brought-forward trading losses CAN be restricted to any amount.',
      'Group Relief (75% group): can surrender CY trading loss, excess QCDs, and excess PBIs — CANNOT surrender capital losses directly (use 75% Gains Group election within 2 years!).',
      'Non-trade loan relationships (NTLR) include bank interest AND debenture interest (for non-trading purpose) netted together on an accruals basis.',
    ],
  },
  {
    id: 'cgt',
    shortLabel: 'CGT',
    title: 'Capital Gains Tax (18%/24%), £3k AEA, BADR (14%), Chattels & PRR',
    kitPage: 'Kit P.40 & P.43',
    relatedTopicId: 17,
    summary:
      'All gains in FA25 use 18% / 24% (single unified rates for residential property & other assets!). BADR rose to 14% for 2025/26.',
    rates: [
      {
        item: 'Standard CGT Rates (2025/26)',
        value: '18% basic / 24% higher',
        source: 'CBE',
        rule: 'Applies to BOTH residential property AND shares/other assets in FA25!',
      },
      {
        item: 'Annual Exempt Amount (AEA)',
        value: '£3,000 (use-it-or-lose-it)',
        source: 'CBE',
        rule: 'CY losses offset BEFORE £3,000 AEA; b/f losses restricted so £3,000 AEA is NEVER wasted.',
      },
      {
        item: 'BADR & Investors’ Relief (2025/26)',
        value: '14% up to £1,000,000 lifetime',
        source: 'CBE',
        rule: 'FA25 rate is 14% (up from 10%). BADR gains STILL consume unused basic rate band BEFORE non-BADR gains!',
      },
      {
        item: 'Chattels £6,000 Marginal Rule',
        value: 'Gain ≤ 5/3 × (Gross Proceeds − £6,000)',
        source: 'Memorise',
        rule: 'Buy ≤ £6k & sell ≤ £6k = exempt. If bought > £6k & sold < £6k, deemed proceeds = £6,000 to cap loss.',
      },
      {
        item: 'Share Matching (Individual vs Company)',
        value: 'Indiv: Same / Next 30d / Pool',
        source: 'Memorise',
        rule: 'Companies: Same day -> PREVIOUS 9 days -> FA85 Indexed Pool (indexation frozen Dec 2017!).',
      },
      {
        item: 'Residential Property CGT Payment',
        value: 'Within 60 days of completion',
        source: 'CBE',
        rule: 'Other CGT gains (shares, commercial assets) are paid on 31 January 2027.',
      },
    ],
    workedExamples: [
      {
        title: 'BADR Consuming Basic Rate Band + Capital Losses Ordering',
        scenario:
          'Taxable income is £20,000. In 2025/26 she makes: £12,000 BADR gain, £22,000 share gain, £2,000 CY capital loss, and has £5,000 b/f capital losses.',
        steps: [
          { label: 'Allocate CY loss (£2k) & AEA (£3k)', calc: 'Deduct BOTH from non-BADR share gain (24% rate first!): £22k − £2k − £3k = £17k' },
          { label: 'Allocate b/f loss (£5k)', calc: 'Deduct from remaining share gain (do NOT touch AEA or 14% BADR!): £17k − £5k = £12k' },
          { label: 'Unused basic rate band', calc: '£37,700 − £20,000 = £17,700 remaining' },
          { label: 'Apply BR band to BADR FIRST!', calc: '£12,000 BADR taxed @ 14% (£1,680) -> leaves £5,700 BR band for share gain!' },
          { label: 'Tax Share gain (£12,000)', calc: '£5,700 × 18% (£1,026) + £6,300 × 24% (£1,512) = £2,538' },
        ],
        answer: 'Total CGT = £1,680 + £2,538 = £4,218',
        trapNote:
          'Allocate losses & AEA against gains bearing the HIGHEST rate (24% before 14% BADR), then let BADR consume the basic rate band first!',
      },
      {
        title: 'Wasting vs Non-Wasting Chattel 5/3 Cap (Specimen Q7 Style)',
        scenario:
          'Sold an antique dining table (non-wasting chattel) for £8,700 (bought 2014 for £2,400); auctioneer fees were £450 on disposal.',
        steps: [
          { label: 'Normal gain calculation', calc: '(£8,700 − £450) − £2,400 = £5,850' },
          { label: '5/3 marginal cap (uses GROSS proceeds!)', calc: '5/3 × (£8,700 − £6,000) = 5/3 × £2,700 = £4,500' },
          { label: 'Taxable chargeable gain', calc: 'Lower of £5,850 and £4,500 = £4,500' },
        ],
        answer: 'Chargeable gain = £4,500',
        trapNote:
          'Remember: 5/3 × (GROSS proceeds − £6,000), NOT net proceeds after selling costs!',
      },
    ],
    examTraps: [
      'Private Residence Relief (PRR): the final 9 months of ownership are ALWAYS exempt provided the house was the taxpayer’s main residence at SOME point.',
      'BADR shares condition: personal company (≥5% shares + voting rights), employee/officer, and Unquoted/Quoted trading company held for at least 2 YEARS before disposal.',
      'Wasting assets (useful life ≤ 50 yrs) like racehorses, vintage cars, or short leases <50 yrs: private motor cars are ALWAYS exempt from CGT!',
    ],
  },
  {
    id: 'iht',
    shortLabel: 'IHT',
    title: 'Inheritance Tax: PET vs CLT, 7-Year Cumulation, Taper Relief & Death Estate',
    kitPage: 'Kit P.40',
    relatedTopicId: 22,
    summary:
      '7-year cumulation window runs backwards from each gift AND backwards from death. Taper relief cuts TAX (not transfer value!) only after 3 years.',
    rates: [
      {
        item: 'Nil Rate Band (NRB) & RNRB',
        value: '£325,000 NRB · £175,000 RNRB',
        source: 'CBE',
        rule: 'RNRB applies ONLY if main residence (or sale proceeds) passes on DEATH to direct descendants (tapered above £2m net estate).',
      },
      {
        item: 'Lifetime Tax Rate (CLTs only)',
        value: '20% (Trustees) / 25% (Donor pays)',
        source: 'CBE',
        rule: 'Donor paying = gross-up net chargeable transfer: (Excess × 20/80) = 25% of excess; Gross CLT = Net + Lifetime tax!',
      },
      {
        item: 'Death Rate & Taper Relief (>3–7 yrs)',
        value: '40% less 20% / 40% / 60% / 80% tax cut',
        source: 'CBE',
        rule: '3–4y: 20% cut (32% eff.) · 4–5y: 40% cut · 5–6y: 60% cut · 6–7y: 80% cut. Deduct lifetime tax paid last (NO refund).',
      },
      {
        item: 'Lifetime Annual Exemption & Small Gifts',
        value: '£3,000 p.a. (1 yr c/f) · £250/person',
        source: 'Memorise',
        rule: 'CY £3,000 used FIRST then previous year b/f. Small gift £250 is ALL-OR-NOTHING (>£250 invalidates ALL!).',
      },
      {
        item: 'Marriage Exemption & IHT Death Due Date',
        value: '£5k Parent / £2.5k G-parent / £1k Other',
        source: 'Memorise',
        rule: 'Death estate IHT due 6 months after end of month of death. Lifetime CLT Apr–Sep = 30 Apr next yr; Oct–Mar = 6m after month end.',
      },
    ],
    workedExamples: [
      {
        title: 'CLT Donor Pays + Subsequent Death Within 5 Years (Spec Q8 + Opal Style)',
        scenario:
          'On 10 July 2021 donor gifted £400,000 (after all exemptions) into a discretionary trust and paid the lifetime IHT herself. No prior gifts. Donor dies on 1 December 2025 leaving a £600,000 estate (incl. £250k house) to her daughter.',
        steps: [
          { label: 'Lifetime CLT (10 July 2021)', calc: 'NRB £325k -> Excess = £75,000; Donor pays 25% = £18,750' },
          { label: 'Gross Chargeable Transfer (for 7-yr cumulation)', calc: '£400,000 + £18,750 = £418,750' },
          { label: 'Death tax on CLT (4.4 yrs -> 40% taper)', calc: '(£418,750 − £325,000) × 40% = £37,500 × (1 − 40%) = £22,500 − £18,750 paid = £3,750' },
          { label: 'Death Estate NRB left', calc: '£325,000 − £418,750 (gross CLT within 7 yrs) = £0 NRB!' },
          { label: 'Death Estate RNRB & IHT', calc: '(£600,000 − £175,000 RNRB) × 40% = £170,000' },
        ],
        answer: 'Lifetime IHT £18,750 + Additional Death IHT on CLT £3,750 + Estate IHT £170,000',
        trapNote:
          'Notice how Gross CLT (£418,750, NOT £400,000) eats the NRB both on death and for future gifts! Taper NEVER reduces the £418,750 value consuming NRB!',
      },
    ],
    examTraps: [
      'Life insurance policy on the deceased’s own life enters the death estate at PROCEEDS received (£442k), NOT its surrender/market value before death (£350k) — Specimen Case 2 Opal!',
      'Verbal promises (no legal consideration) and gambling debts are NOT deductible from a death estate; repayment & interest-only mortgages ARE deductible.',
      'Pre-owned spouse NRB/RNRB unused % can transfer to the surviving spouse on the second death.',
    ],
  },
  {
    id: 'vat-penalties',
    shortLabel: 'VAT & Penalties',
    title: 'VAT Registration, Schemes, Penalties, Interest & Standard Error Penalties',
    kitPage: 'Kit P.40–41 & P.46',
    relatedTopicId: 23,
    summary:
      'Historic £90k vs Future 30-day registration test, Flat Rate % on VAT-inclusive turnover, Points-based late filing (£200), and PLR Error Penalty matrix.',
    rates: [
      {
        item: 'Standard rate / Registration / Deregistration',
        value: '20% · £90,000 · £88,000',
        source: 'CBE',
        rule: 'Include zero-rated + standard-rated taxable supplies (EXCLUDE exempt supplies & sales of capital assets).',
      },
      {
        item: 'Late VAT Payment Penalties',
        value: '0% ≤15d · 3% 16–30d · 6% >30d (+10% p.a.)',
        source: 'CBE',
        rule: 'Plus 8.50% late payment interest from due date (1 month & 7 days after return period).',
      },
      {
        item: 'Late VAT Filing Penalty Points (Quarterly)',
        value: '4 points -> £200 fine',
        source: 'Memorise',
        rule: 'To reset points to 0: file 4 consecutive on-time returns AND file all outstanding returns for prior 24 months.',
      },
      {
        item: 'Flat Rate Scheme (FRS) limits',
        value: 'Join ≤ £150k excl. · Leave > £230k incl.',
        source: 'Memorise',
        rule: 'Apply FRS% to VAT-INCLUSIVE total turnover (incl. exempt & zero-rated); recover input VAT only on capital goods ≥ £2,000.',
      },
      {
        item: 'Cash & Annual Accounting limits',
        value: 'Join ≤ £1.35m · Leave > £1.6m',
        source: 'Memorise',
        rule: 'Cash accounting gives automatic bad debt relief; Annual requires 9 monthly payments + balancing return.',
      },
      {
        item: 'Underpaid / Overpaid Tax Interest',
        value: '8.50% Underpaid · 3.50% Overpaid',
        source: 'CBE',
        rule: 'Runs from due date until actual payment date across IT, NIC, CT, CGT, and VAT.',
      },
    ],
    matrices: [
      {
        title: 'Standard Penalties for Errors (% of Potential Lost Revenue — Kit P.41)',
        headers: ['Taxpayer Behaviour', 'Maximum Penalty', 'Minimum (Unprompted)', 'Minimum (Prompted)'],
        rows: [
          ['Careless', '30%', '0%', '15%'],
          ['Deliberate (not concealed)', '70%', '20%', '35%'],
          ['Deliberate and concealed', '100%', '30%', '50%'],
        ],
      },
    ],
    workedExamples: [
      {
        title: 'Historic £90,000 Registration Test & Tax Fraction (20/120)',
        scenario:
          'Trader’s cumulative 12-month taxable supplies reach £92,400 by 31 August 2025. Also writes off a £1,200 (VAT-inclusive) bad debt whose due date was 1 Feb 2026 in quarter ended 31 Aug 2026.',
        steps: [
          { label: 'Historic £90k exceeded', calc: 'Cumulative 12m > £90,000 at 31 August 2025' },
          { label: 'Notify HMRC by', calc: '30 September 2025 (30 days from end of August)' },
          { label: 'Effective registration & charge VAT from', calc: '1 October 2025 (1st day of 2nd month after August!)' },
          { label: 'Bad debt VAT relief (6 months from DUE date)', calc: '1 Feb + 6m = 1 Aug 2026 -> claim £1,200 × 20/120 = £200 in QE 31 Aug 2026!' },
        ],
        answer: 'Notify 30 Sep 2025 · Register 1 Oct 2025 · Bad debt relief £200',
        trapNote:
          'Bad debt relief runs 6 months from the PAYMENT DUE DATE (NOT invoice date!). Overseas customer entertaining input VAT IS recoverable; UK client entertaining is blocked.',
      },
    ],
    examTraps: [
      'Small error disclosure on next VAT return is allowed ONLY if net error ≤ £10,000 (or ≤ 1% of net Box 6 outputs, max £50,000).',
      'Pre-registration input VAT: Goods still on hand = 4 years before registration; Services = 6 months before registration.',
      'Fuel scale charge (e.g. £479 VAT-inclusive -> £479 × 20/120 = £80 output VAT) allows full £720 input VAT recovery (£120)!',
    ],
  },
];

export interface Fa25DeadlineGroup {
  id: string;
  area: string;
  kitPage: string;
  items: {
    action: string;
    rule: string;
    example2526: string;
    source: 'CBE' | 'Memorise';
  }[];
}

export const FA25_TIME_LIMIT_GROUPS: Fa25DeadlineGroup[] = [
  {
    id: 'sa-indiv',
    area: 'Self-Assessment — Individuals, Appeals & Enquiries',
    kitPage: 'Kit P.44',
    items: [
      {
        action: 'Notify chargeability (new income/gain source)',
        rule: '6 months after end of tax year',
        example2526: '5 October 2026 (2025/26)',
        source: 'CBE',
      },
      {
        action: 'Return filing (Paper vs Electronic)',
        rule: 'Paper: 31 Oct · Online: 31 Jan (or 3m from notice if issued after 31 Oct)',
        example2526: '31 Oct 2026 / 31 Jan 2027',
        source: 'CBE',
      },
      {
        action: 'Income Tax & Class 4 NIC Pay Days (POAs & Balancing)',
        rule: '1st POA: 31 Jan in year · 2nd POA: 31 Jul after · Balance: 31 Jan after',
        example2526: '31 Jan 26 · 31 Jul 26 · 31 Jan 27',
        source: 'CBE',
      },
      {
        action: 'CGT UK Residential Property vs Other CGT Pay Day',
        rule: 'UK Residential Property: 60 days from completion · Other gains: 31 Jan after',
        example2526: '60 days / 31 Jan 2027',
        source: 'CBE',
      },
      {
        action: 'Record Retention (Business/Property vs Personal)',
        rule: 'Business/Property: 5 yrs from 31 Jan · Personal only: 12m from 31 Jan',
        example2526: '31 Jan 2032 vs 31 Jan 2028',
        source: 'CBE',
      },
      {
        action: 'Taxpayer Amendment / HMRC Right of Repair',
        rule: 'Taxpayer amend: 12m from 31 Jan · HMRC repair: 9m from actual filing',
        example2526: '31 Jan 2028 (amend)',
        source: 'CBE',
      },
      {
        action: 'HMRC Compliance Check (Enquiry) & Discovery Assessments',
        rule: 'Enquiry: 12m from filing (or next quarter day if late!) · Discovery: 4 / 6 / 20 yrs',
        example2526: '4y Normal · 6y Careless · 20y Deliberate',
        source: 'CBE',
      },
      {
        action: 'Overpayment Relief & Written Appeal Against Assessment',
        rule: 'Overpayment: 4 yrs from tax year end · Appeal: 30 days in writing',
        example2526: '5 April 2030 / 30 days',
        source: 'CBE',
      },
    ],
  },
  {
    id: 'it-cgt-nic-claims',
    area: 'Income Tax Losses, NIC & CGT Relief Claims',
    kitPage: 'Kit P.43',
    items: [
      {
        action: 'IT Trading Loss CY / PY (s.64) & Opening 3-Yr (s.72)',
        rule: '12 months from 31 January following end of loss tax year',
        example2526: '31 January 2028',
        source: 'CBE',
      },
      {
        action: 'IT Trading Loss Carry-Forward Agree & Terminal 3-Yr Loss',
        rule: '4 years from end of tax year in which loss arose / ceased',
        example2526: '5 April 2030',
        source: 'CBE',
      },
      {
        action: 'CGT BADR Election',
        rule: '12 months from 31 January following end of tax year of disposal',
        example2526: '31 January 2028',
        source: 'CBE',
      },
      {
        action: 'CGT Rollover Relief & Gift Holdover Relief (Individuals)',
        rule: '4 years from end of tax year (disposal or replacement, whichever is later)',
        example2526: '5 April 2030',
        source: 'CBE',
      },
      {
        action: 'CGT Determination of Main Private Residence (PRR)',
        rule: '2 years from acquisition of second property',
        example2526: 'Within 24 months of 2nd home',
        source: 'CBE',
      },
      {
        action: 'Class 1 PAYE & Class 1A NIC Payments',
        rule: 'Class 1: 17 days after tax month (22nd elec / 19th) · Class 1A: 22 July after year',
        example2526: '22nd monthly / 22 July 2026',
        source: 'CBE',
      },
    ],
  },
  {
    id: 'ct-vat-deadlines',
    area: 'Corporation Tax & VAT Compliance',
    kitPage: 'Kit P.45–46',
    items: [
      {
        action: 'CT Payment (Small/Medium vs Large QIPs)',
        rule: 'Small/Med: 9m + 1 day after AP end · Large: 14th of months 7, 10, 13, 16',
        example2526: '1 Jan 2027 (31 Mar 26 YE)',
        source: 'CBE',
      },
      {
        action: 'CT600 Return Filing & Record Retention',
        rule: 'File: later of 12m post-AP or 3m post-notice · Records: 6 yrs from AP end',
        example2526: 'File 31 Mar 2027 · Keep 2032',
        source: 'CBE',
      },
      {
        action: 'CT Loss Claims (CY / 12m CB / b/f / Group / Gains Transfer)',
        rule: '2 years from end of AP (in which loss arose / relieved / claimant AP)',
        example2526: '31 March 2028 (31 Mar 26 YE)',
        source: 'CBE',
      },
      {
        action: 'CT Rollover Relief (Companies)',
        rule: '4 years from end of AP (disposal or replacement acquisition, whichever later)',
        example2526: '31 March 2030 (31 Mar 26 YE)',
        source: 'CBE',
      },
      {
        action: 'VAT Historic (>£90k) vs Future Test Registration',
        rule: 'Historic: notify 30d post-month, register 1st of 2nd month · Future: 30d & charge Day 1',
        example2526: 'Exceed Aug -> Reg 1 Oct',
        source: 'CBE',
      },
      {
        action: 'VAT Return & Payment Due Date',
        rule: '1 month and 7 days after return period end (dereg notify: 30 days)',
        example2526: 'QE 31 Mar 26 -> 7 May 2026',
        source: 'CBE',
      },
    ],
  },
];
