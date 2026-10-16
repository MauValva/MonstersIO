import { Container, Rectangle, Texture, TilingSprite } from "pixi.js";
import { PLAYABLE_BOUNDS, WORLD } from "../config/game-config";

/**
 * Water World terrain built from the three-tile atlas:
 * lava floor, lava/water boundary, and water floor.
 * The boundary is deliberately placed in a layer above both floor regions.
 */
export function createWaterWorldScene(
  groundAtlas: Texture,
  groundPath: string,
  marker: Container,
) {
  const scene = new Container();
  scene.label = "water-world-scene";

  const optimized = groundPath.includes("/Optimized/");
  const cellSize = optimized ? 516 : 513;
  const inset = optimized ? 2 : 0;
  const originalStarts = [0, 513, 1027];
  const frames = Array.from({ length: 3 }, (_, index) =>
    new Texture({
      source: groundAtlas.source,
      frame: new Rectangle(
        optimized ? index * cellSize + inset : originalStarts[index],
        inset,
        512,
        512,
      ),
    }),
  );

  const tileScale = 0.42 * (724 / frames[0].width);
  const waterFloor = new TilingSprite({
    texture: frames[2],
    width: WORLD.width,
    height: WORLD.height,
  });
  waterFloor.anchor.set(0.5);
  waterFloor.position.set(WORLD.width / 2, (WORLD.top + WORLD.bottom) / 2);
  waterFloor.rotation = Math.PI;
  waterFloor.tileScale.set(tileScale);
  scene.addChild(waterFloor);

  const lavaFloor = new Container();
  const addLavaRegion = (x: number, y: number, width: number, height: number) => {
    if (width <= 0 || height <= 0) return;
    const lava = new TilingSprite({ texture: frames[0], width, height });
    lava.position.set(x, y);
    lava.tileScale.set(tileScale);
    lavaFloor.addChild(lava);
  };
  const playableWidth = PLAYABLE_BOUNDS.right - PLAYABLE_BOUNDS.left;
  const playableHeight = PLAYABLE_BOUNDS.bottom - PLAYABLE_BOUNDS.top;
  addLavaRegion(0, WORLD.top, WORLD.width, PLAYABLE_BOUNDS.top - WORLD.top);
  addLavaRegion(
    0,
    PLAYABLE_BOUNDS.bottom,
    WORLD.width,
    WORLD.bottom - PLAYABLE_BOUNDS.bottom,
  );
  addLavaRegion(
    0,
    PLAYABLE_BOUNDS.top,
    PLAYABLE_BOUNDS.left,
    playableHeight,
  );
  addLavaRegion(
    PLAYABLE_BOUNDS.right,
    PLAYABLE_BOUNDS.top,
    WORLD.width - PLAYABLE_BOUNDS.right,
    playableHeight,
  );
  scene.addChild(lavaFloor);

  // The middle atlas tile is the shoreline/limit art. Keep this container
  // after both floor layers so the boundary always renders above the ground.
  const boundaryLayer = new Container();
  const boundarySize = frames[1].width * tileScale;
  const addBoundary = (
    x: number,
    y: number,
    width: number,
    height: number,
    rotation: number,
  ) => {
    const boundary = new TilingSprite({
      texture: frames[1],
      width,
      height,
    });
    boundary.anchor.set(0.5);
    boundary.position.set(x, y);
    boundary.tileScale.set(tileScale);
    // The Water World atlas is authored in the opposite direction from the
    // Grass World boundary, so rotate the middle tile an additional 180°.
    boundary.tileTransform.rotation = rotation + Math.PI;
    boundaryLayer.addChild(boundary);
  };
  const centerX = (PLAYABLE_BOUNDS.left + PLAYABLE_BOUNDS.right) / 2;
  const centerY = (PLAYABLE_BOUNDS.top + PLAYABLE_BOUNDS.bottom) / 2;
  addBoundary(centerX, PLAYABLE_BOUNDS.top, playableWidth, boundarySize, -Math.PI / 2);
  addBoundary(centerX, PLAYABLE_BOUNDS.bottom, playableWidth, boundarySize, Math.PI / 2);
  addBoundary(PLAYABLE_BOUNDS.left, centerY, boundarySize, playableHeight, Math.PI);
  addBoundary(PLAYABLE_BOUNDS.right, centerY, boundarySize, playableHeight, 0);
  scene.addChild(boundaryLayer);

  scene.addChild(marker);
  return scene;
}
