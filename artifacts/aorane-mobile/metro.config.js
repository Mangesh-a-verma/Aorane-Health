const { getDefaultConfig } = require("expo/metro-config");
const fs = require("fs");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.projectRoot = projectRoot;

// Watch both app dir and workspace root
const foldersToWatch = [workspaceRoot, projectRoot];
config.watchFolders = foldersToWatch.filter((folder) => {
  try { fs.statSync(folder); return true; } catch { return false; }
});

config.resolver = config.resolver || {};

// Follow symlinks — required for pnpm which uses symlinked node_modules
config.resolver.unstable_enableSymlinks = true;

// Look in app node_modules first, then workspace root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
