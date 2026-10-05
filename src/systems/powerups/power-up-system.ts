import { SPECIAL_EGG_CONFIG } from "../../config/game-config";

export const SpecialEggType = {
  Speed: "Speed",
  Range: "Range",
  Magnet: "Magnet",
  Orbit: "Orbit",
} as const;

export type SpecialEggType = (typeof SpecialEggType)[keyof typeof SpecialEggType];

export type PowerUpDefinition = {
  type: SpecialEggType;
  duration: number;
  spawnWeight: number;
  cooldown: number;
  expirationWarningTime?: number;
  icon: string;
  tint: number;
  speedMultiplier?: number;
  pickupRangeMultiplier?: number;
  magnetMultiplier?: number;
  magnetRadiusMultiplier?: number;
  minAttractionSpeed?: number;
  maxAttractionSpeed?: number;
  maxMagnetizedEggs?: number;
  transitionDuration?: number;
  orbitSpeed?: number;
  orbitPadding?: number;
  ringSpacing?: number;
  desiredEggArcSpacing?: number;
  ellipseY?: number;
  contextScore?: (context: { carriedEggs: number; nearbyEggs: number }) => number;
};

export type ActivePowerUp = {
  type: SpecialEggType;
  remaining: number;
  duration: number;
};

const definitions: Record<SpecialEggType, PowerUpDefinition> = {
  [SpecialEggType.Speed]: { type: SpecialEggType.Speed, ...SPECIAL_EGG_CONFIG.speed },
  [SpecialEggType.Range]: { type: SpecialEggType.Range, ...SPECIAL_EGG_CONFIG.range },
  [SpecialEggType.Magnet]: { type: SpecialEggType.Magnet, ...SPECIAL_EGG_CONFIG.magnet },
  [SpecialEggType.Orbit]: { type: SpecialEggType.Orbit, ...SPECIAL_EGG_CONFIG.orbit },
};

export type PowerUpVisualHooks = {
  onActivateVisual?: (powerUp: ActivePowerUp) => void;
  onUpdateVisual?: (powerUp: ActivePowerUp) => void;
  onDeactivateVisual?: (type: SpecialEggType) => void;
};

export function createPowerUpManager(hooks: PowerUpVisualHooks = {}) {
  const active = new Map<SpecialEggType, ActivePowerUp>();

  function activate(type: SpecialEggType, force = false) {
    const definition = definitions[type];
    if (!definition) return false;
    const existing = active.get(type);
    if (existing) {
      existing.remaining = definition.duration;
      existing.duration = definition.duration;
      hooks.onActivateVisual?.(existing);
      return true;
    }
    const next = { type, remaining: definition.duration, duration: definition.duration };
    active.set(type, next);
    hooks.onActivateVisual?.(next);
    return true;
  }

  function update(dt: number) {
    for (const [type, powerUp] of active) {
      powerUp.remaining -= dt;
      if (powerUp.remaining <= 0) {
        active.delete(type);
        hooks.onDeactivateVisual?.(type);
      } else {
        hooks.onUpdateVisual?.(powerUp);
      }
    }
  }

  function getDefinition(type: SpecialEggType) { return definitions[type]; }
  // Power-Ups can be collected back-to-back. Their duration is the only
  // gameplay limit; there is intentionally no global or per-type pickup lock.
  function canActivate(_type: SpecialEggType) { return true; }
  function getActivePowerUps() { return [...active.values()].map((entry) => ({ ...entry })); }
  function getActive(type: SpecialEggType) { return active.get(type); }
  function getModifiers() {
    let speedMultiplier = 1;
    let pickupRangeMultiplier = 1;
    let magnetMultiplier = 1;
    for (const powerUp of active.values()) {
      const definition = definitions[powerUp.type];
      speedMultiplier *= definition.speedMultiplier ?? 1;
      pickupRangeMultiplier *= definition.pickupRangeMultiplier ?? 1;
      magnetMultiplier *= definition.magnetMultiplier ?? 1;
    }
    return { speedMultiplier, pickupRangeMultiplier, magnetMultiplier };
  }
  function chooseSpawnType(context: { carriedEggs: number; nearbyEggs: number }) {
    const candidates = Object.values(definitions).filter((definition) => canActivate(definition.type));
    const weights = candidates.map((definition) =>
      definition.spawnWeight * (definition.contextScore?.(context) ?? 1),
    );
    const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
    let cursor = Math.random() * total;
    for (let i = 0; i < candidates.length; i += 1) {
      cursor -= Math.max(0, weights[i]);
      if (cursor <= 0) return candidates[i].type;
    }
    return candidates.at(-1)?.type;
  }
  function getDebugState() {
    return {
      active: getActivePowerUps(),
      globalCooldown: 0,
      cooldowns: {},
    };
  }
  function reset() {
    for (const type of active.keys()) hooks.onDeactivateVisual?.(type);
    active.clear();
  }

  return { activate, canActivate, update, getDefinition, getActivePowerUps, getActive, getModifiers, chooseSpawnType, getDebugState, reset, definitions };
}
