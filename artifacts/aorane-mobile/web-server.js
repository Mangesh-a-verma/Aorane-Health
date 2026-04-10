const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = parseInt(process.env.PORT || "18624", 10);
const BASE_PATH = (process.env.BASE_PATH || "/").replace(/\/+$/, "");
const DIST_DIR = path.join(__dirname, "dist");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json",
};

const server = http.createServer((req, res) => {
  let urlPath = req.url.split("?")[0];

  if (BASE_PATH && urlPath.startsWith(BASE_PATH)) {
    urlPath = urlPath.slice(BASE_PATH.length) || "/";
  }

  if (urlPath === "" || urlPath === "/") {
    urlPath = "/index.html";
  }

  let filePath = path.join(DIST_DIR, urlPath);

  const tryServe = (fp) => {
    try {
      const stat = fs.statSync(fp);
      if (stat.isDirectory()) {
        tryServe(path.join(fp, "index.html"));
        return;
      }
      const ext = path.extname(fp).toLowerCase();
      const mime = MIME[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": mime, "Cache-Control": "no-cache" });
      fs.createReadStream(fp).pipe(res);
    } catch {
      const indexPath = path.join(DIST_DIR, "index.html");
      if (fs.existsSync(indexPath)) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
        fs.createReadStream(indexPath).pipe(res);
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    }
  };

  tryServe(filePath);
});

server.listen(PORT, () => {
  console.log(`AORANE Web Preview → http://localhost:${PORT}${BASE_PATH || "/"}`);
});
