import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { LEVELS } from "../app/gameLevels.ts";

test("la campagne contient 100 missions et 10 niveaux boss correctement placés", () => {
  assert.equal(LEVELS.length, 110);
  assert.deepEqual(LEVELS.map(level => level.id), Array.from({ length: 110 }, (_, index) => index + 1));

  for (let chapter = 0; chapter < 10; chapter++) {
    const levels = LEVELS.slice(chapter * 11, chapter * 11 + 11);
    assert.equal(levels.filter(level => !level.isBoss).length, 10);
    assert.equal(levels[10].isBoss, true);
    assert.equal(levels[10].mission.type, "boss");
    assert.equal(levels[10].bossName?.length > 0, true);
  }
});

test("les missions varient réellement entre les mondes", () => {
  const missionTypes = new Set();
  for (let chapter = 0; chapter < 10; chapter++) {
    const chapterTypes = LEVELS.slice(chapter * 11, chapter * 11 + 10).map(level => level.mission.type);
    assert.equal(new Set(chapterTypes).size, 10);
    chapterTypes.forEach(type => missionTypes.add(type));
  }
  assert.deepEqual([...missionTypes].sort(), ["assault", "beacons", "chase", "collect", "defend", "escape", "escort", "hunt", "keys", "puzzle", "sprint", "stealth", "survive", "waves"]);
});

test("les ressources et objectifs de chaque niveau restent atteignables", () => {
  for (const level of LEVELS) {
    assert.ok(level.worldWidth > level.goalX);
    assert.ok(level.platforms.length > 0);
    assert.ok(level.checkpoints.every((checkpoint, index, values) => checkpoint > 0 && checkpoint < level.goalX && (index === 0 || checkpoint > values[index - 1])));
    if (level.mission.type === "collect") assert.ok(level.mission.target <= level.orbs.length);
    if (level.mission.type === "hunt" || level.mission.type === "waves") assert.ok(level.mission.target <= level.enemies.filter(enemy => enemy.kind !== "boss").length);
    if (level.mission.type === "keys") assert.equal(level.mission.target, level.keys.length);
    if (level.mission.type === "puzzle") assert.equal(level.mission.target, level.switches.length);
  }
});

test("les neuf familles d’ennemis apparaissent et les boss deviennent plus résistants", () => {
  const kinds = new Set(LEVELS.flatMap(level => level.enemies.filter(enemy => enemy.kind !== "boss").map(enemy => enemy.kind)));
  assert.deepEqual([...kinds].sort(), ["charger", "crawler", "exploder", "flyer", "hopper", "sentinel", "shielder", "shooter", "tank"]);
  const bossHp = LEVELS.filter(level => level.isBoss).map(level => level.enemies.find(enemy => enemy.kind === "boss")?.hp ?? 0);
  assert.ok(bossHp.every((hp, index) => hp >= 48 && (index === 0 || hp > bossHp[index - 1])));
});

test("les dix décors et les dix boss ont leurs fichiers de production", async () => {
  for (let index = 1; index <= 10; index++) {
    await access(new URL(`../public/game/worlds/world-${String(index).padStart(2, "0")}.webp`, import.meta.url));
  }
  const bossFiles = ["boss-01-kryon-prime.png", "boss-02-vulkar.png", "boss-03-selene-x.png", "boss-04-mycora.png", "boss-05-glacius.png", "boss-06-heliox.png", "boss-07-abyssus.png", "boss-08-archivor.png", "boss-09-tempestor.png", "boss-10-nox-imperator.png"];
  await Promise.all(bossFiles.map(file => access(new URL(`../public/game/bosses/${file}`, import.meta.url))));
  const manifest = JSON.parse(await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
  assert.equal(manifest.orientation, "landscape");
  assert.equal(manifest.display, "fullscreen");
});
