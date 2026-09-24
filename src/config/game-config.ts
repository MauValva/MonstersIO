import type { Point } from "../game/types";

export const WORLD = { width: 6200, height: 8400, top: -4200, bottom: 4200 };
export const CAMERA_ZOOM = 0.64;
export const RIVALS_START_ACTIVE = true;
export const PLAYER_SCREEN_GAP = { left: 150, right: 150, top: 190, bottom: 175 };
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
  { name: "Young", threshold: 6, color: 0xffca62, scale: 1.14 },
  { name: "Alpha", threshold: 16, color: 0xf77b9b, scale: 1.3 },
  { name: "Legendary", threshold: 30, color: 0xb28cff, scale: 1.5 },
  { name: "Ember", threshold: 48, color: 0xff875f, scale: 1.62 },
  { name: "Mystic", threshold: 69, color: 0x8b7dff, scale: 1.76 },
  { name: "Titan", threshold: 94, color: 0x74e0a5, scale: 1.9 },
  { name: "Celestial", threshold: 122, color: 0xff82d5, scale: 2.04 },
  { name: "Ancient", threshold: 153, color: 0xd7a7ff, scale: 2.18 },
  { name: "Apex", threshold: 188, color: 0xffe27a, scale: 2.32 },
] as const;

export const getStageVisualScale = (stageIndex: number) =>
  STAGES[Math.min(stageIndex, STAGES.length - 1)].scale;

export const PLANT_POSITIONS: Point[] = [
  { x: 2450, y: 2650 }, { x: 3550, y: 2500 }, { x: 2050, y: 2200 },
  { x: 4100, y: 2050 }, { x: 1500, y: 1600 }, { x: 4700, y: 1500 },
  { x: 2300, y: 1250 }, { x: 3600, y: 1100 }, { x: 1200, y: 850 },
  { x: 5000, y: 700 }, { x: 2650, y: 600 }, { x: 3900, y: 480 },
  { x: 900, y: 300 }, { x: 5200, y: 350 }, { x: 2100, y: -500 },
  { x: 3600, y: -850 }, { x: 1300, y: -1450 }, { x: 4700, y: -1900 },
  { x: 3000, y: -2700 }, { x: 4200, y: -3450 },
];

export const EGG_SPAWN_CONFIG = {
  activeTarget: 20,
  respawnMin: 2,
  respawnMax: 5,
  minBetweenEggs: 220,
  minFromPlayer: 300,
  minFromNest: 170,
  zones: [
    { name: "SAFE", bounds: { left: 2500, right: 3500, top: 2850, bottom: 3850 }, target: 2 },
    { name: "EXPLORATION", bounds: { left: 1750, right: 4450, top: 800, bottom: 2850 }, target: 6 },
    { name: "RISK", bounds: { left: 500, right: 5700, top: -3900, bottom: 800 }, target: 12 },
  ],
} as const;

export const INITIAL_EGG_POSITIONS: Point[] = [
  { x: 3050, y: 3180 }, { x: 2700, y: 3100 }, { x: 3350, y: 3000 },
  { x: 2500, y: 2850 }, { x: 3500, y: 2600 }, { x: 3000, y: 2350 },
  { x: 2150, y: -700 }, { x: 4200, y: -1600 }, { x: 1800, y: 900 },
  { x: 3000, y: 1100 }, { x: 4200, y: 900 }, { x: 1400, y: 300 },
  { x: 2400, y: 0 }, { x: 3600, y: -300 }, { x: 5000, y: 100 },
  { x: 1000, y: -600 }, { x: 1800, y: -1200 }, { x: 3000, y: -1500 },
  { x: 4200, y: -1800 }, { x: 5200, y: -2600 },
];

export const NEST_INTERACTION_RADIUS = 170;
export const FOLLOW_DISTANCE = 68;
export const DEBUG_OPEN_UPGRADE_MENU = false;
