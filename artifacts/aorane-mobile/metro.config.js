const { getDefaultConfig } = require("expo/metro-config");
const fs = require("fs");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.projectRoot = projectRoot;
config.watchFolders = [projectRoot, workspaceRoot].filter((d) => {
  try { fs.statSync(d); return true; } catch { return false; }
});

config.resolver = config.resolver || {};
config.resolver.unstable_enableSymlinks = true;
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

/**
 * Search for a package directory in:
 *   1. root/node_modules/<pkg>          (npm install or shameful-hoist)
 *   2. root/node_modules/.pnpm/<pkg>@*/node_modules/<pkg>   (pnpm store)
 * Returns real path (symlinks resolved) or null.
 */
function findPkg(pkg, roots) {
  for (const root of roots) {
    const direct = path.join(root, "node_modules", pkg);
    try {
      const real = fs.realpathSync(direct);
      if (fs.existsSync(path.join(real, "package.json"))) {
        return real;
      }
    } catch (_) {}

    const store = path.join(root, "node_modules", ".pnpm");
    try {
      const entries = fs.readdirSync(store);
      for (const e of entries) {
        const candidate = path.join(store, e, "node_modules", pkg);
        if (fs.existsSync(path.join(candidate, "package.json"))) {
          return candidate;
        }
      }
    } catch (_) {}
  }
  return null;
}

/**
 * Given a resolved package directory, find the main JS entry file.
 */
function findEntry(pkgDir) {
  let pkg = {};
  try { pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8")); } catch (_) {}

  const exts = ["", ".js", ".jsx", ".ts", ".tsx"];
  const candidates = [];

  // Respect package.json "main" field
  if (pkg.main) candidates.push(path.join(pkgDir, pkg.main));

  // Fallback: index at root
  candidates.push(path.join(pkgDir, "index"));
  candidates.push(path.join(pkgDir, "src", "index"));

  for (const c of candidates) {
    for (const ext of exts) {
      const f = c.endsWith(ext) ? c : c + ext;
      if (fs.existsSync(f) && fs.statSync(f).isFile()) return f;
    }
    // If candidate itself is a directory, try index inside it
    if (fs.existsSync(c) && fs.statSync(c).isDirectory()) {
      for (const ext of exts) {
        const f = path.join(c, "index" + ext);
        if (fs.existsSync(f)) return f;
      }
    }
  }
  return null;
}

// Use resolveRequest to handle packages that pnpm symlinks
// This gives Metro an exact file path — no guessing needed.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react-native-health-connect") {
    const pkgDir = findPkg(moduleName, [projectRoot, workspaceRoot]);
    if (pkgDir) {
      const entry = findEntry(pkgDir);
      if (entry) {
        console.log(`[metro] ✓ ${moduleName} → ${entry}`);
        return { type: "sourceFile", filePath: entry };
      }
      console.warn(`[metro] Found dir but no entry for ${moduleName}: ${pkgDir}`);
    } else {
      console.warn(`[metro] ✗ ${moduleName} NOT found — check install steps`);
    }
  }
  // Default resolution for all other modules
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
