import assert from "node:assert/strict";
import { test } from "node:test";

import { LOCALES, t } from "../src/i18n/index.js";
import { summarize } from "../src/projects.js";

test("every locale defines exactly the same keys", () => {
  const [reference, ...others] = Object.values(LOCALES);
  const expected = Object.keys(reference).sort();
  for (const table of others) {
    assert.deepEqual(Object.keys(table).sort(), expected);
  }
});

test("no locale has an empty string", () => {
  for (const [name, table] of Object.entries(LOCALES)) {
    for (const [key, value] of Object.entries(table)) {
      assert.ok(String(value).trim().length > 0, `${name}.${key} is empty`);
    }
  }
});

test("interpolation fills placeholders", () => {
  assert.equal(t("en", "projects.active", { count: 3 }), "3 active");
  assert.equal(t("fr", "projects.active", { count: 3 }), "3 actifs");
});

test("unknown locales fall back to English", () => {
  assert.equal(t("de", "projects.heading"), "Projects");
});

test("the summary is localized", () => {
  const projects = [{ archived: false }, { archived: true }];
  assert.match(summarize(projects, "en"), /1 active/);
  assert.match(summarize(projects, "fr"), /1 actifs/);
  assert.equal(summarize([], "fr"), "Aucun projet pour le moment");
});
