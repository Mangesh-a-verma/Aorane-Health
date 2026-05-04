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

// Find a package in direct node_modules or inside the pnpm virtual store.
// Returns the real (de-symlinked) directory path, or null if not found.
function findPkg(pkg, roots) {
  for (var i = 0; i < roots.length; i++) {
    var root = roots[i];

    // Check direct path first (npm install or shameful-hoist creates real dirs)
    var direct = path.join(root, "node_modules", pkg);
    try {
      var real = fs.realpathSync(direct);
      if (fs.existsSync(path.join(real, "package.json"))) {
        return real;
      }
    } catch (e1) {}

    // Scan pnpm virtual store: node_modules/.pnpm/PKGNAME@VERSION/node_modules/PKGNAME
    var store = path.join(root, "node_modules", ".pnpm");
    try {
      var entries = fs.readdirSync(store);
      for (var j = 0; j < entries.length; j++) {
        var candidate = path.join(store, entries[j], "node_modules", pkg);
        if (fs.existsSync(path.join(candidate, "package.json"))) {
          return candidate;
        }
      }
    } catch (e2) {}
  }
  return null;
}

// Given a package directory, find the JS entry file using package.json "main".
function findEntry(pkgDir) {
  var pkg = {};
  try { pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8")); } catch (e) {}

  var exts = ["", ".js", ".jsx", ".ts", ".tsx"];
  var bases = [];
  if (pkg.main) bases.push(path.join(pkgDir, pkg.main));
  bases.push(path.join(pkgDir, "index"));
  bases.push(path.join(pkgDir, "src", "index"));

  for (var b = 0; b < bases.length; b++) {
    for (var e = 0; e < exts.length; e++) {
      var f = bases[b] + exts[e];
      try {
        if (fs.statSync(f).isFile()) return f;
      } catch (err) {}
    }
    // If base is a directory, look for index inside it
    try {
      if (fs.statSync(bases[b]).isDirectory()) {
        for (var e2 = 0; e2 < exts.length; e2++) {
          var idx = path.join(bases[b], "index" + exts[e2]);
          if (fs.existsSync(idx)) return idx;
        }
      }
    } catch (err2) {}
  }
  return null;
}

// Intercept resolution for packages that pnpm symlinks but Metro cannot follow.
config.resolver.resolveRequest = function(context, moduleName, platform) {
  if (moduleName === "react-native-health-connect") {
    var pkgDir = findPkg(moduleName, [projectRoot, workspaceRoot]);
    if (pkgDir) {
      var entry = findEntry(pkgDir);
      if (entry) {
        console.log("[metro] resolved " + moduleName + " -> " + entry);
        return { type: "sourceFile", filePath: entry };
      }
      console.warn("[metro] found dir but no entry for " + moduleName + ": " + pkgDir);
    } else {
      console.warn("[metro] NOT FOUND: " + moduleName);
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
