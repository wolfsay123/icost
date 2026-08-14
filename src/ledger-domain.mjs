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

export function advanceRecurringDate(value, frequency) {
  const [year, month, day] = String(value).split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) throw new Error("周期日期无效");
  const date = new Date(year, month - 1, day);
  if (frequency === "weekly") date.setDate(date.getDate() + 7);
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

export function calculateAccountBalances(state, bookId = null) {
  const currencyRates = Object.fromEntries((state.currencies || []).map((currency) => [currency.code, currency.rate || 1]));
  const balances = Object.fromEntries(state.accounts
    .filter((account) => !account.deletedAt)
    .map((account) => [account.id, roundMoney(account.initialBalance * (currencyRates[account.currencyCode] || 1))]));
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
  return balances;
}

export function calculateBookSummary(state, options = {}) {
  const bookId = options.bookId || state.activeBookId;
  const dateFrom = options.dateFrom || "0000-01-01";
  const dateTo = options.dateTo || "9999-12-31";
  const transactions = activeTransactions(state, bookId).filter((item) => (
    item.date >= dateFrom && item.date <= dateTo && item.status !== "pending"
  ));
  const sum = (type) => roundMoney(transactions
    .filter((item) => item.type === type)
    .reduce((total, item) => total + item.amount * (item.exchangeRate || 1), 0));

  const income = sum("income");
  const expense = sum("expense");
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
  if (!state.accounts.some((item) => item.id === input.accountId && !item.deletedAt)) throw new Error("账户不存在");
  if (input.type === "transfer") {
    if (!input.targetAccountId) throw new Error("请选择转入账户");
    if (input.targetAccountId === input.accountId) throw new Error("转出账户和转入账户不能相同");
  }
  if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("请选择有效日期");
  return { ...input, amount, exchangeRate };
}
