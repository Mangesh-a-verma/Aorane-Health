const { getDefaultConfig } = require("expo/metro-config");
const fs = require("fs");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.projectRoot = projectRoot;

// Include workspace root so Metro can resolve pnpm hoisted packages
const foldersToWatch = [workspaceRoot, projectRoot];
config.watchFolders = foldersToWatch.filter((folder) => {
  try { fs.statSync(folder); return true; } catch { return false; }
});

// Look in both app node_modules AND monorepo root node_modules
// pnpm installs packages at root level — both paths needed
config.resolver = config.resolver || {};
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
