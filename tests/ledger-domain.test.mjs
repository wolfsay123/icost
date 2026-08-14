import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultLedger } from "../src/ledger-schema.mjs";
import {
  advanceRecurringDate,
  calculateAccountBalances,
  calculateBookSummary,
  installmentAmount,
  validateTransaction,
} from "../src/ledger-domain.mjs";

test("周期日期按自然周月年推进并处理月末", () => {
  assert.equal(advanceRecurringDate("2026-08-11", "weekly"), "2026-08-18");
  assert.equal(advanceRecurringDate("2026-01-31", "monthly"), "2026-02-28");
  assert.equal(advanceRecurringDate("2024-02-29", "yearly"), "2025-02-28");
});

test("分期金额在最后一期吸收舍入差额", () => {
  assert.equal(installmentAmount(100, 3, 0), 33.33);
  assert.equal(installmentAmount(100, 3, 1), 33.33);
  assert.equal(installmentAmount(100, 3, 2), 33.34);
});

function transaction(id, type, amount, extras = {}) {
  return {
    id,
    type,
    amount,
    exchangeRate: 1,
    bookId: "book-default",
    accountId: "acc-cash",
    categoryId: "cat-other",
    date: "2026-08-11",
    status: "posted",
    ...extras,
  };
}

test("全部资金型交易按业务语义更新账户余额", () => {
  const state = createDefaultLedger();
  state.accounts.find((item) => item.id === "acc-cash").initialBalance = 100;
  state.transactions = [
    transaction("income", "income", 50),
    transaction("expense", "expense", 20),
    transaction("borrow", "borrow", 30),
    transaction("lend", "lend", 10),
    transaction("repayment", "repayment", 5),
    transaction("collection", "collection", 4),
    transaction("transfer", "transfer", 15, { targetAccountId: "acc-bank" }),
    transaction("payable", "payable", 999, { status: "pending" }),
  ];

  const balances = calculateAccountBalances(state);

  assert.equal(balances["acc-cash"], 134);
  assert.equal(balances["acc-bank"], 15);
});

test("账本汇总区分收支、借贷和待处理款项", () => {
  const state = createDefaultLedger();
  state.transactions = [
    transaction("income", "income", 100),
    transaction("expense", "expense", 40),
    transaction("borrow", "borrow", 25),
    transaction("lend", "lend", 10),
    transaction("repayment", "repayment", 5),
    transaction("collection", "collection", 2),
    transaction("payable", "payable", 8, { status: "pending" }),
    transaction("receivable", "receivable", 9, { status: "pending" }),
  ];

  assert.deepEqual(calculateBookSummary(state, {
    dateFrom: "2026-08-01",
    dateTo: "2026-08-31",
  }), {
    income: 100,
    expense: 40,
    balance: 60,
    borrowed: 25,
    lent: 10,
    repaid: 5,
    collected: 2,
    pendingPayable: 8,
    pendingReceivable: 9,
    count: 6,
  });
});

test("多币种账目和账户初始余额统一换算为本位币", () => {
  const state = createDefaultLedger();
  state.currencies.push({ code: "USD", name: "美元", symbol: "$", rate: 7.2 });
  state.accounts.find((item) => item.id === "acc-cash").currencyCode = "USD";
  state.accounts.find((item) => item.id === "acc-cash").initialBalance = 10;
  state.transactions = [
    transaction("usd-expense", "expense", 5, { currencyCode: "USD", exchangeRate: 7.2 }),
    transaction("usd-payable", "payable", 3, { currencyCode: "USD", exchangeRate: 7.2, status: "pending" }),
  ];

  assert.equal(calculateAccountBalances(state)["acc-cash"], 36);
  const summary = calculateBookSummary(state);
  assert.equal(summary.expense, 36);
  assert.equal(summary.pendingPayable, 21.6);
});

test("转账校验阻止同账户并要求有效账本", () => {
  const state = createDefaultLedger();
  const base = {
    type: "transfer",
    amount: 10,
    bookId: "book-default",
    accountId: "acc-cash",
    targetAccountId: "acc-cash",
    date: "2026-08-11",
  };

  assert.throws(() => validateTransaction(base, state), /不能相同/);
  assert.throws(() => validateTransaction({ ...base, bookId: "missing", targetAccountId: "acc-bank" }, state), /账本不存在/);
  assert.throws(() => validateTransaction({ ...base, targetAccountId: "acc-bank", exchangeRate: 0 }, state), /汇率/);
  assert.equal(validateTransaction({ ...base, targetAccountId: "acc-bank" }, state).amount, 10);
});
