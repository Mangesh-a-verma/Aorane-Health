const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PORT = parseInt(process.env.PORT || "18624", 10);
const BASE_PATH = (process.env.BASE_PATH || "/").replace(/\/+$/, "");
const DIST_DIR = path.join(__dirname, "dist");

// Local API proxy — dev mode uses local API so devOtp works
const LOCAL_API_PORT = 8080;
const USE_LOCAL_API = process.env.NODE_ENV !== "production";

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

function proxyToLocalApi(req, res, urlPath) {
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    const body = Buffer.concat(chunks);
    const options = {
      hostname: "localhost",
      port: LOCAL_API_PORT,
      path: urlPath + (req.url.includes("?") ? "?" + req.url.split("?")[1] : ""),
      method: req.method,
      headers: {
        ...req.headers,
        host: `localhost:${LOCAL_API_PORT}`,
        "content-length": body.length,
      },
    };
    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on("error", (err) => {
      console.error("[API Proxy] Error:", err.message);
      res.writeHead(502);
      res.end(JSON.stringify({ error: "API proxy error" }));
    });
    proxyReq.write(body);
    proxyReq.end();
  });
}

const server = http.createServer((req, res) => {
  let urlPath = req.url.split("?")[0];

  if (BASE_PATH && urlPath.startsWith(BASE_PATH)) {
    urlPath = urlPath.slice(BASE_PATH.length) || "/";
  }

  // Proxy /api/* to local API server in dev mode
  if (USE_LOCAL_API && urlPath.startsWith("/api/")) {
    proxyToLocalApi(req, res, urlPath);
    return;
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
  if (USE_LOCAL_API) {
    console.log(`[API Proxy] /api/* → localhost:${LOCAL_API_PORT}/api/*`);
  }
});
