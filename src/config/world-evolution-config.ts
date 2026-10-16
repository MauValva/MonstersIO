import { STAGES } from "./game-config";
import type { LevelId } from "../levels/level-types";

export type EvolutionStage = {
  name: string;
  threshold: number;
  color: number;
  scale: number;
};

export type WorldEvolutionConfig = {
  worldId: LevelId;
  stages: readonly EvolutionStage[];
  /** Local delivered-egg requirement that activates the world portal. */
  portalEggRequirement: number | null;
  /** Existing visual scale used by the portal preview, when available. */
  portalScale: number;
};

const grassStages = Object.freeze(STAGES.slice(0, 10));
const WATER_WORLD_THRESHOLDS = [
  0,
  4,
  14,
  28,
  46,
  68,
  94,
  124,
  158,
  194,
] as const;
const waterStages = Object.freeze(
  STAGES.slice(10, 20).map((stage, index) => ({
    ...stage,
    threshold: WATER_WORLD_THRESHOLDS[index],
  })),
);

export const WORLD_EVOLUTION_CONFIGS: Readonly<
  Record<LevelId, WorldEvolutionConfig>
> = {
  "grass-world": {
    worldId: "grass-world",
    stages: grassStages,
    // Existing Grass -> portal threshold: global 230, local Grass progress 230.
    portalEggRequirement: 230,
    portalScale: STAGES[10].scale,
  },
  "water-world": {
    worldId: "water-world",
    stages: waterStages,
    // Water World completes at 230 local delivered eggs. Evolution 10 is
    // reached earlier at 194 and remains the final local form.
    portalEggRequirement: 230,
    portalScale: waterStages[waterStages.length - 1].scale,
  },
};

export function getWorldEvolutionConfig(worldId: LevelId) {
  return WORLD_EVOLUTION_CONFIGS[worldId];
}

export function getGlobalEvolutionLevel(
  worldOrder: readonly LevelId[],
  worldId: LevelId,
  localEvolutionLevel: number,
): number {
  const worldIndex = worldOrder.indexOf(worldId);
  if (worldIndex < 0) return localEvolutionLevel + 1;
  const previousEvolutionCount = worldOrder
    .slice(0, worldIndex)
    .reduce(
      (total, previousWorldId) =>
        total + getWorldEvolutionConfig(previousWorldId).stages.length,
      0,
    );
  return previousEvolutionCount + localEvolutionLevel + 1;
}
