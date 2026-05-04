const { getDefaultConfig } = require("expo/metro-config");
const fs = require("fs");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.projectRoot = projectRoot;

// Watch both dirs
config.watchFolders = [workspaceRoot, projectRoot].filter((d) => {
  try { fs.statSync(d); return true; } catch { return false; }
});

config.resolver = config.resolver || {};
config.resolver.unstable_enableSymlinks = true;
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// ── pnpm store auto-discovery ─────────────────────────────────────────────────
// pnpm keeps real package files in node_modules/.pnpm/<name>@<ver>/node_modules/<name>
// Metro can't follow these double-symlinks. We find the real path and map it directly.
function findInPnpmStore(pkgName) {
  const safeName = pkgName.replace(/\//g, "+");
  const searchRoots = [projectRoot, workspaceRoot];
  for (const root of searchRoots) {
    const pnpmDir = path.join(root, "node_modules", ".pnpm");
    try {
      const entries = fs.readdirSync(pnpmDir);
      const match = entries.find((e) => e.startsWith(safeName + "@"));
      if (match) {
        const p = path.join(pnpmDir, match, "node_modules", pkgName);
        if (fs.existsSync(p)) return p;
      }
    } catch { /* dir not found, skip */ }
  }
  return null;
}

function resolvePackage(pkgName) {
  // 1. Direct in app node_modules (real dir or npm-installed)
  const direct = path.join(projectRoot, "node_modules", pkgName);
  try {
    const stat = fs.lstatSync(direct);
    if (stat.isDirectory()) return direct;
    // It's a symlink — resolve it
    const real = fs.realpathSync(direct);
    if (fs.existsSync(real)) return real;
  } catch { /* not found */ }

  // 2. In workspace root node_modules
  const fromRoot = path.join(workspaceRoot, "node_modules", pkgName);
  try {
    const stat = fs.lstatSync(fromRoot);
    if (stat.isDirectory()) return fromRoot;
    const real = fs.realpathSync(fromRoot);
    if (fs.existsSync(real)) return real;
  } catch { /* not found */ }

  // 3. Search pnpm virtual store
  return findInPnpmStore(pkgName);
}

// Packages that are known to fail with pnpm symlinks
const FORCE_RESOLVE = ["react-native-health-connect"];
const extraNodeModules = {};
for (const pkg of FORCE_RESOLVE) {
  const resolved = resolvePackage(pkg);
  if (resolved) {
    extraNodeModules[pkg] = resolved;
    console.log(`[metro] Resolved ${pkg} → ${resolved}`);
  } else {
    console.warn(`[metro] WARNING: Could not resolve ${pkg}`);
  }
}
config.resolver.extraNodeModules = extraNodeModules;

module.exports = config;
