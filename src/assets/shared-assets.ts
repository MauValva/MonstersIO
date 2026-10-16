import { GAME_ASSETS } from "../assets";
import type { SceneAssetManifest } from "./scene-asset-types";

const shared = (id: string, path: string) => ({ id, path, scope: "SHARED" as const });

export const SHARED_ASSET_MANIFEST: SceneAssetManifest = {
  sceneId: "shared",
  assets: [
    shared("worldAtlasTexture", GAME_ASSETS.worldAtlas),
    shared("upgradeUiTexture", GAME_ASSETS.upgradeUi),
    shared("upgradeBaseTexture", GAME_ASSETS.upgradeBase),
    shared("eggTexture", GAME_ASSETS.eggs),
    shared("featuresTexture", GAME_ASSETS.features),
    shared("hudTexture", GAME_ASSETS.hud),
    shared("evolutionUiTexture", GAME_ASSETS.evolutionUi),
  ],
};
