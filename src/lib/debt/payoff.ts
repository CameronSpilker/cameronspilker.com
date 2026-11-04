/**
 * Debt payoff, month by month.
 *
 * Pure and framework-free so it can be tested with `node --test`. Every amount
 * is held in whole cents: a schedule that runs for thirty years adds up three
 * hundred and sixty roundings, and floats drift enough over that to leave a
 * last payment of $0.0000003.
 */

export type Debt = {
  id: string;
  name: string;
  /** Current balance, in dollars. */
  balance: number;
  /** Annual percentage rate, as a percent: 6.5 means 6.5%. */
  apr: number;
  /** The required monthly payment, in dollars. */
  minPayment: number;
};

/**
 * Where money beyond the minimums goes.
 *
 * - avalanche: highest rate first, which pays the least interest
 * - snowball: smallest balance first, which clears whole debts soonest
 * - listed: the order the debts are in, for when the reader knows better
 */
export type Strategy = "avalanche" | "snowball" | "listed";

export type PlanOptions = {
  strategy: Strategy;
  /** Paid every month on top of the minimums, in dollars. */
  extraMonthly: number;
  /** A single extra payment, in dollars, made in `lumpSumMonth`. */
  lumpSum: number;
  /** 1 is the first month of the plan. */
  lumpSumMonth: number;
  /**
   * When a debt is paid off, keep paying its minimum toward the next one. This
   * is what makes a snowball roll; turning it off shows how much it matters.
   */
  rollover: boolean;
};

export type DebtMonth = {
  payment: number;
  interest: number;
  principal: number;
  balance: number;
};

export type MonthRow = {
  /** 1 is the first month of the plan. */
  month: number;
  /** One entry per debt, in input order. Zero rows once a debt is paid. */
  debts: DebtMonth[];
  payment: number;
  interest: number;
  principal: number;
  balance: number;
};

export type DebtResult = {
  id: string;
  /** Month it reached zero (0 if it started there), or null if it never does inside the horizon. */
  payoffMonth: number | null;
  interest: number;
  paid: number;
};

export type Plan = {
  rows: MonthRow[];
  debts: DebtResult[];
  /** Month the last debt reached zero, or null if any never does. */
  months: number | null;
  interest: number;
  paid: number;
  startingBalance: number;
};

/** Fifty years. Past that, a debt is not being paid off, it is being serviced. */
export const HORIZON = 600;

export const DEFAULT_OPTIONS: PlanOptions = {
  strategy: "avalanche",
  extraMonthly: 0,
  lumpSum: 0,
  lumpSumMonth: 1,
  rollover: true,
};

const cents = (dollars: number) => Math.max(0, Math.round((Number.isFinite(dollars) ? dollars : 0) * 100));
const dollars = (c: number) => c / 100;

/** The order extra money is aimed in. Ties keep the listed order. */
export function targetOrder(debts: Debt[], strategy: Strategy): number[] {
  const index = debts.map((_, i) => i);
  if (strategy === "listed") return index;
  return index.sort((a, b) => {
    const diff =
      strategy === "avalanche" ? debts[b].apr - debts[a].apr : debts[a].balance - debts[b].balance;
    return Number.isFinite(diff) && diff !== 0 ? diff : a - b;
  });
}

/** The interest a balance accrues in one month, in cents. */
export function monthlyInterest(balanceCents: number, apr: number): number {
  const rate = Number.isFinite(apr) && apr > 0 ? apr : 0;
  return Math.round((balanceCents * rate) / 1200);
}

/**
 * Run the plan to the end, or to the horizon.
 *
 * Each month: every open debt accrues a month of interest, every open debt gets
 * its minimum (or what is left of it), then whatever the budget has over goes
 * to the debts in strategy order until it runs out.
 */
export function simulate(input: Debt[], options: PlanOptions = DEFAULT_OPTIONS): Plan {
  const debts = input;
  const order = targetOrder(debts, options.strategy);
  const balance = debts.map((d) => cents(d.balance));
  const mins = debts.map((d) => cents(d.minPayment));
  const interestTotal = debts.map(() => 0);
  const paidTotal = debts.map(() => 0);
  const payoff: (number | null)[] = balance.map((b) => (b === 0 ? 0 : null));
  const extra = cents(options.extraMonthly);
  const lump = cents(options.lumpSum);
  const startingBalance = balance.reduce((a, b) => a + b, 0);
  // Only a debt that is being paid has a minimum to roll over.
  const allMins = mins.reduce((sum, m, i) => sum + (balance[i] > 0 ? m : 0), 0);

  const rows: MonthRow[] = [];

  for (let month = 1; month <= HORIZON && balance.some((b) => b > 0); month++) {
    const rowDebts: DebtMonth[] = debts.map(() => ({ payment: 0, interest: 0, principal: 0, balance: 0 }));

    // Interest first, on what was owed coming into the month.
    for (let i = 0; i < debts.length; i++) {
      if (balance[i] === 0) continue;
      const interest = monthlyInterest(balance[i], debts[i].apr);
      balance[i] += interest;
      rowDebts[i].interest = interest;
    }

    const openMins = mins.reduce((sum, m, i) => sum + (balance[i] > 0 ? m : 0), 0);
    let budget = (options.rollover ? allMins : openMins) + extra + (month === options.lumpSumMonth ? lump : 0);

    const pay = (i: number, amount: number) => {
      const take = Math.min(amount, balance[i], budget);
      balance[i] -= take;
      budget -= take;
      rowDebts[i].payment += take;
    };

    for (let i = 0; i < debts.length; i++) if (balance[i] > 0) pay(i, mins[i]);
    for (const i of order) {
      if (budget === 0) break;
      if (balance[i] > 0) pay(i, budget);
    }

    let row = { payment: 0, interest: 0, principal: 0, balance: 0 };
    for (let i = 0; i < debts.length; i++) {
      const d = rowDebts[i];
      d.principal = d.payment - d.interest;
      d.balance = balance[i];
      interestTotal[i] += d.interest;
      paidTotal[i] += d.payment;
      if (balance[i] === 0 && payoff[i] === null && d.payment > 0) payoff[i] = month;
      row = {
        payment: row.payment + d.payment,
        interest: row.interest + d.interest,
        principal: row.principal + d.principal,
        balance: row.balance + d.balance,
      };
    }

    rows.push({
      month,
      debts: rowDebts.map((d) => ({
        payment: dollars(d.payment),
        interest: dollars(d.interest),
        principal: dollars(d.principal),
        balance: dollars(d.balance),
      })),
      payment: dollars(row.payment),
      interest: dollars(row.interest),
      principal: dollars(row.principal),
      balance: dollars(row.balance),
    });
  }

  const done = balance.every((b) => b === 0);
  return {
    rows,
    debts: debts.map((d, i) => ({
      id: d.id,
      payoffMonth: payoff[i],
      interest: dollars(interestTotal[i]),
      paid: dollars(paidTotal[i]),
    })),
    months: done ? rows.length : null,
    interest: dollars(interestTotal.reduce((a, b) => a + b, 0)),
    paid: dollars(paidTotal.reduce((a, b) => a + b, 0)),
    startingBalance: dollars(startingBalance),
  };
}

/** The same debts on minimums alone: what the plan is measured against. */
export function baseline(debts: Debt[]): Plan {
  return simulate(debts, { ...DEFAULT_OPTIONS, rollover: false });
}

/** Debts whose minimum does not cover their first month of interest. */
export function underwater(debts: Debt[]): string[] {
  return debts
    .filter((d) => cents(d.balance) > 0 && cents(d.minPayment) <= monthlyInterest(cents(d.balance), d.apr))
    .map((d) => d.id);
}

/**
 * The fixed monthly payment that clears a loan in `months`, in dollars,
 * rounded up to the cent. For filling in a payment the reader does not know.
 */
export function paymentFor(balance: number, apr: number, months: number): number {
  if (balance <= 0 || months <= 0) return 0;
  const r = apr / 1200;
  const raw = r === 0 ? balance / months : (balance * r) / (1 - Math.pow(1 + r, -months));
  return Math.ceil(raw * 100) / 100;
}

/** Roll monthly rows up into plan years: 12 months each, the last one partial. */
export function byYear(rows: MonthRow[]): MonthRow[] {
  const years: MonthRow[] = [];
  for (let start = 0; start < rows.length; start += 12) {
    const chunk = rows.slice(start, start + 12);
    const last = chunk[chunk.length - 1];
    const sum = (pick: (r: MonthRow) => number) =>
      Math.round(chunk.reduce((a, r) => a + pick(r) * 100, 0)) / 100;
    years.push({
      month: start / 12 + 1,
      debts: last.debts.map((_, i) => ({
        payment: sum((r) => r.debts[i].payment),
        interest: sum((r) => r.debts[i].interest),
        principal: sum((r) => r.debts[i].principal),
        balance: last.debts[i].balance,
      })),
      payment: sum((r) => r.payment),
      interest: sum((r) => r.interest),
      principal: sum((r) => r.principal),
      balance: last.balance,
    });
  }
  return years;
}
