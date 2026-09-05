import assert from "node:assert/strict";
import test from "node:test";

import { fromMinor, moneyFields, readMinor, toMinor, writeMoney } from "../src/money.mjs";

test("金额字符串精确转换为最小货币单位", () => {
  assert.equal(toMinor("0.1"), 10);
  assert.equal(toMinor("0.2"), 20);
  assert.equal(toMinor("1.005"), 101);
  assert.equal(toMinor("-1.005"), -101);
  assert.equal(fromMinor(toMinor("66795.00")), 66795);
});

test("v6 优先读取整数金额并生成兼容显示值", () => {
  const pair = moneyFields(99.99, 12345);
  assert.deepEqual(pair, { value: 123.45, minor: 12345 });
  assert.equal(readMinor({ amount: 99.99, amountMinor: 12345 }), 12345);
  const record = { amount: 99.99, amountMinor: 12345 };
  writeMoney(record, "amount", "0.10");
  assert.deepEqual(record, { amount: 0.1, amountMinor: 10 });
});
