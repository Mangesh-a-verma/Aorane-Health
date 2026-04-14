const { getDefaultConfig } = require("expo/metro-config");
const fs = require("fs");
const path = require("path");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Force projectRoot to be the app directory (not auto-detected monorepo root)
config.projectRoot = projectRoot;

// Filter out watchFolders that don't physically exist (fixes CI builds
// where getDefaultConfig adds monorepo root but root node_modules are absent)
if (config.watchFolders) {
  config.watchFolders = config.watchFolders.filter((folder) => {
    try {
      fs.statSync(folder);
      return true;
    } catch {
      return false;
    }
  });
}

// Ensure resolver only looks in existing locations
config.resolver = config.resolver || {};
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];

module.exports = config;
