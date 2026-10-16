import {
  GAME_ASSETS,
  GRASS_WORLD_PLAYER_NEST_ASSET,
  GRASS_WORLD_SCENE_ASSETS,
} from "../../assets";
import type { SceneAssetManifest } from "../../assets/scene-asset-types";

export const GRASS_WORLD_ASSET_MANIFEST: SceneAssetManifest = {
  sceneId: "grass-world",
  assets: [
    { id: "grassGroundAtlas", path: GAME_ASSETS.ground, scope: "SCENE" },
    { id: "playerEvolutionTexture", path: GAME_ASSETS.player, scope: "SCENE" },
    { id: "grassWorldPlayerNest", path: GRASS_WORLD_PLAYER_NEST_ASSET, scope: "SCENE" },
    { id: "grassWorldPlant", path: GRASS_WORLD_SCENE_ASSETS.plant, scope: "SCENE" },
    { id: "grassWorldEdgeStone", path: GRASS_WORLD_SCENE_ASSETS.edgeStone, scope: "SCENE" },
    { id: "grassWorldEnemyBat", path: GRASS_WORLD_SCENE_ASSETS.enemyBat, scope: "SCENE" },
    { id: "grassWorldEnemyRed", path: GRASS_WORLD_SCENE_ASSETS.enemyRed, scope: "SCENE" },
    { id: "grassWorldEnemyNest01", path: GRASS_WORLD_SCENE_ASSETS.nest01, scope: "SCENE" },
    { id: "grassWorldEnemyNest02", path: GRASS_WORLD_SCENE_ASSETS.nest02, scope: "SCENE" },
    { id: "grassWorldCloud", path: GRASS_WORLD_SCENE_ASSETS.cloud, scope: "SCENE" },
  ],
};
