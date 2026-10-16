import type { Point } from "../game/types";
import type { LevelId } from "./level-types";
import type { LogicalRegion } from "../config/level-design-config";
import type { EggSpawnZone, OpportunitySpawnZone } from "../config/game-config";
import type { PacingDirectorConfig } from "../systems/pacing/pacing-director";

export type LevelDesignPowerUpType = "Speed" | "Range" | "Magnet" | "Orbit";

export type WorldRivalLayout = {
  bases: readonly Point[];
  enemies: readonly Point[];
};

export type WorldLevelDesignConfig = {
  worldId: LevelId;
  hideouts?: readonly Point[];
  player: {
    initialPosition: Point;
  };
  rivals: WorldRivalLayout;
  eggs: {
    initialPositions: readonly Point[];
    postFirstEvolutionPositions: readonly Point[];
    spawnZones: readonly EggSpawnZone[];
  };
  powerUps: {
    enabledTypes: readonly LevelDesignPowerUpType[];
    allowedRegions: readonly LogicalRegion[];
    allowedRegionsByType?: Partial<Record<LevelDesignPowerUpType, readonly LogicalRegion[]>>;
    initialPlacements: readonly {
      type: LevelDesignPowerUpType;
      position: Point;
    }[];
    contextual: {
      minimumCarriedEggs: number;
      minimumDelay: number;
    };
    formations: {
      magnet: { count: number; radius: number };
      range: { count: number; radius: number };
    };
  };
  fugitive: {
    enabled: boolean;
    allowedRegions: readonly LogicalRegion[];
    initialSpawnRegions?: readonly LogicalRegion[];
    firstSpawnLocalEvolution: number;
    preferUpwardEscape: boolean;
    enemyContestMaximumDistance: number;
  };
  eggMine: {
    enabled: boolean;
    allowedRegions: readonly LogicalRegion[];
    spawnLocations?: readonly Point[];
    firstSpawnLocalEvolution?: number;
  };
  pacing: {
    director: Readonly<PacingDirectorConfig>;
    opportunityZones: readonly OpportunitySpawnZone[];
  };
  nest: {
    position: Point;
    interactionRadius: number;
  };
};
