import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import {
  SCHEMA_VERSION,
  STORAGE_KEY,
  createDefaultLedger,
  normalizeLedger,
} from "./ledger-schema.mjs";
import {
  advanceRecurringDate,
  calculateAccountBalances,
  installmentAmount,
  roundMoney,
  validateTransaction
} from "./ledger-domain.mjs";
import { nativeWebDavAction } from "./native-webdav.mjs";
import {
  clearSecureSyncConfig,
  isNativeSecureStore,
  loadSecureSyncConfig,
  saveSecureSyncConfig
} from "./secure-store.mjs";
import { captureVoiceInput } from "./voice-input.mjs";
import {
  getAutoBookingStatus,
  loadNotificationCandidates,
  loadSmsCandidates,
  openAccessibilityAccess,
  openNotificationAccess
} from "./auto-booking.mjs";
import { updateLedgerWidget } from "./ledger-widget.mjs";

(() => {
  "use strict";

  const SYNC_CONFIG_KEY = "zhiji.sync.config.v1";
  const APP_VERSION = SCHEMA_VERSION;

  const CATEGORY_RULES = [
    ["餐饮", ["早餐", "午饭", "午餐", "晚饭", "晚餐", "吃饭", "咖啡", "奶茶", "外卖", "餐厅", "面包"]],
    ["交通", ["打车", "出租", "地铁", "公交", "高铁", "火车", "机票", "加油", "停车", "滴滴"]],
    ["购物", ["买了", "购物", "淘宝", "京东", "超市", "衣服", "鞋", "日用品"]],
    ["居住", ["房租", "物业", "水费", "电费", "燃气", "家具"]],
    ["通讯", ["话费", "流量", "宽带", "手机费"]],
    ["医疗", ["医院", "看病", "药", "体检", "挂号"]],
    ["教育", ["课程", "学费", "书", "培训", "考试"]],
    ["娱乐", ["电影", "游戏", "演出", "唱歌", "旅行", "门票"]],
    ["工资", ["工资", "薪资", "发薪"]],
    ["奖金", ["奖金", "红包", "分红"]],
    ["转账", ["转账", "转给", "转入", "转出"]]
  ];

  const ACCOUNT_RULES = [
    ["微信", ["微信", "零钱"]],
    ["支付宝", ["支付宝", "花呗"]],
    ["现金", ["现金"]],
    ["银行卡", ["银行卡", "银行", "招行", "招商", "工行", "建行", "农行", "中行", "信用卡"]]
  ];

  const VIEW_TITLES = {
    home: "我的账本",
    record: "记一笔",
    stats: "收支统计",
    plans: "预算与计划",
    search: "搜索账目",
    books: "账本管理",
    settings: "设置与同步"
  };

  const TRANSACTION_TYPE_LABELS = {
    expense: "支出",
    income: "收入",
    transfer: "转账",
    borrow: "借入",
    lend: "借出",
    repayment: "还款",
    collection: "收款",
    payable: "应付",
    receivable: "应收"
  };

  const POSITIVE_TRANSACTION_TYPES = new Set(["income", "borrow", "collection"]);
  const NEGATIVE_TRANSACTION_TYPES = new Set(["expense", "lend", "repayment"]);
  const ACCOUNT_TYPE_LABELS = {
    cash: "现金",
    wallet: "电子钱包",
    bank: "银行卡",
    credit: "信用账户",
    asset: "资产",
    liability: "负债"
  };

  const elements = {};
  let state = loadState();
  if (!state.metadata.deviceId) state.metadata.deviceId = makeId("device");
  let toastTimer = null;
  let autoSyncTimer = null;
  let secureSyncConfig = null;
  let syncInProgress = false;
  let backgroundAt = null;
  let autoBookingCandidates = [];
  let transactionPhotos = [];
  let transactionLocation = null;
  let activeViewName = "home";

  function makeId(prefix) {
    if (crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function createDefaultState() {
    return createDefaultLedger();
  }

  function normalizeState(raw) {
    return normalizeLedger(raw);
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createDefaultState();
      const parsed = JSON.parse(raw);
      const normalized = normalizeState(parsed);
      if (Number(parsed.version) !== normalized.version) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      }
      return normalized;
    } catch {
      return createDefaultState();
    }
  }

  function saveState(message, options = {}) {
    if (options.markChanged !== false) {
      state.metadata.revision = Number(state.metadata.revision || 0) + 1;
      state.metadata.dataUpdatedAt = new Date().toISOString();
    }
    state.metadata.lastSavedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderAll();
    if (message) showToast(message);
    if (!options.skipAutoSync) scheduleAutoBackup();
    syncLedgerWidget();
  }

  function syncLedgerWidget() {
    const monthTransactions = currentTransactions().filter((item) => monthKey(item.date) === monthKey());
    const income = monthTransactions.filter((item) => item.type === "income").reduce((sum, item) => sum + baseAmount(item), 0);
    const expense = monthTransactions.filter((item) => item.type === "expense").reduce((sum, item) => sum + baseAmount(item), 0);
    const balance = Object.values(accountBalances()).reduce((sum, value) => sum + value, 0);
    updateLedgerWidget({
      bookName: activeBook().name,
      balance: formatMoney(balance, true),
      income: `收入 ${formatMoney(income)}`,
      expense: `支出 ${formatMoney(expense)}`
    }).catch(() => {});
  }

  function cacheElements() {
    document.querySelectorAll("[id]").forEach((element) => {
      elements[toCamelCase(element.id)] = element;
    });
  }

  function toCamelCase(value) {
    return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  function localDate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function monthKey(dateValue = localDate()) {
    return String(dateValue).slice(0, 7);
  }

  function offsetDate(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return localDate(date);
  }

  function formatMoney(value, signed = false) {
    const amount = Number(value) || 0;
    const absolute = Math.abs(amount).toLocaleString("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    if (!signed) return `¥${absolute}`;
    const prefix = amount > 0 ? "+" : amount < 0 ? "-" : "";
    return `${prefix}¥${absolute}`;
  }

  function baseAmount(transaction) {
    return roundMoney(transaction.amount * (transaction.exchangeRate || 1));
  }

  function currencyByCode(code) {
    return state.currencies.find((item) => item.code === code) || state.currencies[0];
  }

  function formatShortDate(value) {
    const [year, month, day] = String(value).split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return `${month}月${day}日 ${["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()]}`;
  }

  function formatTime(value) {
    if (!value) return "等待首次记账";
    const date = new Date(value);
    return `保存于 ${date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function categoryById(id) {
    return state.categories.find((item) => item.id === id) || { name: "其他", color: "#7e8581" };
  }

  function activeBook() {
    return state.books.find((item) => item.id === state.activeBookId) || state.books[0];
  }

  function currentCategories() {
    return state.categories.filter((item) => (
      item.bookId === state.activeBookId && !item.hidden && !item.deletedAt
    ));
  }

  function currentTransactions() {
    return state.transactions.filter((item) => item.bookId === state.activeBookId && !item.deletedAt);
  }

  function currentMembers() {
    return state.members.filter((item) => (!item.bookId || item.bookId === state.activeBookId) && !item.deletedAt);
  }

  function currentTags() {
    return state.tags.filter((item) => (!item.bookId || item.bookId === state.activeBookId) && !item.deletedAt);
  }

  function currentMerchants() {
    return state.merchants.filter((item) => (!item.bookId || item.bookId === state.activeBookId) && !item.deletedAt);
  }

  function accountById(id) {
    return state.accounts.find((item) => item.id === id) || { name: "未知账户" };
  }

  function categoryIdByName(name) {
    const categories = currentCategories();
    return categories.find((item) => item.name === name)?.id || categories.at(-1)?.id || "";
  }

  function accountIdByName(name) {
    return state.accounts.find((item) => item.name === name)?.id || state.accounts[0]?.id || "";
  }

  function accountBalances() {
    return calculateAccountBalances(state);
  }

  function sortedTransactions(transactions = state.transactions) {
    return [...transactions].sort((a, b) => {
      const dateResult = b.date.localeCompare(a.date);
      if (dateResult !== 0) return dateResult;
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });
  }

  function renderAll() {
    renderSelects();
    renderHome();
    renderStats();
    renderPlans();
    renderTemplates();
    renderSearch();
    renderBooks();
    renderSettings();
    renderStatus();
  }

  function renderStatus() {
    const now = new Date();
    elements.todayText.textContent = now.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long"
    });
    elements.lastSaveText.textContent = formatTime(state.metadata.lastSavedAt);
    if (state.metadata.lastSyncedAt) {
      elements.syncBadge.classList.add("is-synced");
      elements.syncBadge.lastChild.textContent = `已同步 ${new Date(state.metadata.lastSyncedAt).toLocaleDateString("zh-CN")}`;
    } else {
      elements.syncBadge.classList.remove("is-synced");
      elements.syncBadge.lastChild.textContent = "未同步";
    }
  }

  function renderSelects() {
    const categories = currentCategories();
    const members = currentMembers();
    const tags = currentTags();
    const merchants = currentMerchants();
    const categoryOptions = categories.map((item) => (
      `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`
    )).join("");
    const accountOptions = state.accounts.map((item) => (
      `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`
    )).join("");

    [elements.transactionCategory, elements.parsedCategory].forEach((select) => {
      const current = select.value;
      select.innerHTML = categoryOptions;
      if (categories.some((item) => item.id === current)) select.value = current;
    });
    [
      elements.transactionAccount,
      elements.transactionTargetAccount,
      elements.parsedAccount,
      elements.parsedTargetAccount
    ].forEach((select) => {
      const current = select.value;
      select.innerHTML = accountOptions;
      if (state.accounts.some((item) => item.id === current)) select.value = current;
    });

    const books = state.books.filter((item) => !item.hidden);
    elements.activeBookSelect.innerHTML = books.map((item) => (
      `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`
    )).join("");
    elements.activeBookSelect.value = state.activeBookId;

    const selectedMember = elements.transactionMember.value;
    elements.transactionMember.innerHTML = '<option value="">无成员</option>' + members.map((item) => (
      `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`
    )).join("");
    if (members.some((item) => item.id === selectedMember)) elements.transactionMember.value = selectedMember;

    const selectedMerchant = elements.transactionMerchant.value;
    elements.transactionMerchant.innerHTML = '<option value="">无商家</option>' + merchants.map((item) => (
      `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`
    )).join("");
    if (merchants.some((item) => item.id === selectedMerchant)) elements.transactionMerchant.value = selectedMerchant;

    const selectedTags = new Set([...elements.transactionTags.querySelectorAll("input:checked")].map((item) => item.value));
    elements.transactionTags.innerHTML = tags.length
      ? tags.map((item) => `<label class="choice-item"><input type="checkbox" value="${escapeHtml(item.id)}"${selectedTags.has(item.id) ? " checked" : ""} /><span>${escapeHtml(item.name)}</span></label>`).join("")
      : '<span class="muted-inline">暂无标签</span>';

    const selectedCurrency = elements.transactionCurrency.value || state.baseCurrency;
    elements.transactionCurrency.innerHTML = state.currencies.map((item) => (
      `<option value="${escapeHtml(item.code)}">${escapeHtml(item.code)} · ${escapeHtml(item.name)}</option>`
    )).join("");
    elements.transactionCurrency.value = state.currencies.some((item) => item.code === selectedCurrency)
      ? selectedCurrency
      : state.baseCurrency;
    const selectedAccountCurrency = elements.newAccountCurrency.value || state.baseCurrency;
    elements.newAccountCurrency.innerHTML = state.currencies.map((item) => (
      `<option value="${escapeHtml(item.code)}">${escapeHtml(item.code)} · ${escapeHtml(item.name)}</option>`
    )).join("");
    elements.newAccountCurrency.value = state.currencies.some((item) => item.code === selectedAccountCurrency)
      ? selectedAccountCurrency
      : state.baseCurrency;

    const selectedSearchType = elements.searchType.value;
    elements.searchType.innerHTML = '<option value="">全部类型</option>' + Object.entries(TRANSACTION_TYPE_LABELS).map(([value, label]) => (
      `<option value="${value}">${label}</option>`
    )).join("");
    elements.searchType.value = selectedSearchType;

    const selectedSearchAccount = elements.searchAccount.value;
    elements.searchAccount.innerHTML = '<option value="">全部账户</option>' + accountOptions;
    elements.searchAccount.value = selectedSearchAccount;

    [elements.budgetCategory, elements.scheduleCategory, elements.installmentCategory].forEach((select) => {
      const current = select.value;
      select.innerHTML = categoryOptions;
      if (categories.some((item) => item.id === current)) select.value = current;
    });
    [elements.scheduleAccount, elements.installmentAccount].forEach((select) => {
      const current = select.value;
      select.innerHTML = accountOptions;
      if (state.accounts.some((item) => item.id === current)) select.value = current;
    });
  }

  function renderHome() {
    const currentMonth = monthKey();
    const monthTransactions = currentTransactions().filter((item) => monthKey(item.date) === currentMonth);
    const incomeTransactions = monthTransactions.filter((item) => item.type === "income");
    const expenseTransactions = monthTransactions.filter((item) => item.type === "expense");
    const income = incomeTransactions.reduce((sum, item) => sum + baseAmount(item), 0);
    const expense = expenseTransactions.reduce((sum, item) => sum + baseAmount(item), 0);
    const balances = accountBalances();
    const totalBalance = Object.values(balances).reduce((sum, value) => sum + value, 0);
    const budget = activeBook().monthlyBudget;
    const budgetPercent = budget > 0 ? Math.round((expense / budget) * 100) : 0;

    elements.totalBalance.textContent = totalBalance < 0 ? formatMoney(totalBalance, true) : formatMoney(totalBalance);
    elements.accountCount.textContent = `${state.accounts.length} 个账户`;
    elements.monthIncome.textContent = formatMoney(income);
    elements.incomeCount.textContent = `${incomeTransactions.length} 笔收入`;
    elements.monthExpense.textContent = formatMoney(expense);
    elements.expenseCount.textContent = `${expenseTransactions.length} 笔支出`;
    elements.budgetPercent.textContent = budget > 0 ? `${budgetPercent}%` : "未设置";
    elements.budgetRemaining.textContent = budget > 0
      ? `${budget - expense >= 0 ? "剩余" : "超出"} ${formatMoney(Math.abs(budget - expense))}`
      : "尚未设置预算";
    elements.budgetTotal.textContent = `预算 ${formatMoney(budget)}`;
    elements.budgetProgress.style.width = `${Math.min(100, budgetPercent)}%`;
    elements.budgetProgress.classList.toggle("is-over", budgetPercent > 100);

    renderDailyChart(expenseTransactions);
    renderTransactionList(elements.recentTransactions, sortedTransactions(currentTransactions()).slice(0, 8));
  }

  function renderDailyChart(expenseTransactions) {
    const now = new Date();
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daily = Array.from({ length: days }, () => 0);
    expenseTransactions.forEach((item) => {
      const day = Number(item.date.slice(8, 10));
      if (day >= 1 && day <= days) daily[day - 1] += baseAmount(item);
    });
    const max = Math.max(...daily, 1);
    elements.dailyChart.innerHTML = daily.map((value, index) => {
      const height = value ? Math.max(7, Math.round((value / max) * 100)) : 3;
      return `<span class="mini-bar" style="height:${height}%" title="${index + 1}日：${formatMoney(value)}"></span>`;
    }).join("");
    const elapsedDays = Math.max(1, now.getDate());
    const total = daily.reduce((sum, value) => sum + value, 0);
    elements.dailyAverage.textContent = `日均 ${formatMoney(total / elapsedDays)}`;
  }

  function renderTransactionList(container, transactions) {
    if (!transactions.length) {
      container.innerHTML = '<div class="empty-state"><strong>还没有账目</strong><span>从一句话或手动记账开始</span></div>';
      return;
    }

    container.innerHTML = transactions.map((item) => {
      const category = categoryById(item.categoryId);
      const account = accountById(item.accountId);
      const target = item.targetAccountId ? accountById(item.targetAccountId) : null;
      const typeText = TRANSACTION_TYPE_LABELS[item.type] || item.type;
      const convertedAmount = baseAmount(item);
      const amountValue = POSITIVE_TRANSACTION_TYPES.has(item.type)
        ? convertedAmount
        : NEGATIVE_TRANSACTION_TYPES.has(item.type) ? -convertedAmount : 0;
      const amountClass = POSITIVE_TRANSACTION_TYPES.has(item.type)
        ? "income-text"
        : NEGATIVE_TRANSACTION_TYPES.has(item.type) ? "expense-text" : "";
      const accountText = target ? `${account.name} → ${target.name}` : account.name;
      const note = item.note || category.name;
      const amountText = ["transfer", "payable", "receivable"].includes(item.type)
        ? formatMoney(convertedAmount)
        : formatMoney(amountValue, true);
      const statusText = item.status === "pending" ? " · 待处理" : "";
      const currency = currencyByCode(item.currencyCode);
      const originalText = item.currencyCode !== state.baseCurrency ? ` · ${escapeHtml(currency.symbol)}${item.amount}` : "";
      const memberNames = (item.memberShares || []).map((share) => state.members.find((member) => member.id === share.memberId)?.name).filter(Boolean);
      const merchantName = state.merchants.find((merchant) => merchant.id === item.merchantId)?.name;
      const dimensionText = [merchantName, ...memberNames].filter(Boolean).join(" · ");
      return `
        <article class="transaction-item" data-id="${escapeHtml(item.id)}">
          <span class="category-mark" style="background:${escapeHtml(category.color)}">${escapeHtml(category.name.slice(0, 1))}</span>
          <div class="transaction-main"><strong>${escapeHtml(note)}</strong><small>${escapeHtml(category.name)} · ${typeText}${statusText}${originalText}${dimensionText ? ` · ${escapeHtml(dimensionText)}` : ""}</small></div>
          <div class="transaction-meta"><strong>${escapeHtml(accountText)}</strong><small>${formatShortDate(item.date)}</small></div>
          <span class="transaction-amount ${amountClass}">${amountText}</span>
          <div class="transaction-actions">
            <button class="row-action edit" type="button" data-action="edit" title="编辑" aria-label="编辑">✎</button>
            <button class="row-action delete" type="button" data-action="delete" title="删除" aria-label="删除">×</button>
          </div>
        </article>`;
    }).join("");
  }

  function renderStats() {
    const selectedMonth = elements.statsMonth.value || monthKey();
    if (!elements.statsMonth.value) elements.statsMonth.value = selectedMonth;
    const transactions = currentTransactions().filter((item) => monthKey(item.date) === selectedMonth);
    const income = transactions.filter((item) => item.type === "income").reduce((sum, item) => sum + baseAmount(item), 0);
    const expenseTransactions = transactions.filter((item) => item.type === "expense");
    const expense = expenseTransactions.reduce((sum, item) => sum + baseAmount(item), 0);

    elements.statsIncome.textContent = formatMoney(income);
    elements.statsExpense.textContent = formatMoney(expense);
    elements.statsNet.textContent = formatMoney(income - expense, true);
    elements.statsNet.className = income - expense >= 0 ? "income-text" : "expense-text";

    const categoryTotals = new Map();
    expenseTransactions.forEach((item) => {
      categoryTotals.set(item.categoryId, (categoryTotals.get(item.categoryId) || 0) + baseAmount(item));
    });
    const categoryRows = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]);
    elements.categoryStats.innerHTML = categoryRows.length
      ? categoryRows.map(([id, amount]) => {
          const category = categoryById(id);
          const percent = expense > 0 ? Math.round((amount / expense) * 100) : 0;
          return `<div class="stat-row">
            <span class="stat-row-label"><i class="color-dot" style="background:${escapeHtml(category.color)}"></i>${escapeHtml(category.name)}</span>
            <span class="stat-bar"><span style="width:${percent}%;background:${escapeHtml(category.color)}"></span></span>
            <strong>${formatMoney(amount)} · ${percent}%</strong>
          </div>`;
        }).join("")
      : '<div class="empty-state"><strong>本月暂无支出</strong><span>新增支出后会显示分类占比</span></div>';

    const balances = accountBalances();
    const maxBalance = Math.max(...Object.values(balances).map((value) => Math.abs(value)), 1);
    elements.accountStats.innerHTML = state.accounts.map((account) => {
      const balance = balances[account.id] || 0;
      const width = Math.max(2, Math.round((Math.abs(balance) / maxBalance) * 100));
      const color = balance >= 0 ? "#237b66" : "#c6533f";
      return `<div class="stat-row">
        <span class="stat-row-label"><i class="color-dot" style="background:${color}"></i>${escapeHtml(account.name)}</span>
        <span class="stat-bar"><span style="width:${width}%;background:${color}"></span></span>
        <strong>${formatMoney(balance, true)}</strong>
      </div>`;
    }).join("");

    renderTransactionList(elements.statsTransactions, sortedTransactions(transactions));
  }

  function renderSettings() {
    const categories = currentCategories();
    elements.monthlyBudget.value = activeBook().monthlyBudget;
    elements.categoryTotal.textContent = `${categories.length} 个`;
    elements.accountTotal.textContent = `${state.accounts.length} 个`;
    elements.currencyTotal.textContent = `${state.currencies.length} 个`;
    elements.appLockStatus.textContent = state.settings.appLock ? "已开启" : "未开启";
    elements.lockTimeout.value = String(state.settings.appLock?.timeoutMinutes ?? 5);
    elements.categoryList.innerHTML = categories.map((item) => (
      `<span class="tag-item"><i class="color-dot" style="background:${escapeHtml(item.color)}"></i>${escapeHtml(item.name)}<button type="button" data-category-id="${escapeHtml(item.id)}" data-category-action="rename" title="重命名分类" aria-label="重命名分类">✎</button><button type="button" data-category-id="${escapeHtml(item.id)}" data-category-action="delete" title="删除分类" aria-label="删除分类">×</button></span>`
    )).join("");

    const balances = accountBalances();
    elements.accountList.innerHTML = state.accounts.map((item) => (
      `<div class="account-manage-item"><span>${escapeHtml(item.name)} · ${escapeHtml(ACCOUNT_TYPE_LABELS[item.type] || "账户")}</span><strong>${formatMoney(balances[item.id] || 0, true)}</strong><button type="button" data-account-id="${escapeHtml(item.id)}" data-account-action="rename" title="重命名账户" aria-label="重命名账户">✎</button><button type="button" data-account-id="${escapeHtml(item.id)}" data-account-action="delete" title="删除账户" aria-label="删除账户">×</button></div>`
    )).join("");
    elements.currencyList.innerHTML = state.currencies.map((item) => (
      `<span class="tag-item">${escapeHtml(item.code)} · ${escapeHtml(item.symbol)} · ${escapeHtml(item.name)} · ${item.rate}<button type="button" data-currency-code="${escapeHtml(item.code)}" title="删除币种" aria-label="删除币种">×</button></span>`
    )).join("");

    const dimensions = [
      ["member", currentMembers(), elements.memberTotal, elements.memberList],
      ["tag", currentTags(), elements.tagTotal, elements.tagList],
      ["merchant", currentMerchants(), elements.merchantTotal, elements.merchantList]
    ];
    dimensions.forEach(([kind, items, totalElement, listElement]) => {
      totalElement.textContent = `${items.length} 个`;
      listElement.innerHTML = items.length
        ? items.map((item) => `<span class="tag-item">${escapeHtml(item.name)}<button type="button" data-${kind}-id="${escapeHtml(item.id)}" title="删除${escapeHtml(item.name)}" aria-label="删除${escapeHtml(item.name)}">×</button></span>`).join("")
        : '<span class="muted-inline">暂无</span>';
    });

    elements.recycleList.innerHTML = state.recycleBin.length ? [...state.recycleBin].reverse().map((item) => {
      const label = item.entityType === "book"
        ? `账本：${item.payload?.book?.name || "未命名"}`
        : `账目：${item.payload?.note || formatMoney(item.payload?.amount)}`;
      return `<article class="plan-item" data-trash-id="${escapeHtml(item.id)}"><div class="plan-copy"><strong>${escapeHtml(label)}</strong><small>${new Date(item.deletedAt).toLocaleString("zh-CN")}</small></div><div class="plan-actions"><button class="book-action" type="button" data-trash-action="restore">恢复</button><button class="book-action danger" type="button" data-trash-action="delete">彻底删除</button></div></article>`;
    }).join("") : '<div class="empty-state"><strong>回收站为空</strong></div>';
    renderAutoBookingCandidates();
  }

  function renderAutoBookingCandidates() {
    elements.autoBookingList.innerHTML = autoBookingCandidates.length ? autoBookingCandidates.map((item) => (
      `<article class="plan-item" data-candidate-id="${escapeHtml(item.id)}"><div class="plan-copy"><strong>${escapeHtml(item.text)}</strong><small>${escapeHtml(item.source || "系统")} · ${new Date(Number(item.createdAt) || Date.now()).toLocaleString("zh-CN")}</small></div><div class="plan-actions"><button class="book-action" type="button" data-candidate-action="parse">解析</button><button class="book-action danger" type="button" data-candidate-action="dismiss">忽略</button></div></article>`
    )).join("") : '<div class="empty-state"><strong>暂无候选</strong></div>';
  }

  async function refreshAutoBookingStatus() {
    try {
      const status = await getAutoBookingStatus();
      const labels = [];
      if (status.notificationAccess) labels.push("通知");
      if (status.accessibilityAccess) labels.push("无障碍");
      if (status.smsPermission) labels.push("短信");
      elements.autoBookingStatus.textContent = labels.length ? `${labels.join(" · ")}已授权` : "未授权";
    } catch {
      elements.autoBookingStatus.textContent = "状态不可用";
    }
  }

  function renderSearch() {
    const query = elements.searchQuery.value.trim().toLocaleLowerCase("zh-CN");
    const type = elements.searchType.value;
    const accountId = elements.searchAccount.value;
    const dateFrom = elements.searchDateFrom.value;
    const dateTo = elements.searchDateTo.value;
    const amountMin = elements.searchAmountMin.value === "" ? null : Number(elements.searchAmountMin.value);
    const amountMax = elements.searchAmountMax.value === "" ? null : Number(elements.searchAmountMax.value);

    const transactions = currentTransactions().filter((item) => {
      if (type && item.type !== type) return false;
      if (accountId && item.accountId !== accountId && item.targetAccountId !== accountId) return false;
      if (dateFrom && item.date < dateFrom) return false;
      if (dateTo && item.date > dateTo) return false;
      if (amountMin !== null && baseAmount(item) < amountMin) return false;
      if (amountMax !== null && baseAmount(item) > amountMax) return false;
      if (!query) return true;

      const category = categoryById(item.categoryId).name;
      const account = accountById(item.accountId).name;
      const target = item.targetAccountId ? accountById(item.targetAccountId).name : "";
      const merchant = state.merchants.find((candidate) => candidate.id === item.merchantId)?.name || "";
      const members = (item.memberShares || []).map((share) => state.members.find((candidate) => candidate.id === share.memberId)?.name || "");
      const tags = (item.tagIds || []).map((id) => state.tags.find((candidate) => candidate.id === id)?.name || "");
      return [item.note, category, account, target, merchant, ...members, ...tags]
        .join(" ")
        .toLocaleLowerCase("zh-CN")
        .includes(query);
    });

    elements.searchTotal.textContent = `${transactions.length} 笔`;
    renderTransactionList(elements.searchTransactions, sortedTransactions(transactions));
  }

  function renderPlans() {
    const month = monthKey();
    const expenses = currentTransactions().filter((item) => item.type === "expense" && monthKey(item.date) === month);
    const budgets = state.budgets.filter((item) => item.bookId === state.activeBookId && item.kind === "category");
    const goals = state.budgets.filter((item) => item.bookId === state.activeBookId && item.kind === "goal");
    const schedules = state.schedules.filter((item) => item.bookId === state.activeBookId && item.active !== false);
    const installments = state.installments.filter((item) => item.bookId === state.activeBookId && !item.deletedAt);

    elements.categoryBudgetList.innerHTML = budgets.length ? budgets.map((budget) => {
      const spent = expenses.filter((item) => item.categoryId === budget.categoryId).reduce((sum, item) => sum + baseAmount(item), 0);
      const percent = budget.amount > 0 ? Math.round((spent / budget.amount) * 100) : 0;
      return `<article class="plan-item" data-budget-id="${escapeHtml(budget.id)}">
        <div class="plan-copy"><strong>${escapeHtml(categoryById(budget.categoryId).name)} · ${formatMoney(spent)} / ${formatMoney(budget.amount)}</strong><small>${percent}%</small><div class="plan-progress"><span style="width:${Math.min(100, percent)}%;background:${percent > 100 ? "var(--expense)" : "var(--income)"}"></span></div></div>
        <div class="plan-actions"><button class="book-action danger" type="button" data-plan-action="delete-budget">删除</button></div>
      </article>`;
    }).join("") : '<div class="empty-state"><strong>暂无分类预算</strong></div>';

    elements.goalList.innerHTML = goals.length ? goals.map((goal) => {
      const percent = goal.targetAmount > 0 ? Math.round((goal.currentAmount / goal.targetAmount) * 100) : 0;
      return `<article class="plan-item" data-goal-id="${escapeHtml(goal.id)}">
        <div class="plan-copy"><strong>${escapeHtml(goal.name)} · ${formatMoney(goal.currentAmount)} / ${formatMoney(goal.targetAmount)}</strong><small>${Math.min(100, percent)}%</small><div class="plan-progress"><span style="width:${Math.min(100, percent)}%"></span></div></div>
        <div class="plan-actions"><button class="book-action" type="button" data-plan-action="deposit-goal">存入</button><button class="book-action danger" type="button" data-plan-action="delete-goal">删除</button></div>
      </article>`;
    }).join("") : '<div class="empty-state"><strong>暂无储蓄目标</strong></div>';

    const frequencyLabels = { weekly: "每周", monthly: "每月", yearly: "每年" };
    elements.scheduleList.innerHTML = schedules.length ? schedules.map((schedule) => (
      `<article class="plan-item" data-schedule-id="${escapeHtml(schedule.id)}"><div class="plan-copy"><strong>${escapeHtml(schedule.name)} · ${formatMoney(schedule.amount)}</strong><small>${frequencyLabels[schedule.frequency]} · 下次 ${schedule.nextDate}</small></div><div class="plan-actions"><button class="book-action" type="button" data-plan-action="run-schedule">记账</button><button class="book-action danger" type="button" data-plan-action="delete-schedule">删除</button></div></article>`
    )).join("") : '<div class="empty-state"><strong>暂无周期账</strong></div>';

    elements.installmentList.innerHTML = installments.length ? installments.map((plan) => {
      const complete = plan.paidPeriods >= plan.periods;
      return `<article class="plan-item" data-installment-id="${escapeHtml(plan.id)}"><div class="plan-copy"><strong>${escapeHtml(plan.name)} · ${formatMoney(plan.totalAmount)}</strong><small>已记 ${plan.paidPeriods}/${plan.periods} 期${complete ? " · 已完成" : ` · 下期 ${plan.nextDate}`}</small><div class="plan-progress"><span style="width:${Math.round((plan.paidPeriods / plan.periods) * 100)}%"></span></div></div><div class="plan-actions">${complete ? "" : '<button class="book-action" type="button" data-plan-action="run-installment">记下一期</button>'}<button class="book-action danger" type="button" data-plan-action="delete-installment">删除</button></div></article>`;
    }).join("") : '<div class="empty-state"><strong>暂无分期计划</strong></div>';

    const reimbursements = currentTransactions().filter((item) => item.type === "expense" && item.reimburseStatus === "pending");
    const reimbursementTotal = reimbursements.reduce((sum, item) => sum + baseAmount(item), 0);
    elements.reimbursementTotal.textContent = formatMoney(reimbursementTotal);
    elements.reimbursementList.innerHTML = reimbursements.length ? reimbursements.map((item) => (
      `<article class="plan-item" data-reimbursement-id="${escapeHtml(item.id)}"><div class="plan-copy"><strong>${escapeHtml(item.note || categoryById(item.categoryId).name)} · ${formatMoney(baseAmount(item))}</strong><small>${item.date} · ${escapeHtml(accountById(item.accountId).name)}</small></div><div class="plan-actions"><button class="book-action" type="button" data-plan-action="settle-reimbursement">确认到账</button></div></article>`
    )).join("") : '<div class="empty-state"><strong>暂无待报销账目</strong></div>';
  }

  function renderTemplates() {
    const templates = state.templates.filter((item) => item.bookId === state.activeBookId);
    elements.templateList.innerHTML = templates.length ? templates.map((item) => (
      `<article class="plan-item" data-template-id="${escapeHtml(item.id)}"><div class="plan-copy"><strong>${escapeHtml(item.name)}</strong><small>${TRANSACTION_TYPE_LABELS[item.values.type] || item.values.type} · ${formatMoney(baseAmount(item.values))} · ${escapeHtml(categoryById(item.values.categoryId).name)}</small></div><div class="plan-actions"><button class="book-action" type="button" data-template-action="apply">使用</button><button class="book-action danger" type="button" data-template-action="delete">删除</button></div></article>`
    )).join("") : '<div class="empty-state"><strong>暂无模板</strong></div>';
  }

  function plannedTransaction({ type = "expense", amount, categoryId, accountId, date, note, linkedTransactionId = null, installmentId = null, currencyCode = state.baseCurrency, exchangeRate = 1 }) {
    return validateTransaction({
      id: makeId("tx"),
      bookId: state.activeBookId,
      type,
      amount,
      categoryId,
      accountId,
      targetAccountId: null,
      date,
      time: "12:00",
      note,
      status: "posted",
      reimburseStatus: "none",
      currencyCode,
      exchangeRate,
      originalAmount: amount,
      tagIds: [],
      merchantId: null,
      memberShares: [],
      budgetIncluded: true,
      photos: [],
      location: null,
      linkedTransactionId,
      installmentId,
      reconciled: false,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, state);
  }

  function renderBooks() {
    const books = state.books.filter((item) => !item.hidden);
    elements.bookTotal.textContent = `${books.length} 个账本`;
    elements.bookList.innerHTML = books.map((book) => {
      const transactionCount = state.transactions.filter((item) => item.bookId === book.id && !item.deletedAt).length;
      const categoryCount = state.categories.filter((item) => item.bookId === book.id && !item.deletedAt).length;
      const activeClass = book.id === state.activeBookId ? " is-active" : "";
      return `<article class="book-item${activeClass}" data-book-id="${escapeHtml(book.id)}">
        <span class="book-color" style="background:${escapeHtml(book.color || "#1f6650")}"></span>
        <div class="book-copy">
          <strong>${escapeHtml(book.name)}</strong>
          <small>${transactionCount} 笔账目 · ${categoryCount} 个分类 · 月预算 ${formatMoney(book.monthlyBudget)}</small>
        </div>
        <div class="book-actions">
          ${book.id === state.activeBookId ? "" : '<button class="book-action" type="button" data-book-action="switch">切换</button>'}
          <button class="book-action" type="button" data-book-action="rename">重命名</button>
          <button class="book-action danger" type="button" data-book-action="delete">删除</button>
        </div>
      </article>`;
    }).join("");
  }

  function switchView(viewName) {
    const target = VIEW_TITLES[viewName] ? viewName : "home";
    activeViewName = target;
    document.querySelectorAll(".view").forEach((view) => view.classList.toggle("is-active", view.id === `view-${target}`));
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("is-active", item.dataset.view === target));
    elements.viewTitle.textContent = VIEW_TITLES[target];
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function transactionFromForm() {
    const type = document.querySelector('input[name="type"]:checked').value;
    const amount = Number(elements.transactionAmount.value);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("金额必须大于 0");
    const targetAccountId = type === "transfer" ? elements.transactionTargetAccount.value : null;
    if (type === "transfer" && targetAccountId === elements.transactionAccount.value) {
      throw new Error("转出账户和转入账户不能相同");
    }

    return validateTransaction({
      bookId: state.activeBookId,
      type,
      amount,
      categoryId: type === "transfer" ? categoryIdByName("转账") : elements.transactionCategory.value,
      accountId: elements.transactionAccount.value,
      targetAccountId,
      date: elements.transactionDate.value,
      time: elements.transactionTime.value,
      note: elements.transactionNote.value.trim(),
      status: ["payable", "receivable"].includes(type) ? "pending" : elements.transactionStatus.value,
      reimburseStatus: elements.transactionReimburseStatus.value,
      currencyCode: elements.transactionCurrency.value,
      exchangeRate: Number(elements.transactionExchangeRate.value),
      originalAmount: amount,
      merchantId: elements.transactionMerchant.value || null,
      memberShares: elements.transactionMember.value
        ? [{ memberId: elements.transactionMember.value, ratio: 1, amount }]
        : [],
      tagIds: [...elements.transactionTags.querySelectorAll("input:checked")].map((item) => item.value),
      budgetIncluded: true,
      photos: transactionPhotos,
      location: transactionLocation,
      linkedTransactionId: null,
      reconciled: false,
      deletedAt: null
    }, state);
  }

  function resetTransactionForm() {
    elements.transactionForm.reset();
    elements.transactionId.value = "";
    elements.transactionDate.value = localDate();
    elements.transactionTime.value = new Date().toTimeString().slice(0, 5);
    elements.transactionCurrency.value = state.baseCurrency;
    elements.transactionExchangeRate.value = currencyByCode(state.baseCurrency).rate;
    transactionPhotos = [];
    transactionLocation = null;
    elements.transactionPhotos.value = "";
    elements.transactionPhotoStatus.textContent = "未选择照片";
    elements.transactionLocationStatus.textContent = "未记录位置";
    elements.recordFormTitle.textContent = "记录一笔账";
    elements.cancelEditButton.classList.add("is-hidden");
    updateTransferFields("transaction");
  }

  function editTransaction(id) {
    const item = state.transactions.find((transaction) => transaction.id === id);
    if (!item) return;
    switchView("record");
    elements.transactionId.value = item.id;
    document.querySelector(`input[name="type"][value="${item.type}"]`).checked = true;
    elements.transactionAmount.value = item.amount;
    elements.transactionCategory.value = item.categoryId;
    elements.transactionAccount.value = item.accountId;
    elements.transactionTargetAccount.value = item.targetAccountId || state.accounts[0]?.id || "";
    elements.transactionDate.value = item.date;
    elements.transactionTime.value = item.time || "12:00";
    elements.transactionStatus.value = item.status || "posted";
    elements.transactionReimburseStatus.value = item.reimburseStatus || "none";
    elements.transactionCurrency.value = item.currencyCode || state.baseCurrency;
    elements.transactionExchangeRate.value = item.exchangeRate || 1;
    transactionPhotos = [...(item.photos || [])];
    transactionLocation = item.location || null;
    elements.transactionPhotoStatus.textContent = transactionPhotos.length ? `已保留 ${transactionPhotos.length} 张照片` : "未选择照片";
    elements.transactionLocationStatus.textContent = transactionLocation ? "已记录位置" : "未记录位置";
    elements.transactionMember.value = item.memberShares?.[0]?.memberId || "";
    elements.transactionMerchant.value = item.merchantId || "";
    const selectedTags = new Set(item.tagIds || []);
    elements.transactionTags.querySelectorAll("input").forEach((input) => {
      input.checked = selectedTags.has(input.value);
    });
    elements.transactionNote.value = item.note || "";
    elements.recordFormTitle.textContent = "编辑这笔账";
    elements.cancelEditButton.classList.remove("is-hidden");
    updateTransferFields("transaction");
    elements.transactionAmount.focus();
  }

  function deleteTransaction(id) {
    const item = state.transactions.find((transaction) => transaction.id === id);
    if (!item) return;
    if (!window.confirm(`确定删除“${item.note || categoryById(item.categoryId).name}”这笔记录吗？`)) return;
    state.recycleBin.push({
      id: makeId("trash"),
      entityType: "transaction",
      deletedAt: new Date().toISOString(),
      payload: structuredClone(item)
    });
    state.transactions = state.transactions.filter((transaction) => transaction.id !== id);
    saveState("账目已移入回收站");
  }

  function updateTransferFields(scope) {
    const isParsed = scope === "parsed";
    const name = isParsed ? "parsed-type" : "type";
    const type = document.querySelector(`input[name="${name}"]:checked`)?.value;
    const target = isParsed ? document.querySelector(".parsed-target") : document.querySelector(".transfer-target");
    target.classList.toggle("is-hidden", type !== "transfer");
    if (!isParsed && ["payable", "receivable"].includes(type)) {
      elements.transactionStatus.value = "pending";
    }
  }

  function parseNaturalLanguage(text) {
    const value = text.trim();
    const incomeKeywords = ["收入", "工资", "薪资", "到账", "奖金", "赚了", "收款", "报销"];
    const transferKeywords = ["转账", "转给", "转入", "转出", "划到"];
    const expenseKeywords = ["花了", "支出", "支付", "买了", "消费", "付了"];

    let type = "expense";
    if (transferKeywords.some((keyword) => value.includes(keyword))) type = "transfer";
    else if (incomeKeywords.some((keyword) => value.includes(keyword))) type = "income";
    else if (expenseKeywords.some((keyword) => value.includes(keyword))) type = "expense";

    const currencyMatch = value.match(/(?:¥|￥)\s*(\d+(?:\.\d{1,2})?)/)
      || value.match(/(\d+(?:\.\d{1,2})?)\s*(?:元|块钱|块)/);
    const numberMatches = [...value.matchAll(/\d+(?:\.\d{1,2})?/g)].map((match) => Number(match[0]));
    const amount = currencyMatch ? Number(currencyMatch[1]) : (numberMatches.at(-1) || 0);

    let categoryName = type === "income" ? "其他" : type === "transfer" ? "转账" : "其他";
    let categoryMatched = false;
    for (const [name, keywords] of CATEGORY_RULES) {
      if (keywords.some((keyword) => value.includes(keyword))) {
        categoryName = name;
        categoryMatched = true;
        break;
      }
    }

    let accountName = state.accounts[0]?.name || "";
    let accountMatched = false;
    for (const [name, keywords] of ACCOUNT_RULES) {
      if (keywords.some((keyword) => value.includes(keyword)) && state.accounts.some((item) => item.name === name)) {
        accountName = name;
        accountMatched = true;
        break;
      }
    }

    let date = localDate();
    let dateMatched = false;
    if (value.includes("前天")) {
      date = offsetDate(-2);
      dateMatched = true;
    } else if (value.includes("昨天")) {
      date = offsetDate(-1);
      dateMatched = true;
    } else if (value.includes("今天")) {
      dateMatched = true;
    }

    const explicitDate = value.match(/(?:(\d{4})[年/-])?(\d{1,2})[月/-](\d{1,2})日?/);
    if (explicitDate) {
      const year = Number(explicitDate[1] || new Date().getFullYear());
      const month = String(Number(explicitDate[2])).padStart(2, "0");
      const day = String(Number(explicitDate[3])).padStart(2, "0");
      date = `${year}-${month}-${day}`;
      dateMatched = true;
    }

    let score = amount > 0 ? 55 : 5;
    if (categoryMatched) score += 18;
    if (accountMatched) score += 14;
    if (dateMatched) score += 8;
    if ([...incomeKeywords, ...transferKeywords, ...expenseKeywords].some((keyword) => value.includes(keyword))) score += 5;

    return {
      type,
      amount,
      categoryId: categoryIdByName(categoryName),
      accountId: accountIdByName(accountName),
      targetAccountId: state.accounts.find((item) => item.id !== accountIdByName(accountName))?.id || accountIdByName(accountName),
      date,
      note: value,
      confidence: Math.min(100, score)
    };
  }

  function openParseDialog(text) {
    if (!text.trim()) {
      showToast("请先描述一笔收支", true);
      return;
    }
    const result = parseNaturalLanguage(text);
    document.querySelector(`input[name="parsed-type"][value="${result.type}"]`).checked = true;
    elements.parsedAmount.value = result.amount || "";
    elements.parsedCategory.value = result.categoryId;
    elements.parsedAccount.value = result.accountId;
    elements.parsedTargetAccount.value = result.targetAccountId;
    elements.parsedDate.value = result.date;
    elements.parsedNote.value = result.note;
    elements.parseConfidence.textContent = `识别置信度 ${result.confidence}%`;
    updateTransferFields("parsed");
    elements.parseDialog.showModal();
  }

  async function runVoiceInput(button, input) {
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "正在聆听…";
    try {
      const text = await captureVoiceInput();
      if (!text) throw new Error("没有识别到语音内容");
      input.value = text;
      openParseDialog(text);
    } catch (error) {
      showToast(error.message || "语音输入失败", true);
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  function saveParsedTransaction() {
    const type = document.querySelector('input[name="parsed-type"]:checked').value;
    const amount = Number(elements.parsedAmount.value);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("请确认有效金额");
    const targetAccountId = type === "transfer" ? elements.parsedTargetAccount.value : null;
    if (type === "transfer" && targetAccountId === elements.parsedAccount.value) {
      throw new Error("转出账户和转入账户不能相同");
    }
    const now = new Date().toISOString();
    state.transactions.push({
      id: makeId("tx"),
      bookId: state.activeBookId,
      type,
      amount: Math.round(amount * 100) / 100,
      categoryId: type === "transfer" ? categoryIdByName("转账") : elements.parsedCategory.value,
      accountId: elements.parsedAccount.value,
      targetAccountId,
      date: elements.parsedDate.value,
      note: elements.parsedNote.value.trim(),
      time: new Date().toTimeString().slice(0, 5),
      status: "posted",
      reimburseStatus: "none",
      currencyCode: state.baseCurrency,
      exchangeRate: 1,
      originalAmount: amount,
      tagIds: [],
      merchantId: null,
      memberShares: [],
      budgetIncluded: true,
      photos: [],
      location: null,
      linkedTransactionId: null,
      reconciled: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now
    });
    elements.quickRecordInput.value = "";
    elements.recordPageQuickInput.value = "";
    elements.parseDialog.close();
    saveState("已保存到本地账本");
  }

  function showToast(message, isError = false) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.toggle("is-error", isError);
    elements.toast.classList.add("is-visible");
    toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 2600);
  }

  function loadSyncConfig() {
    try {
      const config = JSON.parse(localStorage.getItem(SYNC_CONFIG_KEY) || "{}");
      elements.webdavUrl.value = config.baseUrl || "https://dav.jianguoyun.com/dav/";
      elements.webdavUsername.value = config.username || "";
      elements.webdavPath.value = config.remotePath || "智记/zhiji-backup.enc.json";
    } catch {
      localStorage.removeItem(SYNC_CONFIG_KEY);
    }
  }

  function saveSyncConfig(config) {
    // 密码和同步密钥不进入持久化配置，降低本机凭据泄露风险。
    localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify({
      baseUrl: config.baseUrl,
      username: config.username,
      remotePath: config.remotePath
    }));
  }

  function getSyncConfig() {
    if (!elements.syncForm.reportValidity()) throw new Error("请先完整填写同步配置");
    return {
      baseUrl: elements.webdavUrl.value.trim(),
      username: elements.webdavUsername.value.trim(),
      password: elements.webdavPassword.value,
      remotePath: elements.webdavPath.value.trim(),
      syncKey: elements.syncKey.value
    };
  }

  async function persistAutoSyncConfig(config) {
    if (!elements.autoSyncEnabled.checked) return;
    secureSyncConfig = { ...config, autoEnabled: true };
    await saveSecureSyncConfig(secureSyncConfig);
    elements.credentialStorageNote.textContent = isNativeSecureStore()
      ? "自动同步凭据已由 Android Keystore 加密保存。"
      : "浏览器预览仅在当前页面会话中保留自动同步凭据。";
  }

  async function initializeSecureSyncConfig() {
    try {
      const config = await loadSecureSyncConfig();
      if (!config?.autoEnabled) return;
      secureSyncConfig = config;
      elements.webdavUrl.value = config.baseUrl;
      elements.webdavUsername.value = config.username;
      elements.webdavPassword.value = config.password;
      elements.webdavPath.value = config.remotePath;
      elements.syncKey.value = config.syncKey;
      elements.autoSyncEnabled.checked = true;
      elements.credentialStorageNote.textContent = isNativeSecureStore()
        ? "自动同步凭据已由 Android Keystore 加密保存。"
        : "浏览器预览仅在当前页面会话中保留自动同步凭据。";
      scheduleAutoBackup();
    } catch (error) {
      setSyncResult(error.message || "自动同步配置读取失败", true);
    }
  }

  function scheduleAutoBackup() {
    clearTimeout(autoSyncTimer);
    if (!secureSyncConfig?.autoEnabled || syncInProgress) return;
    const revision = Number(state.metadata.revision || 0);
    if (state.metadata.lastSyncedRevision === revision) return;
    autoSyncTimer = setTimeout(() => {
      uploadBackup(secureSyncConfig, { automatic: true }).catch((error) => {
        setSyncResult(`自动同步暂停：${error.message}`, true);
      });
    }, 1800);
  }

  async function apiRequest(path, payload) {
    if (Capacitor.isNativePlatform() && path.startsWith("/api/webdav/")) {
      return nativeWebDavAction(path, payload);
    }
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({ ok: false, message: "服务返回了无法识别的内容" }));
    if (!response.ok || !result.ok) throw new Error(result.message || `请求失败（${response.status}）`);
    return result;
  }

  function bytesToBase64(bytes) {
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    return btoa(binary);
  }

  function base64ToBytes(value) {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  async function hashPin(pin, salt) {
    const material = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(pin),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: 180000, hash: "SHA-256" },
      material,
      256
    );
    return bytesToBase64(new Uint8Array(bits));
  }

  async function verifyPin(pin) {
    const lock = state.settings.appLock;
    if (!lock) return true;
    return (await hashPin(pin, base64ToBytes(lock.salt))) === lock.hash;
  }

  function showAppLock() {
    if (!state.settings.appLock || elements.lockDialog.open) return;
    elements.unlockPin.value = "";
    elements.lockError.textContent = "";
    elements.lockDialog.showModal();
    setTimeout(() => elements.unlockPin.focus(), 0);
  }

  function lockAfterBackgroundIfNeeded() {
    const lock = state.settings.appLock;
    if (!lock || backgroundAt == null) return;
    const timeoutMs = Number(lock.timeoutMinutes || 0) * 60 * 1000;
    if (Date.now() - backgroundAt >= timeoutMs) showAppLock();
    backgroundAt = null;
  }

  async function deriveEncryptionKey(passphrase, salt, usage) {
    const material = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(passphrase),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 210000, hash: "SHA-256" },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      [usage]
    );
  }

  async function encryptBackup(passphrase) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveEncryptionKey(passphrase, salt, "encrypt");
    const payload = JSON.stringify({
      app: "zhiji-local",
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      state
    });
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(payload)
    );
    return JSON.stringify({
      format: "zhiji-encrypted-backup",
      version: 1,
      algorithm: "AES-GCM",
      kdf: "PBKDF2-SHA256-210000",
      sourceDeviceId: state.metadata.deviceId,
      stateRevision: state.metadata.revision,
      dataUpdatedAt: state.metadata.dataUpdatedAt,
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
      data: bytesToBase64(new Uint8Array(encrypted)),
      createdAt: new Date().toISOString()
    });
  }

  async function decryptBackup(content, passphrase) {
    let envelope;
    try {
      envelope = JSON.parse(content);
    } catch {
      throw new Error("云端文件不是有效的智记备份");
    }
    if (envelope.format !== "zhiji-encrypted-backup" || !envelope.salt || !envelope.iv || !envelope.data) {
      throw new Error("云端文件格式不受支持");
    }
    try {
      const salt = base64ToBytes(envelope.salt);
      const iv = base64ToBytes(envelope.iv);
      const key = await deriveEncryptionKey(passphrase, salt, "decrypt");
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        base64ToBytes(envelope.data)
      );
      const payload = JSON.parse(new TextDecoder().decode(decrypted));
      if (payload.app !== "zhiji-local" || !payload.state) throw new Error("INVALID_BACKUP");
      return normalizeState(payload.state);
    } catch {
      throw new Error("解密失败，请检查同步密钥是否正确");
    }
  }

  async function downloadRemoteState(config) {
    try {
      const result = await apiRequest("/api/webdav/download", config);
      if (result.exists === false) return null;
      return { state: await decryptBackup(result.content, config.syncKey), modifiedAt: result.modifiedAt };
    } catch (error) {
      if (String(error.message).includes("云端文件不存在")) return null;
      throw error;
    }
  }

  function hasSyncConflict(remoteState) {
    if (!remoteState?.metadata?.deviceId || remoteState.metadata.deviceId === state.metadata.deviceId) return false;
    const localRevision = Number(state.metadata.revision || 0);
    const localChanged = state.metadata.lastSyncedRevision == null
      ? state.transactions.length > 0
      : localRevision > Number(state.metadata.lastSyncedRevision);
    const remoteUpdatedAt = Date.parse(remoteState.metadata.dataUpdatedAt || 0);
    const lastSyncedAt = Date.parse(state.metadata.lastSyncedAt || 0);
    return localChanged && remoteUpdatedAt > lastSyncedAt;
  }

  async function uploadBackup(config, options = {}) {
    if (syncInProgress) throw new Error("已有同步任务正在进行");
    syncInProgress = true;
    try {
      const remote = await downloadRemoteState(config);
      if (remote && hasSyncConflict(remote.state)) {
        if (options.automatic) throw new Error("云端存在另一设备的新版本，请手动选择上传或恢复");
        if (!window.confirm("云端存在另一设备的新版本。继续上传会覆盖云端，确定继续吗？")) {
          throw new Error("已取消覆盖云端版本");
        }
      }
      const revision = Number(state.metadata.revision || 0);
      const content = await encryptBackup(config.syncKey);
      const result = await apiRequest("/api/webdav/upload", { ...config, content });
      state.metadata.lastSyncedAt = new Date().toISOString();
      state.metadata.lastSyncedRevision = revision;
      saveState(null, { markChanged: false, skipAutoSync: true });
      return result;
    } finally {
      syncInProgress = false;
    }
  }

  function setSyncResult(message, isError = false) {
    elements.syncResult.textContent = message;
    elements.syncResult.classList.add("is-visible");
    elements.syncResult.classList.toggle("is-error", isError);
  }

  function setImportResult(message, isError = false) {
    elements.importResult.textContent = message;
    elements.importResult.classList.add("is-visible");
    elements.importResult.classList.toggle("is-error", isError);
  }

  function downloadTextFile(filename, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function escapeXml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  }

  function exportExcelXml() {
    const headers = ["类型", "金额", "币种", "汇率", "分类", "账户", "转入账户", "日期", "时间", "备注", "状态", "报销状态", "商家", "成员", "标签"];
    const rows = sortedTransactions(currentTransactions()).map((item) => {
      const merchant = state.merchants.find((candidate) => candidate.id === item.merchantId)?.name || "";
      const members = (item.memberShares || []).map((share) => state.members.find((candidate) => candidate.id === share.memberId)?.name).filter(Boolean).join(",");
      const tags = (item.tagIds || []).map((id) => state.tags.find((candidate) => candidate.id === id)?.name).filter(Boolean).join(",");
      return [
        TRANSACTION_TYPE_LABELS[item.type] || item.type,
        item.amount,
        item.currencyCode || state.baseCurrency,
        item.exchangeRate || 1,
        categoryById(item.categoryId).name,
        accountById(item.accountId).name,
        item.targetAccountId ? accountById(item.targetAccountId).name : "",
        item.date,
        item.time || "12:00",
        item.note || "",
        item.status || "posted",
        item.reimburseStatus || "none",
        merchant,
        members,
        tags
      ];
    });
    const cell = (value, number = false) => `<Cell><Data ss:Type="${number ? "Number" : "String"}">${escapeXml(value)}</Data></Cell>`;
    const headerXml = headers.map((value) => cell(value)).join("");
    const rowXml = rows.map((row) => `<Row>${row.map((value, index) => cell(value, index === 1 || index === 3)).join("")}</Row>`).join("");
    return `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="${escapeXml(activeBook().name)}"><Table><Row>${headerXml}</Row>${rowXml}</Table></Worksheet></Workbook>`;
  }

  function importExcelXml(content) {
    const documentNode = new DOMParser().parseFromString(content, "application/xml");
    if (documentNode.querySelector("parsererror")) throw new Error("Excel XML 文件格式无效");
    const rows = [...documentNode.getElementsByTagNameNS("*", "Row")].map((row) => (
      [...row.getElementsByTagNameNS("*", "Cell")].map((cell) => cell.textContent || "")
    ));
    if (rows.length < 2) throw new Error("文件中没有可导入的账目");
    const headers = rows[0];
    const requiredHeaders = ["类型", "金额", "分类", "账户", "日期"];
    if (requiredHeaders.some((header) => !headers.includes(header))) throw new Error("Excel XML 缺少必要列");
    const index = Object.fromEntries(headers.map((header, position) => [header, position]));
    const typeByLabel = Object.fromEntries(Object.entries(TRANSACTION_TYPE_LABELS).map(([key, label]) => [label, key]));
    const working = structuredClone(state);
    const imported = [];
    const resolveAccount = (name) => {
      if (!name) return null;
      let account = working.accounts.find((item) => item.name === name && !item.deletedAt);
      if (!account) {
        account = { id: makeId("acc"), name, type: "cash", initialBalance: 0, currencyCode: working.baseCurrency, includeInNetAssets: true, hidden: false, order: working.accounts.length, credit: null, deletedAt: null };
        working.accounts.push(account);
      }
      return account.id;
    };
    const resolveCategory = (name, type) => {
      let category = working.categories.find((item) => item.bookId === working.activeBookId && item.name === name && !item.deletedAt);
      if (!category) {
        category = { id: makeId("cat"), bookId: working.activeBookId, name: name || "导入分类", color: "#7e8581", kind: type === "income" ? "income" : type === "transfer" ? "transfer" : "expense", parentId: null, order: working.categories.length, hidden: false, deletedAt: null };
        working.categories.push(category);
      }
      return category.id;
    };
    rows.slice(1).filter((row) => row.some(Boolean)).forEach((row, rowIndex) => {
      const type = typeByLabel[row[index["类型"]]] || row[index["类型"]];
      if (!TRANSACTION_TYPE_LABELS[type]) throw new Error(`第 ${rowIndex + 2} 行类型不受支持`);
      const amount = Number(row[index["金额"]]);
      const currencyCode = String(index["币种"] === undefined ? working.baseCurrency : row[index["币种"]] || working.baseCurrency).toUpperCase();
      const exchangeRate = Number(index["汇率"] === undefined ? 1 : row[index["汇率"]]);
      if (!/^[A-Z]{3}$/.test(currencyCode)) throw new Error(`第 ${rowIndex + 2} 行币种代码无效`);
      if (!(exchangeRate > 0)) throw new Error(`第 ${rowIndex + 2} 行汇率无效`);
      if (!working.currencies.some((item) => item.code === currencyCode)) {
        working.currencies.push({ code: currencyCode, name: currencyCode, symbol: currencyCode, rate: exchangeRate });
      }
      const accountId = resolveAccount(row[index["账户"]]);
      const targetAccountId = resolveAccount(row[index["转入账户"]]) || null;
      const categoryId = resolveCategory(row[index["分类"]], type);
      const now = new Date().toISOString();
      imported.push(validateTransaction({
        id: makeId("tx"), bookId: working.activeBookId, type, amount, categoryId, accountId, targetAccountId,
        date: row[index["日期"]], time: row[index["时间"]] || "12:00", note: row[index["备注"]] || "",
        status: row[index["状态"]] || "posted", reimburseStatus: row[index["报销状态"]] || "none",
        currencyCode, exchangeRate, originalAmount: amount, tagIds: [], merchantId: null,
        memberShares: [], budgetIncluded: true, photos: [], location: null, linkedTransactionId: null,
        reconciled: false, deletedAt: null, createdAt: now, updatedAt: now
      }, working));
    });
    working.transactions.push(...imported);
    state = normalizeState(working);
    saveState();
    return imported.length;
  }

  async function importLocalFile(file) {
    const content = await file.text();
    const trimmed = content.trimStart();
    if (trimmed.startsWith("{")) {
      const parsed = JSON.parse(content);
      const candidate = parsed.app === "zhiji-local" && parsed.state ? parsed.state : parsed;
      if (!window.confirm("导入完整 JSON 会覆盖当前设备数据，确定继续吗？")) return null;
      state = normalizeState(candidate);
      saveState();
      return `完整数据已恢复，共 ${state.transactions.length} 笔账目`;
    }
    const count = importExcelXml(content);
    return `已向当前账本导入 ${count} 笔账目`;
  }

  async function runSyncAction(button, action) {
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "处理中…";
    try {
      await action();
    } catch (error) {
      setSyncResult(error.message || "同步操作失败", true);
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  function bindEvents() {
    document.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.view));
    });
    document.querySelectorAll("[data-view-link]").forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.viewLink));
    });
    elements.quickAddButton.addEventListener("click", () => switchView("record"));

    elements.quickRecordForm.addEventListener("submit", (event) => {
      event.preventDefault();
      openParseDialog(elements.quickRecordInput.value);
    });
    elements.recordPageQuickForm.addEventListener("submit", (event) => {
      event.preventDefault();
      openParseDialog(elements.recordPageQuickInput.value);
    });
    elements.voiceRecordButton.addEventListener("click", () => runVoiceInput(elements.voiceRecordButton, elements.quickRecordInput));
    elements.recordPageVoiceButton.addEventListener("click", () => runVoiceInput(elements.recordPageVoiceButton, elements.recordPageQuickInput));
    elements.parseConfirmForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (event.submitter?.value === "cancel") {
        elements.parseDialog.close();
        return;
      }
      try {
        saveParsedTransaction();
      } catch (error) {
        showToast(error.message, true);
      }
    });
    document.querySelectorAll('input[name="parsed-type"]').forEach((input) => {
      input.addEventListener("change", () => updateTransferFields("parsed"));
    });

    elements.transactionForm.addEventListener("submit", (event) => {
      event.preventDefault();
      try {
        const values = transactionFromForm();
        const id = elements.transactionId.value;
        const now = new Date().toISOString();
        if (id) {
          const index = state.transactions.findIndex((item) => item.id === id);
          if (index === -1) throw new Error("待编辑账目不存在");
          state.transactions[index] = { ...state.transactions[index], ...values, updatedAt: now };
          saveState("账目已更新");
        } else {
          state.transactions.push({ id: makeId("tx"), ...values, createdAt: now, updatedAt: now });
          saveState("账目已保存");
        }
        resetTransactionForm();
      } catch (error) {
        showToast(error.message, true);
      }
    });
    document.querySelectorAll('input[name="type"]').forEach((input) => {
      input.addEventListener("change", () => updateTransferFields("transaction"));
    });
    elements.transactionCurrency.addEventListener("change", () => {
      elements.transactionExchangeRate.value = currencyByCode(elements.transactionCurrency.value).rate;
    });
    elements.cancelEditButton.addEventListener("click", resetTransactionForm);

    elements.transactionPhotos.addEventListener("change", async () => {
      const files = [...(elements.transactionPhotos.files || [])];
      if (files.length > 3) {
        elements.transactionPhotos.value = "";
        return showToast("每笔账最多添加 3 张照片", true);
      }
      if (files.some((file) => file.size > 1.5 * 1024 * 1024)) {
        elements.transactionPhotos.value = "";
        return showToast("单张照片不能超过 1.5MB", true);
      }
      try {
        transactionPhotos = await Promise.all(files.map((file) => new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve({ name: file.name, type: file.type, dataUrl: reader.result });
          reader.onerror = () => reject(new Error("照片读取失败"));
          reader.readAsDataURL(file);
        })));
        elements.transactionPhotoStatus.textContent = transactionPhotos.length ? `已选择 ${transactionPhotos.length} 张照片` : "未选择照片";
      } catch (error) {
        showToast(error.message, true);
      }
    });

    elements.captureLocation.addEventListener("click", () => {
      if (!navigator.geolocation) return showToast("当前设备不支持定位", true);
      elements.captureLocation.disabled = true;
      navigator.geolocation.getCurrentPosition((position) => {
        transactionLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: new Date().toISOString()
        };
        elements.transactionLocationStatus.textContent = `已记录 · 精度约 ${Math.round(position.coords.accuracy)} 米`;
        elements.captureLocation.disabled = false;
      }, () => {
        elements.captureLocation.disabled = false;
        showToast("定位失败或权限未授权", true);
      }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
    });

    elements.saveTemplateButton.addEventListener("click", () => {
      try {
        const values = transactionFromForm();
        const name = window.prompt("模板名称", values.note || categoryById(values.categoryId).name)?.trim();
        if (!name) return;
        state.templates.push({
          id: makeId("template"),
          bookId: state.activeBookId,
          name,
          values: { ...values, photos: [], location: null, date: null },
          createdAt: new Date().toISOString()
        });
        saveState("记账模板已保存");
      } catch (error) {
        showToast(error.message, true);
      }
    });

    elements.templateList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-template-action]");
      const row = event.target.closest("[data-template-id]");
      if (!button || !row) return;
      const template = state.templates.find((item) => item.id === row.dataset.templateId);
      if (!template) return;
      if (button.dataset.templateAction === "delete") {
        state.templates = state.templates.filter((item) => item.id !== template.id);
        saveState("记账模板已删除");
        return;
      }
      const values = template.values;
      document.querySelector(`input[name="type"][value="${values.type}"]`).checked = true;
      elements.transactionAmount.value = values.amount;
      elements.transactionCurrency.value = values.currencyCode || state.baseCurrency;
      elements.transactionExchangeRate.value = values.exchangeRate || currencyByCode(values.currencyCode || state.baseCurrency).rate;
      elements.transactionCategory.value = values.categoryId;
      elements.transactionAccount.value = values.accountId;
      elements.transactionTargetAccount.value = values.targetAccountId || state.accounts[0]?.id || "";
      elements.transactionStatus.value = values.status || "posted";
      elements.transactionReimburseStatus.value = values.reimburseStatus || "none";
      elements.transactionMember.value = values.memberShares?.[0]?.memberId || "";
      elements.transactionMerchant.value = values.merchantId || "";
      const templateTags = new Set(values.tagIds || []);
      elements.transactionTags.querySelectorAll("input").forEach((input) => {
        input.checked = templateTags.has(input.value);
      });
      elements.transactionNote.value = values.note || "";
      updateTransferFields("transaction");
      showToast("模板已填入");
    });

    [elements.recentTransactions, elements.statsTransactions, elements.searchTransactions].forEach((container) => {
      container.addEventListener("click", (event) => {
        const button = event.target.closest("[data-action]");
        const item = event.target.closest("[data-id]");
        if (!button || !item) return;
        if (button.dataset.action === "edit") editTransaction(item.dataset.id);
        if (button.dataset.action === "delete") deleteTransaction(item.dataset.id);
      });
    });

    elements.statsMonth.addEventListener("change", renderStats);
    elements.searchForm.addEventListener("submit", (event) => event.preventDefault());
    [
      elements.searchQuery,
      elements.searchType,
      elements.searchAccount,
      elements.searchDateFrom,
      elements.searchDateTo,
      elements.searchAmountMin,
      elements.searchAmountMax
    ].forEach((input) => {
      input.addEventListener(input.tagName === "INPUT" ? "input" : "change", renderSearch);
    });
    elements.searchReset.addEventListener("click", () => {
      elements.searchForm.reset();
      renderSearch();
    });
    elements.budgetForm.addEventListener("submit", (event) => {
      event.preventDefault();
      activeBook().monthlyBudget = Math.max(0, Number(elements.monthlyBudget.value) || 0);
      saveState("月预算已更新");
    });

    elements.categoryBudgetForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const categoryId = elements.budgetCategory.value;
      const amount = Math.round(Number(elements.budgetAmount.value) * 100) / 100;
      if (!(amount > 0)) return showToast("预算金额必须大于 0", true);
      const existing = state.budgets.find((item) => item.bookId === state.activeBookId && item.kind === "category" && item.categoryId === categoryId);
      if (existing) existing.amount = amount;
      else state.budgets.push({ id: makeId("budget"), bookId: state.activeBookId, kind: "category", categoryId, amount, period: "monthly", createdAt: new Date().toISOString() });
      elements.budgetAmount.value = "";
      saveState(existing ? "分类预算已更新" : "分类预算已新增");
    });

    elements.goalForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const targetAmount = Math.round(Number(elements.goalTarget.value) * 100) / 100;
      if (!(targetAmount > 0)) return showToast("目标金额必须大于 0", true);
      state.budgets.push({
        id: makeId("goal"),
        bookId: state.activeBookId,
        kind: "goal",
        name: elements.goalName.value.trim(),
        targetAmount,
        currentAmount: 0,
        createdAt: new Date().toISOString()
      });
      elements.goalForm.reset();
      saveState("储蓄目标已新增");
    });

    elements.scheduleForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const amount = Math.round(Number(elements.scheduleAmount.value) * 100) / 100;
      if (!(amount > 0)) return showToast("周期金额必须大于 0", true);
      state.schedules.push({
        id: makeId("schedule"),
        bookId: state.activeBookId,
        name: elements.scheduleName.value.trim(),
        type: "expense",
        amount,
        frequency: elements.scheduleFrequency.value,
        nextDate: elements.scheduleNextDate.value,
        categoryId: elements.scheduleCategory.value,
        accountId: elements.scheduleAccount.value,
        active: true,
        createdAt: new Date().toISOString()
      });
      elements.scheduleForm.reset();
      elements.scheduleNextDate.value = localDate();
      saveState("周期账已新增");
    });

    elements.installmentForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const totalAmount = Math.round(Number(elements.installmentTotal.value) * 100) / 100;
      const periods = Number(elements.installmentPeriods.value);
      if (!(totalAmount > 0) || !Number.isInteger(periods) || periods < 2) return showToast("请填写有效的分期金额和期数", true);
      state.installments.push({
        id: makeId("installment"),
        bookId: state.activeBookId,
        name: elements.installmentName.value.trim(),
        totalAmount,
        periods,
        paidPeriods: 0,
        nextDate: elements.installmentNextDate.value,
        categoryId: elements.installmentCategory.value,
        accountId: elements.installmentAccount.value,
        createdAt: new Date().toISOString(),
        deletedAt: null
      });
      elements.installmentForm.reset();
      elements.installmentNextDate.value = localDate();
      saveState("分期计划已新增");
    });

    elements.viewPlans.addEventListener("click", (event) => {
      const button = event.target.closest("[data-plan-action]");
      if (!button) return;
      const action = button.dataset.planAction;
      const budgetId = event.target.closest("[data-budget-id]")?.dataset.budgetId;
      const goalId = event.target.closest("[data-goal-id]")?.dataset.goalId;
      const scheduleId = event.target.closest("[data-schedule-id]")?.dataset.scheduleId;
      const installmentId = event.target.closest("[data-installment-id]")?.dataset.installmentId;
      const reimbursementId = event.target.closest("[data-reimbursement-id]")?.dataset.reimbursementId;

      if (action === "delete-budget") {
        state.budgets = state.budgets.filter((item) => item.id !== budgetId);
        saveState("分类预算已删除");
      } else if (action === "delete-goal") {
        state.budgets = state.budgets.filter((item) => item.id !== goalId);
        saveState("储蓄目标已删除");
      } else if (action === "deposit-goal") {
        const goal = state.budgets.find((item) => item.id === goalId);
        const amount = Number(window.prompt("本次存入金额", "100"));
        if (!goal || !(amount > 0)) return;
        goal.currentAmount = Math.min(goal.targetAmount, Math.round((goal.currentAmount + amount) * 100) / 100);
        saveState("目标进度已更新");
      } else if (action === "delete-schedule") {
        state.schedules = state.schedules.filter((item) => item.id !== scheduleId);
        saveState("周期账已删除");
      } else if (action === "run-schedule") {
        const schedule = state.schedules.find((item) => item.id === scheduleId);
        if (!schedule) return;
        state.transactions.push(plannedTransaction({
          amount: schedule.amount,
          categoryId: schedule.categoryId,
          accountId: schedule.accountId,
          date: schedule.nextDate,
          note: schedule.name
        }));
        schedule.nextDate = advanceRecurringDate(schedule.nextDate, schedule.frequency);
        saveState("周期账已记入，下次日期已推进");
      } else if (action === "delete-installment") {
        state.installments = state.installments.filter((item) => item.id !== installmentId);
        saveState("分期计划已删除");
      } else if (action === "run-installment") {
        const plan = state.installments.find((item) => item.id === installmentId);
        if (!plan || plan.paidPeriods >= plan.periods) return;
        const amount = installmentAmount(plan.totalAmount, plan.periods, plan.paidPeriods);
        state.transactions.push(plannedTransaction({
          amount,
          categoryId: plan.categoryId,
          accountId: plan.accountId,
          date: plan.nextDate,
          note: `${plan.name} 第${plan.paidPeriods + 1}期`,
          installmentId: plan.id
        }));
        plan.paidPeriods += 1;
        if (plan.paidPeriods < plan.periods) plan.nextDate = advanceRecurringDate(plan.nextDate, "monthly");
        saveState("本期分期已记入");
      } else if (action === "settle-reimbursement") {
        const expense = state.transactions.find((item) => item.id === reimbursementId);
        if (!expense || expense.reimburseStatus !== "pending") return;
        const incomeCategory = currentCategories().find((item) => item.kind === "income") || currentCategories()[0];
        const income = plannedTransaction({
          type: "income",
          amount: expense.amount,
          categoryId: incomeCategory.id,
          accountId: expense.accountId,
          date: localDate(),
          note: `报销到账：${expense.note || categoryById(expense.categoryId).name}`,
          linkedTransactionId: expense.id,
          currencyCode: expense.currencyCode,
          exchangeRate: expense.exchangeRate
        });
        expense.reimburseStatus = "reimbursed";
        expense.linkedTransactionId = income.id;
        expense.updatedAt = new Date().toISOString();
        state.transactions.push(income);
        saveState("报销收入已关联到账");
      }
    });

    elements.activeBookSelect.addEventListener("change", () => {
      state.activeBookId = elements.activeBookSelect.value;
      resetTransactionForm();
      saveState(`已切换到${activeBook().name}`);
    });

    elements.bookForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = elements.newBookName.value.trim();
      if (state.books.some((item) => !item.hidden && item.name === name)) {
        showToast("账本名称已存在", true);
        return;
      }
      const sourceBookId = state.activeBookId;
      const now = new Date().toISOString();
      const book = {
        id: makeId("book"),
        name,
        color: elements.newBookColor.value,
        icon: "ledger",
        monthlyBudget: 0,
        hidden: false,
        order: state.books.length,
        createdAt: now
      };
      state.books.push(book);
      if (elements.copyBookCategories.checked) {
        const copied = state.categories.filter((item) => item.bookId === sourceBookId && !item.deletedAt);
        copied.forEach((item, order) => state.categories.push({
          ...item,
          id: makeId("cat"),
          bookId: book.id,
          order,
          deletedAt: null
        }));
      }
      state.activeBookId = book.id;
      elements.bookForm.reset();
      elements.newBookColor.value = "#1f6650";
      elements.copyBookCategories.checked = true;
      resetTransactionForm();
      saveState("账本已创建");
    });

    elements.bookList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-book-action]");
      const item = event.target.closest("[data-book-id]");
      if (!button || !item) return;
      const book = state.books.find((candidate) => candidate.id === item.dataset.bookId);
      if (!book) return;

      if (button.dataset.bookAction === "switch") {
        state.activeBookId = book.id;
        resetTransactionForm();
        saveState(`已切换到${book.name}`);
        return;
      }
      if (button.dataset.bookAction === "rename") {
        const name = window.prompt("请输入新的账本名称", book.name)?.trim();
        if (!name || name === book.name) return;
        if (state.books.some((candidate) => candidate.id !== book.id && !candidate.hidden && candidate.name === name)) {
          showToast("账本名称已存在", true);
          return;
        }
        book.name = name;
        saveState("账本已重命名");
        return;
      }
      if (button.dataset.bookAction === "delete") {
        const visibleBooks = state.books.filter((candidate) => !candidate.hidden);
        if (visibleBooks.length <= 1) return showToast("至少需要保留一个账本", true);
        if (!window.confirm(`删除“${book.name}”后，其分类和账目会移入回收站。确定继续吗？`)) return;
        const deletedAt = new Date().toISOString();
        const categories = state.categories.filter((candidate) => candidate.bookId === book.id);
        const transactions = state.transactions.filter((candidate) => candidate.bookId === book.id);
        const scopedNames = ["members", "tags", "merchants", "budgets", "schedules", "installments", "templates"];
        const scoped = Object.fromEntries(scopedNames.map((name) => [
          name,
          state[name].filter((candidate) => candidate.bookId === book.id)
        ]));
        state.recycleBin.push({
          id: makeId("trash"),
          entityType: "book",
          deletedAt,
          payload: { book, categories, transactions, scoped }
        });
        state.books = state.books.filter((candidate) => candidate.id !== book.id);
        state.categories = state.categories.filter((candidate) => candidate.bookId !== book.id);
        state.transactions = state.transactions.filter((candidate) => candidate.bookId !== book.id);
        scopedNames.forEach((name) => {
          state[name] = state[name].filter((candidate) => candidate.bookId !== book.id);
        });
        if (state.activeBookId === book.id) state.activeBookId = state.books.find((candidate) => !candidate.hidden).id;
        resetTransactionForm();
        saveState("账本已移入回收站");
      }
    });

    elements.categoryForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = elements.newCategoryName.value.trim();
      if (currentCategories().some((item) => item.name === name)) {
        showToast("分类名称已存在", true);
        return;
      }
      state.categories.push({
        id: makeId("cat"),
        bookId: state.activeBookId,
        name,
        color: elements.newCategoryColor.value,
        kind: elements.newCategoryKind.value,
        parentId: null,
        order: currentCategories().length,
        hidden: false,
        deletedAt: null
      });
      elements.categoryForm.reset();
      elements.newCategoryColor.value = "#d87945";
      saveState("分类已新增");
    });

    elements.categoryList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-category-id]");
      if (!button) return;
      const id = button.dataset.categoryId;
      const category = state.categories.find((item) => item.id === id);
      if (!category) return;
      if (button.dataset.categoryAction === "rename") {
        const name = window.prompt("请输入新的分类名称", category.name)?.trim();
        if (!name || name === category.name) return;
        if (currentCategories().some((item) => item.id !== id && item.name === name)) return showToast("分类名称已存在", true);
        category.name = name;
        saveState("分类已重命名");
        return;
      }
      if (currentCategories().length <= 1) return showToast("至少需要保留一个分类", true);
      if (state.transactions.some((item) => item.categoryId === id)) return showToast("该分类已有账目，不能删除", true);
      state.categories = state.categories.filter((item) => item.id !== id);
      saveState("分类已删除");
    });

    elements.accountForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = elements.newAccountName.value.trim();
      if (state.accounts.some((item) => item.name === name)) {
        showToast("账户名称已存在", true);
        return;
      }
      state.accounts.push({
        id: makeId("acc"),
        name,
        type: elements.newAccountType.value,
        initialBalance: Number(elements.newAccountBalance.value) || 0,
        currencyCode: elements.newAccountCurrency.value,
        includeInNetAssets: true,
        hidden: false,
        order: state.accounts.length,
        credit: elements.newAccountType.value === "credit" ? {
          limit: Math.max(0, Number(elements.newAccountCreditLimit.value) || 0),
          billingDay: Number(elements.newAccountBillingDay.value) || null,
          repaymentDay: Number(elements.newAccountRepaymentDay.value) || null
        } : null,
        deletedAt: null
      });
      elements.accountForm.reset();
      elements.newAccountCurrency.value = state.baseCurrency;
      elements.accountCreditFields.classList.add("is-hidden");
      saveState("账户已新增");
    });

    elements.newAccountType.addEventListener("change", () => {
      elements.accountCreditFields.classList.toggle("is-hidden", elements.newAccountType.value !== "credit");
    });

    elements.accountList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-account-id]");
      if (!button) return;
      const id = button.dataset.accountId;
      const account = state.accounts.find((item) => item.id === id);
      if (!account) return;
      if (button.dataset.accountAction === "rename") {
        const name = window.prompt("请输入新的账户名称", account.name)?.trim();
        if (!name || name === account.name) return;
        if (state.accounts.some((item) => item.id !== id && item.name === name)) return showToast("账户名称已存在", true);
        account.name = name;
        saveState("账户已重命名");
        return;
      }
      if (state.accounts.length <= 1) return showToast("至少需要保留一个账户", true);
      if (state.transactions.some((item) => item.accountId === id || item.targetAccountId === id)) {
        return showToast("该账户已有账目，不能删除", true);
      }
      state.accounts = state.accounts.filter((item) => item.id !== id);
      saveState("账户已删除");
    });

    elements.memberForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = elements.newMemberName.value.trim();
      if (currentMembers().some((item) => item.name === name)) return showToast("成员名称已存在", true);
      state.members.push({ id: makeId("member"), bookId: state.activeBookId, name, deletedAt: null });
      elements.memberForm.reset();
      saveState("成员已新增");
    });

    elements.tagForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = elements.newTagName.value.trim();
      if (currentTags().some((item) => item.name === name)) return showToast("标签名称已存在", true);
      state.tags.push({ id: makeId("tag"), bookId: state.activeBookId, name, color: "#5370a5", deletedAt: null });
      elements.tagForm.reset();
      saveState("标签已新增");
    });

    elements.merchantForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = elements.newMerchantName.value.trim();
      if (currentMerchants().some((item) => item.name === name)) return showToast("商家名称已存在", true);
      state.merchants.push({ id: makeId("merchant"), bookId: state.activeBookId, name, deletedAt: null });
      elements.merchantForm.reset();
      saveState("商家已新增");
    });

    elements.currencyForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const code = elements.newCurrencyCode.value.trim().toUpperCase();
      const rate = Number(elements.newCurrencyRate.value);
      if (!/^[A-Z]{3}$/.test(code)) return showToast("币种代码必须为 3 位英文字母", true);
      if (!(rate > 0)) return showToast("汇率必须大于 0", true);
      if (state.currencies.some((item) => item.code === code)) return showToast("币种代码已存在", true);
      state.currencies.push({
        code,
        name: elements.newCurrencyName.value.trim(),
        symbol: elements.newCurrencySymbol.value.trim(),
        rate
      });
      elements.currencyForm.reset();
      saveState("币种已新增");
    });

    elements.currencyList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-currency-code]");
      if (!button) return;
      const code = button.dataset.currencyCode;
      if (code === state.baseCurrency) return showToast("不能删除本位币", true);
      if (state.transactions.some((item) => item.currencyCode === code)) return showToast("该币种已有账目，不能删除", true);
      state.currencies = state.currencies.filter((item) => item.code !== code);
      saveState("币种已删除");
    });

    elements.memberList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-member-id]");
      if (!button) return;
      const id = button.dataset.memberId;
      if (state.transactions.some((item) => item.memberShares?.some((share) => share.memberId === id))) {
        return showToast("该成员已有账目，不能删除", true);
      }
      state.members = state.members.filter((item) => item.id !== id);
      saveState("成员已删除");
    });

    elements.tagList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-tag-id]");
      if (!button) return;
      const id = button.dataset.tagId;
      if (state.transactions.some((item) => item.tagIds?.includes(id))) return showToast("该标签已有账目，不能删除", true);
      state.tags = state.tags.filter((item) => item.id !== id);
      saveState("标签已删除");
    });

    elements.merchantList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-merchant-id]");
      if (!button) return;
      const id = button.dataset.merchantId;
      if (state.transactions.some((item) => item.merchantId === id)) return showToast("该商家已有账目，不能删除", true);
      state.merchants = state.merchants.filter((item) => item.id !== id);
      saveState("商家已删除");
    });

    elements.appLockForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const currentPin = elements.currentPin.value;
      const pin = elements.newPin.value;
      if (!/^\d{4,8}$/.test(pin)) return showToast("PIN 必须为 4 至 8 位数字", true);
      if (pin !== elements.confirmPin.value) return showToast("两次输入的新 PIN 不一致", true);
      if (state.settings.appLock && !(await verifyPin(currentPin))) return showToast("当前 PIN 不正确", true);
      const salt = crypto.getRandomValues(new Uint8Array(16));
      state.settings.appLock = {
        salt: bytesToBase64(salt),
        hash: await hashPin(pin, salt),
        timeoutMinutes: Number(elements.lockTimeout.value),
        updatedAt: new Date().toISOString()
      };
      elements.appLockForm.reset();
      elements.lockTimeout.value = String(state.settings.appLock.timeoutMinutes);
      saveState("应用锁已开启");
    });

    elements.clearAppLock.addEventListener("click", async () => {
      if (!state.settings.appLock) return showToast("应用锁尚未开启");
      const pin = window.prompt("请输入当前 PIN 以关闭应用锁") || "";
      if (!(await verifyPin(pin))) return showToast("当前 PIN 不正确", true);
      state.settings.appLock = null;
      elements.appLockForm.reset();
      saveState("应用锁已关闭");
    });

    elements.unlockForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!(await verifyPin(elements.unlockPin.value))) {
        elements.lockError.textContent = "PIN 不正确";
        elements.unlockPin.select();
        return;
      }
      elements.lockDialog.close();
      elements.unlockPin.value = "";
      elements.lockError.textContent = "";
    });
    elements.lockDialog.addEventListener("cancel", (event) => event.preventDefault());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) backgroundAt = Date.now();
      else lockAfterBackgroundIfNeeded();
    });

    elements.openNotificationAccess.addEventListener("click", async () => {
      try {
        await openNotificationAccess();
        setSyncResult("请在系统设置中允许智记读取交易通知");
      } catch (error) {
        showToast(error.message || "无法打开通知使用权设置", true);
      }
    });
    elements.openAccessibilityAccess.addEventListener("click", async () => {
      try {
        await openAccessibilityAccess();
        setSyncResult("请在系统无障碍设置中主动开启智记自动记账");
      } catch (error) {
        showToast(error.message || "无法打开无障碍设置", true);
      }
    });
    elements.loadNotificationCandidates.addEventListener("click", async () => {
      try {
        const result = await loadNotificationCandidates();
        autoBookingCandidates = [...autoBookingCandidates, ...(result.items || [])]
          .filter((item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index);
        renderAutoBookingCandidates();
        await refreshAutoBookingStatus();
      } catch (error) {
        showToast(error.message || "通知候选读取失败", true);
      }
    });
    elements.loadSmsCandidates.addEventListener("click", async () => {
      try {
        const result = await loadSmsCandidates();
        autoBookingCandidates = [...autoBookingCandidates, ...(result.items || [])]
          .filter((item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index);
        renderAutoBookingCandidates();
        await refreshAutoBookingStatus();
      } catch (error) {
        showToast(error.message || "短信候选读取失败", true);
      }
    });
    elements.autoBookingList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-candidate-action]");
      const row = event.target.closest("[data-candidate-id]");
      if (!button || !row) return;
      const candidate = autoBookingCandidates.find((item) => item.id === row.dataset.candidateId);
      if (!candidate) return;
      if (button.dataset.candidateAction === "parse") openParseDialog(candidate.text);
      else {
        autoBookingCandidates = autoBookingCandidates.filter((item) => item.id !== candidate.id);
        renderAutoBookingCandidates();
      }
    });

    elements.testSyncButton.addEventListener("click", () => runSyncAction(elements.testSyncButton, async () => {
      const config = getSyncConfig();
      saveSyncConfig(config);
      const result = await apiRequest("/api/webdav/test", config);
      await persistAutoSyncConfig(config);
      setSyncResult(result.message);
    }));

    elements.uploadSyncButton.addEventListener("click", () => runSyncAction(elements.uploadSyncButton, async () => {
      const config = getSyncConfig();
      saveSyncConfig(config);
      await persistAutoSyncConfig(config);
      const result = await uploadBackup(config);
      setSyncResult(`${result.message}，共 ${state.transactions.length} 笔账目。`);
    }));

    elements.downloadSyncButton.addEventListener("click", () => runSyncAction(elements.downloadSyncButton, async () => {
      const config = getSyncConfig();
      saveSyncConfig(config);
      await persistAutoSyncConfig(config);
      const remote = await downloadRemoteState(config);
      if (!remote) throw new Error("云端文件不存在");
      const localChanged = state.metadata.lastSyncedRevision == null
        ? state.transactions.length > 0
        : Number(state.metadata.revision || 0) > Number(state.metadata.lastSyncedRevision);
      const warning = localChanged
        ? "当前设备有尚未同步的修改，从云端恢复会覆盖这些修改。确定继续吗？"
        : "从云端恢复会覆盖当前设备中的账本，确定继续吗？";
      if (!window.confirm(warning)) return;
      const restoredState = remote.state;
      const deviceId = state.metadata.deviceId;
      restoredState.metadata.deviceId = deviceId;
      restoredState.metadata.lastSyncedAt = new Date().toISOString();
      restoredState.metadata.lastSyncedRevision = restoredState.metadata.revision;
      state = restoredState;
      saveState(null, { markChanged: false, skipAutoSync: true });
      resetTransactionForm();
      setSyncResult(`恢复成功，已载入 ${state.transactions.length} 笔账目。`);
    }));

    elements.autoSyncEnabled.addEventListener("change", async () => {
      if (elements.autoSyncEnabled.checked) {
        try {
          const config = getSyncConfig();
          saveSyncConfig(config);
          await persistAutoSyncConfig(config);
          scheduleAutoBackup();
          setSyncResult("自动同步已开启");
        } catch (error) {
          elements.autoSyncEnabled.checked = false;
          setSyncResult(error.message || "自动同步开启失败", true);
        }
      } else {
        clearTimeout(autoSyncTimer);
        secureSyncConfig = null;
        await clearSecureSyncConfig();
        elements.credentialStorageNote.textContent = "未开启自动同步时，应用密码和同步密钥只保留在当前页面内存中。";
        setSyncResult("自动同步已关闭，安全凭据已清除");
      }
    });

    elements.clearSyncConfig.addEventListener("click", async () => {
      localStorage.removeItem(SYNC_CONFIG_KEY);
      clearTimeout(autoSyncTimer);
      secureSyncConfig = null;
      await clearSecureSyncConfig();
      elements.syncForm.reset();
      elements.credentialStorageNote.textContent = "未开启自动同步时，应用密码和同步密钥只保留在当前页面内存中。";
      setSyncResult("本机保存的同步地址、账号和路径已清除。");
    });

    elements.exportJson.addEventListener("click", () => {
      downloadTextFile(`zhiji-backup-${localDate()}.json`, JSON.stringify({ app: "zhiji-local", version: APP_VERSION, exportedAt: new Date().toISOString(), state }, null, 2), "application/json;charset=utf-8");
      setImportResult("完整 JSON 已导出");
    });
    elements.exportExcel.addEventListener("click", () => {
      downloadTextFile(`zhiji-${activeBook().name}-${localDate()}.xml`, `\ufeff${exportExcelXml()}`, "application/vnd.ms-excel;charset=utf-8");
      setImportResult(`当前账本 ${currentTransactions().length} 笔账目已导出`);
    });
    elements.selectImportFile.addEventListener("click", () => elements.importFile.click());
    elements.importFile.addEventListener("change", async () => {
      const file = elements.importFile.files?.[0];
      if (!file) return;
      try {
        const message = await importLocalFile(file);
        if (message) setImportResult(message);
      } catch (error) {
        setImportResult(error.message || "文件导入失败", true);
      } finally {
        elements.importFile.value = "";
      }
    });

    elements.recycleList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-trash-action]");
      const row = event.target.closest("[data-trash-id]");
      if (!button || !row) return;
      const item = state.recycleBin.find((candidate) => candidate.id === row.dataset.trashId);
      if (!item) return;
      if (button.dataset.trashAction === "delete") {
        state.recycleBin = state.recycleBin.filter((candidate) => candidate.id !== item.id);
        saveState("已彻底删除");
        return;
      }
      if (item.entityType === "transaction") {
        const transaction = item.payload;
        if (!state.books.some((book) => book.id === transaction.bookId)) return showToast("原账本不存在，无法恢复该账目", true);
        if (!state.accounts.some((account) => account.id === transaction.accountId)) return showToast("原账户不存在，无法恢复该账目", true);
        state.transactions.push(transaction);
        state.activeBookId = transaction.bookId;
      } else if (item.entityType === "book") {
        const payload = item.payload;
        if (!payload?.book || state.books.some((book) => book.id === payload.book.id)) return showToast("账本无法恢复或已经存在", true);
        state.books.push(payload.book);
        state.categories.push(...(payload.categories || []));
        state.transactions.push(...(payload.transactions || []));
        Object.entries(payload.scoped || {}).forEach(([name, items]) => {
          if (Array.isArray(state[name]) && Array.isArray(items)) state[name].push(...items);
        });
        state.activeBookId = payload.book.id;
      }
      state.recycleBin = state.recycleBin.filter((candidate) => candidate.id !== item.id);
      resetTransactionForm();
      saveState("已从回收站恢复");
    });

    elements.emptyRecycleBin.addEventListener("click", () => {
      if (!state.recycleBin.length) return showToast("回收站已经为空");
      if (!window.confirm("清空后无法恢复，确定继续吗？")) return;
      state.recycleBin = [];
      saveState("回收站已清空");
    });
  }

  function bindNativeEvents() {
    if (!Capacitor.isNativePlatform()) return;
    App.addListener("pause", () => {
      backgroundAt = Date.now();
      if (!secureSyncConfig?.autoEnabled || syncInProgress) return;
      uploadBackup(secureSyncConfig, { automatic: true }).catch(() => {});
    }).catch(() => {});
    App.addListener("resume", lockAfterBackgroundIfNeeded).catch(() => {});
    App.addListener("appUrlOpen", ({ url }) => {
      if (url?.startsWith("zhiji://record")) switchView("record");
    }).catch(() => {});
    App.getLaunchUrl().then((result) => {
      if (result?.url?.startsWith("zhiji://record")) switchView("record");
    }).catch(() => {});
    App.addListener("backButton", () => {
      if (elements.parseDialog.open) {
        elements.parseDialog.close();
        return;
      }
      if (activeViewName !== "home") {
        switchView("home");
        return;
      }
      App.exitApp();
    }).catch(() => {});
  }

  function init() {
    cacheElements();
    elements.transactionDate.value = localDate();
    elements.transactionTime.value = new Date().toTimeString().slice(0, 5);
    elements.scheduleNextDate.value = localDate();
    elements.installmentNextDate.value = localDate();
    elements.statsMonth.value = monthKey();
    loadSyncConfig();
    bindEvents();
    bindNativeEvents();
    renderAll();
    elements.transactionCurrency.value = state.baseCurrency;
    elements.transactionExchangeRate.value = currencyByCode(state.baseCurrency).rate;
    elements.newAccountCurrency.value = state.baseCurrency;
    initializeSecureSyncConfig();
    refreshAutoBookingStatus();
    syncLedgerWidget();
    showAppLock();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
