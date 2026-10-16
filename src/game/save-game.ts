import type { LevelId } from "../levels/level-types";
import type { ProgressionState } from "../systems/progression/progression-system";

const SAVE_KEY = "monster-io-pixi.save.v1";

export type WorldSaveState = {
  delivered: number;
  globalDelivered: number;
  stageIndex: number;
  progressionState: ProgressionState;
  player: { x: number; y: number };
  carried: number;
  playerCollected: number;
  currency: number;
  upgradePoints: number;
  upgrades: { speed: number; pickupRadius: number };
};

export type GameSaveState = {
  version: 1;
  activeWorld: LevelId;
  completedWorlds: LevelId[];
  worlds: Partial<Record<LevelId, WorldSaveState>>;
};

function isLevelId(value: unknown): value is LevelId {
  return value === "grass-world" || value === "water-world";
}

function finite(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function loadGameSave(): GameSaveState | null {
  try {
    const raw = globalThis.localStorage?.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GameSaveState>;
    if (parsed.version !== 1 || !isLevelId(parsed.activeWorld)) return null;
    const completedWorlds = Array.isArray(parsed.completedWorlds)
      ? parsed.completedWorlds.filter(isLevelId)
      : [];
    return {
      version: 1,
      activeWorld: parsed.activeWorld,
      completedWorlds,
      worlds: parsed.worlds ?? {},
    };
  } catch {
    return null;
  }
}

export function saveGameState(save: GameSaveState) {
  try {
    globalThis.localStorage?.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage can be unavailable in private browsing or when full.
  }
}

export function normalizeWorldSave(value: unknown): WorldSaveState | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<WorldSaveState>;
  const player = candidate.player;
  const upgrades = candidate.upgrades;
  if (!player || !upgrades) return null;
  const allowedStates: ProgressionState[] = [
    "EVOLVING", "PORTAL_ACTIVE", "PORTAL_COMPLETED", "TRANSITIONING", "WORLD_COMPLETED",
  ];
  return {
    delivered: Math.max(0, finite(candidate.delivered)),
    globalDelivered: Math.max(0, finite(candidate.globalDelivered)),
    stageIndex: Math.max(0, Math.floor(finite(candidate.stageIndex))),
    progressionState: allowedStates.includes(candidate.progressionState as ProgressionState)
      ? candidate.progressionState as ProgressionState
      : "EVOLVING",
    player: { x: finite(player.x, 3000), y: finite(player.y, 3300) },
    carried: Math.max(0, Math.floor(finite(candidate.carried))),
    playerCollected: Math.max(0, Math.floor(finite(candidate.playerCollected))),
    currency: Math.max(0, Math.floor(finite(candidate.currency))),
    upgradePoints: Math.max(0, Math.floor(finite(candidate.upgradePoints))),
    upgrades: {
      speed: Math.max(280, finite(upgrades.speed, 280)),
      pickupRadius: Math.max(92, finite(upgrades.pickupRadius, 92)),
    },
  };
}
