const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

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

// ---------------------------------------------------------------------------
// Auto-rebuild: rebuild if bundle missing OR source files are newer than bundle
// ---------------------------------------------------------------------------
function getNewestMtime(dir, extensions = [".ts", ".tsx", ".js", ".jsx", ".json"]) {
  let newest = 0;
  try {
    const walk = (d) => {
      if (!fs.existsSync(d)) return;
      for (const f of fs.readdirSync(d)) {
        if (f === "node_modules" || f === "dist" || f === ".expo") continue;
        const full = path.join(d, f);
        const st = fs.statSync(full);
        if (st.isDirectory()) { walk(full); }
        else if (extensions.some((e) => f.endsWith(e))) {
          if (st.mtimeMs > newest) newest = st.mtimeMs;
        }
      }
    };
    walk(dir);
  } catch { /* ignore */ }
  return newest;
}

function needsRebuild() {
  const jsDir = path.join(DIST_DIR, "_expo", "static", "js", "web");
  if (!fs.existsSync(jsDir)) return true;
  try {
    const files = fs.readdirSync(jsDir);
    const bundleFile = files.find((f) => f.startsWith("entry-") && f.endsWith(".js"));
    if (!bundleFile) return true;
    const bundleMtime = fs.statSync(path.join(jsDir, bundleFile)).mtimeMs;
    const srcMtime = getNewestMtime(path.join(__dirname, "app"));
    if (srcMtime > bundleMtime) {
      console.log("[BUILD] Source files changed — rebuilding…");
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

function buildWeb() {
  console.log("[BUILD] expo export --platform web …");
  const result = spawnSync(
    "pnpm",
    ["--filter", "@workspace/aorane-mobile", "run", "web:export"],
    {
      cwd: path.resolve(__dirname, "../.."),
      stdio: "inherit",
      env: { ...process.env, CI: "1" },
    }
  );
  if (result.status !== 0) {
    console.error("[BUILD] expo export failed — will serve existing dist");
  } else {
    console.log("[BUILD] expo export complete ✓");
  }
}

if (needsRebuild()) {
  buildWeb();
} else {
  console.log("[BUILD] dist/ has a valid bundle, skipping rebuild.");
}

// ---------------------------------------------------------------------------
// Proxy helpers
// ---------------------------------------------------------------------------
function proxyToLocalApi(req, res, urlPath) {
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    const body = Buffer.concat(chunks);
    const options = {
      hostname: "localhost",
      port: LOCAL_API_PORT,
      path:
        urlPath +
        (req.url.includes("?") ? "?" + req.url.split("?")[1] : ""),
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

// The app is built with experiments.baseUrl="/aorane-mobile" so asset paths
// are prefixed with /aorane-mobile. We strip this prefix regardless of how
// the server is accessed (via Replit proxy or via the Expo dev domain directly).
const STATIC_BASE_PREFIX = "/aorane-mobile";

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------
const server = http.createServer((req, res) => {
  let urlPath = req.url.split("?")[0];

  if (BASE_PATH && BASE_PATH !== "/" && urlPath.startsWith(BASE_PATH)) {
    urlPath = urlPath.slice(BASE_PATH.length) || "/";
  }

  // Strip the static base prefix if present (handles direct Expo dev domain access)
  if (STATIC_BASE_PREFIX && urlPath.startsWith(STATIC_BASE_PREFIX)) {
    const after = urlPath.slice(STATIC_BASE_PREFIX.length);
    if (after === "" || after.startsWith("/")) {
      urlPath = after || "/";
    }
  }

  // Proxy /api/* to local API server in dev mode
  if (USE_LOCAL_API && urlPath.startsWith("/api/")) {
    proxyToLocalApi(req, res, urlPath);
    return;
  }

  if (urlPath === "" || urlPath === "/") {
    urlPath = "/index.html";
  }

  const filePath = path.join(DIST_DIR, urlPath);
  const ext = path.extname(filePath).toLowerCase();
  const isAsset = ext !== "" && ext !== ".html";

  const tryServe = (fp) => {
    try {
      const stat = fs.statSync(fp);
      if (stat.isDirectory()) {
        tryServe(path.join(fp, "index.html"));
        return;
      }
      const fext = path.extname(fp).toLowerCase();
      const mime = MIME[fext] || "application/octet-stream";
      // Strong no-cache to prevent stale bundle serving
      const cacheHeader =
        fext === ".html"
          ? "no-store, no-cache, must-revalidate, max-age=0"
          : "no-store, max-age=0";
      res.writeHead(200, {
        "Content-Type": mime,
        "Cache-Control": cacheHeader,
        Pragma: "no-cache",
        Expires: "0",
      });
      fs.createReadStream(fp).pipe(res);
    } catch {
      if (isAsset) {
        // For JS/font/image requests that don't exist — return 404, not HTML
        // This prevents old-cached-HTML → missing-JS → HTML-as-JS infinite loop
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found: " + urlPath);
        return;
      }
      // For HTML/unknown routes → SPA fallback
      const indexPath = path.join(DIST_DIR, "index.html");
      if (fs.existsSync(indexPath)) {
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
          Expires: "0",
        });
        fs.createReadStream(indexPath).pipe(res);
      } else {
        res.writeHead(503, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          "<html><body><h2>App is building…</h2><script>setTimeout(()=>location.reload(),5000)</script></body></html>"
        );
      }
    }
  };

  tryServe(filePath);
});

server.listen(PORT, () => {
  console.log(
    `AORANE Web Preview → http://localhost:${PORT}${BASE_PATH || "/"}`
  );
  if (USE_LOCAL_API) {
    console.log(`[API Proxy] /api/* → localhost:${LOCAL_API_PORT}/api/*`);
  }
});
