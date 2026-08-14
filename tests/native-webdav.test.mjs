import assert from "node:assert/strict";
import test from "node:test";
import { nativeWebDavAction } from "../src/native-webdav.mjs";

const config = {
  baseUrl: "https://dav.jianguoyun.com/dav/",
  username: "test@example.com",
  password: "app-password",
  remotePath: "智记/backup.enc.json"
};

test("原生 WebDAV 可以测试连接", async () => {
  const calls = [];
  const result = await nativeWebDavAction("/api/webdav/test", config, async (options) => {
    calls.push(options);
    return { status: 207, data: "", headers: {} };
  });

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "PROPFIND");
  assert.equal(calls[0].headers.Depth, "0");
  assert.match(calls[0].headers.Authorization, /^Basic /);
});

test("原生 WebDAV 会创建目录并上传加密内容", async () => {
  const calls = [];
  const result = await nativeWebDavAction(
    "/api/webdav/upload",
    { ...config, content: "{\"format\":\"zhiji-encrypted-backup\"}" },
    async (options) => {
      calls.push(options);
      return { status: options.method === "MKCOL" ? 405 : 201, data: "", headers: {} };
    }
  );

  assert.equal(result.ok, true);
  assert.deepEqual(calls.map((item) => item.method), ["MKCOL", "PUT"]);
  assert.match(calls[0].url, /%E6%99%BA%E8%AE%B0$/);
  assert.match(calls[1].url, /backup\.enc\.json$/);
});

test("原生 WebDAV 可以下载加密备份", async () => {
  const result = await nativeWebDavAction("/api/webdav/download", config, async (options) => {
    assert.equal(options.method, "GET");
    return { status: 200, data: { format: "zhiji-encrypted-backup" }, headers: { "last-modified": "today" } };
  });

  assert.equal(result.content, '{"format":"zhiji-encrypted-backup"}');
  assert.equal(result.exists, true);
  assert.equal(result.modifiedAt, "today");
});

test("原生 WebDAV 将尚无备份作为正常空状态返回", async () => {
  const result = await nativeWebDavAction("/api/webdav/download", config, async () => ({ status: 404, data: "", headers: {} }));

  assert.deepEqual(result, { ok: true, exists: false, content: null, modifiedAt: null });
});

test("安卓端拒绝非 HTTPS WebDAV", async () => {
  await assert.rejects(
    nativeWebDavAction("/api/webdav/test", { ...config, baseUrl: "http://example.com/dav/" }, async () => ({})),
    /必须使用 https/
  );
});
