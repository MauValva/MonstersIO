import type { Point } from "../game/types";
import { PLAYABLE_BOUNDS } from "./game-config";

export type LogicalRegion = "TL" | "TC" | "TR" | "ML" | "MC" | "MR" | "BL" | "BC" | "BR";

export const LEVEL_DESIGN_CONFIG = {
  powerUpRegions: ["TL", "TC", "TR", "ML", "MR", "BL", "BR"] as LogicalRegion[],
  fugitiveRegions: ["ML", "MC", "MR"] as LogicalRegion[],
  goldMineRegions: ["TL", "TR", "BL", "BR"] as LogicalRegion[],
  contextualPowerUp: {
    minimumCarriedEggs: 5,
    minimumDelay: 1.2,
  },
  enemyContest: {
    maximumDistance: 1450,
  },
  formations: {
    magnet: { count: 8, radius: 170 },
    range: { count: 8, radius: 330 },
  },
} as const;

export function getLogicalRegion(point: Point): LogicalRegion {
  const width = PLAYABLE_BOUNDS.right - PLAYABLE_BOUNDS.left;
  const height = PLAYABLE_BOUNDS.bottom - PLAYABLE_BOUNDS.top;
  const column = Math.max(0, Math.min(2, Math.floor(((point.x - PLAYABLE_BOUNDS.left) / width) * 3)));
  const row = Math.max(0, Math.min(2, Math.floor(((point.y - PLAYABLE_BOUNDS.top) / height) * 3)));
  return ([
    ["TL", "TC", "TR"],
    ["ML", "MC", "MR"],
    ["BL", "BC", "BR"],
  ] as const)[row][column];
}

export function getLogicalRegionBounds(region: LogicalRegion) {
  const columns = { TL: 0, TC: 1, TR: 2, ML: 0, MC: 1, MR: 2, BL: 0, BC: 1, BR: 2 } as const;
  const rows = { TL: 0, TC: 0, TR: 0, ML: 1, MC: 1, MR: 1, BL: 2, BC: 2, BR: 2 } as const;
  const width = (PLAYABLE_BOUNDS.right - PLAYABLE_BOUNDS.left) / 3;
  const height = (PLAYABLE_BOUNDS.bottom - PLAYABLE_BOUNDS.top) / 3;
  return {
    left: PLAYABLE_BOUNDS.left + columns[region] * width,
    right: PLAYABLE_BOUNDS.left + (columns[region] + 1) * width,
    top: PLAYABLE_BOUNDS.top + rows[region] * height,
    bottom: PLAYABLE_BOUNDS.top + (rows[region] + 1) * height,
  };
}

export function isAllowedLogicalRegion(point: Point, allowed: readonly LogicalRegion[]) {
  return allowed.includes(getLogicalRegion(point));
}
