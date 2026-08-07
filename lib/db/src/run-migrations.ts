// ══════════════════════════════════════════════════════════════════════════
// SCHEMA MIGRATION RUNNER
// ──────────────────────────────────────────────────────────────────────────
// This is the *single source of truth* for table/column structure. It applies
// the versioned SQL files under ./drizzle (generated from ../schema/*.ts via
// `drizzle-kit generate`) using drizzle-orm's own migrator, which tracks
// applied migrations in a `drizzle.__drizzle_migrations` table so each
// migration file runs exactly once, ever, on a given database.
//
// Why this exists (see artifacts/api-server/src/lib/migrate.ts for the full
// history): that file used to be the *only* place table structure was
// defined for the production deploy path, as hand-written idempotent SQL
// with no mechanical link to the actual Drizzle schema in ../schema/*.ts.
// The two were free to drift — and had already drifted for 23 tables,
// including `users` itself, before that file was patched to catch up.
// Hand-written SQL and a TypeScript ORM schema are two independent sources
// of truth for the same thing; nothing enforced that every schema.ts change
// also got a matching hand-written statement, so future changes could
// silently reintroduce the same class of bug.
//
// Going forward, the workflow is:
//   1. Edit a table in lib/db/src/schema/*.ts
//   2. Run `pnpm --filter @workspace/db generate` — drizzle-kit diffs the
//      schema against the last migration and writes a new numbered SQL file
//      under ./drizzle, committed to git.
//   3. Deploy. This runner applies any not-yet-applied migration files, in
//      order, exactly once. `../lib/migrate.ts` (the legacy hardening/seed
//      script) keeps running after this, unchanged, as a backward-compatible
//      safety net — see the note in that file.
//
// BASELINING EXISTING DATABASES
// ──────────────────────────────────────────────────────────────────────────
// Every current production database already has this schema (created over
// time via manual `drizzle-kit push` runs and artifacts/api-server's
// migrate.ts ALTER statements) — it did NOT come from running migration
// 0000. Migration 0000 is a full `CREATE TABLE` snapshot with no
// `IF NOT EXISTS` guards (that's how drizzle-kit generates SQL), so naively
// running it against a database that already has these tables would fail
// with "relation already exists".
//
// So before handing off to drizzle-orm's migrate(), we check: does this
// database already have a `users` table but no migration history yet? If
// so, it predates this migration system — record migration 0000 as already
// applied WITHOUT executing its SQL, then proceed. drizzle-orm's migrator
// only compares the *watermark* (the newest applied migration's timestamp)
// to decide what to run next, so this correctly:
//   - Skips 0000 forever on every existing production database (no data or
//     schema touched, nothing dropped or altered).
//   - Still applies any migration generated AFTER 0000 (0001, 0002, ...) on
//     its very next deploy, exactly like a database that ran 0000 for real.
//   - Runs 0000 (and everything after it) in full, normally, on a genuinely
//     empty/fresh database.
// ══════════════════════════════════════════════════════════════════════════

import { migrate } from "drizzle-orm/node-postgres/migrator";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db, pool } from "./index";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(__dirname, "..", "drizzle");

const MIGRATIONS_SCHEMA = "drizzle";
const MIGRATIONS_TABLE = "__drizzle_migrations";

async function tableExists(schema: string, name: string): Promise<boolean> {
  const { rows } = await pool.query<{ reg: string | null }>(
    "SELECT to_regclass($1) AS reg",
    [`${schema}.${name}`],
  );
  return rows[0]?.reg !== null;
}

async function baselineIfNeeded(): Promise<void> {
  // Match the exact table drizzle-orm's own migrator creates/expects, so our
  // manual insert and its own watermark check agree on structure.
  await pool.query(`CREATE SCHEMA IF NOT EXISTS ${MIGRATIONS_SCHEMA}`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_SCHEMA}.${MIGRATIONS_TABLE} (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  const { rows: historyRows } = await pool.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM ${MIGRATIONS_SCHEMA}.${MIGRATIONS_TABLE}`,
  );
  if (historyRows[0].count > 0) {
    // Migration history already tracked (either a fresh DB that already ran
    // through this runner once, or a previously-baselined DB) — nothing to do.
    return;
  }

  const isPreExistingDatabase = await tableExists("public", "users");
  if (!isPreExistingDatabase) {
    // Genuinely empty database — let migrate() below run 0000 (and anything
    // after it) in full, exactly as generated.
    return;
  }

  const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
  if (!fs.existsSync(journalPath)) return;
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8")) as {
    entries: { tag: string; when: number }[];
  };
  const baseline = journal.entries[0];
  if (!baseline) return;

  const migrationSqlPath = path.join(migrationsFolder, `${baseline.tag}.sql`);
  const migrationSql = fs.readFileSync(migrationSqlPath, "utf-8");
  const hash = crypto.createHash("sha256").update(migrationSql).digest("hex");

  await pool.query(
    `INSERT INTO ${MIGRATIONS_SCHEMA}.${MIGRATIONS_TABLE} (hash, created_at) VALUES ($1, $2)`,
    [hash, baseline.when],
  );

  // eslint-disable-next-line no-console
  console.log(
    `[schema-migrate] Pre-existing database detected — baselined "${baseline.tag}" ` +
      `as already applied (no SQL executed). Future migrations will still run normally.`,
  );
}

export async function runSchemaMigrations(): Promise<void> {
  await baselineIfNeeded();
  await migrate(db, { migrationsFolder });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runSchemaMigrations()
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("[schema-migrate] Schema migrations up to date.");
      process.exit(0);
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[schema-migrate] Schema migration failed:", err);
      process.exit(1);
    });
}
