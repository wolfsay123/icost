const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PUBLIC_DIR = path.join(__dirname, "public");
const PORT = Number(process.env.PORT || 5173);
const BODY_LIMIT = 20 * 1024 * 1024;

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        reject(new Error("请求内容超过 20MB 限制"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(new Error("请求内容不是有效 JSON"));
      }
    });
    req.on("error", reject);
  });
}

function validateWebDavInput(body, requireRemotePath = false) {
  const baseUrl = String(body.baseUrl || "").trim();
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  const remotePath = String(body.remotePath || "").trim();

  if (!baseUrl || !username || !password) {
    throw new Error("请填写 WebDAV 地址、账号和应用密码");
  }

  const parsed = new URL(baseUrl);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error("WebDAV 地址只支持 http 或 https");
  }

  if (requireRemotePath && !remotePath) {
    throw new Error("请填写云端文件路径");
  }

  const segments = remotePath.replace(/^\/+/, "").split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error("云端文件路径不合法");
  }

  return { baseUrl, username, password, remotePath, segments };
}

function buildWebDavUrl(baseUrl, segments = []) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const encodedPath = segments.map((segment) => encodeURIComponent(segment)).join("/");
  return new URL(encodedPath, normalizedBase);
}

function webDavRequest({ url, method, username, password, body, headers = {} }) {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const requestHeaders = {
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
      "User-Agent": "Zhiji-Local/0.1",
      ...headers
    };

    if (body !== undefined) {
      requestHeaders["Content-Length"] = Buffer.byteLength(body);
    }

    const request = transport.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method,
        headers: requestHeaders,
        timeout: 15000
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode || 0,
            headers: response.headers,
            body: Buffer.concat(chunks)
          });
        });
      }
    );

    request.on("timeout", () => request.destroy(new Error("WebDAV 请求超时")));
    request.on("error", reject);
    if (body !== undefined) request.write(body);
    request.end();
  });
}

function isSuccess(statusCode) {
  return statusCode >= 200 && statusCode < 300;
}

function webDavErrorMessage(statusCode) {
  if (statusCode === 401 || statusCode === 403) return "认证失败，请检查坚果云账号与应用密码";
  if (statusCode === 404) return "云端文件不存在";
  if (statusCode === 409) return "云端目录不存在或路径冲突";
  if (statusCode >= 500) return `坚果云服务暂时不可用（${statusCode}）`;
  return `WebDAV 请求失败（${statusCode}）`;
}

async function ensureCollections(config) {
  const directories = config.segments.slice(0, -1);
  for (let index = 1; index <= directories.length; index += 1) {
    const url = buildWebDavUrl(config.baseUrl, directories.slice(0, index));
    const result = await webDavRequest({
      url,
      method: "MKCOL",
      username: config.username,
      password: config.password
    });

    // WebDAV 对已存在目录通常返回 405，属于可继续状态。
    if (!isSuccess(result.statusCode) && result.statusCode !== 405) {
      throw new Error(webDavErrorMessage(result.statusCode));
    }
  }
}

async function handleApi(req, res, pathname) {
  if (pathname === "/api/health" && req.method === "GET") {
    sendJson(res, 200, { ok: true, service: "zhiji-local", version: "0.2.0" });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, message: "不支持的请求方式" });
    return;
  }

  try {
    const body = await readJson(req);

    if (pathname === "/api/webdav/test") {
      const config = validateWebDavInput(body);
      const result = await webDavRequest({
        url: buildWebDavUrl(config.baseUrl),
        method: "PROPFIND",
        username: config.username,
        password: config.password,
        body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:displayname/></d:prop></d:propfind>',
        headers: { Depth: "0", "Content-Type": "application/xml; charset=utf-8" }
      });

      if (![200, 207].includes(result.statusCode)) {
        throw new Error(webDavErrorMessage(result.statusCode));
      }
      sendJson(res, 200, { ok: true, message: "坚果云连接成功" });
      return;
    }

    if (pathname === "/api/webdav/upload") {
      const config = validateWebDavInput(body, true);
      if (typeof body.content !== "string" || !body.content) {
        throw new Error("没有可上传的备份内容");
      }
      await ensureCollections(config);
      const result = await webDavRequest({
        url: buildWebDavUrl(config.baseUrl, config.segments),
        method: "PUT",
        username: config.username,
        password: config.password,
        body: body.content,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });

      if (!isSuccess(result.statusCode)) {
        throw new Error(webDavErrorMessage(result.statusCode));
      }
      sendJson(res, 200, { ok: true, message: "加密备份已上传到坚果云" });
      return;
    }

    if (pathname === "/api/webdav/download") {
      const config = validateWebDavInput(body, true);
      const result = await webDavRequest({
        url: buildWebDavUrl(config.baseUrl, config.segments),
        method: "GET",
        username: config.username,
        password: config.password
      });

      if (result.statusCode === 404) {
        sendJson(res, 200, { ok: true, exists: false, content: null, modifiedAt: null });
        return;
      }
      if (!isSuccess(result.statusCode)) {
        throw new Error(webDavErrorMessage(result.statusCode));
      }
      sendJson(res, 200, {
        ok: true,
        exists: true,
        content: result.body.toString("utf8"),
        modifiedAt: result.headers["last-modified"] || null
      });
      return;
    }

    sendJson(res, 404, { ok: false, message: "接口不存在" });
  } catch (error) {
    const statusCode = error.message === "云端文件不存在" ? 404 : 400;
    sendJson(res, statusCode, { ok: false, message: error.message || "请求处理失败" });
  }
}

function serveStatic(req, res, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(PUBLIC_DIR, `.${requestedPath}`);

  if (!filePath.startsWith(`${PUBLIC_DIR}${path.sep}`)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        fs.readFile(path.join(PUBLIC_DIR, "index.html"), (indexError, indexContent) => {
          if (indexError) {
            res.writeHead(404);
            res.end("Not Found");
            return;
          }
          res.writeHead(200, { "Content-Type": MIME_TYPES[".html"] });
          res.end(indexContent);
        });
        return;
      }
      res.writeHead(500);
      res.end("Internal Server Error");
      return;
    }

    res.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (requestUrl.pathname.startsWith("/api/")) {
    handleApi(req, res, requestUrl.pathname);
    return;
  }
  serveStatic(req, res, decodeURIComponent(requestUrl.pathname));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`智记已启动：http://127.0.0.1:${PORT}`);
});
