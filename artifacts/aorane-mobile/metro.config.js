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

// Find package in node_modules (handles both npm real dirs and pnpm symlinks)
function findPkgDir(pkg) {
  const searchRoots = [projectRoot, workspaceRoot];
  for (const root of searchRoots) {
    // Direct node_modules (npm install or pnpm shameful-hoist)
    const direct = path.join(root, "node_modules", pkg);
    try {
      const real = fs.realpathSync(direct);
      if (fs.existsSync(path.join(real, "package.json"))) {
        return real;
      }
    } catch (e) {}

    // pnpm virtual store (.pnpm/)
    const store = path.join(root, "node_modules", ".pnpm");
    try {
      const entries = fs.readdirSync(store);
      for (const entry of entries) {
        if (entry.startsWith(pkg + "@") || entry.startsWith(pkg.replace("/", "+") + "@")) {
          const candidate = path.join(store, entry, "node_modules", pkg);
          if (fs.existsSync(path.join(candidate, "package.json"))) {
            return candidate;
          }
        }
      }
    } catch (e) {}
  }
  return null;
}

// Find JS entry file, respecting "react-native" field (Metro priority) then "main"
function findEntry(pkgDir) {
  let pkg = {};
  try { pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8")); } catch (e) {}

  const exts = ["", ".js", ".jsx", ".ts", ".tsx"];
  // Metro prefers "react-native" field over "main"
  const candidates = [
    pkg["react-native"],
    pkg.main,
    "index",
    "src/index",
  ].filter((f) => f && typeof f === "string");

  for (const candidate of candidates) {
    const base = path.join(pkgDir, candidate);
    for (const ext of exts) {
      const f = base + ext;
      try {
        if (fs.statSync(f).isFile()) return f;
      } catch (e) {}
    }
    // If candidate is a directory, look for index inside
    try {
      if (fs.statSync(base).isDirectory()) {
        for (const ext of exts.filter((e) => e)) {
          const idx = path.join(base, "index" + ext);
          if (fs.existsSync(idx)) return idx;
        }
      }
    } catch (e) {}
  }
  return null;
}

// Force-resolve react-native-health-connect in both npm and pnpm environments
config.resolver.resolveRequest = function (context, moduleName, platform) {
  if (moduleName === "react-native-health-connect") {
    const pkgDir = findPkgDir(moduleName);
    if (pkgDir) {
      const entry = findEntry(pkgDir);
      if (entry) {
        console.log("[metro] HC resolved:", entry);
        return { type: "sourceFile", filePath: entry };
      }
      console.warn("[metro] HC dir found but no entry:", pkgDir);
    } else {
      console.warn("[metro] HC NOT found in node_modules. projectRoot:", projectRoot);
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
