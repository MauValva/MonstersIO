import { Container, Sprite, Texture } from "pixi.js";
import { createWaterWorldScene } from "../../world/water-world-scene";
import { createBushes, type Bush } from "../../world/world-scene";
import { createBushCoverSystem } from "../../world/bush-cover";
import type { SceneContext } from "../../game/scene-context";
import type { Level } from "../level-types";
import { WATER_LEVEL_DESIGN } from "./water-level-design";
import { WATER_WORLD_ASSET_MANIFEST } from "./water-assets";

export type WaterWorldLevel = Level & {
  id: "water-world";
  obstacles: Container;
  bushes: Bush[];
  getCover: (point: import("../../game/types").Point) => number;
  getNearestBush: (point: import("../../game/types").Point) => Bush;
  setHideFeedback: (point: import("../../game/types").Point, hidden: boolean) => void;
  refreshVisualScale: (scale: number) => void;
  marker: Sprite;
  showMarker(): void;
  hideMarker(): void;
};

export function createWaterWorldLevel(assets: {
  groundAtlas: Texture;
  groundPath: string;
  marker: Sprite;
  hideoutTexture: Texture;
}, context: SceneContext): WaterWorldLevel {
  const root = createWaterWorldScene(
    assets.groundAtlas,
    assets.groundPath,
    assets.marker,
  );
  root.label = "level-water-world";
  root.visible = false;
  context.layers.scenes.addChild(root);
  assets.marker.visible = false;
  const obstacles = new Container();
  obstacles.label = "water-hideouts";
  obstacles.visible = false;
  const bushes = createBushes(
    obstacles,
    assets.hideoutTexture,
    WATER_LEVEL_DESIGN.hideouts ?? [],
    true,
  );
  context.layers.world.addChild(obstacles);
  const { getCover, getNearestBush, setHideFeedback, refreshVisualScale } =
    createBushCoverSystem(obstacles, bushes);

  const showMarker = () => {
    assets.marker.visible = true;
  };
  const hideMarker = () => {
    assets.marker.visible = false;
  };

  const dispose = () => {
    root.destroy({ children: true });
    obstacles.destroy({ children: true });
  };

  return {
    id: "water-world",
    root,
    obstacles,
    bushes,
    getCover,
    getNearestBush,
    setHideFeedback,
    refreshVisualScale,
    design: WATER_LEVEL_DESIGN,
    assetManifest: WATER_WORLD_ASSET_MANIFEST,
    context,
    marker: assets.marker,
    enter() {
      root.visible = true;
      obstacles.visible = true;
      showMarker();
    },
    exit() {
      root.visible = false;
      obstacles.visible = false;
      hideMarker();
    },
    update() {},
    dispose,
    destroy: dispose,
    showMarker,
    hideMarker,
  };
}
