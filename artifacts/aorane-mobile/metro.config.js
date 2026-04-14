const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(__dirname, "../..");

const config = getDefaultConfig(projectRoot);

const rootNodeModules = path.resolve(workspaceRoot, "node_modules");
const isMonorepo = fs.existsSync(path.join(workspaceRoot, "pnpm-workspace.yaml"));
const rootNodeModulesExist = fs.existsSync(rootNodeModules);

if (isMonorepo && rootNodeModulesExist) {
  config.watchFolders = [...(config.watchFolders || []), workspaceRoot];
  config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, "node_modules"),
    rootNodeModules,
  ];
}

module.exports = config;
