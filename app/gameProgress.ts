export type LevelRecord = {
  wins: number;
  bestScore: number;
  bestTime: number;
  stars: number;
};

export type ProgressRecords = Record<string, LevelRecord>;

const PROGRESS_KEY = "cr3atix-progress-v16";

export function calculateStars(lives: number, elapsed: number, parTime: number) {
  return 1 + (lives >= 2 ? 1 : 0) + (elapsed <= parTime ? 1 : 0);
}

export function loadProgress(storage: Pick<Storage, "getItem"> | null = typeof localStorage === "undefined" ? null : localStorage): ProgressRecords {
  if (!storage) return {};
  try {
    const parsed = JSON.parse(storage.getItem(PROGRESS_KEY) || "{}") as ProgressRecords;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveLevelResult(
  levelIndex: number,
  score: number,
  elapsed: number,
  lives: number,
  parTime: number,
  storage: Pick<Storage, "getItem" | "setItem"> | null = typeof localStorage === "undefined" ? null : localStorage,
) {
  const records = loadProgress(storage);
  const key = String(levelIndex);
  const previous = records[key];
  const stars = calculateStars(lives, elapsed, parTime);
  records[key] = {
    wins: (previous?.wins ?? 0) + 1,
    bestScore: Math.max(previous?.bestScore ?? 0, score),
    bestTime: previous?.bestTime ? Math.min(previous.bestTime, elapsed) : elapsed,
    stars: Math.max(previous?.stars ?? 0, stars),
  };
  storage?.setItem(PROGRESS_KEY, JSON.stringify(records));
  return records;
}

export function totalStars(records: ProgressRecords) {
  return Object.values(records).reduce((total, record) => total + Math.max(0, Math.min(3, record.stars || 0)), 0);
}

