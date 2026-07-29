const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot   = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.projectRoot = projectRoot;

// 1. Monorepo: watch the full workspace so shared packages resolve
config.watchFolders = [workspaceRoot];

// 2. Module resolution priority (project node_modules first, then workspace)
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// 3. PNPM symlinks + package exports (needed for expo-notifications, etc.)
config.resolver.unstable_enableSymlinks        = true;
config.resolver.unstable_enablePackageExports  = true;

// 4. Bundle size optimisation — minifier tuning
//    Metro uses terser in release builds; these options further reduce
//    dead-code and drop console.* calls from the production bundle.
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    compress: {
      // Remove console.log / console.debug from release APK
      drop_console: true,
      // Inline small functions (reduces call overhead)
      inline: 2,
      // Remove dead code branches
      dead_code: true,
      // Remove unreachable code
      sequences: true,
    },
    mangle: true,
  },
};

module.exports = config;