import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { startServer } from "../server.js";

const OWNER_A = { Authorization: "Bearer token-a-owner" };
const STAFF_A = { Authorization: "Bearer token-a-staff" };
const OWNER_B = { Authorization: "Bearer token-b-owner" };

let server;
let baseUrl;

before(async () => {
  server = await startServer(0);
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  server.close();
  await server.database.close();
});

test("homepage renders the app shell", async () => {
  const res = await fetch(baseUrl);
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.match(html, /Ledgerly/);
  assert.match(html, /<ul id="project-list"/);
});

test("the projects API requires authentication", async () => {
  const res = await fetch(`${baseUrl}/api/projects`);
  assert.equal(res.status, 401);
});

test("the projects API returns only the caller's tenant", async () => {
  const res = await fetch(`${baseUrl}/api/projects`, { headers: OWNER_A });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.ok(body.projects.length > 0);
  assert.ok(body.projects.every((p) => p.tenant_id === "a"));
  assert.match(body.summary, /active/);
});

test("the API is localized", async () => {
  const res = await fetch(`${baseUrl}/api/projects?lang=fr`, { headers: OWNER_B });
  const body = await res.json();
  assert.match(body.summary, /actifs/);
  assert.equal(body.labels["projects.heading"], "Projets");
});

test("a project can be created and is scoped to the caller", async () => {
  const res = await fetch(`${baseUrl}/api/projects`, {
    method: "POST",
    headers: { ...OWNER_A, "content-type": "application/json" },
    body: JSON.stringify({ name: "From API", tenant_id: "b" }),
  });
  const body = await res.json();
  assert.equal(res.status, 201);
  assert.equal(body.project.tenant_id, "a", "a client-supplied tenant_id must be ignored");
});

test("staff cannot delete and cross-tenant deletes fail", async () => {
  const created = await (
    await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: { ...OWNER_A, "content-type": "application/json" },
      body: JSON.stringify({ name: "Doomed" }),
    })
  ).json();

  const staffAttempt = await fetch(`${baseUrl}/api/projects/${created.project.id}`, {
    method: "DELETE",
    headers: STAFF_A,
  });
  assert.equal(staffAttempt.status, 403);

  const crossTenant = await fetch(`${baseUrl}/api/projects/${created.project.id}`, {
    method: "DELETE",
    headers: OWNER_B,
  });
  assert.equal(crossTenant.status, 404);

  const ownerAttempt = await fetch(`${baseUrl}/api/projects/${created.project.id}`, {
    method: "DELETE",
    headers: OWNER_A,
  });
  assert.equal(ownerAttempt.status, 200);
});

test("archive and unarchive routes update a project", async () => {
  const created = await (
    await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: { ...STAFF_A, "content-type": "application/json" },
      body: JSON.stringify({ name: "Archive from API" }),
    })
  ).json();

  const archiveRes = await fetch(`${baseUrl}/api/projects/${created.project.id}/archive`, {
    method: "POST",
    headers: STAFF_A,
  });
  const archived = await archiveRes.json();
  assert.equal(archiveRes.status, 200);
  assert.equal(archived.project.archived, true);

  const unarchiveRes = await fetch(`${baseUrl}/api/projects/${created.project.id}/unarchive`, {
    method: "POST",
    headers: STAFF_A,
  });
  const unarchived = await unarchiveRes.json();
  assert.equal(unarchiveRes.status, 200);
  assert.equal(unarchived.project.archived, false);
});

test("archive routes preserve tenant isolation and return 404 for missing projects", async () => {
  const created = await (
    await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: { ...OWNER_A, "content-type": "application/json" },
      body: JSON.stringify({ name: "No cross-tenant archive" }),
    })
  ).json();

  const crossTenant = await fetch(`${baseUrl}/api/projects/${created.project.id}/archive`, {
    method: "POST",
    headers: OWNER_B,
  });
  assert.equal(crossTenant.status, 404);

  const missing = await fetch(`${baseUrl}/api/projects/missing/unarchive`, {
    method: "POST",
    headers: OWNER_A,
  });
  assert.equal(missing.status, 404);
});

test("unknown API routes return 404", async () => {
  const res = await fetch(`${baseUrl}/api/nope`, { headers: OWNER_A });
  assert.equal(res.status, 404);
});
