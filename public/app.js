/**
 * Browser shell. Uses a demo token so the homepage is visibly populated.
 * The token still resolves tenancy on the server -- the client cannot pick
 * a tenant by itself.
 */

const DEMO_TOKEN = "token-a-owner";

async function load() {
  const params = new URLSearchParams(window.location.search);
  const lang = params.get("lang") ?? "en";
  const res = await fetch(`/api/projects?lang=${encodeURIComponent(lang)}`, {
    headers: { Authorization: `Bearer ${DEMO_TOKEN}` },
  });
  if (!res.ok) return;
  const body = await res.json();

  document.getElementById("app-title").textContent = body.labels["app.title"];
  document.getElementById("app-tagline").textContent = body.labels["app.tagline"];
  document.getElementById("projects-heading").textContent = body.labels["projects.heading"];
  document.getElementById("summary").textContent = body.summary;

  const list = document.getElementById("project-list");
  list.innerHTML = "";
  for (const project of body.projects) {
    const li = document.createElement("li");
    li.textContent = project.name;
    if (project.archived) li.className = "archived";
    list.appendChild(li);
  }
}

load();
