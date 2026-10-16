import { Container, Rectangle, Sprite, TilingSprite, Texture } from "pixi.js";
import { PLAYABLE_BOUNDS, PLANT_POSITIONS, WORLD } from "../config/game-config";
import type { Point } from "../game/types";

export type Bush = {
  sprite: Sprite;
  x: number;
  y: number;
  width: number;
  height: number;
  flipX: number;
};

const BUSH_SIZE_MULTIPLIER = 1.15;

export function createBushes(
  obstacles: Container,
  plantTexture: Texture,
  positions: readonly Point[],
  preserveAspectRatio = false,
) {
  const bushes: Bush[] = [];
  for (const position of positions) {
    const plant = new Sprite(plantTexture);
    const sizeVariation = 0.82 + Math.random() * 0.36;
    plant.anchor.set(0.5, 0.88);
    plant.position.set(position.x, position.y);
    const baseWidth = (150 + Math.random() * 45) * sizeVariation * BUSH_SIZE_MULTIPLIER;
    const baseHeight = (140 + Math.random() * 55) * sizeVariation * BUSH_SIZE_MULTIPLIER;
    const flipX = Math.random() < 0.5 ? 1 : -1;
    if (preserveAspectRatio) {
      const fitScale = Math.min(
        baseWidth / Math.max(1, plantTexture.width),
        baseHeight / Math.max(1, plantTexture.height),
      );
      plant.scale.set(fitScale);
    } else {
      plant.width = baseWidth;
      plant.height = baseHeight;
    }
    plant.scale.x *= flipX;
    obstacles.addChild(plant);
    bushes.push({ sprite: plant, x: position.x, y: position.y, width: plant.width, height: plant.height, flipX });
  }
  return bushes;
}

export function createWorldScene(
  world: Container,
  groundAtlas: Texture,
  groundPath: string,
  plantTexture: Texture,
  edgeStoneTexture: Texture,
) {
  // The original atlas is three 512px tiles separated by 1px guide columns.
  // The optimized derivative adds 2px repeat guards around each 512px frame.
  // Keep both layouts explicit instead of deriving fractional cell widths.
  const groundFrames = Array.from({ length: 3 }, (_, index) => {
    const optimized = groundPath.includes("/Optimized/");
    const cellSize = optimized ? 516 : 513;
    const inset = optimized ? 2 : 0;
    const originalStarts = [0, 513, 1027];
    return new Texture({
      source: groundAtlas.source,
      frame: new Rectangle(
        optimized ? index * cellSize + inset : originalStarts[index],
        inset,
        512,
        512,
      ),
    });
  });
  // Base pass: grass remains underneath the entire world, while water fills
  // the regions outside the playable bounds.
  const grassGround = new TilingSprite({
    texture: groundFrames[0],
    width: WORLD.width,
    height: WORLD.height,
  });
  grassGround.anchor.set(0.5);
  grassGround.position.set(WORLD.width / 2, (WORLD.top + WORLD.bottom) / 2);
  grassGround.rotation = Math.PI;
  grassGround.tileScale.set(0.42 * (724 / groundFrames[0].width));
  world.addChild(grassGround);
  const waterTileScale = 0.42 * (724 / groundFrames[2].width);
  const addWaterRegion = (x: number, y: number, width: number, height: number) => {
    if (width <= 0 || height <= 0) return;
    const water = new TilingSprite({
      texture: groundFrames[2],
      width,
      height,
    });
    water.position.set(x, y);
    water.tileScale.set(waterTileScale);
    world.addChild(water);
  };
  const playableHeight = PLAYABLE_BOUNDS.bottom - PLAYABLE_BOUNDS.top;
  addWaterRegion(0, WORLD.top, WORLD.width, PLAYABLE_BOUNDS.top - WORLD.top);
  addWaterRegion(0, PLAYABLE_BOUNDS.bottom, WORLD.width, WORLD.bottom - PLAYABLE_BOUNDS.bottom);
  addWaterRegion(0, PLAYABLE_BOUNDS.top, PLAYABLE_BOUNDS.left, playableHeight);
  addWaterRegion(PLAYABLE_BOUNDS.right, PLAYABLE_BOUNDS.top, WORLD.width - PLAYABLE_BOUNDS.right, playableHeight);

  // Shoreline pass: start at the centered mixed tile and repeat it toward the
  // map corners. Its source art runs from grass to water left-to-right, so
  // each edge gets the rotation that keeps grass on the playable side.
  const mixedTileScale = waterTileScale;
  const mixedBandSize = groundFrames[1].width * mixedTileScale;
  const addMixedBoundary = (
    x: number,
    y: number,
    width: number,
    height: number,
    rotation: number,
  ) => {
    const mixed = new TilingSprite({
      texture: groundFrames[1],
      width,
      height,
    });
    mixed.anchor.set(0.5);
    mixed.position.set(x, y);
    mixed.tileScale.set(mixedTileScale);
    mixed.tileTransform.rotation = rotation;
    world.addChild(mixed);
  };
  const playableWidth = PLAYABLE_BOUNDS.right - PLAYABLE_BOUNDS.left;
  const playableCenterX = (PLAYABLE_BOUNDS.left + PLAYABLE_BOUNDS.right) / 2;
  const playableCenterY = (PLAYABLE_BOUNDS.top + PLAYABLE_BOUNDS.bottom) / 2;
  addMixedBoundary(
    playableCenterX,
    PLAYABLE_BOUNDS.top,
    playableWidth,
    mixedBandSize,
    -Math.PI / 2,
  );
  addMixedBoundary(
    playableCenterX,
    PLAYABLE_BOUNDS.bottom,
    playableWidth,
    mixedBandSize,
    Math.PI / 2,
  );
  addMixedBoundary(
    PLAYABLE_BOUNDS.left,
    playableCenterY,
    mixedBandSize,
    playableHeight,
    Math.PI,
  );
  addMixedBoundary(
    PLAYABLE_BOUNDS.right,
    playableCenterY,
    mixedBandSize,
    playableHeight,
    0,
  );

  // Corner pass: keep the artwork orientation unchanged. Mirror only the
  // stones on the left side so they face the same way as the right side.
  const edgeStoneScale = mixedTileScale * 2;
  const addEdgeStone = (x: number, y: number, mirrorX = false) => {
    const edgeStone = new Sprite(edgeStoneTexture);
    edgeStone.anchor.set(0.5);
    edgeStone.position.set(x, y);
    edgeStone.scale.set(edgeStoneScale);
    if (mirrorX) edgeStone.scale.x *= -1;
    world.addChild(edgeStone);
  };
  addEdgeStone(PLAYABLE_BOUNDS.left, PLAYABLE_BOUNDS.top, true);
  addEdgeStone(PLAYABLE_BOUNDS.right, PLAYABLE_BOUNDS.top);
  addEdgeStone(PLAYABLE_BOUNDS.left - 48, PLAYABLE_BOUNDS.bottom, true);
  addEdgeStone(PLAYABLE_BOUNDS.right + 48, PLAYABLE_BOUNDS.bottom);

  const obstacles = new Container();
  world.addChild(obstacles);
  const bushes = createBushes(obstacles, plantTexture, PLANT_POSITIONS);
  return { obstacles, bushes };
}
