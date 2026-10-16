import {
  EGG_SPAWN_CONFIG,
  INITIAL_EGG_POSITIONS,
  OPPORTUNITY_SPAWN_ZONES,
  PACING_DIRECTOR_CONFIG,
  POST_FIRST_EVOLUTION_EGG_POSITIONS,
} from "../config/game-config";
import { LEVEL_DESIGN_CONFIG } from "../config/level-design-config";
import type { OpportunitySpawnZone } from "../config/game-config";
import type { PacingDirectorConfig } from "../systems/pacing/pacing-director";

export function createDefaultInitialEggPositions() {
  return INITIAL_EGG_POSITIONS.map((position) => ({ ...position }));
}

export function createDefaultPostFirstEvolutionEggPositions() {
  return POST_FIRST_EVOLUTION_EGG_POSITIONS.map((position) => ({ ...position }));
}

export function createDefaultEggSpawnZones() {
  return EGG_SPAWN_CONFIG.zones.map((zone) => ({
    ...zone,
    bounds: { ...zone.bounds },
  }));
}

export function createDefaultOpportunityZones(): readonly OpportunitySpawnZone[] {
  return OPPORTUNITY_SPAWN_ZONES.map((zone) => ({
    ...zone,
    bounds: { ...zone.bounds },
    allowedOpportunityTypes: [...zone.allowedOpportunityTypes],
  }));
}

export function createDefaultPacingConfig(): Readonly<PacingDirectorConfig> {
  return { ...PACING_DIRECTOR_CONFIG } as PacingDirectorConfig;
}

export function createDefaultLevelDesignValues() {
  return {
    powerUpRegions: [...LEVEL_DESIGN_CONFIG.powerUpRegions],
    fugitiveRegions: [...LEVEL_DESIGN_CONFIG.fugitiveRegions],
    goldMineRegions: [...LEVEL_DESIGN_CONFIG.goldMineRegions],
    contextualPowerUp: { ...LEVEL_DESIGN_CONFIG.contextualPowerUp },
    enemyContest: { ...LEVEL_DESIGN_CONFIG.enemyContest },
    formations: {
      magnet: { ...LEVEL_DESIGN_CONFIG.formations.magnet },
      range: { ...LEVEL_DESIGN_CONFIG.formations.range },
    },
  };
}
