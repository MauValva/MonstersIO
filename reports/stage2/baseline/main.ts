import "./style.css";
import { poki } from "./platform/poki";
import { GAME_ASSETS } from "./assets";
import {
  Application,
  Assets,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  TilingSprite,
  Text,
  TextStyle,
  Texture,
} from "pixi.js";

// The original play space remains the lower half. The new half is added above
// it, so the nest/home region keeps its coordinates while exploration expands
// into negative Y coordinates.
const WORLD = { width: 6200, height: 8400, top: -4200, bottom: 4200 };
const CAMERA_ZOOM = 0.64;
const RIVALS_START_ACTIVE = true;
const PLAYER_SCREEN_GAP = { left: 150, right: 150, top: 190, bottom: 175 };
const PLAYABLE_BOUNDS = {
  left: Math.max(
    110,
    Math.max(PLAYER_SCREEN_GAP.left, PLAYER_SCREEN_GAP.right) / CAMERA_ZOOM,
  ),
  right:
    WORLD.width -
    Math.max(
      110,
      Math.max(PLAYER_SCREEN_GAP.left, PLAYER_SCREEN_GAP.right) / CAMERA_ZOOM,
    ),
  top: WORLD.top + Math.max(110, PLAYER_SCREEN_GAP.top / CAMERA_ZOOM),
  bottom: WORLD.bottom - Math.max(110, PLAYER_SCREEN_GAP.bottom / CAMERA_ZOOM),
};
const STAGES = [
  { name: "Hatchling", threshold: 0, color: 0x65d5ff, scale: 1 },
  // Progression thresholds are cumulative. The first evolution is intentionally
  // early; subsequent gaps preserve the original progression curve.
  { name: "Young", threshold: 6, color: 0xffca62, scale: 1.14 },
  { name: "Alpha", threshold: 16, color: 0xf77b9b, scale: 1.3 },
  { name: "Legendary", threshold: 30, color: 0xb28cff, scale: 1.5 },
  { name: "Ember", threshold: 48, color: 0xff875f, scale: 1.62 },
  { name: "Mystic", threshold: 69, color: 0x8b7dff, scale: 1.76 },
  { name: "Titan", threshold: 94, color: 0x74e0a5, scale: 1.9 },
  { name: "Celestial", threshold: 122, color: 0xff82d5, scale: 2.04 },
  { name: "Ancient", threshold: 153, color: 0xd7a7ff, scale: 2.18 },
  { name: "Apex", threshold: 188, color: 0xffe27a, scale: 2.32 },
];

const getStageVisualScale = (stageIndex: number) =>
  STAGES[Math.min(stageIndex, STAGES.length - 1)].scale;

type Point = { x: number; y: number };

const app = new Application();
async function bootstrap() {
  const pokiReady = poki.init();
  await app.init({
    resizeTo: window,
    background: 0x122338,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio, 2),
  });
  document.querySelector("#game")!.appendChild(app.canvas);

  const world = new Container();
  const camera = new Container();
  camera.addChild(world);
  app.stage.addChild(camera);

  const drawRounded = (
    color: number,
    width: number,
    height: number,
    radius = 18,
  ) => {
    const g = new Graphics();
    g.roundRect(-width / 2, -height / 2, width, height, radius).fill(color);
    return g;
  };

  function label(content: string, size = 18, color = 0xffffff) {
    return new Text({
      text: content,
      style: new TextStyle({
        fontFamily: "Arial",
        fontSize: size,
        fontWeight: "700",
        fill: color,
      }),
    });
  }

  const [groundAtlas, nestTexture, enemyNestTexture, playerEvolutionTexture,
    playerCloudTexture, enemyTexture, upgradeUiTexture, upgradeBaseTexture,
    eggTexture, plantTexture, hudTexture] = await Promise.all([
      GAME_ASSETS.ground, GAME_ASSETS.nest, GAME_ASSETS.enemyNest, GAME_ASSETS.player,
      GAME_ASSETS.cloud, GAME_ASSETS.enemy, GAME_ASSETS.upgradeUi, GAME_ASSETS.upgradeBase,
      GAME_ASSETS.eggs, GAME_ASSETS.plant, GAME_ASSETS.hud,
    ].map((path) => Assets.load<Texture>(path)));
  // Three square artworks, left to right: grass, shoreline, and water.
  const groundTileSize = groundAtlas.width / 3;
  const groundTile = (index: number) =>
    new Texture({
      source: groundAtlas.source,
      frame: new Rectangle(
        index * groundTileSize,
        0,
        groundTileSize,
        groundAtlas.height,
      ),
    });
  const groundTiles = {
    grass: groundTile(0),
    transition: groundTile(1),
    water: groundTile(2),
  };
  const waterGround = new TilingSprite({
    texture: groundTiles.water,
    width: WORLD.width,
    height: WORLD.height,
  });
  waterGround.position.set(0, WORLD.top);
  waterGround.tileScale.set(0.42);
  world.addChild(waterGround);

  const grassGround = new TilingSprite({
    texture: groundTiles.grass,
    width: PLAYABLE_BOUNDS.right - PLAYABLE_BOUNDS.left,
    height: PLAYABLE_BOUNDS.bottom - PLAYABLE_BOUNDS.top,
  });
  grassGround.position.set(PLAYABLE_BOUNDS.left, PLAYABLE_BOUNDS.top);
  grassGround.tileScale.set(0.42);
  world.addChild(grassGround);

  // The sand line in the transition tile is centered on the existing movement
  // bounds, so the player can reach the midpoint but cannot enter the water.
  const shorelineScale = 0.38;
  const shorelineWidth = groundTileSize * shorelineScale;
  const verticalShore = (x: number, rotation: number) => {
    const shore = new TilingSprite({
      texture: groundTiles.transition,
      width: shorelineWidth,
      height: WORLD.height,
    });
    shore.anchor.set(0.5);
    shore.position.set(x, (WORLD.top + WORLD.bottom) / 2);
    shore.rotation = rotation;
    shore.tileScale.set(shorelineScale);
    world.addChild(shore);
  };
  const horizontalShore = (y: number, rotation: number) => {
    const shore = new TilingSprite({
      texture: groundTiles.transition,
      width: shorelineWidth,
      height: WORLD.width,
    });
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

  const bushes: Array<{
    sprite: Sprite;
    x: number;
    y: number;
    width: number;
    height: number;
    flipX: number;
  }> = [];
  const evolutionColumns = 5;
  const evolutionRows = 2;
  const evolutionFrameWidth = playerEvolutionTexture.width / evolutionColumns;
  const evolutionFrameHeight = playerEvolutionTexture.height / evolutionRows;
  const evolutionArtTopFractions = [
    0.635, 0.459, 0.343, 0.25, 0.172, 0.33, 0.189, 0.348, 0.124, 0.061,
  ];
  const evolutionArtBottomFractions = [
    0.004, 0.007, 0, 0.004, 0.022, 0.007, 0.007, 0, 0.015, 0.002,
  ];
  const playerEvolutionFrames = Array.from({ length: 10 }, (_, index) => {
    const column = index % evolutionColumns;
    const row = Math.floor(index / evolutionColumns);
    return new Texture({
      source: playerEvolutionTexture.source,
      frame: new Rectangle(
        column * evolutionFrameWidth,
        row * evolutionFrameHeight,
        evolutionFrameWidth,
        evolutionFrameHeight,
      ),
    });
  });
  const enemyFrameWidth = enemyTexture.width / 2;
  const enemyFrames = [0, 1].map(
    (index) =>
      new Texture({
        source: enemyTexture.source,
        frame: new Rectangle(
          index * enemyFrameWidth,
          0,
          enemyFrameWidth,
          enemyTexture.height,
        ),
      }),
  );
  const enemyNestFrameWidth = enemyNestTexture.width / 2;
  const enemyNestFrames = [0, 1].map(
    (index) =>
      new Texture({
        source: enemyNestTexture.source,
        frame: new Rectangle(
          index * enemyNestFrameWidth,
          0,
          enemyNestFrameWidth,
          enemyNestTexture.height,
        ),
      }),
  );
  const upgradeUiFrame = (
    x: number,
    y: number,
    width: number,
    height: number,
  ) =>
    new Texture({
      source: upgradeUiTexture.source,
      frame: new Rectangle(x, y, width, height),
    });
  const upgradePanelFrame = upgradeUiFrame(14, 68, 594, 602);
  const upgradeCardFrame = upgradeUiFrame(620, 101, 278, 692);
  const upgradeIconFrames = {
    speed: upgradeUiFrame(930, 176, 290, 245),
    pickupRadius: upgradeUiFrame(1210, 176, 310, 260),
    capacity: upgradeUiFrame(1512, 174, 340, 275),
  };
  const upgradeButtonFrames = {
    enabled: upgradeUiFrame(913, 500, 337, 150),
    disabled: upgradeUiFrame(1278, 501, 352, 139),
  };
  const hudFrame = (x: number, y: number, width: number, height: number) =>
    new Texture({
      source: hudTexture.source,
      frame: new Rectangle(x, y, width, height),
    });
  const hudFrames = {
    // Tight crop for the top currency plate; the next plate starts below it.
    currency: hudFrame(75, 35, 172, 62),
    // Dedicated egg/progression plate. Keep this crop tight so the atlas
    // arrow and neighboring HUD elements never bleed into the counter.
    progress: hudFrame(75, 95, 172, 58),
    ranking: hudFrame(349, 15, 278, 170),
    // A seta ocupa a área acima do rótulo NEST. O recorte anterior
    // invadia o rótulo e cortava a ponta direita da seta.
    nestArrow: hudFrame(26, 160, 137, 112),
    nestLabel: hudFrame(25, 272, 112, 35),
    full: hudFrame(265, 213, 296, 84),
  };
  const eggColumns = 5;
  const eggRows = 3;
  const eggFrameWidth = eggTexture.width / eggColumns;
  const eggFrameHeight = eggTexture.height / eggRows;
  const eggFrames = Array.from({ length: 15 }, (_, index) => {
    const column = index % eggColumns;
    const row = Math.floor(index / eggColumns);
    return new Texture({
      source: eggTexture.source,
      frame: new Rectangle(
        column * eggFrameWidth,
        row * eggFrameHeight,
        eggFrameWidth,
        eggFrameHeight,
      ),
    });
  });
  const plantPositions = [
    { x: 2450, y: 2650 },
    { x: 3550, y: 2500 },
    { x: 2050, y: 2200 },
    { x: 4100, y: 2050 },
    { x: 1500, y: 1600 },
    { x: 4700, y: 1500 },
    { x: 2300, y: 1250 },
    { x: 3600, y: 1100 },
    { x: 1200, y: 850 },
    { x: 5000, y: 700 },
    { x: 2650, y: 600 },
    { x: 3900, y: 480 },
    { x: 900, y: 300 },
    { x: 5200, y: 350 },
    { x: 2100, y: -500 },
    { x: 3600, y: -850 },
    { x: 1300, y: -1450 },
    { x: 4700, y: -1900 },
    { x: 3000, y: -2700 },
    { x: 4200, y: -3450 },
  ];
  for (const [index, position] of plantPositions.entries()) {
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
    bushes.push({
      sprite: plant,
      x: position.x,
      y: position.y,
      width: plant.width,
      height: plant.height,
      flipX,
    });
  }
  const base = new Container();
  // The nest is the safe home at the southern edge of the world. Exploration
  // naturally opens upward from here through the upgrade station.
  base.position.set(3000, 3500);
  const nestInteractionRadius = 170;
  const nestSprite = new Sprite(nestTexture);
  nestSprite.anchor.set(0.5);
  nestSprite.position.set(0, -18);
  nestSprite.scale.set(0.9);
  const basePreview = new Container();
  basePreview.position.set(0, -22);
  const basePreviewBody = new Graphics();
  const basePreviewEyes = new Graphics();
  const basePreviewEvolution = new Sprite(playerEvolutionFrames[1]);
  const basePreviewEvolutionColor = new Sprite(playerEvolutionFrames[1]);
  const basePreviewFillMask = new Graphics();
  basePreviewEvolution.anchor.set(0.5);
  basePreviewEvolutionColor.anchor.set(0.5);
  basePreviewEvolution.position.set(15, -150);
  basePreviewEvolutionColor.position.copyFrom(basePreviewEvolution.position);
  basePreviewEvolution.width = 88;
  basePreviewEvolution.height = 113;
  basePreviewEvolutionColor.width = 88;
  basePreviewEvolutionColor.height = 113;
  basePreviewEvolution.tint = 0x05070b;
  basePreviewEvolution.alpha = 0.95;
  basePreviewEvolutionColor.mask = basePreviewFillMask;
  basePreviewBody.visible = false;
  basePreviewEyes.visible = false;
  basePreview.addChild(
    basePreviewEvolution,
    basePreviewEvolutionColor,
    basePreviewFillMask,
    basePreviewBody,
    basePreviewEyes,
  );
  const nestInteractionIndicator = new Graphics();
  base.addChild(nestInteractionIndicator, nestSprite, basePreview);
  world.addChild(base);

  const upgradeStation = new Container();
  upgradeStation.position.set(3000, 3000);
  const upgradeStationShape = new Graphics()
    .circle(0, 0, 78)
    .fill({ color: 0x405b8c, alpha: 0.35 })
    .circle(0, 0, 56)
    .fill(0x344c7a)
    .circle(0, 0, 39)
    .stroke({ color: 0xb6c7ff, width: 5 });
  upgradeStationShape.visible = false;
  const upgradeBaseSprite = new Sprite(upgradeBaseTexture);
  upgradeBaseSprite.anchor.set(0.5);
  upgradeBaseSprite.width = 172;
  upgradeBaseSprite.height = 175;
  const upgradeStationCore = new Graphics();
  const upgradeStationText = label("UPGRADE", 28, 0xffffff);
  upgradeStationText.anchor.set(0.5);
  upgradeStationText.position.set(0, -92);
  const upgradeAlert = label("!", 34, 0xfff2a6);
  upgradeAlert.anchor.set(0.5);
  upgradeAlert.position.set(58, -58);
  upgradeAlert.visible = false;
  upgradeStation.addChild(
    upgradeStationShape,
    upgradeBaseSprite,
    upgradeStationCore,
    upgradeStationText,
    upgradeAlert,
  );
  world.addChild(upgradeStation);
  upgradeStation.visible = false;

  const eggLayer = new Container();
  world.addChild(eggLayer);
  type EggZone = { name: "SAFE" | "EXPLORATION" | "RISK"; bounds: { left: number; right: number; top: number; bottom: number }; target: number };
  const EGG_SPAWN_CONFIG = {
    activeTarget: 20,
    respawnMin: 2,
    respawnMax: 5,
    minBetweenEggs: 220,
    minFromPlayer: 300,
    minFromNest: 170,
    zones: [
      { name: "SAFE", bounds: { left: 2500, right: 3500, top: 2850, bottom: 3850 }, target: 2 },
      { name: "EXPLORATION", bounds: { left: 1750, right: 4450, top: 800, bottom: 2850 }, target: 6 },
      { name: "RISK", bounds: { left: 500, right: 5700, top: -3900, bottom: 800 }, target: 12 },
    ] as EggZone[],
  };
  // The first six are deliberately staged from easy/safe to progressively
  // farther north, teaching exploration before the first evolution.
  const initialEggPositions: Point[] = [
    { x: 3050, y: 3180 },
    { x: 2700, y: 3100 },
    { x: 3350, y: 3000 },
    { x: 2500, y: 2850 },
    { x: 3500, y: 2600 },
    { x: 3000, y: 2350 },
    { x: 2150, y: -700 },
    { x: 4200, y: -1600 },
    { x: 1800, y: 900 },
    { x: 3000, y: 1100 },
    { x: 4200, y: 900 },
    { x: 1400, y: 300 },
    { x: 2400, y: 0 },
    { x: 3600, y: -300 },
    { x: 5000, y: 100 },
    { x: 1000, y: -600 },
    { x: 1800, y: -1200 },
    { x: 3000, y: -1500 },
    { x: 4200, y: -1800 },
    { x: 5200, y: -2600 },
  ];
  const EGG_STYLES = [
    { shell: 0xfff2d0, outline: 0xffc77d, spot: 0xffb36b },
    { shell: 0xd7f5ff, outline: 0x65c9e8, spot: 0x5ca5ff },
    { shell: 0xffd7ed, outline: 0xed77b4, spot: 0xb85cff },
    { shell: 0xe4d7ff, outline: 0xb28cff, spot: 0x7c5cff },
  ];
  const eggs: Container[] = [];
  // Keep only live eggs in gameplay scans, and retain a small reusable reserve.
  const eggPool: Container[] = [];
  const eggMotion = new Map<
    Container,
    { phase: number; spawnElapsed: number; spawnDuration: number }
  >();
  let eggSerial = 0;
  function spawnEgg(position: Point, stageIndex: number) {
    const eggFrame = eggFrames[Math.min(stageIndex, eggFrames.length - 1)];
    const safePosition = {
      x: Math.max(
        PLAYABLE_BOUNDS.left + 30,
        Math.min(PLAYABLE_BOUNDS.right - 30, position.x),
      ),
      y: Math.max(
        PLAYABLE_BOUNDS.top + 30,
        Math.min(PLAYABLE_BOUNDS.bottom - 30, position.y),
      ),
    };
    const egg = eggPool.pop() ?? new Container();
    egg.visible = true;
    egg.position.set(safePosition.x, safePosition.y);
    egg.label = `egg-${eggSerial++}`;
    const eggSprite = (egg.children[0] as Sprite | undefined) ?? new Sprite(eggFrame);
    eggSprite.texture = eggFrame;
    eggSprite.position.set(0);
    eggSprite.rotation = 0;
    eggSprite.anchor.set(0.5);
    eggSprite.scale.set(
      0.19 * (1 + (getStageVisualScale(stageIndex) - 1) * 0.42),
    );
    if (eggSprite.parent !== egg) egg.addChild(eggSprite);
    egg.scale.set(0.12);
    eggLayer.addChild(egg);
    eggs.push(egg);
    eggMotion.set(egg, {
      phase: Math.random() * Math.PI * 2,
      spawnElapsed: 0,
      spawnDuration: 0.42,
    });
    return egg;
  }
  initialEggPositions.forEach((position) => spawnEgg(position, 0));

  const player = new Container();
  player.position.set(3000, 3300);
  const playerBody = new Graphics();
  const playerEyes = new Graphics();
  const playerCloud = new Sprite(playerCloudTexture);
  playerCloud.anchor.set(0.5);
  playerCloud.position.set(0, 52);
  playerCloud.width = 118;
  playerCloud.height = 59;
  const playerEvolution = new Sprite(playerEvolutionFrames[0]);
  playerEvolution.anchor.set(0.5);
  playerEvolution.position.set(0, -10);
  playerEvolution.width = 105;
  playerEvolution.height = 135;
  playerBody.visible = false;
  playerEyes.visible = false;
  const pickupIndicator = new Graphics();
  player.addChild(
    pickupIndicator,
    playerCloud,
    playerEvolution,
    playerBody,
    playerEyes,
  );
  world.addChild(player);

  const getCameraTarget = (shakeX = 0, shakeY = 0) => ({
      x: Math.min(
        0,
      Math.max(
        window.innerWidth - WORLD.width * CAMERA_ZOOM,
        window.innerWidth / 2 - player.x * CAMERA_ZOOM + shakeX,
      ),
      ),
    y: Math.min(
      -WORLD.top * CAMERA_ZOOM,
      Math.max(
        window.innerHeight - WORLD.bottom * CAMERA_ZOOM,
        window.innerHeight / 2 - player.y * CAMERA_ZOOM + shakeY,
      ),
    ),
  });

  // Start centered on the player. The ticker smoothly follows the player
  // afterward, but must not animate from the world origin on the first frame.
  camera.scale.set(CAMERA_ZOOM);
  const initialCameraTarget = getCameraTarget();
  camera.position.set(initialCameraTarget.x, initialCameraTarget.y);

  type PlayerUpgrades = {
    speed: number;
    pickupRadius: number;
  };
  const upgrades: PlayerUpgrades = {
    speed: 280,
    pickupRadius: 92,
  };
  const upgradeLevels = { speed: 0, pickupRadius: 0 };
  let upgradePoints = 0;
  let carried = 0;
  let delivered = 0;
  let skinIndex = 0;
  let time = 0;
  let currency = 0;
  let playerCollected = 0;
  let playerHidden = false;
  let pickupFlash = 0;
  let cameraShakeTime = 0;
  let cameraShakeDuration = 0;
  let cameraShakeStrength = 0;
  let depositing = false;
  let depositElapsed = 0;
  let depositingEggs: Container[] = [];
  let depositArrivals: boolean[] = [];
  let baseVisualDelivered = 0;
  let evolving = false;
  let nestPreviewJuiceElapsed = 0;
  let nestPreviewJuiceActive = false;
  let upgradeContactProgress = 0;
  let upgradeMenuOpen = false;
  // Debug: mantenha true para abrir o menu automaticamente durante os testes.
  const DEBUG_OPEN_UPGRADE_MENU = false;
  let upgradeStationArmed = true;
  let upgradeStationUnlocked = false;
  let upgradeFtueVisible = false;
  let upgradeSpawnElapsed = 0;
  let firstUpgradeCompleted = false;
  let firstEnemySeen = false;
  let redIntroChaseCompleted = false;
  let redIntroChaseHadEggs = false;
  let hideTutorialCompleted = false;
  let nestTutorialShown = false;
  let nestOffscreenElapsed = 0;
  let hideTutorialBush: (typeof bushes)[number] | null = null;
  const carriedEggs: Container[] = [];
  const FOLLOW_DISTANCE = 68;
  const getCurrentVisualScale = () => getStageVisualScale(skinIndex);
  const getEggWorldSpriteScale = () =>
    0.19 * Math.min(1.22, 1 + (getCurrentVisualScale() - 1) * 0.42);
  const getCarriedEggScale = () =>
    0.67 * Math.min(1.18, 1 + (getCurrentVisualScale() - 1) * 0.38);
  const getCarriedEggGap = () => Math.max(72, 60 * getCurrentVisualScale());
  const getCarriedEggDistance = (index: number) =>
    getCarriedEggGap() + 28 + getCarriedEggGap() * index;
  type EggHideAnimation = {
    egg: Container;
    from: Point;
    to: Point;
    elapsed: number;
    hiding: boolean;
  };
  const eggHideAnimations: EggHideAnimation[] = [];
  const eggsInHideAnimation = new Set<Container>();
  function releaseEgg(egg: Container) {
    egg.removeFromParent();
    egg.visible = false;
    const index = eggs.indexOf(egg);
    if (index !== -1) eggs.splice(index, 1);
    eggMotion.delete(egg);
    eggsInHideAnimation.delete(egg);
    for (let i = eggHideAnimations.length - 1; i >= 0; i -= 1) {
      if (eggHideAnimations[i].egg === egg) eggHideAnimations.splice(i, 1);
    }
    if (eggPool.length < EGG_SPAWN_CONFIG.activeTarget) eggPool.push(egg);
    else egg.destroy({ children: true });
  }
  const input = { x: 0, y: 0 };
  let gameplayStarted = false;
  let sdkAdPlaying = false;
  const startGameplay = () => {
    if (gameplayStarted) return;
    gameplayStarted = true;
    poki.gameplayStart();
  };
  let joystickCenter: Point = { x: 0, y: 0 };
  let joystickActive = false;

  type Enemy = {
    container: Container;
    body: Graphics;
    eyes: Graphics;
    art: Sprite;
    cloud: Sprite;
    eggs: Container[];
    target: Container | null;
    speed: number;
    homeBase: Container;
    dazedUntil: number;
    collected: number;
    depositing: boolean;
  };
  function createEnemyBase(
    position: Point,
    color: number,
    artTexture: Texture,
  ) {
    const enemyBase = new Container();
    enemyBase.position.set(position.x, position.y);
    enemyBase.visible = false;
    const nestArt = new Sprite(artTexture);
    nestArt.anchor.set(0.5);
    nestArt.scale.set(0.26);
    enemyBase.addChild(nestArt);
    const baseLabel = label("RIVAL NEST", 13, color);
    baseLabel.anchor.set(0.5);
    baseLabel.position.set(0, 62);
    enemyBase.addChild(baseLabel);
    world.addChild(enemyBase);
    return enemyBase;
  }
  function createEnemy(
    position: Point,
    color: number,
    homeBase: Container,
    artTexture: Texture,
  ): Enemy {
    const container = new Container();
    container.position.set(position.x, position.y);
    const body = new Graphics()
      .circle(0, 0, 42)
      .fill(color)
      .circle(0, 0, 29)
      .fill({ color: 0xffffff, alpha: 0.14 });
    const eyes = new Graphics()
      .ellipse(-13, -7, 6, 10)
      .fill(0x18263b)
      .ellipse(13, -7, 6, 10)
      .fill(0x18263b);
    const cloud = new Sprite(playerCloudTexture);
    cloud.anchor.set(0.5);
    cloud.position.set(0, 48);
    cloud.width = 124;
    cloud.height = 62;
    cloud.tint = color === 0xff6f78 ? 0xff9c9c : 0xd7b8ff;
    const art = new Sprite(artTexture);
    art.anchor.set(0.5);
    art.position.set(0, -12);
    art.width = 112;
    art.height = 112;
    body.visible = false;
    eyes.visible = false;
    container.addChild(cloud, art, body, eyes);
    world.addChild(container);
    container.visible = false;
    return {
      container,
      body,
      eyes,
      art,
      cloud,
      eggs: [],
      target: null,
      speed: 155,
      homeBase,
      dazedUntil: 0,
      collected: 0,
      depositing: false,
    };
  }
  const enemyBases = [
    createEnemyBase({ x: 2200, y: 850 }, 0xff6f78, enemyNestFrames[0]),
    createEnemyBase({ x: 4700, y: -1500 }, 0x9c7dff, enemyNestFrames[1]),
  ];
  const enemies: Enemy[] = [
    createEnemy({ x: 2200, y: 850 }, 0xff6f78, enemyBases[0], enemyFrames[0]),
    createEnemy({ x: 4400, y: -1200 }, 0x9c7dff, enemyBases[1], enemyFrames[1]),
  ];
  type EnemyDepositAnimation = {
    enemy: Enemy;
    eggs: Container[];
    elapsed: number;
  };
  const enemyDepositAnimations: EnemyDepositAnimation[] = [];
  // A vegetação fica na frente dos personagens e dos ovos no mapa.
  world.setChildIndex(obstacles, world.children.length - 1);
  function setEggWorldSpriteScale(egg: Container) {
    const sprite = egg.children[0];
    if (sprite instanceof Sprite) sprite.scale.set(getEggWorldSpriteScale());
  }
  function refreshProgressionVisuals() {
    const progressionScale = getCurrentVisualScale();
    const bushScale = Math.min(1.18, 1 + (progressionScale - 1) * 0.2);
    for (const bush of bushes) {
      bush.sprite.width = bush.width * bushScale;
      bush.sprite.height = bush.height * bushScale;
      bush.sprite.scale.x = bush.flipX * Math.abs(bush.sprite.scale.x);
    }
    for (const egg of eggs) setEggWorldSpriteScale(egg);
    for (const egg of carriedEggs) {
      setEggWorldSpriteScale(egg);
      egg.scale.set(getCarriedEggScale());
    }
    for (const enemy of enemies) {
      enemy.container.scale.set(
        Math.min(1.16, 1 + (progressionScale - 1) * 0.3),
      );
      for (const egg of enemy.eggs) {
        setEggWorldSpriteScale(egg);
        egg.scale.set(getCarriedEggScale() * 0.84);
      }
    }
  }

  function refreshRanking() {
    const scores = [
      { name: "YOU", score: playerCollected },
      { name: "RIVAL 1", score: enemies[0].collected },
      { name: "RIVAL 2", score: enemies[1].collected },
    ].sort((a, b) => b.score - a.score);
    scores.forEach((entry, index) => {
      rankingRows[index].text = `${index + 1}. ${entry.name}  ${entry.score}`;
    });
  }

  function redrawPlayer() {
    const stage = STAGES[Math.min(skinIndex, STAGES.length - 1)];
    playerEvolution.texture =
      playerEvolutionFrames[
        Math.min(skinIndex, playerEvolutionFrames.length - 1)
      ];
    playerEvolution.width = 105 * stage.scale;
    playerEvolution.height = 135 * stage.scale;
    playerCloud.width = 118 * stage.scale;
    playerCloud.height = 59 * stage.scale;
    playerCloud.position.set(0, 52 * stage.scale);
    playerCloud.visible = skinIndex < STAGES.length - 2;
    playerEvolution.position.set(0, -10 * stage.scale);
    playerBody
      .clear()
      .circle(0, 0, 45 * stage.scale)
      .fill(stage.color)
      .circle(0, 0, 31 * stage.scale)
      .fill({ color: 0xffffff, alpha: 0.14 });
    playerEyes
      .clear()
      .ellipse(-14 * stage.scale, -7 * stage.scale, 6, 10)
      .fill(0x18263b)
      .ellipse(14 * stage.scale, -7 * stage.scale, 6, 10)
      .fill(0x18263b);
    player.scale.set(1);
    refreshProgressionVisuals();
    pickupIndicator.clear();
    const segments = 36;
    for (let i = 0; i < segments; i += 2) {
      const start = (i / segments) * Math.PI * 2;
      const end = ((i + 1) / segments) * Math.PI * 2;
      pickupIndicator.moveTo(
        Math.cos(start) * upgrades.pickupRadius,
        Math.sin(start) * upgrades.pickupRadius,
      );
      pickupIndicator
        .arc(0, 0, upgrades.pickupRadius, start, end)
        .stroke({ color: 0xfff2a6, alpha: 0.9, width: 3 });
    }
    pickupIndicator.alpha = 0.48;
  }
  redrawPlayer();

  function getBushCover(point: Point) {
    return bushes.reduce((maxCover, bush) => {
      const bushCenterY = bush.y - bush.height * 0.44;
      const normalizedX = (point.x - bush.x) / (bush.width * 0.5);
      const normalizedY = (point.y - bushCenterY) / (bush.height * 0.5);
      const cover = Math.max(0, 1 - Math.hypot(normalizedX, normalizedY));
      return Math.max(maxCover, cover);
    }, 0);
  }

  function updateBushHideFeedback(hidden: boolean) {
    let hidingBush: (typeof bushes)[number] | null = null;
    if (hidden) {
      hidingBush = bushes.reduce((best, bush) => {
        const bushCenterY = bush.y - bush.height * 0.44;
        const normalizedX = (player.x - bush.x) / (bush.width * 0.5);
        const normalizedY = (player.y - bushCenterY) / (bush.height * 0.5);
        const cover = Math.max(0, 1 - Math.hypot(normalizedX, normalizedY));
        if (!best) return cover >= 0.55 ? bush : null;
        const bestCenterY = best.y - best.height * 0.44;
        const bestCover = Math.max(
          0,
          1 -
            Math.hypot(
              (player.x - best.x) / (best.width * 0.5),
              (player.y - bestCenterY) / (best.height * 0.5),
            ),
        );
        return cover > bestCover ? bush : best;
      }, null as (typeof bushes)[number] | null);
    }
    for (const bush of bushes) {
      bush.sprite.alpha = hidingBush === bush ? 0.42 : 1;
    }
  }

  function animateCarriedEggsForBush(hiding: boolean) {
    eggHideAnimations.length = 0;
    eggsInHideAnimation.clear();
    if (carriedEggs.length === 0) return;
    const bush = bushes.reduce((closest, candidate) => {
      const currentDistance = distance(player.position, {
        x: candidate.x,
        y: candidate.y - candidate.height * 0.44,
      });
      const closestDistance = distance(player.position, {
        x: closest.x,
        y: closest.y - closest.height * 0.44,
      });
      return currentDistance < closestDistance ? candidate : closest;
    }, bushes[0]);
    carriedEggs.forEach((egg, index) => {
      // Keep the previous hide animation: move the queue into the selected
      // bush, but leave the eggs visible through the semitransparent bush.
      const target = hiding
        ? {
            x: bush.x + (index - (carriedEggs.length - 1) / 2) * 16,
            y: bush.y - bush.height * 0.44 + 8,
          }
        : {
            x: player.x - getCarriedEggDistance(index),
            y: player.y,
          };
      egg.visible = true;
      eggsInHideAnimation.add(egg);
      eggHideAnimations.push({
        egg,
        from: { x: egg.x, y: egg.y },
        to: target,
        elapsed: 0,
        hiding: false,
      });
    });
  }

  function updateCarriedEggBushAnimations(dt: number) {
    for (let i = eggHideAnimations.length - 1; i >= 0; i -= 1) {
      const animation = eggHideAnimations[i];
      animation.elapsed += dt;
      const progress = Math.min(1, animation.elapsed / 0.42);
      const eased = 1 - (1 - progress) ** 3;
      animation.egg.position.set(
        animation.from.x + (animation.to.x - animation.from.x) * eased,
        animation.from.y + (animation.to.y - animation.from.y) * eased,
      );
      animation.egg.scale.set(
        getCarriedEggScale() * (1 + Math.sin(progress * Math.PI) * 0.28),
      );
      if (progress >= 1) {
        animation.egg.scale.set(getCarriedEggScale());
        animation.egg.visible = animation.hiding ? false : true;
        eggsInHideAnimation.delete(animation.egg);
        eggHideAnimations.splice(i, 1);
      }
    }
  }

  let previewState: { skin: number; delivered: number; evolving: boolean } | undefined;
  function redrawBasePreview() {
    if (previewState?.skin === skinIndex &&
        previewState.delivered === baseVisualDelivered &&
        previewState.evolving === evolving) return;
    previewState = { skin: skinIndex, delivered: baseVisualDelivered, evolving };
    const nextIndex = Math.min(skinIndex + 1, STAGES.length - 1);
    const nextStage = STAGES[nextIndex];
    const threshold = nextStage.threshold;
    const previousThreshold = STAGES[Math.max(0, nextIndex - 1)].threshold;
    const progress =
      nextIndex === skinIndex
        ? 0
        : Math.min(
            1,
            Math.max(
              0,
              (baseVisualDelivered - previousThreshold) /
                Math.max(1, threshold - previousThreshold),
            ),
          );
    basePreview.visible = nextIndex > skinIndex && !evolving;
    const radius = 37 * nextStage.scale;
    basePreviewEvolution.texture = playerEvolutionFrames[nextIndex];
    basePreviewEvolutionColor.texture = playerEvolutionFrames[nextIndex];
    basePreviewEvolutionColor.position.copyFrom(basePreviewEvolution.position);
    basePreviewEvolution.width = 176 * nextStage.scale;
    basePreviewEvolution.height = 226 * nextStage.scale;
    basePreviewEvolutionColor.width = basePreviewEvolution.width;
    basePreviewEvolutionColor.height = basePreviewEvolution.height;
    basePreviewBody
      .clear()
      .circle(0, 0, radius)
      .fill({ color: 0x05070b, alpha: 0.95 });
    basePreviewEyes
      .clear()
      .ellipse(
        -12 * nextStage.scale,
        -5 * nextStage.scale,
        5 * nextStage.scale,
        8 * nextStage.scale,
      )
      .fill(0x05070b)
      .ellipse(
        12 * nextStage.scale,
        -5 * nextStage.scale,
        5 * nextStage.scale,
        8 * nextStage.scale,
      )
      .fill(0x05070b);
    const previewWidth = basePreviewEvolutionColor.width;
    const previewHeight = basePreviewEvolutionColor.height;
    const previewX = basePreviewEvolutionColor.x - previewWidth / 2;
    // Os frames têm transparência acima do monstrinho; o preenchimento
    // considera apenas a área útil da arte, alinhada pelos pés.
    const frameArtIndex = Math.min(
      nextIndex,
      evolutionArtTopFractions.length - 1,
    );
    const previewArtTop =
      basePreviewEvolutionColor.y -
      previewHeight / 2 +
      previewHeight * evolutionArtTopFractions[frameArtIndex];
    const previewArtBottom =
      basePreviewEvolutionColor.y +
      previewHeight / 2 -
      previewHeight * evolutionArtBottomFractions[frameArtIndex];
    const previewArtHeight = previewArtBottom - previewArtTop;
    basePreviewFillMask
      .clear()
      .rect(
        previewX,
        previewArtBottom - previewArtHeight * progress,
        previewWidth,
        previewArtHeight * progress,
      )
      .fill(0xffffff);
    nestInteractionIndicator.clear();
    const segments = 36;
    for (let i = 0; i < segments; i += 2) {
      const start = (i / segments) * Math.PI * 2;
      const end = ((i + 1) / segments) * Math.PI * 2;
      nestInteractionIndicator
        .moveTo(
          Math.cos(start) * nestInteractionRadius,
          Math.sin(start) * nestInteractionRadius,
        )
        .arc(0, 0, nestInteractionRadius, start, end)
        .stroke({ color: 0xfff2a6, alpha: 0.42, width: 4 });
    }
  }
  redrawBasePreview();

  const ui = new Container();
  app.stage.addChild(ui);
  const header = drawRounded(0x102235, 360, 96, 20);
  header.position.set(window.innerWidth / 2, 58);
  ui.addChild(header);
  header.visible = false;
  const progressText = label("", 19);
  progressText.anchor.set(0.5);
  const progressBadge = new Sprite(hudFrames.progress);
  progressBadge.anchor.set(0.5);
  progressBadge.width = 135;
  progressBadge.height = (135 * 58) / 172;
  progressBadge.position.set(62, 160);
  progressBadge.addChild(progressText);
  progressText.position.set(20, -4);
  ui.addChild(progressBadge);
  const stageText = label("", 17, 0x9cf4d2);
  stageText.position.set(-160, 12);
  header.addChild(stageText);
  stageText.visible = false;
  const skinText = label("", 17);
  skinText.position.set(-160, 12);
  header.addChild(skinText);
  const currencyBadge = new Sprite(hudFrames.currency);
  currencyBadge.anchor.set(0.5);
  currencyBadge.width = 135;
  currencyBadge.height = (135 * 62) / 172;
  currencyBadge.position.set(62, 102);
  ui.addChild(currencyBadge);
  const currencyText = label("◆ 0", 19, 0xfff2a6);
  currencyText.anchor.set(0.5);
  currencyText.text = "0";
  currencyText.position.set(20, -2);
  currencyBadge.addChild(currencyText);
  const rankingPanel = new Sprite(hudFrames.ranking);
  rankingPanel.anchor.set(0.5);
  rankingPanel.width = 175;
  rankingPanel.height = (175 * 170) / 278;
  rankingPanel.position.set(window.innerWidth - 88, 75);
  ui.addChild(rankingPanel);
  const rankingRows = [
    label("", 13),
    label("", 13, 0xff6f78),
    label("", 13, 0x9c7dff),
  ];
  rankingRows.forEach((row, index) => {
    row.position.set(-58, -2 + index * 18);
    rankingPanel.addChild(row);
  });

  const upgradeOverlay = new Graphics()
    .rect(0, 0, window.innerWidth, window.innerHeight)
    .fill({ color: 0x000000, alpha: 0.74 });
  upgradeOverlay.eventMode = "static";
  upgradeOverlay.on("pointerdown", (event) => event.stopPropagation());
  ui.addChild(upgradeOverlay);
  const upgradePanel = new Graphics();
  const upgradePanelArt = new Sprite(upgradePanelFrame);
  upgradePanelArt.anchor.set(0.5);
  upgradePanelArt.width = 820;
  upgradePanelArt.height = 720;
  upgradePanel.addChildAt(upgradePanelArt, 0);
  upgradePanel.position.set(window.innerWidth / 2, window.innerHeight / 2);
  ui.addChild(upgradePanel);
  upgradePanel.visible = false;
  upgradeOverlay.visible = false;
  const upgradeHeader = new Graphics()
    .roundRect(-220, -275, 440, 104, 26)
    .fill(0x294a68)
    .stroke({ color: 0x557997, width: 5 });
  upgradeHeader.visible = false;
  upgradePanel.addChild(upgradeHeader);
  const upgradeTitle = label("UPGRADES", 34, 0xfff0d1);
  upgradePanel.addChild(upgradeTitle);
  const upgradeText = label("", 14, 0xd3e9ed);
  upgradeText.position.set(-134, -48);
  upgradePanel.addChild(upgradeText);
  upgradeTitle.text = "UPGRADES";
  upgradeTitle.style.fontSize = 48;
  upgradeTitle.anchor.set(0.5);
  upgradeTitle.position.set(0, -280);
  upgradeTitle.style.fontWeight = "900";
  const upgradeCurrencyText = label("0", 36, 0xfff2a6);
  upgradeCurrencyText.anchor.set(0.5);
  upgradeCurrencyText.position.set(0, -200);
  const upgradeCurrencyPill = new Graphics()
    .roundRect(-92, -174, 184, 64, 24)
    .fill(0x0b2035)
    .stroke({ color: 0x315b79, width: 4 });
  upgradeCurrencyPill.position.set(0, -60);
  const currencyGem = new Sprite(upgradeUiFrame(1622, 493, 164, 164));
  currencyGem.anchor.set(0.5);
  currencyGem.position.set(-42, -200);
  currencyGem.width = 28;
  currencyGem.height = 28;
  upgradePanel.addChild(upgradeCurrencyPill);
  upgradePanel.addChild(currencyGem);
  upgradePanel.addChild(upgradeCurrencyText);
  upgradeTitle.position.set(0, -280);
  const upgradeHint = label("", 11, 0x9cb8c2);
  upgradeHint.position.set(0, 0);
  upgradePanel.addChild(upgradeHint);
  upgradeHint.visible = false;
  const closeUpgradeButton = drawRounded(0xc85162, 62, 62, 16);
  closeUpgradeButton.position.set(350, -260);
  const closeButtonArt = new Sprite(upgradeUiFrame(1790, 490, 190, 190));
  closeButtonArt.anchor.set(0.5);
  closeButtonArt.width = 100;
  closeButtonArt.height = 100;
  closeUpgradeButton.addChildAt(closeButtonArt, 0);
  closeUpgradeButton.eventMode = "static";
  closeUpgradeButton.cursor = "pointer";
  const closeUpgradeText = label("X", 30);
  closeUpgradeText.visible = false;
  closeUpgradeText.anchor.set(0.5);
  closeUpgradeText.position.set(0, 100);
  closeUpgradeButton.addChild(closeUpgradeText);
  upgradePanel.addChild(closeUpgradeButton);
  const upgradeButtons = (
    [
      {
        x: -115,
        y: 110,
        key: "speed",
        name: "SPEED",
        detail: () => `${upgrades.speed}  →  ${upgrades.speed + 45}`,
        apply: () => {
          upgrades.speed += 45;
        },
      },
      {
        x: 115,
        y: 110,
        key: "pickupRadius",
        name: "PICKUP\nRANGE",
        detail: () =>
          `${upgrades.pickupRadius}  →  ${upgrades.pickupRadius + 18}`,
        apply: () => {
          upgrades.pickupRadius += 18;
        },
      },
    ] as Array<{
      x: number;
      y: number;
      key: keyof PlayerUpgrades;
      name: string;
      detail: () => string;
      apply: () => void;
    }>
  ).map(({ x, y, key, name, detail, apply }) => {
    const button = new Graphics();
    button.position.set(x, y);
    const cardArt = new Sprite(upgradeCardFrame);
    cardArt.anchor.set(0.5);
    cardArt.width = 230;
    cardArt.height = 520;
    button.addChildAt(cardArt, 0);
    button.eventMode = "static";
    button.cursor = "pointer";
    const buttonText = label("", 11);
    buttonText.anchor.set(0.5);
    buttonText.style.align = "center";
    buttonText.position.set(0, 0);
    buttonText.visible = false;
    button.addChild(buttonText);
    const icon = new Sprite(upgradeIconFrames[key]);
    icon.anchor.set(0.5);
    icon.position.set(0, -180);
    icon.width = 116;
    icon.height = 98;
    button.addChild(icon);
    const cardTitle = label(name, 28, 0xffffff);
    cardTitle.anchor.set(0.5);
    cardTitle.position.set(0, -110);
    cardTitle.style.align = "center";
    button.addChild(cardTitle);
    const cardDetail = label("", 28, 0xf5ffff);
    cardDetail.anchor.set(0.5);
    cardDetail.position.set(0, -45);
    cardDetail.style.align = "center";
    button.addChild(cardDetail);
    const cardDelta = label("+ upgrade", 28, 0xa8ff91);
    cardDelta.anchor.set(0.5);
    cardDelta.position.set(0, 3);
    button.addChild(cardDelta);
    const cardCost = label("", 28, 0xffe39a);
    cardCost.anchor.set(0.5);
    cardCost.position.set(0, 50);
    button.addChild(cardCost);
    const actionButton = new Sprite(upgradeButtonFrames.enabled);
    actionButton.anchor.set(0.5);
    actionButton.position.set(7, 115);
    actionButton.width = 200;
    actionButton.height = 70;
    const actionText = label("UPGRADE", 32, 0xf5ffff);
    actionText.anchor.set(0.5);
    actionText.position.set(-10, 0);
    actionButton.addChild(actionText);
    button.addChild(actionButton);
    button.on("pointertap", () => {
      const cost = 20 + upgradeLevels[key] * 15;
      if (currency < cost) return;
      currency -= cost;
      upgradeLevels[key] += 1;
      if (!firstUpgradeCompleted) {
        firstUpgradeCompleted = true;
        upgradeFtueVisible = false;
        clearTutorialTarget("UPGRADE");
        if (firstEnemySeen && carried >= 5 && !hideTutorialCompleted)
          setTutorialTarget("BUSH");
      }
      apply();
      redrawPlayer();
      updateUI();
    });
    upgradePanel.addChild(button);
    return {
      button,
      buttonText,
      cardDetail,
      cardDelta,
      cardCost,
      actionButton,
      actionText,
      key,
      name,
      detail,
    };
  });
  upgradeHint.position.set(-134, 82);
  upgradeText.visible = false;
  function refreshUpgradeButtons() {
    for (const upgrade of upgradeButtons) {
      const cost = 20 + upgradeLevels[upgrade.key] * 15;
      const available = currency >= cost;
      upgrade.button.clear();
      upgrade.button.alpha = 1;
      upgrade.button.eventMode = available ? "static" : "none";
      upgrade.button.cursor = available ? "pointer" : "default";
      upgrade.cardDetail.text = upgrade.detail();
      upgrade.cardDelta.text =
        upgrade.key === "speed"
          ? "+ 45"
          : upgrade.key === "pickupRadius"
            ? "+ 18"
            : "+ 2 slots";
      upgrade.cardCost.text = `◆ ${cost}`;
      upgrade.actionButton.texture = available
        ? upgradeButtonFrames.enabled
        : upgradeButtonFrames.disabled;
      upgrade.actionText.text = available ? "UPGRADE" : "NEED CURRENCY";
      upgrade.buttonText.text = `${upgrade.name}\n\n${upgrade.detail()}\n\n◆ ${cost}`;
    }
  }
  closeUpgradeButton.on("pointertap", () => {
    upgradeMenuOpen = false;
    upgradePanel.visible = false;
    upgradeOverlay.visible = false;
    upgradeContactProgress = 0;
    upgradeStationArmed = false;
    upgradeFtueVisible = false;
    upgradeStation.rotation = 0;
    upgradeStation.scale.set(1);
    // ADS TEMPORARIAMENTE DESATIVADOS.
    // Quando for necessário reativar, descomente este bloco para pausar o
    // gameplay durante todo o anúncio e retomá-lo ao final:
    // sdkAdPlaying = true;
    // poki.gameplayStop();
    // void poki.commercialBreak().then(() => {
    //   sdkAdPlaying = false;
    //   if (gameplayStarted) poki.gameplayStart();
    // });
    if (gameplayStarted) poki.gameplayStart();
  });

  const hint = label("Collect eggs and bring them to NEST", 18, 0xd3e9ed);
  hint.anchor.set(0.5);
  hint.position.set(window.innerWidth / 2, 128);
  ui.addChild(hint);
  hint.visible = false;
  const joystick = new Container();
  joystick.alpha = 0.04;
  let joystickTutorialVisible = true;
  ui.addChild(joystick);
  const joyBase = new Graphics()
    .circle(0, 0, 76)
    .fill({ color: 0x0b1827, alpha: 0.72 })
    .circle(0, 0, 68)
    .stroke({ color: 0x75d9d1, alpha: 0.65, width: 3 });
  const joyKnob = new Graphics().circle(0, 0, 32).fill(0x75d9d1);
  joystick.addChild(joyBase, joyKnob);
  const baseIndicator = new Container();
  const baseArrow = new Sprite(hudFrames.nestArrow);
  baseArrow.anchor.set(0.5);
  baseArrow.width = 56;
  baseArrow.height = (56 * 112) / 137;
  const baseIndicatorText = new Sprite(hudFrames.nestLabel);
  baseIndicatorText.anchor.set(0.5);
  baseIndicatorText.width = 108;
  baseIndicatorText.height = (108 * 35) / 112;
  baseIndicatorText.position.set(0, 48);
  baseIndicator.addChild(baseArrow, baseIndicatorText);
  baseIndicator.visible = false;
  const tutorialIndicatorLabel = label("", 14, 0xfff2a6);
  tutorialIndicatorLabel.anchor.set(0.5);
  tutorialIndicatorLabel.position.set(0, 48);
  tutorialIndicatorLabel.visible = false;
  baseIndicator.addChild(tutorialIndicatorLabel);
  app.stage.addChild(baseIndicator);
  // Keep the world covered until the first camera frame has been verified.
  // This prevents a visible origin-frame while assets/player/camera settle.
  const bootCover = new Graphics();
  bootCover.alpha = 1;
  app.stage.addChild(bootCover);
  let bootReadyFrames = 0;
  const resizeBootCover = () => {
    bootCover
      .clear()
      .rect(0, 0, window.innerWidth, window.innerHeight)
      .fill(0x2d425f);
  };
  resizeBootCover();
  window.addEventListener("resize", resizeBootCover);

  type TutorialTarget = "NEST" | "UPGRADE" | "BUSH" | null;
  let activeTutorialTarget: TutorialTarget = null;
  const setTutorialTarget = (target: TutorialTarget) => {
    activeTutorialTarget = target;
    tutorialIndicatorLabel.text =
      target === "BUSH" ? "HIDE" : target === "NEST" ? "" : target ?? "";
    tutorialIndicatorLabel.visible = target !== null;
  };
  const clearTutorialTarget = (target: TutorialTarget) => {
    if (activeTutorialTarget === target) setTutorialTarget(null);
  };

  let uiState: {
    delivered: number; currency: number; speed: number; pickup: number;
    playerScore: number; rival1: number; rival2: number;
  } | undefined;
  function updateUI() {
    redrawBasePreview();
    if (uiState?.delivered === delivered && uiState.currency === currency &&
        uiState.speed === upgrades.speed && uiState.pickup === upgrades.pickupRadius &&
        uiState.playerScore === playerCollected && uiState.rival1 === enemies[0].collected &&
        uiState.rival2 === enemies[1].collected) return;
    uiState = { delivered, currency, speed: upgrades.speed, pickup: upgrades.pickupRadius,
      playerScore: playerCollected, rival1: enemies[0].collected, rival2: enemies[1].collected };
    const nextThreshold =
      STAGES.find((stage) => stage.threshold > delivered)?.threshold ??
      STAGES[STAGES.length - 1].threshold;
    progressText.text = `${delivered} / ${nextThreshold}`;
    currencyText.text = String(currency);
    upgradeText.text = `Speed  ${upgrades.speed}\nPickup range  ${upgrades.pickupRadius}`;
    upgradeCurrencyText.text = `${currency}`;
    refreshRanking();
    refreshUpgradeButtons();
    /* Contextual hint text is intentionally hidden from the HUD. */
    /* hint.text =
      carried >= upgrades.capacity
        ? "Return to NEST"
        : carried
          ? `Carrying ${carried} egg${carried > 1 ? "s" : ""} — return to NEST`
          : "Collect eggs and bring them to NEST"; */
  }
  updateUI();
  if (DEBUG_OPEN_UPGRADE_MENU) {
    upgradeMenuOpen = true;
    upgradePanel.visible = true;
    upgradeOverlay.visible = true;
  }

  function resizeUI() {
    header.position.set(window.innerWidth / 2, 58);
    hint.position.set(window.innerWidth / 2, 154);
    const hudScale = Math.min(1, Math.max(0.78, window.innerWidth / 440));
    currencyBadge.scale.set(hudScale);
    progressBadge.scale.set(hudScale);
    rankingPanel.scale.set(hudScale);
    currencyBadge.position.set(62, 102);
    progressBadge.position.set(62, 160);
    rankingPanel.position.set(window.innerWidth - 88, 75);
    upgradePanel.position.set(window.innerWidth / 2, window.innerHeight / 2);
    const desktopScale =
      window.innerWidth >= 1200 ? 0.78 : window.innerWidth >= 900 ? 0.88 : 1;
    upgradePanel.scale.set(
      Math.min(
        desktopScale,
        (window.innerWidth - 80) / 820,
        (window.innerHeight - 80) / 720,
      ),
    );
    upgradeOverlay
      .clear()
      .rect(0, 0, window.innerWidth, window.innerHeight)
      .fill({ color: 0x000000, alpha: 0.74 });
    upgradePanel.visible = upgradeMenuOpen;
    upgradeOverlay.visible = upgradeMenuOpen;
  }
  resizeUI();
  window.addEventListener("resize", resizeUI);

  function setJoystick(globalX: number, globalY: number) {
    const dx = globalX - joystickCenter.x,
      dy = globalY - joystickCenter.y;
    const distance = Math.hypot(dx, dy);
    const max = 52;
    const factor = Math.min(1, max / Math.max(distance, 1));
    joyKnob.position.set(dx * factor, dy * factor);
    input.x = (dx * factor) / max;
    input.y = (dy * factor) / max;
  }
  app.stage.eventMode = "static";
  app.stage.hitArea = app.screen;
  joystick.visible = false;
  app.stage.on("pointerdown", (e) => {
    const p = e.global;
    if (upgradeMenuOpen || evolving) return;
    if (p.y < 170 || (upgradePanel.visible && p.x < 280 && p.y > 240)) return;
    startGameplay();
    joystickActive = true;
    if (joystickTutorialVisible) joystick.visible = true;
    joystick.position.set(p.x, p.y);
    joystickCenter = { x: p.x, y: p.y };
    setJoystick(p.x, p.y);
  });
  app.stage.on("pointermove", (e) => {
    if (joystickActive) {
      setJoystick(e.global.x, e.global.y);
      if (joystickTutorialVisible && Math.hypot(input.x, input.y) > 0.12) {
        joystickTutorialVisible = false;
        joystick.visible = false;
      }
    }
  });
  const releaseJoystick = () => {
    joystickActive = false;
    joystick.visible = false;
    input.x = input.y = 0;
    joyKnob.position.set(0);
  };
  app.stage.on("pointerup", releaseJoystick);
  app.stage.on("pointerupoutside", releaseJoystick);

  await pokiReady;
  poki.loadingFinished();

  function distance(a: Point, b: Point) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  let eggRespawnTimer = 0;
  let eggRespawnPending = false;
  const randomEggRespawnDelay = () =>
    EGG_SPAWN_CONFIG.respawnMin +
    Math.random() *
      (EGG_SPAWN_CONFIG.respawnMax - EGG_SPAWN_CONFIG.respawnMin);
  const getActiveWorldEggs = () =>
    eggs.filter((egg) => egg.visible && egg.parent === eggLayer);
  const countActiveWorldEggs = () => {
    let count = 0;
    for (const egg of eggs) if (egg.visible && egg.parent === eggLayer) count += 1;
    return count;
  };
  const isValidEggSpawn = (position: Point) => {
    if (distance(position, player.position) < EGG_SPAWN_CONFIG.minFromPlayer)
      return false;
    if (distance(position, base.position) < EGG_SPAWN_CONFIG.minFromNest)
      return false;
    if (
      getActiveWorldEggs().some(
        (egg) => distance(position, egg.position) < EGG_SPAWN_CONFIG.minBetweenEggs,
      )
    )
      return false;
    return !bushes.some((bush) => {
      const normalizedX = (position.x - bush.x) / (bush.width * 0.5);
      const normalizedY =
        (position.y - (bush.y - bush.height * 0.44)) / (bush.height * 0.5);
      return Math.hypot(normalizedX, normalizedY) < 0.8;
    });
  };
  const spawnDirectorEgg = () => {
    const activeEggs = getActiveWorldEggs();
    const zone = [...EGG_SPAWN_CONFIG.zones]
      .sort(
        (a, b) =>
          activeEggs.filter((egg) =>
            b.bounds.left <= egg.x &&
            egg.x <= b.bounds.right &&
            b.bounds.top <= egg.y &&
            egg.y <= b.bounds.bottom,
          ).length -
          activeEggs.filter((egg) =>
            a.bounds.left <= egg.x &&
            egg.x <= a.bounds.right &&
            a.bounds.top <= egg.y &&
            egg.y <= a.bounds.bottom,
          ).length,
      )
      .find((candidate) =>
        activeEggs.filter(
          (egg) =>
            candidate.bounds.left <= egg.x &&
            egg.x <= candidate.bounds.right &&
            candidate.bounds.top <= egg.y &&
            egg.y <= candidate.bounds.bottom,
        ).length < candidate.target,
      );
    if (!zone) return false;
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const position = {
        x: zone.bounds.left + Math.random() * (zone.bounds.right - zone.bounds.left),
        y: zone.bounds.top + Math.random() * (zone.bounds.bottom - zone.bounds.top),
      };
      if (isValidEggSpawn(position)) {
        spawnEgg(position, skinIndex);
        return true;
      }
    }
    return false;
  };
  function shakeCamera(duration: number, strength: number) {
    if (duration >= cameraShakeTime) {
      cameraShakeStrength = strength;
      cameraShakeDuration = duration;
    }
    cameraShakeTime = Math.max(cameraShakeTime, duration);
  }

  type Particle = { sprite: Graphics; vx: number; vy: number; life: number };
  const evolutionOverlay = new Graphics();
  evolutionOverlay.visible = false;
  const resizeEvolutionOverlay = () => {
    evolutionOverlay
      .clear()
      .rect(0, 0, window.innerWidth, window.innerHeight)
      .fill({ color: 0x000000, alpha: 0.5 });
  };
  resizeEvolutionOverlay();
  window.addEventListener("resize", resizeEvolutionOverlay);
  app.stage.addChild(evolutionOverlay);
  const evolutionFx = new Container();
  evolutionFx.visible = false;
  app.stage.addChild(evolutionFx);
  const evolutionParticlesLayer = new Container();
  const evolutionSprite = new Sprite(playerEvolutionFrames[0]);
  evolutionSprite.anchor.set(0.5);
  const evolutionTitle = label("EVOLUTION!", 42, 0xfff2a6);
  evolutionTitle.anchor.set(0.5);
  evolutionFx.addChild(evolutionParticlesLayer, evolutionSprite, evolutionTitle);
  const evolutionParticles: Particle[] = [];
  let evolutionElapsed = 0;
  let evolutionTarget = 0;
  let evolutionStart: Point = { x: 0, y: 0 };
  type CurrencyBurst = { sprite: Graphics; elapsed: number; start: Point };
  const currencyBursts: CurrencyBurst[] = [];

  function startEvolutionFeedback(nextIndex: number) {
    evolving = true;
    input.x = 0;
    input.y = 0;
    joystickActive = false;
    joystick.visible = false;
    evolutionTarget = nextIndex;
    evolutionElapsed = 0;
    basePreview.visible = false;
    basePreview.scale.set(1);
    nestPreviewJuiceActive = false;
    const stage = STAGES[nextIndex];
    evolutionSprite.texture = playerEvolutionFrames[nextIndex];
    evolutionSprite.width = 176 * stage.scale;
    evolutionSprite.height = 226 * stage.scale;
    evolutionSprite.position.set(0, -30 * stage.scale);
    evolutionTitle.position.set(0, -178 * stage.scale);
    const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    evolutionStart = center;
    evolutionFx.position.copyFrom(center);
    evolutionOverlay.visible = true;
    evolutionFx.visible = true;
    const particleSpread = 5;
    for (let i = 0; i < 22; i += 1) {
      const angle = (i / 22) * Math.PI * 2;
      const particle = new Graphics().circle(0, 0, 3 + (i % 3)).fill(0xeee7ff);
      evolutionParticlesLayer.addChild(particle);
      evolutionParticles.push({
        sprite: particle,
        vx: Math.cos(angle) * (45 + i * 2) * particleSpread,
        vy: Math.sin(angle) * (45 + i * 2) * particleSpread,
        life: 1,
      });
    }
  }

  function unlockUpgradeStationTutorial() {
    if (upgradeStationUnlocked) return;
    upgradeStationUnlocked = true;
    upgradeFtueVisible = true;
    upgradeSpawnElapsed = 0;
    upgradeStation.visible = true;
    upgradeStation.scale.set(0.1);
    upgradeStation.alpha = 0;
    setTutorialTarget("UPGRADE");
    upgradeStationArmed = true;
  }

  function updateEvolutionFeedback(dt: number) {
    if (!evolving) return;
    evolutionElapsed += dt;
    const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const playerScreen = player.toGlobal({ x: 0, y: 0 });
    const travel =
      evolutionElapsed < 0.55
        ? evolutionElapsed / 0.55
        : Math.min(1, (evolutionElapsed - 0.55) / 0.8);
    const eased = 1 - (1 - travel) ** 3;
    if (evolutionElapsed < 0.55)
      evolutionFx.position.set(
        evolutionStart.x + (center.x - evolutionStart.x) * eased,
        evolutionStart.y + (center.y - evolutionStart.y) * eased,
      );
    else
      evolutionFx.position.set(
        center.x + (playerScreen.x - center.x) * eased,
        center.y + (playerScreen.y - center.y) * eased,
      );
    evolutionFx.scale.set(
      evolutionElapsed < 0.55
        ? 1 + Math.sin(evolutionElapsed * 18) * 0.08
        : 1.2 - eased * 0.2,
    );
    for (const particle of evolutionParticles) {
      particle.life -= dt * 1.6;
      particle.sprite.x += particle.vx * dt;
      particle.sprite.y += particle.vy * dt;
      particle.sprite.alpha = Math.max(0, particle.life);
    }
    if (evolutionElapsed >= 1.35) {
      for (const particle of evolutionParticles) particle.sprite.destroy();
      evolutionParticles.length = 0;
      evolutionFx.visible = false;
      evolutionOverlay.visible = false;
      evolving = false;
      skinIndex = evolutionTarget;
      redrawPlayer();
      redrawBasePreview();
      if (basePreview.visible) {
        basePreview.scale.set(0.08);
        nestPreviewJuiceElapsed = 0;
        nestPreviewJuiceActive = true;
      }
      // The upgrade station becomes available only after the player's second evolution.
      if (evolutionTarget === 2) unlockUpgradeStationTutorial();
      updateUI();
    }
  }

  function spawnCurrencyJuice(amount: number) {
    const start = base.toGlobal({ x: 0, y: 0 });
    for (let i = 0; i < amount; i += 1) {
      const sprite = new Graphics()
        .circle(0, 0, 7)
        .fill(0xfff2a6)
        .circle(0, 0, 3)
        .fill(0xffc95c);
      sprite.position.set(start.x, start.y);
      app.stage.addChild(sprite);
      currencyBursts.push({
        sprite,
        elapsed: -i * 0.08,
        start: { x: start.x, y: start.y },
      });
    }
  }

  function updateEnemy(enemy: Enemy, dt: number, chasingPlayer: boolean) {
    if (enemy.depositing) return;
    if (enemy.eggs.length >= 5) enemy.target = null;
    if (
      enemy.eggs.length < 5 &&
      (!enemy.target ||
        !enemy.target.visible ||
        enemy.target.parent !== eggLayer)
    ) {
      enemy.target = null;
      let nearestDistance = Infinity;
      for (const egg of eggs) {
        if (!egg.visible || egg.parent !== eggLayer) continue;
        const candidateDistance = distance(enemy.container.position, egg.position);
        if (candidateDistance < nearestDistance) {
          nearestDistance = candidateDistance;
          enemy.target = egg;
        }
      }
    }
    const destination =
      chasingPlayer
        ? player.position
        : enemy.eggs.length >= 5
        ? enemy.homeBase.position
        : enemy.target?.position;
    if (destination) {
      const dx = destination.x - enemy.container.x;
      const dy = destination.y - enemy.container.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      enemy.container.x += (dx / d) * enemy.speed * dt;
      enemy.container.y += (dy / d) * enemy.speed * dt;
    }
    enemy.container.x = Math.max(
      PLAYABLE_BOUNDS.left,
      Math.min(PLAYABLE_BOUNDS.right, enemy.container.x),
    );
    enemy.container.y = Math.max(
      PLAYABLE_BOUNDS.top,
      Math.min(PLAYABLE_BOUNDS.bottom, enemy.container.y),
    );
    if (
      enemy.target &&
      enemy.target.parent === eggLayer &&
      distance(enemy.container.position, enemy.target.position) < 72
    ) {
      const egg = enemy.target;
      eggLayer.removeChild(egg);
      egg.scale.set(getCarriedEggScale() * 0.84);
        enemy.eggs.push(egg);
        eggRespawnPending = true;
        world.addChildAt(egg, world.getChildIndex(enemy.container));
      enemy.target = null;
    }
    if (
      enemy.eggs.length > 0 &&
      distance(enemy.container.position, enemy.homeBase.position) < 125
    ) {
      enemy.collected += enemy.eggs.length;
      enemy.depositing = true;
      enemyDepositAnimations.push({
        enemy,
        eggs: [...enemy.eggs],
        elapsed: 0,
      });
      enemy.eggs.length = 0;
    }
    for (let i = 0; i < enemy.eggs.length; i += 1) {
      const egg = enemy.eggs[i];
      const leader = i === 0 ? enemy.container : enemy.eggs[i - 1];
      const dx = leader.x - egg.x;
      const dy = leader.y - egg.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      if (d > FOLLOW_DISTANCE) {
        const ratio = (d - FOLLOW_DISTANCE) / d;
        egg.x += dx * ratio * Math.min(1, dt * 10);
        egg.y += dy * ratio * Math.min(1, dt * 10);
      }
    }
  }

  function resolveStealing() {
    for (const enemy of enemies) {
      if (time >= enemy.dazedUntil) {
        const playerQueueEgg = carriedEggs.find(
          (egg) => distance(enemy.container.position, egg.position) < 54,
        );
        if (playerQueueEgg) {
          // Contact steals the full queue, preserving the game's clear
          // risk/reward consequence instead of removing a single egg.
          enemy.eggs.push(...carriedEggs.splice(0, carriedEggs.length));
          carried = 0;
          if (enemy === enemies[0] && !redIntroChaseCompleted) {
            redIntroChaseCompleted = true;
            redIntroChaseHadEggs = false;
          }
        }
      }
      for (let i = enemy.eggs.length - 1; i >= 0; i -= 1) {
        if (
          distance(player.position, enemy.eggs[i].position) < 54
        ) {
          carriedEggs.push(enemy.eggs.splice(i, 1)[0]);
          carried = carriedEggs.length;
          enemy.dazedUntil = time + 4;
          break;
        }
      }
    }
  }

  app.ticker.add((ticker) => {
    const dt = ticker.deltaMS / 1000;
    if (upgradeMenuOpen || sdkAdPlaying) return;
    time += dt;
    if (upgradeStationUnlocked && upgradeSpawnElapsed < 0.8) {
      upgradeSpawnElapsed += dt;
      const spawnProgress = Math.min(1, upgradeSpawnElapsed / 0.8);
      const easedSpawn = 1 - (1 - spawnProgress) ** 3;
      upgradeStation.scale.set(0.1 + easedSpawn * 0.9);
      upgradeStation.alpha = easedSpawn;
    }
    if (upgradeFtueVisible) {
      if (upgradeSpawnElapsed >= 0.8) {
        upgradeStation.scale.set(1 + Math.sin(time * 7) * 0.08);
        upgradeStation.rotation = Math.sin(time * 4) * 0.05;
      }
    }
    const cheapestUpgrade = Math.min(
      20 + upgradeLevels.speed * 15,
      20 + upgradeLevels.pickupRadius * 15,
    );
    upgradeAlert.visible = currency >= cheapestUpgrade;
    if (upgradeAlert.visible) {
      upgradeAlert.scale.set(1 + Math.sin(time * 7) * 0.16);
      upgradeAlert.rotation = Math.sin(time * 11) * 0.08;
    }
    pickupFlash = Math.max(0, pickupFlash - dt);
    for (const egg of eggs) {
      if (!egg.visible || egg.parent !== eggLayer) continue;
      const motion = eggMotion.get(egg);
      const sprite = egg.children[0];
      if (!motion || !(sprite instanceof Sprite)) continue;
      const motionTime = time * 1.45 + motion.phase;
      motion.spawnElapsed = Math.min(
        motion.spawnDuration,
        motion.spawnElapsed + dt,
      );
      const spawnProgress = Math.min(
        1,
        motion.spawnElapsed / motion.spawnDuration,
      );
      const spawnEased = 1 - (1 - spawnProgress) ** 3;
      const spawnOvershoot = Math.sin(spawnProgress * Math.PI) * 0.12;
      egg.scale.set(0.12 + spawnEased * 0.88 + spawnOvershoot);
      sprite.y = Math.sin(motionTime) * 2.5;
      sprite.rotation = Math.sin(motionTime * 0.8) * 0.045;
    }
    if (pickupFlash > 0) {
      const progress = 1 - pickupFlash / 0.42;
      pickupIndicator.alpha = 0.48 + Math.sin(progress * Math.PI) * 0.52;
    } else {
      pickupIndicator.alpha = 0.48;
    }
    const speed = upgrades.speed;
    if (!evolving) {
      player.x += input.x * speed * dt;
      player.y += input.y * speed * dt;
    }
    player.x = Math.max(
      PLAYABLE_BOUNDS.left,
      Math.min(PLAYABLE_BOUNDS.right, player.x),
    );
    player.y = Math.max(
      PLAYABLE_BOUNDS.top,
      Math.min(PLAYABLE_BOUNDS.bottom, player.y),
    );
    const hiddenNow = getBushCover(player.position) >= 0.55;
    if (hiddenNow !== playerHidden) {
      playerHidden = hiddenNow;
      updateBushHideFeedback(playerHidden);
      animateCarriedEggsForBush(playerHidden);
      if (
        playerHidden &&
        activeTutorialTarget === "BUSH" &&
        hideTutorialBush &&
        distance(player.position, {
          x: hideTutorialBush.x,
          y: hideTutorialBush.y - hideTutorialBush.height * 0.44,
        }) < Math.max(hideTutorialBush.width, hideTutorialBush.height)
      ) {
        hideTutorialCompleted = true;
        clearTutorialTarget("BUSH");
      }
    }
    updateCarriedEggBushAnimations(dt);
    const playerStageScale =
      STAGES[Math.min(skinIndex, STAGES.length - 1)].scale;
    const isPlayerMoving = Math.hypot(input.x, input.y) > 0.05;
    const idleFloat =
      !isPlayerMoving && !evolving ? Math.sin(time * 3.2) * 5 : 0;
    playerEvolution.y = -10 * playerStageScale + idleFloat;
    playerCloud.y = 52 * playerStageScale + idleFloat * 0.35;
    player.rotation =
      Math.sin(time * 8) * 0.035 * Math.min(1, Math.hypot(input.x, input.y));
    const upgradeDistance = distance(player.position, upgradeStation.position);
    if (!upgradeStationArmed && upgradeDistance > 160) {
      upgradeStationArmed = true;
      upgradeContactProgress = 0;
      upgradeStationCore.clear();
    }
    if (
      upgradeStationUnlocked &&
      upgradeStationArmed &&
      !upgradeMenuOpen &&
      upgradeDistance < 118
    ) {
      upgradeContactProgress = Math.min(1, upgradeContactProgress + dt / 1.1);
      upgradeStationCore
        .clear()
        .arc(
          0,
          0,
          66,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * upgradeContactProgress,
        )
        .stroke({ color: 0xfff2a6, width: 8 });
      if (upgradeContactProgress >= 1) {
        poki.gameplayStop();
        upgradeMenuOpen = true;
        upgradeStationArmed = false;
        upgradePanel.visible = true;
        upgradeOverlay.visible = true;
        upgradeFtueVisible = false;
        upgradeStation.rotation = 0;
        upgradeStation.scale.set(1);
        ui.setChildIndex(upgradeOverlay, ui.children.length - 2);
        ui.setChildIndex(upgradePanel, ui.children.length - 1);
        refreshUpgradeButtons();
      }
    } else if (!upgradeMenuOpen) {
      upgradeContactProgress = Math.max(0, upgradeContactProgress - dt * 2.5);
      upgradeStationCore.clear();
    }
    for (const egg of eggs) {
      if (
        !depositing &&
        egg.visible &&
        egg.parent === eggLayer &&
        distance(player.position, egg.position) < upgrades.pickupRadius
      ) {
        egg.visible = true;
        egg.scale.set(getCarriedEggScale());
        eggLayer.removeChild(egg);
        carriedEggs.push(egg);
        carried += 1;
        if (!eggRespawnPending) {
          eggRespawnPending = true;
          eggRespawnTimer = randomEggRespawnDelay();
        }
        pickupFlash = 0.42;
        shakeCamera(0.14, 5);
        world.addChildAt(egg, world.getChildIndex(player));
        updateUI();
      }
    }
    // The bush tutorial is contextual: the first enemy must have been seen,
    // and the player must actually be carrying a full five-egg stack.
    if (
      firstEnemySeen &&
      carried >= 5 &&
      !hideTutorialCompleted &&
      activeTutorialTarget === null &&
      !upgradeMenuOpen
    ) {
      setTutorialTarget("BUSH");
    }
    if (
      !nestTutorialShown &&
      carried >= 6 &&
      activeTutorialTarget === null
    ) {
      nestTutorialShown = true;
      setTutorialTarget("NEST");
    }
    const rivalsActive = RIVALS_START_ACTIVE || skinIndex >= 1;
    if (
      rivalsActive &&
      !firstEnemySeen &&
      enemies.some(
        (enemy) =>
          enemy.container.visible &&
          distance(enemy.container.position, player.position) < 1200,
      )
    ) {
      firstEnemySeen = true;
      hideTutorialBush = bushes.reduce(
        (closest, candidate) =>
          distance(player.position, {
            x: candidate.x,
            y: candidate.y - candidate.height * 0.44,
          }) <
          distance(player.position, {
            x: closest.x,
            y: closest.y - closest.height * 0.44,
          })
            ? candidate
            : closest,
        bushes[0],
      );
      if (!hideTutorialCompleted && activeTutorialTarget === null)
        setTutorialTarget("BUSH");
    }
    for (let i = 0; i < enemies.length; i += 1) {
      enemies[i].container.visible = rivalsActive;
      enemyBases[i].visible = rivalsActive;
    }
    // The opening chase ends only after the red rival steals an egg, or after
    // the player successfully deposits the queue while being chased.
    if (!redIntroChaseCompleted && carried > 0) redIntroChaseHadEggs = true;
    if (
      !redIntroChaseCompleted &&
      redIntroChaseHadEggs &&
      carried === 0 &&
      !depositing
    ) {
      redIntroChaseCompleted = true;
    }
    const normalChaser =
      rivalsActive && !playerHidden && carried > 0
        ? (enemies
            .filter((enemy) => time >= enemy.dazedUntil && !enemy.depositing)
            .sort(
              (a, b) =>
                distance(a.container.position, player.position) -
                distance(b.container.position, player.position),
            )[0] ?? null)
        : null;
    const activeChaser =
      !redIntroChaseCompleted &&
      rivalsActive &&
      !playerHidden &&
      time >= enemies[0].dazedUntil
        ? enemies[0]
        : normalChaser &&
            distance(normalChaser.container.position, player.position) < 1200
          ? normalChaser
          : null;
    if (rivalsActive)
      for (const enemy of enemies)
        updateEnemy(
          enemy,
          dt,
          enemy === activeChaser,
        );
    for (let i = enemyDepositAnimations.length - 1; i >= 0; i -= 1) {
      const animation = enemyDepositAnimations[i];
      animation.elapsed += dt;
      const depositDuration = 0.52;
      for (let eggIndex = 0; eggIndex < animation.eggs.length; eggIndex += 1) {
        const egg = animation.eggs[eggIndex];
        const progress = Math.max(
          0,
          Math.min(1, (animation.elapsed - eggIndex * 0.055) / depositDuration),
        );
        const eased = 1 - (1 - progress) ** 3;
        egg.x +=
          (animation.enemy.homeBase.x - egg.x) * Math.min(1, dt * 18) * eased;
        egg.y +=
          (animation.enemy.homeBase.y - egg.y) * Math.min(1, dt * 18) * eased;
        egg.scale.set(0.67 * (1 - eased * 0.35));
      }
      if (
        animation.elapsed >=
        depositDuration + Math.max(0, animation.eggs.length - 1) * 0.055
      ) {
        for (const egg of animation.eggs) releaseEgg(egg);
        animation.enemy.depositing = false;
        enemyDepositAnimations.splice(i, 1);
      }
    }
    if (
      !eggRespawnPending &&
      countActiveWorldEggs() < EGG_SPAWN_CONFIG.activeTarget
    ) {
      eggRespawnPending = true;
      eggRespawnTimer = randomEggRespawnDelay();
    }
    if (eggRespawnPending) {
      eggRespawnTimer = Math.max(0, eggRespawnTimer - dt);
      if (eggRespawnTimer <= 0 && spawnDirectorEgg()) {
        eggRespawnPending = false;
        if (countActiveWorldEggs() < EGG_SPAWN_CONFIG.activeTarget)
          eggRespawnPending = true;
        if (eggRespawnPending) eggRespawnTimer = randomEggRespawnDelay();
      }
    }
    if (!depositing && rivalsActive && !playerHidden) {
      resolveStealing();
      updateUI();
    }
    if (
      !depositing &&
      distance(player.position, base.position) < nestInteractionRadius &&
      carried > 0
    ) {
      depositing = true;
      depositElapsed = 0;
      depositingEggs = [...carriedEggs];
      depositArrivals = depositingEggs.map(() => false);
      baseVisualDelivered = delivered;
      shakeCamera(0.7, 11);
      redrawBasePreview();
    }
    if (depositing) {
      depositElapsed += dt;
      const depositDuration = 0.52;
      for (let i = 0; i < depositingEggs.length; i += 1) {
        const egg = depositingEggs[i];
        const progress = Math.max(
          0,
          Math.min(1, (depositElapsed - i * 0.055) / depositDuration),
        );
        const eased = 1 - (1 - progress) ** 3;
        egg.x += (base.x - egg.x) * Math.min(1, dt * 18) * eased;
        egg.y += (base.y - egg.y) * Math.min(1, dt * 18) * eased;
        egg.scale.set(0.67 * (1 - eased * 0.35));
        if (progress >= 1 && !depositArrivals[i]) {
          depositArrivals[i] = true;
          baseVisualDelivered += 1;
          redrawBasePreview();
        }
      }
      if (
        depositElapsed >=
        depositDuration + Math.max(0, depositingEggs.length - 1) * 0.055
      ) {
        const depositedCount = depositingEggs.length;
        delivered += depositedCount;
        if (delivered > 0) clearTutorialTarget("NEST");
        playerCollected += depositedCount;
        currency += depositedCount * 10;
        spawnCurrencyJuice(depositedCount);
        upgradePoints += depositedCount;
        carried = 0;
        baseVisualDelivered = delivered;
        for (const egg of depositingEggs) releaseEgg(egg);
        carriedEggs.length = 0;
        depositingEggs = [];
        depositArrivals = [];
        depositing = false;
        const next = STAGES.findIndex((stage) => delivered < stage.threshold);
        const unlockedIndex =
          next === -1 ? STAGES.length - 1 : Math.max(0, next - 1);
        if (unlockedIndex > skinIndex) startEvolutionFeedback(unlockedIndex);
        else {
          skinIndex = unlockedIndex;
          redrawPlayer();
          redrawBasePreview();
          updateUI();
        }
      }
    }
    if (!depositing && !playerHidden) {
      for (let i = 0; i < carriedEggs.length; i += 1) {
        const egg = carriedEggs[i];
        if (eggsInHideAnimation.has(egg))
          continue;
        const leader = i === 0 ? player : carriedEggs[i - 1];
        const dx = leader.x - egg.x;
        const dy = leader.y - egg.y;
        const d = Math.hypot(dx, dy);
        const desiredGap =
          i === 0 ? getCarriedEggGap() + 28 : getCarriedEggGap();
        if (d > desiredGap) {
          const ratio = (d - desiredGap) / d;
          egg.x += dx * ratio * Math.min(1, dt * 12);
          egg.y += dy * ratio * Math.min(1, dt * 12);
        }
      }
    }
    cameraShakeTime = Math.max(0, cameraShakeTime - dt);
    const shake =
      cameraShakeTime > 0
        ? cameraShakeStrength * (cameraShakeTime / cameraShakeDuration)
        : 0;
    const shakeX = shake ? (Math.random() * 2 - 1) * shake : 0;
    const shakeY = shake ? (Math.random() * 2 - 1) * shake : 0;
    const cameraTarget = getCameraTarget(shakeX, shakeY);
    camera.scale.set(CAMERA_ZOOM);
    camera.x += (cameraTarget.x - camera.x) * Math.min(1, dt * 7);
    camera.y += (cameraTarget.y - camera.y) * Math.min(1, dt * 7);
    const cameraReady =
      player.parent === world &&
      player.visible &&
      Math.abs(camera.x - cameraTarget.x) < 0.5 &&
      Math.abs(camera.y - cameraTarget.y) < 0.5;
    const playerScreenPosition = player.toGlobal({ x: 0, y: 0 });
    const playerOnCamera =
      Math.abs(playerScreenPosition.x - window.innerWidth / 2) < 1.5 &&
      Math.abs(playerScreenPosition.y - window.innerHeight / 2) < 1.5;
    if (!bootCover.destroyed && cameraReady && playerOnCamera) {
      bootReadyFrames += 1;
      if (bootReadyFrames >= 1) {
        bootCover.visible = false;
        header.visible = false;
        hint.visible = false;
        if (joystickTutorialVisible && !joystickActive) joystick.visible = true;
      }
    }
    updateEvolutionFeedback(dt);
    if (nestPreviewJuiceActive) {
      nestPreviewJuiceElapsed += dt;
      const previewProgress = Math.min(1, nestPreviewJuiceElapsed / 0.7);
      const previewEased = 1 - (1 - previewProgress) ** 3;
      const overshoot = Math.sin(previewProgress * Math.PI) * 0.14;
      basePreview.scale.set(0.08 + previewEased * 0.92 + overshoot);
      if (previewProgress >= 1) {
        basePreview.scale.set(1);
        nestPreviewJuiceActive = false;
      }
    }
    for (let i = currencyBursts.length - 1; i >= 0; i -= 1) {
      const burst = currencyBursts[i];
      burst.elapsed += dt;
      if (burst.elapsed < 0) continue;
      const progress = Math.min(1, burst.elapsed / 0.7);
      const eased = 1 - (1 - progress) ** 3;
      const target = currencyBadge.toGlobal({ x: 0, y: 0 });
      burst.sprite.position.set(
        burst.start.x + (target.x - burst.start.x) * eased,
        burst.start.y + (target.y - burst.start.y) * eased,
      );
      burst.sprite.scale.set(1 + Math.sin(progress * Math.PI) * 0.5);
      burst.sprite.alpha = 1 - progress * 0.25;
      if (progress >= 1) {
        burst.sprite.destroy();
        currencyBursts.splice(i, 1);
      }
    }
    const baseScreen = base.toGlobal({ x: 0, y: 0 });
    const playerScreen = player.toGlobal({ x: 0, y: -105 });
    const baseOnScreen =
      baseScreen.x >= 0 &&
      baseScreen.x <= window.innerWidth &&
      baseScreen.y >= 0 &&
      baseScreen.y <= window.innerHeight;
    nestOffscreenElapsed = baseOnScreen
      ? 0
      : nestOffscreenElapsed + dt;
    const showNestNavigation = nestOffscreenElapsed >= 60;
    const nestIndicatorActive =
      activeTutorialTarget === "NEST" ||
      (activeTutorialTarget === null && showNestNavigation);
    const tutorialWorldTarget =
      nestIndicatorActive
        ? base.position
        : activeTutorialTarget === "UPGRADE"
        ? upgradeStation.position
        : activeTutorialTarget === "BUSH" && hideTutorialBush
          ? {
              x: hideTutorialBush.x,
              y: hideTutorialBush.y - hideTutorialBush.height * 0.44,
            }
          : null;
    const targetScreen = tutorialWorldTarget
      ? world.toGlobal(tutorialWorldTarget)
      : baseScreen;
    // The upgrade target indicator must never render over the upgrade screen.
    const hasIndicator =
      !upgradeMenuOpen &&
      (Boolean(activeTutorialTarget) || showNestNavigation);
    baseIndicator.visible = hasIndicator;
    baseIndicatorText.visible = nestIndicatorActive;
    tutorialIndicatorLabel.visible =
      Boolean(activeTutorialTarget) && activeTutorialTarget !== "NEST";
    if (hasIndicator) {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const dx = targetScreen.x - centerX;
      const dy = targetScreen.y - centerY;
      const targetOnScreen =
        targetScreen.x > 0 &&
        targetScreen.x < window.innerWidth &&
        targetScreen.y > 0 &&
        targetScreen.y < window.innerHeight;
      if (!targetOnScreen) {
        const edgeX = Math.max(1, centerX - 48);
        const edgeY = Math.max(1, centerY - 48);
        const edgeScale = Math.min(
          edgeX / Math.max(1, Math.abs(dx)),
          edgeY / Math.max(1, Math.abs(dy)),
        );
        baseIndicator.position.set(
          centerX + dx * edgeScale,
          centerY + dy * edgeScale,
        );
      } else {
        const playerToBaseX = targetScreen.x - playerScreen.x;
        const playerToBaseY = targetScreen.y - playerScreen.y;
        const distanceToBase = Math.hypot(playerToBaseX, playerToBaseY);
        const directionX =
          distanceToBase > 1 ? playerToBaseX / distanceToBase : 0;
        const directionY =
          distanceToBase > 1 ? playerToBaseY / distanceToBase : -1;
        const indicatorDistance = Math.min(
          120,
          Math.max(76, distanceToBase * 0.35),
        );
        baseIndicator.position.set(
          Math.max(
            44,
            Math.min(
              window.innerWidth - 44,
              playerScreen.x + directionX * indicatorDistance,
            ),
          ),
          Math.max(
            44,
            Math.min(
              window.innerHeight - 44,
              playerScreen.y + directionY * indicatorDistance,
            ),
          ),
        );
      }
      baseIndicator.rotation = Math.atan2(
        targetScreen.y - baseIndicator.y,
        targetScreen.x - baseIndicator.x,
      );
      baseIndicatorText.rotation = -baseIndicator.rotation;
      tutorialIndicatorLabel.rotation = -baseIndicator.rotation;
    }
  });
}

void bootstrap().catch((error: unknown) => {
  console.error("Monster.IO failed to start", error);
  const game = document.querySelector("#game");
  if (game) {
    game.setAttribute("data-boot-error", "true");
  }
});
