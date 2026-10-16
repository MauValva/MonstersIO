import type { LevelId } from "../levels/level-types";

export type AssetScope = "SHARED" | "SCENE";

export type SceneAssetDefinition = {
  id: string;
  path: string;
  scope: AssetScope;
};

export type SceneAssetManifest = {
  sceneId: LevelId | "shared";
  assets: readonly SceneAssetDefinition[];
};
