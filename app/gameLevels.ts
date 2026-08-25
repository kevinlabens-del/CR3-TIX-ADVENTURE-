export type Platform = { x: number; y: number; w: number; h: number };

export type EnemyKind = "crawler" | "hopper" | "flyer" | "charger" | "tank" | "boss";
export type MissionType = "collect" | "hunt" | "sprint" | "beacons" | "assault" | "survive" | "escape" | "keys" | "escort" | "puzzle" | "defend" | "stealth" | "chase" | "waves" | "boss";
export type DecorKind = "embers" | "mist" | "stars" | "rain" | "dust" | "snow" | "sparks" | "void" | "storm" | "ash";
export type HazardKind = "spikes" | "lava" | "laser";

export type EnemySpawn = {
  x: number;
  y: number;
  minX: number;
  maxX: number;
  speed: number;
  kind: EnemyKind;
  hp?: number;
  name?: string;
};

export type MissionDefinition = {
  type: MissionType;
  label: string;
  description: string;
  target: number;
  secondaryTarget?: number;
  timeLimit?: number;
};

export type MovingPlatformDefinition = Platform & { axis: "x" | "y"; range: number; speed: number; phase: number };
export type HazardDefinition = { x: number; y: number; w: number; h: number; kind: HazardKind; period: number; phase: number };
export type BreakableDefinition = { x: number; y: number; w: number; h: number; hp: number; secret: boolean };

export type LevelDefinition = {
  id: number;
  chapter: number;
  stage: number;
  isBoss: boolean;
  name: string;
  code: string;
  description: string;
  worldWidth: number;
  goalX: number;
  checkpoints: number[];
  platforms: Platform[];
  movingPlatforms: MovingPlatformDefinition[];
  hazards: HazardDefinition[];
  breakables: BreakableDefinition[];
  keys: number[][];
  switches: number[][];
  orbs: number[][];
  enemies: EnemySpawn[];
  mission: MissionDefinition;
  bossName?: string;
  decor: DecorKind;
  decorSeed: number;
  filter: string;
  tint: string;
  surface: string;
  deep: string;
  edge: string;
};

type Theme = {
  name: string;
  code: string;
  hue: number;
  decor: DecorKind;
  surface: string;
  deep: string;
  edge: string;
};

const THEMES: Theme[] = [
  { name: "Ruines de NEXUS", code: "NEXUS", hue: 0, decor: "stars", surface: "#1b3b4e", deep: "#07121f", edge: "#2af5e8" },
  { name: "Forges Obscures", code: "FORGE", hue: 105, decor: "embers", surface: "#51253c", deep: "#1d0917", edge: "#ff6c92" },
  { name: "Sanctuaire Lunaire", code: "LUNA", hue: -32, decor: "mist", surface: "#31265b", deep: "#0c0925", edge: "#a981ff" },
  { name: "Jungle Bioluminescente", code: "SYLVA", hue: 68, decor: "rain", surface: "#174c43", deep: "#061c18", edge: "#6cff9f" },
  { name: "Cité Cryogénique", code: "CRYO", hue: 182, decor: "snow", surface: "#244c68", deep: "#071927", edge: "#8deaff" },
  { name: "Désert Solaire", code: "SOLAR", hue: 132, decor: "dust", surface: "#6a4323", deep: "#241205", edge: "#ffd36b" },
  { name: "Abysses Néon", code: "ABYSS", hue: 225, decor: "sparks", surface: "#173c62", deep: "#050d25", edge: "#43b7ff" },
  { name: "Archives Fantômes", code: "ECHO", hue: 285, decor: "void", surface: "#463158", deep: "#16091e", edge: "#df8cff" },
  { name: "Tempête Quantique", code: "STORM", hue: 318, decor: "storm", surface: "#3f2d5f", deep: "#120923", edge: "#c57aff" },
  { name: "Citadelle du Néant", code: "VOID", hue: 345, decor: "ash", surface: "#492738", deep: "#18070f", edge: "#ff567f" },
];

const BOSS_NAMES = ["KRYON PRIME", "VULKAR", "SELENE-X", "MYCORA", "GLACIUS", "HELIOX", "ABYSSUS", "ARCHIVOR", "TEMPESTOR", "NOX IMPERATOR"];
const MISSION_ORDER: MissionType[] = ["escape", "keys", "hunt", "escort", "puzzle", "defend", "stealth", "chase", "waves", "assault"];
const ENEMY_ORDER: EnemyKind[] = ["crawler", "hopper", "flyer", "charger", "tank"];
const GROUND = 620;

function seeded(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function makeMission(type: MissionType, chapter: number, stage: number, orbCount: number, enemyCount: number, beaconCount: number, worldWidth: number, keyCount = 0, switchCount = 0, bossName?: string): MissionDefinition {
  if (type === "collect") {
    const target = Math.min(orbCount, 12 + chapter + (stage % 4));
    return { type, label: "FRAGMENTS", target, description: `Récupère ${target} fragments d’énergie puis atteins le portail.` };
  }
  if (type === "hunt") {
    const target = Math.min(enemyCount, 7 + Math.floor(chapter * .75) + (stage % 3));
    return { type, label: "ENNEMIS", target, description: `Neutralise ${target} ennemis puis rejoins le portail.` };
  }
  if (type === "sprint") {
    const timeLimit = Math.round(worldWidth / 155 + 22 + chapter);
    return { type, label: "CHRONO", target: timeLimit, timeLimit, description: `Atteins le portail en moins de ${timeLimit} secondes.` };
  }
  if (type === "beacons") {
    return { type, label: "BALISES", target: beaconCount, description: `Active les ${beaconCount} balises de contrôle avant le portail.` };
  }
  if (type === "assault") {
    const target = Math.min(orbCount, 9 + Math.floor(chapter * .8));
    const secondaryTarget = Math.min(enemyCount, 4 + Math.floor(chapter * .65));
    return { type, label: "ASSAUT", target, secondaryTarget, description: `Collecte ${target} fragments et élimine ${secondaryTarget} ennemis.` };
  }
  if (type === "survive") {
    const timeLimit = 38 + chapter * 3 + (stage % 3) * 4;
    return { type, label: "SURVIE", target: timeLimit, timeLimit, description: `Résiste pendant ${timeLimit} secondes puis gagne le portail.` };
  }
  if (type === "escape") {
    const timeLimit = Math.round(worldWidth / 150 + 28 + chapter);
    return { type, label: "ÉVASION", target: timeLimit, timeLimit, description: `Échappe à l’effondrement et atteins le portail en moins de ${timeLimit} secondes.` };
  }
  if (type === "keys") return { type, label: "CLÉS", target: keyCount, description: `Trouve les ${keyCount} clés quantiques cachées puis ouvre le portail.` };
  if (type === "escort") return { type, label: "ESCORTE", target: 100, description: "Protège le drone allié et conduis-le jusqu’à la zone d’extraction." };
  if (type === "puzzle") return { type, label: "MÉCANISMES", target: switchCount, description: `Active les ${switchCount} mécanismes dans le bon ordre avec ton attaque.` };
  if (type === "defend") {
    const timeLimit = 34 + chapter * 3;
    return { type, label: "DÉFENSE", target: timeLimit, timeLimit, description: `Tiens la zone de défense pendant ${timeLimit} secondes.` };
  }
  if (type === "stealth") return { type, label: "FURTIVITÉ", target: 3, description: "Traverse le secteur sans déclencher trois alertes ennemies." };
  if (type === "chase") return { type, label: "POURSUITE", target: 1, description: "Rattrape le drone voleur avant qu’il ne franchisse le portail." };
  if (type === "waves") {
    const target = Math.min(enemyCount, 9 + chapter);
    return { type, label: "VAGUES", target, description: `Repousse ${target} ennemis dans l’arène de combat.` };
  }
  return { type: "boss", label: "BOSS", target: 1, description: `Vaincs ${bossName ?? "le gardien"} pour libérer le monde.` };
}

function createNormalLevel(chapter: number, stage: number, theme: Theme): LevelDefinition {
  const id = chapter * 11 + stage + 1;
  const seed = 9109 + id * 7919;
  const random = seeded(seed);
  const chunks = 12 + Math.floor(chapter * .65) + (stage % 4);
  const chunkWidth = 760;
  const worldWidth = (chunks + 1) * chunkWidth;
  const platforms: Platform[] = [];
  const floating: Platform[] = [];
  const groundRanges: Array<{ start: number; end: number }> = [];

  for (let chunk = 0; chunk <= chunks; chunk++) {
    const start = chunk * chunkWidth;
    const finalChunk = chunk === chunks;
    const gap = finalChunk ? 0 : 82 + Math.floor(random() * (72 + chapter * 5));
    const width = finalChunk ? chunkWidth : chunkWidth - gap;
    platforms.push({ x: start, y: GROUND, w: width, h: 140 });
    groundRanges.push({ start, end: start + width });

    if (!finalChunk) {
      const firstY = [500, 460, 420, 380][(chunk + stage + chapter) % 4];
      const first = { x: start + 230 + Math.floor(random() * 90), y: firstY, w: 175 + Math.floor(random() * 80), h: 28 };
      floating.push(first);
      if ((chunk + stage) % 2 === 0) floating.push({ x: start + 470, y: Math.max(285, firstY - 105), w: 150 + Math.floor(random() * 65), h: 28 });
    }
  }
  platforms.push(...floating);

  const movingPlatforms: MovingPlatformDefinition[] = [];
  for (let chunk = 2; chunk < chunks; chunk += 4) {
    movingPlatforms.push({
      x: chunk * chunkWidth + 420,
      y: 330 + ((chunk + stage) % 3) * 55,
      w: 180,
      h: 24,
      axis: (chunk + stage) % 2 ? "x" : "y",
      range: 90 + (chapter % 3) * 25,
      speed: .75 + chapter * .035 + (stage % 3) * .08,
      phase: chunk * .7,
    });
  }

  const hazards: HazardDefinition[] = [];
  for (let chunk = 1; chunk < chunks; chunk += 3) {
    const kind: HazardKind = ["spikes", "laser", "lava"][(chunk + stage + chapter) % 3] as HazardKind;
    const x = chunk * chunkWidth + 520;
    hazards.push({ x, y: kind === "laser" ? 330 : kind === "lava" ? 602 : 590, w: kind === "laser" ? 18 : 92, h: kind === "laser" ? 290 : kind === "lava" ? 18 : 30, kind, period: 2.4 + ((chunk + stage) % 3) * .45, phase: chunk * .83 });
  }

  const orbs: number[][] = [];
  for (let chunk = 0; chunk <= chunks; chunk++) {
    const range = groundRanges[chunk];
    orbs.push([Math.min(range.end - 80, range.start + 150 + Math.floor(random() * 280)), 550]);
  }
  floating.forEach((platform, index) => {
    orbs.push([platform.x + platform.w / 2, platform.y - 55 - (index % 2) * 8]);
  });

  const itemPlatforms = [...floating].sort((a, b) => a.x - b.x);
  const keys = [
    itemPlatforms[Math.floor(itemPlatforms.length * .2)],
    itemPlatforms[Math.floor(itemPlatforms.length * .5)],
    itemPlatforms[Math.floor(itemPlatforms.length * .8)],
  ].filter(Boolean).map((platform, index) => [platform.x + platform.w / 2, platform.y - 66 - index * 5]);
  const switches = [
    [Math.floor(worldWidth * .25), 535],
    [Math.floor(worldWidth * .5), 535],
    [Math.floor(worldWidth * .75), 535],
  ];
  const breakables: BreakableDefinition[] = Array.from({ length: 2 }, (_, index) => ({
    x: Math.floor(worldWidth * (.38 + index * .29)), y: 500, w: 54, h: 120, hp: 3 + Math.floor(chapter / 3), secret: index === 1,
  }));

  const availableKinds = ENEMY_ORDER.slice(0, Math.min(ENEMY_ORDER.length, 2 + Math.floor(chapter / 2)));
  const enemies: EnemySpawn[] = [];
  for (let chunk = 1; chunk <= chunks; chunk++) {
    const range = groundRanges[chunk];
    const kind = availableKinds[(chunk + stage + chapter) % availableKinds.length];
    const enemyY = kind === "flyer" ? 365 : kind === "tank" ? 548 : 560;
    enemies.push({ x: range.start + 125, y: enemyY, minX: range.start + 40, maxX: Math.max(range.start + 230, range.end - 25), speed: 74 + chapter * 8 + stage * 3, kind, hp: kind === "tank" ? 2 : 1 });
    if (chapter > 4 && chunk % 3 === 0) {
      const secondKind = availableKinds[(chunk + stage + 2) % availableKinds.length];
      enemies.push({ x: range.start + 340, y: secondKind === "flyer" ? 320 : 560, minX: range.start + 250, maxX: range.end - 20, speed: 88 + chapter * 7, kind: secondKind, hp: secondKind === "tank" ? 2 : 1 });
    }
  }

  const checkpoints = [.2, .4, .6, .8].map(progress => Math.floor(chunks * progress) * chunkWidth + 80);
  const missionType = MISSION_ORDER[stage];
  const mission = makeMission(missionType, chapter, stage, orbs.length, enemies.length, checkpoints.length, worldWidth, keys.length, switches.length);
  const hue = theme.hue + (stage - 4) * 5;
  const brightness = (0.76 + ((stage + chapter) % 5) * 0.045).toFixed(2);

  return {
    id,
    chapter,
    stage,
    isBoss: false,
    name: `${theme.name} · Secteur ${stage + 1}`,
    code: `${theme.code}-${String(stage + 1).padStart(2, "0")}`,
    description: mission.description,
    worldWidth,
    goalX: worldWidth - 350,
    checkpoints,
    platforms,
    movingPlatforms,
    hazards,
    breakables,
    keys,
    switches,
    orbs,
    enemies,
    mission,
    decor: theme.decor,
    decorSeed: seed,
    filter: `hue-rotate(${hue}deg) saturate(${(1.02 + stage * 0.035).toFixed(2)}) brightness(${brightness})`,
    tint: `hsla(${(theme.hue + 360) % 360}, 72%, ${18 + (stage % 4) * 5}%, ${0.12 + (stage % 3) * 0.035})`,
    surface: theme.surface,
    deep: theme.deep,
    edge: theme.edge,
  };
}

function createBossLevel(chapter: number, theme: Theme): LevelDefinition {
  const id = chapter * 11 + 11;
  const bossName = BOSS_NAMES[chapter];
  const worldWidth = 5600 + chapter * 180;
  const arenaStart = worldWidth - 1850;
  const hp = 30 + chapter * 8;
  const platforms: Platform[] = [
    { x: 0, y: GROUND, w: worldWidth, h: 140 },
    { x: 620, y: 465, w: 250, h: 28 },
    { x: 1320, y: 350, w: 270, h: 28 },
    { x: 2260, y: 430, w: 260, h: 28 },
    { x: arenaStart + 160, y: 420, w: 280, h: 28 },
    { x: worldWidth - 1040, y: 325, w: 250, h: 28 },
  ];
  const orbs = [[720, 410], [1450, 295], [2380, 375], [arenaStart + 300, 365], [worldWidth - 910, 270]];
  const firstGuard = ENEMY_ORDER[Math.min(ENEMY_ORDER.length - 1, Math.floor(chapter / 2))];
  const secondGuard = ENEMY_ORDER[Math.min(ENEMY_ORDER.length - 1, 1 + Math.floor(chapter / 2))];
  const finalGuard = chapter >= 5 ? "tank" : chapter >= 2 ? "charger" : "hopper";
  const enemies: EnemySpawn[] = [
    { x: 1050, y: firstGuard === "flyer" ? 350 : firstGuard === "tank" ? 548 : 560, minX: 820, maxX: 1540, speed: 98 + chapter * 7, kind: firstGuard, hp: firstGuard === "tank" ? 3 : 2 },
    { x: 2420, y: secondGuard === "flyer" ? 330 : secondGuard === "tank" ? 548 : 560, minX: 2050, maxX: 2860, speed: 108 + chapter * 8, kind: secondGuard, hp: secondGuard === "tank" ? 3 : 2 },
    { x: arenaStart - 260, y: finalGuard === "tank" ? 548 : 560, minX: arenaStart - 620, maxX: arenaStart + 80, speed: 118 + chapter * 8, kind: finalGuard, hp: finalGuard === "tank" ? 3 : 2 },
    { x: worldWidth - 880, y: 480, minX: arenaStart, maxX: worldWidth - 260, speed: 132 + chapter * 9, kind: "boss", hp, name: bossName },
  ];
  const bossHazardKind: HazardKind = ["spikes", "lava", "laser"][chapter % 3] as HazardKind;
  const hazards: HazardDefinition[] = [
    { x: arenaStart + 480, y: bossHazardKind === "laser" ? 330 : bossHazardKind === "lava" ? 602 : 590, w: bossHazardKind === "laser" ? 18 : 100, h: bossHazardKind === "laser" ? 290 : bossHazardKind === "lava" ? 18 : 30, kind: bossHazardKind, period: 2.25, phase: chapter * .7 },
  ];
  const mission = makeMission("boss", chapter, 10, orbs.length, enemies.length, 1, worldWidth, 0, 0, bossName);

  return {
    id,
    chapter,
    stage: 10,
    isBoss: true,
    name: `Arène de ${bossName}`,
    code: `${theme.code}-BOSS`,
    description: mission.description,
    worldWidth,
    goalX: worldWidth - 190,
    checkpoints: [1050, Math.floor(worldWidth * .5), arenaStart - 320],
    platforms,
    movingPlatforms: [],
    hazards,
    breakables: [],
    keys: [],
    switches: [],
    orbs,
    enemies,
    mission,
    bossName,
    decor: theme.decor,
    decorSeed: 77041 + chapter * 11939,
    filter: `hue-rotate(${theme.hue + 18}deg) saturate(1.48) brightness(.62) contrast(1.12)`,
    tint: `hsla(${(theme.hue + 350) % 360}, 88%, 16%, .34)`,
    surface: theme.surface,
    deep: theme.deep,
    edge: theme.edge,
  };
}

const GENERATED_LEVELS: LevelDefinition[] = THEMES.flatMap((theme, chapter) => [
  ...Array.from({ length: 10 }, (_, stage) => createNormalLevel(chapter, stage, theme)),
  createBossLevel(chapter, theme),
]);

function validateCampaign(levels: LevelDefinition[]) {
  if (levels.length !== 110) throw new Error(`Campagne invalide : ${levels.length} niveaux au lieu de 110.`);

  const ids = new Set(levels.map(level => level.id));
  if (ids.size !== levels.length) throw new Error("Campagne invalide : des identifiants de niveau sont dupliqués.");

  THEMES.forEach((_, chapter) => {
    const chapterStart = chapter * 11;
    const normalLevels = levels.slice(chapterStart, chapterStart + 10);
    const bossLevel = levels[chapterStart + 10];

    if (normalLevels.length !== 10 || normalLevels.some(level => level.isBoss || level.chapter !== chapter)) {
      throw new Error(`Monde ${chapter + 1} invalide : il doit contenir exactement 10 missions normales.`);
    }
    if (!bossLevel?.isBoss || bossLevel.chapter !== chapter || bossLevel.mission.type !== "boss") {
      throw new Error(`Monde ${chapter + 1} invalide : le niveau spécial avec boss est absent.`);
    }
    if (new Set(normalLevels.map(level => level.mission.type)).size !== 10) {
      throw new Error(`Monde ${chapter + 1} invalide : les 10 missions doivent être différentes.`);
    }
  });
}

validateCampaign(GENERATED_LEVELS);

export const LEVELS = GENERATED_LEVELS;
