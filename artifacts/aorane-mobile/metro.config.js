const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(__dirname, "../..");

const config = getDefaultConfig(projectRoot);

if (fs.existsSync(path.join(workspaceRoot, "pnpm-workspace.yaml"))) {
  config.watchFolders = [...(config.watchFolders || []), workspaceRoot];
  config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, "node_modules"),
    path.resolve(workspaceRoot, "node_modules"),
  ];
}

module.exports = config;
