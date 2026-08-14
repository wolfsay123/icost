(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // node_modules/@capacitor/core/dist/index.js
  var ExceptionCode, CapacitorException, getPlatformId, createCapacitor, initCapacitorGlobal, Capacitor, registerPlugin, WebPlugin, encode, decode, CapacitorCookiesPluginWeb, CapacitorCookies, readBlobAsBase64, normalizeHttpHeaders, buildUrlParams, buildRequestInit, CapacitorHttpPluginWeb, CapacitorHttp, SystemBarsStyle, SystemBarType, SystemBarsPluginWeb, SystemBars;
  var init_dist = __esm({
    "node_modules/@capacitor/core/dist/index.js"() {
      (function(ExceptionCode2) {
        ExceptionCode2["Unimplemented"] = "UNIMPLEMENTED";
        ExceptionCode2["Unavailable"] = "UNAVAILABLE";
      })(ExceptionCode || (ExceptionCode = {}));
      CapacitorException = class extends Error {
        constructor(message, code, data) {
          super(message);
          this.message = message;
          this.code = code;
          this.data = data;
        }
      };
      getPlatformId = (win) => {
        var _a, _b;
        if (win === null || win === void 0 ? void 0 : win.androidBridge) {
          return "android";
        } else if ((_b = (_a = win === null || win === void 0 ? void 0 : win.webkit) === null || _a === void 0 ? void 0 : _a.messageHandlers) === null || _b === void 0 ? void 0 : _b.bridge) {
          return "ios";
        } else {
          return "web";
        }
      };
      createCapacitor = (win) => {
        const capCustomPlatform = win.CapacitorCustomPlatform || null;
        const cap = win.Capacitor || {};
        const Plugins = cap.Plugins = cap.Plugins || {};
        const getPlatform = () => {
          return capCustomPlatform !== null ? capCustomPlatform.name : getPlatformId(win);
        };
        const isNativePlatform = () => getPlatform() !== "web";
        const isPluginAvailable = (pluginName) => {
          const plugin = registeredPlugins.get(pluginName);
          if (plugin === null || plugin === void 0 ? void 0 : plugin.platforms.has(getPlatform())) {
            return true;
          }
          if (getPluginHeader(pluginName)) {
            return true;
          }
          return false;
        };
        const getPluginHeader = (pluginName) => {
          var _a;
          return (_a = cap.PluginHeaders) === null || _a === void 0 ? void 0 : _a.find((h) => h.name === pluginName);
        };
        const handleError = (err) => win.console.error(err);
        const registeredPlugins = /* @__PURE__ */ new Map();
        const registerPlugin2 = (pluginName, jsImplementations = {}) => {
          const registeredPlugin = registeredPlugins.get(pluginName);
          if (registeredPlugin) {
            console.warn(`Capacitor plugin "${pluginName}" already registered. Cannot register plugins twice.`);
            return registeredPlugin.proxy;
          }
          const platform = getPlatform();
          const pluginHeader = getPluginHeader(pluginName);
          let jsImplementation;
          const loadPluginImplementation = async () => {
            if (!jsImplementation && platform in jsImplementations) {
              jsImplementation = typeof jsImplementations[platform] === "function" ? jsImplementation = await jsImplementations[platform]() : jsImplementation = jsImplementations[platform];
            } else if (capCustomPlatform !== null && !jsImplementation && "web" in jsImplementations) {
              jsImplementation = typeof jsImplementations["web"] === "function" ? jsImplementation = await jsImplementations["web"]() : jsImplementation = jsImplementations["web"];
            }
            return jsImplementation;
          };
          const createPluginMethod = (impl, prop) => {
            var _a, _b;
            if (pluginHeader) {
              const methodHeader = pluginHeader === null || pluginHeader === void 0 ? void 0 : pluginHeader.methods.find((m) => prop === m.name);
              if (methodHeader) {
                if (methodHeader.rtype === "promise") {
                  return (options) => cap.nativePromise(pluginName, prop.toString(), options);
                } else {
                  return (options, callback) => cap.nativeCallback(pluginName, prop.toString(), options, callback);
                }
              } else if (impl) {
                return (_a = impl[prop]) === null || _a === void 0 ? void 0 : _a.bind(impl);
              }
            } else if (impl) {
              return (_b = impl[prop]) === null || _b === void 0 ? void 0 : _b.bind(impl);
            } else {
              throw new CapacitorException(`"${pluginName}" plugin is not implemented on ${platform}`, ExceptionCode.Unimplemented);
            }
          };
          const createPluginMethodWrapper = (prop) => {
            let remove;
            const wrapper = (...args) => {
              const p = loadPluginImplementation().then((impl) => {
                const fn = createPluginMethod(impl, prop);
                if (fn) {
                  const p2 = fn(...args);
                  remove = p2 === null || p2 === void 0 ? void 0 : p2.remove;
                  return p2;
                } else {
                  throw new CapacitorException(`"${pluginName}.${prop}()" is not implemented on ${platform}`, ExceptionCode.Unimplemented);
                }
              });
              if (prop === "addListener") {
                p.remove = async () => remove();
              }
              return p;
            };
            wrapper.toString = () => `${prop.toString()}() { [capacitor code] }`;
            Object.defineProperty(wrapper, "name", {
              value: prop,
              writable: false,
              configurable: false
            });
            return wrapper;
          };
          const addListener = createPluginMethodWrapper("addListener");
          const removeListener = createPluginMethodWrapper("removeListener");
          const addListenerNative = (eventName, callback) => {
            const call = addListener({ eventName }, callback);
            const remove = async () => {
              const callbackId = await call;
              removeListener({
                eventName,
                callbackId
              }, callback);
            };
            const p = new Promise((resolve) => call.then(() => resolve({ remove })));
            p.remove = async () => {
              console.warn(`Using addListener() without 'await' is deprecated.`);
              await remove();
            };
            return p;
          };
          const proxy = new Proxy({}, {
            get(_, prop) {
              switch (prop) {
                // https://github.com/facebook/react/issues/20030
                case "$$typeof":
                  return void 0;
                case "toJSON":
                  return () => ({});
                case "addListener":
                  return pluginHeader ? addListenerNative : addListener;
                case "removeListener":
                  return removeListener;
                default:
                  return createPluginMethodWrapper(prop);
              }
            }
          });
          Plugins[pluginName] = proxy;
          registeredPlugins.set(pluginName, {
            name: pluginName,
            proxy,
            platforms: /* @__PURE__ */ new Set([...Object.keys(jsImplementations), ...pluginHeader ? [platform] : []])
          });
          return proxy;
        };
        if (!cap.convertFileSrc) {
          cap.convertFileSrc = (filePath) => filePath;
        }
        cap.getPlatform = getPlatform;
        cap.handleError = handleError;
        cap.isNativePlatform = isNativePlatform;
        cap.isPluginAvailable = isPluginAvailable;
        cap.registerPlugin = registerPlugin2;
        cap.Exception = CapacitorException;
        cap.DEBUG = !!cap.DEBUG;
        cap.isLoggingEnabled = !!cap.isLoggingEnabled;
        return cap;
      };
      initCapacitorGlobal = (win) => win.Capacitor = createCapacitor(win);
      Capacitor = /* @__PURE__ */ initCapacitorGlobal(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
      registerPlugin = Capacitor.registerPlugin;
      WebPlugin = class {
        constructor() {
          this.listeners = {};
          this.retainedEventArguments = {};
          this.windowListeners = {};
        }
        addListener(eventName, listenerFunc) {
          let firstListener = false;
          const listeners = this.listeners[eventName];
          if (!listeners) {
            this.listeners[eventName] = [];
            firstListener = true;
          }
          this.listeners[eventName].push(listenerFunc);
          const windowListener = this.windowListeners[eventName];
          if (windowListener && !windowListener.registered) {
            this.addWindowListener(windowListener);
          }
          if (firstListener) {
            this.sendRetainedArgumentsForEvent(eventName);
          }
          const remove = async () => this.removeListener(eventName, listenerFunc);
          const p = Promise.resolve({ remove });
          return p;
        }
        async removeAllListeners() {
          this.listeners = {};
          for (const listener in this.windowListeners) {
            this.removeWindowListener(this.windowListeners[listener]);
          }
          this.windowListeners = {};
        }
        notifyListeners(eventName, data, retainUntilConsumed) {
          const listeners = this.listeners[eventName];
          if (!listeners) {
            if (retainUntilConsumed) {
              let args = this.retainedEventArguments[eventName];
              if (!args) {
                args = [];
              }
              args.push(data);
              this.retainedEventArguments[eventName] = args;
            }
            return;
          }
          listeners.forEach((listener) => listener(data));
        }
        hasListeners(eventName) {
          var _a;
          return !!((_a = this.listeners[eventName]) === null || _a === void 0 ? void 0 : _a.length);
        }
        registerWindowListener(windowEventName, pluginEventName) {
          this.windowListeners[pluginEventName] = {
            registered: false,
            windowEventName,
            pluginEventName,
            handler: (event) => {
              this.notifyListeners(pluginEventName, event);
            }
          };
        }
        unimplemented(msg = "not implemented") {
          return new Capacitor.Exception(msg, ExceptionCode.Unimplemented);
        }
        unavailable(msg = "not available") {
          return new Capacitor.Exception(msg, ExceptionCode.Unavailable);
        }
        async removeListener(eventName, listenerFunc) {
          const listeners = this.listeners[eventName];
          if (!listeners) {
            return;
          }
          const index = listeners.indexOf(listenerFunc);
          this.listeners[eventName].splice(index, 1);
          if (!this.listeners[eventName].length) {
            this.removeWindowListener(this.windowListeners[eventName]);
          }
        }
        addWindowListener(handle) {
          window.addEventListener(handle.windowEventName, handle.handler);
          handle.registered = true;
        }
        removeWindowListener(handle) {
          if (!handle) {
            return;
          }
          window.removeEventListener(handle.windowEventName, handle.handler);
          handle.registered = false;
        }
        sendRetainedArgumentsForEvent(eventName) {
          const args = this.retainedEventArguments[eventName];
          if (!args) {
            return;
          }
          delete this.retainedEventArguments[eventName];
          args.forEach((arg) => {
            this.notifyListeners(eventName, arg);
          });
        }
      };
      encode = (str) => encodeURIComponent(str).replace(/%(2[346B]|5E|60|7C)/g, decodeURIComponent).replace(/[()]/g, escape);
      decode = (str) => str.replace(/(%[\dA-F]{2})+/gi, decodeURIComponent);
      CapacitorCookiesPluginWeb = class extends WebPlugin {
        async getCookies() {
          const cookies = document.cookie;
          const cookieMap = {};
          cookies.split(";").forEach((cookie) => {
            if (cookie.length <= 0)
              return;
            let [key, value] = cookie.replace(/=/, "CAP_COOKIE").split("CAP_COOKIE");
            key = decode(key).trim();
            value = decode(value).trim();
            cookieMap[key] = value;
          });
          return cookieMap;
        }
        async setCookie(options) {
          try {
            const encodedKey = encode(options.key);
            const encodedValue = encode(options.value);
            const expires = options.expires ? `; expires=${options.expires.replace("expires=", "")}` : "";
            const path = (options.path || "/").replace("path=", "");
            const domain = options.url != null && options.url.length > 0 ? `domain=${options.url}` : "";
            document.cookie = `${encodedKey}=${encodedValue || ""}${expires}; path=${path}; ${domain};`;
          } catch (error) {
            return Promise.reject(error);
          }
        }
        async deleteCookie(options) {
          try {
            document.cookie = `${options.key}=; Max-Age=0`;
          } catch (error) {
            return Promise.reject(error);
          }
        }
        async clearCookies() {
          try {
            const cookies = document.cookie.split(";") || [];
            for (const cookie of cookies) {
              document.cookie = cookie.replace(/^ +/, "").replace(/=.*/, `=;expires=${(/* @__PURE__ */ new Date()).toUTCString()};path=/`);
            }
          } catch (error) {
            return Promise.reject(error);
          }
        }
        async clearAllCookies() {
          try {
            await this.clearCookies();
          } catch (error) {
            return Promise.reject(error);
          }
        }
      };
      CapacitorCookies = registerPlugin("CapacitorCookies", {
        web: () => new CapacitorCookiesPluginWeb()
      });
      readBlobAsBase64 = async (blob) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64String = reader.result;
          resolve(base64String.indexOf(",") >= 0 ? base64String.split(",")[1] : base64String);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(blob);
      });
      normalizeHttpHeaders = (headers = {}) => {
        const originalKeys = Object.keys(headers);
        const loweredKeys = Object.keys(headers).map((k) => k.toLocaleLowerCase());
        const normalized = loweredKeys.reduce((acc, key, index) => {
          acc[key] = headers[originalKeys[index]];
          return acc;
        }, {});
        return normalized;
      };
      buildUrlParams = (params, shouldEncode = true) => {
        if (!params)
          return null;
        const output = Object.entries(params).reduce((accumulator, entry) => {
          const [key, value] = entry;
          let encodedValue;
          let item;
          if (Array.isArray(value)) {
            item = "";
            value.forEach((str) => {
              encodedValue = shouldEncode ? encodeURIComponent(str) : str;
              item += `${key}=${encodedValue}&`;
            });
            item.slice(0, -1);
          } else {
            encodedValue = shouldEncode ? encodeURIComponent(value) : value;
            item = `${key}=${encodedValue}`;
          }
          return `${accumulator}&${item}`;
        }, "");
        return output.substr(1);
      };
      buildRequestInit = (options, extra = {}) => {
        const output = Object.assign({ method: options.method || "GET", headers: options.headers }, extra);
        const headers = normalizeHttpHeaders(options.headers);
        const type = headers["content-type"] || "";
        if (typeof options.data === "string") {
          output.body = options.data;
        } else if (type.includes("application/x-www-form-urlencoded")) {
          const params = new URLSearchParams();
          for (const [key, value] of Object.entries(options.data || {})) {
            params.set(key, value);
          }
          output.body = params.toString();
        } else if (type.includes("multipart/form-data") || options.data instanceof FormData) {
          const form = new FormData();
          if (options.data instanceof FormData) {
            options.data.forEach((value, key) => {
              form.append(key, value);
            });
          } else {
            for (const key of Object.keys(options.data)) {
              form.append(key, options.data[key]);
            }
          }
          output.body = form;
          const headers2 = new Headers(output.headers);
          headers2.delete("content-type");
          output.headers = headers2;
        } else if (type.includes("application/json") || typeof options.data === "object") {
          output.body = JSON.stringify(options.data);
        }
        return output;
      };
      CapacitorHttpPluginWeb = class extends WebPlugin {
        /**
         * Perform an Http request given a set of options
         * @param options Options to build the HTTP request
         */
        async request(options) {
          const requestInit = buildRequestInit(options, options.webFetchExtra);
          const urlParams = buildUrlParams(options.params, options.shouldEncodeUrlParams);
          const url = urlParams ? `${options.url}?${urlParams}` : options.url;
          const response = await fetch(url, requestInit);
          const contentType = response.headers.get("content-type") || "";
          let { responseType = "text" } = response.ok ? options : {};
          if (contentType.includes("application/json")) {
            responseType = "json";
          }
          let data;
          let blob;
          switch (responseType) {
            case "arraybuffer":
            case "blob":
              blob = await response.blob();
              data = await readBlobAsBase64(blob);
              break;
            case "json":
              data = await response.json();
              break;
            case "document":
            case "text":
            default:
              data = await response.text();
          }
          const headers = {};
          response.headers.forEach((value, key) => {
            headers[key] = value;
          });
          return {
            data,
            headers,
            status: response.status,
            url: response.url
          };
        }
        /**
         * Perform an Http GET request given a set of options
         * @param options Options to build the HTTP request
         */
        async get(options) {
          return this.request(Object.assign(Object.assign({}, options), { method: "GET" }));
        }
        /**
         * Perform an Http POST request given a set of options
         * @param options Options to build the HTTP request
         */
        async post(options) {
          return this.request(Object.assign(Object.assign({}, options), { method: "POST" }));
        }
        /**
         * Perform an Http PUT request given a set of options
         * @param options Options to build the HTTP request
         */
        async put(options) {
          return this.request(Object.assign(Object.assign({}, options), { method: "PUT" }));
        }
        /**
         * Perform an Http PATCH request given a set of options
         * @param options Options to build the HTTP request
         */
        async patch(options) {
          return this.request(Object.assign(Object.assign({}, options), { method: "PATCH" }));
        }
        /**
         * Perform an Http DELETE request given a set of options
         * @param options Options to build the HTTP request
         */
        async delete(options) {
          return this.request(Object.assign(Object.assign({}, options), { method: "DELETE" }));
        }
      };
      CapacitorHttp = registerPlugin("CapacitorHttp", {
        web: () => new CapacitorHttpPluginWeb()
      });
      (function(SystemBarsStyle2) {
        SystemBarsStyle2["Dark"] = "DARK";
        SystemBarsStyle2["Light"] = "LIGHT";
        SystemBarsStyle2["Default"] = "DEFAULT";
      })(SystemBarsStyle || (SystemBarsStyle = {}));
      (function(SystemBarType2) {
        SystemBarType2["StatusBar"] = "StatusBar";
        SystemBarType2["NavigationBar"] = "NavigationBar";
      })(SystemBarType || (SystemBarType = {}));
      SystemBarsPluginWeb = class extends WebPlugin {
        async setStyle() {
          this.unavailable("not available for web");
        }
        async setAnimation() {
          this.unavailable("not available for web");
        }
        async show() {
          this.unavailable("not available for web");
        }
        async hide() {
          this.unavailable("not available for web");
        }
      };
      SystemBars = registerPlugin("SystemBars", {
        web: () => new SystemBarsPluginWeb()
      });
    }
  });

  // node_modules/@capacitor/app/dist/esm/web.js
  var web_exports = {};
  __export(web_exports, {
    AppWeb: () => AppWeb
  });
  var AppWeb;
  var init_web = __esm({
    "node_modules/@capacitor/app/dist/esm/web.js"() {
      init_dist();
      AppWeb = class extends WebPlugin {
        constructor() {
          super();
          this.handleVisibilityChange = () => {
            const data = {
              isActive: document.hidden !== true
            };
            this.notifyListeners("appStateChange", data);
            if (document.hidden) {
              this.notifyListeners("pause", null);
            } else {
              this.notifyListeners("resume", null);
            }
          };
          document.addEventListener("visibilitychange", this.handleVisibilityChange, false);
        }
        exitApp() {
          throw this.unimplemented("Not implemented on web.");
        }
        async getInfo() {
          throw this.unimplemented("Not implemented on web.");
        }
        async getLaunchUrl() {
          return { url: "" };
        }
        async getState() {
          return { isActive: document.hidden !== true };
        }
        async minimizeApp() {
          throw this.unimplemented("Not implemented on web.");
        }
        async toggleBackButtonHandler() {
          throw this.unimplemented("Not implemented on web.");
        }
        async getAppLanguage() {
          return {
            value: navigator.language.split("-")[0].toLowerCase()
          };
        }
      };
    }
  });

  // node_modules/@capacitor/app/dist/esm/index.js
  init_dist();
  var App = registerPlugin("App", {
    web: () => Promise.resolve().then(() => (init_web(), web_exports)).then((m) => new m.AppWeb())
  });

  // src/app.js
  init_dist();

  // src/ledger-schema.mjs
  var STORAGE_KEY = "zhiji.local.v1";
  var SCHEMA_VERSION = 2;
  var DEFAULT_BOOK_ID = "book-default";
  var DEFAULT_CURRENCY = "CNY";
  var TRANSACTION_TYPES = /* @__PURE__ */ new Set([
    "expense",
    "income",
    "transfer",
    "borrow",
    "lend",
    "repayment",
    "collection",
    "payable",
    "receivable"
  ]);
  var DEFAULT_CATEGORIES = [
    { id: "cat-food", name: "\u9910\u996E", color: "#d87945", kind: "expense" },
    { id: "cat-transport", name: "\u4EA4\u901A", color: "#3f7d86", kind: "expense" },
    { id: "cat-shopping", name: "\u8D2D\u7269", color: "#9a5f7a", kind: "expense" },
    { id: "cat-home", name: "\u5C45\u4F4F", color: "#6d7f4e", kind: "expense" },
    { id: "cat-phone", name: "\u901A\u8BAF", color: "#5370a5", kind: "expense" },
    { id: "cat-health", name: "\u533B\u7597", color: "#b75555", kind: "expense" },
    { id: "cat-study", name: "\u6559\u80B2", color: "#7a66a5", kind: "expense" },
    { id: "cat-fun", name: "\u5A31\u4E50", color: "#c48a3d", kind: "expense" },
    { id: "cat-salary", name: "\u5DE5\u8D44", color: "#237b66", kind: "income" },
    { id: "cat-bonus", name: "\u5956\u91D1", color: "#4d8f70", kind: "income" },
    { id: "cat-transfer", name: "\u8F6C\u8D26", color: "#73807b", kind: "transfer" },
    { id: "cat-other", name: "\u5176\u4ED6", color: "#7e8581", kind: "expense" }
  ];
  var DEFAULT_ACCOUNTS = [
    { id: "acc-cash", name: "\u73B0\u91D1", type: "cash", initialBalance: 0 },
    { id: "acc-wechat", name: "\u5FAE\u4FE1", type: "wallet", initialBalance: 0 },
    { id: "acc-alipay", name: "\u652F\u4ED8\u5B9D", type: "wallet", initialBalance: 0 },
    { id: "acc-bank", name: "\u94F6\u884C\u5361", type: "bank", initialBalance: 0 }
  ];
  var ARRAY_COLLECTIONS = [
    "members",
    "tagGroups",
    "tags",
    "merchantGroups",
    "merchants",
    "budgets",
    "schedules",
    "installments",
    "templates",
    "recycleBin"
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
    if (["\u5DE5\u8D44", "\u5956\u91D1"].includes(item.name)) return "income";
    if (item.name === "\u8F6C\u8D26") return "transfer";
    return "expense";
  }
  function accountType(item) {
    if (item.type) return item.type;
    if (["\u5FAE\u4FE1", "\u652F\u4ED8\u5B9D"].includes(item.name)) return "wallet";
    if (item.name.includes("\u94F6\u884C")) return "bank";
    return "cash";
  }
  function createDefaultLedger(now = (/* @__PURE__ */ new Date()).toISOString()) {
    return {
      version: SCHEMA_VERSION,
      activeBookId: DEFAULT_BOOK_ID,
      baseCurrency: DEFAULT_CURRENCY,
      settings: {
        monthlyBudget: 5e3,
        weekStartsOn: 1,
        monthStartsOn: 1,
        amountHidden: false
      },
      books: [{
        id: DEFAULT_BOOK_ID,
        name: "\u6211\u7684\u8D26\u672C",
        color: "#1f6650",
        icon: "ledger",
        monthlyBudget: 5e3,
        hidden: false,
        order: 0,
        createdAt: now
      }],
      categories: DEFAULT_CATEGORIES.map((item, order) => ({
        ...item,
        bookId: DEFAULT_BOOK_ID,
        parentId: null,
        order,
        hidden: false,
        deletedAt: null
      })),
      accounts: DEFAULT_ACCOUNTS.map((item, order) => ({
        ...item,
        currencyCode: DEFAULT_CURRENCY,
        includeInNetAssets: true,
        hidden: false,
        order,
        credit: null,
        deletedAt: null
      })),
      transactions: [],
      members: [],
      tagGroups: [],
      tags: [],
      merchantGroups: [],
      merchants: [],
      budgets: [],
      schedules: [],
      installments: [],
      templates: [],
      currencies: [{ code: DEFAULT_CURRENCY, name: "\u4EBA\u6C11\u5E01", symbol: "\xA5", rate: 1 }],
      recycleBin: [],
      metadata: {
        createdAt: now,
        lastSavedAt: null,
        lastSyncedAt: null,
        dataUpdatedAt: now,
        revision: 0,
        deviceId: null,
        lastSyncedRevision: null,
        migratedFrom: null
      }
    };
  }
  function normalizeLedger(raw, now = (/* @__PURE__ */ new Date()).toISOString()) {
    const fallback = createDefaultLedger(now);
    if (!raw || typeof raw !== "object") return fallback;
    const sourceVersion = finiteNumber(raw.version, 1);
    const books = Array.isArray(raw.books) && raw.books.some(validEntity) ? raw.books.filter(validEntity).map((book, order) => ({
      ...book,
      name: String(book.name || `\u8D26\u672C ${order + 1}`),
      monthlyBudget: Math.max(0, finiteNumber(
        book.monthlyBudget,
        book.id === (raw.activeBookId || DEFAULT_BOOK_ID) ? raw.settings?.monthlyBudget : fallback.settings.monthlyBudget
      )),
      hidden: Boolean(book.hidden),
      order: finiteNumber(book.order, order),
      createdAt: book.createdAt || raw.metadata?.createdAt || now
    })) : fallback.books.map((book) => ({
      ...book,
      monthlyBudget: Math.max(0, finiteNumber(raw.settings?.monthlyBudget, book.monthlyBudget))
    }));
    const requestedBookId = raw.activeBookId || DEFAULT_BOOK_ID;
    const activeBookId = books.some((book) => book.id === requestedBookId) ? requestedBookId : books[0].id;
    const categories = Array.isArray(raw.categories) ? raw.categories.filter((item) => validEntity(item) && item.name).map((item, order) => ({
      ...item,
      name: String(item.name),
      color: item.color || "#7e8581",
      kind: categoryKind(item),
      bookId: item.bookId || activeBookId,
      parentId: item.parentId || null,
      order: finiteNumber(item.order, order),
      hidden: Boolean(item.hidden),
      deletedAt: item.deletedAt || null
    })) : [];
    const accounts = Array.isArray(raw.accounts) ? raw.accounts.filter((item) => validEntity(item) && item.name).map((item, order) => ({
      ...item,
      name: String(item.name),
      type: accountType(item),
      initialBalance: finiteNumber(item.initialBalance),
      currencyCode: item.currencyCode || raw.baseCurrency || DEFAULT_CURRENCY,
      includeInNetAssets: item.includeInNetAssets !== false,
      hidden: Boolean(item.hidden),
      order: finiteNumber(item.order, order),
      credit: item.credit && typeof item.credit === "object" ? item.credit : null,
      deletedAt: item.deletedAt || null
    })) : [];
    const transactions = Array.isArray(raw.transactions) ? raw.transactions.filter((item) => validEntity(item) && TRANSACTION_TYPES.has(item.type) && finiteNumber(item.amount) > 0 && item.accountId && item.date).map((item) => ({
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
      reconciled: Boolean(item.reconciled),
      deletedAt: item.deletedAt || null
    })) : [];
    const monthlyBudget = finiteNumber(raw.settings?.monthlyBudget, fallback.settings.monthlyBudget);
    const state = {
      ...fallback,
      version: SCHEMA_VERSION,
      activeBookId,
      baseCurrency: raw.baseCurrency || DEFAULT_CURRENCY,
      settings: {
        ...fallback.settings,
        ...raw.settings && typeof raw.settings === "object" ? raw.settings : {},
        monthlyBudget: monthlyBudget >= 0 ? monthlyBudget : fallback.settings.monthlyBudget
      },
      books,
      categories: categories.length ? categories : fallback.categories,
      accounts: accounts.length ? accounts : fallback.accounts,
      transactions,
      currencies: Array.isArray(raw.currencies) && raw.currencies.length ? raw.currencies.filter((item) => item && item.code).map((item) => ({
        ...item,
        rate: finiteNumber(item.rate, 1) || 1
      })) : fallback.currencies,
      metadata: {
        ...fallback.metadata,
        ...raw.metadata && typeof raw.metadata === "object" ? raw.metadata : {},
        migratedFrom: sourceVersion < SCHEMA_VERSION ? sourceVersion : raw.metadata?.migratedFrom || null
      }
    };
    ARRAY_COLLECTIONS.forEach((name) => {
      state[name] = Array.isArray(raw[name]) ? raw[name].filter(validEntity) : fallback[name];
    });
    return state;
  }

  // src/ledger-domain.mjs
  var MONEY_SCALE = 100;
  function roundMoney(value) {
    return Math.round((Number(value) || 0) * MONEY_SCALE) / MONEY_SCALE;
  }
  function formatLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  function advanceRecurringDate(value, frequency) {
    const [year, month, day] = String(value).split("-").map(Number);
    if (![year, month, day].every(Number.isFinite)) throw new Error("\u5468\u671F\u65E5\u671F\u65E0\u6548");
    const date = new Date(year, month - 1, day);
    if (frequency === "weekly") date.setDate(date.getDate() + 7);
    else if (frequency === "monthly") {
      const lastDay = new Date(year, month + 1, 0).getDate();
      date.setFullYear(year, month, Math.min(day, lastDay));
    } else if (frequency === "yearly") {
      const lastDay = new Date(year + 1, month, 0).getDate();
      date.setFullYear(year + 1, month - 1, Math.min(day, lastDay));
    } else {
      throw new Error("\u4E0D\u652F\u6301\u7684\u5468\u671F\u9891\u7387");
    }
    return formatLocalDate(date);
  }
  function installmentAmount(totalAmount, periods, paidPeriods) {
    const total = roundMoney(totalAmount);
    const count = Number(periods);
    const paid = Number(paidPeriods);
    if (total <= 0 || !Number.isInteger(count) || count < 2) throw new Error("\u5206\u671F\u53C2\u6570\u65E0\u6548");
    if (!Number.isInteger(paid) || paid < 0 || paid >= count) throw new Error("\u5206\u671F\u671F\u6570\u5DF2\u5B8C\u6210\u6216\u65E0\u6548");
    const regular = roundMoney(total / count);
    return paid === count - 1 ? roundMoney(total - regular * (count - 1)) : regular;
  }
  function calculateAccountBalances(state, bookId = null) {
    const currencyRates = Object.fromEntries((state.currencies || []).map((currency) => [currency.code, currency.rate || 1]));
    const balances = Object.fromEntries(state.accounts.filter((account) => !account.deletedAt).map((account) => [account.id, roundMoney(account.initialBalance * (currencyRates[account.currencyCode] || 1))]));
    const transactions = state.transactions.filter((item) => !item.deletedAt && item.status !== "pending" && (!bookId || item.bookId === bookId));
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
  function validateTransaction(input, state) {
    const amount = roundMoney(input.amount);
    if (amount <= 0) throw new Error("\u91D1\u989D\u5FC5\u987B\u5927\u4E8E 0");
    const exchangeRate = Number(input.exchangeRate ?? 1);
    if (!(exchangeRate > 0)) throw new Error("\u6C47\u7387\u5FC5\u987B\u5927\u4E8E 0");
    if (!state.books.some((item) => item.id === input.bookId && !item.hidden)) throw new Error("\u8D26\u672C\u4E0D\u5B58\u5728\u6216\u5DF2\u9690\u85CF");
    if (!state.accounts.some((item) => item.id === input.accountId && !item.deletedAt)) throw new Error("\u8D26\u6237\u4E0D\u5B58\u5728");
    if (input.type === "transfer") {
      if (!input.targetAccountId) throw new Error("\u8BF7\u9009\u62E9\u8F6C\u5165\u8D26\u6237");
      if (input.targetAccountId === input.accountId) throw new Error("\u8F6C\u51FA\u8D26\u6237\u548C\u8F6C\u5165\u8D26\u6237\u4E0D\u80FD\u76F8\u540C");
    }
    if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("\u8BF7\u9009\u62E9\u6709\u6548\u65E5\u671F");
    return { ...input, amount, exchangeRate };
  }

  // src/native-webdav.mjs
  init_dist();
  function bytesToBase64(bytes) {
    let binary = "";
    for (let index = 0; index < bytes.length; index += 32768) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
    }
    return btoa(binary);
  }
  function webDavErrorMessage(statusCode) {
    if (statusCode === 401 || statusCode === 403) return "\u8BA4\u8BC1\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u575A\u679C\u4E91\u8D26\u53F7\u4E0E\u5E94\u7528\u5BC6\u7801";
    if (statusCode === 404) return "\u4E91\u7AEF\u6587\u4EF6\u4E0D\u5B58\u5728";
    if (statusCode === 409) return "\u4E91\u7AEF\u76EE\u5F55\u4E0D\u5B58\u5728\u6216\u8DEF\u5F84\u51B2\u7A81";
    if (statusCode >= 500) return `\u575A\u679C\u4E91\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528\uFF08${statusCode}\uFF09`;
    return `WebDAV \u8BF7\u6C42\u5931\u8D25\uFF08${statusCode}\uFF09`;
  }
  function normalizeConfig(payload, requireRemotePath = false) {
    const baseUrl = String(payload.baseUrl || "").trim();
    const username = String(payload.username || "").trim();
    const password = String(payload.password || "");
    const remotePath = String(payload.remotePath || "").trim();
    if (!baseUrl || !username || !password) throw new Error("\u8BF7\u586B\u5199 WebDAV \u5730\u5740\u3001\u8D26\u53F7\u548C\u5E94\u7528\u5BC6\u7801");
    const parsedUrl = new URL(baseUrl);
    if (parsedUrl.protocol !== "https:") throw new Error("\u5B89\u5353 App \u7684 WebDAV \u5730\u5740\u5FC5\u987B\u4F7F\u7528 https");
    if (requireRemotePath && !remotePath) throw new Error("\u8BF7\u586B\u5199\u4E91\u7AEF\u6587\u4EF6\u8DEF\u5F84");
    const segments = remotePath.replace(/^\/+/, "").split("/").filter(Boolean);
    if (segments.some((segment) => segment === "." || segment === "..")) throw new Error("\u4E91\u7AEF\u6587\u4EF6\u8DEF\u5F84\u4E0D\u5408\u6CD5");
    return { baseUrl, username, password, remotePath, segments };
  }
  function buildUrl(baseUrl, segments = []) {
    const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    return new URL(segments.map((segment) => encodeURIComponent(segment)).join("/"), normalizedBase).toString();
  }
  async function sendRequest(config, method, segments, data, extraHeaders, request) {
    const credentials = new TextEncoder().encode(`${config.username}:${config.password}`);
    return request({
      url: buildUrl(config.baseUrl, segments),
      method,
      headers: {
        Authorization: `Basic ${bytesToBase64(credentials)}`,
        "User-Agent": "Zhiji-Android/0.3",
        ...extraHeaders
      },
      data,
      responseType: "text",
      connectTimeout: 15e3,
      readTimeout: 15e3
    });
  }
  async function ensureCollections(config, request) {
    const directories = config.segments.slice(0, -1);
    for (let index = 1; index <= directories.length; index += 1) {
      const result = await sendRequest(config, "MKCOL", directories.slice(0, index), void 0, {}, request);
      if (!(result.status >= 200 && result.status < 300) && result.status !== 405) {
        throw new Error(webDavErrorMessage(result.status));
      }
    }
  }
  async function nativeWebDavAction(path, payload, request = (options) => CapacitorHttp.request(options)) {
    if (path === "/api/webdav/test") {
      const config = normalizeConfig(payload);
      const result = await sendRequest(
        config,
        "PROPFIND",
        [],
        '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:displayname/></d:prop></d:propfind>',
        { Depth: "0", "Content-Type": "application/xml; charset=utf-8" },
        request
      );
      if (![200, 207].includes(result.status)) throw new Error(webDavErrorMessage(result.status));
      return { ok: true, message: "\u575A\u679C\u4E91\u8FDE\u63A5\u6210\u529F" };
    }
    if (path === "/api/webdav/upload") {
      const config = normalizeConfig(payload, true);
      if (typeof payload.content !== "string" || !payload.content) throw new Error("\u6CA1\u6709\u53EF\u4E0A\u4F20\u7684\u5907\u4EFD\u5185\u5BB9");
      await ensureCollections(config, request);
      const result = await sendRequest(
        config,
        "PUT",
        config.segments,
        payload.content,
        { "Content-Type": "application/json; charset=utf-8" },
        request
      );
      if (!(result.status >= 200 && result.status < 300)) throw new Error(webDavErrorMessage(result.status));
      return { ok: true, message: "\u52A0\u5BC6\u5907\u4EFD\u5DF2\u4E0A\u4F20\u5230\u575A\u679C\u4E91" };
    }
    if (path === "/api/webdav/download") {
      const config = normalizeConfig(payload, true);
      const result = await sendRequest(config, "GET", config.segments, void 0, {}, request);
      if (result.status === 404) return { ok: true, exists: false, content: null, modifiedAt: null };
      if (!(result.status >= 200 && result.status < 300)) throw new Error(webDavErrorMessage(result.status));
      return {
        ok: true,
        exists: true,
        content: typeof result.data === "string" ? result.data : JSON.stringify(result.data),
        modifiedAt: result.headers?.["last-modified"] || null
      };
    }
    throw new Error("\u539F\u751F\u540C\u6B65\u63A5\u53E3\u4E0D\u5B58\u5728");
  }

  // src/secure-store.mjs
  init_dist();
  var memoryStore = { value: "" };
  var SecureStore = registerPlugin("SecureStore", {
    web: () => Promise.resolve({
      async save(options) {
        memoryStore.value = String(options.value || "");
      },
      async load() {
        return { value: memoryStore.value };
      },
      async clear() {
        memoryStore.value = "";
      }
    })
  });
  async function saveSecureSyncConfig(config) {
    await SecureStore.save({ value: JSON.stringify(config) });
  }
  async function loadSecureSyncConfig() {
    const result = await SecureStore.load();
    if (!result.value) return null;
    return JSON.parse(result.value);
  }
  async function clearSecureSyncConfig() {
    await SecureStore.clear();
  }
  function isNativeSecureStore() {
    return Capacitor.isNativePlatform();
  }

  // src/voice-input.mjs
  init_dist();
  var VoiceInput = registerPlugin("VoiceInput", {
    web: () => Promise.resolve({
      start() {
        const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!Recognition) return Promise.reject(new Error("\u5F53\u524D\u6D4F\u89C8\u5668\u4E0D\u652F\u6301\u8BED\u97F3\u8BC6\u522B"));
        return new Promise((resolve, reject) => {
          const recognition = new Recognition();
          recognition.lang = "zh-CN";
          recognition.interimResults = false;
          recognition.maxAlternatives = 1;
          recognition.onresult = (event) => resolve({ text: event.results[0][0].transcript });
          recognition.onerror = () => reject(new Error("\u8BED\u97F3\u8BC6\u522B\u5931\u8D25"));
          recognition.onnomatch = () => reject(new Error("\u6CA1\u6709\u8BC6\u522B\u5230\u8BED\u97F3\u5185\u5BB9"));
          recognition.start();
        });
      }
    })
  });
  async function captureVoiceInput() {
    const result = await VoiceInput.start();
    return String(result.text || "").trim();
  }

  // src/auto-booking.mjs
  init_dist();
  var emptyStatus = { notificationAccess: false, accessibilityAccess: false, smsPermission: false };
  var AutoBooking = registerPlugin("AutoBooking", {
    web: () => Promise.resolve({
      async getStatus() {
        return emptyStatus;
      },
      async openNotificationAccess() {
        throw new Error("\u8BF7\u5728 Android App \u4E2D\u5F00\u542F\u901A\u77E5\u81EA\u52A8\u8BB0\u8D26");
      },
      async openAccessibilityAccess() {
        throw new Error("\u8BF7\u5728 Android App \u4E2D\u5F00\u542F\u65E0\u969C\u788D\u81EA\u52A8\u8BB0\u8D26");
      },
      async drainNotifications() {
        return { items: [] };
      },
      async readSms() {
        return { items: [] };
      }
    })
  });
  var getAutoBookingStatus = () => AutoBooking.getStatus();
  var openNotificationAccess = () => AutoBooking.openNotificationAccess();
  var openAccessibilityAccess = () => AutoBooking.openAccessibilityAccess();
  var loadNotificationCandidates = () => AutoBooking.drainNotifications();
  var loadSmsCandidates = () => AutoBooking.readSms();

  // src/ledger-widget.mjs
  init_dist();
  var LedgerWidget = registerPlugin("LedgerWidget", {
    web: () => Promise.resolve({ async update() {
    } })
  });
  function updateLedgerWidget(summary) {
    return LedgerWidget.update(summary);
  }

  // src/app.js
  (() => {
    "use strict";
    const SYNC_CONFIG_KEY = "zhiji.sync.config.v1";
    const APP_VERSION = SCHEMA_VERSION;
    const CATEGORY_RULES = [
      ["\u9910\u996E", ["\u65E9\u9910", "\u5348\u996D", "\u5348\u9910", "\u665A\u996D", "\u665A\u9910", "\u5403\u996D", "\u5496\u5561", "\u5976\u8336", "\u5916\u5356", "\u9910\u5385", "\u9762\u5305"]],
      ["\u4EA4\u901A", ["\u6253\u8F66", "\u51FA\u79DF", "\u5730\u94C1", "\u516C\u4EA4", "\u9AD8\u94C1", "\u706B\u8F66", "\u673A\u7968", "\u52A0\u6CB9", "\u505C\u8F66", "\u6EF4\u6EF4"]],
      ["\u8D2D\u7269", ["\u4E70\u4E86", "\u8D2D\u7269", "\u6DD8\u5B9D", "\u4EAC\u4E1C", "\u8D85\u5E02", "\u8863\u670D", "\u978B", "\u65E5\u7528\u54C1"]],
      ["\u5C45\u4F4F", ["\u623F\u79DF", "\u7269\u4E1A", "\u6C34\u8D39", "\u7535\u8D39", "\u71C3\u6C14", "\u5BB6\u5177"]],
      ["\u901A\u8BAF", ["\u8BDD\u8D39", "\u6D41\u91CF", "\u5BBD\u5E26", "\u624B\u673A\u8D39"]],
      ["\u533B\u7597", ["\u533B\u9662", "\u770B\u75C5", "\u836F", "\u4F53\u68C0", "\u6302\u53F7"]],
      ["\u6559\u80B2", ["\u8BFE\u7A0B", "\u5B66\u8D39", "\u4E66", "\u57F9\u8BAD", "\u8003\u8BD5"]],
      ["\u5A31\u4E50", ["\u7535\u5F71", "\u6E38\u620F", "\u6F14\u51FA", "\u5531\u6B4C", "\u65C5\u884C", "\u95E8\u7968"]],
      ["\u5DE5\u8D44", ["\u5DE5\u8D44", "\u85AA\u8D44", "\u53D1\u85AA"]],
      ["\u5956\u91D1", ["\u5956\u91D1", "\u7EA2\u5305", "\u5206\u7EA2"]],
      ["\u8F6C\u8D26", ["\u8F6C\u8D26", "\u8F6C\u7ED9", "\u8F6C\u5165", "\u8F6C\u51FA"]]
    ];
    const ACCOUNT_RULES = [
      ["\u5FAE\u4FE1", ["\u5FAE\u4FE1", "\u96F6\u94B1"]],
      ["\u652F\u4ED8\u5B9D", ["\u652F\u4ED8\u5B9D", "\u82B1\u5457"]],
      ["\u73B0\u91D1", ["\u73B0\u91D1"]],
      ["\u94F6\u884C\u5361", ["\u94F6\u884C\u5361", "\u94F6\u884C", "\u62DB\u884C", "\u62DB\u5546", "\u5DE5\u884C", "\u5EFA\u884C", "\u519C\u884C", "\u4E2D\u884C", "\u4FE1\u7528\u5361"]]
    ];
    const VIEW_TITLES = {
      home: "\u6211\u7684\u8D26\u672C",
      record: "\u8BB0\u4E00\u7B14",
      stats: "\u6536\u652F\u7EDF\u8BA1",
      plans: "\u9884\u7B97\u4E0E\u8BA1\u5212",
      search: "\u641C\u7D22\u8D26\u76EE",
      books: "\u8D26\u672C\u7BA1\u7406",
      settings: "\u8BBE\u7F6E\u4E0E\u540C\u6B65"
    };
    const TRANSACTION_TYPE_LABELS = {
      expense: "\u652F\u51FA",
      income: "\u6536\u5165",
      transfer: "\u8F6C\u8D26",
      borrow: "\u501F\u5165",
      lend: "\u501F\u51FA",
      repayment: "\u8FD8\u6B3E",
      collection: "\u6536\u6B3E",
      payable: "\u5E94\u4ED8",
      receivable: "\u5E94\u6536"
    };
    const POSITIVE_TRANSACTION_TYPES = /* @__PURE__ */ new Set(["income", "borrow", "collection"]);
    const NEGATIVE_TRANSACTION_TYPES = /* @__PURE__ */ new Set(["expense", "lend", "repayment"]);
    const ACCOUNT_TYPE_LABELS = {
      cash: "\u73B0\u91D1",
      wallet: "\u7535\u5B50\u94B1\u5305",
      bank: "\u94F6\u884C\u5361",
      credit: "\u4FE1\u7528\u8D26\u6237",
      asset: "\u8D44\u4EA7",
      liability: "\u8D1F\u503A"
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
        state.metadata.dataUpdatedAt = (/* @__PURE__ */ new Date()).toISOString();
      }
      state.metadata.lastSavedAt = (/* @__PURE__ */ new Date()).toISOString();
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
        income: `\u6536\u5165 ${formatMoney(income)}`,
        expense: `\u652F\u51FA ${formatMoney(expense)}`
      }).catch(() => {
      });
    }
    function cacheElements() {
      document.querySelectorAll("[id]").forEach((element) => {
        elements[toCamelCase(element.id)] = element;
      });
    }
    function toCamelCase(value) {
      return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    }
    function localDate(date = /* @__PURE__ */ new Date()) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    function monthKey(dateValue = localDate()) {
      return String(dateValue).slice(0, 7);
    }
    function offsetDate(days) {
      const date = /* @__PURE__ */ new Date();
      date.setDate(date.getDate() + days);
      return localDate(date);
    }
    function formatMoney(value, signed = false) {
      const amount = Number(value) || 0;
      const absolute = Math.abs(amount).toLocaleString("zh-CN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      if (!signed) return `\xA5${absolute}`;
      const prefix = amount > 0 ? "+" : amount < 0 ? "-" : "";
      return `${prefix}\xA5${absolute}`;
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
      return `${month}\u6708${day}\u65E5 ${["\u5468\u65E5", "\u5468\u4E00", "\u5468\u4E8C", "\u5468\u4E09", "\u5468\u56DB", "\u5468\u4E94", "\u5468\u516D"][date.getDay()]}`;
    }
    function formatTime(value) {
      if (!value) return "\u7B49\u5F85\u9996\u6B21\u8BB0\u8D26";
      const date = new Date(value);
      return `\u4FDD\u5B58\u4E8E ${date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
    }
    function escapeHtml(value) {
      return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
    }
    function categoryById(id) {
      return state.categories.find((item) => item.id === id) || { name: "\u5176\u4ED6", color: "#7e8581" };
    }
    function activeBook() {
      return state.books.find((item) => item.id === state.activeBookId) || state.books[0];
    }
    function currentCategories() {
      return state.categories.filter((item) => item.bookId === state.activeBookId && !item.hidden && !item.deletedAt);
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
      return state.accounts.find((item) => item.id === id) || { name: "\u672A\u77E5\u8D26\u6237" };
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
      const now = /* @__PURE__ */ new Date();
      elements.todayText.textContent = now.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long"
      });
      elements.lastSaveText.textContent = formatTime(state.metadata.lastSavedAt);
      if (state.metadata.lastSyncedAt) {
        elements.syncBadge.classList.add("is-synced");
        elements.syncBadge.lastChild.textContent = `\u5DF2\u540C\u6B65 ${new Date(state.metadata.lastSyncedAt).toLocaleDateString("zh-CN")}`;
      } else {
        elements.syncBadge.classList.remove("is-synced");
        elements.syncBadge.lastChild.textContent = "\u672A\u540C\u6B65";
      }
    }
    function renderSelects() {
      const categories = currentCategories();
      const members = currentMembers();
      const tags = currentTags();
      const merchants = currentMerchants();
      const categoryOptions = categories.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("");
      const accountOptions = state.accounts.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("");
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
      elements.activeBookSelect.innerHTML = books.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("");
      elements.activeBookSelect.value = state.activeBookId;
      const selectedMember = elements.transactionMember.value;
      elements.transactionMember.innerHTML = '<option value="">\u65E0\u6210\u5458</option>' + members.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("");
      if (members.some((item) => item.id === selectedMember)) elements.transactionMember.value = selectedMember;
      const selectedMerchant = elements.transactionMerchant.value;
      elements.transactionMerchant.innerHTML = '<option value="">\u65E0\u5546\u5BB6</option>' + merchants.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("");
      if (merchants.some((item) => item.id === selectedMerchant)) elements.transactionMerchant.value = selectedMerchant;
      const selectedTags = new Set([...elements.transactionTags.querySelectorAll("input:checked")].map((item) => item.value));
      elements.transactionTags.innerHTML = tags.length ? tags.map((item) => `<label class="choice-item"><input type="checkbox" value="${escapeHtml(item.id)}"${selectedTags.has(item.id) ? " checked" : ""} /><span>${escapeHtml(item.name)}</span></label>`).join("") : '<span class="muted-inline">\u6682\u65E0\u6807\u7B7E</span>';
      const selectedCurrency = elements.transactionCurrency.value || state.baseCurrency;
      elements.transactionCurrency.innerHTML = state.currencies.map((item) => `<option value="${escapeHtml(item.code)}">${escapeHtml(item.code)} \xB7 ${escapeHtml(item.name)}</option>`).join("");
      elements.transactionCurrency.value = state.currencies.some((item) => item.code === selectedCurrency) ? selectedCurrency : state.baseCurrency;
      const selectedAccountCurrency = elements.newAccountCurrency.value || state.baseCurrency;
      elements.newAccountCurrency.innerHTML = state.currencies.map((item) => `<option value="${escapeHtml(item.code)}">${escapeHtml(item.code)} \xB7 ${escapeHtml(item.name)}</option>`).join("");
      elements.newAccountCurrency.value = state.currencies.some((item) => item.code === selectedAccountCurrency) ? selectedAccountCurrency : state.baseCurrency;
      const selectedSearchType = elements.searchType.value;
      elements.searchType.innerHTML = '<option value="">\u5168\u90E8\u7C7B\u578B</option>' + Object.entries(TRANSACTION_TYPE_LABELS).map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
      elements.searchType.value = selectedSearchType;
      const selectedSearchAccount = elements.searchAccount.value;
      elements.searchAccount.innerHTML = '<option value="">\u5168\u90E8\u8D26\u6237</option>' + accountOptions;
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
      const budgetPercent = budget > 0 ? Math.round(expense / budget * 100) : 0;
      elements.totalBalance.textContent = totalBalance < 0 ? formatMoney(totalBalance, true) : formatMoney(totalBalance);
      elements.accountCount.textContent = `${state.accounts.length} \u4E2A\u8D26\u6237`;
      elements.monthIncome.textContent = formatMoney(income);
      elements.incomeCount.textContent = `${incomeTransactions.length} \u7B14\u6536\u5165`;
      elements.monthExpense.textContent = formatMoney(expense);
      elements.expenseCount.textContent = `${expenseTransactions.length} \u7B14\u652F\u51FA`;
      elements.budgetPercent.textContent = budget > 0 ? `${budgetPercent}%` : "\u672A\u8BBE\u7F6E";
      elements.budgetRemaining.textContent = budget > 0 ? `${budget - expense >= 0 ? "\u5269\u4F59" : "\u8D85\u51FA"} ${formatMoney(Math.abs(budget - expense))}` : "\u5C1A\u672A\u8BBE\u7F6E\u9884\u7B97";
      elements.budgetTotal.textContent = `\u9884\u7B97 ${formatMoney(budget)}`;
      elements.budgetProgress.style.width = `${Math.min(100, budgetPercent)}%`;
      elements.budgetProgress.classList.toggle("is-over", budgetPercent > 100);
      renderDailyChart(expenseTransactions);
      renderTransactionList(elements.recentTransactions, sortedTransactions(currentTransactions()).slice(0, 8));
    }
    function renderDailyChart(expenseTransactions) {
      const now = /* @__PURE__ */ new Date();
      const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const daily = Array.from({ length: days }, () => 0);
      expenseTransactions.forEach((item) => {
        const day = Number(item.date.slice(8, 10));
        if (day >= 1 && day <= days) daily[day - 1] += baseAmount(item);
      });
      const max = Math.max(...daily, 1);
      elements.dailyChart.innerHTML = daily.map((value, index) => {
        const height = value ? Math.max(7, Math.round(value / max * 100)) : 3;
        return `<span class="mini-bar" style="height:${height}%" title="${index + 1}\u65E5\uFF1A${formatMoney(value)}"></span>`;
      }).join("");
      const elapsedDays = Math.max(1, now.getDate());
      const total = daily.reduce((sum, value) => sum + value, 0);
      elements.dailyAverage.textContent = `\u65E5\u5747 ${formatMoney(total / elapsedDays)}`;
    }
    function renderTransactionList(container, transactions) {
      if (!transactions.length) {
        container.innerHTML = '<div class="empty-state"><strong>\u8FD8\u6CA1\u6709\u8D26\u76EE</strong><span>\u4ECE\u4E00\u53E5\u8BDD\u6216\u624B\u52A8\u8BB0\u8D26\u5F00\u59CB</span></div>';
        return;
      }
      container.innerHTML = transactions.map((item) => {
        const category = categoryById(item.categoryId);
        const account = accountById(item.accountId);
        const target = item.targetAccountId ? accountById(item.targetAccountId) : null;
        const typeText = TRANSACTION_TYPE_LABELS[item.type] || item.type;
        const convertedAmount = baseAmount(item);
        const amountValue = POSITIVE_TRANSACTION_TYPES.has(item.type) ? convertedAmount : NEGATIVE_TRANSACTION_TYPES.has(item.type) ? -convertedAmount : 0;
        const amountClass = POSITIVE_TRANSACTION_TYPES.has(item.type) ? "income-text" : NEGATIVE_TRANSACTION_TYPES.has(item.type) ? "expense-text" : "";
        const accountText = target ? `${account.name} \u2192 ${target.name}` : account.name;
        const note = item.note || category.name;
        const amountText = ["transfer", "payable", "receivable"].includes(item.type) ? formatMoney(convertedAmount) : formatMoney(amountValue, true);
        const statusText = item.status === "pending" ? " \xB7 \u5F85\u5904\u7406" : "";
        const currency = currencyByCode(item.currencyCode);
        const originalText = item.currencyCode !== state.baseCurrency ? ` \xB7 ${escapeHtml(currency.symbol)}${item.amount}` : "";
        const memberNames = (item.memberShares || []).map((share) => state.members.find((member) => member.id === share.memberId)?.name).filter(Boolean);
        const merchantName = state.merchants.find((merchant) => merchant.id === item.merchantId)?.name;
        const dimensionText = [merchantName, ...memberNames].filter(Boolean).join(" \xB7 ");
        return `
        <article class="transaction-item" data-id="${escapeHtml(item.id)}">
          <span class="category-mark" style="background:${escapeHtml(category.color)}">${escapeHtml(category.name.slice(0, 1))}</span>
          <div class="transaction-main"><strong>${escapeHtml(note)}</strong><small>${escapeHtml(category.name)} \xB7 ${typeText}${statusText}${originalText}${dimensionText ? ` \xB7 ${escapeHtml(dimensionText)}` : ""}</small></div>
          <div class="transaction-meta"><strong>${escapeHtml(accountText)}</strong><small>${formatShortDate(item.date)}</small></div>
          <span class="transaction-amount ${amountClass}">${amountText}</span>
          <div class="transaction-actions">
            <button class="row-action edit" type="button" data-action="edit" title="\u7F16\u8F91" aria-label="\u7F16\u8F91">\u270E</button>
            <button class="row-action delete" type="button" data-action="delete" title="\u5220\u9664" aria-label="\u5220\u9664">\xD7</button>
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
      const categoryTotals = /* @__PURE__ */ new Map();
      expenseTransactions.forEach((item) => {
        categoryTotals.set(item.categoryId, (categoryTotals.get(item.categoryId) || 0) + baseAmount(item));
      });
      const categoryRows = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]);
      elements.categoryStats.innerHTML = categoryRows.length ? categoryRows.map(([id, amount]) => {
        const category = categoryById(id);
        const percent = expense > 0 ? Math.round(amount / expense * 100) : 0;
        return `<div class="stat-row">
            <span class="stat-row-label"><i class="color-dot" style="background:${escapeHtml(category.color)}"></i>${escapeHtml(category.name)}</span>
            <span class="stat-bar"><span style="width:${percent}%;background:${escapeHtml(category.color)}"></span></span>
            <strong>${formatMoney(amount)} \xB7 ${percent}%</strong>
          </div>`;
      }).join("") : '<div class="empty-state"><strong>\u672C\u6708\u6682\u65E0\u652F\u51FA</strong><span>\u65B0\u589E\u652F\u51FA\u540E\u4F1A\u663E\u793A\u5206\u7C7B\u5360\u6BD4</span></div>';
      const balances = accountBalances();
      const maxBalance = Math.max(...Object.values(balances).map((value) => Math.abs(value)), 1);
      elements.accountStats.innerHTML = state.accounts.map((account) => {
        const balance = balances[account.id] || 0;
        const width = Math.max(2, Math.round(Math.abs(balance) / maxBalance * 100));
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
      elements.categoryTotal.textContent = `${categories.length} \u4E2A`;
      elements.accountTotal.textContent = `${state.accounts.length} \u4E2A`;
      elements.currencyTotal.textContent = `${state.currencies.length} \u4E2A`;
      elements.appLockStatus.textContent = state.settings.appLock ? "\u5DF2\u5F00\u542F" : "\u672A\u5F00\u542F";
      elements.lockTimeout.value = String(state.settings.appLock?.timeoutMinutes ?? 5);
      elements.categoryList.innerHTML = categories.map((item) => `<span class="tag-item"><i class="color-dot" style="background:${escapeHtml(item.color)}"></i>${escapeHtml(item.name)}<button type="button" data-category-id="${escapeHtml(item.id)}" data-category-action="rename" title="\u91CD\u547D\u540D\u5206\u7C7B" aria-label="\u91CD\u547D\u540D\u5206\u7C7B">\u270E</button><button type="button" data-category-id="${escapeHtml(item.id)}" data-category-action="delete" title="\u5220\u9664\u5206\u7C7B" aria-label="\u5220\u9664\u5206\u7C7B">\xD7</button></span>`).join("");
      const balances = accountBalances();
      elements.accountList.innerHTML = state.accounts.map((item) => `<div class="account-manage-item"><span>${escapeHtml(item.name)} \xB7 ${escapeHtml(ACCOUNT_TYPE_LABELS[item.type] || "\u8D26\u6237")}</span><strong>${formatMoney(balances[item.id] || 0, true)}</strong><button type="button" data-account-id="${escapeHtml(item.id)}" data-account-action="rename" title="\u91CD\u547D\u540D\u8D26\u6237" aria-label="\u91CD\u547D\u540D\u8D26\u6237">\u270E</button><button type="button" data-account-id="${escapeHtml(item.id)}" data-account-action="delete" title="\u5220\u9664\u8D26\u6237" aria-label="\u5220\u9664\u8D26\u6237">\xD7</button></div>`).join("");
      elements.currencyList.innerHTML = state.currencies.map((item) => `<span class="tag-item">${escapeHtml(item.code)} \xB7 ${escapeHtml(item.symbol)} \xB7 ${escapeHtml(item.name)} \xB7 ${item.rate}<button type="button" data-currency-code="${escapeHtml(item.code)}" title="\u5220\u9664\u5E01\u79CD" aria-label="\u5220\u9664\u5E01\u79CD">\xD7</button></span>`).join("");
      const dimensions = [
        ["member", currentMembers(), elements.memberTotal, elements.memberList],
        ["tag", currentTags(), elements.tagTotal, elements.tagList],
        ["merchant", currentMerchants(), elements.merchantTotal, elements.merchantList]
      ];
      dimensions.forEach(([kind, items, totalElement, listElement]) => {
        totalElement.textContent = `${items.length} \u4E2A`;
        listElement.innerHTML = items.length ? items.map((item) => `<span class="tag-item">${escapeHtml(item.name)}<button type="button" data-${kind}-id="${escapeHtml(item.id)}" title="\u5220\u9664${escapeHtml(item.name)}" aria-label="\u5220\u9664${escapeHtml(item.name)}">\xD7</button></span>`).join("") : '<span class="muted-inline">\u6682\u65E0</span>';
      });
      elements.recycleList.innerHTML = state.recycleBin.length ? [...state.recycleBin].reverse().map((item) => {
        const label = item.entityType === "book" ? `\u8D26\u672C\uFF1A${item.payload?.book?.name || "\u672A\u547D\u540D"}` : `\u8D26\u76EE\uFF1A${item.payload?.note || formatMoney(item.payload?.amount)}`;
        return `<article class="plan-item" data-trash-id="${escapeHtml(item.id)}"><div class="plan-copy"><strong>${escapeHtml(label)}</strong><small>${new Date(item.deletedAt).toLocaleString("zh-CN")}</small></div><div class="plan-actions"><button class="book-action" type="button" data-trash-action="restore">\u6062\u590D</button><button class="book-action danger" type="button" data-trash-action="delete">\u5F7B\u5E95\u5220\u9664</button></div></article>`;
      }).join("") : '<div class="empty-state"><strong>\u56DE\u6536\u7AD9\u4E3A\u7A7A</strong></div>';
      renderAutoBookingCandidates();
    }
    function renderAutoBookingCandidates() {
      elements.autoBookingList.innerHTML = autoBookingCandidates.length ? autoBookingCandidates.map((item) => `<article class="plan-item" data-candidate-id="${escapeHtml(item.id)}"><div class="plan-copy"><strong>${escapeHtml(item.text)}</strong><small>${escapeHtml(item.source || "\u7CFB\u7EDF")} \xB7 ${new Date(Number(item.createdAt) || Date.now()).toLocaleString("zh-CN")}</small></div><div class="plan-actions"><button class="book-action" type="button" data-candidate-action="parse">\u89E3\u6790</button><button class="book-action danger" type="button" data-candidate-action="dismiss">\u5FFD\u7565</button></div></article>`).join("") : '<div class="empty-state"><strong>\u6682\u65E0\u5019\u9009</strong></div>';
    }
    async function refreshAutoBookingStatus() {
      try {
        const status = await getAutoBookingStatus();
        const labels = [];
        if (status.notificationAccess) labels.push("\u901A\u77E5");
        if (status.accessibilityAccess) labels.push("\u65E0\u969C\u788D");
        if (status.smsPermission) labels.push("\u77ED\u4FE1");
        elements.autoBookingStatus.textContent = labels.length ? `${labels.join(" \xB7 ")}\u5DF2\u6388\u6743` : "\u672A\u6388\u6743";
      } catch {
        elements.autoBookingStatus.textContent = "\u72B6\u6001\u4E0D\u53EF\u7528";
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
        return [item.note, category, account, target, merchant, ...members, ...tags].join(" ").toLocaleLowerCase("zh-CN").includes(query);
      });
      elements.searchTotal.textContent = `${transactions.length} \u7B14`;
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
        const percent = budget.amount > 0 ? Math.round(spent / budget.amount * 100) : 0;
        return `<article class="plan-item" data-budget-id="${escapeHtml(budget.id)}">
        <div class="plan-copy"><strong>${escapeHtml(categoryById(budget.categoryId).name)} \xB7 ${formatMoney(spent)} / ${formatMoney(budget.amount)}</strong><small>${percent}%</small><div class="plan-progress"><span style="width:${Math.min(100, percent)}%;background:${percent > 100 ? "var(--expense)" : "var(--income)"}"></span></div></div>
        <div class="plan-actions"><button class="book-action danger" type="button" data-plan-action="delete-budget">\u5220\u9664</button></div>
      </article>`;
      }).join("") : '<div class="empty-state"><strong>\u6682\u65E0\u5206\u7C7B\u9884\u7B97</strong></div>';
      elements.goalList.innerHTML = goals.length ? goals.map((goal) => {
        const percent = goal.targetAmount > 0 ? Math.round(goal.currentAmount / goal.targetAmount * 100) : 0;
        return `<article class="plan-item" data-goal-id="${escapeHtml(goal.id)}">
        <div class="plan-copy"><strong>${escapeHtml(goal.name)} \xB7 ${formatMoney(goal.currentAmount)} / ${formatMoney(goal.targetAmount)}</strong><small>${Math.min(100, percent)}%</small><div class="plan-progress"><span style="width:${Math.min(100, percent)}%"></span></div></div>
        <div class="plan-actions"><button class="book-action" type="button" data-plan-action="deposit-goal">\u5B58\u5165</button><button class="book-action danger" type="button" data-plan-action="delete-goal">\u5220\u9664</button></div>
      </article>`;
      }).join("") : '<div class="empty-state"><strong>\u6682\u65E0\u50A8\u84C4\u76EE\u6807</strong></div>';
      const frequencyLabels = { weekly: "\u6BCF\u5468", monthly: "\u6BCF\u6708", yearly: "\u6BCF\u5E74" };
      elements.scheduleList.innerHTML = schedules.length ? schedules.map((schedule) => `<article class="plan-item" data-schedule-id="${escapeHtml(schedule.id)}"><div class="plan-copy"><strong>${escapeHtml(schedule.name)} \xB7 ${formatMoney(schedule.amount)}</strong><small>${frequencyLabels[schedule.frequency]} \xB7 \u4E0B\u6B21 ${schedule.nextDate}</small></div><div class="plan-actions"><button class="book-action" type="button" data-plan-action="run-schedule">\u8BB0\u8D26</button><button class="book-action danger" type="button" data-plan-action="delete-schedule">\u5220\u9664</button></div></article>`).join("") : '<div class="empty-state"><strong>\u6682\u65E0\u5468\u671F\u8D26</strong></div>';
      elements.installmentList.innerHTML = installments.length ? installments.map((plan) => {
        const complete = plan.paidPeriods >= plan.periods;
        return `<article class="plan-item" data-installment-id="${escapeHtml(plan.id)}"><div class="plan-copy"><strong>${escapeHtml(plan.name)} \xB7 ${formatMoney(plan.totalAmount)}</strong><small>\u5DF2\u8BB0 ${plan.paidPeriods}/${plan.periods} \u671F${complete ? " \xB7 \u5DF2\u5B8C\u6210" : ` \xB7 \u4E0B\u671F ${plan.nextDate}`}</small><div class="plan-progress"><span style="width:${Math.round(plan.paidPeriods / plan.periods * 100)}%"></span></div></div><div class="plan-actions">${complete ? "" : '<button class="book-action" type="button" data-plan-action="run-installment">\u8BB0\u4E0B\u4E00\u671F</button>'}<button class="book-action danger" type="button" data-plan-action="delete-installment">\u5220\u9664</button></div></article>`;
      }).join("") : '<div class="empty-state"><strong>\u6682\u65E0\u5206\u671F\u8BA1\u5212</strong></div>';
      const reimbursements = currentTransactions().filter((item) => item.type === "expense" && item.reimburseStatus === "pending");
      const reimbursementTotal = reimbursements.reduce((sum, item) => sum + baseAmount(item), 0);
      elements.reimbursementTotal.textContent = formatMoney(reimbursementTotal);
      elements.reimbursementList.innerHTML = reimbursements.length ? reimbursements.map((item) => `<article class="plan-item" data-reimbursement-id="${escapeHtml(item.id)}"><div class="plan-copy"><strong>${escapeHtml(item.note || categoryById(item.categoryId).name)} \xB7 ${formatMoney(baseAmount(item))}</strong><small>${item.date} \xB7 ${escapeHtml(accountById(item.accountId).name)}</small></div><div class="plan-actions"><button class="book-action" type="button" data-plan-action="settle-reimbursement">\u786E\u8BA4\u5230\u8D26</button></div></article>`).join("") : '<div class="empty-state"><strong>\u6682\u65E0\u5F85\u62A5\u9500\u8D26\u76EE</strong></div>';
    }
    function renderTemplates() {
      const templates = state.templates.filter((item) => item.bookId === state.activeBookId);
      elements.templateList.innerHTML = templates.length ? templates.map((item) => `<article class="plan-item" data-template-id="${escapeHtml(item.id)}"><div class="plan-copy"><strong>${escapeHtml(item.name)}</strong><small>${TRANSACTION_TYPE_LABELS[item.values.type] || item.values.type} \xB7 ${formatMoney(baseAmount(item.values))} \xB7 ${escapeHtml(categoryById(item.values.categoryId).name)}</small></div><div class="plan-actions"><button class="book-action" type="button" data-template-action="apply">\u4F7F\u7528</button><button class="book-action danger" type="button" data-template-action="delete">\u5220\u9664</button></div></article>`).join("") : '<div class="empty-state"><strong>\u6682\u65E0\u6A21\u677F</strong></div>';
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
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }, state);
    }
    function renderBooks() {
      const books = state.books.filter((item) => !item.hidden);
      elements.bookTotal.textContent = `${books.length} \u4E2A\u8D26\u672C`;
      elements.bookList.innerHTML = books.map((book) => {
        const transactionCount = state.transactions.filter((item) => item.bookId === book.id && !item.deletedAt).length;
        const categoryCount = state.categories.filter((item) => item.bookId === book.id && !item.deletedAt).length;
        const activeClass = book.id === state.activeBookId ? " is-active" : "";
        return `<article class="book-item${activeClass}" data-book-id="${escapeHtml(book.id)}">
        <span class="book-color" style="background:${escapeHtml(book.color || "#1f6650")}"></span>
        <div class="book-copy">
          <strong>${escapeHtml(book.name)}</strong>
          <small>${transactionCount} \u7B14\u8D26\u76EE \xB7 ${categoryCount} \u4E2A\u5206\u7C7B \xB7 \u6708\u9884\u7B97 ${formatMoney(book.monthlyBudget)}</small>
        </div>
        <div class="book-actions">
          ${book.id === state.activeBookId ? "" : '<button class="book-action" type="button" data-book-action="switch">\u5207\u6362</button>'}
          <button class="book-action" type="button" data-book-action="rename">\u91CD\u547D\u540D</button>
          <button class="book-action danger" type="button" data-book-action="delete">\u5220\u9664</button>
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
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("\u91D1\u989D\u5FC5\u987B\u5927\u4E8E 0");
      const targetAccountId = type === "transfer" ? elements.transactionTargetAccount.value : null;
      if (type === "transfer" && targetAccountId === elements.transactionAccount.value) {
        throw new Error("\u8F6C\u51FA\u8D26\u6237\u548C\u8F6C\u5165\u8D26\u6237\u4E0D\u80FD\u76F8\u540C");
      }
      return validateTransaction({
        bookId: state.activeBookId,
        type,
        amount,
        categoryId: type === "transfer" ? categoryIdByName("\u8F6C\u8D26") : elements.transactionCategory.value,
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
        memberShares: elements.transactionMember.value ? [{ memberId: elements.transactionMember.value, ratio: 1, amount }] : [],
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
      elements.transactionTime.value = (/* @__PURE__ */ new Date()).toTimeString().slice(0, 5);
      elements.transactionCurrency.value = state.baseCurrency;
      elements.transactionExchangeRate.value = currencyByCode(state.baseCurrency).rate;
      transactionPhotos = [];
      transactionLocation = null;
      elements.transactionPhotos.value = "";
      elements.transactionPhotoStatus.textContent = "\u672A\u9009\u62E9\u7167\u7247";
      elements.transactionLocationStatus.textContent = "\u672A\u8BB0\u5F55\u4F4D\u7F6E";
      elements.recordFormTitle.textContent = "\u8BB0\u5F55\u4E00\u7B14\u8D26";
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
      transactionPhotos = [...item.photos || []];
      transactionLocation = item.location || null;
      elements.transactionPhotoStatus.textContent = transactionPhotos.length ? `\u5DF2\u4FDD\u7559 ${transactionPhotos.length} \u5F20\u7167\u7247` : "\u672A\u9009\u62E9\u7167\u7247";
      elements.transactionLocationStatus.textContent = transactionLocation ? "\u5DF2\u8BB0\u5F55\u4F4D\u7F6E" : "\u672A\u8BB0\u5F55\u4F4D\u7F6E";
      elements.transactionMember.value = item.memberShares?.[0]?.memberId || "";
      elements.transactionMerchant.value = item.merchantId || "";
      const selectedTags = new Set(item.tagIds || []);
      elements.transactionTags.querySelectorAll("input").forEach((input) => {
        input.checked = selectedTags.has(input.value);
      });
      elements.transactionNote.value = item.note || "";
      elements.recordFormTitle.textContent = "\u7F16\u8F91\u8FD9\u7B14\u8D26";
      elements.cancelEditButton.classList.remove("is-hidden");
      updateTransferFields("transaction");
      elements.transactionAmount.focus();
    }
    function deleteTransaction(id) {
      const item = state.transactions.find((transaction) => transaction.id === id);
      if (!item) return;
      if (!window.confirm(`\u786E\u5B9A\u5220\u9664\u201C${item.note || categoryById(item.categoryId).name}\u201D\u8FD9\u7B14\u8BB0\u5F55\u5417\uFF1F`)) return;
      state.recycleBin.push({
        id: makeId("trash"),
        entityType: "transaction",
        deletedAt: (/* @__PURE__ */ new Date()).toISOString(),
        payload: structuredClone(item)
      });
      state.transactions = state.transactions.filter((transaction) => transaction.id !== id);
      saveState("\u8D26\u76EE\u5DF2\u79FB\u5165\u56DE\u6536\u7AD9");
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
      const incomeKeywords = ["\u6536\u5165", "\u5DE5\u8D44", "\u85AA\u8D44", "\u5230\u8D26", "\u5956\u91D1", "\u8D5A\u4E86", "\u6536\u6B3E", "\u62A5\u9500"];
      const transferKeywords = ["\u8F6C\u8D26", "\u8F6C\u7ED9", "\u8F6C\u5165", "\u8F6C\u51FA", "\u5212\u5230"];
      const expenseKeywords = ["\u82B1\u4E86", "\u652F\u51FA", "\u652F\u4ED8", "\u4E70\u4E86", "\u6D88\u8D39", "\u4ED8\u4E86"];
      let type = "expense";
      if (transferKeywords.some((keyword) => value.includes(keyword))) type = "transfer";
      else if (incomeKeywords.some((keyword) => value.includes(keyword))) type = "income";
      else if (expenseKeywords.some((keyword) => value.includes(keyword))) type = "expense";
      const currencyMatch = value.match(/(?:¥|￥)\s*(\d+(?:\.\d{1,2})?)/) || value.match(/(\d+(?:\.\d{1,2})?)\s*(?:元|块钱|块)/);
      const numberMatches = [...value.matchAll(/\d+(?:\.\d{1,2})?/g)].map((match) => Number(match[0]));
      const amount = currencyMatch ? Number(currencyMatch[1]) : numberMatches.at(-1) || 0;
      let categoryName = type === "income" ? "\u5176\u4ED6" : type === "transfer" ? "\u8F6C\u8D26" : "\u5176\u4ED6";
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
      if (value.includes("\u524D\u5929")) {
        date = offsetDate(-2);
        dateMatched = true;
      } else if (value.includes("\u6628\u5929")) {
        date = offsetDate(-1);
        dateMatched = true;
      } else if (value.includes("\u4ECA\u5929")) {
        dateMatched = true;
      }
      const explicitDate = value.match(/(?:(\d{4})[年/-])?(\d{1,2})[月/-](\d{1,2})日?/);
      if (explicitDate) {
        const year = Number(explicitDate[1] || (/* @__PURE__ */ new Date()).getFullYear());
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
        showToast("\u8BF7\u5148\u63CF\u8FF0\u4E00\u7B14\u6536\u652F", true);
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
      elements.parseConfidence.textContent = `\u8BC6\u522B\u7F6E\u4FE1\u5EA6 ${result.confidence}%`;
      updateTransferFields("parsed");
      elements.parseDialog.showModal();
    }
    async function runVoiceInput(button, input) {
      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = "\u6B63\u5728\u8046\u542C\u2026";
      try {
        const text = await captureVoiceInput();
        if (!text) throw new Error("\u6CA1\u6709\u8BC6\u522B\u5230\u8BED\u97F3\u5185\u5BB9");
        input.value = text;
        openParseDialog(text);
      } catch (error) {
        showToast(error.message || "\u8BED\u97F3\u8F93\u5165\u5931\u8D25", true);
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
    function saveParsedTransaction() {
      const type = document.querySelector('input[name="parsed-type"]:checked').value;
      const amount = Number(elements.parsedAmount.value);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("\u8BF7\u786E\u8BA4\u6709\u6548\u91D1\u989D");
      const targetAccountId = type === "transfer" ? elements.parsedTargetAccount.value : null;
      if (type === "transfer" && targetAccountId === elements.parsedAccount.value) {
        throw new Error("\u8F6C\u51FA\u8D26\u6237\u548C\u8F6C\u5165\u8D26\u6237\u4E0D\u80FD\u76F8\u540C");
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      state.transactions.push({
        id: makeId("tx"),
        bookId: state.activeBookId,
        type,
        amount: Math.round(amount * 100) / 100,
        categoryId: type === "transfer" ? categoryIdByName("\u8F6C\u8D26") : elements.parsedCategory.value,
        accountId: elements.parsedAccount.value,
        targetAccountId,
        date: elements.parsedDate.value,
        note: elements.parsedNote.value.trim(),
        time: (/* @__PURE__ */ new Date()).toTimeString().slice(0, 5),
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
      saveState("\u5DF2\u4FDD\u5B58\u5230\u672C\u5730\u8D26\u672C");
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
        elements.webdavPath.value = config.remotePath || "\u667A\u8BB0/zhiji-backup.enc.json";
      } catch {
        localStorage.removeItem(SYNC_CONFIG_KEY);
      }
    }
    function saveSyncConfig(config) {
      localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify({
        baseUrl: config.baseUrl,
        username: config.username,
        remotePath: config.remotePath
      }));
    }
    function getSyncConfig() {
      if (!elements.syncForm.reportValidity()) throw new Error("\u8BF7\u5148\u5B8C\u6574\u586B\u5199\u540C\u6B65\u914D\u7F6E");
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
      elements.credentialStorageNote.textContent = isNativeSecureStore() ? "\u81EA\u52A8\u540C\u6B65\u51ED\u636E\u5DF2\u7531 Android Keystore \u52A0\u5BC6\u4FDD\u5B58\u3002" : "\u6D4F\u89C8\u5668\u9884\u89C8\u4EC5\u5728\u5F53\u524D\u9875\u9762\u4F1A\u8BDD\u4E2D\u4FDD\u7559\u81EA\u52A8\u540C\u6B65\u51ED\u636E\u3002";
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
        elements.credentialStorageNote.textContent = isNativeSecureStore() ? "\u81EA\u52A8\u540C\u6B65\u51ED\u636E\u5DF2\u7531 Android Keystore \u52A0\u5BC6\u4FDD\u5B58\u3002" : "\u6D4F\u89C8\u5668\u9884\u89C8\u4EC5\u5728\u5F53\u524D\u9875\u9762\u4F1A\u8BDD\u4E2D\u4FDD\u7559\u81EA\u52A8\u540C\u6B65\u51ED\u636E\u3002";
        scheduleAutoBackup();
      } catch (error) {
        setSyncResult(error.message || "\u81EA\u52A8\u540C\u6B65\u914D\u7F6E\u8BFB\u53D6\u5931\u8D25", true);
      }
    }
    function scheduleAutoBackup() {
      clearTimeout(autoSyncTimer);
      if (!secureSyncConfig?.autoEnabled || syncInProgress) return;
      const revision = Number(state.metadata.revision || 0);
      if (state.metadata.lastSyncedRevision === revision) return;
      autoSyncTimer = setTimeout(() => {
        uploadBackup(secureSyncConfig, { automatic: true }).catch((error) => {
          setSyncResult(`\u81EA\u52A8\u540C\u6B65\u6682\u505C\uFF1A${error.message}`, true);
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
      const result = await response.json().catch(() => ({ ok: false, message: "\u670D\u52A1\u8FD4\u56DE\u4E86\u65E0\u6CD5\u8BC6\u522B\u7684\u5185\u5BB9" }));
      if (!response.ok || !result.ok) throw new Error(result.message || `\u8BF7\u6C42\u5931\u8D25\uFF08${response.status}\uFF09`);
      return result;
    }
    function bytesToBase642(bytes) {
      let binary = "";
      for (let index = 0; index < bytes.length; index += 32768) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
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
        { name: "PBKDF2", salt, iterations: 18e4, hash: "SHA-256" },
        material,
        256
      );
      return bytesToBase642(new Uint8Array(bits));
    }
    async function verifyPin(pin) {
      const lock = state.settings.appLock;
      if (!lock) return true;
      return await hashPin(pin, base64ToBytes(lock.salt)) === lock.hash;
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
      const timeoutMs = Number(lock.timeoutMinutes || 0) * 60 * 1e3;
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
        { name: "PBKDF2", salt, iterations: 21e4, hash: "SHA-256" },
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
        exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
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
        salt: bytesToBase642(salt),
        iv: bytesToBase642(iv),
        data: bytesToBase642(new Uint8Array(encrypted)),
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    async function decryptBackup(content, passphrase) {
      let envelope;
      try {
        envelope = JSON.parse(content);
      } catch {
        throw new Error("\u4E91\u7AEF\u6587\u4EF6\u4E0D\u662F\u6709\u6548\u7684\u667A\u8BB0\u5907\u4EFD");
      }
      if (envelope.format !== "zhiji-encrypted-backup" || !envelope.salt || !envelope.iv || !envelope.data) {
        throw new Error("\u4E91\u7AEF\u6587\u4EF6\u683C\u5F0F\u4E0D\u53D7\u652F\u6301");
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
        throw new Error("\u89E3\u5BC6\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u540C\u6B65\u5BC6\u94A5\u662F\u5426\u6B63\u786E");
      }
    }
    async function downloadRemoteState(config) {
      try {
        const result = await apiRequest("/api/webdav/download", config);
        if (result.exists === false) return null;
        return { state: await decryptBackup(result.content, config.syncKey), modifiedAt: result.modifiedAt };
      } catch (error) {
        if (String(error.message).includes("\u4E91\u7AEF\u6587\u4EF6\u4E0D\u5B58\u5728")) return null;
        throw error;
      }
    }
    function hasSyncConflict(remoteState) {
      if (!remoteState?.metadata?.deviceId || remoteState.metadata.deviceId === state.metadata.deviceId) return false;
      const localRevision = Number(state.metadata.revision || 0);
      const localChanged = state.metadata.lastSyncedRevision == null ? state.transactions.length > 0 : localRevision > Number(state.metadata.lastSyncedRevision);
      const remoteUpdatedAt = Date.parse(remoteState.metadata.dataUpdatedAt || 0);
      const lastSyncedAt = Date.parse(state.metadata.lastSyncedAt || 0);
      return localChanged && remoteUpdatedAt > lastSyncedAt;
    }
    async function uploadBackup(config, options = {}) {
      if (syncInProgress) throw new Error("\u5DF2\u6709\u540C\u6B65\u4EFB\u52A1\u6B63\u5728\u8FDB\u884C");
      syncInProgress = true;
      try {
        const remote = await downloadRemoteState(config);
        if (remote && hasSyncConflict(remote.state)) {
          if (options.automatic) throw new Error("\u4E91\u7AEF\u5B58\u5728\u53E6\u4E00\u8BBE\u5907\u7684\u65B0\u7248\u672C\uFF0C\u8BF7\u624B\u52A8\u9009\u62E9\u4E0A\u4F20\u6216\u6062\u590D");
          if (!window.confirm("\u4E91\u7AEF\u5B58\u5728\u53E6\u4E00\u8BBE\u5907\u7684\u65B0\u7248\u672C\u3002\u7EE7\u7EED\u4E0A\u4F20\u4F1A\u8986\u76D6\u4E91\u7AEF\uFF0C\u786E\u5B9A\u7EE7\u7EED\u5417\uFF1F")) {
            throw new Error("\u5DF2\u53D6\u6D88\u8986\u76D6\u4E91\u7AEF\u7248\u672C");
          }
        }
        const revision = Number(state.metadata.revision || 0);
        const content = await encryptBackup(config.syncKey);
        const result = await apiRequest("/api/webdav/upload", { ...config, content });
        state.metadata.lastSyncedAt = (/* @__PURE__ */ new Date()).toISOString();
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
      setTimeout(() => URL.revokeObjectURL(url), 1e3);
    }
    function escapeXml(value) {
      return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
    }
    function exportExcelXml() {
      const headers = ["\u7C7B\u578B", "\u91D1\u989D", "\u5E01\u79CD", "\u6C47\u7387", "\u5206\u7C7B", "\u8D26\u6237", "\u8F6C\u5165\u8D26\u6237", "\u65E5\u671F", "\u65F6\u95F4", "\u5907\u6CE8", "\u72B6\u6001", "\u62A5\u9500\u72B6\u6001", "\u5546\u5BB6", "\u6210\u5458", "\u6807\u7B7E"];
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
      if (documentNode.querySelector("parsererror")) throw new Error("Excel XML \u6587\u4EF6\u683C\u5F0F\u65E0\u6548");
      const rows = [...documentNode.getElementsByTagNameNS("*", "Row")].map((row) => [...row.getElementsByTagNameNS("*", "Cell")].map((cell) => cell.textContent || ""));
      if (rows.length < 2) throw new Error("\u6587\u4EF6\u4E2D\u6CA1\u6709\u53EF\u5BFC\u5165\u7684\u8D26\u76EE");
      const headers = rows[0];
      const requiredHeaders = ["\u7C7B\u578B", "\u91D1\u989D", "\u5206\u7C7B", "\u8D26\u6237", "\u65E5\u671F"];
      if (requiredHeaders.some((header) => !headers.includes(header))) throw new Error("Excel XML \u7F3A\u5C11\u5FC5\u8981\u5217");
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
          category = { id: makeId("cat"), bookId: working.activeBookId, name: name || "\u5BFC\u5165\u5206\u7C7B", color: "#7e8581", kind: type === "income" ? "income" : type === "transfer" ? "transfer" : "expense", parentId: null, order: working.categories.length, hidden: false, deletedAt: null };
          working.categories.push(category);
        }
        return category.id;
      };
      rows.slice(1).filter((row) => row.some(Boolean)).forEach((row, rowIndex) => {
        const type = typeByLabel[row[index["\u7C7B\u578B"]]] || row[index["\u7C7B\u578B"]];
        if (!TRANSACTION_TYPE_LABELS[type]) throw new Error(`\u7B2C ${rowIndex + 2} \u884C\u7C7B\u578B\u4E0D\u53D7\u652F\u6301`);
        const amount = Number(row[index["\u91D1\u989D"]]);
        const currencyCode = String(index["\u5E01\u79CD"] === void 0 ? working.baseCurrency : row[index["\u5E01\u79CD"]] || working.baseCurrency).toUpperCase();
        const exchangeRate = Number(index["\u6C47\u7387"] === void 0 ? 1 : row[index["\u6C47\u7387"]]);
        if (!/^[A-Z]{3}$/.test(currencyCode)) throw new Error(`\u7B2C ${rowIndex + 2} \u884C\u5E01\u79CD\u4EE3\u7801\u65E0\u6548`);
        if (!(exchangeRate > 0)) throw new Error(`\u7B2C ${rowIndex + 2} \u884C\u6C47\u7387\u65E0\u6548`);
        if (!working.currencies.some((item) => item.code === currencyCode)) {
          working.currencies.push({ code: currencyCode, name: currencyCode, symbol: currencyCode, rate: exchangeRate });
        }
        const accountId = resolveAccount(row[index["\u8D26\u6237"]]);
        const targetAccountId = resolveAccount(row[index["\u8F6C\u5165\u8D26\u6237"]]) || null;
        const categoryId = resolveCategory(row[index["\u5206\u7C7B"]], type);
        const now = (/* @__PURE__ */ new Date()).toISOString();
        imported.push(validateTransaction({
          id: makeId("tx"),
          bookId: working.activeBookId,
          type,
          amount,
          categoryId,
          accountId,
          targetAccountId,
          date: row[index["\u65E5\u671F"]],
          time: row[index["\u65F6\u95F4"]] || "12:00",
          note: row[index["\u5907\u6CE8"]] || "",
          status: row[index["\u72B6\u6001"]] || "posted",
          reimburseStatus: row[index["\u62A5\u9500\u72B6\u6001"]] || "none",
          currencyCode,
          exchangeRate,
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
        if (!window.confirm("\u5BFC\u5165\u5B8C\u6574 JSON \u4F1A\u8986\u76D6\u5F53\u524D\u8BBE\u5907\u6570\u636E\uFF0C\u786E\u5B9A\u7EE7\u7EED\u5417\uFF1F")) return null;
        state = normalizeState(candidate);
        saveState();
        return `\u5B8C\u6574\u6570\u636E\u5DF2\u6062\u590D\uFF0C\u5171 ${state.transactions.length} \u7B14\u8D26\u76EE`;
      }
      const count = importExcelXml(content);
      return `\u5DF2\u5411\u5F53\u524D\u8D26\u672C\u5BFC\u5165 ${count} \u7B14\u8D26\u76EE`;
    }
    async function runSyncAction(button, action) {
      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = "\u5904\u7406\u4E2D\u2026";
      try {
        await action();
      } catch (error) {
        setSyncResult(error.message || "\u540C\u6B65\u64CD\u4F5C\u5931\u8D25", true);
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
          const now = (/* @__PURE__ */ new Date()).toISOString();
          if (id) {
            const index = state.transactions.findIndex((item) => item.id === id);
            if (index === -1) throw new Error("\u5F85\u7F16\u8F91\u8D26\u76EE\u4E0D\u5B58\u5728");
            state.transactions[index] = { ...state.transactions[index], ...values, updatedAt: now };
            saveState("\u8D26\u76EE\u5DF2\u66F4\u65B0");
          } else {
            state.transactions.push({ id: makeId("tx"), ...values, createdAt: now, updatedAt: now });
            saveState("\u8D26\u76EE\u5DF2\u4FDD\u5B58");
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
        const files = [...elements.transactionPhotos.files || []];
        if (files.length > 3) {
          elements.transactionPhotos.value = "";
          return showToast("\u6BCF\u7B14\u8D26\u6700\u591A\u6DFB\u52A0 3 \u5F20\u7167\u7247", true);
        }
        if (files.some((file) => file.size > 1.5 * 1024 * 1024)) {
          elements.transactionPhotos.value = "";
          return showToast("\u5355\u5F20\u7167\u7247\u4E0D\u80FD\u8D85\u8FC7 1.5MB", true);
        }
        try {
          transactionPhotos = await Promise.all(files.map((file) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ name: file.name, type: file.type, dataUrl: reader.result });
            reader.onerror = () => reject(new Error("\u7167\u7247\u8BFB\u53D6\u5931\u8D25"));
            reader.readAsDataURL(file);
          })));
          elements.transactionPhotoStatus.textContent = transactionPhotos.length ? `\u5DF2\u9009\u62E9 ${transactionPhotos.length} \u5F20\u7167\u7247` : "\u672A\u9009\u62E9\u7167\u7247";
        } catch (error) {
          showToast(error.message, true);
        }
      });
      elements.captureLocation.addEventListener("click", () => {
        if (!navigator.geolocation) return showToast("\u5F53\u524D\u8BBE\u5907\u4E0D\u652F\u6301\u5B9A\u4F4D", true);
        elements.captureLocation.disabled = true;
        navigator.geolocation.getCurrentPosition((position) => {
          transactionLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            capturedAt: (/* @__PURE__ */ new Date()).toISOString()
          };
          elements.transactionLocationStatus.textContent = `\u5DF2\u8BB0\u5F55 \xB7 \u7CBE\u5EA6\u7EA6 ${Math.round(position.coords.accuracy)} \u7C73`;
          elements.captureLocation.disabled = false;
        }, () => {
          elements.captureLocation.disabled = false;
          showToast("\u5B9A\u4F4D\u5931\u8D25\u6216\u6743\u9650\u672A\u6388\u6743", true);
        }, { enableHighAccuracy: false, timeout: 1e4, maximumAge: 6e4 });
      });
      elements.saveTemplateButton.addEventListener("click", () => {
        try {
          const values = transactionFromForm();
          const name = window.prompt("\u6A21\u677F\u540D\u79F0", values.note || categoryById(values.categoryId).name)?.trim();
          if (!name) return;
          state.templates.push({
            id: makeId("template"),
            bookId: state.activeBookId,
            name,
            values: { ...values, photos: [], location: null, date: null },
            createdAt: (/* @__PURE__ */ new Date()).toISOString()
          });
          saveState("\u8BB0\u8D26\u6A21\u677F\u5DF2\u4FDD\u5B58");
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
          saveState("\u8BB0\u8D26\u6A21\u677F\u5DF2\u5220\u9664");
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
        showToast("\u6A21\u677F\u5DF2\u586B\u5165");
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
        saveState("\u6708\u9884\u7B97\u5DF2\u66F4\u65B0");
      });
      elements.categoryBudgetForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const categoryId = elements.budgetCategory.value;
        const amount = Math.round(Number(elements.budgetAmount.value) * 100) / 100;
        if (!(amount > 0)) return showToast("\u9884\u7B97\u91D1\u989D\u5FC5\u987B\u5927\u4E8E 0", true);
        const existing = state.budgets.find((item) => item.bookId === state.activeBookId && item.kind === "category" && item.categoryId === categoryId);
        if (existing) existing.amount = amount;
        else state.budgets.push({ id: makeId("budget"), bookId: state.activeBookId, kind: "category", categoryId, amount, period: "monthly", createdAt: (/* @__PURE__ */ new Date()).toISOString() });
        elements.budgetAmount.value = "";
        saveState(existing ? "\u5206\u7C7B\u9884\u7B97\u5DF2\u66F4\u65B0" : "\u5206\u7C7B\u9884\u7B97\u5DF2\u65B0\u589E");
      });
      elements.goalForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const targetAmount = Math.round(Number(elements.goalTarget.value) * 100) / 100;
        if (!(targetAmount > 0)) return showToast("\u76EE\u6807\u91D1\u989D\u5FC5\u987B\u5927\u4E8E 0", true);
        state.budgets.push({
          id: makeId("goal"),
          bookId: state.activeBookId,
          kind: "goal",
          name: elements.goalName.value.trim(),
          targetAmount,
          currentAmount: 0,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        elements.goalForm.reset();
        saveState("\u50A8\u84C4\u76EE\u6807\u5DF2\u65B0\u589E");
      });
      elements.scheduleForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const amount = Math.round(Number(elements.scheduleAmount.value) * 100) / 100;
        if (!(amount > 0)) return showToast("\u5468\u671F\u91D1\u989D\u5FC5\u987B\u5927\u4E8E 0", true);
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
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        elements.scheduleForm.reset();
        elements.scheduleNextDate.value = localDate();
        saveState("\u5468\u671F\u8D26\u5DF2\u65B0\u589E");
      });
      elements.installmentForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const totalAmount = Math.round(Number(elements.installmentTotal.value) * 100) / 100;
        const periods = Number(elements.installmentPeriods.value);
        if (!(totalAmount > 0) || !Number.isInteger(periods) || periods < 2) return showToast("\u8BF7\u586B\u5199\u6709\u6548\u7684\u5206\u671F\u91D1\u989D\u548C\u671F\u6570", true);
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
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          deletedAt: null
        });
        elements.installmentForm.reset();
        elements.installmentNextDate.value = localDate();
        saveState("\u5206\u671F\u8BA1\u5212\u5DF2\u65B0\u589E");
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
          saveState("\u5206\u7C7B\u9884\u7B97\u5DF2\u5220\u9664");
        } else if (action === "delete-goal") {
          state.budgets = state.budgets.filter((item) => item.id !== goalId);
          saveState("\u50A8\u84C4\u76EE\u6807\u5DF2\u5220\u9664");
        } else if (action === "deposit-goal") {
          const goal = state.budgets.find((item) => item.id === goalId);
          const amount = Number(window.prompt("\u672C\u6B21\u5B58\u5165\u91D1\u989D", "100"));
          if (!goal || !(amount > 0)) return;
          goal.currentAmount = Math.min(goal.targetAmount, Math.round((goal.currentAmount + amount) * 100) / 100);
          saveState("\u76EE\u6807\u8FDB\u5EA6\u5DF2\u66F4\u65B0");
        } else if (action === "delete-schedule") {
          state.schedules = state.schedules.filter((item) => item.id !== scheduleId);
          saveState("\u5468\u671F\u8D26\u5DF2\u5220\u9664");
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
          saveState("\u5468\u671F\u8D26\u5DF2\u8BB0\u5165\uFF0C\u4E0B\u6B21\u65E5\u671F\u5DF2\u63A8\u8FDB");
        } else if (action === "delete-installment") {
          state.installments = state.installments.filter((item) => item.id !== installmentId);
          saveState("\u5206\u671F\u8BA1\u5212\u5DF2\u5220\u9664");
        } else if (action === "run-installment") {
          const plan = state.installments.find((item) => item.id === installmentId);
          if (!plan || plan.paidPeriods >= plan.periods) return;
          const amount = installmentAmount(plan.totalAmount, plan.periods, plan.paidPeriods);
          state.transactions.push(plannedTransaction({
            amount,
            categoryId: plan.categoryId,
            accountId: plan.accountId,
            date: plan.nextDate,
            note: `${plan.name} \u7B2C${plan.paidPeriods + 1}\u671F`,
            installmentId: plan.id
          }));
          plan.paidPeriods += 1;
          if (plan.paidPeriods < plan.periods) plan.nextDate = advanceRecurringDate(plan.nextDate, "monthly");
          saveState("\u672C\u671F\u5206\u671F\u5DF2\u8BB0\u5165");
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
            note: `\u62A5\u9500\u5230\u8D26\uFF1A${expense.note || categoryById(expense.categoryId).name}`,
            linkedTransactionId: expense.id,
            currencyCode: expense.currencyCode,
            exchangeRate: expense.exchangeRate
          });
          expense.reimburseStatus = "reimbursed";
          expense.linkedTransactionId = income.id;
          expense.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
          state.transactions.push(income);
          saveState("\u62A5\u9500\u6536\u5165\u5DF2\u5173\u8054\u5230\u8D26");
        }
      });
      elements.activeBookSelect.addEventListener("change", () => {
        state.activeBookId = elements.activeBookSelect.value;
        resetTransactionForm();
        saveState(`\u5DF2\u5207\u6362\u5230${activeBook().name}`);
      });
      elements.bookForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const name = elements.newBookName.value.trim();
        if (state.books.some((item) => !item.hidden && item.name === name)) {
          showToast("\u8D26\u672C\u540D\u79F0\u5DF2\u5B58\u5728", true);
          return;
        }
        const sourceBookId = state.activeBookId;
        const now = (/* @__PURE__ */ new Date()).toISOString();
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
        saveState("\u8D26\u672C\u5DF2\u521B\u5EFA");
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
          saveState(`\u5DF2\u5207\u6362\u5230${book.name}`);
          return;
        }
        if (button.dataset.bookAction === "rename") {
          const name = window.prompt("\u8BF7\u8F93\u5165\u65B0\u7684\u8D26\u672C\u540D\u79F0", book.name)?.trim();
          if (!name || name === book.name) return;
          if (state.books.some((candidate) => candidate.id !== book.id && !candidate.hidden && candidate.name === name)) {
            showToast("\u8D26\u672C\u540D\u79F0\u5DF2\u5B58\u5728", true);
            return;
          }
          book.name = name;
          saveState("\u8D26\u672C\u5DF2\u91CD\u547D\u540D");
          return;
        }
        if (button.dataset.bookAction === "delete") {
          const visibleBooks = state.books.filter((candidate) => !candidate.hidden);
          if (visibleBooks.length <= 1) return showToast("\u81F3\u5C11\u9700\u8981\u4FDD\u7559\u4E00\u4E2A\u8D26\u672C", true);
          if (!window.confirm(`\u5220\u9664\u201C${book.name}\u201D\u540E\uFF0C\u5176\u5206\u7C7B\u548C\u8D26\u76EE\u4F1A\u79FB\u5165\u56DE\u6536\u7AD9\u3002\u786E\u5B9A\u7EE7\u7EED\u5417\uFF1F`)) return;
          const deletedAt = (/* @__PURE__ */ new Date()).toISOString();
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
          saveState("\u8D26\u672C\u5DF2\u79FB\u5165\u56DE\u6536\u7AD9");
        }
      });
      elements.categoryForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const name = elements.newCategoryName.value.trim();
        if (currentCategories().some((item) => item.name === name)) {
          showToast("\u5206\u7C7B\u540D\u79F0\u5DF2\u5B58\u5728", true);
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
        saveState("\u5206\u7C7B\u5DF2\u65B0\u589E");
      });
      elements.categoryList.addEventListener("click", (event) => {
        const button = event.target.closest("[data-category-id]");
        if (!button) return;
        const id = button.dataset.categoryId;
        const category = state.categories.find((item) => item.id === id);
        if (!category) return;
        if (button.dataset.categoryAction === "rename") {
          const name = window.prompt("\u8BF7\u8F93\u5165\u65B0\u7684\u5206\u7C7B\u540D\u79F0", category.name)?.trim();
          if (!name || name === category.name) return;
          if (currentCategories().some((item) => item.id !== id && item.name === name)) return showToast("\u5206\u7C7B\u540D\u79F0\u5DF2\u5B58\u5728", true);
          category.name = name;
          saveState("\u5206\u7C7B\u5DF2\u91CD\u547D\u540D");
          return;
        }
        if (currentCategories().length <= 1) return showToast("\u81F3\u5C11\u9700\u8981\u4FDD\u7559\u4E00\u4E2A\u5206\u7C7B", true);
        if (state.transactions.some((item) => item.categoryId === id)) return showToast("\u8BE5\u5206\u7C7B\u5DF2\u6709\u8D26\u76EE\uFF0C\u4E0D\u80FD\u5220\u9664", true);
        state.categories = state.categories.filter((item) => item.id !== id);
        saveState("\u5206\u7C7B\u5DF2\u5220\u9664");
      });
      elements.accountForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const name = elements.newAccountName.value.trim();
        if (state.accounts.some((item) => item.name === name)) {
          showToast("\u8D26\u6237\u540D\u79F0\u5DF2\u5B58\u5728", true);
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
        saveState("\u8D26\u6237\u5DF2\u65B0\u589E");
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
          const name = window.prompt("\u8BF7\u8F93\u5165\u65B0\u7684\u8D26\u6237\u540D\u79F0", account.name)?.trim();
          if (!name || name === account.name) return;
          if (state.accounts.some((item) => item.id !== id && item.name === name)) return showToast("\u8D26\u6237\u540D\u79F0\u5DF2\u5B58\u5728", true);
          account.name = name;
          saveState("\u8D26\u6237\u5DF2\u91CD\u547D\u540D");
          return;
        }
        if (state.accounts.length <= 1) return showToast("\u81F3\u5C11\u9700\u8981\u4FDD\u7559\u4E00\u4E2A\u8D26\u6237", true);
        if (state.transactions.some((item) => item.accountId === id || item.targetAccountId === id)) {
          return showToast("\u8BE5\u8D26\u6237\u5DF2\u6709\u8D26\u76EE\uFF0C\u4E0D\u80FD\u5220\u9664", true);
        }
        state.accounts = state.accounts.filter((item) => item.id !== id);
        saveState("\u8D26\u6237\u5DF2\u5220\u9664");
      });
      elements.memberForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const name = elements.newMemberName.value.trim();
        if (currentMembers().some((item) => item.name === name)) return showToast("\u6210\u5458\u540D\u79F0\u5DF2\u5B58\u5728", true);
        state.members.push({ id: makeId("member"), bookId: state.activeBookId, name, deletedAt: null });
        elements.memberForm.reset();
        saveState("\u6210\u5458\u5DF2\u65B0\u589E");
      });
      elements.tagForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const name = elements.newTagName.value.trim();
        if (currentTags().some((item) => item.name === name)) return showToast("\u6807\u7B7E\u540D\u79F0\u5DF2\u5B58\u5728", true);
        state.tags.push({ id: makeId("tag"), bookId: state.activeBookId, name, color: "#5370a5", deletedAt: null });
        elements.tagForm.reset();
        saveState("\u6807\u7B7E\u5DF2\u65B0\u589E");
      });
      elements.merchantForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const name = elements.newMerchantName.value.trim();
        if (currentMerchants().some((item) => item.name === name)) return showToast("\u5546\u5BB6\u540D\u79F0\u5DF2\u5B58\u5728", true);
        state.merchants.push({ id: makeId("merchant"), bookId: state.activeBookId, name, deletedAt: null });
        elements.merchantForm.reset();
        saveState("\u5546\u5BB6\u5DF2\u65B0\u589E");
      });
      elements.currencyForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const code = elements.newCurrencyCode.value.trim().toUpperCase();
        const rate = Number(elements.newCurrencyRate.value);
        if (!/^[A-Z]{3}$/.test(code)) return showToast("\u5E01\u79CD\u4EE3\u7801\u5FC5\u987B\u4E3A 3 \u4F4D\u82F1\u6587\u5B57\u6BCD", true);
        if (!(rate > 0)) return showToast("\u6C47\u7387\u5FC5\u987B\u5927\u4E8E 0", true);
        if (state.currencies.some((item) => item.code === code)) return showToast("\u5E01\u79CD\u4EE3\u7801\u5DF2\u5B58\u5728", true);
        state.currencies.push({
          code,
          name: elements.newCurrencyName.value.trim(),
          symbol: elements.newCurrencySymbol.value.trim(),
          rate
        });
        elements.currencyForm.reset();
        saveState("\u5E01\u79CD\u5DF2\u65B0\u589E");
      });
      elements.currencyList.addEventListener("click", (event) => {
        const button = event.target.closest("[data-currency-code]");
        if (!button) return;
        const code = button.dataset.currencyCode;
        if (code === state.baseCurrency) return showToast("\u4E0D\u80FD\u5220\u9664\u672C\u4F4D\u5E01", true);
        if (state.transactions.some((item) => item.currencyCode === code)) return showToast("\u8BE5\u5E01\u79CD\u5DF2\u6709\u8D26\u76EE\uFF0C\u4E0D\u80FD\u5220\u9664", true);
        state.currencies = state.currencies.filter((item) => item.code !== code);
        saveState("\u5E01\u79CD\u5DF2\u5220\u9664");
      });
      elements.memberList.addEventListener("click", (event) => {
        const button = event.target.closest("[data-member-id]");
        if (!button) return;
        const id = button.dataset.memberId;
        if (state.transactions.some((item) => item.memberShares?.some((share) => share.memberId === id))) {
          return showToast("\u8BE5\u6210\u5458\u5DF2\u6709\u8D26\u76EE\uFF0C\u4E0D\u80FD\u5220\u9664", true);
        }
        state.members = state.members.filter((item) => item.id !== id);
        saveState("\u6210\u5458\u5DF2\u5220\u9664");
      });
      elements.tagList.addEventListener("click", (event) => {
        const button = event.target.closest("[data-tag-id]");
        if (!button) return;
        const id = button.dataset.tagId;
        if (state.transactions.some((item) => item.tagIds?.includes(id))) return showToast("\u8BE5\u6807\u7B7E\u5DF2\u6709\u8D26\u76EE\uFF0C\u4E0D\u80FD\u5220\u9664", true);
        state.tags = state.tags.filter((item) => item.id !== id);
        saveState("\u6807\u7B7E\u5DF2\u5220\u9664");
      });
      elements.merchantList.addEventListener("click", (event) => {
        const button = event.target.closest("[data-merchant-id]");
        if (!button) return;
        const id = button.dataset.merchantId;
        if (state.transactions.some((item) => item.merchantId === id)) return showToast("\u8BE5\u5546\u5BB6\u5DF2\u6709\u8D26\u76EE\uFF0C\u4E0D\u80FD\u5220\u9664", true);
        state.merchants = state.merchants.filter((item) => item.id !== id);
        saveState("\u5546\u5BB6\u5DF2\u5220\u9664");
      });
      elements.appLockForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const currentPin = elements.currentPin.value;
        const pin = elements.newPin.value;
        if (!/^\d{4,8}$/.test(pin)) return showToast("PIN \u5FC5\u987B\u4E3A 4 \u81F3 8 \u4F4D\u6570\u5B57", true);
        if (pin !== elements.confirmPin.value) return showToast("\u4E24\u6B21\u8F93\u5165\u7684\u65B0 PIN \u4E0D\u4E00\u81F4", true);
        if (state.settings.appLock && !await verifyPin(currentPin)) return showToast("\u5F53\u524D PIN \u4E0D\u6B63\u786E", true);
        const salt = crypto.getRandomValues(new Uint8Array(16));
        state.settings.appLock = {
          salt: bytesToBase642(salt),
          hash: await hashPin(pin, salt),
          timeoutMinutes: Number(elements.lockTimeout.value),
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        elements.appLockForm.reset();
        elements.lockTimeout.value = String(state.settings.appLock.timeoutMinutes);
        saveState("\u5E94\u7528\u9501\u5DF2\u5F00\u542F");
      });
      elements.clearAppLock.addEventListener("click", async () => {
        if (!state.settings.appLock) return showToast("\u5E94\u7528\u9501\u5C1A\u672A\u5F00\u542F");
        const pin = window.prompt("\u8BF7\u8F93\u5165\u5F53\u524D PIN \u4EE5\u5173\u95ED\u5E94\u7528\u9501") || "";
        if (!await verifyPin(pin)) return showToast("\u5F53\u524D PIN \u4E0D\u6B63\u786E", true);
        state.settings.appLock = null;
        elements.appLockForm.reset();
        saveState("\u5E94\u7528\u9501\u5DF2\u5173\u95ED");
      });
      elements.unlockForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!await verifyPin(elements.unlockPin.value)) {
          elements.lockError.textContent = "PIN \u4E0D\u6B63\u786E";
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
          setSyncResult("\u8BF7\u5728\u7CFB\u7EDF\u8BBE\u7F6E\u4E2D\u5141\u8BB8\u667A\u8BB0\u8BFB\u53D6\u4EA4\u6613\u901A\u77E5");
        } catch (error) {
          showToast(error.message || "\u65E0\u6CD5\u6253\u5F00\u901A\u77E5\u4F7F\u7528\u6743\u8BBE\u7F6E", true);
        }
      });
      elements.openAccessibilityAccess.addEventListener("click", async () => {
        try {
          await openAccessibilityAccess();
          setSyncResult("\u8BF7\u5728\u7CFB\u7EDF\u65E0\u969C\u788D\u8BBE\u7F6E\u4E2D\u4E3B\u52A8\u5F00\u542F\u667A\u8BB0\u81EA\u52A8\u8BB0\u8D26");
        } catch (error) {
          showToast(error.message || "\u65E0\u6CD5\u6253\u5F00\u65E0\u969C\u788D\u8BBE\u7F6E", true);
        }
      });
      elements.loadNotificationCandidates.addEventListener("click", async () => {
        try {
          const result = await loadNotificationCandidates();
          autoBookingCandidates = [...autoBookingCandidates, ...result.items || []].filter((item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index);
          renderAutoBookingCandidates();
          await refreshAutoBookingStatus();
        } catch (error) {
          showToast(error.message || "\u901A\u77E5\u5019\u9009\u8BFB\u53D6\u5931\u8D25", true);
        }
      });
      elements.loadSmsCandidates.addEventListener("click", async () => {
        try {
          const result = await loadSmsCandidates();
          autoBookingCandidates = [...autoBookingCandidates, ...result.items || []].filter((item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index);
          renderAutoBookingCandidates();
          await refreshAutoBookingStatus();
        } catch (error) {
          showToast(error.message || "\u77ED\u4FE1\u5019\u9009\u8BFB\u53D6\u5931\u8D25", true);
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
        setSyncResult(`${result.message}\uFF0C\u5171 ${state.transactions.length} \u7B14\u8D26\u76EE\u3002`);
      }));
      elements.downloadSyncButton.addEventListener("click", () => runSyncAction(elements.downloadSyncButton, async () => {
        const config = getSyncConfig();
        saveSyncConfig(config);
        await persistAutoSyncConfig(config);
        const remote = await downloadRemoteState(config);
        if (!remote) throw new Error("\u4E91\u7AEF\u6587\u4EF6\u4E0D\u5B58\u5728");
        const localChanged = state.metadata.lastSyncedRevision == null ? state.transactions.length > 0 : Number(state.metadata.revision || 0) > Number(state.metadata.lastSyncedRevision);
        const warning = localChanged ? "\u5F53\u524D\u8BBE\u5907\u6709\u5C1A\u672A\u540C\u6B65\u7684\u4FEE\u6539\uFF0C\u4ECE\u4E91\u7AEF\u6062\u590D\u4F1A\u8986\u76D6\u8FD9\u4E9B\u4FEE\u6539\u3002\u786E\u5B9A\u7EE7\u7EED\u5417\uFF1F" : "\u4ECE\u4E91\u7AEF\u6062\u590D\u4F1A\u8986\u76D6\u5F53\u524D\u8BBE\u5907\u4E2D\u7684\u8D26\u672C\uFF0C\u786E\u5B9A\u7EE7\u7EED\u5417\uFF1F";
        if (!window.confirm(warning)) return;
        const restoredState = remote.state;
        const deviceId = state.metadata.deviceId;
        restoredState.metadata.deviceId = deviceId;
        restoredState.metadata.lastSyncedAt = (/* @__PURE__ */ new Date()).toISOString();
        restoredState.metadata.lastSyncedRevision = restoredState.metadata.revision;
        state = restoredState;
        saveState(null, { markChanged: false, skipAutoSync: true });
        resetTransactionForm();
        setSyncResult(`\u6062\u590D\u6210\u529F\uFF0C\u5DF2\u8F7D\u5165 ${state.transactions.length} \u7B14\u8D26\u76EE\u3002`);
      }));
      elements.autoSyncEnabled.addEventListener("change", async () => {
        if (elements.autoSyncEnabled.checked) {
          try {
            const config = getSyncConfig();
            saveSyncConfig(config);
            await persistAutoSyncConfig(config);
            scheduleAutoBackup();
            setSyncResult("\u81EA\u52A8\u540C\u6B65\u5DF2\u5F00\u542F");
          } catch (error) {
            elements.autoSyncEnabled.checked = false;
            setSyncResult(error.message || "\u81EA\u52A8\u540C\u6B65\u5F00\u542F\u5931\u8D25", true);
          }
        } else {
          clearTimeout(autoSyncTimer);
          secureSyncConfig = null;
          await clearSecureSyncConfig();
          elements.credentialStorageNote.textContent = "\u672A\u5F00\u542F\u81EA\u52A8\u540C\u6B65\u65F6\uFF0C\u5E94\u7528\u5BC6\u7801\u548C\u540C\u6B65\u5BC6\u94A5\u53EA\u4FDD\u7559\u5728\u5F53\u524D\u9875\u9762\u5185\u5B58\u4E2D\u3002";
          setSyncResult("\u81EA\u52A8\u540C\u6B65\u5DF2\u5173\u95ED\uFF0C\u5B89\u5168\u51ED\u636E\u5DF2\u6E05\u9664");
        }
      });
      elements.clearSyncConfig.addEventListener("click", async () => {
        localStorage.removeItem(SYNC_CONFIG_KEY);
        clearTimeout(autoSyncTimer);
        secureSyncConfig = null;
        await clearSecureSyncConfig();
        elements.syncForm.reset();
        elements.credentialStorageNote.textContent = "\u672A\u5F00\u542F\u81EA\u52A8\u540C\u6B65\u65F6\uFF0C\u5E94\u7528\u5BC6\u7801\u548C\u540C\u6B65\u5BC6\u94A5\u53EA\u4FDD\u7559\u5728\u5F53\u524D\u9875\u9762\u5185\u5B58\u4E2D\u3002";
        setSyncResult("\u672C\u673A\u4FDD\u5B58\u7684\u540C\u6B65\u5730\u5740\u3001\u8D26\u53F7\u548C\u8DEF\u5F84\u5DF2\u6E05\u9664\u3002");
      });
      elements.exportJson.addEventListener("click", () => {
        downloadTextFile(`zhiji-backup-${localDate()}.json`, JSON.stringify({ app: "zhiji-local", version: APP_VERSION, exportedAt: (/* @__PURE__ */ new Date()).toISOString(), state }, null, 2), "application/json;charset=utf-8");
        setImportResult("\u5B8C\u6574 JSON \u5DF2\u5BFC\u51FA");
      });
      elements.exportExcel.addEventListener("click", () => {
        downloadTextFile(`zhiji-${activeBook().name}-${localDate()}.xml`, `\uFEFF${exportExcelXml()}`, "application/vnd.ms-excel;charset=utf-8");
        setImportResult(`\u5F53\u524D\u8D26\u672C ${currentTransactions().length} \u7B14\u8D26\u76EE\u5DF2\u5BFC\u51FA`);
      });
      elements.selectImportFile.addEventListener("click", () => elements.importFile.click());
      elements.importFile.addEventListener("change", async () => {
        const file = elements.importFile.files?.[0];
        if (!file) return;
        try {
          const message = await importLocalFile(file);
          if (message) setImportResult(message);
        } catch (error) {
          setImportResult(error.message || "\u6587\u4EF6\u5BFC\u5165\u5931\u8D25", true);
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
          saveState("\u5DF2\u5F7B\u5E95\u5220\u9664");
          return;
        }
        if (item.entityType === "transaction") {
          const transaction = item.payload;
          if (!state.books.some((book) => book.id === transaction.bookId)) return showToast("\u539F\u8D26\u672C\u4E0D\u5B58\u5728\uFF0C\u65E0\u6CD5\u6062\u590D\u8BE5\u8D26\u76EE", true);
          if (!state.accounts.some((account) => account.id === transaction.accountId)) return showToast("\u539F\u8D26\u6237\u4E0D\u5B58\u5728\uFF0C\u65E0\u6CD5\u6062\u590D\u8BE5\u8D26\u76EE", true);
          state.transactions.push(transaction);
          state.activeBookId = transaction.bookId;
        } else if (item.entityType === "book") {
          const payload = item.payload;
          if (!payload?.book || state.books.some((book) => book.id === payload.book.id)) return showToast("\u8D26\u672C\u65E0\u6CD5\u6062\u590D\u6216\u5DF2\u7ECF\u5B58\u5728", true);
          state.books.push(payload.book);
          state.categories.push(...payload.categories || []);
          state.transactions.push(...payload.transactions || []);
          Object.entries(payload.scoped || {}).forEach(([name, items]) => {
            if (Array.isArray(state[name]) && Array.isArray(items)) state[name].push(...items);
          });
          state.activeBookId = payload.book.id;
        }
        state.recycleBin = state.recycleBin.filter((candidate) => candidate.id !== item.id);
        resetTransactionForm();
        saveState("\u5DF2\u4ECE\u56DE\u6536\u7AD9\u6062\u590D");
      });
      elements.emptyRecycleBin.addEventListener("click", () => {
        if (!state.recycleBin.length) return showToast("\u56DE\u6536\u7AD9\u5DF2\u7ECF\u4E3A\u7A7A");
        if (!window.confirm("\u6E05\u7A7A\u540E\u65E0\u6CD5\u6062\u590D\uFF0C\u786E\u5B9A\u7EE7\u7EED\u5417\uFF1F")) return;
        state.recycleBin = [];
        saveState("\u56DE\u6536\u7AD9\u5DF2\u6E05\u7A7A");
      });
    }
    function bindNativeEvents() {
      if (!Capacitor.isNativePlatform()) return;
      App.addListener("pause", () => {
        backgroundAt = Date.now();
        if (!secureSyncConfig?.autoEnabled || syncInProgress) return;
        uploadBackup(secureSyncConfig, { automatic: true }).catch(() => {
        });
      }).catch(() => {
      });
      App.addListener("resume", lockAfterBackgroundIfNeeded).catch(() => {
      });
      App.addListener("appUrlOpen", ({ url }) => {
        if (url?.startsWith("zhiji://record")) switchView("record");
      }).catch(() => {
      });
      App.getLaunchUrl().then((result) => {
        if (result?.url?.startsWith("zhiji://record")) switchView("record");
      }).catch(() => {
      });
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
      }).catch(() => {
      });
    }
    function init() {
      cacheElements();
      elements.transactionDate.value = localDate();
      elements.transactionTime.value = (/* @__PURE__ */ new Date()).toTimeString().slice(0, 5);
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
})();
/*! Bundled license information:

@capacitor/core/dist/index.js:
  (*! Capacitor: https://capacitorjs.com/ - MIT License *)
*/
