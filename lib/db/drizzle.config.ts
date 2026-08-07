import { defineConfig } from "drizzle-kit";
import path from "path";

// NOTE: `drizzle-kit generate` diffs the schema files against the SQL
// migrations already on disk and does NOT need a live database connection —
// it must be runnable locally/in CI with no DATABASE_URL set. Only
// `drizzle-kit migrate` (and `push`) actually connect, and those already
// fail with a clear driver-level error if the URL is missing/invalid, so we
// no longer throw eagerly here just because the env var happens to be unset
// at config-load time (that eager throw previously made `generate` unusable
// without a live DB, which is why no versioned migrations existed at all).
export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  // Must be a plain relative path (not resolved via path.join/__dirname) —
  // drizzle-kit's internal snapshot-validation step string-concatenates a
  // "./" prefix onto `out` when reading past migrations' meta files, which
  // produces a malformed, doubled path if `out` is already absolute. All
  // drizzle-kit scripts in package.json run with cwd = this package
  // directory (lib/db), so "./drizzle" resolves correctly.
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});