import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const isProduction = process.env.NODE_ENV === "production";

const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 3000;

const rawBasePath = process.env.BASE_PATH ?? "/";
const basePath = rawBasePath.replace(/\/+$/, "") || "/";

if (!isProduction && !process.env.PORT) {
  throw new Error("PORT environment variable is required but was not provided.");
}
if (!isProduction && !process.env.BASE_PATH) {
  throw new Error("BASE_PATH environment variable is required but was not provided.");
}

const apiProxyPath = basePath === "/" ? "/api" : `${basePath}/api`;

export default defineConfig({
  base: rawBasePath,
  plugins: [
    react(),
    tailwindcss(),
    ...(isProduction
      ? []
      : [
          (await import("@replit/vite-plugin-runtime-error-modal")).default(),
          ...(process.env.REPL_ID !== undefined
            ? [
                await import("@replit/vite-plugin-cartographer").then((m) =>
                  m.cartographer({
                    root: path.resolve(__dirname, ".."),
                  }),
                ),
                await import("@replit/vite-plugin-dev-banner").then((m) =>
                  m.devBanner(),
                ),
              ]
            : []),
        ]),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@assets": path.resolve(__dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(__dirname),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache",
    },
    proxy: {
      [apiProxyPath]: {
        target: "http://localhost:8080",
        changeOrigin: true,
        rewrite: basePath === "/"
          ? undefined
          : (reqPath: string) => reqPath.replace(new RegExp(`^${basePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`), ""),
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
