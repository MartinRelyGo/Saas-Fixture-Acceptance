/**
 * Tiny HTTP server for the Ledgerly fixture. No framework: the goal is a
 * small, readable surface that an AI coding agent can safely modify.
 */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sessionFromRequest } from "./src/auth.js";
import { createDatabase } from "./src/db.js";
import { LOCALES, resolveLocale, t } from "./src/i18n/index.js";
import { AppError, createProject, deleteProject, listProjects, summarize } from "./src/projects.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(HERE, "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(payload);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

async function serveStatic(res, filePath) {
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { "content-type": MIME[path.extname(filePath)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

export async function startServer(port = 3000, db) {
  const database = db ?? (await createDatabase());

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const locale = resolveLocale(url.searchParams.get("lang"));

    try {
      if (url.pathname.startsWith("/api/")) {
        const session = sessionFromRequest(req);
        if (!session) {
          return json(res, 401, { error: t(locale, "error.unauthorized") });
        }

        if (url.pathname === "/api/projects" && req.method === "GET") {
          const requestedArchived = url.searchParams.get("archived");
          const archived = ["all", "active", "archived"].includes(requestedArchived)
            ? requestedArchived
            : "all";
          const projects = await listProjects(database, { ...session, archived });
          return json(res, 200, {
            projects,
            summary: summarize(projects, locale),
            labels: LOCALES[locale],
            role: session.role,
          });
        }

        if (url.pathname === "/api/projects" && req.method === "POST") {
          const body = await readBody(req);
          const project = await createProject(database, session, body.name);
          return json(res, 201, { project });
        }

        const deleteMatch = /^\/api\/projects\/([^/]+)$/.exec(url.pathname);
        if (deleteMatch && req.method === "DELETE") {
          const result = await deleteProject(database, session, deleteMatch[1]);
          return json(res, 200, result);
        }

        return json(res, 404, { error: t(locale, "error.notFound") });
      }

      if (url.pathname === "/") return serveStatic(res, path.join(PUBLIC_DIR, "index.html"));

      const safe = path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, "");
      const target = path.join(PUBLIC_DIR, safe);
      if (!target.startsWith(PUBLIC_DIR)) {
        res.writeHead(404).end("Not found");
        return;
      }
      return serveStatic(res, target);
    } catch (error) {
      if (error instanceof AppError) {
        return json(res, error.status, { error: t(locale, error.key) });
      }
      return json(res, 500, { error: "Something went wrong" });
    }
  });

  server.database = database;
  await new Promise((resolve) => server.listen(port, resolve));
  return server;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 3000);
  startServer(port).then(() => console.log(`Ledgerly listening on http://localhost:${port}`));
}
