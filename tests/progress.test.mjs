import assert from "node:assert/strict";
import test from "node:test";
import { calculateStars, loadProgress, saveLevelResult, totalStars } from "../app/gameProgress.ts";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("le calcul de maîtrise attribue de une à trois étoiles", () => {
  assert.equal(calculateStars(1, 90, 60), 1);
  assert.equal(calculateStars(2, 90, 60), 2);
  assert.equal(calculateStars(3, 55, 60), 3);
});

test("une nouvelle victoire conserve les meilleurs résultats", () => {
  const storage = memoryStorage();
  saveLevelResult(4, 1200, 80, 1, 60, storage);
  const records = saveLevelResult(4, 980, 50, 3, 60, storage);
  assert.deepEqual(records["4"], { wins: 2, bestScore: 1200, bestTime: 50, stars: 3 });
  assert.equal(totalStars(loadProgress(storage)), 3);
});

test("une sauvegarde corrompue est ignorée sans bloquer le jeu", () => {
  assert.deepEqual(loadProgress(memoryStorage({ "cr3atix-progress-v16": "{" })), {});
});

