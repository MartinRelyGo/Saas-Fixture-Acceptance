/**
 * Database access for the fixture.
 *
 * A real Postgres engine (PGlite) runs in-process, so migrations, roles and
 * row-level security behave exactly as they would on a hosted Postgres.
 *
 * Every request-scoped query runs inside a transaction that:
 *   1. drops privileges to the non-superuser role `app_user`, and
 *   2. sets `app.tenant_id` / `app.role` from the authenticated session.
 *
 * That means tenancy is enforced by the database, not by query authorship.
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = path.join(HERE, "..", "db", "migrations");

export async function listMigrations() {
  const entries = await readdir(MIGRATIONS_DIR);
  return entries.filter((f) => f.endsWith(".sql")).sort();
}

/** Creates a fresh database and applies every migration in order. */
export async function createDatabase() {
  const db = await PGlite.create();
  await db.exec(`
    CREATE TABLE schema_migrations (
      name       text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  for (const name of await listMigrations()) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, name), "utf8");
    await db.exec(sql);
    await db.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
  }
  return db;
}

/**
 * Runs `fn` with the session pinned to one tenant and role.
 * Throws if no session is supplied: there is no "trusted" unscoped path.
 */
export async function withSession(db, session, fn) {
  if (!session || !session.tenantId || !session.role) {
    throw new Error("withSession requires an authenticated session");
  }
  await db.exec("BEGIN");
  try {
    await db.exec("SET LOCAL ROLE app_user");
    await db.query("SELECT set_config('app.tenant_id', $1, true)", [session.tenantId]);
    await db.query("SELECT set_config('app.role', $1, true)", [session.role]);
    const result = await fn(db);
    await db.exec("COMMIT");
    return result;
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
}
