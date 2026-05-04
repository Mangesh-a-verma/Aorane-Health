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

// Follow symlinks for any remaining pnpm symlinked packages
config.resolver.unstable_enableSymlinks = true;

// Search order: app node_modules first, then workspace root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
