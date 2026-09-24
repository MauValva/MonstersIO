import { Container, Sprite, TilingSprite, Texture } from "pixi.js";
import { PLAYABLE_BOUNDS, PLANT_POSITIONS, WORLD } from "../config/game-config";
import { gridTextures } from "../art-textures";

export type Bush = {
  sprite: Sprite;
  x: number;
  y: number;
  width: number;
  height: number;
  flipX: number;
};

export function createWorldScene(
  world: Container,
  groundAtlas: Texture,
  groundPath: string,
  plantTexture: Texture,
) {
  const groundFrames = gridTextures(groundAtlas, groundPath, 3, 1);
  const groundTileSize = groundFrames[0].width;
  const groundResolutionScale = 724 / groundTileSize;
  const waterGround = new TilingSprite({ texture: groundFrames[2], width: WORLD.width, height: WORLD.height });
  waterGround.position.set(0, WORLD.top);
  waterGround.tileScale.set(0.42 * groundResolutionScale);
  world.addChild(waterGround);
  const grassGround = new TilingSprite({
    texture: groundFrames[0],
    width: PLAYABLE_BOUNDS.right - PLAYABLE_BOUNDS.left,
    height: PLAYABLE_BOUNDS.bottom - PLAYABLE_BOUNDS.top,
  });
  grassGround.position.set(PLAYABLE_BOUNDS.left, PLAYABLE_BOUNDS.top);
  grassGround.tileScale.set(0.42 * groundResolutionScale);
  world.addChild(grassGround);
  const shorelineScale = 0.38 * groundResolutionScale;
  const shorelineWidth = groundTileSize * shorelineScale;
  const verticalShore = (x: number, rotation: number) => {
    const shore = new TilingSprite({ texture: groundFrames[1], width: shorelineWidth, height: WORLD.height });
    shore.anchor.set(0.5);
    shore.position.set(x, (WORLD.top + WORLD.bottom) / 2);
    shore.rotation = rotation;
    shore.tileScale.set(shorelineScale);
    world.addChild(shore);
  };
  const horizontalShore = (y: number, rotation: number) => {
    const shore = new TilingSprite({ texture: groundFrames[1], width: shorelineWidth, height: WORLD.width });
    shore.anchor.set(0.5);
    shore.position.set(WORLD.width / 2, y);
    shore.rotation = rotation;
    shore.tileScale.set(shorelineScale);
    world.addChild(shore);
  };
  verticalShore(PLAYABLE_BOUNDS.left, Math.PI);
  verticalShore(PLAYABLE_BOUNDS.right, 0);
  horizontalShore(PLAYABLE_BOUNDS.top, -Math.PI / 2);
  horizontalShore(PLAYABLE_BOUNDS.bottom, Math.PI / 2);
  const obstacles = new Container();
  world.addChild(obstacles);
  const bushes: Bush[] = [];
  for (const position of PLANT_POSITIONS) {
    const plant = new Sprite(plantTexture);
    const sizeVariation = 0.82 + Math.random() * 0.36;
    plant.anchor.set(0.5, 0.88);
    plant.position.set(position.x, position.y);
    const baseWidth = (150 + Math.random() * 45) * sizeVariation;
    const baseHeight = (140 + Math.random() * 55) * sizeVariation;
    const flipX = Math.random() < 0.5 ? 1 : -1;
    plant.width = baseWidth;
    plant.height = baseHeight;
    plant.scale.x *= flipX;
    obstacles.addChild(plant);
    bushes.push({ sprite: plant, x: position.x, y: position.y, width: plant.width, height: plant.height, flipX });
  }
  return { obstacles, bushes };
}
