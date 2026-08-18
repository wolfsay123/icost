const MONEY_SCALE = 100;

export function roundMoney(value) {
  return Math.round((Number(value) || 0) * MONEY_SCALE) / MONEY_SCALE;
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) throw new Error("日期无效");
  return { year, month, day };
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function clampedDate(year, month, day) {
  const normalized = new Date(Date.UTC(year, month - 1, 1));
  const targetYear = normalized.getUTCFullYear();
  const targetMonth = normalized.getUTCMonth() + 1;
  return `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(Math.min(day, daysInMonth(targetYear, targetMonth))).padStart(2, "0")}`;
}

export function creditStatementDateForPurchase(value, credit) {
  const { year, month, day } = parseDate(value);
  const billingDay = Number(credit?.billingDay);
  if (!Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31) throw new Error("账单日无效");
  const currentBillingDay = Math.min(billingDay, daysInMonth(year, month));
  const movesToNextMonth = day > currentBillingDay || (day === currentBillingDay && credit.billingDayInNextCycle);
  return movesToNextMonth
    ? clampedDate(year, month + 1, billingDay)
    : clampedDate(year, month, billingDay);
}

export function creditRepaymentDate(statementDate, credit) {
  const { year, month, day } = parseDate(statementDate);
  if (credit?.repaymentType === "delay") {
    const delay = Number(credit.repaymentDelayDays);
    if (!Number.isInteger(delay) || delay < 0) throw new Error("还款间隔无效");
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + delay);
    return date.toISOString().slice(0, 10);
  }
  const repaymentDay = Number(credit?.repaymentDay);
  if (!Number.isInteger(repaymentDay) || repaymentDay < 1 || repaymentDay > 31) throw new Error("还款日无效");
  return repaymentDay > day
    ? clampedDate(year, month, repaymentDay)
    : clampedDate(year, month + 1, repaymentDay);
}

export function creditInterestFreeDays(purchaseDate, credit) {
  const statementDate = creditStatementDateForPurchase(purchaseDate, credit);
  const repaymentDate = creditRepaymentDate(statementDate, credit);
  const start = Date.parse(`${purchaseDate}T00:00:00Z`);
  const end = Date.parse(`${repaymentDate}T00:00:00Z`);
  return Math.round((end - start) / 86400000);
}

export function advanceRecurringDate(value, frequency) {
  const [year, month, day] = String(value).split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) throw new Error("周期日期无效");
  const date = new Date(year, month - 1, day);
  if (frequency === "daily") date.setDate(date.getDate() + 1);
  else if (frequency === "weekly") date.setDate(date.getDate() + 7);
  else if (frequency === "monthly") {
    const lastDay = new Date(year, month + 1, 0).getDate();
    date.setFullYear(year, month, Math.min(day, lastDay));
  } else if (frequency === "yearly") {
    const lastDay = new Date(year + 1, month, 0).getDate();
    date.setFullYear(year + 1, month - 1, Math.min(day, lastDay));
  } else {
    throw new Error("不支持的周期频率");
  }
  return formatLocalDate(date);
}

const SAVINGS_PLAN_PRESETS = {
  daily365: {
    name: "365天存钱计划",
    frequency: "daily",
    totalPeriods: 365,
    startAmount: 1,
    incrementAmount: 1,
  },
  weekly52: {
    name: "52周存钱计划",
    frequency: "weekly",
    totalPeriods: 52,
    startAmount: 10,
    incrementAmount: 10,
  },
  monthlyFixed: {
    name: "每月定额存钱计划",
    frequency: "monthly",
    totalPeriods: 12,
    startAmount: 1000,
    incrementAmount: 0,
  },
  custom: {
    name: "自定义存钱计划",
    frequency: "monthly",
    totalPeriods: 12,
    startAmount: 500,
    incrementAmount: 0,
  },
};

export function savingsPlanPreset(template) {
  const preset = SAVINGS_PLAN_PRESETS[template];
  if (!preset) throw new Error("存钱计划模板无效");
  return { ...preset };
}

function savingsPlanDateAt(startDate, frequency, offset) {
  const { year, month, day } = parseDate(startDate);
  if (frequency === "monthly") return clampedDate(year, month + offset, day);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + offset * (frequency === "weekly" ? 7 : 1));
  return date.toISOString().slice(0, 10);
}

export function savingsPlanAmount(plan, period) {
  const number = Number(period);
  const totalPeriods = Number(plan?.totalPeriods);
  if (!Number.isInteger(number) || number < 1 || number > totalPeriods) throw new Error("存钱计划期次无效");
  return roundMoney(Number(plan.startAmount) + Number(plan.incrementAmount || 0) * (number - 1));
}

export function validateSavingsPlan(input, state) {
  const preset = savingsPlanPreset(input.template || "custom");
  const fixedPreset = ["daily365", "weekly52"].includes(input.template);
  const frequency = fixedPreset ? preset.frequency : input.frequency || preset.frequency;
  const totalPeriods = Number(fixedPreset ? preset.totalPeriods : input.totalPeriods ?? preset.totalPeriods);
  const startAmount = roundMoney(fixedPreset ? preset.startAmount : input.startAmount ?? preset.startAmount);
  const incrementAmount = roundMoney(fixedPreset ? preset.incrementAmount : input.incrementAmount ?? preset.incrementAmount);
  if (!["daily", "weekly", "monthly"].includes(frequency)) throw new Error("存钱周期无效");
  if (!Number.isInteger(totalPeriods) || totalPeriods < 1 || totalPeriods > 1000) throw new Error("存钱期数必须为 1 到 1000");
  if (startAmount <= 0) throw new Error("首期金额必须大于 0");
  if (incrementAmount < 0) throw new Error("递增金额不能小于 0");
  if (!input.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) throw new Error("请选择有效开始日期");
  if (!state.books.some((item) => item.id === input.bookId && !item.hidden)) throw new Error("账本不存在或已隐藏");
  const source = state.accounts.find((item) => item.id === input.sourceAccountId);
  const target = state.accounts.find((item) => item.id === input.targetAccountId);
  if (!accountAvailableInBook(source, input.bookId) || !accountAvailableInBook(target, input.bookId)) {
    throw new Error("存钱账户不可用于当前账本");
  }
  if (source.id === target.id) throw new Error("转出账户和存款账户不能相同");
  if (source.currencyCode !== target.currencyCode) throw new Error("存钱计划暂只支持同币种账户");
  const targetAmount = roundMoney(totalPeriods * (startAmount * 2 + (totalPeriods - 1) * incrementAmount) / 2);
  return {
    template: input.template || "custom",
    bookId: input.bookId,
    name: String(input.name || preset.name).trim() || preset.name,
    sourceAccountId: source.id,
    targetAccountId: target.id,
    currencyCode: source.currencyCode,
    startDate: input.startDate,
    frequency,
    totalPeriods,
    startAmount,
    incrementAmount,
    targetAmount,
    status: input.status === "paused" ? "paused" : "active",
  };
}

export function savingsPlanProgress(state, plan) {
  const completed = new Map();
  state.transactions.filter((item) => (
    !item.deletedAt
    && item.status !== "pending"
    && item.type === "transfer"
    && item.savingsPlanId === plan.id
    && Number.isInteger(Number(item.savingsPlanPeriod))
    && Number(item.savingsPlanPeriod) >= 1
    && Number(item.savingsPlanPeriod) <= Number(plan.totalPeriods)
  )).forEach((item) => {
    const period = Number(item.savingsPlanPeriod);
    if (!completed.has(period)) completed.set(period, item);
  });
  let nextPeriod = null;
  for (let period = 1; period <= Number(plan.totalPeriods); period += 1) {
    if (!completed.has(period)) {
      nextPeriod = period;
      break;
    }
  }
  const savedAmount = roundMoney([...completed.values()].reduce((sum, item) => sum + Number(item.amount || 0), 0));
  const targetAmount = roundMoney(plan.targetAmount);
  return {
    completedPeriods: completed.size,
    savedAmount,
    targetAmount,
    percentage: targetAmount > 0 ? Math.min(100, Math.round(savedAmount / targetAmount * 100)) : 0,
    nextPeriod,
    nextAmount: nextPeriod ? savingsPlanAmount(plan, nextPeriod) : 0,
    nextDate: nextPeriod ? savingsPlanDateAt(plan.startDate, plan.frequency, nextPeriod - 1) : null,
    complete: nextPeriod === null,
  };
}

export function installmentAmount(totalAmount, periods, paidPeriods) {
  const total = roundMoney(totalAmount);
  const count = Number(periods);
  const paid = Number(paidPeriods);
  if (total <= 0 || !Number.isInteger(count) || count < 2) throw new Error("分期参数无效");
  if (!Number.isInteger(paid) || paid < 0 || paid >= count) throw new Error("分期期数已完成或无效");
  const regular = roundMoney(total / count);
  return paid === count - 1 ? roundMoney(total - regular * (count - 1)) : regular;
}

export function activeTransactions(state, bookId = state.activeBookId) {
  return state.transactions.filter((item) => item.bookId === bookId && !item.deletedAt);
}

export function accountAvailableInBook(account, bookId) {
  return Boolean(
    account
    && !account.deletedAt
    && (!Array.isArray(account.bookIds) || account.bookIds.length === 0 || account.bookIds.includes(bookId)),
  );
}

export function activeRefunds(state, transactionId = null) {
  return (state.refunds || []).filter((item) => (
    !item.deletedAt && (!transactionId || item.transactionId === transactionId)
  ));
}

export function refundedAmount(state, transactionId) {
  return roundMoney(activeRefunds(state, transactionId)
    .reduce((total, item) => total + Number(item.amount || 0), 0));
}

export function validateRefund(input, state) {
  const transaction = state.transactions.find((item) => item.id === input.transactionId && !item.deletedAt);
  if (!transaction) throw new Error("原明细不存在");
  if (!["expense", "income"].includes(transaction.type)) throw new Error("仅收支明细支持退款");
  const amount = roundMoney(input.amount);
  if (amount <= 0) throw new Error("退款金额必须大于 0");
  const editingRefund = input.refundId
    ? activeRefunds(state, transaction.id).find((item) => item.id === input.refundId)
    : null;
  const existingAmount = roundMoney(refundedAmount(state, transaction.id) - Number(editingRefund?.amount || 0));
  if (roundMoney(existingAmount + amount) > roundMoney(transaction.amount)) {
    throw new Error("累计退款金额不能超过原明细金额");
  }
  const account = state.accounts.find((item) => item.id === input.accountId);
  if (!accountAvailableInBook(account, transaction.bookId)) throw new Error("退款账户不可用于当前账本");
  const accountAmount = roundMoney(input.accountAmount ?? amount);
  if (accountAmount <= 0) throw new Error("退款折合金额必须大于 0");
  const accountCurrencyCode = input.currencyCode || account.currencyCode || transaction.currencyCode;
  const accountExchangeRate = Number(input.exchangeRate ?? state.currencies.find((item) => item.code === accountCurrencyCode)?.rate ?? 1);
  if (!(accountExchangeRate > 0)) throw new Error("退款账户汇率必须大于 0");
  const result = {
    ...input,
    amount,
    accountAmount,
    currencyCode: accountCurrencyCode,
    exchangeRate: accountExchangeRate,
  };
  delete result.refundId;
  return result;
}

export function settledAmount(state, transactionId) {
  return roundMoney((state.settlements || [])
    .filter((item) => !item.deletedAt && item.sourceTransactionIds?.includes(transactionId))
    .reduce((total, item) => {
      const fallback = item.sourceTransactionIds.length === 1 ? item.amount : 0;
      return total + Number(item.allocations?.[transactionId] ?? fallback ?? 0);
    }, 0));
}

export function remainingSettlementAmount(state, transactionId) {
  const transaction = state.transactions.find((item) => item.id === transactionId && !item.deletedAt);
  if (!transaction || !["payable", "receivable"].includes(transaction.type)) return 0;
  return roundMoney(Math.max(0, transaction.amount - settledAmount(state, transactionId)));
}

export function validateSettlement(input, state) {
  const sourceTransactionIds = [...new Set((input.sourceTransactionIds || []).filter(Boolean))];
  if (!sourceTransactionIds.length) throw new Error("请选择应收或应付明细");
  const sources = sourceTransactionIds.map((id) => state.transactions.find((item) => item.id === id && !item.deletedAt));
  if (sources.some((item) => !item || !["payable", "receivable"].includes(item.type))) {
    throw new Error("结算来源无效");
  }
  const type = sources[0].type;
  if (sources.some((item) => item.type !== type)) throw new Error("应收和应付不能合并结算");
  const bookId = sources[0].bookId;
  if (sources.some((item) => item.bookId !== bookId)) throw new Error("不同账本不能合并结算");
  const currencyCode = sources[0].currencyCode;
  const exchangeRate = Number(sources[0].exchangeRate || 1);
  if (sources.some((item) => item.currencyCode !== currencyCode || Number(item.exchangeRate || 1) !== exchangeRate)) {
    throw new Error("不同币种或汇率的明细不能合并结算");
  }
  const amount = roundMoney(input.amount);
  const remaining = roundMoney(sourceTransactionIds
    .reduce((total, id) => total + remainingSettlementAmount(state, id), 0));
  if (amount <= 0) throw new Error("结算金额必须大于 0");
  if (amount > remaining) throw new Error("结算金额不能超过待结算金额");
  const account = state.accounts.find((item) => item.id === input.accountId);
  if (!accountAvailableInBook(account, bookId)) throw new Error("结算账户不可用于当前账本");
  let amountLeft = amount;
  const allocations = {};
  sourceTransactionIds.forEach((id) => {
    const allocation = roundMoney(Math.min(amountLeft, remainingSettlementAmount(state, id)));
    if (allocation > 0) allocations[id] = allocation;
    amountLeft = roundMoney(amountLeft - allocation);
  });
  return {
    ...input,
    sourceTransactionIds,
    bookId,
    currencyCode,
    exchangeRate,
    amount,
    allocations,
    transactionType: type === "payable" ? "expense" : "income",
  };
}

export function calculateAccountBalances(state, bookId = null) {
  const currencyRates = Object.fromEntries((state.currencies || []).map((currency) => [currency.code, currency.rate || 1]));
  const balances = Object.fromEntries(state.accounts
    .filter((account) => !account.deletedAt)
    .map((account) => {
      const initial = roundMoney(account.initialBalance * (currencyRates[account.currencyCode] || 1));
      return [account.id, account.type === "credit" ? -initial : initial];
    }));
  const transactions = state.transactions.filter((item) => (
    !item.deletedAt
    && item.status !== "pending"
    && (!bookId || item.bookId === bookId)
  ));

  transactions.forEach((transaction) => {
    const amount = roundMoney(transaction.amount * (transaction.exchangeRate || 1));
    if (!(transaction.accountId in balances)) return;

    if (["income", "borrow", "collection"].includes(transaction.type)) {
      balances[transaction.accountId] = roundMoney(balances[transaction.accountId] + amount);
    }
    if (["expense", "lend", "repayment"].includes(transaction.type)) {
      balances[transaction.accountId] = roundMoney(balances[transaction.accountId] - amount);
    }
    if (transaction.type === "transfer") {
      balances[transaction.accountId] = roundMoney(balances[transaction.accountId] - amount);
      if (transaction.targetAccountId in balances) {
        balances[transaction.targetAccountId] = roundMoney(balances[transaction.targetAccountId] + amount);
      }
    }
  });

  activeRefunds(state).forEach((refund) => {
    const transaction = state.transactions.find((item) => item.id === refund.transactionId && !item.deletedAt);
    if (!transaction || (bookId && transaction.bookId !== bookId) || !(refund.accountId in balances)) return;
    const accountAmount = roundMoney(refund.accountAmount * (refund.exchangeRate || 1));
    if (transaction.type === "expense") {
      balances[refund.accountId] = roundMoney(balances[refund.accountId] + accountAmount);
    }
    if (transaction.type === "income") {
      balances[refund.accountId] = roundMoney(balances[refund.accountId] - accountAmount);
    }
  });
  return balances;
}

export function calculateCreditAvailableLimit(state, accountId) {
  const account = state.accounts.find((item) => item.id === accountId && item.type === "credit" && !item.deletedAt);
  if (!account) throw new Error("信用账户不存在");
  const rootId = account.credit?.sharedLimitAccountId || account.id;
  const root = state.accounts.find((item) => item.id === rootId && item.type === "credit" && !item.deletedAt);
  if (!root) throw new Error("共享额度主账户不存在");
  const group = state.accounts.filter((item) => (
    !item.deletedAt
    && item.type === "credit"
    && (item.id === root.id || item.credit?.sharedLimitAccountId === root.id)
  ));
  if (group.some((item) => item.currencyCode !== root.currencyCode)) throw new Error("共享额度账户币种必须一致");
  const rate = state.currencies.find((item) => item.code === root.currencyCode)?.rate || 1;
  const balances = calculateAccountBalances(state);
  const debt = roundMoney(group.reduce((total, item) => total + Math.max(0, -(balances[item.id] || 0) / rate), 0));
  const limit = roundMoney(root.credit?.limit || 0);
  return {
    rootAccountId: root.id,
    limit,
    debt,
    available: roundMoney(limit - debt),
  };
}

function amountInAccountCurrency(state, transaction, account) {
  const accountRate = state.currencies.find((item) => item.code === account.currencyCode)?.rate || 1;
  return roundMoney(transaction.amount * (transaction.exchangeRate || 1) / accountRate);
}

export function calculateCreditStatementSummary(state, accountId, asOfDate = formatLocalDate(new Date())) {
  const account = state.accounts.find((item) => item.id === accountId && item.type === "credit" && !item.deletedAt);
  if (!account) throw new Error("信用账户不存在");
  if (!account.credit?.billingDay) throw new Error("请先设置账单日");
  const statementsByDate = new Map();
  const statementFor = (date) => {
    if (!statementsByDate.has(date)) {
      statementsByDate.set(date, {
        statementDate: date,
        repaymentDate: creditRepaymentDate(date, account.credit),
        grossAmount: 0,
        sameCycleRefund: 0,
        statementAmount: 0,
        incomeCredit: 0,
        overpaymentApplied: 0,
        issuedDue: 0,
        repaymentApplied: 0,
        lateRefundApplied: 0,
        remainingDue: 0,
      });
    }
    return statementsByDate.get(date);
  };
  const transactions = state.transactions.filter((item) => (
    !item.deletedAt && item.status !== "pending" && item.date <= asOfDate
  ));

  transactions.forEach((transaction) => {
    const isCharge = transaction.accountId === accountId
      && (transaction.type === "expense" || transaction.type === "transfer");
    if (!isCharge) return;
    const statement = statementFor(creditStatementDateForPurchase(transaction.date, account.credit));
    const amount = amountInAccountCurrency(state, transaction, account);
    statement.grossAmount = roundMoney(statement.grossAmount + amount);
  });

  const creditEvents = [];
  transactions.filter((item) => item.accountId === accountId && item.type === "income").forEach((transaction) => {
    creditEvents.push({
      date: transaction.date,
      amount: amountInAccountCurrency(state, transaction, account),
      kind: "income",
    });
  });
  activeRefunds(state).filter((refund) => refund.date <= asOfDate && refund.accountId === accountId).forEach((refund) => {
    const source = transactions.find((item) => item.id === refund.transactionId && item.type === "expense" && item.accountId === accountId);
    if (!source) return;
    const sourceStatementDate = creditStatementDateForPurchase(source.date, account.credit);
    const refundStatementDate = creditStatementDateForPurchase(refund.date, account.credit);
    const amount = roundMoney(refund.accountAmount);
    if (sourceStatementDate === refundStatementDate) {
      const statement = statementFor(sourceStatementDate);
      statement.sameCycleRefund = roundMoney(statement.sameCycleRefund + amount);
    } else {
      creditEvents.push({ date: refund.date, amount, kind: "late-refund" });
    }
  });

  transactions.filter((item) => item.type === "transfer" && item.targetAccountId === accountId).forEach((transaction) => {
    creditEvents.push({
      date: transaction.date,
      amount: amountInAccountCurrency(state, transaction, account),
      kind: "repayment",
    });
  });

  const statements = [...statementsByDate.values()].sort((a, b) => a.statementDate.localeCompare(b.statementDate));
  statements.forEach((statement) => {
    statement.statementAmount = roundMoney(Math.max(0, statement.grossAmount - statement.sameCycleRefund));
  });
  const events = [
    ...statements.filter((item) => item.statementDate <= asOfDate).map((statement) => ({
      date: statement.statementDate,
      kind: "statement",
      statement,
      priority: 0,
    })),
    ...creditEvents.map((event) => ({ ...event, priority: 1 })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.priority - b.priority);

  let overpayment = 0;
  events.forEach((event) => {
    if (event.kind === "statement") {
      const statement = event.statement;
      const dueBeforeOverpayment = statement.statementAmount;
      statement.overpaymentApplied = roundMoney(Math.min(overpayment, dueBeforeOverpayment));
      overpayment = roundMoney(overpayment - statement.overpaymentApplied);
      statement.issuedDue = roundMoney(dueBeforeOverpayment - statement.overpaymentApplied);
      statement.remainingDue = statement.issuedDue;
      return;
    }

    let remainingCredit = event.amount;
    statements.filter((item) => item.statementDate <= event.date && item.remainingDue > 0).forEach((statement) => {
      if (remainingCredit <= 0) return;
      const applied = roundMoney(Math.min(remainingCredit, statement.remainingDue));
      statement.remainingDue = roundMoney(statement.remainingDue - applied);
      if (event.kind === "repayment") statement.repaymentApplied = roundMoney(statement.repaymentApplied + applied);
      if (event.kind === "late-refund") statement.lateRefundApplied = roundMoney(statement.lateRefundApplied + applied);
      if (event.kind === "income") statement.incomeCredit = roundMoney(statement.incomeCredit + applied);
      remainingCredit = roundMoney(remainingCredit - applied);
    });
    overpayment = roundMoney(overpayment + remainingCredit);
  });

  const accountRate = state.currencies.find((item) => item.code === account.currencyCode)?.rate || 1;
  const balance = calculateAccountBalances(state)[accountId] || 0;
  const issued = statements.filter((item) => item.statementDate <= asOfDate);
  const unissued = statements.filter((item) => item.statementDate > asOfDate);
  const currentDue = roundMoney(issued.reduce((total, item) => total + item.remainingDue, 0));
  const unbilledAmount = roundMoney(unissued.reduce((total, item) => total + item.statementAmount, 0));
  const totalDebt = roundMoney(Math.max(0, -balance / accountRate));
  return {
    accountId,
    asOfDate,
    statements,
    currentDue,
    unbilledAmount,
    overpayment,
    totalDebt,
    untrackedDebt: roundMoney(Math.max(0, totalDebt - currentDue - unbilledAmount)),
  };
}

export function validateReimbursement(input, state) {
  const sourceTransactionIds = [...new Set((input.sourceTransactionIds || []).filter(Boolean))];
  if (!sourceTransactionIds.length) throw new Error("请选择待报销明细");
  const sources = sourceTransactionIds.map((id) => state.transactions.find((item) => item.id === id && !item.deletedAt));
  if (sources.some((item) => !item || item.type !== "expense" || item.reimburseStatus !== "pending" || item.reimbursementId)) {
    throw new Error("待报销明细无效或已经报销");
  }
  const bookId = sources[0].bookId;
  if (sources.some((item) => item.bookId !== bookId)) throw new Error("不同账本不能合并报销");
  const currencyCode = sources[0].currencyCode;
  const exchangeRate = Number(sources[0].exchangeRate || 1);
  if (sources.some((item) => item.currencyCode !== currencyCode || Number(item.exchangeRate || 1) !== exchangeRate)) {
    throw new Error("不同币种或汇率的明细不能合并报销");
  }
  const account = state.accounts.find((item) => item.id === input.accountId);
  if (!accountAvailableInBook(account, bookId)) throw new Error("报销到账账户不可用于当前账本");
  const expectedAmount = roundMoney(sources.reduce((total, item) => total + item.amount, 0));
  const actualAmount = roundMoney(input.actualAmount);
  if (actualAmount <= 0) throw new Error("实际到账金额必须大于 0");
  const difference = roundMoney(actualAmount - expectedAmount);
  return {
    ...input,
    sourceTransactionIds,
    bookId,
    expectedAmount,
    actualAmount,
    receiptAmount: expectedAmount,
    differenceAmount: Math.abs(difference),
    differenceType: difference > 0 ? "income" : difference < 0 ? "expense" : null,
    allocations: Object.fromEntries(sources.map((item) => [item.id, roundMoney(item.amount)])),
    currencyCode,
    exchangeRate,
  };
}

export function transactionIncludedInOrdinaryStats(transaction) {
  if (transaction.type === "expense" && ["pending", "reimbursed"].includes(transaction.reimburseStatus)) return false;
  if (transaction.generatedBy?.kind === "reimbursement") return false;
  return true;
}

export function calculateBookSummary(state, options = {}) {
  const bookId = options.bookId || state.activeBookId;
  const dateFrom = options.dateFrom || "0000-01-01";
  const dateTo = options.dateTo || "9999-12-31";
  const transactions = activeTransactions(state, bookId).filter((item) => (
    item.date >= dateFrom && item.date <= dateTo && item.status !== "pending"
  ));
  const sum = (type) => roundMoney(transactions
    .filter((item) => item.type === type && transactionIncludedInOrdinaryStats(item))
    .reduce((total, item) => total + item.amount * (item.exchangeRate || 1), 0));

  const refundSum = (type) => roundMoney(activeRefunds(state)
    .filter((refund) => refund.date >= dateFrom && refund.date <= dateTo)
    .reduce((total, refund) => {
      const transaction = activeTransactions(state, bookId).find((item) => (
        item.id === refund.transactionId && item.type === type && transactionIncludedInOrdinaryStats(item)
      ));
      return transaction ? total + refund.amount * (transaction.exchangeRate || 1) : total;
    }, 0));
  const income = roundMoney(sum("income") - refundSum("income"));
  const expense = roundMoney(sum("expense") - refundSum("expense"));
  return {
    income,
    expense,
    balance: roundMoney(income - expense),
    borrowed: sum("borrow"),
    lent: sum("lend"),
    repaid: sum("repayment"),
    collected: sum("collection"),
    pendingPayable: roundMoney(activeTransactions(state, bookId)
      .filter((item) => item.type === "payable" && item.status === "pending")
      .reduce((total, item) => total + item.amount * (item.exchangeRate || 1), 0)),
    pendingReceivable: roundMoney(activeTransactions(state, bookId)
      .filter((item) => item.type === "receivable" && item.status === "pending")
      .reduce((total, item) => total + item.amount * (item.exchangeRate || 1), 0)),
    count: transactions.length,
  };
}

export function validateTransaction(input, state) {
  const amount = roundMoney(input.amount);
  if (amount <= 0) throw new Error("金额必须大于 0");
  const exchangeRate = Number(input.exchangeRate ?? 1);
  if (!(exchangeRate > 0)) throw new Error("汇率必须大于 0");
  if (!state.books.some((item) => item.id === input.bookId && !item.hidden)) throw new Error("账本不存在或已隐藏");
  const account = state.accounts.find((item) => item.id === input.accountId);
  if (!accountAvailableInBook(account, input.bookId)) throw new Error("账户不存在或不可用于当前账本");
  if (input.type === "transfer") {
    if (!input.targetAccountId) throw new Error("请选择转入账户");
    if (input.targetAccountId === input.accountId) throw new Error("转出账户和转入账户不能相同");
    const targetAccount = state.accounts.find((item) => item.id === input.targetAccountId);
    if (!accountAvailableInBook(targetAccount, input.bookId)) throw new Error("转入账户不可用于当前账本");
  }
  if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("请选择有效日期");
  return { ...input, amount, exchangeRate };
}
