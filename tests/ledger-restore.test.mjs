import assert from "node:assert/strict";
import test from "node:test";

import { createDefaultLedger, SCHEMA_VERSION } from "../src/ledger-schema.mjs";
import { prepareLedgerRestore } from "../src/ledger-restore.mjs";

const now = "2026-09-05T00:00:00.000Z";

test("v5 完整备份升级为 v6 并保留精确金额", () => {
  const backup = createDefaultLedger(now);
  backup.version = 5;
  delete backup.settings.monthlyBudgetMinor;
  backup.transactions.push({
    id: "tx-v5",
    bookId: backup.activeBookId,
    type: "expense",
    amount: "12.30",
    originalAmount: "12.30",
    accountId: "acc-cash",
    categoryId: "cat-food",
    date: "2026-09-05",
  });

  const restored = prepareLedgerRestore(backup, now);

  assert.equal(restored.version, SCHEMA_VERSION);
  assert.equal(restored.transactions[0].amount, 12.3);
  assert.equal(restored.transactions[0].amountMinor, 1230);
  assert.equal(restored.metadata.migratedFrom, 5);
});

test("恢复拒绝未来高版本且不修改输入对象", () => {
  const backup = createDefaultLedger(now);
  backup.version = SCHEMA_VERSION + 1;
  const snapshot = structuredClone(backup);

  assert.throws(() => prepareLedgerRestore(backup, now), /来自更高版本/);
  assert.deepEqual(backup, snapshot);
});

test("恢复拒绝会丢记录或引用悬空的损坏备份", () => {
  const unreadable = createDefaultLedger(now);
  unreadable.transactions.push({ id: "broken", type: "expense", amount: 0, accountId: "acc-cash", date: "2026-09-05" });
  assert.throws(() => prepareLedgerRestore(unreadable, now), /有记录无法读取/);

  const dangling = createDefaultLedger(now);
  dangling.transactions.push({
    id: "dangling",
    bookId: dangling.activeBookId,
    type: "expense",
    amount: 10,
    accountId: "missing-account",
    categoryId: "cat-food",
    date: "2026-09-05",
  });
  assert.throws(() => prepareLedgerRestore(dangling, now), /账户不存在/);

  const brokenSchedule = createDefaultLedger(now);
  brokenSchedule.schedules.push({
    id: "schedule-broken",
    bookId: brokenSchedule.activeBookId,
    amount: 20,
    accountId: "missing-account",
    categoryId: "cat-food",
  });
  assert.throws(() => prepareLedgerRestore(brokenSchedule, now), /周期账.*账户不存在/);
});
