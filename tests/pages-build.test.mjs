import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const outputRoot = new URL("../gh-pages-dist/", import.meta.url);
const html = await readFile(new URL("index.html", outputRoot), "utf8");
const manifest = JSON.parse(await readFile(new URL("manifest-github.webmanifest", outputRoot), "utf8"));
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const expectedBase = process.env.GITHUB_ACTIONS === "true" && repositoryName ? `/${repositoryName}/` : "/";

test("le build GitHub Pages publie un manifeste de lancement cohérent", async () => {
  assert.equal(manifest.id, expectedBase);
  assert.equal(manifest.start_url, `${expectedBase}?source=installed-app`);
  assert.equal(manifest.scope, expectedBase);
  assert.match(html, new RegExp(`href="${expectedBase.replaceAll("/", "\\/")}manifest-github\\.webmanifest"`));
  await access(new URL("sw.js", outputRoot));
  await access(new URL("icons/icon-192.png", outputRoot));
  await access(new URL("icons/icon-512.png", outputRoot));
  await access(new URL("icons/icon-maskable-512.png", outputRoot));
});
