import { SCHEMA_VERSION, normalizeLedger } from "./ledger-schema.mjs";

const CORE_COLLECTIONS = [
  "books",
  "categories",
  "accounts",
  "transactions",
  "refunds",
  "settlements",
  "reimbursements",
  "savingsPlans",
];

function ids(items) {
  return new Set((items || []).map((item) => item?.id).filter(Boolean));
}

function assertReference(condition, message) {
  if (!condition) throw new Error(`备份数据关联损坏：${message}`);
}

export function validateLedgerReferences(state) {
  const bookIds = ids(state.books);
  const categoryIds = ids(state.categories);
  const accountIds = ids(state.accounts);
  const transactionIds = ids(state.transactions);

  CORE_COLLECTIONS.forEach((name) => {
    const values = (state[name] || []).map((item) => item.id);
    assertReference(new Set(values).size === values.length, `${name} 存在重复 ID`);
  });
  assertReference(bookIds.has(state.activeBookId), "当前账本不存在");

  state.categories.forEach((item) => assertReference(bookIds.has(item.bookId), `分类 ${item.id} 的账本不存在`));
  state.accounts.forEach((item) => {
    (item.bookIds || []).forEach((bookId) => assertReference(bookIds.has(bookId), `账户 ${item.id} 的账本不存在`));
    if (item.credit?.sharedLimitAccountId) {
      assertReference(accountIds.has(item.credit.sharedLimitAccountId), `账户 ${item.id} 的共享额度账户不存在`);
    }
  });
  state.transactions.forEach((item) => {
    assertReference(bookIds.has(item.bookId), `交易 ${item.id} 的账本不存在`);
    assertReference(accountIds.has(item.accountId), `交易 ${item.id} 的账户不存在`);
    if (item.categoryId) assertReference(categoryIds.has(item.categoryId), `交易 ${item.id} 的分类不存在`);
    if (item.type === "transfer") {
      assertReference(accountIds.has(item.targetAccountId), `转账 ${item.id} 的转入账户不存在`);
      assertReference(item.targetAccountId !== item.accountId, `转账 ${item.id} 的转入转出账户相同`);
    }
  });
  state.refunds.forEach((item) => {
    assertReference(transactionIds.has(item.transactionId), `退款 ${item.id} 的原交易不存在`);
    assertReference(accountIds.has(item.accountId), `退款 ${item.id} 的账户不存在`);
  });
  state.settlements.forEach((item) => {
    assertReference(transactionIds.has(item.transactionId), `结算 ${item.id} 的入账交易不存在`);
    item.sourceTransactionIds.forEach((id) => assertReference(transactionIds.has(id), `结算 ${item.id} 的来源交易不存在`));
  });
  state.reimbursements.forEach((item) => {
    assertReference(transactionIds.has(item.transactionId), `报销 ${item.id} 的到账交易不存在`);
    item.sourceTransactionIds.forEach((id) => assertReference(transactionIds.has(id), `报销 ${item.id} 的来源交易不存在`));
    if (item.accountId) assertReference(accountIds.has(item.accountId), `报销 ${item.id} 的账户不存在`);
    if (item.differenceTransactionId) {
      assertReference(transactionIds.has(item.differenceTransactionId), `报销 ${item.id} 的差额交易不存在`);
    }
  });
  state.savingsPlans.forEach((item) => {
    assertReference(bookIds.has(item.bookId), `存钱计划 ${item.id} 的账本不存在`);
    assertReference(accountIds.has(item.sourceAccountId), `存钱计划 ${item.id} 的转出账户不存在`);
    assertReference(accountIds.has(item.targetAccountId), `存钱计划 ${item.id} 的存款账户不存在`);
    assertReference(item.sourceAccountId !== item.targetAccountId, `存钱计划 ${item.id} 的账户相同`);
  });
  state.budgets.forEach((item) => {
    if (item.bookId) assertReference(bookIds.has(item.bookId), `预算 ${item.id} 的账本不存在`);
    if (item.categoryId) assertReference(categoryIds.has(item.categoryId), `预算 ${item.id} 的分类不存在`);
  });
  state.schedules.forEach((item) => {
    if (item.bookId) assertReference(bookIds.has(item.bookId), `周期账 ${item.id} 的账本不存在`);
    if (item.categoryId) assertReference(categoryIds.has(item.categoryId), `周期账 ${item.id} 的分类不存在`);
    if (item.accountId) assertReference(accountIds.has(item.accountId), `周期账 ${item.id} 的账户不存在`);
  });
  state.installments.forEach((item) => {
    if (item.bookId) assertReference(bookIds.has(item.bookId), `分期 ${item.id} 的账本不存在`);
    if (item.categoryId) assertReference(categoryIds.has(item.categoryId), `分期 ${item.id} 的分类不存在`);
    if (item.accountId) assertReference(accountIds.has(item.accountId), `分期 ${item.id} 的账户不存在`);
  });
  state.templates.forEach((item) => {
    if (item.bookId) assertReference(bookIds.has(item.bookId), `模板 ${item.id} 的账本不存在`);
    const values = item.values;
    if (!values) return;
    if (values.categoryId) assertReference(categoryIds.has(values.categoryId), `模板 ${item.id} 的分类不存在`);
    if (values.accountId) assertReference(accountIds.has(values.accountId), `模板 ${item.id} 的账户不存在`);
    if (values.targetAccountId) assertReference(accountIds.has(values.targetAccountId), `模板 ${item.id} 的转入账户不存在`);
  });
  return state;
}

export function prepareLedgerRestore(raw, now = new Date().toISOString()) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("备份数据不是有效账本");
  const version = Number(raw.version ?? 1);
  if (!Number.isInteger(version) || version < 1) throw new Error("备份数据版本无效");
  if (version > SCHEMA_VERSION) throw new Error(`备份来自更高版本（v${version}），当前 App 最高支持 v${SCHEMA_VERSION}`);
  if (raw.activeBookId && Array.isArray(raw.books) && !raw.books.some((item) => item?.id === raw.activeBookId)) {
    throw new Error("备份数据关联损坏：当前账本不存在");
  }

  const normalized = normalizeLedger(raw, now);
  CORE_COLLECTIONS.forEach((name) => {
    if (Array.isArray(raw[name]) && normalized[name].length !== raw[name].length) {
      throw new Error(`备份数据损坏：${name} 有记录无法读取`);
    }
  });
  return validateLedgerReferences(normalized);
}
