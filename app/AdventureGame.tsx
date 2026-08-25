"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { LEVELS, type EnemyKind, type LevelDefinition, type Platform } from "./gameLevels";
import { loadProgress, saveLevelResult, totalStars, type ProgressRecords } from "./gameProgress";

const W = 1280;
const H = 720;
const APP_VERSION = "18.0.0";
const UPDATE_INTERVAL_MS = 10 * 60 * 1000;
const BOSS_SPRITES = [
  "game/bosses/boss-01-kryon-prime.png",
  "game/bosses/boss-02-vulkar.png",
  "game/bosses/boss-03-selene-x.png",
  "game/bosses/boss-04-mycora.png",
  "game/bosses/boss-05-glacius.png",
  "game/bosses/boss-06-heliox.png",
  "game/bosses/boss-07-abyssus.png",
  "game/bosses/boss-08-archivor.png",
  "game/bosses/boss-09-tempestor.png",
  "game/bosses/boss-10-nox-imperator.png",
];
const WORLD_BACKGROUNDS = Array.from({ length: 10 }, (_, index) => `game/worlds/world-${String(index + 1).padStart(2, "0")}.webp`);

function assetUrl(path: string) {
  if (typeof document === "undefined") return path;
  return new URL(path.replace(/^\//, ""), document.baseURI).toString();
}

type Status = "menu" | "playing" | "paused" | "chapterintro" | "bossintro" | "won" | "gameover";
type MenuTab = "play" | "gear" | "options";
type InputKey = "left" | "right" | "jump" | "dash" | "attack" | "special";
type Difficulty = "easy" | "normal" | "expert";
type Upgrades = { vitality: number; jump: number; attack: number; dash: number };
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};
type Orb = { x: number; y: number; collected: boolean; phase: number };
type Enemy = {
  x: number; y: number; baseY: number; w: number; h: number; vx: number; speed: number; minX: number; maxX: number;
  alive: boolean; phase: number; kind: EnemyKind; hp: number; maxHp: number; hitCooldown: number; attackCooldown: number; shield: number; alerted: boolean;
  telegraph: number; phaseSeen: number; bossName?: string;
};
type Particle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color: string };
type Shockwave = { x: number; y: number; vx: number; life: number; hit: boolean; color: string; hostile?: boolean };
type Projectile = { x: number; y: number; w: number; h: number; vx: number; vy: number; life: number; color: string; hostile: boolean; gravity: number };
type MovingPlatform = Platform & { originX: number; originY: number; axis: "x" | "y"; range: number; speed: number; phase: number; dx: number };
type Breakable = { x: number; y: number; w: number; h: number; hp: number; maxHp: number; secret: boolean; alive: boolean };
type Pickup = { x: number; y: number; collected: boolean };
type SwitchNode = { x: number; y: number; active: boolean };
type MissionExtra = { keys: number; switches: number; escort: number; alerts: number; chaseCaught: boolean; defendTime: number };
type HudState = {
  orbs: number; orbTotal: number; score: number; lives: number; distance: number; best: number; level: number;
  missionLabel: string; missionValue: string; missionDone: boolean; energy: number; combo: number;
};

const DIFFICULTIES: Record<Difficulty, { label: string; enemyHp: number; enemySpeed: number; damage: number; lives: number; reward: number }> = {
  easy: { label: "EXPLORATEUR", enemyHp: .82, enemySpeed: .88, damage: .82, lives: 1, reward: .85 },
  normal: { label: "AVENTURE", enemyHp: 1, enemySpeed: 1, damage: 1, lives: 0, reward: 1 },
  expert: { label: "NIGHTMARE", enemyHp: 1.34, enemySpeed: 1.18, damage: 1.22, lives: -1, reward: 1.45 },
};
const SKINS = [
  { name: "CYAN", filter: "none", color: "#6ff8ff", unlock: 0 },
  { name: "NOVA", filter: "hue-rotate(68deg) saturate(1.3)", color: "#c77dff", unlock: 2 },
  { name: "SOLAR", filter: "hue-rotate(165deg) saturate(1.5)", color: "#ffd66b", unlock: 5 },
];

function overlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function missionSnapshot(level: LevelDefinition, collected: number, defeated: number, beacons: number, elapsed: number, boss?: Enemy, extra: MissionExtra = { keys: 0, switches: 0, escort: 0, alerts: 0, chaseCaught: false, defendTime: 0 }) {
  const mission = level.mission;
  if (mission.type === "collect") return { label: mission.label, value: `${Math.min(collected, mission.target)}/${mission.target}`, complete: collected >= mission.target };
  if (mission.type === "hunt") return { label: mission.label, value: `${Math.min(defeated, mission.target)}/${mission.target}`, complete: defeated >= mission.target };
  if (mission.type === "beacons") return { label: mission.label, value: `${Math.min(beacons, mission.target)}/${mission.target}`, complete: beacons >= mission.target };
  if (mission.type === "assault") {
    const second = mission.secondaryTarget ?? 0;
    return { label: mission.label, value: `${Math.min(collected, mission.target)}/${mission.target}·${Math.min(defeated, second)}/${second}`, complete: collected >= mission.target && defeated >= second };
  }
  if (mission.type === "sprint" || mission.type === "escape") {
    const remaining = Math.max(0, Math.ceil((mission.timeLimit ?? mission.target) - elapsed));
    return { label: mission.label, value: `${remaining}s`, complete: remaining > 0 };
  }
  if (mission.type === "survive") {
    const survived = Math.min(mission.target, Math.floor(elapsed));
    return { label: mission.label, value: `${survived}/${mission.target}s`, complete: elapsed >= mission.target };
  }
  if (mission.type === "keys") return { label: mission.label, value: `${extra.keys}/${mission.target}`, complete: extra.keys >= mission.target };
  if (mission.type === "escort") return { label: mission.label, value: `${Math.min(100, Math.floor(extra.escort))}%`, complete: extra.escort >= mission.target };
  if (mission.type === "puzzle") return { label: mission.label, value: `${extra.switches}/${mission.target}`, complete: extra.switches >= mission.target };
  if (mission.type === "defend") return { label: mission.label, value: `${Math.min(mission.target, Math.floor(extra.defendTime))}/${mission.target}s`, complete: extra.defendTime >= mission.target };
  if (mission.type === "stealth") return { label: mission.label, value: `${extra.alerts}/3 ALERTES`, complete: extra.alerts < 3 };
  if (mission.type === "chase") return { label: mission.label, value: extra.chaseCaught ? "CAPTURÉ" : "EN FUITE", complete: extra.chaseCaught };
  if (mission.type === "waves") return { label: mission.label, value: `${Math.min(defeated, mission.target)}/${mission.target}`, complete: defeated >= mission.target };
  const hp = boss?.alive ? Math.max(0, boss.hp) : 0;
  const maxHp = boss?.maxHp ?? level.enemies.find(enemy => enemy.kind === "boss")?.hp ?? 1;
  const phase = hp <= 0 ? 3 : hp <= maxHp / 3 ? 3 : hp <= maxHp * 2 / 3 ? 2 : 1;
  return { label: `BOSS P${phase}/3`, value: `${hp}/${maxHp}`, complete: Boolean(boss && !boss.alive) };
}

const firstMission = missionSnapshot(LEVELS[0], 0, 0, 0, 0);

export default function AdventureGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const input = useRef({ left: false, right: false, jump: false, dash: false, attack: false, special: false });
  const statusRef = useRef<Status>("menu");
  const [status, setStatus] = useState<Status>("menu");
  const [hud, setHud] = useState<HudState>({ orbs: 0, orbTotal: LEVELS[0].orbs.length, score: 0, lives: 3, distance: 0, best: 0, level: 0, missionLabel: firstMission.label, missionValue: firstMission.value, missionDone: false, energy: 0, combo: 0 });
  const [selectedLevel, setSelectedLevel] = useState(0);
  const [menuTab, setMenuTab] = useState<MenuTab>("play");
  const [unlocked, setUnlocked] = useState(1);
  const [muted, setMuted] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [credits, setCredits] = useState(0);
  const [upgrades, setUpgrades] = useState<Upgrades>({ vitality: 0, jump: 0, attack: 0, dash: 0 });
  const [skin, setSkin] = useState(0);
  const [progressRecords, setProgressRecords] = useState<ProgressRecords>({});
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installMessage, setInstallMessage] = useState("");
  const [updateMessage, setUpdateMessage] = useState(`INITIALISATION · V${APP_VERSION}`);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const serviceWorkerRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const mutedRef = useRef(false);
  const difficultyRef = useRef<Difficulty>("normal");
  const creditsRef = useRef(0);
  const upgradesRef = useRef<Upgrades>({ vitality: 0, jump: 0, attack: 0, dash: 0 });
  const skinRef = useRef(0);
  const audioRef = useRef<AudioContext | null>(null);

  const changeStatus = useCallback((next: Status) => { statusRef.current = next; setStatus(next); }, []);

  const tone = useCallback((frequency: number, duration: number, type: OscillatorType = "sine", gain = 0.04) => {
    if (mutedRef.current) return;
    try {
      const BrowserWindow = window as typeof window & { webkitAudioContext?: typeof AudioContext };
      const Ctx = window.AudioContext || BrowserWindow.webkitAudioContext;
      if (!Ctx) return;
      const audio = audioRef.current ?? new Ctx();
      audioRef.current = audio;
      const osc = audio.createOscillator();
      const amp = audio.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, audio.currentTime);
      amp.gain.setValueAtTime(gain, audio.currentTime);
      amp.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
      osc.connect(amp).connect(audio.destination);
      osc.start();
      osc.stop(audio.currentTime + duration);
    } catch { /* Le son reste facultatif. */ }
  }, []);

  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { difficultyRef.current = difficulty; }, [difficulty]);
  useEffect(() => { creditsRef.current = credits; }, [credits]);
  useEffect(() => { upgradesRef.current = upgrades; }, [upgrades]);
  useEffect(() => { skinRef.current = skin; }, [skin]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden && statusRef.current === "playing") changeStatus("paused");
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [changeStatus]);

  useEffect(() => {
    const installedDisplayModes = ["fullscreen", "standalone", "minimal-ui"].map(mode => window.matchMedia(`(display-mode: ${mode})`));
    const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
    let updateTimer: number | undefined;
    let disposed = false;
    let reloadStarted = false;
    let controllerWasPresent = Boolean(navigator.serviceWorker?.controller);
    let registeredWorker: ServiceWorkerRegistration | null = null;
    let updateFoundHandler: (() => void) | null = null;
    const syncInstalledState = () => setIsInstalled(installedDisplayModes.some(query => query.matches) || navigatorWithStandalone.standalone === true);
    const reportUpdate = (message: string) => {
      if (!disposed) setUpdateMessage(message);
    };
    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setInstallMessage("");
    };
    const confirmInstallation = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setInstallMessage("APPLICATION INSTALLÉE");
    };
    const activateWaitingWorker = (registration: ServiceWorkerRegistration) => {
      if (!registration.waiting) return false;
      reportUpdate("NOUVELLE VERSION TROUVÉE · INSTALLATION…");
      registration.waiting.postMessage({ type: "CR3ATIX_SKIP_WAITING" });
      return true;
    };
    const checkRegistration = async () => {
      const registration = serviceWorkerRegistrationRef.current;
      if (!registration || !navigator.onLine) {
        if (!navigator.onLine) reportUpdate("HORS LIGNE · VÉRIFICATION AU RETOUR DU RÉSEAU");
        return;
      }
      try {
        await registration.update();
        if (!activateWaitingWorker(registration)) reportUpdate(`À JOUR · V${APP_VERSION}`);
      } catch {
        reportUpdate("VÉRIFICATION IMPOSSIBLE · NOUVEL ESSAI AUTOMATIQUE");
      }
    };
    const onControllerChange = () => {
      if (!controllerWasPresent) {
        controllerWasPresent = true;
        reportUpdate(`MISES À JOUR AUTOMATIQUES ACTIVES · V${APP_VERSION}`);
        return;
      }
      if (reloadStarted) return;
      reloadStarted = true;
      reportUpdate("MISE À JOUR INSTALLÉE · REDÉMARRAGE…");
      window.setTimeout(() => window.location.reload(), 350);
    };
    const onPageVisible = () => {
      if (document.visibilityState === "visible") void checkRegistration();
    };
    const onOnline = () => void checkRegistration();

    syncInstalledState();
    installedDisplayModes.forEach(query => query.addEventListener?.("change", syncInstalledState));
    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    window.addEventListener("appinstalled", confirmInstallation);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
      document.addEventListener("visibilitychange", onPageVisible);
      window.addEventListener("online", onOnline);
      navigator.serviceWorker.register(assetUrl("sw.js"), { updateViaCache: "none" }).then((registration) => {
        if (disposed) return;
        registeredWorker = registration;
        serviceWorkerRegistrationRef.current = registration;
        updateFoundHandler = () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;
          reportUpdate("NOUVELLE VERSION DÉTECTÉE · PRÉPARATION…");
          installingWorker.addEventListener("statechange", () => {
            if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
              reportUpdate("NOUVELLE VERSION PRÊTE · INSTALLATION…");
              (registration.waiting ?? installingWorker).postMessage({ type: "CR3ATIX_SKIP_WAITING" });
            }
          });
        };
        registration.addEventListener("updatefound", updateFoundHandler);
        activateWaitingWorker(registration);
        void checkRegistration();
        updateTimer = window.setInterval(() => void checkRegistration(), UPDATE_INTERVAL_MS);
      }).catch(() => {
        reportUpdate("AUTO-UPDATE INDISPONIBLE · RECHARGE LA PAGE");
        setInstallMessage("L’installation sera disponible après avoir rechargé la page.");
      });
    } else {
      window.setTimeout(() => reportUpdate("AUTO-UPDATE NON PRIS EN CHARGE"), 0);
    }

    return () => {
      disposed = true;
      if (updateTimer !== undefined) window.clearInterval(updateTimer);
      if (registeredWorker && updateFoundHandler) registeredWorker.removeEventListener("updatefound", updateFoundHandler);
      serviceWorkerRegistrationRef.current = null;
      installedDisplayModes.forEach(query => query.removeEventListener?.("change", syncInstalledState));
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
      window.removeEventListener("appinstalled", confirmInstallation);
      document.removeEventListener("visibilitychange", onPageVisible);
      window.removeEventListener("online", onOnline);
      navigator.serviceWorker?.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedDifficulty = localStorage.getItem("cr3atix-difficulty") as Difficulty | null;
      if (savedDifficulty && DIFFICULTIES[savedDifficulty]) setDifficulty(savedDifficulty);
      const savedCredits = Math.max(0, Number(localStorage.getItem("cr3atix-credits") || 0));
      setCredits(savedCredits); creditsRef.current = savedCredits;
      try {
        const savedUpgrades = JSON.parse(localStorage.getItem("cr3atix-upgrades") || "null") as Upgrades | null;
        if (savedUpgrades) { setUpgrades(savedUpgrades); upgradesRef.current = savedUpgrades; }
      } catch { /* Une sauvegarde corrompue repart avec les améliorations de base. */ }
      const savedSkin = Math.max(0, Math.min(SKINS.length - 1, Number(localStorage.getItem("cr3atix-skin") || 0)));
      setSkin(savedSkin); skinRef.current = savedSkin;
      setMuted(localStorage.getItem("cr3atix-muted") === "1");
      setProgressRecords(loadProgress());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (status !== "playing" || muted) return;
    const chapter = LEVELS[hud.level].chapter;
    const isBoss = LEVELS[hud.level].isBoss;
    const scales = [[110, 165, 220, 330], [98, 147, 196, 294], [130, 195, 260, 390], [116, 174, 232, 348], [123, 185, 247, 370]];
    const scale = scales[chapter % scales.length];
    let beat = 0;
    const timer = window.setInterval(() => {
      const note = scale[(beat + chapter) % scale.length] * (isBoss && beat % 4 === 0 ? .5 : 1);
      tone(note, isBoss ? .22 : .15, isBoss ? "sawtooth" : chapter % 2 ? "triangle" : "sine", isBoss ? .014 : .009);
      beat++;
    }, isBoss ? 330 : 520 - chapter * 12);
    return () => window.clearInterval(timer);
  }, [hud.level, muted, status, tone]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    if (!ctx) return;

    const heroSheet = new Image();
    const heroFallback = new Image();
    const enemyImg = new Image();
    const worldImgs = WORLD_BACKGROUNDS.map(() => new Image());
    const bossImgs = BOSS_SPRITES.map(() => new Image());
    heroSheet.src = assetUrl("game/hero-sprite.png");
    heroFallback.src = assetUrl("game/hero.png");
    enemyImg.src = assetUrl("game/enemy.png");

    const backgroundCache = new Map<number, HTMLCanvasElement>();
    let requestedBackground = 0;
    const ensureWorldImage = (chapter: number) => {
      const image = worldImgs[chapter];
      if (image && !image.src) image.src = assetUrl(WORLD_BACKGROUNDS[chapter]);
      return image;
    };
    const ensureBossImage = (chapter: number) => {
      const image = bossImgs[chapter];
      if (image && !image.src) image.src = assetUrl(BOSS_SPRITES[chapter]);
      return image;
    };
    const prepareBackground = (index: number) => {
      const level = LEVELS[index];
      const worldImg = ensureWorldImage(level.chapter);
      if (!worldImg?.complete || !worldImg.naturalWidth || backgroundCache.has(index)) return;
      const layer = document.createElement("canvas");
      layer.width = W; layer.height = H;
      const bg = layer.getContext("2d");
      if (!bg) return;
      bg.filter = level.filter;
      bg.drawImage(worldImg, 0, 0, W, H);
      bg.filter = "none";
      bg.fillStyle = level.tint;
      bg.fillRect(0, 0, W, H);

      const random = (offset: number) => {
        const value = Math.sin((level.decorSeed + offset * 97.31) * 12.9898) * 43758.5453;
        return value - Math.floor(value);
      };
      bg.save();
      bg.globalCompositeOperation = "screen";
      for (let i = 0; i < 34; i++) {
        const x = random(i * 3 + 1) * W;
        const y = 40 + random(i * 3 + 2) * 470;
        const size = 1 + random(i * 3 + 3) * 4;
        bg.globalAlpha = .08 + random(i + 90) * .22;
        bg.strokeStyle = level.edge;
        bg.fillStyle = level.edge;
        if (level.decor === "rain" || level.decor === "storm") {
          bg.lineWidth = 1 + size * .25; bg.beginPath(); bg.moveTo(x, y); bg.lineTo(x - 12 - size * 2, y + 32 + size * 5); bg.stroke();
        } else if (level.decor === "void" || level.decor === "mist") {
          bg.beginPath(); bg.ellipse(x, y, 30 + size * 8, 8 + size * 3, 0, 0, Math.PI * 2); bg.fill();
        } else {
          bg.beginPath(); bg.arc(x, y, size, 0, Math.PI * 2); bg.fill();
        }
      }
      bg.restore();

      const shade = bg.createLinearGradient(0, 0, 0, H);
      shade.addColorStop(0, "rgba(2,5,20,.03)");
      shade.addColorStop(.58, "rgba(3,3,18,.14)");
      shade.addColorStop(1, "rgba(2,4,12,.72)");
      bg.fillStyle = shade;
      bg.fillRect(0, 0, W, H);
      backgroundCache.set(index, layer);
      if (backgroundCache.size > 3) backgroundCache.delete(backgroundCache.keys().next().value as number);
    };
    const worldLoadHandlers = worldImgs.map((_, chapter) => () => {
      if (LEVELS[requestedBackground].chapter === chapter) prepareBackground(requestedBackground);
    });
    worldImgs.forEach((image, chapter) => image.addEventListener("load", worldLoadHandlers[chapter]));
    prepareBackground(0);

    const orbSprite = document.createElement("canvas");
    orbSprite.width = 80; orbSprite.height = 80;
    const orbCtx = orbSprite.getContext("2d");
    if (orbCtx) {
      const aura = orbCtx.createRadialGradient(40, 40, 1, 40, 40, 38);
      aura.addColorStop(0, "rgba(255,255,230,1)"); aura.addColorStop(.16, "rgba(255,222,91,.98)");
      aura.addColorStop(.48, "rgba(255,139,61,.38)"); aura.addColorStop(1, "rgba(255,92,42,0)");
      orbCtx.fillStyle = aura; orbCtx.fillRect(0, 0, 80, 80);
    }

    const vignetteLayer = document.createElement("canvas");
    vignetteLayer.width = W; vignetteLayer.height = H;
    const vignetteCtx = vignetteLayer.getContext("2d");
    if (vignetteCtx) {
      const vignette = vignetteCtx.createRadialGradient(W / 2, H / 2, H * .25, W / 2, H / 2, H * .84);
      vignette.addColorStop(0, "rgba(0,0,0,0)"); vignette.addColorStop(1, "rgba(0,0,10,.55)");
      vignetteCtx.fillStyle = vignette; vignetteCtx.fillRect(0, 0, W, H);
    }

    const player = {
      x: 150, y: 500, w: 62, h: 88, vx: 0, vy: 0, grounded: false, coyote: 0, jumps: 0,
      facing: 1, invulnerable: 0, dashTime: 0, dashCooldown: 0, checkpoint: 150, runPhase: 0,
      attackTime: 0, attackCooldown: 0, specialTime: 0, counterTime: 0, energy: 0, combo: 0, comboWindow: 0, heavyAttack: false,
    };
    let orbs: Orb[] = [];
    let enemies: Enemy[] = [];
    let particles: Particle[] = [];
    let shockwaves: Shockwave[] = [];
    let projectiles: Projectile[] = [];
    let movingPlatforms: MovingPlatform[] = [];
    let runtimePlatforms: Platform[] = [];
    let breakables: Breakable[] = [];
    let keys: Pickup[] = [];
    let switches: SwitchNode[] = [];
    let missionExtra: MissionExtra = { keys: 0, switches: 0, escort: 0, alerts: 0, chaseCaught: false, defendTime: 0 };
    let escortX = 220;
    let chaseX = 0;
    let collapseX = -420;
    let cameraX = 0;
    let shake = 0;
    let score = 0;
    let lives = 3;
    let collected = 0;
    let defeated = 0;
    let beacons = 0;
    let elapsed = 0;
    let portalWarning = 0;
    let last = performance.now();
    let raf = 0;
    let hudClock = 0;
    let wasJump = false;
    let wasDash = false;
    let wasAttack = false;
    let wasSpecial = false;
    let attackHeld = 0;
    let currentLevel = 0;
    let activeLevel = LEVELS[0];
    let renderScale = 1;
    let lastHudSignature = "";

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2.75);
      const mobileCap = window.matchMedia("(pointer: coarse)").matches ? 1 : 1.25;
      renderScale = Math.max(.55, Math.min(mobileCap, ((rect.width || W) * dpr) / W));
      const nextWidth = Math.round(W * renderScale);
      const nextHeight = Math.round(H * renderScale);
      if (canvas.width !== nextWidth) canvas.width = nextWidth;
      if (canvas.height !== nextHeight) canvas.height = nextHeight;
      canvas.style.aspectRatio = `${W} / ${H}`;
    };
    resize();
    window.addEventListener("resize", resize);
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(canvas);

    const getBoss = () => enemies.find(enemy => enemy.kind === "boss");
    const buildHud = (best = Number(localStorage.getItem("cr3atix-adventure-best") || 0)): HudState => {
      const mission = missionSnapshot(activeLevel, collected, defeated, beacons, elapsed, getBoss(), missionExtra);
      return {
        orbs: collected,
        orbTotal: activeLevel.orbs.length,
        score,
        lives,
        distance: Math.min(100, Math.floor((player.x / activeLevel.goalX) * 100)),
        best,
        level: currentLevel,
        missionLabel: mission.label,
        missionValue: mission.value,
        missionDone: mission.complete,
        energy: Math.floor(player.energy),
        combo: player.combo,
      };
    };

    const haptic = (pattern: number | number[]) => {
      try { navigator.vibrate?.(pattern); } catch { /* Les vibrations dépendent du téléphone. */ }
    };

    function makeEnemy(spawn: LevelDefinition["enemies"][number], index: number): Enemy {
      const dimensions = spawn.kind === "boss" ? [196, 148]
        : spawn.kind === "tank" || spawn.kind === "shielder" ? [86, 72]
        : spawn.kind === "flyer" || spawn.kind === "sentinel" ? [70, 46]
        : spawn.kind === "charger" || spawn.kind === "exploder" ? [76, 62]
        : spawn.kind === "hopper" ? [60, 64] : [64, 60];
      const difficultyConfig = DIFFICULTIES[difficultyRef.current];
      const bossScale = spawn.kind === "boss" ? 1.35 : 1;
      const maxHp = Math.max(1, Math.ceil((spawn.hp ?? 1) * difficultyConfig.enemyHp * bossScale));
      const speed = spawn.speed * difficultyConfig.enemySpeed;
      const attackCooldown = spawn.kind === "boss" ? 1.5 : spawn.kind === "shooter" || spawn.kind === "sentinel" ? .8 + index * .07 : 0;
      return { x: spawn.x, y: spawn.y, baseY: spawn.y, minX: spawn.minX, maxX: spawn.maxX, w: dimensions[0], h: dimensions[1], vx: index % 2 ? speed : -speed, speed, alive: true, phase: index * .77, kind: spawn.kind, hp: maxHp, maxHp, hitCooldown: 0, attackCooldown, shield: 0, alerted: false, telegraph: 0, phaseSeen: 1, bossName: spawn.name };
    }

    function reset(levelIndex = currentLevel, keepCampaignScore = false) {
      currentLevel = Math.max(0, Math.min(LEVELS.length - 1, levelIndex));
      activeLevel = LEVELS[currentLevel];
      requestedBackground = currentLevel;
      prepareBackground(currentLevel);
      ensureWorldImage(Math.min(9, activeLevel.chapter + 1));
      if (activeLevel.isBoss) ensureBossImage(activeLevel.chapter);
      Object.assign(player, { x: 150, y: 500, vx: 0, vy: 0, grounded: false, coyote: 0, jumps: 0, invulnerable: 0, dashTime: 0, dashCooldown: 0, checkpoint: 150, runPhase: 0, attackTime: 0, attackCooldown: 0, specialTime: 0, counterTime: 0, energy: 0, combo: 0, comboWindow: 0, heavyAttack: false });
      orbs = activeLevel.orbs.map(([x, y], i) => ({ x, y, collected: false, phase: i * 0.63 }));
      enemies = activeLevel.enemies.map(makeEnemy);
      runtimePlatforms = activeLevel.platforms.map(platform => ({ ...platform }));
      movingPlatforms = activeLevel.movingPlatforms.map(platform => ({ ...platform, originX: platform.x, originY: platform.y, dx: 0 }));
      breakables = activeLevel.breakables.map(wall => ({ ...wall, maxHp: wall.hp, alive: true }));
      keys = activeLevel.keys.map(([x, y]) => ({ x, y, collected: false }));
      switches = activeLevel.switches.map(([x, y]) => ({ x, y, active: false }));
      missionExtra = { keys: 0, switches: 0, escort: 0, alerts: 0, chaseCaught: false, defendTime: 0 };
      escortX = 220; chaseX = Math.max(900, activeLevel.goalX * .62); collapseX = -420;
      particles = []; shockwaves = []; projectiles = []; cameraX = 0; shake = 0; collected = 0; defeated = 0; beacons = 0; elapsed = 0; portalWarning = 0;
      const startingLives = Math.max(2, 3 + DIFFICULTIES[difficultyRef.current].lives + upgradesRef.current.vitality);
      if (!keepCampaignScore) { score = 0; lives = startingLives; }
      else lives = Math.max(2, lives);
      wasJump = false; wasDash = false; wasAttack = false; wasSpecial = false; attackHeld = 0;
      input.current = { left: false, right: false, jump: false, dash: false, attack: false, special: false };
      lastHudSignature = "";
      const savedUnlocked = Math.max(1, Math.min(LEVELS.length, Number(localStorage.getItem("cr3atix-adventure-unlocked") || 1)));
      setUnlocked(savedUnlocked);
      setHud(buildHud());
    }

    type GameWindow = typeof window & { startCr3atixGame?: (level?: number) => void; restartCr3atixGame?: () => void; nextCr3atixLevel?: (fromLevel?: number) => number };
    (window as GameWindow).startCr3atixGame = (level = 0) => {
      const startIndex = Math.max(0, Math.min(LEVELS.length - 1, level));
      reset(startIndex, false); audioRef.current?.resume(); changeStatus(LEVELS[startIndex].isBoss ? "bossintro" : LEVELS[startIndex].stage === 0 ? "chapterintro" : "playing"); tone(280, 0.08, "triangle", 0.05);
      setTimeout(() => tone(520, 0.16, "triangle", 0.05), 80);
    };
    (window as GameWindow).restartCr3atixGame = () => { reset(currentLevel, false); changeStatus("playing"); };
    (window as GameWindow).nextCr3atixLevel = (fromLevel = currentLevel) => {
      const completedLevel = Math.max(0, Math.min(LEVELS.length - 1, fromLevel));
      const nextIndex = completedLevel < LEVELS.length - 1 ? completedLevel + 1 : 0;
      reset(nextIndex, completedLevel < LEVELS.length - 1);
      changeStatus(LEVELS[nextIndex].isBoss ? "bossintro" : LEVELS[nextIndex].stage === 0 ? "chapterintro" : "playing");
      return nextIndex;
    };

    function emit(x: number, y: number, color: string, count: number, speed = 210) {
      const amount = Math.min(count, Math.max(0, 140 - particles.length));
      for (let i = 0; i < amount; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.3 + Math.random() * 0.7);
        particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.35 + Math.random() * 0.45, maxLife: 0.8, size: 2 + Math.random() * 5, color });
      }
    }

    function finishGame(next: "won" | "gameover") {
      const best = Math.max(score, Number(localStorage.getItem("cr3atix-adventure-best") || 0));
      localStorage.setItem("cr3atix-adventure-best", String(best));
      if (next === "won") {
        const nextUnlocked = Math.min(LEVELS.length, Math.max(Number(localStorage.getItem("cr3atix-adventure-unlocked") || 1), currentLevel + 2));
        localStorage.setItem("cr3atix-adventure-unlocked", String(nextUnlocked));
        setUnlocked(nextUnlocked);
        const reward = Math.round((activeLevel.isBoss ? 220 + activeLevel.chapter * 35 : 55 + activeLevel.chapter * 8) * DIFFICULTIES[difficultyRef.current].reward);
        creditsRef.current += reward;
        setCredits(creditsRef.current);
        localStorage.setItem("cr3atix-credits", String(creditsRef.current));
        const parTime = activeLevel.isBoss ? 210 + activeLevel.chapter * 15 : Math.round(activeLevel.worldWidth / 150 + 24);
        setProgressRecords(saveLevelResult(currentLevel, score, elapsed, lives, parTime));
      }
      setHud(buildHud(best));
      changeStatus(next);
    }

    function respawn() {
      lives--; shake = 14;
      emit(player.x + player.w / 2, player.y + player.h / 2, "#ff4d8d", 22, 270);
      tone(115, 0.3, "sawtooth", 0.06);
      if (lives <= 0) { finishGame("gameover"); return; }
      Object.assign(player, { x: player.checkpoint, y: 420, vx: 0, vy: -120, invulnerable: 2 });
    }

    function hurtPlayer(sourceX: number, force = 430) {
      if (player.invulnerable > 0 || statusRef.current !== "playing") return;
      player.invulnerable = 1.35; player.vx = player.x < sourceX ? -force : force; player.vy = -410; lives--; shake = 14; player.combo = 0; player.comboWindow = 0;
      emit(player.x + player.w / 2, player.y + player.h / 2, "#ff4d8d", 22, 270); tone(98, .24, "sawtooth", .06); haptic([38, 24, 45]);
      if (lives <= 0) finishGame("gameover");
    }

    function hitEnemy(enemy: Enemy, bounce = true, damage = 1, bypassShield = false) {
      if (!enemy.alive || enemy.hitCooldown > 0) return false;
      if (enemy.shield > 0 && !bypassShield) {
        enemy.hitCooldown = .18; emit(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, "#c8b3ff", 14, 180); tone(880, .08, "sine", .025); return false;
      }
      enemy.hitCooldown = enemy.kind === "boss" ? .28 : .22;
      enemy.hp -= Math.max(1, Math.round(damage));
      shake = enemy.kind === "boss" ? 11 : 6;
      if (bounce) player.vy = enemy.kind === "boss" ? -520 : -430;
      emit(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, enemy.kind === "boss" ? activeLevel.edge : "#ff8b43", enemy.kind === "boss" ? 34 : 20, enemy.kind === "boss" ? 310 : 250);
      tone(enemy.kind === "boss" ? 95 + enemy.hp * 7 : 165, .1, "square", .05);
      if (enemy.hp <= 0) {
        enemy.hp = 0; enemy.alive = false; defeated++; score += enemy.kind === "boss" ? 4000 : 250 + enemy.maxHp * 75;
        emit(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, activeLevel.edge, enemy.kind === "boss" ? 70 : 28, enemy.kind === "boss" ? 430 : 290);
        if (enemy.kind === "boss") { shake = 22; tone(55, .48, "sawtooth", .07); }
      }
      return true;
    }

    function damageWall(wall: Breakable, amount: number) {
      if (!wall.alive) return;
      wall.hp -= amount; shake = Math.max(shake, 4); emit(wall.x + wall.w / 2, wall.y + wall.h / 2, activeLevel.edge, 10, 150);
      if (wall.hp <= 0) {
        wall.alive = false; score += wall.secret ? 600 : 180;
        if (wall.secret) orbs.push({ x: wall.x + wall.w / 2, y: wall.y - 38, collected: false, phase: elapsed });
        emit(wall.x + wall.w / 2, wall.y + wall.h / 2, wall.secret ? "#ffe07a" : activeLevel.edge, 34, 320);
      }
    }

    function performAttack(heavy: boolean) {
      if (player.attackCooldown > 0) return;
      player.combo = player.comboWindow > 0 ? player.combo % 3 + 1 : 1;
      player.comboWindow = .7;
      player.attackTime = heavy ? .34 : .2;
      player.attackCooldown = heavy ? .42 : .22;
      player.heavyAttack = heavy;
      const range = heavy ? 154 : 104 + player.combo * 8;
      const hitbox = { x: player.facing > 0 ? player.x + player.w - 8 : player.x - range + 8, y: player.y + 3, w: range, h: player.h - 2 };
      const upgradeDamage = upgradesRef.current.attack * .55;
      const damage = heavy ? 3 + upgradeDamage : 1 + upgradeDamage + (player.combo === 3 ? 1.4 : 0);
      let connected = false;
      for (const enemy of enemies) {
        if (enemy.alive && overlap(hitbox, enemy) && hitEnemy(enemy, false, damage)) connected = true;
      }
      for (const wall of breakables) if (wall.alive && overlap(hitbox, wall)) damageWall(wall, heavy ? 3 : 1);
      const nextSwitch = switches.findIndex(node => !node.active);
      switches.forEach((node, index) => {
        if (!overlap(hitbox, { x: node.x - 24, y: node.y - 42, w: 48, h: 54 })) return;
        if (index === nextSwitch) { node.active = true; missionExtra.switches++; score += 160; tone(520 + index * 120, .18, "triangle", .04); }
        else { switches.forEach(item => { item.active = false; }); missionExtra.switches = 0; tone(90, .15, "square", .04); }
      });
      if (connected) { player.energy = Math.min(100, player.energy + (heavy ? 14 : 8)); haptic(heavy ? [24, 16, 30] : 18); }
      emit(player.x + player.w / 2 + player.facing * 52, player.y + 36, heavy ? "#ffe27a" : SKINS[skinRef.current].color, heavy ? 22 : 10, heavy ? 290 : 190);
      tone(heavy ? 116 : 250 + player.combo * 55, heavy ? .16 : .08, heavy ? "sawtooth" : "square", .035);
    }

    function performSpecial() {
      if (player.energy < 100 || player.specialTime > 0) return;
      player.energy = 0; player.specialTime = .7; player.invulnerable = .8; shake = 24; haptic([45, 35, 70]);
      for (const enemy of enemies) {
        if (!enemy.alive || Math.abs(enemy.x - player.x) > 560) continue;
        enemy.hitCooldown = 0; enemy.shield = 0; hitEnemy(enemy, false, 6 + upgradesRef.current.attack * 1.5, true);
      }
      for (const wall of breakables) if (wall.alive && Math.abs(wall.x - player.x) < 520) damageWall(wall, 99);
      for (const direction of [-1, 1]) shockwaves.push({ x: player.x + player.w / 2, y: player.y + player.h - 10, vx: direction * 820, life: 1.1, hit: false, color: SKINS[skinRef.current].color, hostile: false });
      emit(player.x + player.w / 2, player.y + player.h / 2, SKINS[skinRef.current].color, 70, 470); tone(58, .55, "sawtooth", .08);
    }

    function addProjectile(x: number, y: number, vx: number, vy: number, color: string, size = 18, gravity = 0) {
      projectiles.push({ x, y, w: size, h: size, vx, vy, life: 4, color, hostile: true, gravity });
    }

    function summonMinion(boss: Enemy, offset: number) {
      const x = Math.max(boss.minX, Math.min(boss.maxX - 70, boss.x + offset));
      const kind: EnemyKind = activeLevel.chapter % 2 ? "hopper" : "crawler";
      enemies.push(makeEnemy({ x, y: 560, minX: boss.minX, maxX: boss.maxX, speed: 116 + activeLevel.chapter * 7, kind, hp: 2 + Math.floor(activeLevel.chapter / 3) }, enemies.length));
    }

    function update(dt: number) {
      if (statusRef.current !== "playing") return;
      elapsed += dt;
      portalWarning = Math.max(0, portalWarning - dt);
      if ((activeLevel.mission.type === "sprint" || activeLevel.mission.type === "escape") && elapsed > (activeLevel.mission.timeLimit ?? activeLevel.mission.target)) {
        lives = 0; finishGame("gameover"); return;
      }
      player.invulnerable = Math.max(0, player.invulnerable - dt);
      player.dashCooldown = Math.max(0, player.dashCooldown - dt);
      player.dashTime = Math.max(0, player.dashTime - dt);
      player.counterTime = Math.max(0, player.counterTime - dt);
      player.attackTime = Math.max(0, player.attackTime - dt);
      player.attackCooldown = Math.max(0, player.attackCooldown - dt);
      player.specialTime = Math.max(0, player.specialTime - dt);
      player.comboWindow = Math.max(0, player.comboWindow - dt);
      if (player.comboWindow <= 0) player.combo = 0;

      const jumpPressed = input.current.jump && !wasJump;
      const dashPressed = input.current.dash && !wasDash;
      const specialPressed = input.current.special && !wasSpecial;
      if (input.current.attack) attackHeld += dt;
      if (!input.current.attack && wasAttack) { performAttack(attackHeld >= .48); attackHeld = 0; }
      if (specialPressed) performSpecial();
      wasJump = input.current.jump;
      wasDash = input.current.dash;
      wasAttack = input.current.attack;
      wasSpecial = input.current.special;
      const dir = (input.current.right ? 1 : 0) - (input.current.left ? 1 : 0);
      if (dir) { player.facing = dir; player.vx += dir * 900 * dt; player.runPhase += dt * (6 + Math.abs(player.vx) * 0.022); }
      else player.vx *= Math.pow(player.grounded ? 0.0007 : 0.08, dt);
      const maxSpeed = player.dashTime > 0 ? 720 + upgradesRef.current.dash * 45 : 325;
      player.vx = Math.max(-maxSpeed, Math.min(maxSpeed, player.vx));

      if (dashPressed && player.dashCooldown <= 0) {
        player.dashTime = .18 + upgradesRef.current.dash * .018; player.dashCooldown = Math.max(.4, .72 - upgradesRef.current.dash * .075); player.counterTime = .24; player.invulnerable = Math.max(player.invulnerable, .27); player.vx = player.facing * (720 + upgradesRef.current.dash * 45); player.vy *= 0.25;
        emit(player.x + player.w / 2, player.y + player.h / 2, "#7ef9ff", 14, 170); tone(190, 0.12, "square", 0.035); haptic(14);
      }
      if (player.grounded) { player.coyote = 0.11; player.jumps = 0; }
      else player.coyote = Math.max(0, player.coyote - dt);
      if (jumpPressed && (player.coyote > 0 || player.jumps < 2)) {
        const isDouble = player.coyote <= 0;
        const jumpBoost = upgradesRef.current.jump * 28;
        player.vy = isDouble ? -745 - jumpBoost : -815 - jumpBoost; player.grounded = false; player.coyote = 0; player.jumps++;
        emit(player.x + player.w / 2, player.y + player.h, isDouble ? "#cf72ff" : "#61f7ff", isDouble ? 16 : 10, 150);
        tone(isDouble ? 530 : 430, 0.13, "triangle", 0.04); haptic(10);
      }
      if (!input.current.jump && player.vy < -180) player.vy += 1100 * dt;

      for (const platform of movingPlatforms) {
        const previousX = platform.x;
        const wave = Math.sin(elapsed * platform.speed + platform.phase) * platform.range;
        platform.x = platform.originX + (platform.axis === "x" ? wave : 0);
        platform.y = platform.originY + (platform.axis === "y" ? wave : 0);
        platform.dx = platform.x - previousX;
      }
      const previousBottom = player.y + player.h;
      const previousX = player.x;
      player.vy += (player.dashTime > 0 ? 500 : 1780) * dt;
      player.x = Math.max(0, Math.min(activeLevel.worldWidth - player.w, player.x + player.vx * dt));
      player.y += player.vy * dt;
      player.grounded = false;
      if (player.vy >= 0) {
        for (const p of [...runtimePlatforms, ...movingPlatforms]) {
          const nextBottom = player.y + player.h;
          if (player.x + player.w > p.x + 6 && player.x < p.x + p.w - 6 && previousBottom <= p.y + 6 && nextBottom >= p.y) {
            player.y = p.y - player.h; player.vy = 0; player.grounded = true;
            if ("dx" in p) player.x += (p as MovingPlatform).dx;
            break;
          }
        }
      }
      for (const wall of breakables) {
        if (!wall.alive || !overlap(player, wall)) continue;
        if (previousX + player.w <= wall.x + 12) player.x = wall.x - player.w;
        else if (previousX >= wall.x + wall.w - 12) player.x = wall.x + wall.w;
        player.vx = 0;
      }

      for (const hazard of activeLevel.hazards) {
        const enabled = hazard.kind !== "laser" || Math.sin(elapsed * Math.PI * 2 / hazard.period + hazard.phase) > -.15;
        if (enabled && overlap(player, hazard)) hurtPlayer(hazard.x + hazard.w / 2, 520);
      }
      if (activeLevel.mission.type === "escape") {
        collapseX = Math.max(collapseX, elapsed * (115 + activeLevel.chapter * 8) - 360);
        if (player.x < collapseX && player.invulnerable <= 0) { collapseX = Math.max(-300, player.checkpoint - 420); respawn(); }
      }

      for (const checkpoint of activeLevel.checkpoints) {
        if (player.x > checkpoint + 45 && player.checkpoint < checkpoint) {
          player.checkpoint = checkpoint; beacons++; emit(player.x, player.y, activeLevel.edge, 18, 220); tone(720, 0.22, "sine", 0.045);
        }
      }
      if (player.y > H + 170) respawn();

      for (const orb of orbs) {
        orb.phase += dt * 3.2;
        if (!orb.collected && Math.hypot(player.x + player.w / 2 - orb.x, player.y + player.h / 2 - orb.y) < 55) {
          orb.collected = true; collected++; player.energy = Math.min(100, player.energy + 5); score += 100; emit(orb.x, orb.y, "#ffd75e", 17, 220); tone(760 + collected * 12, 0.12, "sine", 0.045);
        }
      }
      for (const key of keys) {
        if (!key.collected && Math.hypot(player.x + player.w / 2 - key.x, player.y + player.h / 2 - key.y) < 54) {
          key.collected = true; missionExtra.keys++; score += 220; emit(key.x, key.y, "#7effdc", 25, 260); tone(910, .18, "triangle", .045); haptic([12, 20, 18]);
        }
      }
      if (activeLevel.mission.type === "escort") {
        const wanted = Math.max(220, player.x - 145);
        const threatened = enemies.some(enemy => enemy.alive && enemy.kind !== "boss" && Math.abs(enemy.x - escortX) < 175);
        if (!threatened && wanted > escortX && wanted - escortX < 430) escortX += Math.min(wanted - escortX, (120 + activeLevel.chapter * 5) * dt);
        missionExtra.escort = Math.min(100, escortX / Math.max(1, activeLevel.goalX - 180) * 100);
      }
      if (activeLevel.mission.type === "chase" && !missionExtra.chaseCaught) {
        chaseX = Math.min(activeLevel.goalX - 80, chaseX + (92 + activeLevel.chapter * 6) * dt);
        if (Math.abs(player.x - chaseX) < 88 && Math.abs(player.y - 470) < 170) { missionExtra.chaseCaught = true; score += 900; emit(chaseX, 470, "#ffe77b", 35, 330); }
      }
      if (activeLevel.mission.type === "defend") {
        const defenseX = activeLevel.goalX * .53;
        if (Math.abs(player.x - defenseX) < 280) missionExtra.defendTime += dt;
        else missionExtra.defendTime = Math.max(0, missionExtra.defendTime - dt * .3);
      }

      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        const telegraphBefore = enemy.telegraph;
        enemy.hitCooldown = Math.max(0, enemy.hitCooldown - dt);
        enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
        enemy.shield = Math.max(0, enemy.shield - dt);
        enemy.telegraph = Math.max(0, enemy.telegraph - dt);
        const telegraphEnded = telegraphBefore > 0 && enemy.telegraph <= 0;
        const bossDamage = enemy.kind === "boss" ? 1 - enemy.hp / enemy.maxHp : 0;
        const bossPhase = bossDamage >= .67 ? 3 : bossDamage >= .34 ? 2 : 1;
        if (enemy.kind === "boss" && bossPhase > enemy.phaseSeen) {
          enemy.phaseSeen = bossPhase; enemy.telegraph = 0; enemy.attackCooldown = 1.05; enemy.shield = .7;
          emit(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, activeLevel.edge, 54, 390); shake = 18;
          tone(72 + bossPhase * 22, .38, "sawtooth", .07); haptic([55, 30, 80]);
        }
        enemy.phase += dt * (enemy.kind === "boss" ? 2.4 + bossPhase * .35 : 5);
        if (enemy.kind === "hopper") enemy.y = enemy.baseY - Math.abs(Math.sin(enemy.phase * .72)) * 84;
        else if (enemy.kind === "flyer" || enemy.kind === "sentinel") enemy.y = enemy.baseY + Math.sin(enemy.phase * .62) * 58;
        else if (enemy.kind === "boss" && bossPhase > 1) enemy.y = enemy.baseY - Math.abs(Math.sin(enemy.phase * (bossPhase === 3 ? .82 : .62))) * (bossPhase === 3 ? 112 : 64);
        else enemy.y = enemy.baseY;
        if (enemy.kind === "charger" && Math.abs(player.x - enemy.x) < 430) enemy.vx = Math.sign(player.x - enemy.x || 1) * enemy.speed * 1.85;
        else if (enemy.kind === "exploder" && Math.abs(player.x - enemy.x) < 340) enemy.vx = Math.sign(player.x - enemy.x || 1) * enemy.speed * 1.7;
        else if ((enemy.kind === "shooter" || enemy.kind === "sentinel") && Math.abs(player.x - enemy.x) < 720) enemy.vx *= Math.pow(.02, dt);
        else if (enemy.kind === "boss" && Math.abs(player.x - enemy.x) < 1100) {
          const charge = Math.sin(enemy.phase * .73) > .64 ? 1.55 : 1;
          const pace = bossPhase === 3 ? 2.2 : bossPhase === 2 ? 1.62 : 1.12;
          enemy.vx = Math.sign(player.x - enemy.x || 1) * enemy.speed * pace * charge;
        }
        else enemy.vx = Math.sign(enemy.vx || 1) * enemy.speed;
        enemy.x += enemy.vx * dt;
        if (enemy.x < enemy.minX || enemy.x + enemy.w > enemy.maxX) { enemy.vx *= -1; enemy.x = Math.max(enemy.minX, Math.min(enemy.maxX - enemy.w, enemy.x)); }
        if (enemy.kind !== "boss" && activeLevel.mission.type === "stealth" && !enemy.alerted && Math.abs(player.x - enemy.x) < 330 && Math.abs(player.y - enemy.y) < 135 && player.dashTime <= 0) {
          enemy.alerted = true; missionExtra.alerts++; emit(enemy.x, enemy.y - 25, "#ff4d8d", 18, 210); tone(112, .24, "square", .045);
          if (missionExtra.alerts >= 3) { lives = 0; finishGame("gameover"); return; }
        }
        if ((enemy.kind === "shooter" || enemy.kind === "sentinel") && enemy.attackCooldown <= 0 && Math.abs(player.x - enemy.x) < 780) {
          const direction = Math.sign(player.x - enemy.x || 1);
          addProjectile(enemy.x + enemy.w / 2, enemy.y + enemy.h * .35, direction * (enemy.kind === "sentinel" ? 390 : 330), enemy.kind === "sentinel" ? Math.sign(player.y - enemy.y) * 70 : -90, enemy.kind === "sentinel" ? "#66e9ff" : "#ff8d63", 16, enemy.kind === "sentinel" ? 0 : 130);
          enemy.attackCooldown = enemy.kind === "sentinel" ? 1.45 : 1.85;
          emit(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, enemy.kind === "sentinel" ? "#66e9ff" : "#ff8d63", 8, 120);
        }
        if (enemy.kind === "shielder" && enemy.attackCooldown <= 0 && Math.abs(player.x - enemy.x) < 520) {
          enemy.shield = 1.25; enemy.attackCooldown = 2.8; tone(710, .09, "sine", .025);
        }
        if (enemy.kind === "exploder" && enemy.attackCooldown <= 0 && Math.abs(player.x - enemy.x) < 115) {
          enemy.alive = false; defeated++; shake = 14; emit(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, "#ffcf61", 38, 360);
          if (Math.abs(player.x - enemy.x) < 150) hurtPlayer(enemy.x + enemy.w / 2, 590);
          tone(76, .26, "sawtooth", .06); continue;
        }
        if (enemy.kind === "boss" && enemy.attackCooldown <= 0 && enemy.telegraph <= 0 && !telegraphEnded && Math.abs(player.x - enemy.x) < 1200) {
          enemy.telegraph = .62; enemy.attackCooldown = .62;
          emit(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, "#fff0a1", 12, 130); tone(980, .13, "square", .03); haptic(12);
        }
        if (enemy.kind === "boss" && telegraphEnded && Math.abs(player.x - enemy.x) < 1200) {
          const direction = Math.sign(player.x - enemy.x || 1);
          const speed = 420 + bossPhase * 85 + activeLevel.chapter * 12;
          if (activeLevel.chapter === 0) {
            for (let wave = 0; wave < bossPhase; wave++) shockwaves.push({ x: enemy.x + enemy.w / 2 + direction * (95 + wave * 58), y: 592, vx: direction * (speed + wave * 65), life: 2.4, hit: false, color: activeLevel.edge, hostile: true });
          } else if (activeLevel.chapter === 1) {
            for (let shot = 0; shot < bossPhase + 1; shot++) addProjectile(enemy.x, enemy.y + 45, direction * (speed + shot * 45), -260 - shot * 60, "#ff5d29", 24, 620);
          } else if (activeLevel.chapter === 2) {
            enemy.x = Math.max(enemy.minX, Math.min(enemy.maxX - enemy.w, player.x + (Math.random() > .5 ? 430 : -430)));
            for (let shot = -bossPhase; shot <= bossPhase; shot++) addProjectile(enemy.x, enemy.y + 45, direction * speed, shot * 120, "#b88cff", 20);
          } else if (activeLevel.chapter === 3) {
            if (enemies.filter(item => item.alive && item.kind !== "boss" && item.x > enemy.minX).length < 7) { summonMinion(enemy, -260); if (bossPhase > 1) summonMinion(enemy, 250); }
            addProjectile(enemy.x, enemy.y + 38, direction * speed, -150, "#71ff82", 28, 260);
          } else if (activeLevel.chapter === 4) {
            for (let shot = -bossPhase; shot <= bossPhase; shot++) addProjectile(enemy.x, enemy.y + 35, direction * speed, shot * 105, "#9feaff", 22);
          } else if (activeLevel.chapter === 5) {
            enemy.y = enemy.baseY - 180;
            for (let shot = 0; shot < bossPhase + 1; shot++) addProjectile(enemy.x + shot * 36, enemy.y + 80, direction * (180 + shot * 40), 330 + shot * 80, "#ffd15d", 25, 180);
          } else if (activeLevel.chapter === 6) {
            player.vx += Math.sign(enemy.x - player.x) * (190 + bossPhase * 55);
            for (let shot = 0; shot < bossPhase + 1; shot++) addProjectile(enemy.x, enemy.y + 44, direction * (speed - shot * 55), (shot - 1) * 145, "#37b9ff", 30);
          } else if (activeLevel.chapter === 7) {
            enemy.shield = 1.05 + bossPhase * .18;
            for (let shot = 0; shot < bossPhase + 1; shot++) addProjectile(player.x - 190 + shot * 185, 80, 0, 560 + shot * 55, "#df8cff", 18);
          } else if (activeLevel.chapter === 8) {
            for (let shot = 0; shot < bossPhase + 2; shot++) addProjectile(player.x - 260 + shot * 150, 40 - shot * 25, (shot % 2 ? -1 : 1) * 70, 610, "#9f82ff", 20);
          } else {
            for (let shot = -bossPhase; shot <= bossPhase; shot++) addProjectile(enemy.x, enemy.y + 30, direction * (speed + 90), shot * 125, "#ff486d", 24);
            shockwaves.push({ x: enemy.x, y: 592, vx: direction * 760, life: 2, hit: false, color: "#ff486d", hostile: true });
            if (bossPhase === 3) {
              const fragile = runtimePlatforms.findIndex(platform => platform.h < 60 && platform.x > enemy.minX);
              if (fragile >= 0) runtimePlatforms.splice(fragile, 1);
            }
          }
          enemy.attackCooldown = Math.max(.72, 2.35 - bossPhase * .35 - activeLevel.chapter * .045);
          emit(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, activeLevel.edge, 18 + bossPhase * 7, 280); shake = Math.max(shake, 9); tone(62 + activeLevel.chapter * 5, .24, "sawtooth", .055); haptic(24);
        }
        if (overlap(player, enemy)) {
          if (player.counterTime > 0 && enemy.hitCooldown <= 0) {
            if (hitEnemy(enemy, false, 1.5 + upgradesRef.current.attack * .4)) player.energy = Math.min(100, player.energy + 18);
            player.vx = -player.facing * 240; player.dashTime = 0; player.counterTime = 0; player.invulnerable = Math.max(player.invulnerable, .45); score += 120;
          } else if (player.vy > 90 && previousBottom <= enemy.y + Math.min(32, enemy.h * .45)) {
            hitEnemy(enemy);
          } else hurtPlayer(enemy.x + enemy.w / 2);
        }
      }

      for (const wave of shockwaves) {
        wave.life -= dt; wave.x += wave.vx * dt;
        if (wave.hostile !== false && !wave.hit && overlap(player, { x: wave.x - 34, y: wave.y - 24, w: 68, h: 38 })) { wave.hit = true; hurtPlayer(wave.x, 540); }
      }
      if (!getBoss()?.alive) shockwaves = shockwaves.filter(wave => wave.hostile === false);
      shockwaves = shockwaves.filter(wave => wave.life > 0 && wave.x > 0 && wave.x < activeLevel.worldWidth);

      for (const projectile of projectiles) {
        projectile.life -= dt; projectile.x += projectile.vx * dt; projectile.y += projectile.vy * dt; projectile.vy += projectile.gravity * dt;
        if (projectile.hostile && overlap(player, projectile)) { projectile.life = 0; hurtPlayer(projectile.x, 480); }
      }
      projectiles = projectiles.filter(projectile => projectile.life > 0 && projectile.y < H + 220 && projectile.x > -100 && projectile.x < activeLevel.worldWidth + 100);

      for (const p of particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 540 * dt; p.vx *= Math.pow(0.2, dt); }
      particles = particles.filter(p => p.life > 0);
      if (player.x > activeLevel.goalX) {
        const mission = missionSnapshot(activeLevel, collected, defeated, beacons, elapsed, getBoss(), missionExtra);
        if (mission.complete) {
          score += Math.max(0, Math.floor(5000 - elapsed * 25)); emit(player.x, player.y, "#a9ffcf", 50, 340); tone(520, 0.18, "triangle", 0.05);
          setTimeout(() => tone(780, 0.35, "triangle", 0.05), 120); finishGame("won");
        } else {
          player.x = activeLevel.goalX - player.w - 12; player.vx = -210;
          if (portalWarning <= 0) { portalWarning = 1.1; emit(activeLevel.goalX, 505, "#ff4d8d", 16, 190); tone(120, .12, "square", .04); }
        }
      }

      const targetCamera = Math.max(0, Math.min(activeLevel.worldWidth - W, player.x - W * 0.36));
      cameraX += (targetCamera - cameraX) * Math.min(1, dt * 5.5); shake *= Math.pow(0.02, dt); hudClock += dt;
      if (hudClock > 0.16) {
        hudClock = 0;
        const nextHud = buildHud();
        const signature = `${nextHud.orbs}|${nextHud.score}|${nextHud.lives}|${nextHud.distance}|${nextHud.level}|${nextHud.missionValue}|${nextHud.missionDone}|${nextHud.energy}|${nextHud.combo}`;
        if (signature !== lastHudSignature) { lastHudSignature = signature; setHud(nextHud); }
      }
    }

    function roundedRect(x: number, y: number, w: number, h: number, r: number) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

    function drawBackground() {
      const cached = backgroundCache.get(currentLevel);
      if (cached) {
        ctx.drawImage(cached, 0, 0);
      } else {
        prepareBackground(currentLevel);
        const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#071027"); sky.addColorStop(0.5, "#1d1650"); sky.addColorStop(1, "#081426");
        ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      }
    }

    function drawAtmosphere(t: number) {
      const decor = activeLevel.decor;
      const seed = activeLevel.decorSeed;
      ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.strokeStyle = activeLevel.edge; ctx.fillStyle = activeLevel.edge;
      const movingDown = decor === "rain" || decor === "snow" || decor === "ash" || decor === "storm";
      for (let i = 0; i < 18; i++) {
        const phase = ((seed * .017 + i * 97.3) % 997) / 997;
        const x = (phase * W + (decor === "dust" || decor === "embers" ? t * .025 : 0)) % W;
        const y = movingDown ? (phase * H + t * (.018 + i % 3 * .006)) % H : 80 + ((phase * 433 + Math.sin(t * .0005 + i) * 70) % 470);
        ctx.globalAlpha = .08 + (i % 4) * .025;
        if (decor === "rain" || decor === "storm") { ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 12, y + 30); ctx.stroke(); }
        else { ctx.beginPath(); ctx.arc(x, y, decor === "mist" || decor === "void" ? 5 + i % 5 : 1.5 + i % 3, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.restore();
    }

    function drawPlatform(p: Platform) {
      const x = p.x - cameraX; if (x + p.w < -60 || x > W + 60) return;
      ctx.save();
      roundedRect(x, p.y, p.w, p.h, p.h > 60 ? 12 : 9); ctx.fillStyle = activeLevel.deep; ctx.fill();
      ctx.fillStyle = activeLevel.surface; ctx.fillRect(x + 4, p.y + 5, Math.max(0, p.w - 8), Math.min(18, p.h - 5));
      ctx.fillStyle = activeLevel.edge; ctx.globalAlpha = .82; ctx.fillRect(x + 8, p.y + 2, Math.max(0, p.w - 16), 3); ctx.globalAlpha = .22;
      const start = Math.max(x + 26, -20);
      const end = Math.min(x + p.w - 15, W + 20);
      for (let sx = start; sx < end; sx += 64) {
        ctx.beginPath(); ctx.moveTo(sx, p.y + 10); ctx.lineTo(sx + 9, p.y + 18); ctx.lineTo(sx + 2, p.y + 25); ctx.lineTo(sx - 5, p.y + 18); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }

    function drawOrb(orb: Orb, t: number) {
      if (orb.collected) return; const x = orb.x - cameraX; if (x < -40 || x > W + 40) return; const y = orb.y + Math.sin(orb.phase) * 8;
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      const size = 66 + Math.sin(t * .005 + orb.phase) * 5;
      ctx.drawImage(orbSprite, x - size / 2, y - size / 2, size, size);
      ctx.strokeStyle = "rgba(255,255,220,.82)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 11 + Math.sin(t * .005 + orb.phase) * 2, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }

    function drawBeacons(t: number) {
      for (const checkpoint of activeLevel.checkpoints) {
        const x = checkpoint - cameraX; if (x < -50 || x > W + 50) continue;
        const active = player.checkpoint >= checkpoint;
        ctx.save(); ctx.translate(x, 610); ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = active ? activeLevel.edge : "rgba(150,165,195,.45)"; ctx.fillStyle = active ? activeLevel.edge : "#59647d";
        ctx.globalAlpha = active ? .85 : .38; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -72); ctx.stroke();
        ctx.rotate(t * .0015); ctx.beginPath(); ctx.moveTo(0, -92); ctx.lineTo(13, -78); ctx.lineTo(0, -64); ctx.lineTo(-13, -78); ctx.closePath(); ctx.fill();
        if (active) { ctx.globalAlpha = .18; ctx.beginPath(); ctx.arc(0, -78, 27 + Math.sin(t * .004) * 4, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      }
    }

    function drawWorldObjects(t: number) {
      for (const hazard of activeLevel.hazards) {
        const x = hazard.x - cameraX; if (x + hazard.w < -40 || x > W + 40) continue;
        const enabled = hazard.kind !== "laser" || Math.sin(elapsed * Math.PI * 2 / hazard.period + hazard.phase) > -.15;
        ctx.save(); ctx.shadowBlur = enabled ? 20 : 0; ctx.shadowColor = hazard.kind === "lava" ? "#ff4d2e" : activeLevel.edge;
        if (hazard.kind === "spikes") {
          ctx.fillStyle = enabled ? "#ff668e" : "#53283a";
          for (let sx = x; sx < x + hazard.w; sx += 23) { ctx.beginPath(); ctx.moveTo(sx, hazard.y + hazard.h); ctx.lineTo(sx + 11, hazard.y); ctx.lineTo(sx + 22, hazard.y + hazard.h); ctx.fill(); }
        } else if (hazard.kind === "lava") {
          const gradient = ctx.createLinearGradient(0, hazard.y, 0, hazard.y + hazard.h); gradient.addColorStop(0, "#fff075"); gradient.addColorStop(.3, "#ff6a2f"); gradient.addColorStop(1, "#7b102a"); ctx.fillStyle = gradient; ctx.fillRect(x, hazard.y, hazard.w, hazard.h);
        } else {
          ctx.globalAlpha = enabled ? .85 : .12; ctx.strokeStyle = "#ff4d8d"; ctx.lineWidth = enabled ? 7 : 2; ctx.beginPath(); ctx.moveTo(x + hazard.w / 2, hazard.y); ctx.lineTo(x + hazard.w / 2, hazard.y + hazard.h); ctx.stroke();
        }
        ctx.restore();
      }
      for (const wall of breakables) {
        if (!wall.alive) continue; const x = wall.x - cameraX; if (x + wall.w < -40 || x > W + 40) continue;
        ctx.save(); ctx.fillStyle = wall.secret ? "#271d48" : activeLevel.deep; ctx.strokeStyle = wall.secret ? "#ffe272" : activeLevel.edge; ctx.lineWidth = 3; ctx.globalAlpha = .92; ctx.beginPath(); ctx.roundRect(x, wall.y, wall.w, wall.h, 9); ctx.fill(); ctx.stroke();
        ctx.globalAlpha = .45; ctx.fillStyle = activeLevel.edge; for (let y = wall.y + 15; y < wall.y + wall.h; y += 27) ctx.fillRect(x + 8, y, wall.w - 16, 3); ctx.restore();
      }
      for (const key of keys) {
        if (key.collected) continue; const x = key.x - cameraX; ctx.save(); ctx.translate(x, key.y + Math.sin(t * .004 + key.x) * 7); ctx.rotate(t * .002); ctx.shadowBlur = 24; ctx.shadowColor = "#7effdc"; ctx.fillStyle = "#dfffee"; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(13, 0); ctx.lineTo(0, 16); ctx.lineTo(-13, 0); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      switches.forEach((node, index) => {
        const x = node.x - cameraX; if (x < -60 || x > W + 60) return; ctx.save(); ctx.translate(x, node.y); ctx.strokeStyle = node.active ? "#7effdc" : "#8a6bff"; ctx.fillStyle = node.active ? "#2bcf9b" : "#27194c"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = "white"; ctx.font = "900 13px Inter"; ctx.textAlign = "center"; ctx.fillText(String(index + 1), 0, 5); ctx.restore();
      });
      if (activeLevel.mission.type === "escort") drawDrone(escortX - cameraX, 506, "#6ff8ff", "ALLIÉ");
      if (activeLevel.mission.type === "chase" && !missionExtra.chaseCaught) drawDrone(chaseX - cameraX, 470, "#ffe26e", "CIBLE");
      if (activeLevel.mission.type === "defend") {
        const x = activeLevel.goalX * .53 - cameraX; ctx.save(); ctx.globalAlpha = .18 + Math.sin(t * .006) * .04; ctx.fillStyle = activeLevel.edge; ctx.beginPath(); ctx.ellipse(x, 610, 280, 38, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = .8; ctx.strokeStyle = activeLevel.edge; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
      }
      if (activeLevel.mission.type === "escape") {
        const x = collapseX - cameraX; ctx.save(); const wall = ctx.createLinearGradient(x - 90, 0, x + 80, 0); wall.addColorStop(0, "rgba(255,35,82,0)"); wall.addColorStop(1, "rgba(255,35,82,.72)"); ctx.fillStyle = wall; ctx.fillRect(x - 100, 0, 180, H); ctx.restore();
      }
    }

    function drawDrone(x: number, y: number, color: string, label: string) {
      if (x < -80 || x > W + 80) return; ctx.save(); ctx.translate(x, y); ctx.shadowBlur = 18; ctx.shadowColor = color; ctx.fillStyle = "#0b1229"; ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(-31, -18, 62, 36, 16); ctx.fill(); ctx.stroke(); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill(); ctx.font = "900 9px Inter"; ctx.textAlign = "center"; ctx.fillText(label, 0, -29); ctx.restore();
    }

    function drawProjectile(projectile: Projectile) {
      const x = projectile.x - cameraX; if (x < -60 || x > W + 60) return; ctx.save(); ctx.translate(x + projectile.w / 2, projectile.y + projectile.h / 2); ctx.shadowBlur = 24; ctx.shadowColor = projectile.color; ctx.fillStyle = projectile.color; ctx.globalCompositeOperation = "lighter"; ctx.beginPath(); ctx.arc(0, 0, projectile.w / 2, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = .24; ctx.beginPath(); ctx.arc(0, 0, projectile.w, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }

    function drawEnemy(enemy: Enemy) {
      if (!enemy.alive) return; const x = enemy.x - cameraX; if (x < -100 || x > W + 100) return;
      const filters: Record<EnemyKind, string> = {
        crawler: "none", hopper: "hue-rotate(78deg) saturate(1.35)", flyer: "hue-rotate(185deg) saturate(1.45)",
        charger: "hue-rotate(320deg) saturate(1.55) contrast(1.1)", tank: "grayscale(.45) saturate(1.6) brightness(.82)",
        shooter: "hue-rotate(25deg) saturate(1.7) brightness(1.08)", shielder: "hue-rotate(242deg) saturate(1.4) contrast(1.2)",
        exploder: "hue-rotate(348deg) saturate(2) brightness(1.18)", sentinel: "hue-rotate(164deg) saturate(1.8) brightness(1.12)",
        boss: `hue-rotate(${activeLevel.chapter * 31 + 220}deg) saturate(1.9) contrast(1.18)`,
      };
      ctx.save(); ctx.translate(x + enemy.w / 2, enemy.y + enemy.h / 2 + Math.sin(enemy.phase) * (enemy.kind === "flyer" || enemy.kind === "sentinel" ? 5 : 2));
      if (enemy.kind === "flyer" || enemy.kind === "sentinel") { ctx.strokeStyle = enemy.kind === "sentinel" ? "#66e9ff" : activeLevel.edge; ctx.globalAlpha = .35; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(0, 0, 52, 24, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
      if (enemy.kind === "tank" || enemy.kind === "shielder") { ctx.strokeStyle = enemy.kind === "shielder" ? "#9d8cff" : "#e5ecff"; ctx.globalAlpha = .42; ctx.lineWidth = 7; ctx.beginPath(); ctx.roundRect(-45, -34, 90, 68, 22); ctx.stroke(); ctx.globalAlpha = 1; }
      if (enemy.kind === "shooter") { ctx.strokeStyle = "#ffb06c"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(8, -5); ctx.lineTo(54, -5); ctx.stroke(); }
      if (enemy.kind === "exploder") { ctx.fillStyle = `rgba(255,78,88,${.22 + Math.sin(enemy.phase * 2) * .12})`; ctx.beginPath(); ctx.arc(0, 0, 54, 0, Math.PI * 2); ctx.fill(); }
      if (enemy.vx > 0) ctx.scale(-1, 1);
      ctx.shadowBlur = enemy.kind === "boss" ? 28 : 9; ctx.shadowColor = enemy.kind === "boss" ? activeLevel.edge : "#ff5d29"; ctx.filter = enemy.kind === "boss" ? "none" : filters[enemy.kind];
      const drawW = enemy.kind === "boss" ? 286 : enemy.kind === "tank" || enemy.kind === "shielder" ? 136 : enemy.kind === "charger" || enemy.kind === "exploder" ? 126 : enemy.kind === "flyer" || enemy.kind === "sentinel" ? 110 : 114;
      const drawH = enemy.kind === "boss" ? 184 : enemy.kind === "tank" || enemy.kind === "shielder" ? 83 : enemy.kind === "flyer" || enemy.kind === "sentinel" ? 67 : 70;
      const bossImage = bossImgs[activeLevel.chapter];
      if (enemy.kind === "boss" && bossImage?.complete && bossImage.naturalWidth) ctx.drawImage(bossImage, -drawW / 2, -drawH / 2, drawW, drawH);
      else if (enemyImg.complete && enemyImg.naturalWidth) ctx.drawImage(enemyImg, -drawW / 2, -drawH / 2, drawW, drawH);
      else { ctx.fillStyle = "#111827"; ctx.beginPath(); ctx.roundRect(-enemy.w / 2, -enemy.h / 2, enemy.w, enemy.h, 18); ctx.fill(); ctx.fillStyle = activeLevel.edge; ctx.beginPath(); ctx.arc(-10, -4, 6, 0, Math.PI * 2); ctx.fill(); }
      if (enemy.shield > 0) { ctx.filter = "none"; ctx.strokeStyle = "#d7c4ff"; ctx.lineWidth = 5; ctx.globalAlpha = .72; ctx.beginPath(); ctx.ellipse(0, 0, drawW * .55, drawH * .61, 0, 0, Math.PI * 2); ctx.stroke(); }
      if (enemy.kind === "boss" && enemy.telegraph > 0) { ctx.filter = "none"; ctx.strokeStyle = "#fff1a8"; ctx.lineWidth = 7; ctx.globalAlpha = .55 + Math.sin(enemy.telegraph * 55) * .25; ctx.beginPath(); ctx.arc(0, 0, drawW * (.55 + enemy.telegraph * .18), 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
      if (enemy.maxHp > 1) {
        const barW = enemy.kind === "boss" ? 238 : 74;
        ctx.fillStyle = "rgba(2,3,12,.82)"; ctx.beginPath(); ctx.roundRect(x + enemy.w / 2 - barW / 2, enemy.y - 22, barW, 10, 5); ctx.fill();
        ctx.fillStyle = enemy.kind === "boss" ? activeLevel.edge : "#ff8b68"; ctx.beginPath(); ctx.roundRect(x + enemy.w / 2 - barW / 2 + 2, enemy.y - 20, Math.max(0, (barW - 4) * enemy.hp / enemy.maxHp), 6, 3); ctx.fill();
        if (enemy.kind === "boss") {
          const phase = enemy.hp <= enemy.maxHp / 3 ? 3 : enemy.hp <= enemy.maxHp * 2 / 3 ? 2 : 1;
          ctx.fillStyle = phase === 3 ? "#ff6b9e" : "rgba(255,255,255,.86)"; ctx.font = "900 12px Inter, sans-serif"; ctx.textAlign = "center";
          ctx.fillText(`${enemy.bossName ?? "BOSS"} · PHASE ${phase}/3`, x + enemy.w / 2, enemy.y - 30);
        }
      }
    }

    function drawShockwave(wave: Shockwave, t: number) {
      const x = wave.x - cameraX; if (x < -90 || x > W + 90) return;
      ctx.save(); ctx.translate(x, wave.y); ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = wave.color; ctx.fillStyle = wave.color;
      ctx.globalAlpha = .18; ctx.beginPath(); ctx.ellipse(0, 0, 42 + Math.sin(t * .018) * 7, 15, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = .86; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-30, 5); ctx.lineTo(0, -25); ctx.lineTo(30, 5); ctx.stroke(); ctx.restore();
    }

    function drawPlayer(t: number) {
      const x = player.x - cameraX;
      const airborne = !player.grounded;
      const speed = Math.abs(player.vx);
      const walkSequence = [2, 3, 4, 3];
      const runSequence = [5, 6, 7, 6];
      let frame = 0;
      if (airborne) frame = 6;
      else if (speed < 18) frame = Math.floor(t / 420) % 2;
      else if (speed < 260) frame = walkSequence[Math.floor(player.runPhase / 1.55) % walkSequence.length];
      else frame = runSequence[Math.floor(player.runPhase / 1.35) % runSequence.length];
      const drawHeroFrame = (frameIndex: number, size = 128) => {
        if (heroSheet.complete && heroSheet.naturalWidth) {
          ctx.drawImage(heroSheet, frameIndex * 256, 0, 256, 256, -size / 2, -68, size, size);
        } else if (heroFallback.complete && heroFallback.naturalWidth) {
          ctx.drawImage(heroFallback, -56, -65, 112, 128);
        }
      };
      const bob = player.grounded ? (speed < 18 ? Math.sin(t * .004) * 1.2 : Math.sin(player.runPhase * 1.7) * 1.7) : 0;
      const lean = Math.max(-0.07, Math.min(0.07, player.vx / 4200));
      if (player.dashTime > 0) for (let i = 1; i <= 4; i++) { ctx.save(); ctx.globalAlpha = (5 - i) * 0.055; ctx.translate(x + player.w / 2 - player.facing * i * 20, player.y + player.h / 2); ctx.scale(player.facing, 1); drawHeroFrame(frame, 128); ctx.restore(); }
      ctx.save(); ctx.translate(x + player.w / 2, player.y + player.h / 2 + bob); ctx.rotate(airborne ? Math.sin(t * 0.008) * 0.035 : lean); ctx.scale(player.facing, 1); ctx.shadowBlur = player.dashTime > 0 ? 18 : 8; ctx.shadowColor = player.dashTime > 0 ? "#6dffff" : "rgba(128,84,255,.8)";
      if (player.invulnerable > 0 && Math.floor(t / 90) % 2) ctx.globalAlpha = 0.25;
      ctx.filter = SKINS[skinRef.current].filter;
      if ((heroSheet.complete && heroSheet.naturalWidth) || (heroFallback.complete && heroFallback.naturalWidth)) drawHeroFrame(frame, 128);
      else { const g = ctx.createLinearGradient(-20, -40, 25, 38); g.addColorStop(0, "#79f7ff"); g.addColorStop(1, "#8e4dff"); ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-25, -42, 50, 78, 20); ctx.fill(); ctx.fillStyle = "#faffff"; ctx.fillRect(5, -24, 15, 6); }
      ctx.restore();
      if (player.attackTime > 0) {
        ctx.save(); ctx.translate(x + player.w / 2, player.y + 40); ctx.scale(player.facing, 1); ctx.strokeStyle = player.heavyAttack ? "#ffe16b" : SKINS[skinRef.current].color; ctx.shadowBlur = player.heavyAttack ? 28 : 16; ctx.shadowColor = ctx.strokeStyle; ctx.lineWidth = player.heavyAttack ? 10 : 6; ctx.globalAlpha = Math.min(1, player.attackTime * 5); ctx.beginPath(); ctx.arc(6, 0, player.heavyAttack ? 112 : 78, -.95, .95); ctx.stroke(); ctx.restore();
      }
      if (player.specialTime > 0) { ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = SKINS[skinRef.current].color; ctx.lineWidth = 8; ctx.globalAlpha = player.specialTime; ctx.beginPath(); ctx.arc(x + player.w / 2, player.y + player.h / 2, (1 - player.specialTime / .7) * 520, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    }

    function drawPortal(t: number) {
      const x = activeLevel.goalX + 70 - cameraX; if (x < -120 || x > W + 120) return;
      const ready = missionSnapshot(activeLevel, collected, defeated, beacons, elapsed, getBoss(), missionExtra).complete;
      const color = ready ? activeLevel.edge : "#ff4d8d";
      ctx.save(); ctx.translate(x, 505); ctx.globalCompositeOperation = "lighter";
      for (let i = 4; i > 0; i--) { ctx.strokeStyle = color; ctx.globalAlpha = .12 + i * .12; ctx.lineWidth = 4 + i * 4; ctx.beginPath(); ctx.ellipse(0, 0, 42 + i * 3 + Math.sin(t * .003) * 3, 84 + i * 2, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.globalAlpha = .1; ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, 0, 38, 80, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = .9; ctx.fillStyle = color; ctx.font = "900 11px Inter, sans-serif"; ctx.textAlign = "center"; ctx.fillText(ready ? "PORTAIL ACTIF" : "MISSION REQUISE", 0, -104); ctx.restore();
    }

    function render(t: number) {
      ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0); ctx.clearRect(0, 0, W, H); ctx.save();
      if (shake > 0.2) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      drawBackground(); drawAtmosphere(t); for (const p of runtimePlatforms) drawPlatform(p); for (const p of movingPlatforms) drawPlatform(p); drawWorldObjects(t); drawBeacons(t); drawPortal(t); for (const orb of orbs) drawOrb(orb, t); for (const projectile of projectiles) drawProjectile(projectile); for (const wave of shockwaves) drawShockwave(wave, t); for (const enemy of enemies) drawEnemy(enemy); drawPlayer(t);
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / p.maxLife); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x - cameraX, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore(); ctx.restore();
      ctx.drawImage(vignetteLayer, 0, 0);
    }

    function loop(now: number) {
      const frameMs = now - last;
      const minimumFrame = statusRef.current === "playing" ? 14 : 30;
      if (frameMs < minimumFrame) { raf = requestAnimationFrame(loop); return; }
      const dt = Math.min(.033, frameMs / 1000 || 0); last = now; update(dt); render(now); raf = requestAnimationFrame(loop);
    }
    reset(); raf = requestAnimationFrame(loop);

    const onKeyDown = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space", "KeyJ", "KeyC", "KeyK", "KeyV"].includes(e.code)) e.preventDefault();
      if (e.code === "ArrowLeft" || e.code === "KeyA" || e.code === "KeyQ") input.current.left = true;
      if (e.code === "ArrowRight" || e.code === "KeyD") input.current.right = true;
      if (e.code === "ArrowUp" || e.code === "Space" || e.code === "KeyW" || e.code === "KeyZ") input.current.jump = true;
      if (e.code === "ShiftLeft" || e.code === "ShiftRight" || e.code === "KeyX") input.current.dash = true;
      if (e.code === "KeyJ" || e.code === "KeyC") input.current.attack = true;
      if (e.code === "KeyK" || e.code === "KeyV") input.current.special = true;
      if (e.code === "Escape" && statusRef.current === "playing") changeStatus("paused"); else if (e.code === "Escape" && statusRef.current === "paused") changeStatus("playing");
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA" || e.code === "KeyQ") input.current.left = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") input.current.right = false;
      if (e.code === "ArrowUp" || e.code === "Space" || e.code === "KeyW" || e.code === "KeyZ") input.current.jump = false;
      if (e.code === "ShiftLeft" || e.code === "ShiftRight" || e.code === "KeyX") input.current.dash = false;
      if (e.code === "KeyJ" || e.code === "KeyC") input.current.attack = false;
      if (e.code === "KeyK" || e.code === "KeyV") input.current.special = false;
    };
    window.addEventListener("keydown", onKeyDown, { passive: false }); window.addEventListener("keyup", onKeyUp);
    return () => {
      cancelAnimationFrame(raf); resizeObserver?.disconnect();
      worldImgs.forEach((image, chapter) => image.removeEventListener("load", worldLoadHandlers[chapter]));
      window.removeEventListener("resize", resize); window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp);
      delete (window as GameWindow).startCr3atixGame; delete (window as GameWindow).restartCr3atixGame; delete (window as GameWindow).nextCr3atixLevel;
    };
  }, [changeStatus, tone]);

  const press = (key: InputKey, active: boolean) => { input.current[key] = active; };
  const beginPress = (key: InputKey, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault(); event.currentTarget.setPointerCapture?.(event.pointerId); press(key, true);
  };
  const endPress = (key: InputKey, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault(); press(key, false);
  };
  type GameWindow = typeof window & { startCr3atixGame?: (level?: number) => void; restartCr3atixGame?: () => void; nextCr3atixLevel?: (fromLevel?: number) => number };
  const start = () => (window as GameWindow).startCr3atixGame?.(selectedLevel);
  const restart = () => (window as GameWindow).restartCr3atixGame?.();
  const nextLevel = () => (window as GameWindow).nextCr3atixLevel?.(hud.level);
  const enterFight = () => {
    audioRef.current?.resume();
    changeStatus("playing");
    tone(92, .34, "sawtooth", .07);
    setTimeout(() => tone(138, .22, "square", .045), 130);
  };
  const togglePause = () => {
    if (statusRef.current === "playing") changeStatus("paused");
    else if (statusRef.current === "paused") changeStatus("playing");
  };
  const returnToMenu = (tab: MenuTab = "play") => {
    input.current = { left: false, right: false, jump: false, dash: false, attack: false, special: false };
    setSelectedLevel(hud.level);
    setMenuTab(tab);
    changeStatus("menu");
  };
  const moveSelection = (direction: number) => setSelectedLevel(current => Math.max(0, Math.min(Math.min(LEVELS.length - 1, unlocked - 1), current + direction)));
  const chooseChapter = (chapter: number) => setSelectedLevel(Math.min(chapter * 11, Math.max(0, unlocked - 1)));
  const chooseDifficulty = (next: Difficulty) => { setDifficulty(next); difficultyRef.current = next; localStorage.setItem("cr3atix-difficulty", next); };
  const toggleSound = () => setMuted(current => { const next = !current; localStorage.setItem("cr3atix-muted", next ? "1" : "0"); return next; });
  const buyUpgrade = (key: keyof Upgrades) => {
    const level = upgrades[key]; const cost = 120 * (level + 1); if (level >= 3 || credits < cost) return;
    const next = { ...upgrades, [key]: level + 1 }; const balance = credits - cost;
    setUpgrades(next); upgradesRef.current = next; setCredits(balance); creditsRef.current = balance;
    localStorage.setItem("cr3atix-upgrades", JSON.stringify(next)); localStorage.setItem("cr3atix-credits", String(balance)); tone(740, .16, "triangle", .045);
  };
  const chooseSkin = (index: number) => { setSkin(index); skinRef.current = index; localStorage.setItem("cr3atix-skin", String(index)); };
  const installApplication = async () => {
    if (isInstalled) return;
    if (!installPrompt) {
      setInstallMessage("Dans Chrome, touche ⋮ puis « Installer l’application » ou « Ajouter à l’écran d’accueil ».");
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    setInstallMessage(choice.outcome === "accepted" ? "INSTALLATION EN COURS…" : "INSTALLATION ANNULÉE");
  };
  const checkForUpdateNow = async () => {
    if (!("serviceWorker" in navigator)) {
      setUpdateMessage("AUTO-UPDATE NON PRIS EN CHARGE");
      return;
    }
    setCheckingUpdate(true);
    setUpdateMessage("RECHERCHE D’UNE NOUVELLE VERSION…");
    try {
      const registration = serviceWorkerRegistrationRef.current ?? await navigator.serviceWorker.getRegistration();
      if (!registration) {
        setUpdateMessage("AUTO-UPDATE EN COURS D’INITIALISATION");
        return;
      }
      serviceWorkerRegistrationRef.current = registration;
      await registration.update();
      if (registration.waiting) {
        setUpdateMessage("NOUVELLE VERSION TROUVÉE · INSTALLATION…");
        registration.waiting.postMessage({ type: "CR3ATIX_SKIP_WAITING" });
      } else {
        setUpdateMessage(`À JOUR · V${APP_VERSION}`);
      }
    } catch {
      setUpdateMessage(navigator.onLine ? "VÉRIFICATION IMPOSSIBLE · RÉESSAIE" : "HORS LIGNE · NOUVEL ESSAI AUTOMATIQUE");
    } finally {
      setCheckingUpdate(false);
    }
  };
  const selected = LEVELS[selectedLevel];
  const selectedRecord = progressRecords[String(selectedLevel)];
  const wonRecord = progressRecords[String(hud.level)];
  const earnedStars = totalStars(progressRecords);
  const completedLevels = Object.values(progressRecords).filter(record => record.wins > 0).length;
  const worldsUnlocked = Math.min(10, Math.floor((Math.max(1, unlocked) - 1) / 11) + 1);
  const fullscreen = async () => {
    const orientation = window.screen.orientation as ScreenOrientation & {
      lock?: (mode: "landscape") => Promise<void>;
      unlock?: () => void;
    };

    if (!document.fullscreenElement) {
      try { await wrapRef.current?.requestFullscreen(); } catch { /* facultatif */ }
      try { await orientation?.lock?.("landscape"); } catch { /* non pris en charge sur tous les navigateurs */ }
      return;
    }

    try { orientation?.unlock?.(); } catch { /* facultatif */ }
    try { await document.exitFullscreen(); } catch { /* facultatif */ }
  };

  return (
    <main className="game-page">
      <section className={`game-shell ${status === "menu" ? "menu-open" : ""}`} ref={wrapRef} aria-label="CR3@TIX ADVENTURE">
        <header className="game-topbar">
          <div className="brand-lockup"><span className="brand-mark">C</span><div><strong>CR3@TIX</strong><small>ADVENTURE // {LEVELS[hud.level].code}</small></div></div>
          <div className="hud" aria-live="polite">
            <div><span>NIVEAU</span><strong>{hud.level + 1}/{LEVELS.length}</strong></div>
            <div className={hud.missionDone ? "mission-complete" : ""}><span>{hud.missionLabel}</span><strong>{hud.missionValue}</strong></div>
            <div><span>ÉNERGIE</span><strong>{hud.energy}%{hud.combo > 1 ? ` · ×${hud.combo}` : ""}</strong></div>
            <div><span>SCORE</span><strong>{String(hud.score).padStart(6, "0")}</strong></div>
            <div><span>VIES</span><strong>{"◆".repeat(Math.max(0, hud.lives))}</strong></div>
          </div>
          <div className="top-actions">
            {status !== "menu" && <button className="back-menu-button" onClick={() => returnToMenu("play")} aria-label="Retourner au menu principal">← MENU</button>}
            <button className="sound-button" onClick={toggleSound} aria-label={muted ? "Activer le son" : "Couper le son"}>{muted ? "SON OFF" : "SON ON"}</button>
            <button className="pause-button" onClick={togglePause} disabled={status !== "playing" && status !== "paused"} aria-label="Pause">{status === "paused" ? "REPRENDRE" : "PAUSE"}</button>
            <button className="fullscreen-button" onClick={fullscreen} aria-label="Activer le mode paysage plein écran">PAYSAGE</button>
          </div>
        </header>
        <div className="progress-track"><span style={{ width: `${hud.distance}%` }} /></div>
        <div className="canvas-wrap">
          <canvas ref={canvasRef} width={W} height={H} aria-label="Zone de jeu" />
          {status !== "playing" && <div className={`game-overlay ${status === "menu" ? "main-menu-overlay" : ""}`}>
            {status === "menu" && <div className="mobile-game-menu">
              <header className="mobile-menu-header">
                <div className="mobile-menu-brand"><span className="mobile-menu-logo">C</span><div><small>VERSION 18 · ANDROID FIX</small><strong>CR3@TIX ADVENTURE</strong></div></div>
                <div className="credit-wallet"><span>◆</span><strong>{credits}</strong><small>CRÉDITS</small></div>
              </header>

              <div className="mobile-menu-content">
                {menuTab === "play" && <section className="menu-panel play-panel" aria-label="Jouer">
                  <div className="menu-title-row"><div><span>CAMPAGNE</span><h2>CHOISIS TA MISSION</h2></div><strong>{unlocked}/{LEVELS.length}</strong></div>
                  <div className="mission-card">
                    <div className="mission-card-top"><span>{selected.isBoss ? `BOSS · MONDE ${selected.chapter + 1}` : `MONDE ${selected.chapter + 1} · ${selected.mission.label}`}</span><strong>{selected.code}</strong></div>
                    <div className="level-selector" aria-label="Choix du niveau">
                      <button onClick={() => moveSelection(-1)} disabled={selectedLevel === 0} aria-label="Niveau précédent">‹</button>
                      <div><span>NIVEAU ACTUEL</span><strong>{selectedLevel + 1} <small>/ {LEVELS.length}</small></strong><small>{selected.name}</small></div>
                      <button onClick={() => moveSelection(1)} disabled={selectedLevel >= Math.min(LEVELS.length - 1, unlocked - 1)} aria-label="Niveau suivant">›</button>
                    </div>
                    <p>{selected.description}</p>
                    <div className="mission-mastery" aria-label="Maîtrise du niveau">
                      <span><b>{selectedRecord ? "★".repeat(selectedRecord.stars) + "☆".repeat(3 - selectedRecord.stars) : "☆☆☆"}</b> MAÎTRISE</span>
                      <span><b>{selectedRecord?.bestScore ?? 0}</b> MEILLEUR SCORE</span>
                      <span><b>{selectedRecord?.bestTime ? `${selectedRecord.bestTime.toFixed(1)}s` : "—"}</b> MEILLEUR TEMPS</span>
                    </div>
                    <button className="mobile-play-button" onClick={start}><span>▶</span><div><small>{selected.isBoss ? "COMBAT SPÉCIAL" : "MISSION SÉLECTIONNÉE"}</small><strong>JOUER MAINTENANT</strong></div></button>
                  </div>
                  <div className="world-strip" aria-label="Choix du monde">
                    {Array.from({ length: 10 }, (_, chapter) => {
                      const locked = chapter * 11 >= unlocked;
                      return <button key={chapter} className={selected.chapter === chapter ? "active" : ""} disabled={locked} onClick={() => chooseChapter(chapter)}><small>MONDE</small><strong>{locked ? "◆" : chapter + 1}</strong></button>;
                    })}
                  </div>
                  <div className="menu-quick-stats"><span><strong>{completedLevels}/110</strong>TERMINÉS</span><span><strong>{earnedStars}/330 ★</strong>MAÎTRISE</span><span><strong>{DIFFICULTIES[difficulty].label}</strong>DIFFICULTÉ</span></div>
                </section>}

                {menuTab === "gear" && <section className="menu-panel gear-panel" aria-label="Équipement">
                  <div className="menu-title-row"><div><span>ATELIER</span><h2>AMÉLIORE TON HÉROS</h2></div><strong>{credits} CR</strong></div>
                  <div className="upgrade-shop" aria-label="Améliorations">
                    {(["vitality", "jump", "attack", "dash"] as const).map(key => {
                      const labels = { vitality: "VIES", jump: "SAUT", attack: "ATTAQUE", dash: "DASH" }; const icons = { vitality: "♥", jump: "↟", attack: "⚔", dash: "»" }; const level = upgrades[key]; const cost = 120 * (level + 1);
                      return <button key={key} disabled={level >= 3 || credits < cost} onClick={() => buyUpgrade(key)}><b>{icons[key]}</b><span>{labels[key]}<em>{"◆".repeat(level)}{"◇".repeat(3 - level)}</em></span><small>{level >= 3 ? "NIVEAU MAX" : `${cost} CR`}</small></button>;
                    })}
                  </div>
                  <div className="skin-section"><div><span>APPARENCE</span><small>Débloque des styles en avançant dans la campagne.</small></div><div className="skin-picker" aria-label="Apparence du personnage">
                    {SKINS.map((item, index) => <button key={item.name} className={skin === index ? "active" : ""} disabled={worldsUnlocked < item.unlock} onClick={() => chooseSkin(index)} style={{ "--skin-color": item.color } as React.CSSProperties}><i /><span>{worldsUnlocked < item.unlock ? `MONDE ${item.unlock}` : item.name}</span></button>)}
                  </div></div>
                </section>}

                {menuTab === "options" && <section className="menu-panel options-panel" aria-label="Options">
                  <div className="menu-title-row"><div><span>PARAMÈTRES</span><h2>RÈGLE TON EXPÉRIENCE</h2></div></div>
                  <div className="option-block"><div><strong>DIFFICULTÉ</strong><small>Modifie la résistance, la vitesse et les récompenses.</small></div><div className="difficulty-picker" aria-label="Difficulté">
                    {(Object.keys(DIFFICULTIES) as Difficulty[]).map(mode => <button key={mode} className={difficulty === mode ? "active" : ""} onClick={() => chooseDifficulty(mode)}>{DIFFICULTIES[mode].label}</button>)}
                  </div></div>
                  <div className="option-actions"><button onClick={toggleSound}><span>{muted ? "◌" : "♪"}</span><div><strong>SON</strong><small>{muted ? "DÉSACTIVÉ" : "ACTIVÉ"}</small></div></button><button onClick={fullscreen}><span>↔</span><div><strong>PLEIN ÉCRAN</strong><small>MODE PAYSAGE</small></div></button></div>
                  <div className={`android-install-card ${isInstalled ? "installed" : ""}`}>
                    <span className="android-install-icon">↓</span>
                    <div><strong>{isInstalled ? "APPLICATION INSTALLÉE" : "INSTALLER SUR ANDROID"}</strong><small>{isInstalled ? "Prête depuis ton écran d’accueil" : "Plein écran · icône · progression locale"}</small></div>
                    <button onClick={installApplication} disabled={isInstalled}>{isInstalled ? "INSTALLÉE" : installPrompt ? "INSTALLER" : "COMMENT FAIRE"}</button>
                    {installMessage && <p role="status">{installMessage}</p>}
                  </div>
                  <div className="android-install-card auto-update-card">
                    <span className="android-install-icon">↻</span>
                    <div><strong>MISES À JOUR AUTOMATIQUES</strong><small role="status" aria-live="polite">{updateMessage}</small></div>
                    <button onClick={checkForUpdateNow} disabled={checkingUpdate}>{checkingUpdate ? "VÉRIFICATION…" : "VÉRIFIER"}</button>
                  </div>
                  <div className="control-guide"><span><b>← →</b> BOUGER</span><span><b>SAUT</b> DOUBLE SAUT</span><span><b>DASH</b> ESQUIVE</span><span><b>ATQ</b> MAINTENIR = CHARGE</span><span><b>ULT</b> POUVOIR SPÉCIAL</span></div>
                </section>}
              </div>

              <nav className="mobile-menu-nav" aria-label="Menu principal">
                <button className={menuTab === "play" ? "active" : ""} onClick={() => setMenuTab("play")}><span>▶</span><strong>JOUER</strong></button>
                <button className={menuTab === "gear" ? "active" : ""} onClick={() => setMenuTab("gear")}><span>◆</span><strong>ÉQUIPEMENT</strong></button>
                <button className={menuTab === "options" ? "active" : ""} onClick={() => setMenuTab("options")}><span>⚙</span><strong>OPTIONS</strong></button>
              </nav>
            </div>}
            {status === "paused" && <div className="overlay-card compact-card"><p className="eyebrow">MISSION SUSPENDUE</p><h2>PAUSE</h2><div className="overlay-actions"><button className="primary-cta" onClick={() => changeStatus("playing")}>REPRENDRE</button><button className="secondary-cta" onClick={() => returnToMenu("gear")}>ÉQUIPEMENT</button></div></div>}
            {status === "chapterintro" && <div className="overlay-card compact-card chapter-card"><p className="eyebrow">NOUVEAU MONDE · {LEVELS[hud.level].chapter + 1}/10</p><h2>{LEVELS[hud.level].name.split(" · ")[0]}</h2><p>Nouveau décor, nouvelle musique et dix missions inédites. Adapte ton équipement avant d’affronter le gardien.</p><button className="primary-cta" onClick={enterFight}>ENTRER DANS LE MONDE</button></div>}
            {status === "bossintro" && <div className="overlay-card compact-card boss-intro-card">
              <p className="eyebrow">ALERTE BOSS · MONDE {LEVELS[hud.level].chapter + 1}</p>
              <span className="boss-level-badge">NIVEAU SPÉCIAL {LEVELS[hud.level].chapter + 1}/10</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="boss-preview" src={assetUrl(BOSS_SPRITES[LEVELS[hud.level].chapter])} alt="" width={250} height={118} />
              <h2>{LEVELS[hud.level].bossName}</h2>
              <p>Trois phases, attaques propres à ce gardien et arène évolutive. Observe, esquive, contre-attaque.</p>
              <div className="boss-intro-stats"><span>DANGER</span><strong>3 PHASES + POUVOIR UNIQUE</strong><span>BASE PV</span><strong>{LEVELS[hud.level].enemies.find(enemy => enemy.kind === "boss")?.hp ?? 1}</strong></div>
              <button className="primary-cta boss-cta" onClick={enterFight}>AFFRONTER LE BOSS</button>
            </div>}
            {status === "won" && <div className="overlay-card compact-card success-card"><p className="eyebrow">PORTAIL STABILISÉ</p><h2>{hud.level === LEVELS.length - 1 ? "CAMPAGNE TERMINÉE" : LEVELS[hud.level].isBoss ? "BOSS VAINCU" : "NIVEAU RÉUSSI"}</h2><div className="victory-stars" aria-label={`${wonRecord?.stars ?? 1} étoiles`}>{"★".repeat(wonRecord?.stars ?? 1)}{"☆".repeat(3 - (wonRecord?.stars ?? 1))}</div><p>Mission <strong>{hud.missionValue}</strong> · Score <strong>{hud.score}</strong> · Crédits <strong>{credits}</strong></p><div className="overlay-actions"><button className="primary-cta" onClick={nextLevel}>{hud.level === LEVELS.length - 1 ? "RECOMMENCER" : "NIVEAU SUIVANT"}</button><button className="secondary-cta" onClick={() => returnToMenu("gear")}>AMÉLIORATIONS</button></div></div>}
            {status === "gameover" && <div className="overlay-card compact-card danger-card"><p className="eyebrow">SIGNAL PERDU</p><h2>MISSION ÉCHOUÉE</h2><p>Score <strong>{hud.score}</strong> · Record <strong>{hud.best}</strong></p><div className="overlay-actions"><button className="primary-cta" onClick={restart}>RÉESSAYER</button><button className="secondary-cta" onClick={() => returnToMenu("gear")}>ÉQUIPEMENT</button></div></div>}
          </div>}
          <div className="mobile-controls" aria-label="Commandes tactiles">
            <div className="move-controls">
              <button aria-label="Aller à gauche" onPointerDown={event => beginPress("left", event)} onPointerUp={event => endPress("left", event)} onPointerCancel={event => endPress("left", event)}>‹</button>
              <button aria-label="Aller à droite" onPointerDown={event => beginPress("right", event)} onPointerUp={event => endPress("right", event)} onPointerCancel={event => endPress("right", event)}>›</button>
            </div>
            <div className="action-controls">
              <button className="attack-btn" aria-label="Attaquer, maintenir pour charger" onPointerDown={event => beginPress("attack", event)} onPointerUp={event => endPress("attack", event)} onPointerCancel={event => endPress("attack", event)}>ATQ</button>
              <button className={`special-btn ${hud.energy >= 100 ? "ready" : ""}`} aria-label="Pouvoir spécial" onPointerDown={event => beginPress("special", event)} onPointerUp={event => endPress("special", event)} onPointerCancel={event => endPress("special", event)}>ULT</button>
              <button className="dash-btn" aria-label="Dash" onPointerDown={event => beginPress("dash", event)} onPointerUp={event => endPress("dash", event)} onPointerCancel={event => endPress("dash", event)}>DASH</button>
              <button className="jump-btn" aria-label="Sauter" onPointerDown={event => beginPress("jump", event)} onPointerUp={event => endPress("jump", event)} onPointerCancel={event => endPress("jump", event)}>SAUT</button>
            </div>
          </div>
        </div>
        <footer className="game-footer"><span>{LEVELS[hud.level].name} · {LEVELS[hud.level].mission.description}</span><span>MEILLEUR SCORE {hud.best}</span></footer>
      </section>
    </main>
  );
}
