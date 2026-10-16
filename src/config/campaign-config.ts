import type { LevelId } from "../levels/level-types";

/** Development-only switch for quickly testing a specific initial Scene. */
export const START_IN_WATER_WORLD = false;

/**
 * The campaign order is the only place that defines world sequencing.
 * Keep this list limited to implemented, registered Levels.
 */
export const CAMPAIGN_CONFIG = {
  worldOrder: ["grass-world", "water-world"],
} as const satisfies { worldOrder: readonly LevelId[] };
