import { Container, Texture } from "pixi.js";
import type { Point } from "../../game/types";
import type { SceneContext } from "../../game/scene-context";
import { GRASS_LEVEL_DESIGN } from "./grass-level-design";
import {
  createWorldScene,
  type Bush,
} from "../../world/world-scene";
import { createBushCoverSystem } from "../../world/bush-cover";
import type { Level } from "../level-types";
import { GRASS_WORLD_ASSET_MANIFEST } from "./grass-assets";

export type GrassWorldLevel = Level & {
  id: "grass-world";
  obstacles: Container;
  bushes: Bush[];
  getCover(point: Point): number;
  getNearestBush(point: Point): Bush;
  setHideFeedback(point: Point, hidden: boolean): void;
  refreshVisualScale(scale: number): void;
};

export function createGrassWorldLevel(assets: {
  groundAtlas: Texture;
  groundPath: string;
  plantTexture: Texture;
  edgeStoneTexture: Texture;
}, context: SceneContext): GrassWorldLevel {
  const root = new Container();
  root.label = "level-grass-world";
  root.visible = false;
  context.layers.scenes.addChild(root);
  const { obstacles, bushes } = createWorldScene(
    root,
    assets.groundAtlas,
    assets.groundPath,
    assets.plantTexture,
    assets.edgeStoneTexture,
  );
  // Keep terrain and foreground vegetation in separate layers so bushes can
  // cover gameplay actors without moving the complete tilemap above them.
  root.removeChild(obstacles);
  context.layers.world.addChild(obstacles);
  // The foreground vegetation is outside the scene root so it can cover
  // gameplay actors. Keep it hidden until Grass World is actually entered;
  // otherwise it would remain visible when Water World is the start scene.
  obstacles.visible = false;

  const { getCover, getNearestBush, setHideFeedback, refreshVisualScale } =
    createBushCoverSystem(obstacles, bushes);

  const dispose = () => {
    root.destroy({ children: true });
    obstacles.destroy({ children: true });
  };

  return {
    id: "grass-world",
    root,
    design: GRASS_LEVEL_DESIGN,
    assetManifest: GRASS_WORLD_ASSET_MANIFEST,
    context,
    obstacles,
    bushes,
    getCover,
    getNearestBush,
    setHideFeedback,
    refreshVisualScale,
    enter() {
      root.visible = true;
      obstacles.visible = true;
    },
    exit() {
      root.visible = false;
      obstacles.visible = false;
    },
    update() {},
    dispose,
    destroy: dispose,
  };
}
