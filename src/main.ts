import "./style.css";
import { poki } from "./platform/poki";
import { GAME_ASSETS } from "./assets";
import { gridTextures } from "./art-textures";
import { createUpgradeAssetLoader } from "./upgrade-assets";
import { createWorldScene } from "./world/world-scene";
import { createEggSystem } from "./systems/eggs/egg-system";
import { createEnemySystem } from "./systems/enemies/enemy-system";
import {
  createPlayerSystem,
  type PlayerUpgrades,
} from "./systems/player/player-system";
import { createProgressionSystem } from "./systems/progression/progression-system";
import type { Point } from "./game/types";
import {
  CAMERA_ZOOM,
  DEBUG_OPEN_UPGRADE_MENU,
  GOLD_MINE_CONFIG,
  INITIAL_EGG_POSITIONS,
  NEST_INTERACTION_RADIUS,
  POST_FIRST_EVOLUTION_EGG_POSITIONS,
  PLAYABLE_BOUNDS,
  RIVALS_START_ACTIVE,
  STAGES,
  WORLD,
} from "./config/game-config";
import {
  Application,
  Assets,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  TextStyle,
  Texture,
  TextureSource,
} from "pixi.js";

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

  const [
    groundAtlas,
    nestTexture,
    enemyNestTexture,
    playerEvolutionTexture,
    playerCloudTexture,
    enemyTexture,
    eggTexture,
    plantTexture,
    hudTexture,
  ] = await Promise.all(
    [
      GAME_ASSETS.ground,
      GAME_ASSETS.nest,
      GAME_ASSETS.enemyNest,
      GAME_ASSETS.player,
      GAME_ASSETS.cloud,
      GAME_ASSETS.enemy,
      GAME_ASSETS.eggs,
      GAME_ASSETS.plant,
      GAME_ASSETS.hud,
    ].map((path) => Assets.load<Texture>(path)),
  );
  const { obstacles, bushes } = createWorldScene(
    world,
    groundAtlas,
    GAME_ASSETS.ground,
    plantTexture,
  );
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
  const enemyFrames = gridTextures(enemyTexture, GAME_ASSETS.enemy, 2, 1);
  const enemyNestFrames = gridTextures(
    enemyNestTexture,
    GAME_ASSETS.enemyNest,
    2,
    1,
  );
  // Geometry-only source: no bitmap download/upload. The whole panel stays
  // hidden until every frame and the station art have been bound atomically.
  const upgradeUiPlaceholder = new TextureSource({ width: 1983, height: 793 });
  const upgradeUiFrames: Texture[] = [];
  const upgradeUiFrame = (
    x: number,
    y: number,
    width: number,
    height: number,
  ) => {
    const texture = new Texture({
      source: upgradeUiPlaceholder,
      frame: new Rectangle(x, y, width, height),
      dynamic: true,
    });
    upgradeUiFrames.push(texture);
    return texture;
  };
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
  const eggFrames = gridTextures(
    eggTexture,
    GAME_ASSETS.eggs,
    eggColumns,
    eggRows,
  );
  // Keep the original 354.8 x 295.666... logical cell at every progression scale.
  const eggResolutionScale = 1774 / eggColumns / eggFrames[0].width;
  const base = new Container();
  // The nest is the safe home at the southern edge of the world. Exploration
  // naturally opens upward from here through the upgrade station.
  base.position.set(3000, 3500);
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
  const upgradeBaseSprite = new Sprite(Texture.EMPTY);
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
  // The first six are deliberately staged from easy/safe to progressively
  // farther north, teaching exploration before the first evolution.
  const EGG_STYLES = [
    { shell: 0xfff2d0, outline: 0xffc77d, spot: 0xffb36b },
    { shell: 0xd7f5ff, outline: 0x65c9e8, spot: 0x5ca5ff },
    { shell: 0xffd7ed, outline: 0xed77b4, spot: 0xb85cff },
    { shell: 0xe4d7ff, outline: 0xb28cff, spot: 0x7c5cff },
  ];
  const progression = createProgressionSystem();
  const playerSystem = createPlayerSystem({
    world,
    evolutionFrames: playerEvolutionFrames,
    cloudTexture: playerCloudTexture,
    getStageIndex: () => progression.stageIndex,
  });
  const { player, playerEvolution, pickupIndicator } = playerSystem;

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

  const upgrades = playerSystem.upgrades;
  const upgradeLevels = { speed: 0, pickupRadius: 0 };
  let upgradePoints = 0;
  let carried = 0;
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
  let upgradeStationArmed = true;
  let upgradeStationUnlocked = false;
  let upgradeAssetsReady = false;
  let upgradeUnlockRequested = false;
  let upgradeFtueVisible = false;
  let upgradeSpawnElapsed = 0;
  let firstUpgradeCompleted = false;
  let firstEnemySeen = false;
  let redIntroChaseCompleted = false;
  let redIntroChaseHadEggs = false;
  let enemyTutorialPending = false;
  let enemyTutorialShown = false;
  let firstDepositCompleted = false;
  let hideTutorialArmed = false;
  let hideTutorialCompleted = false;
  let nestOffscreenElapsed = 0;
  let tutorialEgg: Container | null = null;
  let tutorialEggsCollected = 0;
  let hideTutorialBush: (typeof bushes)[number] | null = null;
  const getCurrentVisualScale = () => progression.visualScale;
  const getCarriedEggScale = () =>
    0.67 * Math.min(1.18, 1 + (getCurrentVisualScale() - 1) * 0.38);
  const getCarriedEggGap = () => Math.max(72, 60 * getCurrentVisualScale());
  const eggSystem = createEggSystem({
    eggLayer,
    eggFrames,
    eggResolutionScale,
    getStageIndex: () => progression.stageIndex,
    getPlayerPosition: () => player.position,
    getNestPosition: () => base.position,
    getCarriedEggScale,
    getCarriedEggGap,
  });
  INITIAL_EGG_POSITIONS.forEach((position) => eggSystem.spawnEgg(position, 0));
  GOLD_MINE_CONFIG.positions.forEach((position) =>
    eggSystem.spawnEgg(position, 0),
  );
  const input = { x: 0, y: 0 };
  let gameplayStarted = false;
  let sdkAdPlaying = false;
  const startGameplay = () => {
    if (gameplayStarted) return;
    gameplayStarted = true;
    poki.gameplayStart();
    void preloadUpgradeAssets();
  };
  let joystickCenter: Point = { x: 0, y: 0 };
  let joystickActive = false;

  const enemySystem = createEnemySystem({
    world,
    eggLayer,
    eggSystem,
    enemyFrames,
    enemyNestFrames,
    playerCloudTexture,
    label,
    getPlayerPosition: () => player.position,
    getTime: () => time,
    getCarriedEggScale,
    onEnemyCollectedEgg: () => {
      eggRespawnPending = true;
    },
    onPlayerCarriedCountChanged: (count) => {
      carried = count;
    },
    onRedIntroSteal: () => {
      if (!enemyTutorialShown) enemyTutorialPending = true;
      if (!redIntroChaseCompleted) {
        redIntroChaseCompleted = true;
        redIntroChaseHadEggs = false;
      }
    },
  });
  const { enemies } = enemySystem;
  // A vegetação fica na frente dos personagens e dos ovos no mapa.
  // Rival nests belong above the ground, but behind eggs, characters and
  // vegetation. They must not visually cover the gameplay actors.
  const obstacleLayerIndex = world.getChildIndex(obstacles);
  for (const enemyBase of enemySystem.enemyBases) {
    world.setChildIndex(enemyBase, obstacleLayerIndex);
  }
  world.setChildIndex(obstacles, world.children.length - 1);
  function refreshProgressionVisuals() {
    const progressionScale = getCurrentVisualScale();
    const bushScale = Math.min(1.18, 1 + (progressionScale - 1) * 0.2);
    for (const bush of bushes) {
      bush.sprite.width = bush.width * bushScale;
      bush.sprite.height = bush.height * bushScale;
      bush.sprite.scale.x = bush.flipX * Math.abs(bush.sprite.scale.x);
    }
    eggSystem.refreshScales();
    enemySystem.refreshVisualScales(progressionScale);
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
    playerSystem.redraw();
    refreshProgressionVisuals();
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
      hidingBush = bushes.reduce(
        (best, bush) => {
          const bushCenterY = bush.y - bush.height * 0.44;
          const normalizedX = (player.x - bush.x) / (bush.width * 0.5);
          const normalizedY = (player.y - bushCenterY) / (bush.height * 0.5);
          const cover = Math.max(0, 1 - Math.hypot(normalizedX, normalizedY));
          if (!best) return cover >= 0.5 ? bush : null;
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
        },
        null as (typeof bushes)[number] | null,
      );
    }
    for (const bush of bushes) {
      bush.sprite.alpha = hidingBush === bush ? 0.42 : 1;
    }
  }

  function animateCarriedEggsForBush(hiding: boolean) {
    eggSystem.startBushHideAnimation(player.position, hiding, bushes);
  }

  function updateCarriedEggBushAnimations(dt: number) {
    eggSystem.updateCarriedEggBushAnimations(dt);
  }

  let previewState:
    | { skin: number; delivered: number; evolving: boolean }
    | undefined;
  function redrawBasePreview() {
    if (
      previewState?.skin === progression.stageIndex &&
      previewState.delivered === baseVisualDelivered &&
      previewState.evolving === evolving
    )
      return;
    previewState = {
      skin: progression.stageIndex,
      delivered: baseVisualDelivered,
      evolving,
    };
    const nextIndex = Math.min(progression.stageIndex + 1, STAGES.length - 1);
    const nextStage = STAGES[nextIndex];
    const threshold = nextStage.threshold;
    const previousThreshold = STAGES[Math.max(0, nextIndex - 1)].threshold;
    const progress =
      nextIndex === progression.stageIndex
        ? 0
        : Math.min(
            1,
            Math.max(
              0,
              (baseVisualDelivered - previousThreshold) /
                Math.max(1, threshold - previousThreshold),
            ),
          );
    basePreview.visible = nextIndex > progression.stageIndex && !evolving;
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
          Math.cos(start) * NEST_INTERACTION_RADIUS,
          Math.sin(start) * NEST_INTERACTION_RADIUS,
        )
        .arc(0, 0, NEST_INTERACTION_RADIUS, start, end)
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
  upgradePanelArt.width = 1000;
  upgradePanelArt.height = 1000;
  upgradePanel.addChildAt(upgradePanelArt, 0);
  upgradePanel.position.set(window.innerWidth / 2, window.innerHeight / 2);
  ui.addChild(upgradePanel);
  upgradePanel.visible = false;
  upgradeOverlay.visible = false;
  const upgradeCurrencyHud = new Container();
  const upgradeCurrencyPill = new Graphics()
    .roundRect(-150, -42, 300, 84, 28)
    .fill(0x0b2035)
    .stroke({ color: 0x315b79, width: 5 });
  upgradeCurrencyHud.addChild(upgradeCurrencyPill);
  const upgradeLoadStatus = label("", 16, 0xfff2a6);
  upgradeLoadStatus.anchor.set(0.5);
  upgradeLoadStatus.visible = false;
  upgradeLoadStatus.eventMode = "static";
  upgradeLoadStatus.cursor = "pointer";
  upgradeLoadStatus.on("pointertap", (event) => {
    event.stopPropagation();
    void preloadUpgradeAssets();
  });
  upgradeLoadStatus.on("pointerdown", (event) => event.stopPropagation());
  ui.addChild(upgradeLoadStatus);
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
  upgradeTitle.style.fontSize = 72;
  upgradeTitle.anchor.set(0.5);
  upgradeTitle.position.set(0, -380);
  upgradeTitle.style.fontWeight = "900";
  const upgradeCurrencyText = label("0", 36, 0xfff2a6);
  upgradeCurrencyText.anchor.set(0.5);
  upgradeCurrencyText.style.fontSize = 52;
  upgradeCurrencyText.position.set(24, 0);
  const currencyGem = new Sprite(upgradeUiFrame(1622, 493, 164, 164));
  currencyGem.anchor.set(0.5);
  currencyGem.position.set(-74, 0);
  currencyGem.width = 42;
  currencyGem.height = 42;
  upgradeCurrencyHud.addChild(currencyGem, upgradeCurrencyText);
  ui.addChild(upgradeCurrencyHud);
  upgradeTitle.position.set(0, -380);
  const upgradeHint = label("", 11, 0x9cb8c2);
  upgradeHint.position.set(0, 0);
  upgradePanel.addChild(upgradeHint);
  upgradeHint.visible = false;
  const closeUpgradeButton = drawRounded(0xc85162, 62, 62, 16);
  closeUpgradeButton.position.set(430, -380);
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
        x: -190,
        y: 150,
        key: "speed",
        name: "SPEED",
        detail: () => `${upgrades.speed}  →  ${upgrades.speed + 45}`,
        apply: () => {
          upgrades.speed += 45;
        },
      },
      {
        x: 190,
        y: 150,
        key: "pickupRadius",
        name: "RANGE",
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
    cardArt.width = 350;
    cardArt.height = 800;
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
    icon.position.set(0, -280);
    icon.width = 240;
    icon.height = 200;
    button.addChild(icon);
    const cardTitle = label(name, 48, 0xffffff);
    cardTitle.anchor.set(0.5);
    cardTitle.position.set(0, -150);
    cardTitle.style.align = "center";
    button.addChild(cardTitle);
    const cardDetail = label("", 42, 0xf5ffff);
    cardDetail.anchor.set(0.5);
    cardDetail.position.set(0, -50);
    cardDetail.style.align = "center";
    button.addChild(cardDetail);
    const cardDelta = label("+ upgrade", 64, 0xa8ff91);
    cardDelta.anchor.set(0.5);
    cardDelta.position.set(0, 55);
    button.addChild(cardDelta);
    const cardCost = label("", 28, 0xffe39a);
    cardCost.visible = false;
    cardCost.anchor.set(0.5);
    cardCost.position.set(0, 50);
    button.addChild(cardCost);
    const actionButton = new Sprite(upgradeButtonFrames.enabled);
    actionButton.anchor.set(0.5);
    actionButton.position.set(10, 175);
    actionButton.width = 300;
    actionButton.height = 100;
    const actionCurrencyGem = new Sprite(upgradeUiFrame(1622, 493, 164, 164));
    actionCurrencyGem.anchor.set(0.5);
    actionCurrencyGem.position.set(-58, 0);
    actionCurrencyGem.width = 64;
    actionCurrencyGem.height = 64;
    const actionText = label("", 72, 0xf5ffff);
    actionText.anchor.set(0.5);
    actionText.position.set(22, 0);
    actionButton.addChild(actionCurrencyGem, actionText);
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
      upgrade.actionText.text = String(cost);
      upgrade.buttonText.text = `${upgrade.name}\n\n${upgrade.detail()}\n\n◆ ${cost}`;
    }
  }
  closeUpgradeButton.on("pointertap", () => {
    upgradeMenuOpen = false;
    upgradePanel.visible = false;
    upgradeCurrencyHud.visible = false;
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

  const loadUpgradeAssets = createUpgradeAssetLoader();
  let upgradeArtPromise: Promise<boolean> | null = null;
  function preloadUpgradeAssets(): Promise<boolean> {
    if (upgradeAssetsReady) return upgradeArtPromise!;
    if (upgradeUnlockRequested) {
      upgradeLoadStatus.text = "Loading upgrades…";
      upgradeLoadStatus.visible = true;
    }
    if (upgradeArtPromise) return upgradeArtPromise;
    upgradeArtPromise = loadUpgradeAssets()
      .then(({ ui: loadedUpgradeUi, base }) => {
        for (const frame of upgradeUiFrames) {
          frame.source = loadedUpgradeUi.source;
          frame.update();
        }
        // Sprite retains its explicit 172 x 175 world size on texture replacement.
        upgradeBaseSprite.texture = base;
        upgradeUiPlaceholder.destroy();
        upgradeAssetsReady = true;
        upgradeLoadStatus.visible = false;
        if (upgradeUnlockRequested) unlockUpgradeStationTutorial();
        if (DEBUG_OPEN_UPGRADE_MENU) {
          upgradeMenuOpen = true;
          upgradePanel.visible = true;
          upgradeCurrencyHud.visible = true;
          upgradeOverlay.visible = true;
          ui.setChildIndex(upgradeOverlay, ui.children.length - 1);
          ui.setChildIndex(upgradePanel, ui.children.length - 1);
          ui.setChildIndex(upgradeCurrencyHud, ui.children.length - 1);
        }
        return true;
      })
      .catch((error: unknown) => {
        upgradeArtPromise = null;
        console.warn(
          "Upgrade artwork could not be loaded; retry is available",
          error,
        );
        if (upgradeUnlockRequested) {
          upgradeLoadStatus.text = "Upgrades unavailable. Tap to retry.";
          upgradeLoadStatus.visible = true;
        }
        return false;
      });
    return upgradeArtPromise;
  }

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

  type TutorialTarget = "EGG" | "NEST" | "UPGRADE" | "BUSH" | "ENEMY" | null;
  let activeTutorialTarget: TutorialTarget = null;
  let tutorialEnemy: (typeof enemies)[number] | null = null;
  const setTutorialTarget = (target: TutorialTarget) => {
    activeTutorialTarget = target;
    tutorialIndicatorLabel.text =
      target === "BUSH"
        ? "HIDE"
        : target === "ENEMY"
          ? "STEAL"
          : target === "EGG"
            ? "PICK UP"
            : target === "NEST"
              ? ""
              : (target ?? "");
    tutorialIndicatorLabel.visible = target !== null;
  };
  const clearTutorialTarget = (target: TutorialTarget) => {
    if (activeTutorialTarget === target) setTutorialTarget(null);
  };
  tutorialEgg = eggSystem.eggs[0] ?? null;
  setTutorialTarget("EGG");

  let uiState:
    | {
        delivered: number;
        currency: number;
        speed: number;
        pickup: number;
        playerScore: number;
        rival1: number;
        rival2: number;
      }
    | undefined;
  function updateUI() {
    redrawBasePreview();
    if (
      uiState?.delivered === progression.delivered &&
      uiState.currency === currency &&
      uiState.speed === upgrades.speed &&
      uiState.pickup === upgrades.pickupRadius &&
      uiState.playerScore === playerCollected &&
      uiState.rival1 === enemies[0].collected &&
      uiState.rival2 === enemies[1].collected
    )
      return;
    uiState = {
      delivered: progression.delivered,
      currency,
      speed: upgrades.speed,
      pickup: upgrades.pickupRadius,
      playerScore: playerCollected,
      rival1: enemies[0].collected,
      rival2: enemies[1].collected,
    };
    const nextThreshold = progression.getNextThreshold();
    progressText.text = `${progression.delivered} / ${nextThreshold}`;
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
    void preloadUpgradeAssets();
  }

  function resizeUI() {
    upgradeLoadStatus.position.set(
      window.innerWidth / 2,
      window.innerHeight - 40,
    );
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
    upgradeCurrencyHud.position.set(
      window.innerWidth / 2,
      window.innerHeight / 2 - 250 * desktopScale,
    );
    upgradeCurrencyHud.scale.set(desktopScale / 2.2);
    upgradeOverlay
      .clear()
      .rect(0, 0, window.innerWidth, window.innerHeight)
      .fill({ color: 0x000000, alpha: 0.74 });
    upgradePanel.visible = upgradeMenuOpen;
    upgradeCurrencyHud.visible = upgradeMenuOpen;
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
  const pressedKeys = new Set<string>();
  const updateKeyboardInput = () => {
    if (joystickActive) return;
    const left = pressedKeys.has("ArrowLeft") || pressedKeys.has("KeyA");
    const right = pressedKeys.has("ArrowRight") || pressedKeys.has("KeyD");
    const up = pressedKeys.has("ArrowUp") || pressedKeys.has("KeyW");
    const down = pressedKeys.has("ArrowDown") || pressedKeys.has("KeyS");
    const x = (right ? 1 : 0) - (left ? 1 : 0);
    const y = (down ? 1 : 0) - (up ? 1 : 0);
    const magnitude = Math.hypot(x, y);
    input.x = magnitude > 0 ? x / magnitude : 0;
    input.y = magnitude > 0 ? y / magnitude : 0;
  };
  const releaseJoystick = () => {
    joystickActive = false;
    joystick.visible = false;
    updateKeyboardInput();
    joyKnob.position.set(0);
  };
  app.stage.on("pointerup", releaseJoystick);
  app.stage.on("pointerupoutside", releaseJoystick);

  const keyboardCodes = new Set([
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
  ]);
  window.addEventListener("keydown", (event) => {
    if (!keyboardCodes.has(event.code)) return;
    event.preventDefault();
    startGameplay();
    pressedKeys.add(event.code);
    updateKeyboardInput();
  });
  window.addEventListener("keyup", (event) => {
    pressedKeys.delete(event.code);
    updateKeyboardInput();
  });
  window.addEventListener("blur", () => {
    pressedKeys.clear();
    updateKeyboardInput();
  });

  await pokiReady;
  poki.loadingFinished();

  function distance(a: Point, b: Point) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  let eggRespawnTimer = 0;
  let eggRespawnPending = false;
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
  evolutionFx.addChild(
    evolutionParticlesLayer,
    evolutionSprite,
    evolutionTitle,
  );
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
    upgradeUnlockRequested = true;
    if (!upgradeAssetsReady) {
      void preloadUpgradeAssets();
      return;
    }
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
      progression.completeEvolution(evolutionTarget);
      redrawPlayer();
      redrawBasePreview();
      if (evolutionTarget === 1 && !hideTutorialCompleted) {
        for (const position of POST_FIRST_EVOLUTION_EGG_POSITIONS) {
          eggSystem.spawnEgg(position, progression.stageIndex);
        }
        hideTutorialArmed = true;
      }
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
    eggSystem.updateWorldEggMotion(dt, time);
    if (pickupFlash > 0) {
      const progress = 1 - pickupFlash / 0.42;
      pickupIndicator.alpha = 0.48 + Math.sin(progress * Math.PI) * 0.52;
    } else {
      pickupIndicator.alpha = 0.48;
    }
    playerSystem.move(input.x, input.y, dt, evolving);
    const hiddenNow = getBushCover(player.position) >= 0.5;
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
    const isPlayerMoving = Math.hypot(input.x, input.y) > 0.05;
    playerSystem.updateIdleVisual(
      time,
      isPlayerMoving,
      evolving,
      Math.hypot(input.x, input.y),
    );
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
        upgradeCurrencyHud.visible = true;
        upgradeOverlay.visible = true;
        upgradeFtueVisible = false;
        upgradeStation.rotation = 0;
        upgradeStation.scale.set(1);
        ui.setChildIndex(upgradeOverlay, ui.children.length - 1);
        ui.setChildIndex(upgradePanel, ui.children.length - 1);
        ui.setChildIndex(upgradeCurrencyHud, ui.children.length - 1);
        refreshUpgradeButtons();
      }
    } else if (!upgradeMenuOpen) {
      upgradeContactProgress = Math.max(0, upgradeContactProgress - dt * 2.5);
      upgradeStationCore.clear();
    }
    for (const egg of eggSystem.eggs) {
      if (
        !depositing &&
        egg.visible &&
        egg.parent === eggLayer &&
        distance(player.position, egg.position) < upgrades.pickupRadius
      ) {
        egg.visible = true;
        egg.scale.set(getCarriedEggScale());
        eggLayer.removeChild(egg);
        eggSystem.addCarriedEgg(egg);
        carried += 1;
        if (activeTutorialTarget === "EGG") {
          tutorialEggsCollected += 1;
          if (tutorialEggsCollected < 2) {
            tutorialEgg =
              eggSystem.eggs.find(
                (candidate) =>
                  candidate !== egg &&
                  candidate.visible &&
                  candidate.parent === eggLayer,
              ) ?? null;
            setTutorialTarget(tutorialEgg ? "EGG" : "NEST");
          } else {
            tutorialEgg = null;
            setTutorialTarget("NEST");
          }
        }
        if (!eggRespawnPending) {
          eggRespawnPending = true;
          eggRespawnTimer = eggSystem.randomRespawnDelay(egg.position);
        }
        pickupFlash = 0.42;
        shakeCamera(0.14, 5);
        world.addChildAt(egg, world.getChildIndex(player));
        updateUI();
      }
    }
    if (
      hideTutorialArmed &&
      !hideTutorialCompleted &&
      carried >= 2 &&
      activeTutorialTarget === null &&
      !upgradeMenuOpen
    ) {
      hideTutorialArmed = false;
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
      setTutorialTarget("BUSH");
    }
    const rivalsActive = RIVALS_START_ACTIVE || progression.stageIndex >= 1;
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
    }
    enemySystem.updateVisibility(rivalsActive);
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
    // Opening state: the red rival always chases the player from the start.
    // After the intro is completed, control returns to the regular rival AI.
    const introChaseActive =
      rivalsActive && !redIntroChaseCompleted && time >= enemies[0].dazedUntil;
    const activeChaser = introChaseActive
      ? enemies[0]
      : normalChaser &&
          distance(normalChaser.container.position, player.position) < 1200
        ? normalChaser
        : null;
    if (rivalsActive) {
      enemySystem.updateAI(
        dt,
        activeChaser,
        introChaseActive ? enemies[0] : null,
      );
    }
    enemySystem.updateDeposits(dt);
    if (
      !eggRespawnPending &&
      eggSystem.countActiveWorldEggs() < eggSystem.activeTarget
    ) {
      eggRespawnPending = true;
      eggRespawnTimer = eggSystem.randomRespawnDelay();
    }
    if (eggRespawnPending) {
      eggRespawnTimer = Math.max(0, eggRespawnTimer - dt);
      if (eggRespawnTimer <= 0 && eggSystem.spawnDirectorEgg(bushes)) {
        eggRespawnPending = false;
        if (eggSystem.countActiveWorldEggs() < eggSystem.activeTarget)
          eggRespawnPending = true;
        if (eggRespawnPending) eggRespawnTimer = eggSystem.randomRespawnDelay();
      }
    }
    if (!depositing && rivalsActive && !playerHidden) {
      const recoveredEnemyEgg = enemySystem.resolveStealing();
      if (recoveredEnemyEgg && activeTutorialTarget === "ENEMY") {
        tutorialEnemy = null;
        setTutorialTarget("NEST");
      }
      if (enemyTutorialPending) {
        enemyTutorialPending = false;
        enemyTutorialShown = true;
        tutorialEnemy = enemies[0];
        setTutorialTarget("ENEMY");
      }
      updateUI();
    }
    if (
      !depositing &&
      distance(player.position, base.position) < NEST_INTERACTION_RADIUS &&
      carried > 0
    ) {
      depositing = true;
      depositElapsed = 0;
      depositingEggs = [...eggSystem.carriedEggs];
      depositArrivals = depositingEggs.map(() => false);
      baseVisualDelivered = progression.delivered;
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
        const delivery = progression.recordDelivery(depositedCount);
        if (progression.delivered > 0) {
          firstDepositCompleted = true;
          clearTutorialTarget("NEST");
        }
        playerCollected += depositedCount;
        currency += depositedCount * 10;
        spawnCurrencyJuice(depositedCount);
        upgradePoints += depositedCount;
        carried = 0;
        baseVisualDelivered = progression.delivered;
        for (const egg of depositingEggs) eggSystem.releaseEgg(egg);
        eggSystem.takeAllCarriedEggs();
        depositingEggs = [];
        depositArrivals = [];
        depositing = false;
        if (delivery.shouldEvolve)
          startEvolutionFeedback(delivery.unlockedIndex);
        else {
          progression.completeEvolution(delivery.unlockedIndex);
          redrawPlayer();
          redrawBasePreview();
          updateUI();
        }
      }
    }
    if (!depositing && !playerHidden) {
      for (let i = 0; i < eggSystem.carriedEggs.length; i += 1) {
        const egg = eggSystem.carriedEggs[i];
        if (eggSystem.eggsInHideAnimation.has(egg)) continue;
        const leader = i === 0 ? player : eggSystem.carriedEggs[i - 1];
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
    if (
      activeTutorialTarget === "EGG" &&
      (!tutorialEgg || !tutorialEgg.visible || tutorialEgg.parent !== eggLayer)
    ) {
      tutorialEgg =
        eggSystem.eggs.find((egg) => egg.visible && egg.parent === eggLayer) ??
        null;
    }
    const baseScreen = base.toGlobal({ x: 0, y: 0 });
    const playerScreen = player.toGlobal({ x: 0, y: -105 });
    const baseOnScreen =
      baseScreen.x >= 0 &&
      baseScreen.x <= window.innerWidth &&
      baseScreen.y >= 0 &&
      baseScreen.y <= window.innerHeight;
    nestOffscreenElapsed = baseOnScreen ? 0 : nestOffscreenElapsed + dt;
    const showNestNavigation = nestOffscreenElapsed >= 15;
    const nestIndicatorActive =
      activeTutorialTarget === "NEST" ||
      (activeTutorialTarget === null && showNestNavigation);
    const tutorialWorldTarget = nestIndicatorActive
      ? base.position
      : activeTutorialTarget === "EGG" && tutorialEgg
        ? tutorialEgg.position
        : activeTutorialTarget === "UPGRADE"
          ? upgradeStation.position
          : activeTutorialTarget === "ENEMY" && tutorialEnemy
            ? tutorialEnemy.container.position
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
      !upgradeMenuOpen && (Boolean(activeTutorialTarget) || showNestNavigation);
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
