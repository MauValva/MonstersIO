import type { LevelId } from "../levels/level-types";

export type TutorialTarget =
  | "EGG"
  | "NEST"
  | "UPGRADE"
  | "BUSH"
  | "ENEMY"
  | "MAGNET"
  | "GOLD_MINE";

export type TutorialObjective = {
  id: string;
  target: TutorialTarget;
};

export type SceneTutorialConfig = {
  worldId: LevelId;
  enabled: boolean;
  objectives: readonly TutorialObjective[];
};

export const GRASS_WORLD_TUTORIAL_CONFIG: SceneTutorialConfig = {
  worldId: "grass-world",
  enabled: true,
  objectives: [
    { id: "opening-egg-collection", target: "EGG" },
    { id: "opening-nest-deposit", target: "NEST" },
    { id: "hide-in-bush", target: "BUSH" },
    { id: "recover-from-enemy", target: "ENEMY" },
    { id: "collect-magnet", target: "MAGNET" },
    { id: "visit-egg-mine", target: "GOLD_MINE" },
    { id: "upgrade-station", target: "UPGRADE" },
  ],
};

export const WATER_WORLD_TUTORIAL_CONFIG: SceneTutorialConfig = {
  worldId: "water-world",
  enabled: false,
  objectives: [],
};
