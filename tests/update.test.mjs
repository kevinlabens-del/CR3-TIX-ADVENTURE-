import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const serviceWorker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
const gameClient = await readFile(new URL("../app/AdventureGame.tsx", import.meta.url), "utf8");

test("le service worker V19 active immédiatement la nouvelle version", () => {
  assert.match(serviceWorker, /APP_VERSION = "19\.0\.0"/);
  assert.match(serviceWorker, /CACHE_NAME = "cr3atix-adventure-v19"/);
  assert.match(serviceWorker, /"launch\.html"/);
  assert.match(serviceWorker, /self\.skipWaiting\(\)/);
  assert.match(serviceWorker, /self\.clients\.claim\(\)/);
  assert.match(serviceWorker, /CR3ATIX_SKIP_WAITING/);
  assert.match(serviceWorker, /CR3ATIX_UPDATE_ACTIVE/);
});

test("le client recherche les mises à jour pendant tout le cycle de vie mobile", () => {
  assert.match(gameClient, /updateViaCache: "none"/);
  assert.match(gameClient, /registration\.update\(\)/);
  assert.match(gameClient, /addEventListener\("updatefound"/);
  assert.match(gameClient, /addEventListener\("controllerchange"/);
  assert.match(gameClient, /addEventListener\("visibilitychange", onPageVisible\)/);
  assert.match(gameClient, /addEventListener\("online", onOnline\)/);
  assert.match(gameClient, /setInterval\(\(\) => void checkRegistration\(\), UPDATE_INTERVAL_MS\)/);
});

test("une mise à jour recharge l’application une seule fois", () => {
  assert.match(gameClient, /if \(reloadStarted\) return/);
  assert.match(gameClient, /reloadStarted = true/);
  assert.match(gameClient, /window\.location\.reload\(\)/);
});
