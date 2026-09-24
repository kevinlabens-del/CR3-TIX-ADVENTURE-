import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const outputRoot = new URL("../gh-pages-dist/", import.meta.url);
const html = await readFile(new URL("index.html", outputRoot), "utf8");
const manifest = JSON.parse(await readFile(new URL("manifest-github.webmanifest", outputRoot), "utf8"));
const launcher = await readFile(new URL("launch.html", outputRoot), "utf8");
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const expectedBase = process.env.GITHUB_ACTIONS === "true" && repositoryName ? `/${repositoryName}/` : "/";

test("le build GitHub Pages publie un manifeste de lancement cohérent", async () => {
  assert.equal(manifest.id, expectedBase);
  assert.equal(manifest.start_url, `${expectedBase}launch.html`);
  assert.equal(manifest.scope, expectedBase);
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.orientation, "any");
  assert.deepEqual(manifest.launch_handler, { client_mode: "navigate-new" });
  assert.match(html, new RegExp(`href="${expectedBase.replaceAll("/", "\\/")}manifest-github\\.webmanifest"`));
  assert.match(launcher, /window\.location\.replace\(gameUrl\.href\)/);
  await access(new URL("launch.html", outputRoot));
  await access(new URL("sw.js", outputRoot));
  await access(new URL("icons/icon-192.png", outputRoot));
  await access(new URL("icons/icon-512.png", outputRoot));
  await access(new URL("icons/icon-maskable-512.png", outputRoot));
});


test("les aperçus sociaux du build Pages sont complets", () => {
  assert.match(html, /property="og:url" content="https:\/\/kevinlabens-del\.github\.io\/CR3-TIX-ADVENTURE-\/" \/>/);
  assert.match(html, /property="og:image" content="https:\/\/kevinlabens-del\.github\.io\/CR3-TIX-ADVENTURE-\/og\.png" \/>/);
  assert.match(html, /name="twitter:card" content="summary_large_image" \/>/);
  assert.match(html, /name="twitter:title" content="CR3@TIX ADVENTURE" \/>/);
  assert.match(html, /name="twitter:description"/);
  assert.match(html, /name="twitter:image" content="https:\/\/kevinlabens-del\.github\.io\/CR3-TIX-ADVENTURE-\/og\.png" \/>/);
});
