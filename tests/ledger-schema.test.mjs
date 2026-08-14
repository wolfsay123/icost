import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_BOOK_ID,
  SCHEMA_VERSION,
  createDefaultLedger,
  normalizeLedger,
} from "../src/ledger-schema.mjs";

const now = "2026-08-11T08:00:00.000Z";

test("默认账本包含完整业务集合", () => {
  const state = createDefaultLedger(now);

  assert.equal(state.version, SCHEMA_VERSION);
  assert.equal(state.activeBookId, DEFAULT_BOOK_ID);
  assert.equal(state.books.length, 1);
  assert.equal(state.books[0].monthlyBudget, 5000);
  assert.equal(state.currencies[0].code, "CNY");
  ["members", "tags", "merchants", "budgets", "schedules", "installments", "templates", "recycleBin"]
    .forEach((name) => assert.ok(Array.isArray(state[name]), `${name} 应为数组`));
});

test("旧版单账本数据会无损迁移到版本 2", () => {
  const oldState = {
    version: 1,
    settings: { monthlyBudget: 0 },
    categories: [{ id: "cat-old", name: "旧分类", color: "#123456" }],
    accounts: [{ id: "acc-old", name: "旧账户", initialBalance: "88.5" }],
    transactions: [{
      id: "tx-old",
      type: "expense",
      amount: "12.3",
      accountId: "acc-old",
      categoryId: "cat-old",
      date: "2026-08-10",
      note: "保留备注",
    }],
    metadata: { createdAt: "2026-07-21T00:00:00.000Z" },
  };

  const state = normalizeLedger(oldState, now);

  assert.equal(state.version, 2);
  assert.equal(state.settings.monthlyBudget, 0);
  assert.equal(state.books[0].monthlyBudget, 0);
  assert.equal(state.accounts[0].initialBalance, 88.5);
  assert.equal(state.transactions[0].amount, 12.3);
  assert.equal(state.transactions[0].bookId, DEFAULT_BOOK_ID);
  assert.equal(state.transactions[0].note, "保留备注");
  assert.equal(state.metadata.migratedFrom, 1);
});

test("迁移会过滤损坏记录并保留扩展业务集合", () => {
  const state = normalizeLedger({
    version: 2,
    accounts: [{ id: "acc-1", name: "现金" }],
    categories: [{ id: "cat-1", name: "餐饮", color: "#fff" }],
    transactions: [
      { id: "bad", type: "expense", amount: 0, accountId: "acc-1", date: "2026-08-11" },
      { id: "ok", type: "receivable", amount: 50, accountId: "acc-1", date: "2026-08-11" },
    ],
    tags: [{ id: "tag-1", name: "出差" }, null],
    budgets: [{ id: "budget-1", name: "餐饮预算" }],
  }, now);

  assert.deepEqual(state.transactions.map((item) => item.id), ["ok"]);
  assert.deepEqual(state.tags.map((item) => item.id), ["tag-1"]);
  assert.deepEqual(state.budgets.map((item) => item.id), ["budget-1"]);
});

test("版本 2 数据再次规范化保持业务标识", () => {
  const original = createDefaultLedger(now);
  original.books.push({ id: "book-trip", name: "旅行", monthlyBudget: 2600, createdAt: now });
  original.activeBookId = "book-trip";
  original.templates.push({ id: "tpl-1", name: "通勤" });

  const normalized = normalizeLedger(original, now);

  assert.equal(normalized.activeBookId, "book-trip");
  assert.equal(normalized.books.find((item) => item.id === "book-trip").monthlyBudget, 2600);
  assert.equal(normalized.templates[0].id, "tpl-1");
  assert.equal(normalized.metadata.migratedFrom, null);
});
