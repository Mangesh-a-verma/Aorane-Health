const { getDefaultConfig } = require("expo/metro-config");
const fs = require("fs");

const config = getDefaultConfig(__dirname);

// Remove watchFolders that don't exist (fixes CI/Codemagic builds where
// getDefaultConfig auto-detects monorepo root but root node_modules are absent)
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

module.exports = config;
