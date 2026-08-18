export const STORAGE_KEY = "zhiji.local.v1";
export const SCHEMA_VERSION = 5;
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
        monthlyBudget: Math.max(0, finiteNumber(
          book.monthlyBudget,
          book.id === (raw.activeBookId || DEFAULT_BOOK_ID)
            ? raw.settings?.monthlyBudget
            : fallback.settings.monthlyBudget,
        )),
        hidden: Boolean(book.hidden),
        order: finiteNumber(book.order, order),
        createdAt: book.createdAt || raw.metadata?.createdAt || now,
      }))
    : fallback.books.map((book) => ({
        ...book,
        monthlyBudget: Math.max(0, finiteNumber(raw.settings?.monthlyBudget, book.monthlyBudget)),
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
        initialBalance: finiteNumber(item.initialBalance),
        bookIds: Array.isArray(item.bookIds) && item.bookIds.length
          ? [...new Set(item.bookIds.filter((bookId) => books.some((book) => book.id === bookId)))]
          : books.map((book) => book.id),
        currencyCode: item.currencyCode || raw.baseCurrency || DEFAULT_CURRENCY,
        includeInNetAssets: item.includeInNetAssets !== false,
        hidden: Boolean(item.hidden),
        order: finiteNumber(item.order, order),
        credit: item.credit && typeof item.credit === "object" ? {
          ...item.credit,
          limit: Math.max(0, finiteNumber(item.credit.limit)),
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
          amount: Math.max(0, finiteNumber(item.balanceReminder.amount)),
        } : null,
        deletedAt: item.deletedAt || null,
      }))
    : [];

  const transactions = Array.isArray(raw.transactions)
    ? raw.transactions.filter((item) => (
        validEntity(item)
        && TRANSACTION_TYPES.has(item.type)
        && finiteNumber(item.amount) > 0
        && item.accountId
        && item.date
      )).map((item) => ({
        ...item,
        bookId: item.bookId || activeBookId,
        amount: finiteNumber(item.amount),
        originalAmount: finiteNumber(item.originalAmount, finiteNumber(item.amount)),
        currencyCode: item.currencyCode || raw.baseCurrency || DEFAULT_CURRENCY,
        exchangeRate: finiteNumber(item.exchangeRate, 1) || 1,
        targetAccountId: item.targetAccountId || null,
        categoryId: item.categoryId || null,
        tagIds: Array.isArray(item.tagIds) ? item.tagIds : [],
        merchantId: item.merchantId || null,
        memberShares: Array.isArray(item.memberShares) ? item.memberShares : [],
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
        && finiteNumber(item.amount) > 0
        && item.date
      )).map((item) => ({
        ...item,
        amount: finiteNumber(item.amount),
        accountAmount: finiteNumber(item.accountAmount, finiteNumber(item.amount)),
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
        && finiteNumber(item.amount) > 0
      )).map((item) => ({
        ...item,
        sourceTransactionIds: [...new Set(item.sourceTransactionIds.filter(Boolean))],
        amount: finiteNumber(item.amount),
        allocations: item.allocations && typeof item.allocations === "object"
          ? Object.fromEntries(Object.entries(item.allocations)
            .filter(([id, amount]) => id && finiteNumber(amount) > 0)
            .map(([id, amount]) => [id, finiteNumber(amount)]))
          : null,
        deletedAt: item.deletedAt || null,
      }))
    : [];

  const reimbursements = Array.isArray(raw.reimbursements)
    ? raw.reimbursements.filter((item) => (
        validEntity(item)
        && Array.isArray(item.sourceTransactionIds)
        && item.sourceTransactionIds.length
        && item.transactionId
        && finiteNumber(item.expectedAmount) > 0
        && finiteNumber(item.actualAmount) > 0
      )).map((item) => ({
        ...item,
        sourceTransactionIds: [...new Set(item.sourceTransactionIds.filter(Boolean))],
        accountId: item.accountId || null,
        expectedAmount: finiteNumber(item.expectedAmount),
        actualAmount: finiteNumber(item.actualAmount),
        receiptAmount: finiteNumber(item.receiptAmount, finiteNumber(item.expectedAmount)),
        differenceAmount: Math.max(0, finiteNumber(item.differenceAmount)),
        differenceType: ["income", "expense"].includes(item.differenceType) ? item.differenceType : null,
        differenceTransactionId: item.differenceTransactionId || null,
        allocations: item.allocations && typeof item.allocations === "object"
          ? Object.fromEntries(Object.entries(item.allocations)
            .filter(([id, amount]) => id && finiteNumber(amount) > 0)
            .map(([id, amount]) => [id, finiteNumber(amount)]))
          : null,
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
        && finiteNumber(item.startAmount) > 0
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
        startAmount: Math.max(0.01, finiteNumber(item.startAmount, 0.01)),
        incrementAmount: Math.max(0, finiteNumber(item.incrementAmount)),
        targetAmount: Math.max(0.01, finiteNumber(item.targetAmount, finiteNumber(item.startAmount, 0.01))),
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

  const monthlyBudget = finiteNumber(raw.settings?.monthlyBudget, fallback.settings.monthlyBudget);
  const state = {
    ...fallback,
    version: SCHEMA_VERSION,
    activeBookId,
    baseCurrency: raw.baseCurrency || DEFAULT_CURRENCY,
    settings: {
      ...fallback.settings,
      ...(raw.settings && typeof raw.settings === "object" ? raw.settings : {}),
      monthlyBudget: monthlyBudget >= 0 ? monthlyBudget : fallback.settings.monthlyBudget,
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
  return state;
}
