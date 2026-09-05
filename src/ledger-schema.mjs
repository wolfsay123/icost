import { moneyFields, readMinor, toMinor } from "./money.mjs";

export const STORAGE_KEY = "zhiji.local.v1";
export const SCHEMA_VERSION = 6;
export const DEFAULT_BOOK_ID = "book-default";
export const DEFAULT_CURRENCY = "CNY";

export const TRANSACTION_TYPES = new Set([
  "expense",
  "income",
  "transfer",
  "borrow",
  "lend",
  "repayment",
  "collection",
  "payable",
  "receivable",
]);

export const DEFAULT_CATEGORIES = [
  { id: "cat-food", name: "餐饮", color: "#d87945", kind: "expense" },
  { id: "cat-transport", name: "交通", color: "#3f7d86", kind: "expense" },
  { id: "cat-shopping", name: "购物", color: "#9a5f7a", kind: "expense" },
  { id: "cat-home", name: "居住", color: "#6d7f4e", kind: "expense" },
  { id: "cat-phone", name: "通讯", color: "#5370a5", kind: "expense" },
  { id: "cat-health", name: "医疗", color: "#b75555", kind: "expense" },
  { id: "cat-study", name: "教育", color: "#7a66a5", kind: "expense" },
  { id: "cat-fun", name: "娱乐", color: "#c48a3d", kind: "expense" },
  { id: "cat-salary", name: "工资", color: "#237b66", kind: "income" },
  { id: "cat-bonus", name: "奖金", color: "#4d8f70", kind: "income" },
  { id: "cat-transfer", name: "转账", color: "#73807b", kind: "transfer" },
  { id: "cat-other", name: "其他", color: "#7e8581", kind: "expense" },
];

export const DEFAULT_ACCOUNTS = [
  { id: "acc-cash", name: "现金", type: "cash", initialBalance: 0 },
  { id: "acc-wechat", name: "微信", type: "wallet", initialBalance: 0 },
  { id: "acc-alipay", name: "支付宝", type: "wallet", initialBalance: 0 },
  { id: "acc-bank", name: "银行卡", type: "bank", initialBalance: 0 },
];

const ARRAY_COLLECTIONS = [
  "members",
  "tagGroups",
  "tags",
  "merchantGroups",
  "merchants",
  "budgets",
  "schedules",
  "installments",
  "templates",
  "importBatches",
  "recycleBin",
];

function validEntity(item) {
  return Boolean(item && typeof item === "object" && item.id);
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizedMoney(record, field, fallback = 0, minimumMinor = null) {
  const pair = moneyFields(record?.[field], record?.[`${field}Minor`], toMinor(fallback));
  if (minimumMinor != null && pair.minor < minimumMinor) {
    return { [field]: minimumMinor / 100, [`${field}Minor`]: minimumMinor };
  }
  return { [field]: pair.value, [`${field}Minor`]: pair.minor };
}

function normalizedAllocations(record) {
  const major = record?.allocations && typeof record.allocations === "object" ? record.allocations : {};
  const minor = record?.allocationsMinor && typeof record.allocationsMinor === "object" ? record.allocationsMinor : {};
  const ids = new Set([...Object.keys(major), ...Object.keys(minor)]);
  const pairs = [...ids].map((id) => [id, moneyFields(major[id], minor[id])]);
  return {
    allocations: Object.fromEntries(pairs.filter(([id, pair]) => id && pair.minor > 0).map(([id, pair]) => [id, pair.value])),
    allocationsMinor: Object.fromEntries(pairs.filter(([id, pair]) => id && pair.minor > 0).map(([id, pair]) => [id, pair.minor])),
  };
}

function categoryKind(item) {
  if (["expense", "income", "transfer"].includes(item.kind)) return item.kind;
  if (["工资", "奖金"].includes(item.name)) return "income";
  if (item.name === "转账") return "transfer";
  return "expense";
}

function accountType(item) {
  if (item.type) return item.type;
  if (["微信", "支付宝"].includes(item.name)) return "wallet";
  if (item.name.includes("银行")) return "bank";
  return "cash";
}

export function createDefaultLedger(now = new Date().toISOString()) {
  return {
    version: SCHEMA_VERSION,
    activeBookId: DEFAULT_BOOK_ID,
    baseCurrency: DEFAULT_CURRENCY,
    settings: {
      monthlyBudget: 5000,
      monthlyBudgetMinor: 500000,
      weekStartsOn: 1,
      monthStartsOn: 1,
      amountHidden: false,
    },
    books: [{
      id: DEFAULT_BOOK_ID,
      name: "我的账本",
      color: "#1f6650",
      icon: "ledger",
      monthlyBudget: 5000,
      monthlyBudgetMinor: 500000,
      hidden: false,
      order: 0,
      createdAt: now,
    }],
    categories: DEFAULT_CATEGORIES.map((item, order) => ({
      ...item,
      bookId: DEFAULT_BOOK_ID,
      parentId: null,
      order,
      hidden: false,
      deletedAt: null,
    })),
    accounts: DEFAULT_ACCOUNTS.map((item, order) => ({
      ...item,
      initialBalanceMinor: 0,
      bookIds: [DEFAULT_BOOK_ID],
      currencyCode: DEFAULT_CURRENCY,
      includeInNetAssets: true,
      hidden: false,
      order,
      credit: null,
      expiresAt: null,
      expiryReminderEnabled: false,
      balanceReminder: null,
      deletedAt: null,
    })),
    transactions: [],
    refunds: [],
    settlements: [],
    reimbursements: [],
    savingsPlans: [],
    members: [],
    tagGroups: [],
    tags: [],
    merchantGroups: [],
    merchants: [],
    budgets: [],
    schedules: [],
    installments: [],
    templates: [],
    importBatches: [],
    currencies: [{ code: DEFAULT_CURRENCY, name: "人民币", symbol: "¥", rate: 1 }],
    recycleBin: [],
    metadata: {
      createdAt: now,
      lastSavedAt: null,
      lastSyncedAt: null,
      dataUpdatedAt: now,
      revision: 0,
      deviceId: null,
      lastSyncedRevision: null,
      migratedFrom: null,
    },
  };
}

export function normalizeLedger(raw, now = new Date().toISOString()) {
  const fallback = createDefaultLedger(now);
  if (!raw || typeof raw !== "object") return fallback;

  const sourceVersion = finiteNumber(raw.version, 1);
  const books = Array.isArray(raw.books) && raw.books.some(validEntity)
      ? raw.books.filter(validEntity).map((book, order) => ({
        ...book,
        name: String(book.name || `账本 ${order + 1}`),
        ...normalizedMoney(book, "monthlyBudget", book.id === (raw.activeBookId || DEFAULT_BOOK_ID)
          ? raw.settings?.monthlyBudget
          : fallback.settings.monthlyBudget, 0),
        hidden: Boolean(book.hidden),
        order: finiteNumber(book.order, order),
        createdAt: book.createdAt || raw.metadata?.createdAt || now,
      }))
    : fallback.books.map((book) => ({
        ...book,
        ...normalizedMoney(raw.settings, "monthlyBudget", book.monthlyBudget, 0),
      }));
  const requestedBookId = raw.activeBookId || DEFAULT_BOOK_ID;
  const activeBookId = books.some((book) => book.id === requestedBookId) ? requestedBookId : books[0].id;

  const categories = Array.isArray(raw.categories)
    ? raw.categories.filter((item) => validEntity(item) && item.name).map((item, order) => ({
        ...item,
        name: String(item.name),
        color: item.color || "#7e8581",
        kind: categoryKind(item),
        bookId: item.bookId || activeBookId,
        parentId: item.parentId || null,
        order: finiteNumber(item.order, order),
        hidden: Boolean(item.hidden),
        deletedAt: item.deletedAt || null,
      }))
    : [];

  const accounts = Array.isArray(raw.accounts)
    ? raw.accounts.filter((item) => validEntity(item) && item.name).map((item, order) => ({
        ...item,
        name: String(item.name),
        type: accountType(item),
        ...normalizedMoney(item, "initialBalance"),
        bookIds: Array.isArray(item.bookIds) && item.bookIds.length
          ? [...new Set(item.bookIds.filter((bookId) => books.some((book) => book.id === bookId)))]
          : books.map((book) => book.id),
        currencyCode: item.currencyCode || raw.baseCurrency || DEFAULT_CURRENCY,
        includeInNetAssets: item.includeInNetAssets !== false,
        hidden: Boolean(item.hidden),
        order: finiteNumber(item.order, order),
        credit: item.credit && typeof item.credit === "object" ? {
          ...item.credit,
          ...normalizedMoney(item.credit, "limit", 0, 0),
          billingDay: item.credit.billingDay == null ? null : finiteNumber(item.credit.billingDay),
          billingDayInNextCycle: Boolean(item.credit.billingDayInNextCycle),
          repaymentType: item.credit.repaymentType === "delay" ? "delay" : "fixed",
          repaymentDay: item.credit.repaymentDay == null ? null : finiteNumber(item.credit.repaymentDay),
          repaymentDelayDays: item.credit.repaymentDelayDays == null
            ? null
            : Math.max(0, finiteNumber(item.credit.repaymentDelayDays)),
          sharedLimitAccountId: item.credit.sharedLimitAccountId || null,
          repaymentReminderDays: Array.isArray(item.credit.repaymentReminderDays)
            ? item.credit.repaymentReminderDays.filter((day) => Number.isInteger(day) && day >= 0)
            : [],
        } : null,
        expiresAt: item.expiresAt || null,
        expiryReminderEnabled: Boolean(item.expiryReminderEnabled),
        balanceReminder: item.balanceReminder && typeof item.balanceReminder === "object" ? {
          enabled: Boolean(item.balanceReminder.enabled),
          direction: item.balanceReminder.direction === "above" ? "above" : "below",
          ...normalizedMoney(item.balanceReminder, "amount", 0, 0),
        } : null,
        deletedAt: item.deletedAt || null,
      }))
    : [];

  const transactions = Array.isArray(raw.transactions)
    ? raw.transactions.filter((item) => (
        validEntity(item)
        && TRANSACTION_TYPES.has(item.type)
        && readMinor(item) > 0
        && item.accountId
        && item.date
      )).map((item) => ({
        ...item,
        bookId: item.bookId || activeBookId,
        ...normalizedMoney(item, "amount"),
        ...normalizedMoney(item, "originalAmount", moneyFields(item.amount, item.amountMinor).value),
        currencyCode: item.currencyCode || raw.baseCurrency || DEFAULT_CURRENCY,
        exchangeRate: finiteNumber(item.exchangeRate, 1) || 1,
        targetAccountId: item.targetAccountId || null,
        categoryId: item.categoryId || null,
        tagIds: Array.isArray(item.tagIds) ? item.tagIds : [],
        merchantId: item.merchantId || null,
        memberShares: Array.isArray(item.memberShares) ? item.memberShares.map((share) => ({
          ...share,
          ...normalizedMoney(share, "amount"),
        })) : [],
        time: item.time || "12:00",
        note: String(item.note || ""),
        status: item.status || "posted",
        reimburseStatus: item.reimburseStatus || "none",
        budgetIncluded: item.budgetIncluded !== false,
        photos: Array.isArray(item.photos) ? item.photos : [],
        location: item.location && typeof item.location === "object" ? item.location : null,
        linkedTransactionId: item.linkedTransactionId || null,
        relationGroupId: item.relationGroupId || null,
        reimbursementId: item.reimbursementId || null,
        savingsPlanId: item.savingsPlanId || null,
        savingsPlanPeriod: item.savingsPlanPeriod == null ? null : finiteNumber(item.savingsPlanPeriod),
        autoBookingCandidateId: item.autoBookingCandidateId || null,
        importBatchId: item.importBatchId || null,
        generatedBy: item.generatedBy && typeof item.generatedBy === "object" ? item.generatedBy : null,
        reconciled: Boolean(item.reconciled),
        deletedAt: item.deletedAt || null,
      }))
    : [];

  const refunds = Array.isArray(raw.refunds)
    ? raw.refunds.filter((item) => (
        validEntity(item)
        && item.transactionId
        && item.accountId
        && readMinor(item) > 0
        && item.date
      )).map((item) => ({
        ...item,
        ...normalizedMoney(item, "amount"),
        ...normalizedMoney(item, "accountAmount", moneyFields(item.amount, item.amountMinor).value),
        currencyCode: item.currencyCode || raw.baseCurrency || DEFAULT_CURRENCY,
        exchangeRate: finiteNumber(item.exchangeRate, 1) || 1,
        time: item.time || "12:00",
        note: String(item.note || ""),
        deletedAt: item.deletedAt || null,
      }))
    : [];

  const settlements = Array.isArray(raw.settlements)
    ? raw.settlements.filter((item) => (
        validEntity(item)
        && Array.isArray(item.sourceTransactionIds)
        && item.sourceTransactionIds.length
        && item.transactionId
        && readMinor(item) > 0
      )).map((item) => ({
        ...item,
        sourceTransactionIds: [...new Set(item.sourceTransactionIds.filter(Boolean))],
        ...normalizedMoney(item, "amount"),
        ...normalizedAllocations(item),
        deletedAt: item.deletedAt || null,
      }))
    : [];

  const reimbursements = Array.isArray(raw.reimbursements)
    ? raw.reimbursements.filter((item) => (
        validEntity(item)
        && Array.isArray(item.sourceTransactionIds)
        && item.sourceTransactionIds.length
        && item.transactionId
        && readMinor(item, "expectedAmount") > 0
        && readMinor(item, "actualAmount") > 0
      )).map((item) => ({
        ...item,
        sourceTransactionIds: [...new Set(item.sourceTransactionIds.filter(Boolean))],
        accountId: item.accountId || null,
        ...normalizedMoney(item, "expectedAmount"),
        ...normalizedMoney(item, "actualAmount"),
        ...normalizedMoney(item, "receiptAmount", moneyFields(item.expectedAmount, item.expectedAmountMinor).value),
        ...normalizedMoney(item, "differenceAmount", 0, 0),
        differenceType: ["income", "expense"].includes(item.differenceType) ? item.differenceType : null,
        differenceTransactionId: item.differenceTransactionId || null,
        ...normalizedAllocations(item),
        currencyCode: item.currencyCode || raw.baseCurrency || DEFAULT_CURRENCY,
        exchangeRate: finiteNumber(item.exchangeRate, 1) || 1,
        date: item.date || now.slice(0, 10),
        note: String(item.note || ""),
        deletedAt: item.deletedAt || null,
      }))
    : [];

  const savingsPlans = Array.isArray(raw.savingsPlans)
    ? raw.savingsPlans.filter((item) => (
        validEntity(item)
        && item.name
        && item.sourceAccountId
        && item.targetAccountId
        && item.startDate
        && finiteNumber(item.totalPeriods) > 0
        && readMinor(item, "startAmount") > 0
      )).map((item) => ({
        ...item,
        bookId: item.bookId || activeBookId,
        name: String(item.name),
        template: ["daily365", "weekly52", "monthlyFixed", "custom"].includes(item.template) ? item.template : "custom",
        sourceAccountId: item.sourceAccountId,
        targetAccountId: item.targetAccountId,
        currencyCode: item.currencyCode || raw.baseCurrency || DEFAULT_CURRENCY,
        startDate: item.startDate,
        frequency: ["daily", "weekly", "monthly"].includes(item.frequency) ? item.frequency : "monthly",
        totalPeriods: Math.min(1000, Math.max(1, Math.trunc(finiteNumber(item.totalPeriods, 1)))),
        ...normalizedMoney(item, "startAmount", 0.01, 1),
        ...normalizedMoney(item, "incrementAmount", 0, 0),
        ...normalizedMoney(item, "targetAmount", moneyFields(item.startAmount, item.startAmountMinor, 1).value, 1),
        status: item.status === "paused" ? "paused" : "active",
        deletedAt: item.deletedAt || null,
        createdAt: item.createdAt || now,
      }))
    : [];

  if (sourceVersion < 4) {
    const migratedSourceIds = new Set(reimbursements.flatMap((item) => item.sourceTransactionIds));
    transactions.filter((item) => (
      item.type === "expense"
      && item.reimburseStatus === "reimbursed"
      && item.linkedTransactionId
      && !migratedSourceIds.has(item.id)
    )).forEach((source) => {
      const receipt = transactions.find((item) => item.id === source.linkedTransactionId && item.type === "income");
      if (!receipt) return;
      const id = `reimbursement-migrated-${source.id}`;
      const expectedAmount = finiteNumber(source.amount);
      const actualAmount = finiteNumber(receipt.amount, expectedAmount);
      const difference = actualAmount - expectedAmount;
      reimbursements.push({
        id,
        sourceTransactionIds: [source.id],
        accountId: receipt.accountId,
        expectedAmount,
        actualAmount,
        receiptAmount: expectedAmount,
        differenceAmount: Math.abs(difference),
        differenceType: difference > 0 ? "income" : difference < 0 ? "expense" : null,
        transactionId: receipt.id,
        differenceTransactionId: null,
        allocations: { [source.id]: expectedAmount },
        currencyCode: receipt.currencyCode,
        exchangeRate: receipt.exchangeRate,
        date: receipt.date,
        note: receipt.note,
        deletedAt: null,
        createdAt: receipt.createdAt || now,
      });
      source.reimbursementId = id;
      source.relationGroupId = id;
      receipt.reimbursementId = id;
      receipt.relationGroupId = id;
      receipt.generatedBy = { kind: "reimbursement", reimbursementId: id };
      migratedSourceIds.add(source.id);
    });
  }

  const monthlyBudget = moneyFields(raw.settings?.monthlyBudget, raw.settings?.monthlyBudgetMinor, fallback.settings.monthlyBudgetMinor);
  const state = {
    ...fallback,
    version: SCHEMA_VERSION,
    activeBookId,
    baseCurrency: raw.baseCurrency || DEFAULT_CURRENCY,
    settings: {
      ...fallback.settings,
      ...(raw.settings && typeof raw.settings === "object" ? raw.settings : {}),
      monthlyBudget: monthlyBudget.minor >= 0 ? monthlyBudget.value : fallback.settings.monthlyBudget,
      monthlyBudgetMinor: monthlyBudget.minor >= 0 ? monthlyBudget.minor : fallback.settings.monthlyBudgetMinor,
    },
    books,
    categories: categories.length ? categories : fallback.categories,
    accounts: accounts.length ? accounts : fallback.accounts,
    transactions,
    refunds,
    settlements,
    reimbursements,
    savingsPlans,
    currencies: Array.isArray(raw.currencies) && raw.currencies.length
      ? raw.currencies.filter((item) => item && item.code).map((item) => ({
          ...item,
          rate: finiteNumber(item.rate, 1) || 1,
        }))
      : fallback.currencies,
    metadata: {
      ...fallback.metadata,
      ...(raw.metadata && typeof raw.metadata === "object" ? raw.metadata : {}),
      migratedFrom: sourceVersion < SCHEMA_VERSION ? sourceVersion : raw.metadata?.migratedFrom || null,
    },
  };

  ARRAY_COLLECTIONS.forEach((name) => {
    state[name] = Array.isArray(raw[name]) ? raw[name].filter(validEntity) : fallback[name];
  });
  state.budgets = state.budgets.map((item) => ({
    ...item,
    ...(item.kind === "goal" ? {
      ...normalizedMoney(item, "targetAmount", 0, 0),
      ...normalizedMoney(item, "currentAmount", 0, 0),
    } : normalizedMoney(item, "amount", 0, 0)),
  }));
  state.schedules = state.schedules.map((item) => ({ ...item, ...normalizedMoney(item, "amount", 0, 0) }));
  state.installments = state.installments.map((item) => ({ ...item, ...normalizedMoney(item, "totalAmount", 0, 0) }));
  state.templates = state.templates.map((item) => ({
    ...item,
    values: item.values && typeof item.values === "object" ? {
      ...item.values,
      ...normalizedMoney(item.values, "amount"),
      ...normalizedMoney(item.values, "originalAmount", moneyFields(item.values.amount, item.values.amountMinor).value),
    } : item.values,
  }));
  return state;
}
