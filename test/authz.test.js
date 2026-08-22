import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { createDatabase, withSession } from "../src/db.js";
import {
  archiveProject,
  createProject,
  deleteProject,
  unarchiveProject,
} from "../src/projects.js";
import { isOwner, sessionFromRequest } from "../src/auth.js";

const OWNER_A = { tenantId: "a", role: "owner" };
const STAFF_A = { tenantId: "a", role: "staff" };
const OWNER_B = { tenantId: "b", role: "owner" };

let db;

before(async () => {
  db = await createDatabase();
});

after(async () => {
  await db.close();
});

test("tokens resolve to a tenant and a role", () => {
  const session = sessionFromRequest({ headers: { authorization: "Bearer token-a-staff" } });
  assert.deepEqual(session, { tenantId: "a", role: "staff" });
  assert.equal(isOwner(session), false);
  assert.equal(isOwner({ tenantId: "a", role: "owner" }), true);
});

test("malformed or missing tokens resolve to no session", () => {
  assert.equal(sessionFromRequest({ headers: {} }), null);
  assert.equal(sessionFromRequest({ headers: { authorization: "Bearer token-a" } }), null);
  assert.equal(sessionFromRequest({ headers: { authorization: "Bearer token-a-admin" } }), null);
});

test("staff can create a project", async () => {
  const project = await createProject(db, STAFF_A, "Staff idea");
  assert.equal(project.tenant_id, "a");
});

test("staff cannot delete a project", async () => {
  const project = await createProject(db, OWNER_A, "Owner only");
  await assert.rejects(() => deleteProject(db, STAFF_A, project.id), /forbidden|Only an owner/i);
});

test("the database refuses a staff delete even if the app check is bypassed", async () => {
  const project = await createProject(db, OWNER_A, "Direct delete attempt");
  const deleted = await withSession(db, STAFF_A, async (tx) => {
    const res = await tx.query("DELETE FROM projects WHERE id = $1 RETURNING id", [project.id]);
    return res.rows;
  });
  assert.deepEqual(deleted, []);
});

test("an owner can delete their own project", async () => {
  const project = await createProject(db, OWNER_A, "Temporary");
  const result = await deleteProject(db, OWNER_A, project.id);
  assert.equal(result.id, project.id);
});

test("a project can be archived and unarchived", async () => {
  const project = await createProject(db, STAFF_A, "Archive cycle");
  const archived = await archiveProject(db, STAFF_A, project.id);
  assert.equal(archived.archived, true);

  const unarchived = await unarchiveProject(db, STAFF_A, project.id);
  assert.equal(unarchived.archived, false);
});

test("archive operations cannot access another tenant's project", async () => {
  const project = await createProject(db, OWNER_A, "Tenant A only");
  await assert.rejects(
    () => archiveProject(db, OWNER_B, project.id),
    (error) => error.status === 404,
  );
  await assert.rejects(
    () => unarchiveProject(db, OWNER_B, project.id),
    (error) => error.status === 404,
  );
});
