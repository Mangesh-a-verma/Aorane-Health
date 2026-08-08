import { defineConfig } from "drizzle-kit";

// NOTE: `drizzle-kit generate` diffs the schema files against the SQL
// migrations already on disk and does NOT need a live database connection —
// it must be runnable locally/in CI with no DATABASE_URL set. Only
// `drizzle-kit migrate` (and `push`) actually connect, and those already
// fail with a clear driver-level error if the URL is missing/invalid, so we
// no longer throw eagerly here just because the env var happens to be unset
// at config-load time (that eager throw previously made `generate` unusable
// without a live DB, which is why no versioned migrations existed at all).
export default defineConfig({
  // Must be a plain relative path with forward slashes — NOT
  // path.join(__dirname, ...). On Windows, __dirname/path.join produce
  // backslash paths (e.g. "D:\...\src\schema\index.ts"), but drizzle-kit
  // resolves `schema` internally via a glob matcher, and glob patterns
  // treat backslash as an escape character, not a path separator. A
  // backslash path silently matches zero files there, failing with
  // "No schema files found for path config [...]" even though the file
  // exists exactly where it says. All drizzle-kit scripts in package.json
  // run with cwd = this package directory (lib/db), so a relative
  // forward-slash path resolves correctly on Windows, macOS, and Linux.
  schema: "./src/schema/index.ts",
  // Same reasoning as `schema` above — plain relative path, no path.join.
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});