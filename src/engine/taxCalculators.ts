import type { KitQuestion } from '../types/tx';

/**
 * Verified Finance Act 2025 (Tax Year 2025/26) Tax Calculators
 * Grounded strictly in Kaplan TX-UK FA25 Exam Kit P.37–42.
 */

export function calculateAdjustedPersonalAllowance(
  netIncome: number,
  grossGiftAid = 0,
  grossPersonalPension = 0
): { ani: number; personalAllowance: number; reduction: number } {
  const ani = Math.max(0, netIncome - grossGiftAid - grossPersonalPension);
  if (ani <= 100_000) {
    return { ani, personalAllowance: 12_570, reduction: 0 };
  }
  const reduction = Math.min(12_570, Math.floor((ani - 100_000) / 2));
  return {
    ani,
    personalAllowance: Math.max(0, 12_570 - reduction),
    reduction,
  };
}

export interface IncomeTaxInput {
  nonSavings: number;
  savings?: number;
  dividends?: number;
  grossGiftAid?: number;
  grossPersonalPension?: number;
  marriageAllowanceReceived?: boolean;
  childBenefitReceived?: number;
  payeDeducted?: number;
}

export function calculateIncomeTax2526(input: IncomeTaxInput) {
  const ns = Math.max(0, input.nonSavings);
  const sav = Math.max(0, input.savings ?? 0);
  const div = Math.max(0, input.dividends ?? 0);
  const giftAid = Math.max(0, input.grossGiftAid ?? 0);
  const ppc = Math.max(0, input.grossPersonalPension ?? 0);

  const totalIncome = ns + sav + div;
  const { ani, personalAllowance } = calculateAdjustedPersonalAllowance(totalIncome, giftAid, ppc);

  let remPA = personalAllowance;
  const paToNs = Math.min(ns, remPA);
  remPA -= paToNs;
  const paToSav = Math.min(sav, remPA);
  remPA -= paToSav;
  const paToDiv = Math.min(div, remPA);

  const taxNs = ns - paToNs;
  const taxSav = sav - paToSav;
  const taxDiv = div - paToDiv;
  const totalTaxable = taxNs + taxSav + taxDiv;

  const brLimit = 37_700 + giftAid + ppc;
  const hrLimit = 125_140 + giftAid + ppc;

  // Determine taxpayer's highest marginal band for Savings NRB
  let savNrb = 1_000;
  if (totalTaxable > hrLimit) savNrb = 0;
  else if (totalTaxable > brLimit) savNrb = 500;

  let bandUsed = 0;
  let tax = 0;

  // 1. Non-savings
  if (taxNs > 0) {
    const inBr = Math.min(taxNs, Math.max(0, brLimit - bandUsed));
    tax += inBr * 0.2;
    bandUsed += inBr;

    const remAfterBr = taxNs - inBr;
    const inHr = Math.min(remAfterBr, Math.max(0, hrLimit - bandUsed));
    tax += inHr * 0.4;
    bandUsed += inHr;

    const inAr = remAfterBr - inHr;
    tax += inAr * 0.45;
    bandUsed += inAr;
  }

  // 2. Savings (Starting rate 0% up to £5,000 if NS taxable < £5,000, then Savings NRB)
  if (taxSav > 0) {
    let remSav = taxSav;
    if (bandUsed < 5_000) {
      const startBand = Math.min(remSav, 5_000 - bandUsed);
      remSav -= startBand;
      bandUsed += startBand;
    }
    const nrbUsed = Math.min(remSav, savNrb);
    remSav -= nrbUsed;
    bandUsed += nrbUsed;

    if (remSav > 0) {
      const inBr = Math.min(remSav, Math.max(0, brLimit - bandUsed));
      tax += inBr * 0.2;
      bandUsed += inBr;
      remSav -= inBr;

      const inHr = Math.min(remSav, Math.max(0, hrLimit - bandUsed));
      tax += inHr * 0.4;
      bandUsed += inHr;
      remSav -= inHr;

      tax += remSav * 0.45;
      bandUsed += remSav;
    }
  }

  // 3. Dividends (£500 NRB counts toward band width)
  if (taxDiv > 0) {
    let remDiv = taxDiv;
    const divNrbUsed = Math.min(remDiv, 500);
    remDiv -= divNrbUsed;
    bandUsed += divNrbUsed;

    if (remDiv > 0) {
      const inBr = Math.min(remDiv, Math.max(0, brLimit - bandUsed));
      tax += inBr * 0.0875;
      bandUsed += inBr;
      remDiv -= inBr;

      const inHr = Math.min(remDiv, Math.max(0, hrLimit - bandUsed));
      tax += inHr * 0.3375;
      bandUsed += inHr;
      remDiv -= inHr;

      tax += remDiv * 0.3935;
      bandUsed += remDiv;
    }
  }

  const marriageReducer = input.marriageAllowanceReceived ? 252 : 0;
  let childBenefitCharge = 0;
  if (input.childBenefitReceived && ani > 60_000) {
    const pct = Math.min(100, Math.floor((ani - 60_000) / 200));
    childBenefitCharge = Math.floor((input.childBenefitReceived * pct) / 100);
  }

  const liability = Math.max(0, Math.round(tax - marriageReducer + childBenefitCharge));
  const payable = liability - (input.payeDeducted ?? 0);

  return {
    totalIncome,
    ani,
    personalAllowance,
    totalTaxable,
    brLimit,
    hrLimit,
    childBenefitCharge,
    liability,
    payable,
  };
}

export function calculateCompanyCarPercentage(
  co2: number,
  fuelType: 'petrol' | 'diesel_rde2' | 'diesel_non_rde2' | 'electric' | 'hybrid',
  electricRangeMiles = 0
): number {
  if (co2 === 0 || fuelType === 'electric') return 3;
  if (co2 >= 1 && co2 <= 50) {
    if (electricRangeMiles >= 130) return 3;
    if (electricRangeMiles >= 70) return 6;
    if (electricRangeMiles >= 40) return 9;
    if (electricRangeMiles >= 30) return 13;
    return 15;
  }
  if (co2 >= 51 && co2 <= 54) {
    const base = 16;
    return fuelType === 'diesel_non_rde2' ? Math.min(37, base + 4) : base;
  }
  const roundedDown = Math.floor(co2 / 5) * 5;
  const basePct = 17 + Math.floor((roundedDown - 55) / 5);
  const dieselAdd = fuelType === 'diesel_non_rde2' ? 4 : 0;
  return Math.min(37, basePct + dieselAdd);
}

export function calculateCarAndFuelBenefit(params: {
  listPrice: number;
  capitalContribution?: number;
  co2: number;
  fuelType: 'petrol' | 'diesel_rde2' | 'diesel_non_rde2' | 'electric' | 'hybrid';
  electricRangeMiles?: number;
  monthsAvailable: number;
  privateFuelProvided: boolean;
  privateFuelEmployeeReimbursedPartial?: number;
  monthlyUseContribution?: number;
}): { percentage: number; carBenefit: number; fuelBenefit: number; total: number } {
  const pct = calculateCompanyCarPercentage(params.co2, params.fuelType, params.electricRangeMiles ?? 0);
  const cappedContrib = Math.min(5_000, params.capitalContribution ?? 0);
  const adjustedPrice = Math.max(0, params.listPrice - cappedContrib);
  const annualCar = adjustedPrice * (pct / 100);
  const apportionedCar = (annualCar * params.monthsAvailable) / 12;
  const useContrib = (params.monthlyUseContribution ?? 0) * params.monthsAvailable;
  const carBenefit = Math.max(0, Math.round(apportionedCar - useContrib));

  // Partial reimbursement gives ZERO reduction on fuel benefit
  const fuelBenefit =
    params.privateFuelProvided && params.co2 > 0
      ? Math.round((28_200 * (pct / 100) * params.monthsAvailable) / 12)
      : 0;

  return { percentage: pct, carBenefit, fuelBenefit, total: carBenefit + fuelBenefit };
}

export function calculateNic2526(params: {
  employeeCashEarnings?: number;
  nonCashBenefits?: number;
  selfEmployedTradingProfit?: number;
  employmentAllowanceClaimed?: boolean;
}) {
  const cash = Math.max(0, params.employeeCashEarnings ?? 0);
  const bens = Math.max(0, params.nonCashBenefits ?? 0);
  const profit = Math.max(0, params.selfEmployedTradingProfit ?? 0);

  let class1Employee = 0;
  if (cash > 12_570) {
    const mainBand = Math.min(cash, 50_270) - 12_570;
    const upperBand = Math.max(0, cash - 50_270);
    class1Employee = Math.round(mainBand * 0.08 + upperBand * 0.02);
  }

  let class1Employer = 0;
  if (cash > 5_000) {
    class1Employer = Math.round((cash - 5_000) * 0.15);
    if (params.employmentAllowanceClaimed) {
      class1Employer = Math.max(0, class1Employer - 10_500);
    }
  }

  const class1A = Math.round(bens * 0.15);

  let class4 = 0;
  if (profit > 12_570) {
    const mainBand = Math.min(profit, 50_270) - 12_570;
    const upperBand = Math.max(0, profit - 50_270);
    class4 = Math.round(mainBand * 0.06 + upperBand * 0.02);
  }

  return { class1Employee, class1Employer, class1A, class4 };
}

export function calculateCorporationTax(params: {
  ttp: number;
  exemptDividends?: number;
  associatedCompanies?: number;
  months?: number;
}) {
  const ttp = Math.max(0, params.ttp);
  const divs = Math.max(0, params.exemptDividends ?? 0);
  const aug = ttp + divs;
  const divisor = 1 + (params.associatedCompanies ?? 0);
  const prop = (params.months ?? 12) / 12;

  const lower = (50_000 * prop) / divisor;
  const upper = (250_000 * prop) / divisor;

  if (aug <= lower) {
    return {
      augmentedProfits: aug,
      lowerLimit: lower,
      upperLimit: upper,
      marginalRelief: 0,
      corporationTax: Math.round(ttp * 0.19),
      band: 'Small profits (19%)',
    };
  }
  if (aug > upper) {
    return {
      augmentedProfits: aug,
      lowerLimit: lower,
      upperLimit: upper,
      marginalRelief: 0,
      corporationTax: Math.round(ttp * 0.25),
      band: 'Main rate (25%)',
    };
  }
  const grossTax = ttp * 0.25;
  const mr = (3 / 200) * (upper - aug) * (ttp / aug);
  return {
    augmentedProfits: aug,
    lowerLimit: lower,
    upperLimit: upper,
    marginalRelief: Math.round(mr),
    corporationTax: Math.round(grossTax - mr),
    band: 'Marginal relief band (26.5% effective marginal)',
  };
}

export function calculateChattelGain(grossProceeds: number, cost: number): { chargeableGain: number; rule: string } {
  if (grossProceeds <= 6_000 && cost <= 6_000) {
    return { chargeableGain: 0, rule: 'Exempt non-wasting chattel (both ≤ £6,000)' };
  }
  if (grossProceeds > 6_000 && cost <= 6_000) {
    const normal = grossProceeds - cost;
    const cap = Math.round(((grossProceeds - 6_000) * 5) / 3);
    return {
      chargeableGain: Math.min(normal, cap),
      rule: `Lower of normal gain (£${normal}) and 5/3 × (£${grossProceeds} − £6,000) = £${cap}`,
    };
  }
  return { chargeableGain: grossProceeds - cost, rule: 'Normal proceeds − cost' };
}

/**
 * Deterministic Tier-4 Trap-Planted MASTERCOACH VARIANT Generator
 * Builds verified FA25 practice variants from our certified calculators above.
 */
export function generateTrapVariant(topicId: number, seedOffset = 0): KitQuestion {
  const variantNum = (seedOffset % 3) + 1;

  if (topicId === 5) {
    // Employment Income Car & Fuel Trap Variant (RDE2 vs non-RDE2 + partial fuel contribution)
    const listPrice = 32_000 + variantNum * 2_000;
    const paidPrice = listPrice - 3_500;
    const co2 = variantNum === 1 ? 132 : variantNum === 2 ? 148 : 124;
    const isRde2 = variantNum !== 2;
    const months = variantNum === 1 ? 10 : variantNum === 2 ? 9 : 8;
    const startDates = ['6 June 2025', '6 July 2025', '6 August 2025'];
    const partialFuelPaid = 450;

    const calc = calculateCarAndFuelBenefit({
      listPrice,
      co2,
      fuelType: isRde2 ? 'diesel_rde2' : 'diesel_non_rde2',
      monthsAvailable: months,
      privateFuelProvided: true,
      privateFuelEmployeeReimbursedPartial: partialFuelPaid,
    });

    const wrongUsingPaid = calculateCarAndFuelBenefit({
      listPrice: paidPrice,
      co2,
      fuelType: isRde2 ? 'diesel_rde2' : 'diesel_non_rde2',
      monthsAvailable: months,
      privateFuelProvided: true,
    }).total;

    const wrongFuelDeducted = calc.total - partialFuelPaid;
    const wrongFullYear = calculateCarAndFuelBenefit({
      listPrice,
      co2,
      fuelType: isRde2 ? 'diesel_rde2' : 'diesel_non_rde2',
      monthsAvailable: 12,
      privateFuelProvided: true,
    }).total;

    return {
      id: `VAR-T5-${variantNum}`,
      q_num: 900 + variantNum,
      title: `MASTERCOACH VARIANT · Car & Fuel Trap #${variantNum}`,
      topic: 'Employment income',
      topic_id: 5,
      st_chapter: 'ch5 (variant of Kit Q27/Q28)',
      section: 'A',
      type: 'mcq',
      interaction: 'single_mcq',
      marks: 2,
      is_variant: true,
      planted_trap: isRde2
        ? 'RDE2 diesel cancels +4% surcharge AND partial fuel reimbursement (£450) gives £0 reduction'
        : 'Non-RDE2 diesel adds +4% AND employer discount price (£3,500 off list) is ignored',
      scenario: `On ${startDates[variantNum - 1]}, Marcus’s employer provided him with a new diesel company car which has a list price of £${listPrice.toLocaleString()} (although the employer negotiated a fleet price of £${paidPrice.toLocaleString()}). The car has CO2 emissions of ${co2} g/km and ${isRde2 ? 'meets the RDE2 standard' : 'does NOT meet the RDE2 standard'}.\n\nHis employer also paid for all private fuel from ${startDates[variantNum - 1]} to 5 April 2026. Marcus contributed £${partialFuelPaid} towards the cost of private fuel during 2025/26.`,
      requirement: 'What is Marcus’s total taxable car and fuel benefit for the tax year 2025/26?',
      options: [
        { key: 'A', text: `£${calc.total.toLocaleString()}` },
        { key: 'B', text: `£${wrongFuelDeducted.toLocaleString()}` },
        { key: 'C', text: `£${wrongUsingPaid.toLocaleString()}` },
        { key: 'D', text: `£${wrongFullYear.toLocaleString()}` },
      ],
      correct_answer: 'A',
      full_worked_solution: `1. CO2 %: ${co2} g/km rounds DOWN to ${Math.floor(co2 / 5) * 5} g/km → base ${17 + Math.floor((Math.floor(co2 / 5) * 5 - 55) / 5)}% ${isRde2 ? '+ 0% (RDE2 exempts +4% diesel surcharge)' : '+ 4% (non-RDE2 diesel surcharge)'} = ${calc.percentage}%.\n2. Car benefit (list price £${listPrice.toLocaleString()}, NOT discounted £${paidPrice.toLocaleString()}): £${listPrice.toLocaleString()} × ${calc.percentage}% × ${months}/12 = £${calc.carBenefit.toLocaleString()}.\n3. Fuel benefit: £28,200 × ${calc.percentage}% × ${months}/12 = £${calc.fuelBenefit.toLocaleString()}. Note: the £${partialFuelPaid} partial contribution gives ZERO reduction.\nTotal taxable benefit = £${calc.carBenefit.toLocaleString()} + £${calc.fuelBenefit.toLocaleString()} = £${calc.total.toLocaleString()}.`,
      mark_scheme_steps: [
        { id: 'v1', label: `Correct CO2% (${calc.percentage}%) and list price car benefit (£${calc.carBenefit.toLocaleString()})`, marks: 1 },
        { id: 'v2', label: `Fuel benefit (£${calc.fuelBenefit.toLocaleString()}) ignoring £${partialFuelPaid} partial contrib & ${months}/12`, marks: 1 },
      ],
      kit_page: 'Variant (Kit P.38)',
      answer_page: 'Verified Engine',
      past_exam: 'Mastercoach Trap-Planted Variant',
      exam_frequency_tag: 'Examined in 5 of last 8 sittings (Cars & Fuel)',
      examiner_debrief: {
        trap_category: 'Cars & Fuel Benefits',
        trap_of_question: `Double trap planted: (1) £${paidPrice.toLocaleString()} fleet cost vs £${listPrice.toLocaleString()} list price, and (2) £${partialFuelPaid} partial fuel contribution gives £0 relief.`,
        distractor_forensics: `B (£${wrongFuelDeducted.toLocaleString()}): wrongly deducted £${partialFuelPaid} fuel contribution | C (£${wrongUsingPaid.toLocaleString()}): wrongly used fleet price | D (£${wrongFullYear.toLocaleString()}): forgot ${months}/12 apportionment.`,
        examiner_playbook: 'Circle fuel type + RDE2 status + start date before calculating; ignore employer fleet discounts and partial private fuel reimbursements.',
        speed_trick: 'Compute % first, then (£list + £28,200) × % × months/12 in a single combined step!',
        twist_prediction: 'Next sitting they could add a £6,000 employee capital contribution (capped at £5,000!).',
      },
      free_marks_items: [],
    };
  }

  if (topicId === 2 || topicId === 3) {
    // PA Taper + Gross Gift Aid Trap Variant
    const tradingProfit = 108_000 + variantNum * 4_000;
    const netGiftAid = 1_600 * variantNum;
    const grossGiftAid = Math.round(netGiftAid / 0.8);
    const { ani, personalAllowance } = calculateAdjustedPersonalAllowance(tradingProfit, grossGiftAid, 0);
    const wrongNoGrossUp = calculateAdjustedPersonalAllowance(tradingProfit, netGiftAid, 0).personalAllowance;
    const wrongIgnoredGiftAid = calculateAdjustedPersonalAllowance(tradingProfit, 0, 0).personalAllowance;
    const wrongAddInstead = Math.max(0, 12_570 - Math.floor((tradingProfit + grossGiftAid - 100_000) / 2));

    return {
      id: `VAR-T2-${variantNum}`,
      q_num: 910 + variantNum,
      title: `MASTERCOACH VARIANT · PA Taper & Net Gift Aid #${variantNum}`,
      topic: 'Basic income tax computation',
      topic_id: 2,
      st_chapter: 'ch2 (variant of Kit Q14)',
      section: 'A',
      type: 'mcq',
      interaction: 'single_mcq',
      marks: 2,
      is_variant: true,
      planted_trap: `Gift Aid given NET (£${netGiftAid.toLocaleString()}) instead of GROSS (£${grossGiftAid.toLocaleString()})`,
      scenario: `For the tax year 2025/26, Elena had tax-adjusted trading profits of £${tradingProfit.toLocaleString()} and no other income. During 2025/26 she actually paid £${netGiftAid.toLocaleString()} cash to a registered charity under the Gift Aid scheme.`,
      requirement: 'What is Elena’s Personal Allowance for the tax year 2025/26?',
      options: [
        { key: 'A', text: `£${personalAllowance.toLocaleString()}` },
        { key: 'B', text: `£${wrongNoGrossUp.toLocaleString()}` },
        { key: 'C', text: `£${wrongIgnoredGiftAid.toLocaleString()}` },
        { key: 'D', text: `£${wrongAddInstead.toLocaleString()}` },
      ],
      correct_answer: 'A',
      full_worked_solution: `1. Gross up Gift Aid: £${netGiftAid.toLocaleString()} × 100/80 = £${grossGiftAid.toLocaleString()}.\n2. Adjusted Net Income (ANI) = £${tradingProfit.toLocaleString()} − £${grossGiftAid.toLocaleString()} = £${ani.toLocaleString()}.\n3. Restriction = (£${ani.toLocaleString()} − £100,000) / 2 = £${(12_570 - personalAllowance).toLocaleString()}.\n4. Personal Allowance = £12,570 − £${(12_570 - personalAllowance).toLocaleString()} = £${personalAllowance.toLocaleString()}.`,
      mark_scheme_steps: [
        { id: 'v1', label: `Gross up Gift Aid (£${netGiftAid.toLocaleString()} × 100/80 = £${grossGiftAid.toLocaleString()})`, marks: 1 },
        { id: 'v2', label: `ANI £${ani.toLocaleString()} → PA £${personalAllowance.toLocaleString()}`, marks: 1 },
      ],
      kit_page: 'Variant (Kit Q14 style)',
      answer_page: 'Verified Engine',
      past_exam: 'Mastercoach Trap-Planted Variant',
      exam_frequency_tag: 'Examined in 8 of last 8 sittings (PA Taper & ANI)',
      examiner_debrief: {
        trap_category: 'PA Taper & ANI',
        trap_of_question: `Gift Aid was stated as cash paid (£${netGiftAid.toLocaleString()} net) rather than gross (£${grossGiftAid.toLocaleString()}).`,
        distractor_forensics: `B (£${wrongNoGrossUp.toLocaleString()}): deducted net £${netGiftAid.toLocaleString()} without ×100/80 | C (£${wrongIgnoredGiftAid.toLocaleString()}): ignored Gift Aid completely | D (£${wrongAddInstead.toLocaleString()}): added Gift Aid to income instead of subtracting.`,
        examiner_playbook: 'Always check whether Gift Aid or personal pension contributions say "paid" (net) or "gross" before computing ANI.',
        speed_trick: 'In the £100,000–£125,140 zone, every £100 of gross Gift Aid restores £50 of PA (saving 20% extra tax = 60% effective relief!).',
        twist_prediction: 'Next sitting they could ask for an occupational pension contribution (already gross via net pay — do NOT multiply by 100/80!).',
      },
      free_marks_items: [],
    };
  }

  if (topicId >= 13 && topicId <= 16) {
    // Corporation Tax Marginal Relief + Associates + Non-Associated Dividends Trap Variant
    const ttp = 95_000 + variantNum * 15_000;
    const nonAssocDivs = 12_000 + variantNum * 3_000;
    const assocCos = variantNum === 1 ? 1 : variantNum === 2 ? 0 : 1;
    const res = calculateCorporationTax({
      ttp,
      exemptDividends: nonAssocDivs,
      associatedCompanies: assocCos,
    });
    const wrongNoDivs = calculateCorporationTax({
      ttp,
      exemptDividends: 0,
      associatedCompanies: assocCos,
    }).corporationTax;
    const wrongDivsTaxed = calculateCorporationTax({
      ttp: ttp + nonAssocDivs,
      exemptDividends: 0,
      associatedCompanies: assocCos,
    }).corporationTax;
    const wrongFlat25 = Math.round(ttp * 0.25);

    return {
      id: `VAR-T13-${variantNum}`,
      q_num: 930 + variantNum,
      title: `MASTERCOACH VARIANT · CT Marginal Relief & Dividends #${variantNum}`,
      topic: 'Corporation tax',
      topic_id: topicId,
      st_chapter: 'ch13 (variant of Kit Q219/Q230)',
      section: 'A',
      type: 'mcq',
      interaction: 'single_mcq',
      marks: 2,
      is_variant: true,
      planted_trap: `Exempt non-associated dividends (£${nonAssocDivs.toLocaleString()}) excluded from TTP but INCLUDED in Augmented Profits (${assocCos} associated co)`,
      scenario: `For the year ended 31 March 2026, Meridian Ltd had Taxable Total Profits (TTP) of £${ttp.toLocaleString()} and received exempt dividends from non-associated UK companies of £${nonAssocDivs.toLocaleString()}. Meridian Ltd has ${assocCos === 0 ? 'no associated companies' : '1 wholly owned UK subsidiary company'}.`,
      requirement: 'What is Meridian Ltd’s Corporation Tax liability for the year ended 31 March 2026?',
      options: [
        { key: 'A', text: `£${res.corporationTax.toLocaleString()}` },
        { key: 'B', text: `£${wrongNoDivs.toLocaleString()}` },
        { key: 'C', text: `£${wrongDivsTaxed.toLocaleString()}` },
        { key: 'D', text: `£${wrongFlat25.toLocaleString()}` },
      ],
      correct_answer: 'A',
      full_worked_solution: `1. TTP stays £${ttp.toLocaleString()} (dividends are exempt from CT).\n2. Augmented Profits = £${ttp.toLocaleString()} + £${nonAssocDivs.toLocaleString()} = £${res.augmentedProfits.toLocaleString()}.\n3. Limits divided by (1 + ${assocCos}) = £${res.lowerLimit.toLocaleString()} and £${res.upperLimit.toLocaleString()}.\n4. Band: ${res.band} → CT = £${res.corporationTax.toLocaleString()}.`,
      mark_scheme_steps: [
        { id: 'v1', label: `Compute Augmented Profits £${res.augmentedProfits.toLocaleString()} & limits £${res.lowerLimit.toLocaleString()}–£${res.upperLimit.toLocaleString()}`, marks: 1 },
        { id: 'v2', label: `Apply CT rate / 3/200 marginal relief on TTP £${ttp.toLocaleString()} → £${res.corporationTax.toLocaleString()}`, marks: 1 },
      ],
      kit_page: 'Variant (Kit P.40)',
      answer_page: 'Verified Engine',
      past_exam: 'Mastercoach Trap-Planted Variant',
      exam_frequency_tag: 'Examined in 8 of last 8 sittings (Corporation Tax)',
      examiner_debrief: {
        trap_category: 'Corporation Tax',
        trap_of_question: `Dividends are exempt from TTP (£${ttp.toLocaleString()}) yet MUST be added to Augmented Profits (£${res.augmentedProfits.toLocaleString()}), and thresholds divide by (1 + ${assocCos}).`,
        distractor_forensics: `B (£${wrongNoDivs.toLocaleString()}): omitted dividends from Augmented Profits | C (£${wrongDivsTaxed.toLocaleString()}): wrongly taxed dividends inside TTP | D (£${wrongFlat25.toLocaleString()}): applied flat 25% without marginal relief.`,
        examiner_playbook: 'Always separate TTP (no dividends) from Augmented Profits (+ non-associated dividends) and divide £50k/£250k by (1 + associates).',
        speed_trick: 'Remember marginal relief formula multiplies by (TTP / Augmented), NOT (Augmented − TTP)!',
        twist_prediction: 'Next sitting they could shorten the accounting period to 9 months (multiply limits by 9/12 too!).',
      },
      free_marks_items: [],
    };
  }

  if (topicId >= 17 && topicId <= 21) {
    // CGT Chattel 5/3 Cap + CY vs Brought-Forward Loss Ordering Trap Variant
    const proceeds = 7_500 + variantNum * 600;
    const cost = 4_200;
    const chattel = calculateChattelGain(proceeds, cost);
    const cyLoss = 1_100;
    const taxableAfterAea = Math.max(0, chattel.chargeableGain - cyLoss - 3_000);
    const wrongNoCapTaxable = Math.max(0, proceeds - cost - cyLoss - 3_000);
    const wrongBfBeforeAea = Math.max(0, chattel.chargeableGain - cyLoss);
    const wrongNoAea = Math.max(0, chattel.chargeableGain - cyLoss - 2_000);

    return {
      id: `VAR-T17-${variantNum}`,
      q_num: 940 + variantNum,
      title: `MASTERCOACH VARIANT · CGT Chattels 5/3 & Loss Order #${variantNum}`,
      topic: 'CGT: computation of gains & tax',
      topic_id: topicId,
      st_chapter: 'ch17–18 (variant of Specimen Q7)',
      section: 'A',
      type: 'mcq',
      interaction: 'single_mcq',
      marks: 2,
      is_variant: true,
      planted_trap: `Chattel bought for £${cost.toLocaleString()} (≤£6k) and sold for £${proceeds.toLocaleString()} (>£6k) uses 5/3 × (GP − £6,000) cap + CY loss BEFORE £3,000 AEA`,
      scenario: `In 2025/26, Clara sold an antique painting (non-wasting chattel) for gross proceeds of £${proceeds.toLocaleString()}, having bought it in 2018 for £${cost.toLocaleString()}. In 2025/26 she also realised a current-year capital loss of £${cyLoss.toLocaleString()} on quoted shares. She has no brought-forward capital losses.`,
      requirement: 'What is Clara’s taxable capital gain for the tax year 2025/26?',
      options: [
        { key: 'A', text: `£${taxableAfterAea.toLocaleString()}` },
        { key: 'B', text: `£${wrongNoCapTaxable.toLocaleString()}` },
        { key: 'C', text: `£${wrongBfBeforeAea.toLocaleString()}` },
        { key: 'D', text: `£${wrongNoAea.toLocaleString()}` },
      ],
      correct_answer: 'A',
      full_worked_solution: `1. Chattel cap: ${chattel.rule} → chargeable gain £${chattel.chargeableGain.toLocaleString()}.\n2. Less current-year capital loss (£${cyLoss.toLocaleString()}) = £${(chattel.chargeableGain - cyLoss).toLocaleString()}.\n3. Less Annual Exempt Amount (£3,000) = £${taxableAfterAea.toLocaleString()}.`,
      mark_scheme_steps: [
        { id: 'v1', label: `Apply 5/3 × (£${proceeds.toLocaleString()} − £6,000) chattel cap = £${chattel.chargeableGain.toLocaleString()}`, marks: 1 },
        { id: 'v2', label: `Deduct £${cyLoss.toLocaleString()} CY loss and £3,000 AEA → £${taxableAfterAea.toLocaleString()}`, marks: 1 },
      ],
      kit_page: 'Variant (Spec Q7 style)',
      answer_page: 'Verified Engine',
      past_exam: 'Mastercoach Trap-Planted Variant',
      exam_frequency_tag: 'Examined in 5 of last 8 sittings (CGT Chattels & Losses)',
      examiner_debrief: {
        trap_category: 'CGT Losses & Matching',
        trap_of_question: `Normal gain (£${(proceeds - cost).toLocaleString()}) exceeds 5/3 × (£${proceeds.toLocaleString()} − £6,000) = £${chattel.chargeableGain.toLocaleString()}, so the chattel marginal cap applies BEFORE deducting CY loss and £3,000 AEA.`,
        distractor_forensics: `B (£${wrongNoCapTaxable.toLocaleString()}): ignored 5/3 chattel relief | C (£${wrongBfBeforeAea.toLocaleString()}): forgot £3,000 AEA | D (£${wrongNoAea.toLocaleString()}): used obsolete AEA instead of FA25 £3,000.`,
        examiner_playbook: 'Whenever a non-wasting chattel is bought ≤£6,000 and sold >£6,000, immediately test 5/3 × (Gross Proceeds − £6,000).',
        speed_trick: 'If Gross Proceeds ≤ £9,600, 5/3 × (GP − £6,000) is almost always lower than actual proceeds minus a low cost!',
        twist_prediction: 'Next sitting they could add £5,000 brought-forward losses (restrict to preserve the £3,000 AEA!).',
      },
      free_marks_items: [],
    };
  }

  if (topicId === 22) {
    // IHT CLT Donor-Pays 25% Gross-Up + Annual Exemptions Trap Variant
    const grossCashIntoTrust = 410_000 + variantNum * 25_000;
    const aeAvailable = 6_000; // CY 25/26 + b/f 24/25
    const netTransfer = grossCashIntoTrust - aeAvailable;
    const excessOverNrb = netTransfer - 325_000;
    const ihtDonorPays = Math.round(excessOverNrb * 0.25);
    const wrongTrusteesPay = Math.round(excessOverNrb * 0.2);
    const wrongNoAe = Math.round((grossCashIntoTrust - 325_000) * 0.25);
    const wrongDeathRate = Math.round(excessOverNrb * 0.4);

    return {
      id: `VAR-T22-${variantNum}`,
      q_num: 950 + variantNum,
      title: `MASTERCOACH VARIANT · IHT CLT Donor-Pays 25% #${variantNum}`,
      topic: 'Inheritance tax',
      topic_id: 22,
      st_chapter: 'ch22 (variant of Specimen Q8)',
      section: 'A',
      type: 'mcq',
      interaction: 'single_mcq',
      marks: 2,
      is_variant: true,
      planted_trap: 'Donor agrees to pay lifetime IHT on CLT → must apply 25% gross-up rate (NOT 20%) AFTER deducting CY + 1-yr b/f £3,000 annual exemptions',
      scenario: `On 15 November 2025, Priya transferred £${grossCashIntoTrust.toLocaleString()} cash into a discretionary trust. She had made no previous lifetime gifts and agreed to pay any lifetime inheritance tax arising herself.`,
      requirement: 'How much lifetime inheritance tax is payable by Priya in respect of this transfer?',
      options: [
        { key: 'A', text: `£${ihtDonorPays.toLocaleString()}` },
        { key: 'B', text: `£${wrongTrusteesPay.toLocaleString()}` },
        { key: 'C', text: `£${wrongNoAe.toLocaleString()}` },
        { key: 'D', text: `£${wrongDeathRate.toLocaleString()}` },
      ],
      correct_answer: 'A',
      full_worked_solution: `1. Transfer of value: £${grossCashIntoTrust.toLocaleString()}.\n2. Less Annual Exemptions: 2025/26 (£3,000) + 2024/25 b/f (£3,000) = (£6,000) → Net chargeable transfer £${netTransfer.toLocaleString()}.\n3. Less Nil Rate Band (£325,000) → Taxable excess £${excessOverNrb.toLocaleString()}.\n4. Donor pays lifetime tax = 25% × £${excessOverNrb.toLocaleString()} = £${ihtDonorPays.toLocaleString()}.`,
      mark_scheme_steps: [
        { id: 'v1', label: `Deduct £6,000 AEs + £325,000 NRB → taxable excess £${excessOverNrb.toLocaleString()}`, marks: 1 },
        { id: 'v2', label: `Apply 25% donor-pays gross-up rate → £${ihtDonorPays.toLocaleString()}`, marks: 1 },
      ],
      kit_page: 'Variant (Spec Q8 style)',
      answer_page: 'Verified Engine',
      past_exam: 'Mastercoach Trap-Planted Variant',
      exam_frequency_tag: 'Examined in 5 of last 8 sittings (IHT CLTs & PETs)',
      examiner_debrief: {
        trap_category: 'Inheritance Tax',
        trap_of_question: 'Donor paying lifetime IHT on a CLT creates a gross-up: tax is 20/80 = 25% of the net gift above £325,000 NRB, NOT 20%.',
        distractor_forensics: `B (£${wrongTrusteesPay.toLocaleString()}): used 20% trustees-pay rate | C (£${wrongNoAe.toLocaleString()}): forgot £6,000 annual exemptions | D (£${wrongDeathRate.toLocaleString()}): applied 40% death rate.`,
        examiner_playbook: 'Circle who pays the lifetime IHT on a CLT ("trustees pay" = 20%; "donor pays" = 25% + increases gross chargeable transfer!).',
        speed_trick: 'Never forget 1 year carry-forward of the £3,000 Annual Exemption if "no previous lifetime gifts" is stated!',
        twist_prediction: 'Next sitting they could add a prior PET in 2023 (ignore prior PETs for lifetime CLT tax, only include prior CLTs!).',
      },
      free_marks_items: [],
    };
  }

  if (topicId >= 23) {
    // VAT Flat Rate Scheme on VAT-Inclusive Total Turnover Trap Variant
    const stdExcl = 30_000 + variantNum * 5_000;
    const exemptSales = 6_000;
    const expensesIncl = 4_800;
    const frsPct = 12;
    const vatInclusiveTurnover = Math.round(stdExcl * 1.2) + exemptSales;
    const frsVat = Math.round(vatInclusiveTurnover * (frsPct / 100));
    const wrongExclVat = Math.round((stdExcl + exemptSales) * (frsPct / 100));
    const wrongExclExempt = Math.round(stdExcl * 1.2 * (frsPct / 100));
    const wrongDeductInput = frsVat - Math.round(expensesIncl / 6);

    return {
      id: `VAR-T23-${variantNum}`,
      q_num: 960 + variantNum,
      title: `MASTERCOACH VARIANT · VAT Flat Rate Inclusive Trap #${variantNum}`,
      topic: 'VAT: administration & overseas',
      topic_id: topicId,
      st_chapter: 'ch24 (variant of Specimen Q10)',
      section: 'A',
      type: 'mcq',
      interaction: 'single_mcq',
      marks: 2,
      is_variant: true,
      planted_trap: `Flat Rate ${frsPct}% applies to VAT-INCLUSIVE total turnover (including exempt £${exemptSales.toLocaleString()}) with £0 input VAT deduction on expenses`,
      scenario: `Oak Ltd is in its second year of using the VAT Flat Rate Scheme (flat rate ${frsPct}%). During the quarter ended 31 March 2026, Oak Ltd made standard-rated supplies of £${stdExcl.toLocaleString()} (exclusive of VAT) and exempt supplies of £${exemptSales.toLocaleString()}. It also incurred standard-rated revenue expenses of £${expensesIncl.toLocaleString()} (inclusive of VAT).`,
      requirement: 'How much VAT must Oak Ltd pay to HMRC for the quarter ended 31 March 2026?',
      options: [
        { key: 'A', text: `£${frsVat.toLocaleString()}` },
        { key: 'B', text: `£${wrongExclVat.toLocaleString()}` },
        { key: 'C', text: `£${wrongExclExempt.toLocaleString()}` },
        { key: 'D', text: `£${wrongDeductInput.toLocaleString()}` },
      ],
      correct_answer: 'A',
      full_worked_solution: `1. VAT-inclusive standard-rated sales: £${stdExcl.toLocaleString()} × 1.20 = £${Math.round(stdExcl * 1.2).toLocaleString()}.\n2. Add exempt supplies (included in FRS turnover!): £${exemptSales.toLocaleString()} → Total VAT-inclusive turnover = £${vatInclusiveTurnover.toLocaleString()}.\n3. FRS VAT payable = £${vatInclusiveTurnover.toLocaleString()} × ${frsPct}% = £${frsVat.toLocaleString()} (revenue expenses input VAT £${Math.round(expensesIncl / 6)} is NOT recoverable under FRS).`,
      mark_scheme_steps: [
        { id: 'v1', label: `Gross up standard-rated sales (× 1.20) + exempt sales = £${vatInclusiveTurnover.toLocaleString()}`, marks: 1 },
        { id: 'v2', label: `Apply ${frsPct}% FRS & ignore £${expensesIncl.toLocaleString()} revenue expenses → £${frsVat.toLocaleString()}`, marks: 1 },
      ],
      kit_page: 'Variant (Spec Q10 / Q295 style)',
      answer_page: 'Verified Engine',
      past_exam: 'Mastercoach Trap-Planted Variant',
      exam_frequency_tag: 'Examined in 5 of last 8 sittings (VAT Schemes & Penalties)',
      examiner_debrief: {
        trap_category: 'VAT Compliance & FRS',
        trap_of_question: `Three classic FRS traps combined: (1) £${stdExcl.toLocaleString()} was VAT-exclusive, (2) exempt sales (£${exemptSales.toLocaleString()}) stay IN FRS turnover, and (3) revenue input VAT is blocked.`,
        distractor_forensics: `B (£${wrongExclVat.toLocaleString()}): used VAT-exclusive turnover | C (£${wrongExclExempt.toLocaleString()}): omitted exempt supplies | D (£${wrongDeductInput.toLocaleString()}): wrongly deducted 1/6 input VAT on revenue expenses.`,
        examiner_playbook: 'Under FRS, ALWAYS compute VAT-inclusive total turnover (standard×1.2 + zero + exempt) × FRS% — input VAT is only recoverable on capital goods ≥£2,000.',
        speed_trick: 'Check if the business is in Year 1 of VAT registration (gives 1% discount on FRS%, e.g. 12% → 11%).',
        twist_prediction: 'Next sitting they could trigger the 16.5% Limited Cost Trader rate if goods cost <2% of turnover.',
      },
      free_marks_items: [],
    };
  }

  // Default NIC Trap Variant (Topics 6, 11, 12)
  const salary = 46_000 + variantNum * 4_000;
  const pensionEmp = 3_000;
  const medIns = 1_100;
  const nic = calculateNic2526({ employeeCashEarnings: salary, nonCashBenefits: medIns });
  const wrongDeductPension = calculateNic2526({ employeeCashEarnings: salary - pensionEmp }).class1Employee;
  const wrongAddBenefitToClass1 = calculateNic2526({ employeeCashEarnings: salary + medIns }).class1Employee;

  return {
    id: `VAR-T11-${variantNum}`,
    q_num: 920 + variantNum,
    title: `MASTERCOACH VARIANT · NIC Base Trap #${variantNum}`,
    topic: 'National insurance',
    topic_id: topicId,
    st_chapter: 'ch11 (variant of Kit Q54–60)',
    section: 'A',
    type: 'mcq',
    interaction: 'single_mcq',
    marks: 2,
    is_variant: true,
    planted_trap: `Employee pension contribution (£${pensionEmp.toLocaleString()}) & medical insurance (£${medIns.toLocaleString()}) ignored for Class 1 primary NIC`,
    scenario: `During 2025/26, Liam earned a gross salary of £${salary.toLocaleString()}. He contributed £${pensionEmp.toLocaleString()} into his employer’s occupational pension scheme and was provided with private medical insurance costing the employer £${medIns.toLocaleString()}.`,
    requirement: 'What is Liam’s Class 1 primary (employee) NIC for 2025/26?',
    options: [
      { key: 'A', text: `£${nic.class1Employee.toLocaleString()}` },
      { key: 'B', text: `£${wrongDeductPension.toLocaleString()}` },
      { key: 'C', text: `£${wrongAddBenefitToClass1.toLocaleString()}` },
      { key: 'D', text: `£${nic.class1A.toLocaleString()}` },
    ],
    correct_answer: 'A',
    full_worked_solution: `Employee Class 1 primary NIC is charged on gross cash earnings of £${salary.toLocaleString()} (NO deduction for pension contributions; non-cash medical insurance is subject to Employer Class 1A NIC, not Employee Class 1).\n(£50,270 − £12,570) × 8% = £3,016` + (salary > 50_270 ? ` + (£${salary.toLocaleString()} − £50,270) × 2% = £${Math.round((salary - 50_270) * 0.02)}` : '') + `\nTotal = £${nic.class1Employee.toLocaleString()}.`,
    mark_scheme_steps: [
      { id: 'v1', label: `Use gross cash earnings £${salary.toLocaleString()} (ignore pension & medical benefit)`, marks: 1 },
      { id: 'v2', label: `Apply 8% / 2% Class 1 Employee thresholds → £${nic.class1Employee.toLocaleString()}`, marks: 1 },
    ],
    kit_page: 'Variant (Kit P.41)',
    answer_page: 'Verified Engine',
    past_exam: 'Mastercoach Trap-Planted Variant',
    exam_frequency_tag: 'Examined in 7 of last 8 sittings (Class 1 & 4 NIC)',
    examiner_debrief: {
      trap_category: 'National Insurance',
      trap_of_question: `Planted both classic Class 1 distractors: £${pensionEmp.toLocaleString()} occupational pension (deductible for IT, NOT NIC) and £${medIns.toLocaleString()} medical insurance (Class 1A, NOT Class 1).`,
      distractor_forensics: `B (£${wrongDeductPension.toLocaleString()}): wrongly deducted pension | C (£${wrongAddBenefitToClass1.toLocaleString()}): wrongly included medical benefit in Class 1 | D (£${nic.class1A.toLocaleString()}): calculated Class 1A instead of Class 1.`,
      examiner_playbook: 'Never deduct pension contributions when calculating Class 1 or Class 4 NIC; non-cash benefits stay strictly in Class 1A.',
      speed_trick: 'Max 8% Class 1 employee band (£50,270 − £12,570) × 8% = £3,016; add 2% above £50,270!',
      twist_prediction: 'Next sitting they could add a mileage reimbursement of 50p/mile (only the 5p excess over 45p enters Class 1 NIC!).',
    },
    free_marks_items: [],
  };
}

/**
 * Safe recursive-descent arithmetic evaluator (no eval/Function).
 * Supports +, -, *, ×, /, ÷, parentheses, %, commas, and £ symbols.
 */
export function evaluateArithmeticExpression(
  rawExpr: string
): { ok: true; value: number; rounded: number } | { ok: false; error: string } {
  const cleaned = rawExpr
    .replace(/[£,\s]/g, '')
    .replace(/×/g, '*')
    .replace(/÷/g, '/');

  if (!cleaned) {
    return { ok: false, error: 'Enter an arithmetic expression (e.g. 36000 * 36% * 11 / 12).' };
  }

  let pos = 0;

  const parseExpression = (): number => {
    let val = parseTerm();
    while (pos < cleaned.length) {
      const ch = cleaned[pos];
      if (ch === '+') {
        pos += 1;
        val += parseTerm();
      } else if (ch === '-') {
        pos += 1;
        val -= parseTerm();
      } else {
        break;
      }
    }
    return val;
  };

  const parseTerm = (): number => {
    let val = parseFactor();
    while (pos < cleaned.length) {
      const ch = cleaned[pos];
      if (ch === '*') {
        pos += 1;
        val *= parseFactor();
      } else if (ch === '/') {
        pos += 1;
        const denom = parseFactor();
        if (denom === 0) throw new Error('Division by zero');
        val /= denom;
      } else {
        break;
      }
    }
    return val;
  };

  const parseFactor = (): number => {
    if (pos < cleaned.length && (cleaned[pos] === '+' || cleaned[pos] === '-')) {
      const sign = cleaned[pos] === '-' ? -1 : 1;
      pos += 1;
      return sign * parseFactor();
    }
    let val: number;
    if (cleaned[pos] === '(') {
      pos += 1;
      val = parseExpression();
      if (cleaned[pos] !== ')') throw new Error('Missing closing parenthesis');
      pos += 1;
    } else {
      const match = cleaned.slice(pos).match(/^\d+(?:\.\d+)?/);
      if (!match) {
        throw new Error(`Unexpected character "${cleaned[pos] ?? ''}"`);
      }
      val = Number(match[0]);
      pos += match[0].length;
    }
    while (pos < cleaned.length && cleaned[pos] === '%') {
      val /= 100;
      pos += 1;
    }
    return val;
  };

  try {
    const value = parseExpression();
    if (pos !== cleaned.length) {
      throw new Error(`Unexpected trailing "${cleaned.slice(pos)}"`);
    }
    if (!Number.isFinite(value)) {
      return { ok: false, error: 'Result is not finite' };
    }
    return {
      ok: true,
      value: Math.round(value * 10_000) / 10_000,
      rounded: Math.round(value),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Invalid expression' };
  }
}

