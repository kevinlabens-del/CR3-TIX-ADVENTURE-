import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createGithubPwaManifest } from "../github-pages/pwaManifest.ts";

const rootManifest = JSON.parse(await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
const gameClient = await readFile(new URL("../app/AdventureGame.tsx", import.meta.url), "utf8");
const githubHtml = await readFile(new URL("../github-pages/index.html", import.meta.url), "utf8");
const launcher = await readFile(new URL("../public/launch.html", import.meta.url), "utf8");

test("le Site possède une identité stable et un document de lancement autonome", () => {
  assert.equal(rootManifest.id, "/cr3atix-adventure/");
  assert.equal(rootManifest.start_url, "/launch.html");
  assert.equal(rootManifest.scope, "/");
  assert.equal(rootManifest.display, "standalone");
  assert.equal(rootManifest.orientation, "any");
  assert.deepEqual(rootManifest.launch_handler, { client_mode: "navigate-new" });
  assert.notEqual(rootManifest.id, "./");
});

test("GitHub Pages génère une identité propre au dépôt sans collision avec les autres jeux", () => {
  const base = "/CR3-TIX-ADVENTURE-/";
  const manifest = createGithubPwaManifest(base);
  const origin = "https://kevinlabens-del.github.io";
  const startUrl = new URL(manifest.start_url, origin);
  const scopeUrl = new URL(manifest.scope, origin);
  const appId = new URL(manifest.id, origin);

  assert.equal(manifest.id, base);
  assert.equal(appId.pathname, base);
  assert.equal(startUrl.pathname, `${base}launch.html`);
  assert.ok(startUrl.href.startsWith(scopeUrl.href));
  assert.notEqual(appId.href, `${origin}/`);
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.orientation, "any");
  assert.deepEqual(manifest.launch_handler, { client_mode: "navigate-new" });
});

test("le lanceur reste relatif à son propre déploiement et possède un lien de secours", () => {
  assert.match(launcher, /new URL\("\.\/", window\.location\.href\)/);
  assert.match(launcher, /window\.location\.replace\(gameUrl\.href\)/);
  assert.match(launcher, /href="\.\/\?source=installed-app"/);
  assert.doesNotMatch(launcher, /kevinlabens-del\.github\.io|fallback-bzh\.chatgpt\.site/);
});

test("la page GitHub charge le manifeste dédié et détecte tous les modes installés", () => {
  assert.match(githubHtml, /%BASE_URL%manifest-github\.webmanifest/);
  assert.match(gameClient, /\["fullscreen", "standalone", "minimal-ui"\]/);
});
