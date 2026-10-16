import {
  GAME_ASSETS,
  LAVA_WORLD_PLAQUE_ASSET,
  LAVA_WORLD_PORTAL_ASSET,
  WATER_WORLD_HIDEOUT_ASSET,
  WATER_WORLD_EVOLUTION_ASSETS,
  WATER_WORLD_RIVAL_ASSETS,
} from "../../assets";
import type { SceneAssetManifest } from "../../assets/scene-asset-types";

export const WATER_WORLD_ASSET_MANIFEST: SceneAssetManifest = {
  sceneId: "water-world",
  assets: [
    { id: "waterWorldGroundAtlas", path: GAME_ASSETS.waterWorldGround, scope: "SCENE" },
    { id: "waterWorldPlayerNest", path: GAME_ASSETS.waterWorldPlayerNest, scope: "SCENE" },
    { id: "lavaWorldPlaque", path: LAVA_WORLD_PLAQUE_ASSET, scope: "SCENE" },
    { id: "lavaWorldPortal", path: LAVA_WORLD_PORTAL_ASSET, scope: "SCENE" },
    ...WATER_WORLD_EVOLUTION_ASSETS.map((path, index) => ({
      id: `waterWorldEvolution${String(index + 1).padStart(2, "0")}`,
      path,
      scope: "SCENE" as const,
    })),
    { id: "waterWorldEnemyOctopus", path: WATER_WORLD_RIVAL_ASSETS.octopus, scope: "SCENE" },
    { id: "waterWorldEnemyShark", path: WATER_WORLD_RIVAL_ASSETS.shark, scope: "SCENE" },
    { id: "waterWorldEnemyNest01", path: WATER_WORLD_RIVAL_ASSETS.nest01, scope: "SCENE" },
    { id: "waterWorldEnemyNest02", path: WATER_WORLD_RIVAL_ASSETS.nest02, scope: "SCENE" },
    { id: "waterWorldEnemyCloud", path: WATER_WORLD_RIVAL_ASSETS.cloud, scope: "SCENE" },
    { id: "waterWorldHideout", path: WATER_WORLD_HIDEOUT_ASSET, scope: "SCENE" },
  ],
};
