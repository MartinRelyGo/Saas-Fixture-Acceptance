import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { createDatabase, listMigrations } from "../src/db.js";

let db;

before(async () => {
  db = await createDatabase();
});

after(async () => {
  await db.close();
});

test("every migration file is recorded as applied", async () => {
  const files = await listMigrations();
  const res = await db.query("SELECT name FROM schema_migrations ORDER BY name");
  assert.deepEqual(
    res.rows.map((r) => r.name),
    files,
  );
});

test("tenant-scoped tables have RLS enabled and forced", async () => {
  const res = await db.query(
    `SELECT relname, relrowsecurity, relforcerowsecurity
     FROM pg_class
     WHERE relname IN ('tenants', 'members', 'projects')
     ORDER BY relname`,
  );
  assert.equal(res.rows.length, 3);
  for (const row of res.rows) {
    assert.equal(row.relrowsecurity, true, `${row.relname} must have RLS enabled`);
    assert.equal(row.relforcerowsecurity, true, `${row.relname} must force RLS`);
  }
});

test("deleting a project is restricted to owners at the database level", async () => {
  const res = await db.query(
    "SELECT qual FROM pg_policies WHERE tablename = 'projects' AND cmd = 'DELETE'",
  );
  assert.equal(res.rows.length, 1);
  assert.match(res.rows[0].qual, /app\.role/);
});
