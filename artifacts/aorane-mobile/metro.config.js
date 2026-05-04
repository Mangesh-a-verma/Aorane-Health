const { getDefaultConfig } = require("expo/metro-config");
const fs = require("fs");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.projectRoot = projectRoot;

config.watchFolders = [workspaceRoot, projectRoot].filter((d) => {
  try { fs.statSync(d); return true; } catch { return false; }
});

config.resolver = config.resolver || {};
config.resolver.unstable_enableSymlinks = true;
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

/**
 * Find a package by scanning direct paths and pnpm virtual store.
 * Returns the real (de-symlinked) directory path, or null if not found.
 */
function findPackage(pkgName, roots) {
  for (const root of roots) {
    // Direct path (npm install or shameful-hoist)
    const direct = path.resolve(root, "node_modules", pkgName);
    try {
      const real = fs.realpathSync(direct);
      if (fs.existsSync(path.join(real, "package.json"))) {
        return real;
      }
    } catch (_) {}

    // pnpm virtual store: node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>
    const pnpmStore = path.resolve(root, "node_modules/.pnpm");
    try {
      const entries = fs.readdirSync(pnpmStore);
      for (const entry of entries) {
        if (entry.startsWith(pkgName + "@") || entry.startsWith(pkgName.replace("/", "+") + "@")) {
          const candidate = path.resolve(pnpmStore, entry, "node_modules", pkgName);
          if (fs.existsSync(path.join(candidate, "package.json"))) {
            return candidate;
          }
        }
      }
    } catch (_) {}
  }
  return null;
}

// Packages that pnpm may symlink but Metro can't follow
const nativePackages = [
  "react-native-health-connect",
];

const extraNodeModules = {};
for (const pkg of nativePackages) {
  const resolved = findPackage(pkg, [projectRoot, workspaceRoot]);
  if (resolved) {
    extraNodeModules[pkg] = resolved;
    console.log(`[metro] Resolved ${pkg} → ${resolved}`);
  } else {
    console.warn(`[metro] WARNING: ${pkg} not found — build may fail`);
  }
}

config.resolver.extraNodeModules = extraNodeModules;

module.exports = config;
