/**
 * Domain logic for projects. Every function takes an authenticated session
 * and runs through `withSession`, so the database enforces tenancy even if a
 * query here forgot a WHERE clause.
 */

import { withSession } from "./db.js";
import { t } from "./i18n/index.js";

export class AppError extends Error {
  constructor(status, key) {
    super(key);
    this.status = status;
    this.key = key;
  }
}

export async function listProjects(db, session) {
  return withSession(db, session, async (tx) => {
    const res = await tx.query(
      "SELECT id, tenant_id, name, archived FROM projects ORDER BY archived ASC, name ASC",
    );
    return res.rows;
  });
}

export async function createProject(db, session, name) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) throw new AppError(400, "projects.empty");
  const id = `p-${session.tenantId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  return withSession(db, session, async (tx) => {
    // tenant_id comes from the session, never from the request body.
    const res = await tx.query(
      "INSERT INTO projects (id, tenant_id, name) VALUES ($1, $2, $3) RETURNING id, tenant_id, name, archived",
      [id, session.tenantId, trimmed],
    );
    return res.rows[0];
  });
}

export async function deleteProject(db, session, id) {
  if (session.role !== "owner") throw new AppError(403, "error.forbidden");
  return withSession(db, session, async (tx) => {
    const res = await tx.query("DELETE FROM projects WHERE id = $1 RETURNING id", [id]);
    if (res.rows.length === 0) throw new AppError(404, "error.notFound");
    return { id };
  });
}

export function summarize(projects, locale) {
  if (projects.length === 0) return t(locale, "projects.empty");
  const active = projects.filter((p) => !p.archived).length;
  const archived = projects.length - active;
  return `${t(locale, "projects.active", { count: active })} · ${t(locale, "projects.archived", {
    count: archived,
  })}`;
}
