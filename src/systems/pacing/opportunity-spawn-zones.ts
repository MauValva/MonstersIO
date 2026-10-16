import type { Point } from "../../game/types";
import {
  OPPORTUNITY_SPAWN_ZONES,
  type OpportunitySpawnZone,
  type OpportunityTypeId,
} from "../../config/game-config";

export type ZoneRuntime = {
  reservedUntil: number;
  cooldownUntil: number;
  lastUsedAt: number;
};

export function createZoneRuntime(
  zones: readonly OpportunitySpawnZone[] = OPPORTUNITY_SPAWN_ZONES,
): Map<string, ZoneRuntime> {
  return new Map(zones.map((zone) => [zone.id, {
    reservedUntil: 0,
    cooldownUntil: 0,
    lastUsedAt: -Infinity,
  }]));
}

export function zoneContains(zone: OpportunitySpawnZone, point: Point) {
  return point.x >= zone.bounds.left && point.x <= zone.bounds.right &&
    point.y >= zone.bounds.top && point.y <= zone.bounds.bottom;
}

export function getAvailableZones(
  type: OpportunityTypeId,
  now: number,
  runtime: Map<string, ZoneRuntime>,
  zones: readonly OpportunitySpawnZone[] = OPPORTUNITY_SPAWN_ZONES,
) {
  return zones.filter((zone) => {
    const state = runtime.get(zone.id);
    return zone.allowedOpportunityTypes.includes(type) &&
      state !== undefined && state.reservedUntil <= now && state.cooldownUntil <= now;
  });
}

export function reserveZone(
  zone: OpportunitySpawnZone,
  now: number,
  duration: number,
  cooldown: number,
  runtime: Map<string, ZoneRuntime>,
) {
  const state = runtime.get(zone.id);
  if (!state) return;
  state.reservedUntil = now + duration;
  state.cooldownUntil = now + duration + cooldown;
  state.lastUsedAt = now;
}

export function weightedPick<T>(items: T[], weights: number[], random = Math.random) {
  const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
  if (items.length === 0 || total <= 0) return undefined;
  let cursor = random() * total;
  for (let i = 0; i < items.length; i += 1) {
    cursor -= Math.max(0, weights[i]);
    if (cursor <= 0) return items[i];
  }
  return items[items.length - 1];
}
