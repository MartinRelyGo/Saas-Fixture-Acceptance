import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { createDatabase, withSession } from "../src/db.js";
import { createProject, deleteProject, listProjects } from "../src/projects.js";

const OWNER_A = { tenantId: "a", role: "owner" };
const OWNER_B = { tenantId: "b", role: "owner" };

let db;

before(async () => {
  db = await createDatabase();
});

after(async () => {
  await db.close();
});

test("a tenant only sees its own projects", async () => {
  const a = await listProjects(db, OWNER_A);
  const b = await listProjects(db, OWNER_B);
  assert.ok(a.length > 0);
  assert.ok(b.length > 0);
  assert.ok(a.every((p) => p.tenant_id === "a"));
  assert.ok(b.every((p) => p.tenant_id === "b"));
});

test("a tenant cannot read another tenant's row even by primary key", async () => {
  const rows = await withSession(db, OWNER_A, async (tx) => {
    const res = await tx.query("SELECT id FROM projects WHERE id = 'p-b-1'");
    return res.rows;
  });
  assert.deepEqual(rows, []);
});

test("a tenant cannot delete another tenant's project", async () => {
  await assert.rejects(() => deleteProject(db, OWNER_A, "p-b-1"));
  const stillThere = await listProjects(db, OWNER_B);
  assert.ok(stillThere.some((p) => p.id === "p-b-1"));
});

test("a tenant cannot update another tenant's project", async () => {
  const updated = await withSession(db, OWNER_A, async (tx) => {
    const res = await tx.query("UPDATE projects SET name = 'hijacked' WHERE id = 'p-b-1' RETURNING id");
    return res.rows;
  });
  assert.deepEqual(updated, []);
});

test("inserting a row for another tenant is rejected by the database", async () => {
  await assert.rejects(() =>
    withSession(db, OWNER_A, async (tx) => {
      await tx.query("INSERT INTO projects (id, tenant_id, name) VALUES ('evil', 'b', 'evil')");
    }),
  );
});

test("a created project always belongs to the session's tenant", async () => {
  const project = await createProject(db, OWNER_A, "New launch");
  assert.equal(project.tenant_id, "a");
  const b = await listProjects(db, OWNER_B);
  assert.ok(!b.some((p) => p.id === project.id));
});

test("tenant members are not visible across tenants", async () => {
  const rows = await withSession(db, OWNER_A, async (tx) => {
    const res = await tx.query("SELECT email FROM members");
    return res.rows;
  });
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => r.email.endsWith("@acme.test")));
});
