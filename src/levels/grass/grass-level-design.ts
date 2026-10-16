import {
  createDefaultInitialEggPositions,
  createDefaultEggSpawnZones,
  createDefaultLevelDesignValues,
  createDefaultOpportunityZones,
  createDefaultPacingConfig,
  createDefaultPostFirstEvolutionEggPositions,
} from "../level-design-defaults";
import type { WorldLevelDesignConfig } from "../world-level-design";

const defaults = createDefaultLevelDesignValues();

export const GRASS_LEVEL_DESIGN: WorldLevelDesignConfig = {
  worldId: "grass-world",
  player: {
    initialPosition: { x: 3000, y: 3300 },
  },
  rivals: {
    bases: [{ x: 2200, y: 850 }, { x: 4700, y: -1500 }],
    enemies: [{ x: 2200, y: 850 }, { x: 4400, y: -1200 }],
  },
  eggs: {
    initialPositions: createDefaultInitialEggPositions(),
    postFirstEvolutionPositions: createDefaultPostFirstEvolutionEggPositions(),
    spawnZones: createDefaultEggSpawnZones(),
  },
  powerUps: {
    enabledTypes: ["Speed", "Range", "Magnet", "Orbit"],
    allowedRegions: defaults.powerUpRegions,
    initialPlacements: [
      { type: "Orbit", position: { x: 1350, y: -2750 } },
      { type: "Speed", position: { x: 4750, y: -2750 } },
      { type: "Range", position: { x: 1350, y: 2700 } },
      { type: "Magnet", position: { x: 4750, y: 2700 } },
    ],
    contextual: defaults.contextualPowerUp,
    formations: defaults.formations,
  },
  fugitive: {
    enabled: true,
    allowedRegions: defaults.fugitiveRegions,
    firstSpawnLocalEvolution: 2,
    preferUpwardEscape: true,
    enemyContestMaximumDistance: defaults.enemyContest.maximumDistance,
  },
  eggMine: {
    enabled: true,
    // Grass World keeps the original three upper-matrix mine locations.
    allowedRegions: ["TL", "TC", "TR"],
    spawnLocations: [
      { x: 850, y: -3000 },
      { x: 3100, y: -3000 },
      { x: 5350, y: -3000 },
    ],
    // stageIndex 2 is reached after evolution 3.
    firstSpawnLocalEvolution: 2,
  },
  pacing: {
    director: createDefaultPacingConfig(),
    opportunityZones: createDefaultOpportunityZones(),
  },
  nest: {
    position: { x: 3000, y: 3500 },
    interactionRadius: 170,
  },
};
