/**
 * Run with `npm test`.
 *
 * A payoff calculator is only worth reading if its numbers match a bank's. The
 * first cases check a textbook loan against its known schedule; the rest check
 * the promises the page makes: extra money pays off sooner, the strategies aim
 * where they say, and a debt that cannot be paid off is reported, not hidden.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  baseline,
  byYear,
  DEFAULT_OPTIONS,
  HORIZON,
  paymentFor,
  simulate,
  targetOrder,
  underwater,
  type Debt,
} from "./payoff.ts";

const loan = (id: string, balance: number, apr: number, minPayment: number): Debt => ({
  id,
  name: id,
  balance,
  apr,
  minPayment,
});

test("a fixed rate loan clears on its term at the textbook payment", () => {
  // $200,000 at 6% over 30 years is $1,199.10 a month.
  assert.equal(paymentFor(200_000, 6, 360), 1199.11);
  const plan = simulate([loan("home", 200_000, 6, 1199.11)]);
  assert.equal(plan.months, 360);
  assert.equal(plan.rows[0].interest, 1000);
  assert.equal(plan.rows[0].principal, 199.11);
  // Total interest is about $231,676; cent rounding each month moves it a little.
  assert.ok(Math.abs(plan.interest - 231_676) < 50, `interest ${plan.interest}`);
});

test("the schedule adds up: payments are principal plus interest, to the cent", () => {
  const plan = simulate([loan("a", 12_345.67, 7.9, 250), loan("b", 3_000, 22.9, 90)], {
    ...DEFAULT_OPTIONS,
    extraMonthly: 137.5,
  });
  assert.ok(plan.months !== null);
  const paid = plan.rows.reduce((s, r) => s + Math.round(r.payment * 100), 0) / 100;
  assert.equal(paid, plan.paid);
  assert.equal(Math.round((plan.startingBalance + plan.interest) * 100), Math.round(plan.paid * 100));
  assert.equal(plan.rows.at(-1)?.balance, 0);
});

test("extra money pays off sooner and costs less", () => {
  const debts = [loan("car", 18_500, 7.9, 420), loan("card", 4_200, 22.9, 120)];
  const min = baseline(debts);
  const more = simulate(debts, { ...DEFAULT_OPTIONS, extraMonthly: 200 });
  assert.ok(more.months! < min.months!);
  assert.ok(more.interest < min.interest);
});

test("a one time payment lands in the month it is set for", () => {
  const plan = simulate([loan("a", 10_000, 5, 200)], { ...DEFAULT_OPTIONS, lumpSum: 1_000, lumpSumMonth: 3 });
  assert.equal(plan.rows[1].payment, 200);
  assert.equal(plan.rows[2].payment, 1_200);
});

test("avalanche aims at the highest rate, snowball at the smallest balance", () => {
  const debts = [loan("big-high", 9_000, 24, 100), loan("small-low", 1_000, 4, 50), loan("mid", 5_000, 12, 80)];
  assert.deepEqual(targetOrder(debts, "avalanche"), [0, 2, 1]);
  assert.deepEqual(targetOrder(debts, "snowball"), [1, 2, 0]);
  assert.deepEqual(targetOrder(debts, "listed"), [0, 1, 2]);

  const avalanche = simulate(debts, { ...DEFAULT_OPTIONS, extraMonthly: 300 });
  const snowball = simulate(debts, { ...DEFAULT_OPTIONS, extraMonthly: 300, strategy: "snowball" });
  assert.ok(avalanche.interest <= snowball.interest, "avalanche never pays more interest");
  assert.ok(snowball.debts[1].payoffMonth! < avalanche.debts[1].payoffMonth!, "snowball clears the small one first");
});

test("rollover keeps a paid off minimum working", () => {
  const debts = [loan("a", 1_000, 10, 200), loan("b", 10_000, 10, 200)];
  const on = simulate(debts, DEFAULT_OPTIONS);
  const off = simulate(debts, { ...DEFAULT_OPTIONS, rollover: false });
  assert.ok(on.months! < off.months!);
  // The month after the first one clears, the second gets both minimums.
  const cleared = on.debts[0].payoffMonth!;
  assert.equal(on.rows[cleared].payment, 400);
});

test("a minimum that does not cover the interest is flagged and never finishes", () => {
  const debts = [loan("stuck", 10_000, 24, 150), loan("fine", 1_000, 5, 100)];
  assert.deepEqual(underwater(debts), ["stuck"]);
  const plan = baseline(debts);
  assert.equal(plan.months, null);
  assert.equal(plan.rows.length, HORIZON);
  assert.equal(plan.debts[0].payoffMonth, null);
  assert.ok(plan.debts[1].payoffMonth! > 0);
});

test("zero balances and nonsense inputs do not break the run", () => {
  const plan = simulate([loan("done", 0, 5, 100), loan("a", 500, Number.NaN, 100)]);
  assert.equal(plan.debts[0].payoffMonth, 0);
  assert.equal(plan.months, 5);
  assert.equal(simulate([]).months, 0);
});

test("years roll up twelve months at a time", () => {
  const plan = simulate([loan("a", 5_000, 6, 150)]);
  const years = byYear(plan.rows);
  assert.equal(years.length, Math.ceil(plan.rows.length / 12));
  assert.equal(years[0].balance, plan.rows[11].balance);
  const total = years.reduce((s, y) => s + Math.round(y.interest * 100), 0) / 100;
  assert.equal(total, plan.interest);
});
