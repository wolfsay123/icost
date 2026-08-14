const http = require("http");

const port = Number(process.env.MOCK_WEBDAV_PORT || 5190);
const files = new Map();

const server = http.createServer((req, res) => {
  if (req.method === "PROPFIND") {
    res.writeHead(207, { "Content-Type": "application/xml" });
    res.end('<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"/>');
    return;
  }

  if (req.method === "MKCOL") {
    res.writeHead(201);
    res.end();
    return;
  }

  if (req.method === "PUT") {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      files.set(req.url, Buffer.concat(chunks));
      res.writeHead(201);
      res.end();
    });
    return;
  }

  if (req.method === "GET") {
    const content = files.get(req.url);
    if (!content) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json", "Last-Modified": new Date().toUTCString() });
    res.end(content);
    return;
  }

  res.writeHead(405);
  res.end();
});

server.listen(port, "127.0.0.1", () => {
  console.log(`WebDAV 测试服务：http://127.0.0.1:${port}/dav/`);
});
