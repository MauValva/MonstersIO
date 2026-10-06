import type { Point } from "../game/types";

export const WORLD = { width: 6200, height: 8400, top: -4200, bottom: 4200 };
export const CAMERA_ZOOM = 0.64;
export const RIVALS_START_ACTIVE = true;
export const PLAYER_SCREEN_GAP = {
  left: 150,
  right: 150,
  top: 190,
  bottom: 175,
};
export const PLAYABLE_BOUNDS = {
  left: Math.max(
    110,
    Math.max(PLAYER_SCREEN_GAP.left, PLAYER_SCREEN_GAP.right) / CAMERA_ZOOM,
  ),
  right:
    WORLD.width -
    Math.max(
      110,
      Math.max(PLAYER_SCREEN_GAP.left, PLAYER_SCREEN_GAP.right) / CAMERA_ZOOM,
    ),
  top: WORLD.top + Math.max(110, PLAYER_SCREEN_GAP.top / CAMERA_ZOOM),
  bottom: WORLD.bottom - Math.max(110, PLAYER_SCREEN_GAP.bottom / CAMERA_ZOOM),
};

export const STAGES = [
  { name: "Hatchling", threshold: 0, color: 0x65d5ff, scale: 1 },
  { name: "Young", threshold: 4, color: 0xffca62, scale: 1.14 },
  { name: "Alpha", threshold: 16, color: 0xf77b9b, scale: 1.3 },
  { name: "Legendary", threshold: 30, color: 0xb28cff, scale: 1.5 },
  { name: "Ember", threshold: 48, color: 0xff875f, scale: 1.62 },
  { name: "Mystic", threshold: 69, color: 0x8b7dff, scale: 1.76 },
  { name: "Titan", threshold: 94, color: 0x74e0a5, scale: 1.9 },
  { name: "Celestial", threshold: 122, color: 0xff82d5, scale: 2.04 },
  { name: "Ancient", threshold: 153, color: 0xd7a7ff, scale: 2.18 },
  { name: "Apex", threshold: 188, color: 0xffe27a, scale: 2.32 },
  // The portal is the eleventh collection entry and is previewed at the nest.
  { name: "Water World", threshold: 230, color: 0x63d8ff, scale: 2.42 },
] as const;

export const getStageVisualScale = (stageIndex: number) =>
  STAGES[Math.min(stageIndex, STAGES.length - 1)].scale;

export const PLANT_POSITIONS: Point[] = [
  { x: 2450, y: 2650 },
  { x: 3550, y: 2500 },
  { x: 2050, y: 2200 },
  { x: 4100, y: 2050 },
  { x: 1500, y: 1600 },
  { x: 4700, y: 1500 },
  { x: 2300, y: 1250 },
  { x: 3600, y: 1100 },
  { x: 1200, y: 850 },
  { x: 5000, y: 700 },
  { x: 2650, y: 600 },
  { x: 3900, y: 480 },
  { x: 900, y: 300 },
  { x: 5200, y: 350 },
  { x: 2100, y: -500 },
  { x: 3600, y: -850 },
  { x: 1300, y: -1450 },
  { x: 4700, y: -1900 },
  { x: 3000, y: -2700 },
  { x: 4200, y: -3450 },
];

export const EGG_SPAWN_CONFIG = {
  activeTarget: 44,
  baselineTarget: 28,
  visibleFloor: 2,
  nearbyFloor: 4,
  populationCheckInterval: 2.8,
  pocketSize: 3,
  pocketMinDistance: 520,
  pocketMaxDistance: 980,
  respawnMin: 1.5,
  respawnMax: 4,
  minBetweenEggs: 220,
  minFromPlayer: 300,
  minFromNest: 170,
  zones: [
    {
      name: "SAFE",
      bounds: { left: 2500, right: 3500, top: 2850, bottom: 3850 },
      target: 2,
    },
    {
      name: "EXPLORATION",
      bounds: { left: 1500, right: 4700, top: 650, bottom: 2850 },
      target: 14,
    },
    {
      name: "ENEMY_TERRITORY",
      bounds: { left: 700, right: 5500, top: -2200, bottom: 650 },
      target: 10,
    },
  ],
} as const;

export const POST_FIRST_EVOLUTION_EGG_POSITIONS: Point[] = [
  { x: 2700, y: 2700 },
  { x: 2920, y: 2580 },
  { x: 3160, y: 2660 },
  { x: 3380, y: 2500 },
  { x: 2550, y: 2380 },
  { x: 2800, y: 2200 },
  { x: 3250, y: 2180 },
  { x: 3650, y: 2050 },
  { x: 2350, y: 1950 },
  { x: 3500, y: 1800 },
];

export const GOLD_MINE_CONFIG = {
  initiallyLocked: true,
  minUnlockTime: 60,
  pityUnlockTime: 105,
  firstSpawnDelayMin: 7,
  firstSpawnDelayMax: 18,
  center: { x: 3100, y: -3100 },
  spawnLocations: [
    { x: 3100, y: -3100 },
    { x: 1500, y: -3000 },
    { x: 4700, y: -3000 },
    { x: 2200, y: -1850 },
    { x: 4000, y: -1850 },
  ],
  activationRadius: 250,
  activeRadius: 310,
  gracePeriod: 2.5,
  abandonCooldown: 24,
  cooldown: 90,
  despawnDuration: 0.5,
  respawnMinDistance: 850,
  payoutBaseRadius: 120,
  payoutRadiusPerWave: 55,
  maxPayoutRadius: 330,
  payoutRadialVariance: 0,
  minimumEggSeparation: 58,
  maxPlacementAttempts: 12,
  maxRewardEggs: 30,
  interestRadius: 1450,
  waves: [
    { at: 1.0, normalEggs: 3, coinEggs: 0 },
    { at: 2.0, normalEggs: 3, coinEggs: 1 },
    { at: 3.2, normalEggs: 3, coinEggs: 2 },
    { at: 4.6, normalEggs: 2, coinEggs: 3 },
    { at: 6.2, normalEggs: 6, coinEggs: 6, final: true },
  ],
  visual: {
    baseRadius: 78,
    heatRadius: 112,
    pulseFrequency: 2.4,
  },
} as const;

export const SESSION_PACING_CONFIG = {
  openingEnd: 18,
  earlyGameEnd: 42,
  midGameEnd: 75,
  firstClusterMinTime: 10,
  firstClusterMaxTime: 24,
  firstPowerUpMinTime: 20,
  firstPowerUpIdealTime: 30,
  firstPowerUpMaxTime: 42,
  powerUpDryTime: 48,
  visibleOpportunityCheckInterval: 0.75,
} as const;

export const INITIAL_EGG_POSITIONS: Point[] = [
  { x: 3050, y: 3180 },
  { x: 2700, y: 3100 },
  { x: 3350, y: 3000 },
  { x: 2500, y: 2850 },
  { x: 3500, y: 2600 },
  { x: 3000, y: 2350 },
  { x: 2150, y: -700 },
  { x: 4200, y: -1600 },
  { x: 1800, y: 900 },
  { x: 3000, y: 1100 },
  { x: 4200, y: 900 },
  { x: 1400, y: 300 },
  { x: 2400, y: 0 },
  { x: 3600, y: -300 },
  { x: 5000, y: 100 },
  { x: 1000, y: -600 },
  { x: 1800, y: -1200 },
  { x: 3000, y: -1500 },
  { x: 4200, y: -1800 },
  { x: 5200, y: -2600 },
];

export const NEST_INTERACTION_RADIUS = 170;
export const FOLLOW_DISTANCE = 68;
export const ENEMY_EGG_CAPACITY = 8;
export const DEBUG_OPEN_UPGRADE_MENU = false;

export const UPGRADE_CONFIG = {
  initialCost: 5,
  costStep: 5,
} as const;

export const EGG_PICKUP_FEEDBACK = {
  pullDuration: 0.16,
  popScale: 1.16,
  impactScale: 1.14,
  streakTimeout: 1.0,
  maxFeedbackStreak: 6,
  pitchStep: 0.045,
  maxPitch: 1.22,
  particleIntensity: 1,
} as const;

export const BUSH_STACK_CONFIG = {
  maxColumns: 9,
  slotSpacingX: 25,
  slotSpacingY: 21,
  jitterX: 4.2,
  jitterY: 3.2,
  compactDuration: 0.3,
  compactDurationPerEgg: 0.0022,
  cascadeStep: 0.0025,
  releaseSpacingMultiplier: 0.72,
  bobX: 0.8,
  bobY: 0.7,
} as const;

export type StackVisualTier = {
  id: "SMALL" | "GROWING" | "RICH" | "LARGE" | "HUGE";
  min: number;
  swayAmplitude: number;
  particleRate: number;
  milestoneStrength: number;
};

export const STACK_VISUAL_CONFIG = {
  milestones: [5, 10, 15, 25] as readonly number[],
  tiers: [
    {
      id: "SMALL",
      min: 0,
      swayAmplitude: 0.45,
      particleRate: 0,
      milestoneStrength: 0.35,
    },
    {
      id: "GROWING",
      min: 5,
      swayAmplitude: 0.9,
      particleRate: 0.08,
      milestoneStrength: 0.5,
    },
    {
      id: "RICH",
      min: 10,
      swayAmplitude: 1.35,
      particleRate: 0.14,
      milestoneStrength: 0.68,
    },
    {
      id: "LARGE",
      min: 15,
      swayAmplitude: 1.8,
      particleRate: 0.2,
      milestoneStrength: 0.82,
    },
    {
      id: "HUGE",
      min: 25,
      swayAmplitude: 2.3,
      particleRate: 0.28,
      milestoneStrength: 1,
    },
  ] as StackVisualTier[],
  momentumPerPickup: 0.2,
  momentumDecay: 0.9,
  recentPickupRatePerPickup: 0.22,
  recentPickupDecay: 0.7,
  rippleDuration: 0.3,
  rippleStep: 0.018,
  rippleScale: 0.085,
  maxRippleEggs: 8,
  maxSwayIndex: 14,
  lossRippleStrength: 0.38,
  milestoneDecay: 2.6,
} as const;

export const DEPOSIT_FEEDBACK = {
  smallDepositMax: 4,
  mediumDepositMax: 9,
  minDuration: 0.22,
  maxDuration: 0.46,
  initialEggInterval: 0.12,
  minEggInterval: 0.035,
  acceleration: 0.008,
  nestPulseScale: 1.035,
  finalPulseScale: 1.1,
  pitchStep: 0.035,
  maxPitch: 1.24,
  evolutionDelay: 0.18,
  particleIntensity: 1,
} as const;

export const POST_EVOLUTION_OPPORTUNITY = {
  firstEvolutionEggCountMin: 8,
  firstEvolutionEggCountMax: 12,
  normalEggCount: 8,
  minDistanceFromPlayer: 360,
  maxDistanceFromPlayer: 1250,
  nearbyCheckRadius: 1050,
  lowOpportunityThreshold: 2,
  goodOpportunityThreshold: 6,
  spawnInterval: 0.065,
  triggerDelay: 0.12,
  minEggSpacing: 118,
} as const;

export const NEAR_LEVEL_UP_OPPORTUNITY = {
  maxMissingEggs: 4,
  nearbyEggCheckRadius: 1050,
  minSpawnDistance: 420,
  preferredSpawnDistance: 700,
  maxSpawnDistance: 1250,
  extraEggMin: 1,
  extraEggMax: 2,
  breadcrumbSpacing: 165,
  cooldown: 4,
} as const;

export const PACING_DIRECTOR_CONFIG = {
  debug: false,
  evaluationInterval: 0.75,
  deadMomentSeconds: 5,
  noOpportunityThreshold: 5,
  explorationStallSeconds: 8,
  lowActivityThreshold: 1.15,
  opportunityTimeout: 12,
  heavyStackThreshold: 10,
  noveltyHistorySize: 4,
  offscreenSpawnMargin: 125,
  minSpawnDistance: 420,
  preferredSpawnDistance: 700,
  maxSpawnDistance: 1250,
  forwardWeight: 1.35,
  lateralWeight: 1,
  backwardWeight: 0.35,
  sideExplorationWeight: 0.85,
  forwardExplorationWeight: 1.25,
  zoneCooldown: 10,
  recentZoneHistorySize: 4,
  maxDirectedOpportunities: 1,
  surpriseMinDelay: 8,
  surpriseIdealDelay: 14,
  surpriseMaxDryTime: 25,
  surpriseReadinessRate: 0.075,
  surpriseRecoveryDuration: 8,
  highIntensityCooldown: 12,
  rewardHistorySize: 8,
  guaranteedFloorSeconds: 6,
  categoryRepetitionPenalty: 0.58,
  typeRepetitionPenalty: 0.5,
  directionRepetitionPenalty: 0.72,
} as const;

export type OpportunityTypeId =
  | "NORMAL_EGG"
  | "FUGITIVE_EGG"
  | "SPEED_EGG"
  | "RANGE_EGG"
  | "MAGNET_EGG"
  | "ORBIT_EGG"
  | "LOADED_ENEMY"
  | "EVENT";

export type OpportunitySpawnZone = {
  id: string;
  bounds: { left: number; right: number; top: number; bottom: number };
  region: "Nest" | "Exploration" | "EnemyTerritory" | "GoldMine";
  side: "LEFT" | "RIGHT" | "CENTER";
  allowedOpportunityTypes: readonly OpportunityTypeId[];
  weight: number;
  minPlayerDistance: number;
  maxPlayerDistance: number;
  supportsChaseEvent?: boolean;
};

const NORMAL_AND_FUTURE_OPPORTUNITIES: readonly OpportunityTypeId[] = [
  "NORMAL_EGG",
  "FUGITIVE_EGG",
  "SPEED_EGG",
  "RANGE_EGG",
  "MAGNET_EGG",
  "ORBIT_EGG",
  "LOADED_ENEMY",
  "EVENT",
];

export const OPPORTUNITY_SPAWN_ZONES: readonly OpportunitySpawnZone[] = [
  {
    id: "Nest_Left_Lower",
    bounds: { left: 800, right: 2100, top: 2200, bottom: 3150 },
    region: "Nest",
    side: "LEFT",
    allowedOpportunityTypes: NORMAL_AND_FUTURE_OPPORTUNITIES,
    weight: 0.85,
    minPlayerDistance: 420,
    maxPlayerDistance: 1250,
  },
  {
    id: "Nest_Right_Lower",
    bounds: { left: 4000, right: 5300, top: 2200, bottom: 3150 },
    region: "Nest",
    side: "RIGHT",
    allowedOpportunityTypes: NORMAL_AND_FUTURE_OPPORTUNITIES,
    weight: 0.85,
    minPlayerDistance: 420,
    maxPlayerDistance: 1250,
  },
  {
    id: "Exploration_Left_01",
    bounds: { left: 650, right: 1900, top: 650, bottom: 1900 },
    region: "Exploration",
    side: "LEFT",
    allowedOpportunityTypes: NORMAL_AND_FUTURE_OPPORTUNITIES,
    weight: 1,
    minPlayerDistance: 420,
    maxPlayerDistance: 1250,
  },
  {
    id: "Exploration_Right_01",
    bounds: { left: 4300, right: 5550, top: 650, bottom: 1900 },
    region: "Exploration",
    side: "RIGHT",
    allowedOpportunityTypes: NORMAL_AND_FUTURE_OPPORTUNITIES,
    weight: 1,
    minPlayerDistance: 420,
    maxPlayerDistance: 1250,
  },
  {
    id: "Enemy_Left_01",
    bounds: { left: 650, right: 1900, top: -1450, bottom: 250 },
    region: "EnemyTerritory",
    side: "LEFT",
    allowedOpportunityTypes: NORMAL_AND_FUTURE_OPPORTUNITIES,
    weight: 0.9,
    minPlayerDistance: 420,
    maxPlayerDistance: 1250,
    supportsChaseEvent: true,
  },
  {
    id: "Enemy_Right_01",
    bounds: { left: 4300, right: 5550, top: -1450, bottom: 250 },
    region: "EnemyTerritory",
    side: "RIGHT",
    allowedOpportunityTypes: NORMAL_AND_FUTURE_OPPORTUNITIES,
    weight: 0.9,
    minPlayerDistance: 420,
    maxPlayerDistance: 1250,
    supportsChaseEvent: true,
  },
  {
    id: "Exploration_Left_Upper",
    bounds: { left: 900, right: 2200, top: -2150, bottom: -850 },
    region: "EnemyTerritory",
    side: "LEFT",
    allowedOpportunityTypes: NORMAL_AND_FUTURE_OPPORTUNITIES,
    weight: 0.7,
    minPlayerDistance: 420,
    maxPlayerDistance: 1250,
  },
  {
    id: "Exploration_Right_Upper",
    bounds: { left: 4000, right: 5300, top: -2150, bottom: -850 },
    region: "EnemyTerritory",
    side: "RIGHT",
    allowedOpportunityTypes: NORMAL_AND_FUTURE_OPPORTUNITIES,
    weight: 0.7,
    minPlayerDistance: 420,
    maxPlayerDistance: 1250,
  },
];

export const SPECIAL_EGG_CONFIG = {
  globalCooldown: 4,
  speed: {
    duration: 10,
    spawnWeight: 0.85,
    cooldown: 35,
    expirationWarningTime: 2,
    tint: 0xffd45c,
    icon: "⚡",
    speedMultiplier: 1.4,
  },
  range: {
    duration: 10,
    spawnWeight: 0.8,
    cooldown: 35,
    expirationWarningTime: 2,
    indicatorExpandDuration: 0.26,
    indicatorContractDuration: 0.3,
    tint: 0x70d8ff,
    icon: "◉",
    pickupRangeMultiplier: 1.75,
  },
  magnet: {
    duration: 8,
    spawnWeight: 0.25,
    cooldown: 75,
    expirationWarningTime: 2,
    tint: 0xff78c8,
    icon: "🧲",
    magnetMultiplier: 1.8,
    magnetRadiusMultiplier: 5.0,
    minAttractionSpeed: 230,
    maxAttractionSpeed: 680,
    maxMagnetizedEggs: 100,
    visual: {
      pulseEnabled: true,
      pulseInterval: 0.7,
      pulseDuration: 1.4,
      minRadius: 24,
      color: 0xffffff,
      startAlpha: 0.55,
      activationPulseMultiplier: 1.15,
      inward: true,
    },
  },
  orbit: {
    duration: 12,
    spawnWeight: 0.55,
    cooldown: 50,
    expirationWarningTime: 2,
    transitionDuration: 0.4,
    tint: 0xb28cff,
    icon: "🌀",
    orbitSpeed: 1.2,
    orbitPadding: 14,
    ringSpacing: 58,
    desiredEggArcSpacing: 50,
    ellipseY: 0.78,
    ringSpeedFalloff: 0.85,
    bobFrequency: 2.1,
    bobAmount: 2.4,
  },
} as const;

export const FUGITIVE_RAINBOW_COLORS = [
  0xff5f72,
  0xffad5c,
  0xffe36b,
  0x70df8b,
  0x63d8ff,
  0x7b86ff,
  0xc77dff,
  0xff79c8,
] as const;

export const FUGITIVE_EGG_CONFIG = {
  alertRadius: 300,
  captureRadius: 64,
  nearCaptureDistance: 128,
  baseSpeed: 205,
  nearPlayerSpeedMultiplier: 1.08,
  farPlayerSpeedMultiplier: 0.82,
  idealChaseDistance: 150,
  steeringStrength: 4.5,
  directionVariation: 0.28,
  upwardBias: 0.62,
  awayBias: 0.72,
  alertDelay: 0.22,
  maxChaseDuration: 8,
  abandonDistance: 900,
  abandonTime: 2.2,
  jackpotEggCount: 12,
  jackpotMinRadius: 140,
  jackpotMaxRadius: 420,
  rivalInterestDelay: 0.75,
  cooldown: 90,
  spawnWeight: 0.3,
  trailInterval: 0.035,
  trailLife: 0.62,
} as const;
