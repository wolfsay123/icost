import { CapacitorHttp } from "@capacitor/core";

function bytesToBase64(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function webDavErrorMessage(statusCode) {
  if (statusCode === 401 || statusCode === 403) return "认证失败，请检查坚果云账号与应用密码";
  if (statusCode === 404) return "云端文件不存在";
  if (statusCode === 409) return "云端目录不存在或路径冲突";
  if (statusCode >= 500) return `坚果云服务暂时不可用（${statusCode}）`;
  return `WebDAV 请求失败（${statusCode}）`;
}

function normalizeConfig(payload, requireRemotePath = false) {
  const baseUrl = String(payload.baseUrl || "").trim();
  const username = String(payload.username || "").trim();
  const password = String(payload.password || "");
  const remotePath = String(payload.remotePath || "").trim();
  if (!baseUrl || !username || !password) throw new Error("请填写 WebDAV 地址、账号和应用密码");

  const parsedUrl = new URL(baseUrl);
  if (parsedUrl.protocol !== "https:") throw new Error("安卓 App 的 WebDAV 地址必须使用 https");
  if (requireRemotePath && !remotePath) throw new Error("请填写云端文件路径");

  const segments = remotePath.replace(/^\/+/, "").split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) throw new Error("云端文件路径不合法");
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
    connectTimeout: 15000,
    readTimeout: 15000
  });
}

async function ensureCollections(config, request) {
  const directories = config.segments.slice(0, -1);
  for (let index = 1; index <= directories.length; index += 1) {
    const result = await sendRequest(config, "MKCOL", directories.slice(0, index), undefined, {}, request);
    // WebDAV 对已存在目录通常返回 405，属于可继续状态。
    if (!(result.status >= 200 && result.status < 300) && result.status !== 405) {
      throw new Error(webDavErrorMessage(result.status));
    }
  }
}

export async function nativeWebDavAction(path, payload, request = (options) => CapacitorHttp.request(options)) {
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
    return { ok: true, message: "坚果云连接成功" };
  }

  if (path === "/api/webdav/upload") {
    const config = normalizeConfig(payload, true);
    if (typeof payload.content !== "string" || !payload.content) throw new Error("没有可上传的备份内容");
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
    return { ok: true, message: "加密备份已上传到坚果云" };
  }

  if (path === "/api/webdav/download") {
    const config = normalizeConfig(payload, true);
    const result = await sendRequest(config, "GET", config.segments, undefined, {}, request);
    if (result.status === 404) return { ok: true, exists: false, content: null, modifiedAt: null };
    if (!(result.status >= 200 && result.status < 300)) throw new Error(webDavErrorMessage(result.status));
    return {
      ok: true,
      exists: true,
      content: typeof result.data === "string" ? result.data : JSON.stringify(result.data),
      modifiedAt: result.headers?.["last-modified"] || null
    };
  }

  throw new Error("原生同步接口不存在");
}
