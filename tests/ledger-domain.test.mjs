import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultLedger } from "../src/ledger-schema.mjs";
import {
  advanceRecurringDate,
  accountAvailableInBook,
  calculateAccountBalances,
  calculateBookSummary,
  calculateCreditAvailableLimit,
  calculateCreditStatementSummary,
  creditInterestFreeDays,
  creditRepaymentDate,
  creditStatementDateForPurchase,
  installmentAmount,
  refundedAmount,
  remainingSettlementAmount,
  validateRefund,
  validateReimbursement,
  savingsPlanPreset,
  savingsPlanProgress,
  validateSettlement,
  validateSavingsPlan,
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

test("存钱计划模板生成固定且可复核的总金额", () => {
  assert.deepEqual(savingsPlanPreset("daily365"), {
    name: "365天存钱计划",
    frequency: "daily",
    totalPeriods: 365,
    startAmount: 1,
    incrementAmount: 1,
  });
  assert.equal(savingsPlanPreset("weekly52").totalPeriods, 52);

  const state = createDefaultLedger();
  const daily = validateSavingsPlan({
    template: "daily365",
    bookId: "book-default",
    sourceAccountId: "acc-cash",
    targetAccountId: "acc-bank",
    startDate: "2026-08-18",
  }, state);
  const weekly = validateSavingsPlan({
    template: "weekly52",
    bookId: "book-default",
    sourceAccountId: "acc-cash",
    targetAccountId: "acc-bank",
    startDate: "2026-08-18",
  }, state);

  assert.equal(daily.targetAmount, 66795);
  assert.equal(weekly.targetAmount, 13780);
  assert.throws(() => validateSavingsPlan({
    template: "custom",
    bookId: "book-default",
    sourceAccountId: "acc-cash",
    targetAccountId: "acc-cash",
    startDate: "2026-08-18",
    frequency: "monthly",
    totalPeriods: 12,
    startAmount: 100,
    incrementAmount: 0,
  }, state), /不能相同/);
});

test("存钱计划由真实转账反算进度并从缺失期继续", () => {
  const state = createDefaultLedger();
  const plan = {
    id: "saving-1",
    ...validateSavingsPlan({
      template: "custom",
      name: "三期测试",
      bookId: "book-default",
      sourceAccountId: "acc-cash",
      targetAccountId: "acc-bank",
      startDate: "2026-08-18",
      frequency: "daily",
      totalPeriods: 3,
      startAmount: 10,
      incrementAmount: 5,
    }, state),
  };
  state.savingsPlans.push(plan);
  state.transactions = [
    transaction("saving-period-1", "transfer", 10, { targetAccountId: "acc-bank", savingsPlanId: plan.id, savingsPlanPeriod: 1 }),
    transaction("saving-period-3", "transfer", 20, { targetAccountId: "acc-bank", savingsPlanId: plan.id, savingsPlanPeriod: 3 }),
  ];

  assert.deepEqual(savingsPlanProgress(state, plan), {
    completedPeriods: 2,
    savedAmount: 30,
    targetAmount: 45,
    percentage: 67,
    nextPeriod: 2,
    nextAmount: 15,
    nextDate: "2026-08-19",
    complete: false,
  });
  state.transactions.find((item) => item.savingsPlanPeriod === 1).deletedAt = "2026-08-20T00:00:00.000Z";
  assert.equal(savingsPlanProgress(state, plan).nextPeriod, 1);
  assert.equal(savingsPlanProgress(state, plan).savedAmount, 20);
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

test("账户适用账本同时约束付款账户和转入账户", () => {
  const state = createDefaultLedger();
  state.books.push({ id: "book-trip", name: "旅行", monthlyBudget: 0 });
  state.accounts.find((item) => item.id === "acc-cash").bookIds = ["book-default"];
  state.accounts.find((item) => item.id === "acc-bank").bookIds = ["book-trip"];

  assert.equal(accountAvailableInBook(state.accounts[0], "book-default"), true);
  assert.equal(accountAvailableInBook(state.accounts[0], "book-trip"), false);
  assert.throws(() => validateTransaction({
    type: "expense",
    amount: 10,
    bookId: "book-trip",
    accountId: "acc-cash",
    date: "2026-08-11",
  }, state), /不可用于当前账本/);
});

test("部分退款累计不能超过原明细并冲减余额与收支", () => {
  const state = createDefaultLedger();
  state.accounts.find((item) => item.id === "acc-cash").initialBalance = 100;
  state.transactions = [transaction("expense", "expense", 80)];
  state.refunds = [{
    id: "refund-1",
    transactionId: "expense",
    accountId: "acc-cash",
    amount: 30,
    accountAmount: 30,
    exchangeRate: 1,
    date: "2026-08-12",
  }];

  assert.equal(refundedAmount(state, "expense"), 30);
  assert.equal(calculateAccountBalances(state)["acc-cash"], 50);
  assert.equal(calculateBookSummary(state).expense, 50);
  assert.throws(() => validateRefund({
    transactionId: "expense",
    accountId: "acc-cash",
    amount: 51,
    date: "2026-08-13",
  }, state), /不能超过/);
  assert.equal(validateRefund({
    transactionId: "expense",
    accountId: "acc-cash",
    amount: 50,
    date: "2026-08-13",
  }, state).accountAmount, 50);
  assert.equal(validateRefund({
    refundId: "refund-1",
    transactionId: "expense",
    accountId: "acc-cash",
    amount: 80,
    date: "2026-08-13",
  }, state).amount, 80);
  assert.throws(() => validateRefund({
    refundId: "refund-1",
    transactionId: "expense",
    accountId: "acc-cash",
    amount: 81,
    date: "2026-08-13",
  }, state), /不能超过/);
});

test("跨币种退款分别使用原明细和退款账户汇率", () => {
  const state = createDefaultLedger();
  state.currencies.push({ code: "USD", name: "美元", symbol: "$", rate: 7.2 });
  state.transactions = [transaction("usd-expense", "expense", 10, {
    currencyCode: "USD",
    exchangeRate: 7.2,
  })];
  const refund = validateRefund({
    transactionId: "usd-expense",
    accountId: "acc-bank",
    amount: 5,
    accountAmount: 36,
    date: "2026-08-13",
  }, state);
  state.refunds = [{ id: "refund-usd", ...refund }];

  assert.equal(refund.currencyCode, "CNY");
  assert.equal(refund.exchangeRate, 1);
  assert.equal(calculateAccountBalances(state)["acc-bank"], 36);
  assert.equal(calculateBookSummary(state).expense, 36);
});

test("应收应付支持部分与合并结算并拒绝超额和混合类型", () => {
  const state = createDefaultLedger();
  state.transactions = [
    transaction("receivable-1", "receivable", 80, { status: "pending" }),
    transaction("receivable-2", "receivable", 20, { status: "pending" }),
    transaction("payable-1", "payable", 30, { status: "pending" }),
  ];
  state.settlements = [{
    id: "settlement-old",
    sourceTransactionIds: ["receivable-1"],
    transactionId: "income-old",
    amount: 30,
    allocations: { "receivable-1": 30 },
  }];

  assert.equal(remainingSettlementAmount(state, "receivable-1"), 50);
  const result = validateSettlement({
    sourceTransactionIds: ["receivable-1", "receivable-2"],
    accountId: "acc-cash",
    amount: 70,
  }, state);
  assert.equal(result.transactionType, "income");
  assert.equal(result.amount, 70);
  assert.deepEqual(result.allocations, { "receivable-1": 50, "receivable-2": 20 });
  assert.throws(() => validateSettlement({
    sourceTransactionIds: ["receivable-1", "payable-1"],
    accountId: "acc-cash",
    amount: 10,
  }, state), /不能合并/);
  assert.throws(() => validateSettlement({
    sourceTransactionIds: ["receivable-1"],
    accountId: "acc-cash",
    amount: 51,
  }, state), /不能超过/);

  state.transactions[1].currencyCode = "USD";
  assert.throws(() => validateSettlement({
    sourceTransactionIds: ["receivable-1", "receivable-2"],
    accountId: "acc-cash",
    amount: 60,
  }, state), /不同币种/);
});

test("信用卡账单日当天规则和固定或间隔还款日可独立配置", () => {
  const fixed = { billingDay: 5, billingDayInNextCycle: false, repaymentType: "fixed", repaymentDay: 20 };
  assert.equal(creditStatementDateForPurchase("2026-08-04", fixed), "2026-08-05");
  assert.equal(creditStatementDateForPurchase("2026-08-05", fixed), "2026-08-05");
  assert.equal(creditStatementDateForPurchase("2026-08-06", fixed), "2026-09-05");
  assert.equal(creditStatementDateForPurchase("2026-08-05", { ...fixed, billingDayInNextCycle: true }), "2026-09-05");
  assert.equal(creditRepaymentDate("2026-08-05", fixed), "2026-08-20");
  assert.equal(creditRepaymentDate("2026-08-25", { ...fixed, repaymentDay: 10 }), "2026-09-10");
  assert.equal(creditRepaymentDate("2026-08-05", { ...fixed, repaymentType: "delay", repaymentDelayDays: 20 }), "2026-08-25");
  assert.equal(creditInterestFreeDays("2026-08-06", fixed), 45);
});

test("信用账户以负净资产计入余额并汇总共享可用额度", () => {
  const state = createDefaultLedger();
  state.accounts.push({
    id: "credit-main",
    name: "主卡",
    type: "credit",
    initialBalance: 1000,
    currencyCode: "CNY",
    bookIds: ["book-default"],
    credit: { limit: 10000 },
  }, {
    id: "credit-sub",
    name: "副卡",
    type: "credit",
    initialBalance: 500,
    currencyCode: "CNY",
    bookIds: ["book-default"],
    credit: { limit: 0, sharedLimitAccountId: "credit-main" },
  });
  state.transactions = [
    transaction("credit-expense", "expense", 200, { accountId: "credit-main" }),
    transaction("credit-refund-source", "expense", 100, { accountId: "credit-sub" }),
    transaction("credit-repay", "transfer", 300, { accountId: "acc-bank", targetAccountId: "credit-main" }),
  ];
  state.refunds = [{
    id: "credit-refund",
    transactionId: "credit-refund-source",
    accountId: "credit-sub",
    amount: 50,
    accountAmount: 50,
    exchangeRate: 1,
    date: "2026-08-12",
  }];

  const balances = calculateAccountBalances(state);
  assert.equal(balances["credit-main"], -900);
  assert.equal(balances["credit-sub"], -550);
  assert.deepEqual(calculateCreditAvailableLimit(state, "credit-sub"), {
    rootAccountId: "credit-main",
    limit: 10000,
    debt: 1450,
    available: 8550,
  });
});

test("信用账单按周期区分出账额、应还额、跨期退款和溢缴款", () => {
  const state = createDefaultLedger();
  state.accounts.push({
    id: "credit-card",
    name: "信用卡",
    type: "credit",
    initialBalance: 0,
    currencyCode: "CNY",
    bookIds: ["book-default"],
    credit: {
      limit: 10000,
      billingDay: 5,
      billingDayInNextCycle: false,
      repaymentType: "fixed",
      repaymentDay: 20,
    },
  });
  state.transactions = [
    transaction("aug-expense", "expense", 100, { accountId: "credit-card", date: "2026-08-01" }),
    transaction("aug-cashout", "transfer", 20, { accountId: "credit-card", targetAccountId: "acc-bank", date: "2026-08-04" }),
    transaction("aug-income", "income", 10, { accountId: "credit-card", date: "2026-08-06" }),
    transaction("sep-expense", "expense", 50, { accountId: "credit-card", date: "2026-08-06" }),
    transaction("aug-payment", "transfer", 90, { accountId: "acc-bank", targetAccountId: "credit-card", date: "2026-08-10" }),
  ];
  state.refunds = [{
    id: "same-cycle-refund",
    transactionId: "aug-expense",
    accountId: "credit-card",
    amount: 20,
    accountAmount: 20,
    exchangeRate: 1,
    date: "2026-08-04",
  }, {
    id: "late-refund",
    transactionId: "aug-expense",
    accountId: "credit-card",
    amount: 30,
    accountAmount: 30,
    exchangeRate: 1,
    date: "2026-08-20",
  }];

  const summary = calculateCreditStatementSummary(state, "credit-card", "2026-09-06");
  assert.equal(summary.currentDue, 20);
  assert.equal(summary.unbilledAmount, 0);
  assert.equal(summary.overpayment, 0);
  assert.equal(summary.totalDebt, 20);
  assert.deepEqual(summary.statements.map((item) => ({
    statementDate: item.statementDate,
    statementAmount: item.statementAmount,
    incomeCredit: item.incomeCredit,
    overpaymentApplied: item.overpaymentApplied,
    issuedDue: item.issuedDue,
    remainingDue: item.remainingDue,
  })), [{
    statementDate: "2026-08-05",
    statementAmount: 100,
    incomeCredit: 10,
    overpaymentApplied: 0,
    issuedDue: 100,
    remainingDue: 0,
  }, {
    statementDate: "2026-09-05",
    statementAmount: 50,
    incomeCredit: 0,
    overpaymentApplied: 30,
    issuedDue: 20,
    remainingDue: 20,
  }]);
});

test("严格报销只把到账差额计入普通收支", () => {
  const state = createDefaultLedger();
  state.accounts.find((item) => item.id === "acc-cash").initialBalance = 200;
  state.transactions = [
    transaction("reimburse-1", "expense", 100, { reimburseStatus: "pending" }),
    transaction("reimburse-2", "expense", 50, { reimburseStatus: "pending" }),
  ];

  const values = validateReimbursement({
    sourceTransactionIds: ["reimburse-1", "reimburse-2"],
    accountId: "acc-cash",
    actualAmount: 170,
    date: "2026-08-15",
  }, state);
  assert.equal(values.expectedAmount, 150);
  assert.equal(values.receiptAmount, 150);
  assert.equal(values.differenceType, "income");
  assert.equal(values.differenceAmount, 20);

  state.transactions.forEach((item) => {
    item.reimburseStatus = "reimbursed";
    item.reimbursementId = "reimbursement-1";
  });
  state.reimbursements = [{
    id: "reimbursement-1",
    ...values,
    transactionId: "reimbursement-receipt",
    differenceTransactionId: "reimbursement-difference",
  }];
  state.transactions.push(
    transaction("reimbursement-receipt", "income", 150, {
      generatedBy: { kind: "reimbursement", reimbursementId: "reimbursement-1" },
      reimbursementId: "reimbursement-1",
    }),
    transaction("reimbursement-difference", "income", 20, {
      generatedBy: { kind: "reimbursement-difference", reimbursementId: "reimbursement-1" },
      reimbursementId: "reimbursement-1",
    }),
  );

  assert.deepEqual(calculateBookSummary(state), {
    income: 20,
    expense: 0,
    balance: 20,
    borrowed: 0,
    lent: 0,
    repaid: 0,
    collected: 0,
    pendingPayable: 0,
    pendingReceivable: 0,
    count: 4,
  });
  assert.equal(calculateAccountBalances(state)["acc-cash"], 220);

  const short = validateReimbursement({
    sourceTransactionIds: ["reimburse-1", "reimburse-2"],
    accountId: "acc-cash",
    actualAmount: 130,
    date: "2026-08-15",
  }, {
    ...state,
    transactions: state.transactions.slice(0, 2).map((item) => ({ ...item, reimburseStatus: "pending", reimbursementId: null })),
  });
  assert.equal(short.differenceType, "expense");
  assert.equal(short.differenceAmount, 20);
});
