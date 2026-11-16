import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Calculator,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Search,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import {
  FA25_REVISION_MODULES,
  FA25_TIME_LIMIT_GROUPS,
  type Fa25RevisionModule,
} from '../data/fa25RevisionHub';
import {
  calculateAdjustedPersonalAllowance,
  calculateCapitalAllowances2526,
  calculateCarAndFuelBenefit,
  calculateChattelGain,
  calculateCorporationTax,
} from '../engine/taxCalculators';

export interface FA25TaxTablesProps {
  compact?: boolean;
  onOpenTopic?: (topicId: number) => void;
  onOpenQuestionById?: (questionId: string) => void;
}

const MODULE_PILLS = [
  { id: 'all', label: 'All FA25' },
  ...FA25_REVISION_MODULES.map((m) => ({ id: m.id, label: m.shortLabel })),
  { id: 'deadlines', label: 'Deadlines & Claims' },
];

const QUICK_SEARCH_PRESETS = [
  'Car %',
  'RDE2',
  'PA taper',
  'Full Expensing',
  '3/200',
  'Chattels',
  'Taper relief',
  '£90,000',
  'Discovery',
];

const MODULE_QUESTION_REFS: Record<string, { qId: string; label: string }[]> = {
  'income-tax': [
    { qId: 'SPEC-Q3', label: 'Spec Q3 · PA & Gift Aid' },
    { qId: 'Q101', label: 'Q101 · Sheldon (15m IT)' },
  ],
  'residence-benefits': [
    { qId: 'Q27', label: 'Q27 · Diesel Car & Fuel' },
    { qId: 'SPEC-Q15', label: 'Spec Q15 · Residence' },
    { qId: 'SPEC-Q32', label: 'Spec Q32 · Benefits & SA' },
  ],
  'pensions-property-losses': [
    { qId: 'Q119', label: 'Q119 · Loss Choice (CR)' },
    { qId: 'SPEC-Q6', label: 'Spec Q6 · Pensions' },
  ],
  nic: [
    { qId: 'SPEC-Q1', label: 'Spec Q1 · Class 4 NIC' },
    { qId: 'SPEC-Q31', label: 'Spec Q31 · Sarah NIC' },
  ],
  'capital-allowances': [
    { qId: 'Q252', label: 'Q252 · Short AP 50% FYA' },
    { qId: 'Q256', label: 'Q256 · CA Proration' },
  ],
  'corp-tax': [
    { qId: 'Q230', label: 'Q230 · CT Loss Carry-Fwd' },
    { qId: 'Q251', label: 'Q251 · CT Admin' },
    { qId: 'SPEC-Q33', label: 'Spec Q33 · Naive Ltd' },
  ],
  cgt: [
    { qId: 'SPEC-Q7', label: 'Spec Q7 · Chattels 5/3' },
    { qId: 'SPEC-CASE-1', label: 'Spec Case 1 · CGT' },
  ],
  iht: [
    { qId: 'SPEC-Q8', label: 'Spec Q8 · CLT Gross-Up' },
    { qId: 'SPEC-CASE-2', label: 'Spec Case 2 · Opal' },
  ],
  'vat-penalties': [
    { qId: 'Q297', label: 'Q297 · VAT Case' },
    { qId: 'SPEC-CASE-3', label: 'Spec Case 3 · Glacier' },
  ],
};

function fmtGbp(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}£${Math.abs(Math.round(n)).toLocaleString('en-GB')}`;
}

const CarBenefitChecker: React.FC = () => {
  const [listPrice, setListPrice] = useState(32000);
  const [capitalContrib, setCapitalContrib] = useState(6000);
  const [co2, setCo2] = useState(128);
  const [fuelType, setFuelType] = useState<
    'petrol' | 'diesel_rde2' | 'diesel_non_rde2' | 'electric' | 'hybrid'
  >('diesel_non_rde2');
  const [electricRange, setElectricRange] = useState(45);
  const [months, setMonths] = useState(9);
  const [privateFuel, setPrivateFuel] = useState(true);

  const res = useMemo(
    () =>
      calculateCarAndFuelBenefit({
        listPrice,
        capitalContribution: capitalContrib,
        co2: fuelType === 'electric' ? 0 : co2,
        fuelType,
        electricRangeMiles: electricRange,
        monthsAvailable: months,
        privateFuelProvided: privateFuel,
      }),
    [listPrice, capitalContrib, co2, fuelType, electricRange, months, privateFuel]
  );

  const effectivePrice = Math.max(0, listPrice - Math.min(5000, capitalContrib));
  const class1A = Math.round(res.total * 0.15);

  return (
    <div className="rounded-xl border border-[#C6DDD0] bg-emerald-50/40 p-4 space-y-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-[#0F5132] dark:text-emerald-400" />
          <h3 className="text-xs sm:text-sm font-bold text-[#14171A] dark:text-[#F0F3F6]">
            Live Employment Benefit Cross-Reference: Company Car &amp; Fuel (2025/26)
          </h3>
        </div>
        <span className="font-mono text-[11px] font-semibold text-[#0F5132] dark:text-emerald-300">
          CO2 %: {res.percentage}% · Cap contrib ≤ £5,000
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
          List Price (£)
          <input
            type="number"
            min={0}
            step={500}
            value={listPrice}
            onChange={(e) => setListPrice(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded-lg border border-[#D8D4C8] bg-white px-2.5 py-1.5 font-mono text-xs text-[#14171A] dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
          />
        </label>
        <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
          Cap. Contrib (£)
          <input
            type="number"
            min={0}
            step={500}
            value={capitalContrib}
            onChange={(e) => setCapitalContrib(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded-lg border border-[#D8D4C8] bg-white px-2.5 py-1.5 font-mono text-xs text-[#14171A] dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
          />
        </label>
        <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
          Fuel Standard
          <select
            value={fuelType}
            onChange={(e) =>
              setFuelType(
                e.target.value as
                  | 'petrol'
                  | 'diesel_rde2'
                  | 'diesel_non_rde2'
                  | 'electric'
                  | 'hybrid'
              )
            }
            className="mt-1 w-full rounded-lg border border-[#D8D4C8] bg-white px-2 py-1.5 text-xs text-[#14171A] dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
          >
            <option value="electric">Electric (0g)</option>
            <option value="hybrid">Hybrid (1–50g)</option>
            <option value="petrol">Petrol</option>
            <option value="diesel_rde2">Diesel (RDE2)</option>
            <option value="diesel_non_rde2">Diesel (Non-RDE2 +4%)</option>
          </select>
        </label>
        <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
          {fuelType === 'hybrid' ? 'Elec. Range (mi)' : 'CO2 (g/km)'}
          <input
            type="number"
            min={0}
            max={400}
            value={fuelType === 'hybrid' ? electricRange : fuelType === 'electric' ? 0 : co2}
            disabled={fuelType === 'electric'}
            onChange={(e) =>
              fuelType === 'hybrid'
                ? setElectricRange(Number(e.target.value) || 0)
                : setCo2(Number(e.target.value) || 0)
            }
            className="mt-1 w-full rounded-lg border border-[#D8D4C8] bg-white px-2.5 py-1.5 font-mono text-xs text-[#14171A] disabled:opacity-50 dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
          />
        </label>
        <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
          Months Available
          <input
            type="number"
            min={1}
            max={12}
            value={months}
            onChange={(e) => setMonths(Math.min(12, Math.max(1, Number(e.target.value) || 1)))}
            className="mt-1 w-full rounded-lg border border-[#D8D4C8] bg-white px-2.5 py-1.5 font-mono text-xs text-[#14171A] dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
          />
        </label>
        <label className="flex items-center gap-2 pt-4 text-xs font-medium text-[#14171A] dark:text-[#F0F3F6]">
          <input
            type="checkbox"
            checked={privateFuel}
            onChange={(e) => setPrivateFuel(e.target.checked)}
            className="h-4 w-4 rounded border-[#D8D4C8] text-[#0F5132]"
          />
          Private Fuel
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-lg border border-[#E6E4DD] bg-white px-3 py-2 dark:border-[#262C36] dark:bg-[#161B22]">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Adj. List Price
          </span>
          <p className="font-mono text-sm font-bold text-[#14171A] dark:text-[#F0F3F6]">
            {fmtGbp(effectivePrice)}
          </p>
        </div>
        <div className="rounded-lg border border-[#E6E4DD] bg-white px-3 py-2 dark:border-[#262C36] dark:bg-[#161B22]">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Car Benefit ({res.percentage}%)
          </span>
          <p className="font-mono text-sm font-bold text-[#0F5132] dark:text-emerald-400">
            {fmtGbp(res.carBenefit)}
          </p>
        </div>
        <div className="rounded-lg border border-[#E6E4DD] bg-white px-3 py-2 dark:border-[#262C36] dark:bg-[#161B22]">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Fuel (£28,200 × %)
          </span>
          <p className="font-mono text-sm font-bold text-[#0F5132] dark:text-emerald-400">
            {fmtGbp(res.fuelBenefit)}
          </p>
        </div>
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-950/40">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#0F5132] dark:text-emerald-300">
            Total BIK · Class 1A (15%)
          </span>
          <p className="font-mono text-sm font-bold text-[#0F5132] dark:text-emerald-300">
            {fmtGbp(res.total)} · {fmtGbp(class1A)}
          </p>
        </div>
      </div>
    </div>
  );
};

const CapitalAllowanceChecker: React.FC = () => {
  const [isCompany, setIsCompany] = useState(true);
  const [months, setMonths] = useState(9);
  const [mainBf, setMainBf] = useState(40000);
  const [srpAdd, setSrpAdd] = useState(800000);
  const [mainAdd, setMainAdd] = useState(0);
  const [carCost, setCarCost] = useState(18000);
  const [carTier, setCarTier] = useState<'new_0g' | 'secondhand_0g' | '1_to_50g' | 'over_50g'>(
    'over_50g'
  );

  const res = useMemo(
    () =>
      calculateCapitalAllowances2526({
        isCompany,
        months,
        mainPoolBf: mainBf,
        specialRateAddition: srpAdd,
        mainPoolAddition: mainAdd,
        carCost,
        carTier,
      }),
    [isCompany, months, mainBf, srpAdd, mainAdd, carCost, carTier]
  );

  return (
    <div className="rounded-xl border border-[#C6DDD0] bg-emerald-50/40 p-4 space-y-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-[#0F5132] dark:text-emerald-400" />
          <h3 className="text-xs sm:text-sm font-bold text-[#14171A] dark:text-[#F0F3F6]">
            Live Capital Allowances Cross-Reference: AIA, Full Expensing &amp; Car CO2 Tiers
          </h3>
        </div>
        <span className="font-mono text-[11px] font-semibold text-[#0F5132] dark:text-emerald-300">
          Prorated AIA Cap: {fmtGbp(res.aiaLimit)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-7">
        <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
          Entity
          <select
            value={isCompany ? 'co' : 'sole'}
            onChange={(e) => setIsCompany(e.target.value === 'co')}
            className="mt-1 w-full rounded-lg border border-[#D8D4C8] bg-white px-2 py-1.5 text-xs text-[#14171A] dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
          >
            <option value="co">Company (FE + 50%)</option>
            <option value="sole">Sole Trader (No FE)</option>
          </select>
        </label>
        <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
          Period (Months)
          <input
            type="number"
            min={1}
            max={18}
            value={months}
            onChange={(e) => setMonths(Math.min(18, Math.max(1, Number(e.target.value) || 1)))}
            className="mt-1 w-full rounded-lg border border-[#D8D4C8] bg-white px-2.5 py-1.5 font-mono text-xs text-[#14171A] dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
          />
        </label>
        <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
          Main Pool b/f (£)
          <input
            type="number"
            min={0}
            step={1000}
            value={mainBf}
            onChange={(e) => setMainBf(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded-lg border border-[#D8D4C8] bg-white px-2.5 py-1.5 font-mono text-xs text-[#14171A] dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
          />
        </label>
        <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
          New SRP Add (£)
          <input
            type="number"
            min={0}
            step={10000}
            value={srpAdd}
            onChange={(e) => setSrpAdd(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded-lg border border-[#D8D4C8] bg-white px-2.5 py-1.5 font-mono text-xs text-[#14171A] dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
          />
        </label>
        <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
          New Main P&amp;M (£)
          <input
            type="number"
            min={0}
            step={5000}
            value={mainAdd}
            onChange={(e) => setMainAdd(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded-lg border border-[#D8D4C8] bg-white px-2.5 py-1.5 font-mono text-xs text-[#14171A] dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
          />
        </label>
        <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
          Car Cost (£)
          <input
            type="number"
            min={0}
            step={1000}
            value={carCost}
            onChange={(e) => setCarCost(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded-lg border border-[#D8D4C8] bg-white px-2.5 py-1.5 font-mono text-xs text-[#14171A] dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
          />
        </label>
        <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
          Car CO2 Tier
          <select
            value={carTier}
            onChange={(e) =>
              setCarTier(
                e.target.value as 'new_0g' | 'secondhand_0g' | '1_to_50g' | 'over_50g'
              )
            }
            className="mt-1 w-full rounded-lg border border-[#D8D4C8] bg-white px-2 py-1.5 text-xs text-[#14171A] dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
          >
            <option value="new_0g">New 0g (100% FYA)</option>
            <option value="secondhand_0g">2nd-hand 0g (18%)</option>
            <option value="1_to_50g">1–50 g/km (18%)</option>
            <option value="over_50g">&gt;50 g/km (6% SRP)</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        <div className="rounded-lg border border-[#E6E4DD] bg-white px-3 py-2 dark:border-[#262C36] dark:bg-[#161B22]">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            AIA (SRP First)
          </span>
          <p className="font-mono text-sm font-bold text-[#14171A] dark:text-[#F0F3F6]">
            {fmtGbp(res.aiaClaimed)}
          </p>
        </div>
        <div className="rounded-lg border border-[#E6E4DD] bg-white px-3 py-2 dark:border-[#262C36] dark:bg-[#161B22]">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            FE 100% + SRP 50%
          </span>
          <p className="font-mono text-sm font-bold text-[#14171A] dark:text-[#F0F3F6]">
            {fmtGbp(res.mainFullExpensing + res.srpFya50)}
          </p>
        </div>
        <div className="rounded-lg border border-[#E6E4DD] bg-white px-3 py-2 dark:border-[#262C36] dark:bg-[#161B22]">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Car FYA / Pool WDA
          </span>
          <p className="font-mono text-sm font-bold text-[#0F5132] dark:text-emerald-400">
            {fmtGbp(res.carFya100 + res.mainWda + res.srpWda)}
          </p>
        </div>
        <div className="rounded-lg border border-[#E6E4DD] bg-white px-3 py-2 dark:border-[#262C36] dark:bg-[#161B22]">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            TWDV c/f (Main/SRP)
          </span>
          <p className="font-mono text-xs font-bold text-neutral-700 dark:text-neutral-300">
            {fmtGbp(res.mainCf)} / {fmtGbp(res.srpCf)}
          </p>
        </div>
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-950/40">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#0F5132] dark:text-emerald-300">
            Total Capital Allowances
          </span>
          <p className="font-mono text-sm font-bold text-[#0F5132] dark:text-emerald-300">
            {fmtGbp(res.totalAllowances)}
          </p>
        </div>
      </div>
    </div>
  );
};

const QuickThresholdCheckers: React.FC<{ moduleId: string }> = ({ moduleId }) => {
  const [netIncome, setNetIncome] = useState(111100);
  const [grossGiftAid, setGrossGiftAid] = useState(1000);
  const [ttp, setTtp] = useState(70000);
  const [exemptDivs, setExemptDivs] = useState(10000);
  const [associates, setAssociates] = useState(1);
  const [chattelGp, setChattelGp] = useState(8700);
  const [chattelCost, setChattelCost] = useState(2400);

  if (moduleId === 'residence-benefits') return <CarBenefitChecker />;
  if (moduleId === 'capital-allowances') return <CapitalAllowanceChecker />;

  if (moduleId === 'income-tax') {
    const pa = calculateAdjustedPersonalAllowance(netIncome, grossGiftAid, 0);
    return (
      <div className="rounded-xl border border-[#C6DDD0] bg-emerald-50/40 p-4 space-y-2.5 dark:border-emerald-900/50 dark:bg-emerald-950/20">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-[#0F5132] dark:text-emerald-400" />
          <h3 className="text-xs sm:text-sm font-bold text-[#14171A] dark:text-[#F0F3F6]">
            Live PA Taper Checker (ANI &gt; £100,000)
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
            Net Income (£)
            <input
              type="number"
              step={500}
              value={netIncome}
              onChange={(e) => setNetIncome(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-[#D8D4C8] bg-white px-2.5 py-1.5 font-mono text-xs text-[#14171A] dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
            />
          </label>
          <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
            Gross Gift Aid / PPC (£)
            <input
              type="number"
              step={200}
              value={grossGiftAid}
              onChange={(e) => setGrossGiftAid(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-[#D8D4C8] bg-white px-2.5 py-1.5 font-mono text-xs text-[#14171A] dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
            />
          </label>
          <div className="rounded-lg border border-[#E6E4DD] bg-white px-3 py-2 dark:border-[#262C36] dark:bg-[#161B22]">
            <span className="text-[10px] font-semibold uppercase text-neutral-500">ANI · Reduction</span>
            <p className="font-mono text-xs font-bold text-[#14171A] dark:text-[#F0F3F6]">
              {fmtGbp(pa.ani)} · −{fmtGbp(pa.reduction)}
            </p>
          </div>
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-950/40">
            <span className="text-[10px] font-semibold uppercase text-[#0F5132] dark:text-emerald-300">
              Adjusted PA
            </span>
            <p className="font-mono text-sm font-bold text-[#0F5132] dark:text-emerald-300">
              {fmtGbp(pa.personalAllowance)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (moduleId === 'corp-tax') {
    const ct = calculateCorporationTax({
      ttp,
      exemptDividends: exemptDivs,
      associatedCompanies: associates,
      months: 12,
    });
    return (
      <div className="rounded-xl border border-[#C6DDD0] bg-emerald-50/40 p-4 space-y-2.5 dark:border-emerald-900/50 dark:bg-emerald-950/20">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-[#0F5132] dark:text-emerald-400" />
            <h3 className="text-xs sm:text-sm font-bold text-[#14171A] dark:text-[#F0F3F6]">
              Live CT Marginal Relief Checker (3/200)
            </h3>
          </div>
          <span className="font-mono text-[11px] font-semibold text-[#0F5132] dark:text-emerald-300">
            Limits: {fmtGbp(ct.lowerLimit)} – {fmtGbp(ct.upperLimit)} · {ct.band}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
            TTP (£)
            <input
              type="number"
              step={5000}
              value={ttp}
              onChange={(e) => setTtp(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-[#D8D4C8] bg-white px-2.5 py-1.5 font-mono text-xs text-[#14171A] dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
            />
          </label>
          <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
            Non-51% Divs (£)
            <input
              type="number"
              step={1000}
              value={exemptDivs}
              onChange={(e) => setExemptDivs(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-[#D8D4C8] bg-white px-2.5 py-1.5 font-mono text-xs text-[#14171A] dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
            />
          </label>
          <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
            Associates Count
            <input
              type="number"
              min={0}
              max={20}
              value={associates}
              onChange={(e) => setAssociates(Math.max(0, Number(e.target.value) || 0))}
              className="mt-1 w-full rounded-lg border border-[#D8D4C8] bg-white px-2.5 py-1.5 font-mono text-xs text-[#14171A] dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
            />
          </label>
          <div className="rounded-lg border border-[#E6E4DD] bg-white px-3 py-2 dark:border-[#262C36] dark:bg-[#161B22]">
            <span className="text-[10px] font-semibold uppercase text-neutral-500">
              Augmented · Relief
            </span>
            <p className="font-mono text-xs font-bold text-[#14171A] dark:text-[#F0F3F6]">
              {fmtGbp(ct.augmentedProfits)} · −{fmtGbp(ct.marginalRelief)}
            </p>
          </div>
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-950/40">
            <span className="text-[10px] font-semibold uppercase text-[#0F5132] dark:text-emerald-300">
              CT Payable
            </span>
            <p className="font-mono text-sm font-bold text-[#0F5132] dark:text-emerald-300">
              {fmtGbp(ct.corporationTax)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (moduleId === 'cgt') {
    const ch = calculateChattelGain(chattelGp, chattelCost);
    return (
      <div className="rounded-xl border border-[#C6DDD0] bg-emerald-50/40 p-4 space-y-2.5 dark:border-emerald-900/50 dark:bg-emerald-950/20">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-[#0F5132] dark:text-emerald-400" />
          <h3 className="text-xs sm:text-sm font-bold text-[#14171A] dark:text-[#F0F3F6]">
            Live Chattels 5/3 Cap Checker
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
            Gross Proceeds (£)
            <input
              type="number"
              step={250}
              value={chattelGp}
              onChange={(e) => setChattelGp(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-[#D8D4C8] bg-white px-2.5 py-1.5 font-mono text-xs text-[#14171A] dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
            />
          </label>
          <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
            Original Cost (£)
            <input
              type="number"
              step={250}
              value={chattelCost}
              onChange={(e) => setChattelCost(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-[#D8D4C8] bg-white px-2.5 py-1.5 font-mono text-xs text-[#14171A] dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
            />
          </label>
          <div className="col-span-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-950/40">
            <span className="text-[10px] font-semibold uppercase text-[#0F5132] dark:text-emerald-300">
              Chargeable Gain: {fmtGbp(ch.chargeableGain)}
            </span>
            <p className="font-mono text-xs text-[#14171A] dark:text-emerald-200">{ch.rule}</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export const FA25TaxTables: React.FC<FA25TaxTablesProps> = ({
  compact = false,
  onOpenTopic,
  onOpenQuestionById,
}) => {
  const [query, setQuery] = useState('');
  const [activeArea, setActiveArea] = useState<string>('all');
  const [onlyMemorise, setOnlyMemorise] = useState(false);
  const [showExamples, setShowExamples] = useState(!compact);
  const [showInteractiveCheckers, setShowInteractiveCheckers] = useState(!compact);
  const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({});

  const qLower = query.trim().toLowerCase();

  const filteredModules = useMemo(() => {
    if (activeArea === 'deadlines') return [];
    return FA25_REVISION_MODULES.filter((m) => activeArea === 'all' || m.id === activeArea)
      .map((mod) => {
        const rates = mod.rates.filter((r) => {
          if (onlyMemorise && r.source !== 'Memorise') return false;
          if (!qLower) return true;
          return (
            mod.title.toLowerCase().includes(qLower) ||
            mod.shortLabel.toLowerCase().includes(qLower) ||
            r.item.toLowerCase().includes(qLower) ||
            r.value.toLowerCase().includes(qLower) ||
            r.rule.toLowerCase().includes(qLower)
          );
        });

        const matrices = (mod.matrices ?? []).filter((mat) => {
          if (onlyMemorise) return false;
          if (!qLower) return true;
          return (
            mat.title.toLowerCase().includes(qLower) ||
            mat.rows.some((row) => row.some((cell) => cell.toLowerCase().includes(qLower)))
          );
        });

        const workedExamples = mod.workedExamples.filter((ex) => {
          if (!qLower) return true;
          return (
            ex.title.toLowerCase().includes(qLower) ||
            ex.scenario.toLowerCase().includes(qLower) ||
            ex.answer.toLowerCase().includes(qLower) ||
            ex.trapNote.toLowerCase().includes(qLower) ||
            ex.steps.some(
              (st) =>
                st.label.toLowerCase().includes(qLower) ||
                st.calc.toLowerCase().includes(qLower)
            )
          );
        });

        const examTraps = mod.examTraps.filter(
          (t) => !qLower || t.toLowerCase().includes(qLower)
        );

        const modTextHit =
          qLower &&
          (mod.title.toLowerCase().includes(qLower) ||
            mod.summary.toLowerCase().includes(qLower) ||
            mod.shortLabel.toLowerCase().includes(qLower));

        return {
          ...mod,
          rates:
            modTextHit && rates.length === 0
              ? mod.rates.filter((r) => !onlyMemorise || r.source === 'Memorise')
              : rates,
          matrices:
            modTextHit && matrices.length === 0 && !onlyMemorise
              ? mod.matrices ?? []
              : matrices,
          workedExamples:
            modTextHit && workedExamples.length === 0 ? mod.workedExamples : workedExamples,
          examTraps: modTextHit && examTraps.length === 0 ? mod.examTraps : examTraps,
        };
      })
      .filter(
        (m) =>
          m.rates.length > 0 ||
          (m.matrices?.length ?? 0) > 0 ||
          (showExamples && m.workedExamples.length > 0) ||
          (!onlyMemorise && m.examTraps.length > 0)
      );
  }, [activeArea, onlyMemorise, qLower, showExamples]);

  const filteredDeadlines = useMemo(() => {
    if (activeArea !== 'all' && activeArea !== 'deadlines') return [];
    if (onlyMemorise && !qLower && activeArea === 'all') return [];
    return FA25_TIME_LIMIT_GROUPS.map((grp) => ({
      ...grp,
      items: grp.items.filter((it) => {
        if (onlyMemorise && it.source !== 'Memorise') return false;
        if (!qLower) return true;
        return (
          grp.area.toLowerCase().includes(qLower) ||
          it.action.toLowerCase().includes(qLower) ||
          it.rule.toLowerCase().includes(qLower) ||
          it.example2526.toLowerCase().includes(qLower)
        );
      }),
    })).filter((g) => g.items.length > 0);
  }, [activeArea, onlyMemorise, qLower]);

  const totalRatesCount = useMemo(
    () => FA25_REVISION_MODULES.reduce((s, m) => s + m.rates.length, 0),
    []
  );
  const memoriseCount = useMemo(
    () =>
      FA25_REVISION_MODULES.reduce(
        (s, m) => s + m.rates.filter((r) => r.source === 'Memorise').length,
        0
      ),
    []
  );
  const totalExamplesCount = useMemo(
    () => FA25_REVISION_MODULES.reduce((s, m) => s + m.workedExamples.length, 0),
    []
  );

  const visibleRateMatches = filteredModules.reduce((s, m) => s + m.rates.length, 0);
  const visibleDeadlineMatches = filteredDeadlines.reduce((s, g) => s + g.items.length, 0);
  const anyExpanded = filteredModules.some((m) => !collapsedModules[m.id]);

  const toggleCollapse = (id: string) => {
    setCollapsedModules((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleToggleAllCollapse = () => {
    const next: Record<string, boolean> = {};
    for (const m of filteredModules) {
      next[m.id] = anyExpanded;
    }
    setCollapsedModules(next);
  };

  return (
    <div className="space-y-5">
      {/* Interactive Search, Filters & Mode Bar */}
      <div className="space-y-3 rounded-2xl border border-[#E6E4DD] bg-white p-4 dark:border-[#262C36] dark:bg-[#161B22]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              aria-label="Filter FA25 revision notes, rates, examples, and deadlines"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cross-reference any FA25 rule, rate, example or deadline (e.g. RDE2, Full Expensing, 3/200, chattels, FRS, 60 days)..."
              className="w-full rounded-xl border border-[#D8D4C8] bg-[#FAF9F6] py-2 pl-9 pr-3 text-sm text-[#14171A] placeholder:text-neutral-400 focus:border-[#0F5132] focus:bg-white focus:outline-none dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed={showExamples}
              onClick={() => setShowExamples((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                showExamples
                  ? 'border-[#0F5132] bg-[#0F5132] text-white dark:border-emerald-600 dark:bg-emerald-600'
                  : 'border-[#D8D4C8] bg-white text-neutral-700 hover:bg-neutral-50 dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-200'
              }`}
            >
              <Calculator className="h-3.5 w-3.5" />
              {showExamples
                ? `Worked Examples (${totalExamplesCount})`
                : `Show Examples (${totalExamplesCount})`}
            </button>

            <button
              type="button"
              aria-pressed={showInteractiveCheckers}
              onClick={() => setShowInteractiveCheckers((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                showInteractiveCheckers
                  ? 'border-[#0F5132] bg-emerald-50 text-[#0F5132] dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : 'border-[#D8D4C8] bg-white text-neutral-700 hover:bg-neutral-50 dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-200'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Live Checkers
            </button>

            <button
              type="button"
              aria-pressed={onlyMemorise}
              onClick={() => setOnlyMemorise((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                onlyMemorise
                  ? 'border-amber-500 bg-amber-500 text-white dark:border-amber-600 dark:bg-amber-600'
                  : 'border-[#D8D4C8] bg-white text-neutral-700 hover:bg-neutral-50 dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-200'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Must-Memorise Only ({memoriseCount})
            </button>

            {filteredModules.length > 1 && (
              <button
                type="button"
                onClick={handleToggleAllCollapse}
                className="rounded-lg border border-[#D8D4C8] bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-300"
              >
                {anyExpanded ? 'Collapse All' : 'Expand All'}
              </button>
            )}

            {(query || onlyMemorise || activeArea !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setOnlyMemorise(false);
                  setActiveArea('all');
                }}
                className="px-2 py-1 text-xs font-semibold text-[#0F5132] hover:underline dark:text-emerald-400"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Category Quick-Jump Bar */}
        <div className="flex flex-wrap items-center gap-1.5">
          {MODULE_PILLS.map((pill) => {
            const active = activeArea === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setActiveArea(pill.id)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-[#0F5132] text-white dark:bg-emerald-600'
                    : 'border border-[#E6E4DD] bg-[#FAF9F6] text-neutral-700 hover:bg-[#EFECE4] dark:border-[#262C36] dark:bg-[#12161D] dark:text-neutral-300 dark:hover:bg-[#1C222B]'
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        {/* Quick Search Chips & Legend */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EFECE4] pt-2.5 text-[11px] text-neutral-500 dark:border-[#262C36] dark:text-neutral-400">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono uppercase tracking-wider text-neutral-400">Quick find:</span>
            {QUICK_SEARCH_PRESETS.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => setQuery(query.toLowerCase() === term.toLowerCase() ? '' : term)}
                className="rounded border border-[#E6E4DD] bg-[#FAF9F6] px-2 py-0.5 font-mono text-[11px] font-medium text-neutral-600 hover:border-[#0F5132] hover:text-[#0F5132] dark:border-[#262C36] dark:bg-[#12161D] dark:text-neutral-300"
              >
                {term}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="rounded border border-[#D4DFD7] bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#0F5132] dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-300">
                CBE
              </span>
              In CBE Tables ({totalRatesCount - memoriseCount})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                MEMORISE
              </span>
              Must Memorise ({memoriseCount})
            </span>
            <span className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
              Showing {visibleRateMatches} rules · {visibleDeadlineMatches} deadlines
            </span>
          </div>
        </div>
      </div>

      {/* Syllabus Modules */}
      <div className="space-y-5">
        {filteredModules.map((mod: Fa25RevisionModule) => {
          const isCollapsed = Boolean(collapsedModules[mod.id]);
          const qRefs = MODULE_QUESTION_REFS[mod.id] ?? [];
          return (
            <section
              key={mod.id}
              className="overflow-hidden rounded-2xl border border-[#E6E4DD] bg-white dark:border-[#262C36] dark:bg-[#161B22]"
            >
              {/* Module Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFECE4] bg-[#FAF9F6] px-5 py-3.5 dark:border-[#262C36] dark:bg-[#12161D]">
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-base font-semibold text-[#14171A] dark:text-[#F0F3F6]">
                      {mod.title}
                    </h2>
                    <span className="font-mono text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                      {mod.kitPage}
                    </span>
                  </div>
                  {!compact && (
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">{mod.summary}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {onOpenTopic && !compact && (
                    <button
                      type="button"
                      onClick={() => onOpenTopic(mod.relatedTopicId)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#D8D4C8] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0F5132] hover:bg-emerald-50 dark:border-[#303846] dark:bg-[#1C222B] dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                    >
                      Practice Topic
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    aria-expanded={!isCollapsed}
                    onClick={() => toggleCollapse(mod.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#D8D4C8] bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-300"
                  >
                    {isCollapsed ? (
                      <>
                        Expand <ChevronDown className="h-3.5 w-3.5" />
                      </>
                    ) : (
                      <>
                        Collapse <ChevronUp className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>

              {!isCollapsed && (
                <div className="space-y-4 p-4 sm:p-5">
                  {/* Rates & Thresholds Table */}
                  {mod.rates.length > 0 && (
                    <div className="overflow-x-auto rounded-xl border border-[#E6E4DD] dark:border-[#262C36]">
                      <table className="min-w-full border-collapse text-left text-xs sm:text-sm">
                        <thead>
                          <tr className="border-b border-[#E6E4DD] bg-[#FAF9F6] font-mono text-[11px] uppercase tracking-wider text-neutral-500 dark:border-[#262C36] dark:bg-[#12161D] dark:text-neutral-400">
                            <th className="px-3.5 py-2 font-semibold">Item / Allowance</th>
                            <th className="px-3.5 py-2 font-semibold">FA25 Rate / Limit</th>
                            <th className="px-3.5 py-2 font-semibold">Exam Rule &amp; Watch-out</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EFECE4] dark:divide-[#262C36]">
                          {mod.rates.map((row, idx) => (
                            <tr
                              key={idx}
                              className="align-top hover:bg-[#FAF9F6]/60 dark:hover:bg-[#12161D]/60"
                            >
                              <td className="px-3.5 py-2.5 font-medium text-[#14171A] dark:text-[#F0F3F6]">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span>{row.item}</span>
                                  <span
                                    className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase ${
                                      row.source === 'Memorise'
                                        ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                                        : 'border-[#D4DFD7] bg-emerald-50 text-[#0F5132] dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'
                                    }`}
                                  >
                                    {row.source === 'Memorise' ? 'Memorise' : 'CBE'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3.5 py-2.5 font-mono text-xs font-bold text-[#0F5132] tabular-nums dark:text-emerald-400">
                                {row.value}
                              </td>
                              <td className="px-3.5 py-2.5 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
                                {row.rule}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Official Sub-Matrices */}
                  {(mod.matrices?.length ?? 0) > 0 &&
                    mod.matrices!.map((mat, mIdx) => (
                      <div
                        key={mIdx}
                        className="overflow-x-auto rounded-xl border border-[#E6E4DD] dark:border-[#262C36]"
                      >
                        <div className="border-b border-[#EFECE4] bg-[#FAF9F6] px-3.5 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-neutral-600 dark:border-[#262C36] dark:bg-[#12161D] dark:text-neutral-300">
                          {mat.title}
                        </div>
                        <table className="min-w-full border-collapse text-left text-xs">
                          <thead>
                            <tr className="border-b border-[#EFECE4] bg-white font-mono text-[11px] text-neutral-500 dark:border-[#262C36] dark:bg-[#161B22] dark:text-neutral-400">
                              {mat.headers.map((h, hIdx) => (
                                <th key={hIdx} className="px-3.5 py-2 font-semibold">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#EFECE4] dark:divide-[#262C36]">
                            {mat.rows.map((r, rIdx) => (
                              <tr key={rIdx}>
                                {r.map((cell, cIdx) => (
                                  <td
                                    key={cIdx}
                                    className={`px-3.5 py-2 ${
                                      cIdx === 0
                                        ? 'font-semibold text-[#14171A] dark:text-[#F0F3F6]'
                                        : 'font-mono text-[#0F5132] dark:text-emerald-300'
                                    }`}
                                  >
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}

                  {/* Interactive Calculation Cross-Reference Checker */}
                  {showInteractiveCheckers && !onlyMemorise && (
                    <QuickThresholdCheckers moduleId={mod.id} />
                  )}

                  {/* Worked Numerical Examples */}
                  {showExamples && mod.workedExamples.length > 0 && (
                    <div
                      className={compact ? 'space-y-3' : 'grid grid-cols-1 gap-4 lg:grid-cols-2'}
                    >
                      {mod.workedExamples.map((ex, eIdx) => (
                        <div
                          key={eIdx}
                          className="flex flex-col justify-between rounded-xl border border-[#D4DFD7] bg-[#FAF9F6] p-4 dark:border-emerald-900/40 dark:bg-[#0D1117]"
                        >
                          <div className="space-y-2.5">
                            <div className="flex items-start gap-2">
                              <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-[#0F5132] dark:text-emerald-400" />
                              <h3 className="text-xs sm:text-sm font-bold text-[#14171A] dark:text-[#F0F3F6]">
                                {ex.title}
                              </h3>
                            </div>
                            <p className="text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
                              {ex.scenario}
                            </p>
                            <div className="overflow-hidden rounded-lg border border-[#E6E4DD] bg-white dark:border-[#262C36] dark:bg-[#161B22]">
                              <div className="divide-y divide-[#F0EEE8] dark:divide-[#262C36]">
                                {ex.steps.map((st, sIdx) => (
                                  <div
                                    key={sIdx}
                                    className="grid grid-cols-12 gap-2 px-3 py-1.5 text-[11px] sm:text-xs"
                                  >
                                    <span className="col-span-5 font-medium text-neutral-600 dark:text-neutral-400">
                                      {st.label}
                                    </span>
                                    <span className="col-span-7 font-mono text-[#14171A] dark:text-[#E5E9F0]">
                                      {st.calc}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 space-y-2">
                            <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 font-mono text-xs font-bold text-[#0F5132] dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                              {ex.answer}
                            </div>
                            <p className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-300">
                              <strong>Trap guard:</strong> {ex.trapNote}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Quick Examiner Traps & Cross-Referenced Kit/Specimen Questions */}
                  {!onlyMemorise && (mod.examTraps.length > 0 || (onOpenQuestionById && qRefs.length > 0)) && (
                    <div className="rounded-xl border border-amber-200/90 bg-amber-50/50 px-4 py-3 space-y-2.5 dark:border-amber-900/50 dark:bg-amber-950/20">
                      {mod.examTraps.length > 0 && (
                        <>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-300">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Fast Examiner Traps ({mod.shortLabel})
                          </div>
                          <ul className="space-y-1 text-xs leading-relaxed text-amber-950/90 dark:text-amber-200/90">
                            {mod.examTraps.map((trap, tIdx) => (
                              <li key={tIdx}>• {trap}</li>
                            ))}
                          </ul>
                        </>
                      )}

                      {onOpenQuestionById && !compact && qRefs.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 border-t border-amber-200/70 pt-2 dark:border-amber-900/40">
                          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-900/80 dark:text-amber-300/80">
                            Try in Practice Studio:
                          </span>
                          {qRefs.map((qr) => (
                            <button
                              key={qr.qId}
                              type="button"
                              onClick={() => onOpenQuestionById(qr.qId)}
                              className="inline-flex items-center gap-1 rounded-md border border-amber-300/80 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-[#0F5132] hover:bg-emerald-50 dark:border-amber-800/70 dark:bg-[#161B22] dark:text-emerald-300"
                            >
                              {qr.label}
                              <ExternalLink className="h-2.5 w-2.5" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Time Limits & Election Dates */}
      {filteredDeadlines.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 pt-1">
            <Clock className="h-4 w-4 text-[#0F5132] dark:text-emerald-400" />
            <h2 className="font-display text-lg font-semibold text-[#14171A] dark:text-[#F0F3F6]">
              Statutory Time Limits &amp; Election Dates (Kit P.43–46)
            </h2>
          </div>
          <div className={compact ? 'space-y-4' : 'grid grid-cols-1 gap-5 lg:grid-cols-2'}>
            {filteredDeadlines.map((grp) => (
              <div
                key={grp.id}
                className="overflow-hidden rounded-2xl border border-[#E6E4DD] bg-white dark:border-[#262C36] dark:bg-[#161B22]"
              >
                <div className="flex items-center justify-between border-b border-[#EFECE4] bg-[#FAF9F6] px-4 py-3 dark:border-[#262C36] dark:bg-[#12161D]">
                  <h3 className="font-display text-sm font-semibold text-[#14171A] dark:text-[#F0F3F6]">
                    {grp.area}
                  </h3>
                  <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
                    {grp.kitPage}
                  </span>
                </div>
                <div className="divide-y divide-[#EFECE4] dark:divide-[#262C36]">
                  {grp.items.map((it, idx) => (
                    <div key={idx} className="px-4 py-3 text-xs sm:text-sm">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium text-[#14171A] dark:text-[#F0F3F6]">
                          {it.action}
                        </span>
                        <span className="font-mono text-xs font-bold text-[#0F5132] tabular-nums dark:text-emerald-400">
                          {it.example2526}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                        {it.rule}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {filteredModules.length === 0 && filteredDeadlines.length === 0 && (
        <div className="rounded-2xl border border-[#E6E4DD] bg-white p-6 text-center text-xs text-neutral-600 dark:border-[#262C36] dark:bg-[#161B22] dark:text-neutral-400">
          No FA25 rates, examples, or deadlines match &ldquo;{query}&rdquo;.{' '}
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setOnlyMemorise(false);
              setActiveArea('all');
            }}
            className="font-semibold text-[#0F5132] hover:underline dark:text-emerald-400"
          >
            Reset filters
          </button>
        </div>
      )}
    </div>
  );
};
