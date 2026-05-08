const http = require("http");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
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

// Files with a content hash in their name are safe to cache forever (immutable)
// Expo exports files like: entry-4d6bbd0abebf.js  or  Inter_400Regular.ddbb1cd55ad5.ttf
const HASH_PATTERN = /[._-][0-9a-f]{8,}\.(js|css|ttf|woff|woff2|png|jpg|jpeg|gif|svg)$/i;

function getCacheHeader(filePath, ext) {
  if (ext === ".html") return "no-store, no-cache, must-revalidate, max-age=0";
  if (HASH_PATTERN.test(filePath)) return "public, max-age=31536000, immutable";
  return "public, max-age=3600";
}

// Extensions worth gzip-compressing
const COMPRESSIBLE = new Set([".js", ".css", ".json", ".svg", ".map", ".html"]);

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

  // DEV-ONLY: /dev-login
  // - GET /dev-login              → phone number form UI
  // - GET /dev-login?token=&user= → legacy auto-inject (for test scripts)
  // - POST /dev-login             → phone lookup → inject token → redirect
  if (process.env.NODE_ENV !== "production" && urlPath === "/dev-login") {
    const qs = new URLSearchParams(req.url.includes("?") ? req.url.split("?")[1] : "");
    const redirectTo = (BASE_PATH || "") + "/";

    // Legacy: ?token=xxx&user=xxx → inject and redirect immediately
    if (req.method === "GET" && qs.get("token")) {
      const token = qs.get("token") || "";
      const user = qs.get("user") || "{}";
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Dev Login…</title></head><body>
<script>
try {
  localStorage.setItem('auth_token', ${JSON.stringify(token)});
  localStorage.setItem('refresh_token', ${JSON.stringify(token)});
  localStorage.setItem('onboarding_done', '1');
  localStorage.setItem('user_data', ${JSON.stringify(user)});
} catch(e) { console.error('dev-login storage error', e); }
window.location.replace(${JSON.stringify(redirectTo)});
</script><p>Logging in…</p></body></html>`;
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      res.end(html);
      return;
    }

    // POST: receive phone from form → call local api /auth/dev-login → inject token
    if (req.method === "POST") {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", async () => {
        try {
          const body = Buffer.concat(chunks).toString();
          const params = new URLSearchParams(body);
          const phone = (params.get("phone") || "").trim().replace(/\D/g, "").slice(-10);
          if (!phone || phone.length !== 10) {
            res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
            res.end(`<p style="color:red">Invalid phone. <a href="${(BASE_PATH||"")}/dev-login">Go back</a></p>`);
            return;
          }

          const apiRes = await new Promise((resolve, reject) => {
            const postBody = JSON.stringify({ phone });
            const opts = {
              hostname: "localhost",
              port: LOCAL_API_PORT,
              path: "/api/auth/dev-login",
              method: "POST",
              headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(postBody) },
            };
            const apiReq = http.request(opts, (apiResp) => {
              const parts = [];
              apiResp.on("data", (d) => parts.push(d));
              apiResp.on("end", () => resolve({ status: apiResp.statusCode, body: Buffer.concat(parts).toString() }));
            });
            apiReq.on("error", reject);
            apiReq.write(postBody);
            apiReq.end();
          });

          if (apiRes.status !== 200) {
            const errData = (() => { try { return JSON.parse(apiRes.body); } catch { return {}; } })();
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
            res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Dev Login</title>
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fff5f5}
.box{background:#fff;border-radius:16px;padding:32px;max-width:360px;width:100%;box-shadow:0 4px 24px #0001}
h2{color:#c00;margin:0 0 8px}p{color:#666;margin:0 0 20px}
input{width:100%;padding:12px;border:2px solid #e44;border-radius:8px;font-size:16px;box-sizing:border-box;margin-bottom:12px}
button{width:100%;padding:12px;background:#e44;color:#fff;border:none;border-radius:8px;font-size:16px;cursor:pointer}</style></head>
<body><div class="box"><h2>❌ User not found</h2>
<p>${errData.error || "Phone number not registered."}</p>
<form method="POST" action="${(BASE_PATH||"")}/dev-login">
<input type="tel" name="phone" placeholder="10-digit phone number" required autofocus/>
<button type="submit">Try Again</button></form></div></body></html>`);
            return;
          }

          const data = (() => { try { return JSON.parse(apiRes.body); } catch { return {}; } })();
          const userData = JSON.stringify(data.user || {});
          const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Dev Login…</title></head><body>
<script>
try {
  localStorage.setItem('auth_token', ${JSON.stringify(data.token || "")});
  localStorage.setItem('refresh_token', ${JSON.stringify(data.refreshToken || "")});
  localStorage.setItem('onboarding_done', '1');
  localStorage.setItem('user_data', ${JSON.stringify(userData)});
} catch(e) { console.error('dev-login storage error', e); }
window.location.replace(${JSON.stringify(redirectTo)});
</script><p>Logging in as ${data.user?.fullName || phone}…</p></body></html>`;
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
          res.end(html);
        } catch (err) {
          console.error("[DevLogin] POST error:", err.message);
          res.writeHead(502, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`<p>API error: ${err.message}. <a href="${(BASE_PATH||"")}/dev-login">Go back</a></p>`);
        }
      });
      return;
    }

    // GET /dev-login → show phone input form
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AORANE Dev Login</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, #f0f7ff 0%, #e8f4fd 100%); }
  .card { background: #fff; border-radius: 20px; padding: 40px 36px;
    max-width: 380px; width: 100%; box-shadow: 0 8px 40px rgba(26,115,232,0.12); }
  .logo { font-size: 28px; font-weight: 800; color: #1a73e8; letter-spacing: -0.5px; margin-bottom: 4px; }
  .badge { display: inline-block; background: #fff3cd; color: #856404;
    font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px;
    border: 1px solid #ffc107; margin-bottom: 24px; }
  h2 { font-size: 20px; color: #1a1a2e; margin-bottom: 6px; }
  p { color: #666; font-size: 14px; margin-bottom: 28px; line-height: 1.5; }
  label { display: block; font-size: 13px; font-weight: 600; color: #444; margin-bottom: 8px; }
  .input-wrap { position: relative; margin-bottom: 16px; }
  .prefix { position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
    color: #888; font-size: 15px; font-weight: 500; pointer-events: none; }
  input[type=tel] { width: 100%; padding: 13px 13px 13px 44px;
    border: 2px solid #e0e8f0; border-radius: 10px; font-size: 16px;
    outline: none; transition: border-color .2s; }
  input[type=tel]:focus { border-color: #1a73e8; }
  button { width: 100%; padding: 14px; background: #1a73e8; color: #fff;
    border: none; border-radius: 10px; font-size: 16px; font-weight: 600;
    cursor: pointer; transition: background .2s; }
  button:hover { background: #1557b0; }
  .note { margin-top: 20px; padding: 12px 14px; background: #f8f9fa;
    border-radius: 8px; font-size: 12px; color: #888; line-height: 1.6; }
  .note strong { color: #444; }
</style>
</head>
<body>
<div class="card">
  <div class="logo">AORANE</div>
  <div class="badge">🔧 DEV MODE</div>
  <h2>Developer Login</h2>
  <p>Enter your registered phone number to get a dev JWT and log in without OTP.</p>
  <form method="POST" action="${(BASE_PATH||"")}/dev-login">
    <label>Phone Number</label>
    <div class="input-wrap">
      <span class="prefix">+91</span>
      <input type="tel" name="phone" placeholder="9876543210" maxlength="10"
        pattern="[0-9]{10}" required autofocus inputmode="numeric"/>
    </div>
    <button type="submit">Login Instantly →</button>
  </form>
  <div class="note">
    <strong>Dev only</strong> — bypasses OTP. Uses local api-server JWT secret.<br>
    Not available in production builds.
  </div>
</div>
</body>
</html>`;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(html);
    return;
  }

  if (urlPath === "" || urlPath === "/") {
    urlPath = "/index.html";
  }

  const filePath = path.join(DIST_DIR, urlPath);
  const ext = path.extname(filePath).toLowerCase();
  const isAsset = ext !== "" && ext !== ".html";

  const serveBuffer = (fp, mime, cacheHeader) => {
    const data = fs.readFileSync(fp);
    const acceptsGzip = (req.headers["accept-encoding"] || "").includes("gzip");
    if (acceptsGzip && COMPRESSIBLE.has(ext)) {
      zlib.gzip(data, (err, compressed) => {
        if (err) {
          res.writeHead(200, { "Content-Type": mime, "Cache-Control": cacheHeader });
          res.end(data);
        } else {
          res.writeHead(200, {
            "Content-Type": mime,
            "Content-Encoding": "gzip",
            "Cache-Control": cacheHeader,
            "Vary": "Accept-Encoding",
          });
          res.end(compressed);
        }
      });
    } else {
      res.writeHead(200, { "Content-Type": mime, "Cache-Control": cacheHeader });
      res.end(data);
    }
  };

  const tryServe = (fp) => {
    try {
      const stat = fs.statSync(fp);
      if (stat.isDirectory()) {
        tryServe(path.join(fp, "index.html"));
        return;
      }
      const fext = path.extname(fp).toLowerCase();
      const mime = MIME[fext] || "application/octet-stream";
      const cacheHeader = getCacheHeader(fp, fext);
      serveBuffer(fp, mime, cacheHeader);
    } catch {
      if (isAsset) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found: " + urlPath);
        return;
      }
      // SPA fallback for HTML routes
      const indexPath = path.join(DIST_DIR, "index.html");
      if (fs.existsSync(indexPath)) {
        const mime = "text/html; charset=utf-8";
        const cacheHeader = "no-store, no-cache, must-revalidate, max-age=0";
        serveBuffer(indexPath, mime, cacheHeader);
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
