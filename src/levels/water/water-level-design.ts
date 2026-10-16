import {
  createDefaultLevelDesignValues,
  createDefaultOpportunityZones,
  createDefaultPacingConfig,
} from "../level-design-defaults";
import type { WorldLevelDesignConfig } from "../world-level-design";

const defaults = createDefaultLevelDesignValues();

const WATER_INITIAL_EGG_POSITIONS = [
  // MC — a small, safe ring around the central Nest, outside its interaction radius.
  { x: 2600, y: 500 },
  { x: 3600, y: 500 },
  // BL / BC — the strongest early collection route.
  { x: 700, y: 2500 },
  { x: 1050, y: 2800 },
  { x: 1400, y: 2500 },
  { x: 1750, y: 2800 },
  { x: 2400, y: 2200 },
  { x: 2900, y: 2500 },
  { x: 3400, y: 2200 },
  { x: 3900, y: 2600 },
  // ML / BR — lateral groups with intermediate density.
  { x: 900, y: 900 },
  { x: 1450, y: 1100 },
  { x: 4500, y: 2400 },
  { x: 5100, y: 2750 },
  // MR / TL / TC / TR — longer routes and lighter common-egg density.
  { x: 4500, y: 700 },
  { x: 5200, y: 1050 },
  { x: 900, y: -2700 },
  { x: 3100, y: -3000 },
  { x: 5300, y: -2600 },
  { x: 5000, y: -1900 },
] as const;

const WATER_POST_FIRST_EVOLUTION_EGG_POSITIONS = [
  { x: 650, y: 2100 },
  { x: 1250, y: 2550 },
  { x: 2300, y: 2100 },
  { x: 3600, y: 2350 },
  { x: 900, y: 600 },
  { x: 4700, y: 2200 },
  { x: 5200, y: 800 },
  { x: 950, y: -2300 },
  { x: 3100, y: -2500 },
  { x: 5200, y: -2200 },
] as const;

const WATER_EGG_SPAWN_ZONES = [
  { name: "WATER_MC_NEST", bounds: { left: 2300, right: 3900, top: -950, bottom: 1250 }, target: 3 },
  { name: "WATER_BL_CORALS", bounds: { left: 300, right: 2050, top: 1400, bottom: 3700 }, target: 8 },
  { name: "WATER_BC_PEARL_GARDEN", bounds: { left: 2150, right: 4050, top: 1400, bottom: 3700 }, target: 8 },
  { name: "WATER_ML_ALGAE", bounds: { left: 300, right: 2050, top: -950, bottom: 1250 }, target: 5 },
  { name: "WATER_BR_CAVES", bounds: { left: 4150, right: 5900, top: 1400, bottom: 3700 }, target: 5 },
  { name: "WATER_MR_RIVAL", bounds: { left: 4150, right: 5900, top: -950, bottom: 1250 }, target: 5 },
  { name: "WATER_TL_RUINS", bounds: { left: 300, right: 2050, top: -3800, bottom: -1050 }, target: 3 },
  { name: "WATER_TC_ABYSS", bounds: { left: 2150, right: 4050, top: -3800, bottom: -1050 }, target: 3 },
  { name: "WATER_TR_REEF", bounds: { left: 4150, right: 5900, top: -3800, bottom: -1050 }, target: 4 },
] as const;

export const WATER_LEVEL_DESIGN: WorldLevelDesignConfig = {
  worldId: "water-world",
  hideouts: [
    // ML — dense but separated algae cover.
    { x: 520, y: -980 },
    { x: 1450, y: -920 },
    { x: 1880, y: 620 },
    // TL — sparse submerged ruins cover.
    { x: 720, y: -2850 },
    { x: 1650, y: -2200 },
    // BR — sparse marine grotto cover.
    { x: 4700, y: 2250 },
    { x: 5550, y: 3150 },
    // TC — one distant abyss cover.
    { x: 3000, y: -2500 },
  ],
  player: {
    initialPosition: { x: 3100, y: 320 },
  },
  rivals: {
    // MR: Octopus rival. TR: Shark rival. These are initial positions only;
    // the existing rival AI remains free to move through the whole map.
    bases: [{ x: 5000, y: 450 }, { x: 5000, y: -2700 }],
    enemies: [{ x: 4700, y: 450 }, { x: 4700, y: -2700 }],
  },
  eggs: {
    initialPositions: WATER_INITIAL_EGG_POSITIONS,
    postFirstEvolutionPositions: WATER_POST_FIRST_EVOLUTION_EGG_POSITIONS,
    spawnZones: WATER_EGG_SPAWN_ZONES,
  },
  powerUps: {
    enabledTypes: ["Speed", "Range", "Magnet", "Orbit"],
    allowedRegions: [...defaults.powerUpRegions],
    allowedRegionsByType: {
      Range: ["BL", "BC"],
      Speed: ["ML", "TL"],
      Orbit: ["MR", "TC"],
      Magnet: ["BR", "TR"],
    },
    initialPlacements: [
      { type: "Range", position: { x: 1050, y: 2700 } },
      { type: "Speed", position: { x: 1050, y: -450 } },
      { type: "Orbit", position: { x: 5400, y: 950 } },
      { type: "Magnet", position: { x: 5000, y: 2500 } },
    ],
    contextual: { ...defaults.contextualPowerUp },
    formations: {
      magnet: { ...defaults.formations.magnet },
      range: { ...defaults.formations.range },
    },
  },
  fugitive: {
    enabled: true,
    allowedRegions: ["ML", "TL", "BR"],
    initialSpawnRegions: ["ML", "TL"],
    firstSpawnLocalEvolution: 2,
    preferUpwardEscape: true,
    enemyContestMaximumDistance: defaults.enemyContest.maximumDistance,
  },
  eggMine: {
    enabled: true,
    allowedRegions: ["TL", "TR", "BL", "BR"],
    firstSpawnLocalEvolution: 4,
  },
  pacing: {
    director: { ...createDefaultPacingConfig() },
    opportunityZones: createDefaultOpportunityZones(),
  },
  nest: {
    position: { x: 3100, y: 0 },
    interactionRadius: 170,
  },
};
