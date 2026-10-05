import "./style.css";
import { poki } from "./platform/poki";
import { GAME_ASSETS } from "./assets";
import { gridTextures } from "./art-textures";
import { createUpgradeAssetLoader } from "./upgrade-assets";
import { createWorldScene } from "./world/world-scene";
import { createEggSystem } from "./systems/eggs/egg-system";
import { createStackVisualController } from "./systems/eggs/stack-visual-controller";
import { createSessionTelemetry } from "./systems/pacing/session-telemetry";
import { createEnemySystem } from "./systems/enemies/enemy-system";
import {
  createPlayerSystem,
  type PlayerUpgrades,
} from "./systems/player/player-system";
import { createProgressionSystem } from "./systems/progression/progression-system";
import {
  createPacingDirector,
  type PacingDecision,
  type PacingState,
} from "./systems/pacing/pacing-director";
import type { Point } from "./game/types";
import {
  CAMERA_ZOOM,
  DEPOSIT_FEEDBACK,
  DEBUG_OPEN_UPGRADE_MENU,
  EGG_SPAWN_CONFIG,
  EGG_PICKUP_FEEDBACK,
  GOLD_MINE_CONFIG,
  INITIAL_EGG_POSITIONS,
  FUGITIVE_EGG_CONFIG,
  FUGITIVE_RAINBOW_COLORS,
  NEAR_LEVEL_UP_OPPORTUNITY,
  PACING_DIRECTOR_CONFIG,
  NEST_INTERACTION_RADIUS,
  POST_FIRST_EVOLUTION_EGG_POSITIONS,
  PLAYABLE_BOUNDS,
  POST_EVOLUTION_OPPORTUNITY,
  OPPORTUNITY_SPAWN_ZONES,
  RIVALS_START_ACTIVE,
  SESSION_PACING_CONFIG,
  SPECIAL_EGG_CONFIG,
  STAGES,
  UPGRADE_CONFIG,
  WORLD,
} from "./config/game-config";
import {
  createZoneRuntime,
  getAvailableZones,
  reserveZone,
  weightedPick,
} from "./systems/pacing/opportunity-spawn-zones";
import {
  createPowerUpManager,
  SpecialEggType,
} from "./systems/powerups/power-up-system";
import { createSpecialEggSystem } from "./systems/powerups/special-egg-system";
import { createFugitiveEggSystem } from "./systems/events/fugitive-egg-system";
import {
  createGoldMineSystem,
  type GoldMinePayout,
  type GoldMineInterest,
} from "./systems/events/gold-mine-system";
import {
  LEVEL_DESIGN_CONFIG,
  getLogicalRegion,
  getLogicalRegionBounds,
  isAllowedLogicalRegion,
} from "./config/level-design-config";
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
    featuresTexture,
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
      GAME_ASSETS.features,
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
  // Features.png is a compact art sheet for the special eggs and the mine.
  // Keep each crop in one place so gameplay systems only receive the visual
  // that belongs to their placeholder.
  const featureTexture = (x: number, y: number, width: number, height: number) =>
    new Texture({
      source: featuresTexture.source,
      frame: new Rectangle(x, y, width, height),
    });
  const featureTextures = {
    // Use inset, artwork-specific frames. The source sheet has transparent
    // bleed around the nominal columns, so equal 205px slices clip details
    // and sample pixels from neighboring eggs.
    range: featureTexture(20, 8, 220, 238),
    magnet: featureTexture(250, 8, 205, 238),
    orbit: featureTexture(445, 8, 180, 238),
    coin: featureTexture(635, 8, 205, 238),
    fugitive: featureTexture(835, 0, 189, 245),
    speed: featureTexture(20, 285, 230, 227),
    goldMine: featureTexture(245, 225, 575, 287),
  };
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
  const specialEggLayer = new Container();
  world.addChild(specialEggLayer);
  const fugitiveLayer = new Container();
  world.addChild(fugitiveLayer);
  const goldMineLayer = new Container();
  world.addChild(goldMineLayer);
  const specialEggSystem = createSpecialEggSystem({
    layer: specialEggLayer,
    textures: {
      [SpecialEggType.Speed]: featureTextures.speed,
      [SpecialEggType.Range]: featureTextures.range,
      [SpecialEggType.Magnet]: featureTextures.magnet,
      [SpecialEggType.Orbit]: featureTextures.orbit,
    },
    getDefinition: (type) => powerUpManager.getDefinition(type),
  });
  const normalPowerUpEntities = new Map<SpecialEggType, typeof specialEggSystem.entities[number]>();
  const pendingNormalPowerUpRespawns = new Set<SpecialEggType>();
  let initialPowerUpsSpawned = false;
  let evolution3FugitiveTriggered = false;
  let firstGoldMineSpawned = false;
  let goldMineTargetRegion: import("./config/level-design-config").LogicalRegion | null = null;
  let previousLogicalRegion = getLogicalRegion({ x: 3000, y: 3300 });
  const progression = createProgressionSystem();
  const powerUpManager = createPowerUpManager();
  const playerSystem = createPlayerSystem({
    world,
    evolutionFrames: playerEvolutionFrames,
    cloudTexture: playerCloudTexture,
    getStageIndex: () => progression.stageIndex,
    getSpeedMultiplier: () => powerUpManager.getModifiers().speedMultiplier,
    getPickupRangeMultiplier: () =>
      powerUpManager.getModifiers().pickupRangeMultiplier,
  });
  const { player, playerEvolution, playerCloud, pickupIndicator } =
    playerSystem;

  type SpeedParticle = {
    sprite: Graphics;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
  };
  const speedFx = new Container();
  world.addChildAt(speedFx, world.getChildIndex(player));
  const orbitFx = new Graphics();
  world.addChildAt(orbitFx, world.getChildIndex(player));
  const speedParticles: SpeedParticle[] = [];
  let speedTrailElapsed = 0;
  let speedBurstElapsed = 0;
  let speedBurstStrength = 0;
  let speedWasActive = false;
  let rangeWasActive = false;
  let orbitWasActive = false;
  let orbitTransitionRemaining = 0;
  let orbitFxStrength = 0;
  let orbitAngle = 0;
  const getCloudWorldPosition = (): Point => {
    const cloudGlobal = player.toGlobal(playerCloud.position);
    return world.toLocal(cloudGlobal);
  };
  let orbitCenter: Point = getCloudWorldPosition();
  const magnetizedEggs = new Map<Container, { delay: number; phase: number }>();

  function updateMagnetAttraction(dt: number, time: number) {
    const definition = SPECIAL_EGG_CONFIG.magnet;
    const magnetActive = powerUpManager.getActive(SpecialEggType.Magnet) !== undefined;
    const pickupRange = upgrades.pickupRadius * powerUpManager.getModifiers().pickupRangeMultiplier;
    const magnetRadius = pickupRange * definition.magnetRadiusMultiplier;
    const magnetRadiusSquared = magnetRadius * magnetRadius;
    const playerPosition = player.position;

    if (magnetActive && magnetizedEggs.size < definition.maxMagnetizedEggs) {
      for (const egg of eggSystem.getActiveWorldEggs()) {
        if (magnetizedEggs.has(egg)) continue;
        const dx = playerPosition.x - egg.x;
        const dy = playerPosition.y - egg.y;
        if (dx * dx + dy * dy <= magnetRadiusSquared) {
          magnetizedEggs.set(egg, {
            delay: Math.random() * 0.12,
            phase: Math.random() * Math.PI * 2,
          });
        }
      }
    }

    for (const [egg, state] of magnetizedEggs) {
      if (!egg.visible || egg.parent !== eggLayer) {
        magnetizedEggs.delete(egg);
        continue;
      }
      if (state.delay > 0) {
        state.delay = Math.max(0, state.delay - dt);
        continue;
      }
      const dx = playerPosition.x - egg.x;
      const dy = playerPosition.y - egg.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= pickupRange || distance < 0.001) continue;
      const attractionFactor = Math.max(0, Math.min(1, 1 - distance / magnetRadius));
      const attractionSpeed = definition.minAttractionSpeed +
        (definition.maxAttractionSpeed - definition.minAttractionSpeed) * attractionFactor;
      const step = Math.min(distance, attractionSpeed * dt);
      const wobble = Math.sin(time * 7 + state.phase) * Math.min(8, distance * 0.025);
      egg.x += (dx / distance) * step + (-dy / distance) * wobble * dt;
      egg.y += (dy / distance) * step + (dx / distance) * wobble * dt;
      egg.rotation += dt * 4;
    }
  }

  function spawnSpeedBurst(strength = 1) {
    speedBurstElapsed = 0;
    speedBurstStrength = Math.max(speedBurstStrength, strength);
    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI * 2;
      const particle = new Graphics().star(0, 0, 4, 5, 1.8).fill(0xffe27a);
      particle.position.set(player.x, player.y);
      speedFx.addChild(particle);
      speedParticles.push({
        sprite: particle,
        vx: Math.cos(angle) * (55 + strength * 25),
        vy: Math.sin(angle) * (55 + strength * 25),
        life: 0.24,
        maxLife: 0.24,
      });
    }
  }

  function updateSpeedFeedback(dt: number, time: number) {
    const speed = powerUpManager.getActive(SpecialEggType.Speed);
    const warningTime = SPECIAL_EGG_CONFIG.speed.expirationWarningTime;
    const activeAlpha = speed
      ? speed.remaining <= warningTime
        ? 0.55 + Math.abs(Math.sin(time * 8)) * 0.35
        : 1
      : 0;
    speedFx.alpha = Math.max(0, activeAlpha);
    speedTrailElapsed += dt;
    const inputMagnitude = Math.hypot(input.x, input.y);
    const moving = inputMagnitude > 0.05;
    const trailInterval = moving ? 0.045 : 0.12;
    if (speed && speedTrailElapsed >= trailInterval) {
      speedTrailElapsed = 0;
      const particle = new Graphics()
        .circle(0, 0, 7 + Math.random() * 4)
        .fill({ color: 0xfffff2, alpha: 0.94 });
      const trailDirection = moving
        ? { x: input.x / inputMagnitude, y: input.y / inputMagnitude }
        : { x: 0, y: 1 };
      const cloudPosition = speedFx.toLocal(
        player.toGlobal(playerCloud.position),
      );
      particle.position.set(
        cloudPosition.x -
          trailDirection.x * 30 +
          (moving ? 0 : (Math.random() - 0.5) * 18),
        cloudPosition.y -
          trailDirection.y * 30 +
          (moving ? 0 : (Math.random() - 0.5) * 18),
      );
      speedFx.addChild(particle);
      speedParticles.push({
        sprite: particle,
        vx: -trailDirection.x * (moving ? 34 : 8),
        vy: -trailDirection.y * (moving ? 34 : 8),
        life: moving ? 0.48 : 0.52,
        maxLife: moving ? 0.48 : 0.52,
      });
    }
    if (speedBurstStrength > 0) {
      speedBurstElapsed += dt;
      if (speedBurstElapsed >= 0.28) speedBurstStrength = 0;
    }
    for (let i = speedParticles.length - 1; i >= 0; i -= 1) {
      const particle = speedParticles[i];
      particle.life -= dt;
      particle.sprite.x += particle.vx * dt;
      particle.sprite.y += particle.vy * dt;
      particle.sprite.alpha = Math.max(0, particle.life / particle.maxLife);
      particle.sprite.scale.set(
        0.7 + (1 - particle.life / particle.maxLife) * 0.7,
      );
      if (particle.life <= 0) {
        particle.sprite.destroy();
        speedParticles.splice(i, 1);
      }
    }
  }

  type MagnetPulse = {
    ring: Graphics;
    elapsed: number;
    duration: number;
    startRadius: number;
    maxRadius: number;
    strength: number;
    active: boolean;
  };
  const magnetPulseLayer = new Container();
  world.addChildAt(magnetPulseLayer, world.getChildIndex(eggLayer));
  const magnetPulses: MagnetPulse[] = Array.from({ length: 4 }, () => {
    const ring = new Graphics()
      .circle(0, 0, 1)
      .stroke({
        color: SPECIAL_EGG_CONFIG.magnet.visual.color,
        alpha: 0.55,
        width: 2.5,
      });
    ring.visible = false;
    magnetPulseLayer.addChild(ring);
    return {
      ring,
      elapsed: 1,
      duration: SPECIAL_EGG_CONFIG.magnet.visual.pulseDuration,
      startRadius: 24,
      maxRadius: 1,
      strength: 1,
      active: false,
    };
  });
  let magnetPulseElapsed = 0;
  let magnetVfxWasActive = false;

  function emitMagnetPulse(activation = false) {
    const definition = SPECIAL_EGG_CONFIG.magnet;
    const pulseConfig = definition.visual;
    const target = magnetPulses.find((pulse) => !pulse.active);
    if (!target) return;
    const pickupRange = upgrades.pickupRadius * powerUpManager.getModifiers().pickupRangeMultiplier;
    target.elapsed = 0;
    target.duration = pulseConfig.pulseDuration;
    target.startRadius = pickupRange * definition.magnetRadiusMultiplier;
    target.maxRadius = pulseConfig.minRadius;
    target.strength = activation ? pulseConfig.activationPulseMultiplier : 1;
    target.active = true;
    target.ring.visible = true;
    const origin = magnetPulseLayer.toLocal(player.toGlobal({ x: 0, y: 0 }));
    target.ring.position.copyFrom(origin);
  }

  function updateMagnetPulseVfx(dt: number, time: number) {
    const definition = SPECIAL_EGG_CONFIG.magnet;
    const pulseConfig = definition.visual;
    const magnetActive = powerUpManager.getActive(SpecialEggType.Magnet) !== undefined;
    if (magnetActive && pulseConfig.pulseEnabled) {
      magnetPulseElapsed += dt;
      if (magnetPulseElapsed >= pulseConfig.pulseInterval) {
        magnetPulseElapsed -= pulseConfig.pulseInterval;
        emitMagnetPulse();
      }
    }
    if (magnetVfxWasActive && !magnetActive) {
      for (const pulse of magnetPulses) {
        if (pulse.active) pulse.duration = Math.max(pulse.elapsed + 0.3, 0.3);
      }
    }
    magnetVfxWasActive = magnetActive;
    for (const pulse of magnetPulses) {
      if (!pulse.active) continue;
      pulse.elapsed += dt;
      const progress = Math.min(1, pulse.elapsed / pulse.duration);
      const eased = 1 - (1 - progress) ** 3;
      const radius = pulse.startRadius + (pulse.maxRadius - pulse.startRadius) * eased;
      pulse.ring.position.copyFrom(
        magnetPulseLayer.toLocal(player.toGlobal({ x: 0, y: 0 })),
      );
      const alpha = pulseConfig.startAlpha * pulse.strength * (1 - progress) ** 0.9;
      pulse.ring
        .clear()
        .circle(0, 0, radius)
        .stroke({
          color: pulseConfig.color,
          alpha,
          width: 2.5,
        });
      if (progress >= 1) {
        pulse.active = false;
        pulse.ring.visible = false;
      }
    }
  }

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
  let sessionPhase = "OPENING";
  let firstClusterDelivered = false;
  let firstPowerUpDelivered = false;
  let powerUpsDelivered = 0;
  let lastPowerUpDeliveredTime = -Infinity;
  let worldPopulationElapsed = 0;
  let visibleOpportunityElapsed = 0;
  let lastPopulationSpawnTime = -Infinity;
  let goldMineUnlockRequested = false;
  let goldMineFirstEligibleAt = Number.POSITIVE_INFINITY;
  let goldMineIntroduced = false;
  let magnetFormationDelivered = false;
  let rangeFormationDelivered = false;
  let contextualPowerUpPending: "FUGITIVE" | "GOLD_MINE" | null = null;
  let contextualPowerUpRequestedAt = -Infinity;
  const sessionTelemetry = createSessionTelemetry(SESSION_PACING_CONFIG.visibleOpportunityCheckInterval);
  if (PACING_DIRECTOR_CONFIG.debug) {
    Object.defineProperty(window, "__monsterDebug", {
      configurable: true,
      value: {
        getPacingReport: () => sessionTelemetry.getReport(time),
        getPacingReportText: () => sessionTelemetry.formatReport(time),
      },
    });
  }
  let lastEggPickupTime = 0;
  let lastDepositTime = 0;
  let lastEvolutionTime = 0;
  let lastEnemyEncounterTime = 0;
  let highestRegionDiscovered = "Nest";
  let previousPlayerPosition: Point = { x: 3000, y: 3300 };
  let currency = 0;
  let playerCollected = 0;
  let pickupStreak: number = 0;
  let pickupStreakElapsed: number = EGG_PICKUP_FEEDBACK.streakTimeout;
  let pickupAudioContext: AudioContext | null = null;
  let playerHidden = false;
  let pickupFlash = 0;
  let cameraShakeTime = 0;
  let cameraShakeDuration = 0;
  let cameraShakeStrength = 0;
  let depositing = false;
  let depositElapsed = 0;
  let depositFlightDuration: number = DEPOSIT_FEEDBACK.maxDuration;
  let depositInterval: number = DEPOSIT_FEEDBACK.initialEggInterval;
  let pendingDelivery: {
    delivered: number;
    unlockedIndex: number;
    shouldEvolve: boolean;
  } | null = null;
  let evolutionDelayRemaining = 0;
  let pendingEvolutionIndex: number | null = null;
  let depositingEggs: Container[] = [];
  let depositEggOrigins: Point[] = [];
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
  let nestPulseElapsed = 0;
  let nestPulseStrength = 0;
  const getCurrentVisualScale = () => progression.visualScale;
  const getCarriedEggScale = () =>
    0.67 * Math.min(1.18, 1 + (getCurrentVisualScale() - 1) * 0.38);
  const getCarriedEggGap = () =>
    Math.max(
      10,
      60 * getCurrentVisualScale(),
    );
  function getOrbitSlotPosition(
    index: number,
    total: number,
    animationTime = time,
  ): Point {
    const orbitConfig = SPECIAL_EGG_CONFIG.orbit;
    const baseRadius = 45 * getCurrentVisualScale() + 28 + orbitConfig.orbitPadding;
    let ring = 0;
    let remaining = total;
    let ringSlot = index;
    let ringTotal = total;
    while (remaining > 0) {
      const radius = baseRadius + ring * orbitConfig.ringSpacing;
      const ringCapacity = Math.max(
        3,
        Math.floor((Math.PI * 2 * radius) / orbitConfig.desiredEggArcSpacing),
      );
      ringTotal = Math.min(ringCapacity, remaining);
      if (ringSlot < ringTotal) break;
      ringSlot -= ringTotal;
      remaining -= ringTotal;
      ring += 1;
    }
    const direction = ring % 2 === 0 ? 1 : -1;
    const ringSpeed = Math.pow(orbitConfig.ringSpeedFalloff, ring);
    const ringPhase = ring % 2 === 0 ? 0 : Math.PI / ringTotal;
    const angle =
      orbitAngle * direction * ringSpeed +
      ringPhase +
      (ringSlot / ringTotal) * Math.PI * 2;
    const radius =
      baseRadius +
      ring * orbitConfig.ringSpacing +
      Math.sin(animationTime * orbitConfig.bobFrequency + ring * 0.91) *
        orbitConfig.bobAmount;
    return {
      x: orbitCenter.x + Math.cos(angle) * radius,
      y: orbitCenter.y + Math.sin(angle) * radius * orbitConfig.ellipseY,
    };
  }
  const eggSystem = createEggSystem({
    eggLayer,
    eggFrames,
    coinTexture: featureTextures.coin,
    eggResolutionScale,
    getStageIndex: () => progression.stageIndex,
    getPlayerPosition: () => player.position,
    getNestPosition: () => base.position,
    getCarriedEggScale,
    getCarriedEggGap,
  });
  const stackVisualController = createStackVisualController();

  function getSessionPhase() {
    if (time < SESSION_PACING_CONFIG.openingEnd) return "OPENING";
    if (time < SESSION_PACING_CONFIG.earlyGameEnd) return "EARLY_GAME";
    if (time < SESSION_PACING_CONFIG.midGameEnd) return "MID_GAME";
    return "FULL_PACING";
  }

  function spawnBasePocket(count: number = EGG_SPAWN_CONFIG.pocketSize, cluster = false) {
    const movementAngle = Math.hypot(input.x, input.y) > 0.1
      ? Math.atan2(input.y, input.x)
      : -Math.PI / 2;
    const directionOffsets = [0, -0.46, 0.46, Math.PI];
    const candidates: Point[] = [];
    for (let i = 0; i < directionOffsets.length && candidates.length < count; i += 1) {
      const angle = movementAngle + directionOffsets[i];
      const distanceFromPlayer =
        EGG_SPAWN_CONFIG.pocketMinDistance +
        ((i * 137 + Math.floor(time * 10)) % 100) / 100 *
          (EGG_SPAWN_CONFIG.pocketMaxDistance - EGG_SPAWN_CONFIG.pocketMinDistance);
      const center = {
        x: player.x + Math.cos(angle) * distanceFromPlayer,
        y: player.y + Math.sin(angle) * distanceFromPlayer,
      };
      const position = {
        x: Math.max(PLAYABLE_BOUNDS.left + 50, Math.min(PLAYABLE_BOUNDS.right - 50, center.x)),
        y: Math.max(PLAYABLE_BOUNDS.top + 50, Math.min(PLAYABLE_BOUNDS.bottom - 50, center.y)),
      };
      if (!isOffscreenSafeOpportunityPosition(position)) continue;
      if (eggSystem.getActiveWorldEggs().some((egg) => distance(position, egg.position) < 180)) continue;
      candidates.push(position);
    }
    for (let i = 0; i < candidates.length; i += 1) {
      const offset = cluster ? { x: (i - (candidates.length - 1) / 2) * 105, y: (i % 2) * 42 } : { x: 0, y: 0 };
      eggSystem.spawnEgg(
        { x: candidates[i].x + offset.x, y: candidates[i].y + offset.y },
        progression.stageIndex,
        { source: cluster ? "CLUSTER" : "WORLD" },
      );
    }
    if (candidates.length > 0) lastPopulationSpawnTime = time;
    return candidates.length;
  }

  function updateSessionPacing(dt: number) {
    sessionPhase = getSessionPhase();
    worldPopulationElapsed += dt;
    visibleOpportunityElapsed += dt;

    if (!firstClusterDelivered && time >= SESSION_PACING_CONFIG.firstClusterMinTime) {
      if (time >= SESSION_PACING_CONFIG.firstClusterMaxTime || eggSystem.getActiveWorldEggs().length < EGG_SPAWN_CONFIG.baselineTarget) {
        firstClusterDelivered = spawnBasePocket(3, true) > 0;
        if (firstClusterDelivered) sessionTelemetry.record(time, "CLUSTER_SPAWNED", "MEDIUM", "opening");
      }
    }

    if (worldPopulationElapsed < EGG_SPAWN_CONFIG.populationCheckInterval) return;
    worldPopulationElapsed = 0;
    const activeEggs = eggSystem.getActiveWorldEggs();
    const visibleEggs = activeEggs.filter((egg) => isVisibleOpportunityPosition(egg.position)).length;
    const nearbyEggs = activeEggs.filter((egg) => distance(player.position, egg.position) < 1150).length;
    const shouldFillLocalFloor = visibleEggs < EGG_SPAWN_CONFIG.visibleFloor && nearbyEggs < EGG_SPAWN_CONFIG.nearbyFloor;
    const shouldMaintainBaseline = activeEggs.length < EGG_SPAWN_CONFIG.baselineTarget;
    const eventBusy = depositing || evolving || goldMineIntroduced &&
      ["ACTIVE", "EXTRACTING", "FINAL_JACKPOT"].includes(goldMineSystem.getSnapshot().state);
    if (!eventBusy && time - lastPopulationSpawnTime > EGG_SPAWN_CONFIG.populationCheckInterval && (shouldFillLocalFloor || shouldMaintainBaseline)) {
      spawnBasePocket(shouldFillLocalFloor ? 3 : 2, false);
      visibleOpportunityElapsed = 0;
    }
  }
  type JackpotBurstEgg = {
    egg: Container;
    vx: number;
    vy: number;
    elapsed: number;
    duration: number;
    start?: Point;
    target?: Point;
  };
  const jackpotBurstEggs = new Map<Container, JackpotBurstEgg>();
  let fugitiveInterest: {
    position: Point;
    availableAt: number;
    expiresAt: number;
  } | null = null;
  let goldMineWaveStrength = 0;
  let lastObservedGoldMineState = "READY";

  function spawnGoldMinePayout(payout: GoldMinePayout) {
    contextualPowerUpPending = "GOLD_MINE";
    contextualPowerUpRequestedAt = time;
    const total = payout.normalEggs + payout.coinEggs;
    const currentWorldEggs = eggSystem.countActiveWorldEggs();
    const available = Math.max(
      0,
      Math.min(
        GOLD_MINE_CONFIG.maxRewardEggs,
        eggSystem.activeTarget - currentWorldEggs,
      ),
    );
    const spawnCount = Math.min(total, available);
    const coinStart = Math.max(0, payout.normalEggs);
    const targetRadius = Math.min(
      GOLD_MINE_CONFIG.maxPayoutRadius,
      GOLD_MINE_CONFIG.payoutBaseRadius +
        payout.waveIndex * GOLD_MINE_CONFIG.payoutRadiusPerWave,
    );
    // Use a perfectly symmetric ring and ensure its circumference can fit
    // every egg with the configured minimum separation. The ring expands on
    // each successive payout wave.
    const minimumSymmetricRadius = spawnCount > 1
      ? GOLD_MINE_CONFIG.minimumEggSeparation /
        (2 * Math.sin(Math.PI / spawnCount))
      : 0;
    const ringRadius = Math.max(targetRadius, minimumSymmetricRadius);
    for (let i = 0; i < spawnCount; i += 1) {
      const baseAngle =
        (i / Math.max(1, spawnCount)) * Math.PI * 2 +
        (payout.waveIndex % 2 ? Math.PI / Math.max(1, spawnCount) : 0);
      const landingPosition = {
        x: payout.position.x + Math.cos(baseAngle) * ringRadius,
        y: payout.position.y + Math.sin(baseAngle) * ringRadius,
      };
      const isCoin =
        i >= coinStart;
      const egg = eggSystem.spawnEgg(
        payout.position,
        progression.stageIndex,
        {
          type: isCoin ? "COIN" : "NORMAL",
          coinValue: isCoin ? 10 : 1,
          progressionValue: 1,
          source: "GOLD_MINE",
        },
      );
      const launchAngle = Math.atan2(
        landingPosition.y - payout.position.y,
        landingPosition.x - payout.position.x,
      );
      const launchSpeed =
        (payout.final ? 420 : 280) + payout.waveIndex * 22 + (i % 4) * 35;
      jackpotBurstEggs.set(egg, {
        egg,
        vx: Math.cos(launchAngle) * launchSpeed,
        vy: Math.sin(launchAngle) * launchSpeed,
        elapsed: 0,
        duration: payout.final ? 1.0 : 0.72,
        start: { ...payout.position },
        target: { ...landingPosition },
      });
    }
    if (spawnCount < total && PACING_DIRECTOR_CONFIG.debug) {
      console.debug("[GOLD MINE] Reward budget reached", {
        requested: total,
        spawned: spawnCount,
        available,
      });
    }
    if (PACING_DIRECTOR_CONFIG.debug) {
      console.debug("[GOLD MINE] Payout radius", {
        wave: payout.waveIndex + 1,
        targetRadius: ringRadius,
        maxRadius: GOLD_MINE_CONFIG.maxPayoutRadius,
      });
    }
    goldMineWaveStrength = payout.final ? 1.4 : 0.7 + payout.waveIndex * 0.12;
    pickupFlash = payout.final ? 0.5 : 0.24;
    shakeCamera(payout.final ? 0.5 : 0.16, payout.final ? 9 : 3 + payout.waveIndex);
  }

  const goldMineSystem = createGoldMineSystem({
    layer: goldMineLayer,
    texture: featureTextures.goldMine,
    onPayout: spawnGoldMinePayout,
    onMetric: (metric, details) => {
      if (PACING_DIRECTOR_CONFIG.debug)
        console.debug(`[GOLD MINE] ${metric}`, details ?? "");
    },
  });
  // Eggs must render in front of the mine artwork when they land around it.
  world.setChildIndex(goldMineLayer, world.getChildIndex(eggLayer));
  const fugitiveSystem = createFugitiveEggSystem({
    layer: fugitiveLayer,
    texture: featureTextures.fugitive,
    getPlayerPosition: () => player.position,
    getPlayerSpeed: () => upgrades.speed * powerUpManager.getModifiers().speedMultiplier,
    onCapture: (position) => spawnFugitiveJackpot(position),
    onEscape: (position) => {
      if (PACING_DIRECTOR_CONFIG.debug) console.debug("[FUGITIVE] Escaped", { position });
    },
    debug: PACING_DIRECTOR_CONFIG.debug,
  });
  type OpportunitySpawn = {
    positions: Point[];
    elapsed: number;
    nextIndex: number;
    stageIndex: number;
    zoneId: string | null;
    discovered: boolean;
  };
  let postEvolutionOpportunity: OpportunitySpawn | null = null;
  let nearLevelOpportunitySerial = 0;
  const opportunityZoneRuntime = createZoneRuntime();
  let recentOpportunityZones: string[] = [];
  let selectedOpportunityZoneId: string | null = null;

  function isOffscreenSafeOpportunityPosition(position: Point) {
    const screenPosition = world.toGlobal(position);
    const margin = PACING_DIRECTOR_CONFIG.offscreenSpawnMargin;
    return (
      screenPosition.x < -margin ||
      screenPosition.x > window.innerWidth + margin ||
      screenPosition.y < -margin ||
      screenPosition.y > window.innerHeight + margin
    );
  }

  function chooseOpportunityZone(targetRegion: string) {
    const available = getAvailableZones(
      "NORMAL_EGG",
      time,
      opportunityZoneRuntime,
    ).filter((zone) => !recentOpportunityZones.includes(zone.id));
    const candidates =
      available.length > 0
        ? available
        : getAvailableZones("NORMAL_EGG", time, opportunityZoneRuntime);
    const dx = player.x - previousPlayerPosition.x;
    const dy = player.y - previousPlayerPosition.y;
    const movementLength = Math.hypot(dx, dy);
    const movementX = movementLength > 0.01 ? dx / movementLength : 0;
    const movementY = movementLength > 0.01 ? dy / movementLength : -1;
    const returningHome = player.y < base.y && dy > 0 && carried > 0;
    if (returningHome && carried >= PACING_DIRECTOR_CONFIG.heavyStackThreshold)
      return undefined;
    const weights = candidates.map((zone) => {
      const centerX = (zone.bounds.left + zone.bounds.right) * 0.5 - player.x;
      const centerY = (zone.bounds.top + zone.bounds.bottom) * 0.5 - player.y;
      const centerLength = Math.hypot(centerX, centerY) || 1;
      const forward = Math.max(
        0,
        (centerX * movementX + centerY * movementY) / centerLength,
      );
      const lateral = Math.sqrt(Math.max(0, 1 - forward * forward));
      let weight = zone.weight;
      if (zone.region === targetRegion)
        weight *= PACING_DIRECTOR_CONFIG.forwardExplorationWeight;
      weight *= 1 + forward * (PACING_DIRECTOR_CONFIG.forwardWeight - 1);
      weight *=
        1 + lateral * (PACING_DIRECTOR_CONFIG.sideExplorationWeight - 1);
      if (zone.side !== "CENTER")
        weight *= PACING_DIRECTOR_CONFIG.lateralWeight;
      if (targetRegion === "GoldMine" && zone.region !== "GoldMine")
        weight *= 0.65;
      if (zone.region === "Nest" && targetRegion !== "Exploration")
        weight *= 0.7;
      return weight;
    });
    return weightedPick(candidates, weights);
  }

  function isVisibleOpportunityPosition(position: Point) {
    const screenPosition = world.toGlobal(position);
    return (
      screenPosition.x >= -90 &&
      screenPosition.x <= window.innerWidth + 90 &&
      screenPosition.y >= -90 &&
      screenPosition.y <= window.innerHeight + 90
    );
  }

  function isValidOpportunityPosition(
    position: Point,
    chosen: Point[],
    minDistance: number = POST_EVOLUTION_OPPORTUNITY.minDistanceFromPlayer,
    maxDistance: number = POST_EVOLUTION_OPPORTUNITY.maxDistanceFromPlayer,
  ) {
    if (
      position.x < PLAYABLE_BOUNDS.left + 45 ||
      position.x > PLAYABLE_BOUNDS.right - 45 ||
      position.y < PLAYABLE_BOUNDS.top + 45 ||
      position.y > PLAYABLE_BOUNDS.bottom - 45
    )
      return false;
    if (distance(position, player.position) < minDistance) return false;
    if (distance(position, player.position) > maxDistance) return false;
    if (distance(position, base.position) < NEST_INTERACTION_RADIUS + 120)
      return false;
    if (
      chosen.some(
        (candidate) =>
          distance(position, candidate) <
          POST_EVOLUTION_OPPORTUNITY.minEggSpacing,
      )
    )
      return false;
    if (
      eggSystem
        .getActiveWorldEggs()
        .some(
          (egg) =>
            distance(position, egg.position) <
            POST_EVOLUTION_OPPORTUNITY.minEggSpacing,
        )
    )
      return false;
    if (
      bushes.some((bush) => {
        const normalizedX = (position.x - bush.x) / (bush.width * 0.5);
        const normalizedY =
          (position.y - (bush.y - bush.height * 0.44)) / (bush.height * 0.5);
        return Math.hypot(normalizedX, normalizedY) < 0.8;
      })
    )
      return false;
    return true;
  }

  function getOpportunityPositions(
    firstEvolution: boolean,
    count: number,
    targetRegion: string,
  ) {
    const directionSign = nearLevelOpportunitySerial % 2 === 0 ? 1 : -1;
    const selectedZone = chooseOpportunityZone(targetRegion);
    selectedOpportunityZoneId = selectedZone?.id ?? null;
    const zoneCenter = selectedZone
      ? {
          x: (selectedZone.bounds.left + selectedZone.bounds.right) * 0.5,
          y: (selectedZone.bounds.top + selectedZone.bounds.bottom) * 0.5,
        }
      : null;
    const zoneCandidates =
      selectedZone && zoneCenter
        ? [0.55, 0.72, 0.88, 1, 1, 1].map((progress, index) => {
            const spacing = (index % 2 ? -1 : 1) * (index < 4 ? 90 : 150);
            const x = player.x + (zoneCenter.x - player.x) * progress + spacing;
            const y = player.y + (zoneCenter.y - player.y) * progress;
            return {
              x: Math.min(
                selectedZone.bounds.right - 55,
                Math.max(selectedZone.bounds.left + 55, x),
              ),
              y: Math.min(
                selectedZone.bounds.bottom - 55,
                Math.max(selectedZone.bounds.top + 55, y),
              ),
            };
          })
        : [];
    const deterministic =
      zoneCandidates.length > 0
        ? zoneCandidates
        : firstEvolution
          ? POST_FIRST_EVOLUTION_EGG_POSITIONS
          : [
              { x: 0, y: -430 },
              { x: -170, y: -550 },
              { x: 175, y: -620 },
              { x: -35, y: -735 },
              { x: 245, y: -805 },
              { x: -255, y: -885 },
              { x: 65, y: -990 },
              { x: -155, y: -1100 },
              { x: 295, y: -1080 },
              { x: -330, y: -980 },
              { x: 390, y: -910 },
            ].map((offset) => ({
              x: player.x + offset.x * directionSign,
              y: player.y + offset.y,
            }));
    const candidates = firstEvolution
      ? deterministic
      : deterministic.sort(
          (a, b) => distance(a, player.position) - distance(b, player.position),
        );
    const chosen: Point[] = [];
    for (const candidate of candidates) {
      if (chosen.length >= count) break;
      if (
        isValidOpportunityPosition(candidate, chosen) &&
        (zoneCandidates.length === 0 ||
          isOffscreenSafeOpportunityPosition(candidate))
      ) {
        chosen.push(candidate);
      }
    }
    // Keep the breadcrumb on screen even when the fixed first-evolution layout
    // is partially outside the current camera framing.
    if (
      chosen.length === 0 ||
      chosen.length < count ||
      !isVisibleOpportunityPosition(chosen[0])
    ) {
      const fallbackCandidates = [
        { x: player.x - 120, y: player.y - 420 },
        { x: player.x + 120, y: player.y - 520 },
        { x: player.x, y: player.y - 650 },
        { x: player.x - 190, y: player.y - 760 },
        { x: player.x + 210, y: player.y - 840 },
      ];
      for (const candidate of fallbackCandidates) {
        if (chosen.length >= count) break;
        if (
          isValidOpportunityPosition(candidate, chosen) &&
          (!selectedZone || isOffscreenSafeOpportunityPosition(candidate))
        )
          chosen.push(candidate);
      }
    }
    if (chosen.length > 0 && selectedZone) {
      reserveZone(
        selectedZone,
        time,
        PACING_DIRECTOR_CONFIG.opportunityTimeout,
        PACING_DIRECTOR_CONFIG.zoneCooldown,
        opportunityZoneRuntime,
      );
      recentOpportunityZones = [
        selectedZone.id,
        ...recentOpportunityZones,
      ].slice(0, PACING_DIRECTOR_CONFIG.recentZoneHistorySize);
    }
    chosen.sort(
      (a, b) =>
        Number(isVisibleOpportunityPosition(b)) -
        Number(isVisibleOpportunityPosition(a)),
    );
    return chosen;
  }

  function queueDirectorOpportunity(decision: PacingDecision) {
    nearLevelOpportunitySerial += 1;
    const firstEvolution =
      decision.reason === "POST_EVOLUTION" && progression.stageIndex === 1;
    const targetCount = firstEvolution
      ? Math.min(POST_EVOLUTION_OPPORTUNITY.firstEvolutionEggCountMax, 10)
      : decision.type === "EggBreadcrumb"
        ? 3
        : decision.type === "ExplorationBreadcrumb"
          ? 5
          : POST_EVOLUTION_OPPORTUNITY.normalEggCount;
    const availableSlots = Math.max(
      0,
      eggSystem.activeTarget - eggSystem.countActiveWorldEggs(),
    );
    if (availableSlots === 0) return false;
    const positions = getOpportunityPositions(
      firstEvolution,
      Math.min(targetCount, availableSlots),
      decision.targetRegion,
    );
    if (positions.length === 0) return false;
    if (PACING_DIRECTOR_CONFIG.debug) {
      console.debug("[PacingDirector] opportunity spawn", {
        reason: decision.reason,
        intent: decision.targetRegion,
        zoneId: selectedOpportunityZoneId,
        offscreen: positions.every(isOffscreenSafeOpportunityPosition),
        allowedTypes: OPPORTUNITY_SPAWN_ZONES.find(
          (zone) => zone.id === selectedOpportunityZoneId,
        )?.allowedOpportunityTypes,
      });
    }
    postEvolutionOpportunity = {
      positions,
      elapsed: -POST_EVOLUTION_OPPORTUNITY.triggerDelay,
      nextIndex: 0,
      stageIndex: progression.stageIndex,
      zoneId: selectedOpportunityZoneId,
      discovered: false,
    };
    return true;
  }

  function updatePostEvolutionOpportunity(dt: number) {
    if (!postEvolutionOpportunity) return;
    postEvolutionOpportunity.elapsed += dt;
    if (
      !postEvolutionOpportunity.discovered &&
      postEvolutionOpportunity.positions.some(isVisibleOpportunityPosition)
    ) {
      postEvolutionOpportunity.discovered = true;
      if (PACING_DIRECTOR_CONFIG.debug) {
        console.debug("[PacingDirector] opportunityDiscovered", {
          zoneId: postEvolutionOpportunity.zoneId,
          type: "NORMAL_EGG",
        });
      }
    }
    while (
      postEvolutionOpportunity.nextIndex <
        postEvolutionOpportunity.positions.length &&
      postEvolutionOpportunity.elapsed >=
        postEvolutionOpportunity.nextIndex *
          POST_EVOLUTION_OPPORTUNITY.spawnInterval
    ) {
      const position =
        postEvolutionOpportunity.positions[postEvolutionOpportunity.nextIndex];
      eggSystem.spawnEgg(position, postEvolutionOpportunity.stageIndex, {
        source: "CLUSTER",
      });
      postEvolutionOpportunity.nextIndex += 1;
    }
    if (
      postEvolutionOpportunity.nextIndex >=
      postEvolutionOpportunity.positions.length
    ) {
      postEvolutionOpportunity = null;
    }
  }

  function spawnFugitiveJackpot(position: Point) {
    spawnFugitiveExplosion(position);
    contextualPowerUpPending = "FUGITIVE";
    contextualPowerUpRequestedAt = time;
    const count = FUGITIVE_EGG_CONFIG.jackpotEggCount;
    fugitiveInterest = {
      position: { ...position },
      availableAt: time + FUGITIVE_EGG_CONFIG.rivalInterestDelay,
      expiresAt: time + FUGITIVE_EGG_CONFIG.rivalInterestDelay + 3,
    };
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.24;
      const distanceFromCenter =
        FUGITIVE_EGG_CONFIG.jackpotMinRadius +
        Math.random() * (FUGITIVE_EGG_CONFIG.jackpotMaxRadius - FUGITIVE_EGG_CONFIG.jackpotMinRadius);
      const egg = eggSystem.spawnEgg(
        {
          x: position.x + Math.cos(angle) * distanceFromCenter * 0.55,
          y: position.y + Math.sin(angle) * distanceFromCenter * 0.55,
        },
        progression.stageIndex,
        {
          source: "FUGITIVE_JACKPOT",
          type: "NORMAL",
          coinValue: 1,
          progressionValue: 1,
        },
      );
      const launchSpeed = 520 + Math.random() * 240;
      jackpotBurstEggs.set(egg, {
        egg,
        vx: Math.cos(angle) * launchSpeed,
        vy: Math.sin(angle) * launchSpeed,
        elapsed: 0,
        duration: 1.05,
      });
    }
    pickupFlash = 0.32;
    shakeCamera(0.42, 8);
    if (PACING_DIRECTOR_CONFIG.debug) {
      console.debug("[FUGITIVE] Captured", {
        jackpotEggsSpawned: count,
        playerStackAtCapture: carried,
      });
    }
  }

  function spawnFugitiveExplosion(position: Point) {
    for (const particle of fugitiveExplosionParticles) particle.sprite.destroy();
    fugitiveExplosionParticles.length = 0;
    fugitiveExplosionElapsed = 0;
    fugitiveExplosionFlash.position.set(position.x, position.y);
    fugitiveExplosionRing.position.set(position.x, position.y);
    fugitiveExplosionFlash.visible = true;
    fugitiveExplosionRing.visible = true;
    for (let i = 0; i < 48; i += 1) {
      const angle = (i / 48) * Math.PI * 2 + (Math.random() - 0.5) * 0.16;
      const speed = 150 + (i % 6) * 24 + Math.random() * 80;
      const color = FUGITIVE_RAINBOW_COLORS[i % FUGITIVE_RAINBOW_COLORS.length];
      const particle = new Graphics()
        .star(0, 0, 5 + (i % 3), 4, 1.8)
        .fill({ color, alpha: 0.95 });
      particle.position.set(position.x, position.y);
      fugitiveExplosionFx.addChild(particle);
      fugitiveExplosionParticles.push({
        sprite: particle,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 45,
        life: 0.62 + (i % 4) * 0.08,
        maxLife: 0.62 + (i % 4) * 0.08,
        drag: 0.86 + (i % 3) * 0.025,
      });
    }
  }

  function updateFugitiveExplosion(dt: number) {
    if (fugitiveExplosionElapsed >= 0.95 && fugitiveExplosionParticles.length === 0) return;
    fugitiveExplosionElapsed += dt;
    const progress = Math.min(1, fugitiveExplosionElapsed / 0.95);
    const eased = 1 - (1 - progress) ** 3;
    fugitiveExplosionFlash
      .clear()
      .circle(0, 0, 24 + eased * 92)
      .fill({ color: 0xfff5d0, alpha: Math.max(0, 0.62 * (1 - progress) ** 1.7) });
    fugitiveExplosionRing
      .clear()
      .circle(0, 0, 30 + eased * 175)
      .stroke({ color: FUGITIVE_RAINBOW_COLORS[Math.floor(fugitiveExplosionElapsed * 18) % FUGITIVE_RAINBOW_COLORS.length], alpha: Math.max(0, 0.9 * (1 - progress)), width: 7 - progress * 4 });
    for (let i = fugitiveExplosionParticles.length - 1; i >= 0; i -= 1) {
      const particle = fugitiveExplosionParticles[i];
      particle.life -= dt;
      particle.vx *= Math.pow(particle.drag, dt * 60);
      particle.vy = particle.vy * Math.pow(particle.drag, dt * 60) + 110 * dt;
      particle.sprite.x += particle.vx * dt;
      particle.sprite.y += particle.vy * dt;
      particle.sprite.rotation += dt * 6;
      particle.sprite.alpha = Math.max(0, particle.life / particle.maxLife);
      particle.sprite.scale.set(0.75 + (particle.life / particle.maxLife) * 0.8);
      if (particle.life <= 0) {
        particle.sprite.destroy();
        fugitiveExplosionParticles.splice(i, 1);
      }
    }
    if (progress >= 1 && fugitiveExplosionParticles.length === 0) {
      fugitiveExplosionFlash.visible = false;
      fugitiveExplosionRing.visible = false;
    }
  }

  function updateJackpotBurst(dt: number) {
    for (const [egg, burst] of jackpotBurstEggs) {
      if (!egg.visible || egg.parent !== eggLayer) {
        jackpotBurstEggs.delete(egg);
        continue;
      }
      burst.elapsed += dt;
      if (burst.start && burst.target) {
        const progress = Math.min(1, burst.elapsed / burst.duration);
        const eased = 1 - (1 - progress) ** 3;
        const arc = Math.sin(progress * Math.PI) * 54;
        egg.x = burst.start.x + (burst.target.x - burst.start.x) * eased;
        egg.y =
          burst.start.y +
          (burst.target.y - burst.start.y) * eased -
          arc;
      } else {
        egg.x += burst.vx * dt;
        egg.y += burst.vy * dt;
        const drag = Math.max(0, 1 - dt * 4.5);
        burst.vx *= drag;
        burst.vy *= drag;
      }
      if (burst.elapsed >= burst.duration) jackpotBurstEggs.delete(egg);
    }
  }

  function spawnDebugSpecialEgg(type: SpecialEggType) {
    spawnDirectedSpecialEgg(
      {
        type: "SpecialEgg",
        reason: "DEAD_MOMENT",
        targetRegion: getCurrentRegion(player.y),
        channel: "SURPRISE",
        category: "POWER_UP",
        intensity: "MEDIUM",
      },
      type,
      true,
    );
  }

  function spawnDebugFugitive() {
    fugitiveSystem.spawn({
      x: Math.min(PLAYABLE_BOUNDS.right - 120, Math.max(PLAYABLE_BOUNDS.left + 120, player.x + 420)),
      y: Math.max(PLAYABLE_BOUNDS.top + 120, player.y - 180),
    });
  }

  function spawnDebugCoinEgg() {
    eggSystem.spawnEgg(
      {
        x: goldMineSystem.getPosition().x + 90,
        y: goldMineSystem.getPosition().y,
      },
      progression.stageIndex,
      {
        type: "COIN",
        coinValue: 10,
        progressionValue: 1,
        source: "GOLD_MINE",
      },
    );
  }

  function spawnDemonstrationFormation(center: Point, type: SpecialEggType) {
    const formation = type === SpecialEggType.Magnet
      ? LEVEL_DESIGN_CONFIG.formations.magnet
      : LEVEL_DESIGN_CONFIG.formations.range;
    for (let i = 0; i < formation.count; i += 1) {
      const angle = (i / formation.count) * Math.PI * 2;
      const position = {
        x: center.x + Math.cos(angle) * formation.radius,
        y: center.y + Math.sin(angle) * formation.radius,
      };
      if (
        position.x < PLAYABLE_BOUNDS.left + 80 ||
        position.x > PLAYABLE_BOUNDS.right - 80 ||
        position.y < PLAYABLE_BOUNDS.top + 80 ||
        position.y > PLAYABLE_BOUNDS.bottom - 80
      ) continue;
      eggSystem.spawnEgg(position, progression.stageIndex, {
        type: "NORMAL",
        coinValue: 1,
        progressionValue: 1,
        source: "CLUSTER",
      });
    }
  }

  function spawnNormalPowerUp(type: SpecialEggType, position: Point) {
    if (normalPowerUpEntities.has(type)) return false;
    const entity = specialEggSystem.spawn(type, position, {
      opportunityId: `normal-pool-${type.toLowerCase()}-${time.toFixed(2)}`,
      zoneId: getLogicalRegion(position),
    });
    normalPowerUpEntities.set(type, entity);
    if (type === SpecialEggType.Magnet && !magnetFormationDelivered) {
      magnetFormationDelivered = true;
      spawnDemonstrationFormation(position, type);
    }
    if (type === SpecialEggType.Range && !rangeFormationDelivered) {
      rangeFormationDelivered = true;
      spawnDemonstrationFormation(position, type);
    }
    return true;
  }

  function findNormalPowerUpPosition(type: SpecialEggType) {
    const occupiedRegions = new Set(
      [...normalPowerUpEntities.values()].map((entity) => getLogicalRegion(entity.container.position)),
    );
    const availableRegions = LEVEL_DESIGN_CONFIG.powerUpRegions.filter(
      (region) => !occupiedRegions.has(region),
    );
    const shuffled = [...availableRegions].sort(() => Math.random() - 0.5);
    for (const region of shuffled) {
      const bounds = getLogicalRegionBounds(region);
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const position = {
          x: bounds.left + 110 + Math.random() * Math.max(1, bounds.right - bounds.left - 220),
          y: bounds.top + 110 + Math.random() * Math.max(1, bounds.bottom - bounds.top - 220),
        };
        if (
          isOffscreenSafeOpportunityPosition(position) &&
          !specialEggSystem.entities.some((entity) =>
            entity !== normalPowerUpEntities.get(type) && distance(entity.container.position, position) < 260,
          )
        ) return position;
      }
    }
    return null;
  }

  function spawnInitialPowerUps() {
    if (initialPowerUpsSpawned) return;
    const initial: Array<[SpecialEggType, Point]> = [
      [SpecialEggType.Orbit, { x: 1350, y: -2750 }],
      [SpecialEggType.Speed, { x: 4750, y: -2750 }],
      [SpecialEggType.Range, { x: 1350, y: 2700 }],
      [SpecialEggType.Magnet, { x: 4750, y: 2700 }],
    ];
    for (const [type, position] of initial) spawnNormalPowerUp(type, position);
    initialPowerUpsSpawned = true;
    firstPowerUpDelivered = true;
  }

  function tryRespawnNormalPowerUps() {
    for (const type of [...pendingNormalPowerUpRespawns]) {
      const position = findNormalPowerUpPosition(type);
      if (!position) continue;
      if (spawnNormalPowerUp(type, position)) pendingNormalPowerUpRespawns.delete(type);
    }
  }

  // TEMPORARY QA SHOWCASE: press T to place every action egg, a coin egg,
  // the fugitive and the Gold Mine together below/right of the nest.
  function spawnDebugFeatureShowcase() {
    const origin = { x: base.x + 520, y: base.y + 140 };
    specialEggSystem.clear();
    fugitiveSystem.clear();
    const powerUpPositions: Array<[SpecialEggType, Point]> = [
      [SpecialEggType.Speed, { x: origin.x, y: origin.y }],
      [SpecialEggType.Range, { x: origin.x + 150, y: origin.y }],
      [SpecialEggType.Magnet, { x: origin.x + 300, y: origin.y }],
      [SpecialEggType.Orbit, { x: origin.x + 450, y: origin.y }],
    ];
    for (const [type, position] of powerUpPositions) {
      specialEggSystem.spawn(type, position, { opportunityId: "debug-showcase" });
    }
    fugitiveSystem.spawn({ x: origin.x + 600, y: origin.y });
    eggSystem.spawnEgg(
      { x: origin.x + 180, y: origin.y + 180 },
      progression.stageIndex,
      { type: "COIN", coinValue: 10, progressionValue: 1, source: "GOLD_MINE" },
    );
    goldMineSystem.debugPlace({ x: origin.x + 650, y: origin.y + 220 });
    if (PACING_DIRECTOR_CONFIG.debug) {
      console.debug("[TEMP SHOWCASE] Power-ups, fugitive, coin and Gold Mine spawned", { origin });
    }
  }

  function spawnDirectedSpecialEgg(
    decision: PacingDecision,
    type: SpecialEggType,
    contextual = false,
  ) {
    if (
      (!contextual && powerUpManager.getActive(type)) ||
      (!contextual && specialEggSystem.entities.some((entity) => entity.type === type))
    )
      return false;
    const opportunityType =
      type === SpecialEggType.Range
        ? "RANGE_EGG"
        : type === SpecialEggType.Orbit
          ? "ORBIT_EGG"
          : type === SpecialEggType.Magnet
            ? "MAGNET_EGG"
          : "SPEED_EGG";
    const zones = getAvailableZones(
      opportunityType,
      time,
      opportunityZoneRuntime,
    ).filter((zone) => {
      const center = {
        x: (zone.bounds.left + zone.bounds.right) * 0.5,
        y: (zone.bounds.top + zone.bounds.bottom) * 0.5,
      };
      return isAllowedLogicalRegion(center, LEVEL_DESIGN_CONFIG.powerUpRegions) &&
        (zone.region === decision.targetRegion || decision.reason === "DEAD_MOMENT");
    });
    const toCandidate = (zone: (typeof OPPORTUNITY_SPAWN_ZONES)[number], offscreenOnly: boolean) => {
        const center = {
          x: (zone.bounds.left + zone.bounds.right) * 0.5,
          y: (zone.bounds.top + zone.bounds.bottom) * 0.5,
        };
        const progress = 0.62;
        const sideOffset =
          zone.side === "LEFT" ? -115 : zone.side === "RIGHT" ? 115 : 0;
        const position = {
          x: Math.min(
            zone.bounds.right - 70,
            Math.max(
              zone.bounds.left + 70,
              player.x + (center.x - player.x) * progress + sideOffset,
            ),
          ),
          y: Math.min(
            zone.bounds.bottom - 70,
            Math.max(
              zone.bounds.top + 70,
              player.y + (center.y - player.y) * progress,
            ),
          ),
        };
        return {
          zone,
          position,
          valid: distance(position, player.position) >= (offscreenOnly ? 420 : 260) &&
            distance(position, player.position) <= 1250 &&
            (!offscreenOnly || isOffscreenSafeOpportunityPosition(position)) &&
            specialEggSystem.entities.every((entity) =>
              distance(entity.container.position, position) >= 260,
            ),
        };
      };
    const primaryCandidates = zones.map((zone) => toCandidate(zone, true));
    const fallbackZones = getAvailableZones(opportunityType, time, opportunityZoneRuntime)
      .filter((zone) => !zones.includes(zone));
    const fallbackCandidates = fallbackZones.map((zone) => toCandidate(zone, false));
    const selected = [...primaryCandidates, ...fallbackCandidates].find((candidate) => candidate.valid);
    if (PACING_DIRECTOR_CONFIG.debug) {
      console.debug("[Director] PowerUp Spawn Attempt", {
        candidate: type,
        eligible: true,
        positionCandidates: primaryCandidates.length + fallbackCandidates.length,
        rejected: [...primaryCandidates, ...fallbackCandidates].filter((candidate) => !candidate.valid).length,
        fallbackUsed: selected ? !primaryCandidates.includes(selected) : false,
        result: selected ? "SUCCESS" : "FAIL",
      });
    }
    if (!selected) return false;
    reserveZone(
      selected.zone,
      time,
      PACING_DIRECTOR_CONFIG.opportunityTimeout,
      PACING_DIRECTOR_CONFIG.zoneCooldown,
      opportunityZoneRuntime,
    );
    const entity = specialEggSystem.spawn(type, selected.position, {
      opportunityId: `${type.toLowerCase()}-${time.toFixed(2)}`,
      zoneId: selected.zone.id,
    });
    sessionTelemetry.record(time, "POWER_UP_SPAWNED", "MEDIUM", type);
    powerUpsDelivered += 1;
    lastPowerUpDeliveredTime = time;
    if (PACING_DIRECTOR_CONFIG.debug) {
      console.debug(`[${type.toUpperCase()} EGG] Spawned`, {
        zone: selected.zone.id,
        reason:
          decision.reason === "EXPLORATION_STALL"
            ? "ExplorationOpportunity"
            : decision.reason,
        id: entity.id,
      });
    }
    return true;
  }

  function spawnDirectedFugitive(decision: PacingDecision) {
    if (fugitiveSystem.active || progression.stageIndex < 2) return false;
    const zones = getAvailableZones("FUGITIVE_EGG", time, opportunityZoneRuntime)
      .filter((zone) => {
        const center = {
          x: (zone.bounds.left + zone.bounds.right) * 0.5,
          y: (zone.bounds.top + zone.bounds.bottom) * 0.5,
        };
        return isAllowedLogicalRegion(center, LEVEL_DESIGN_CONFIG.fugitiveRegions) &&
          (zone.region === decision.targetRegion || decision.reason === "DEAD_MOMENT");
      });
    const candidates = zones.map((zone) => {
      const center = {
        x: (zone.bounds.left + zone.bounds.right) * 0.5,
        y: (zone.bounds.top + zone.bounds.bottom) * 0.5,
      };
      const position = {
        x: Math.min(zone.bounds.right - 100, Math.max(zone.bounds.left + 100, player.x + (center.x - player.x) * 0.72)),
        y: Math.min(zone.bounds.bottom - 100, Math.max(zone.bounds.top + 100, player.y + (center.y - player.y) * 0.72)),
      };
      return { zone, position };
    }).filter(({ position }) =>
      distance(position, player.position) >= 620 &&
      distance(position, player.position) <= 1250 &&
      isOffscreenSafeOpportunityPosition(position),
    );
    const selected = candidates[0];
    if (!selected) return false;
    reserveZone(
      selected.zone,
      time,
      PACING_DIRECTOR_CONFIG.opportunityTimeout,
      FUGITIVE_EGG_CONFIG.cooldown,
      opportunityZoneRuntime,
    );
    fugitiveSystem.spawn(selected.position);
    sessionTelemetry.record(time, "FUGITIVE_SPAWNED", "MACRO");
    if (PACING_DIRECTOR_CONFIG.debug) {
      console.debug("[FUGITIVE] Spawned", {
        zone: selected.zone.id,
        reason: decision.reason,
      });
    }
    return true;
  }

  function trySpawnContextualPowerUp() {
    if (
      !contextualPowerUpPending ||
      carried < LEVEL_DESIGN_CONFIG.contextualPowerUp.minimumCarriedEggs ||
      time - contextualPowerUpRequestedAt < LEVEL_DESIGN_CONFIG.contextualPowerUp.minimumDelay ||
      specialEggSystem.entities.some((entity) => !normalPowerUpEntities.has(entity.type)) ||
      fugitiveSystem.active ||
      depositing ||
      evolving
    ) return;
    const type = Math.random() < 0.5 ? SpecialEggType.Speed : SpecialEggType.Orbit;
    const delivered = spawnDirectedSpecialEgg(
      {
        type: "SpecialEgg",
        reason: "DEAD_MOMENT",
        targetRegion: getCurrentRegion(player.y),
        specialEggType: type,
        channel: "SURPRISE",
        category: "POWER_UP",
        intensity: "MEDIUM",
      },
      type,
      true,
    );
    if (delivered) contextualPowerUpPending = null;
  }
  spawnInitialPowerUps();
  INITIAL_EGG_POSITIONS.forEach((position) => eggSystem.spawnEgg(position, 0));
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
    getWorldInterest: (enemyPosition): GoldMineInterest | null => {
      const mineInterest = goldMineSystem.getInterestTarget();
      const fugitiveTarget = fugitiveInterest &&
        time >= fugitiveInterest.availableAt &&
        time <= fugitiveInterest.expiresAt
        ? {
            position: fugitiveInterest.position,
            strength: 1.1,
            radius: LEVEL_DESIGN_CONFIG.enemyContest.maximumDistance,
            type: "FUGITIVE_JACKPOT" as const,
          }
        : null;
      const interest = mineInterest ?? fugitiveTarget;
      if (!interest) return null;
      const nearest = enemies
        .filter((enemy) => enemy.container.visible && !enemy.depositing)
        .sort((a, b) =>
          Math.hypot(a.container.x - interest.position.x, a.container.y - interest.position.y) -
          Math.hypot(b.container.x - interest.position.x, b.container.y - interest.position.y),
        )[0];
      if (!nearest) return null;
      const nearestDistance = Math.hypot(
        nearest.container.x - interest.position.x,
        nearest.container.y - interest.position.y,
      );
      const requestedDistance = Math.hypot(
        enemyPosition.x - interest.position.x,
        enemyPosition.y - interest.position.y,
      );
      return requestedDistance <= interest.radius && nearestDistance <= interest.radius &&
        Math.abs(requestedDistance - nearestDistance) < 1
        ? interest
        : null;
    },
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
      const cost = UPGRADE_CONFIG.initialCost + upgradeLevels[key] * UPGRADE_CONFIG.costStep;
      if (currency < cost) return;
      currency -= cost;
      upgradeLevels[key] += 1;
      sessionTelemetry.record(time, "UPGRADE_PURCHASED", "MEDIUM", key);
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
      const cost = UPGRADE_CONFIG.initialCost + upgradeLevels[upgrade.key] * UPGRADE_CONFIG.costStep;
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

  function getNearLevelUpState() {
    const carriedForProgress = depositing ? 0 : carried;
    const effectiveProgress = progression.delivered + carriedForProgress;
    const nextThreshold = progression.getNextThreshold();
    const remainingEggs = Math.max(0, nextThreshold - effectiveProgress);
    const nearbyEggs = eggSystem
      .getActiveWorldEggs()
      .filter(
        (egg) =>
          distance(player.position, egg.position) <=
          NEAR_LEVEL_UP_OPPORTUNITY.nearbyEggCheckRadius,
      ).length;
    return {
      isNearLevelUp:
        progression.delivered > 0 &&
        remainingEggs > 0 &&
        remainingEggs <= NEAR_LEVEL_UP_OPPORTUNITY.maxMissingEggs &&
        !depositing &&
        !evolving &&
        activeTutorialTarget === null,
      remainingEggs,
      carriedEggs: carried,
      nearbyEggs,
      hasValidOpportunity: nearbyEggs >= remainingEggs,
    };
  }

  tutorialEgg = eggSystem.eggs[0] ?? null;
  setTutorialTarget("EGG");

  function getCurrentRegion(y: number) {
    if (y > 2700) return "Nest";
    if (y > 500) return "Exploration";
    if (y > -2200) return "EnemyTerritory";
    return "GoldMine";
  }

  function getRegionRank(region: string) {
    return ["Nest", "Exploration", "EnemyTerritory", "GoldMine"].indexOf(
      region,
    );
  }

  const specialPowerUpText = label("", 14, 0xfff2a6);
  specialPowerUpText.position.set(18, 218);
  ui.addChild(specialPowerUpText);
  function refreshPowerUpHud() {
    const active = powerUpManager.getActivePowerUps();
    specialPowerUpText.text =
      active.length > 0
        ? active
            .map(
              (powerUp) =>
                `${powerUpManager.getDefinition(powerUp.type).icon} ${powerUp.remaining.toFixed(1)}s`,
            )
            .join("   ")
        : "";
  }

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
    refreshPowerUpHud();
    const displayedDelivered = depositing
      ? baseVisualDelivered
      : progression.delivered;
    if (
      uiState?.delivered === displayedDelivered &&
      uiState.currency === currency &&
      uiState.speed === upgrades.speed &&
      uiState.pickup === upgrades.pickupRadius &&
      uiState.playerScore === playerCollected &&
      uiState.rival1 === enemies[0].collected &&
      uiState.rival2 === enemies[1].collected
    )
      return;
    uiState = {
      delivered: displayedDelivered,
      currency,
      speed: upgrades.speed,
      pickup: upgrades.pickupRadius,
      playerScore: playerCollected,
      rival1: enemies[0].collected,
      rival2: enemies[1].collected,
    };
    const nextThreshold =
      STAGES.find((stage) => stage.threshold > displayedDelivered)?.threshold ??
      STAGES[STAGES.length - 1].threshold;
    progressText.text = `${displayedDelivered} / ${nextThreshold}`;
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

  const pacingDebugText = label("", 12, 0xb9d8e8);
  pacingDebugText.position.set(16, 105);
  pacingDebugText.visible = PACING_DIRECTOR_CONFIG.debug;
  ui.addChild(pacingDebugText);
  const opportunityZoneDebug = new Container();
  opportunityZoneDebug.visible = PACING_DIRECTOR_CONFIG.debug;
  world.addChild(opportunityZoneDebug);
  for (const zone of OPPORTUNITY_SPAWN_ZONES) {
    const zoneShape = new Graphics()
      .rect(
        zone.bounds.left,
        zone.bounds.top,
        zone.bounds.right - zone.bounds.left,
        zone.bounds.bottom - zone.bounds.top,
      )
      .stroke({
        color: zone.side === "LEFT" ? 0x65d5ff : 0xffca62,
        alpha: 0.55,
        width: 6,
      });
    const zoneLabel = label(zone.id, 22, 0xffffff);
    zoneLabel.position.set(zone.bounds.left + 14, zone.bounds.top + 14);
    opportunityZoneDebug.addChild(zoneShape, zoneLabel);
  }
  // The production build keeps this matrix hidden; when debug is enabled it
  // makes the event-placement contract visible while tuning the level.
  const regionWidth = (PLAYABLE_BOUNDS.right - PLAYABLE_BOUNDS.left) / 3;
  const regionHeight = (PLAYABLE_BOUNDS.bottom - PLAYABLE_BOUNDS.top) / 3;
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      const regionBounds = {
        left: PLAYABLE_BOUNDS.left + column * regionWidth,
        top: PLAYABLE_BOUNDS.top + row * regionHeight,
      };
      const center = {
        x: regionBounds.left + regionWidth * 0.5,
        y: regionBounds.top + regionHeight * 0.5,
      };
      const matrixLabel = label(getLogicalRegion(center), 20, 0xffffff);
      matrixLabel.position.set(regionBounds.left + 12, regionBounds.top + 12);
      opportunityZoneDebug.addChild(
        new Graphics()
          .rect(regionBounds.left, regionBounds.top, regionWidth, regionHeight)
          .stroke({ color: 0xffffff, alpha: 0.18, width: 3 }),
        matrixLabel,
      );
    }
  }
  const pacingDirector = createPacingDirector({
    debug: PACING_DIRECTOR_CONFIG.debug,
    config: PACING_DIRECTOR_CONFIG,
    getState: (): PacingState => {
      const currentRegion = getCurrentRegion(player.y);
      const nearbyEggCount = eggSystem
        .getActiveWorldEggs()
        .filter(
          (egg) =>
            distance(player.position, egg.position) <=
            POST_EVOLUTION_OPPORTUNITY.nearbyCheckRadius,
        ).length;
      const visibleEggCount = eggSystem
        .getActiveWorldEggs()
        .filter((egg) => isVisibleOpportunityPosition(egg.position)).length;
      const nearbyEnemyCount = enemies.filter(
        (enemy) =>
          enemy.container.visible &&
          distance(player.position, enemy.container.position) < 760,
      ).length;
      const visibleEnemyCount = enemies.filter(
        (enemy) =>
          enemy.container.visible &&
          isVisibleOpportunityPosition(enemy.container.position),
      ).length;
      const distanceBefore = distance(previousPlayerPosition, base.position);
      const distanceNow = distance(player.position, base.position);
      const playerIntent =
        depositing || distanceNow < NEST_INTERACTION_RADIUS
          ? "DEPOSITING"
          : carried > 0 && (input.y > 0.05 || distanceNow < distanceBefore)
            ? "RETURNING_HOME"
            : input.y < -0.05 || player.y < base.y - 250
              ? "EXPLORING"
              : "IDLE";
      const activityScore =
        visibleEggCount * 0.35 +
        nearbyEnemyCount * 0.8 +
        (carried > 0 ? 0.5 : 0) +
        (Math.hypot(input.x, input.y) > 0.05 ? 0.25 : 0) +
        (powerUpManager.getActivePowerUps().length > 0 ? 0.75 : 0);
      const nearLevel = getNearLevelUpState();
      return {
        playerLevel: progression.stageIndex,
        depositedProgress: progression.delivered,
        requiredProgress: progression.getNextThreshold(),
        carriedEggs: carried,
        remainingToLevel: nearLevel.remainingEggs,
        nearbyEggCount,
        visibleEggCount,
        nearbyEnemyCount,
        visibleEnemyCount,
        timeSinceLastEggPickup: time - lastEggPickupTime,
        timeSinceLastDeposit: time - lastDepositTime,
        timeSinceLastEvolution: time - lastEvolutionTime,
        timeSinceLastEnemyEncounter: time - lastEnemyEncounterTime,
        currentRegion,
        highestRegionDiscovered,
        activeOpportunity:
          postEvolutionOpportunity !== null ||
          specialEggSystem.entities.length > 0 ||
          fugitiveSystem.active ||
          ["ACTIVE", "EXTRACTING", "FINAL_JACKPOT"].includes(
            goldMineSystem.getSnapshot().state,
          ),
        relevantOpportunityVisible:
          visibleEggCount > 0 ||
          visibleEnemyCount > 0 ||
          postEvolutionOpportunity !== null ||
          specialEggSystem.entities.some((entity) =>
            isVisibleOpportunityPosition(entity.container.position),
          ) ||
          Boolean(
            fugitiveSystem.getSnapshot() &&
              isVisibleOpportunityPosition(fugitiveSystem.getSnapshot()!.position),
          ) ||
          ["ACTIVE", "EXTRACTING", "FINAL_JACKPOT"].includes(
            goldMineSystem.getSnapshot().state,
          ) ||
          depositing ||
          evolving,
        activePowerUps: powerUpManager
          .getActivePowerUps()
          .map((powerUp) => powerUp.type),
        playerIntent,
        activityScore,
        tutorialActive: activeTutorialTarget !== null,
        evolving,
        goldMineState: goldMineSystem.getSnapshot().state,
        goldMineActive: ["ACTIVE", "EXTRACTING", "FINAL_JACKPOT"].includes(
          goldMineSystem.getSnapshot().state,
        ),
        sessionPhase,
        firstPowerUpDelivered,
      };
    },
    onDecision: (decision) => {
      if (decision.type === "Fugitive") {
        return spawnDirectedFugitive(decision);
      } else if (decision.type === "SpecialEgg" && decision.specialEggType) {
        // The four normal power-ups are controlled exclusively by the pool
        // respawn logic. The pacing director must not create duplicates.
        return true;
      } else if (decision.type !== "UseExistingOpportunity") {
        return queueDirectorOpportunity(decision);
      }
      return true;
    },
  });
  if (DEBUG_OPEN_UPGRADE_MENU) {
    void preloadUpgradeAssets();
  }

  function chooseGoldMineRespawnPosition(): Point | null {
    const previous = goldMineSystem.getPosition();
    if (!firstGoldMineSpawned && goldMineTargetRegion) {
      const bounds = getLogicalRegionBounds(goldMineTargetRegion);
      const candidates: Point[] = [];
      for (const verticalOffset of [720, 980, 1240, 1500]) {
        for (const lateralOffset of [-300, 0, 300]) {
          const candidate = {
            x: Math.max(bounds.left + 120, Math.min(bounds.right - 120, player.x + lateralOffset)),
            y: Math.max(bounds.top + 120, Math.min(bounds.bottom - 120, player.y - verticalOffset)),
          };
          if (
            distance(candidate, player.position) >= 520 &&
            isOffscreenSafeOpportunityPosition(candidate)
          ) candidates.push(candidate);
        }
      }
      if (candidates.length > 0) {
        const movement = {
          x: player.x - previousPlayerPosition.x,
          y: player.y - previousPlayerPosition.y,
        };
        return candidates.sort((a, b) => {
          const score = (candidate: Point) =>
            (candidate.x - player.x) * movement.x + (candidate.y - player.y) * movement.y;
          return score(b) - score(a);
        })[0] ?? null;
      }
      return null;
    }
    const topCandidates = GOLD_MINE_CONFIG.spawnLocations.filter((candidate) =>
      isAllowedLogicalRegion(candidate, LEVEL_DESIGN_CONFIG.goldMineRegions),
    );
    const strictCandidates = topCandidates.filter((candidate) =>
      Math.hypot(candidate.x - player.x, candidate.y - player.y) >=
        GOLD_MINE_CONFIG.respawnMinDistance &&
      Math.hypot(candidate.x - previous.x, candidate.y - previous.y) >= 300 &&
      isOffscreenSafeOpportunityPosition(candidate),
    );
    const relaxedCandidates = topCandidates.filter((candidate) =>
      Math.hypot(candidate.x - player.x, candidate.y - player.y) >= 520 &&
      Math.hypot(candidate.x - previous.x, candidate.y - previous.y) >= 120,
    );
    const candidates = strictCandidates.length > 0
      ? strictCandidates
      : relaxedCandidates.length > 0
        ? relaxedCandidates
        : topCandidates;
    if (PACING_DIRECTOR_CONFIG.debug) {
      console.debug("[GoldMine] Respawn position audit", {
        strictCandidates: strictCandidates.length,
        relaxedCandidates: relaxedCandidates.length,
        fallbackUsed: strictCandidates.length === 0,
      });
    }
    if (candidates.length === 0) return null;
    const movement = {
      x: player.x - previousPlayerPosition.x,
      y: player.y - previousPlayerPosition.y,
    };
    const movementLength = Math.hypot(movement.x, movement.y) || 1;
    const forward = { x: movement.x / movementLength, y: movement.y / movementLength };
    const ranked = [...candidates].sort((a, b) => {
      const score = (candidate: Point) => {
        const dx = candidate.x - player.x;
        const dy = candidate.y - player.y;
        const length = Math.hypot(dx, dy) || 1;
        const ahead = (dx * forward.x + dy * forward.y) / length;
        const topBias = Math.max(0, (PLAYABLE_BOUNDS.bottom - candidate.y) / (PLAYABLE_BOUNDS.bottom - PLAYABLE_BOUNDS.top));
        return ahead * (goldMineIntroduced ? 0.35 : 1.2) + topBias * 0.2;
      };
      return score(b) - score(a);
    });
    return ranked[0] ?? null;
  }

  function handlePlayerRegionTransition() {
    const region = getLogicalRegion(player.position);
    if (region === previousLogicalRegion) return;
    previousLogicalRegion = region;
    if (
      !firstGoldMineSpawned &&
      LEVEL_DESIGN_CONFIG.goldMineRegions.includes(region) &&
      goldMineSystem.getSnapshot().state === "LOCKED"
    ) {
      goldMineTargetRegion = region;
      goldMineUnlockRequested = goldMineSystem.unlock();
      goldMineFirstEligibleAt = time;
      if (PACING_DIRECTOR_CONFIG.debug) {
        console.debug("[GoldMine] First upper-region trigger", { region });
      }
    }
  }

  function tryRespawnGoldMine() {
    if (!goldMineSystem.canRespawn()) return;
    if (time < goldMineFirstEligibleAt) return;
    const firstSpawn = !firstGoldMineSpawned;
    if (!firstSpawn && !pacingDirector.canStartHighIntensity()) return;
    const pacingState = pacingDirector.getDebugState();
    const competingEvent =
      pacingState.activeOpportunity !== null ||
      postEvolutionOpportunity !== null ||
      specialEggSystem.entities.length > 0 ||
      fugitiveSystem.active ||
      depositing ||
      evolving;
    if (!firstSpawn && competingEvent) return;
    const nextPosition = chooseGoldMineRespawnPosition();
    if (nextPosition) {
      const delivered = goldMineSystem.respawn(nextPosition);
      goldMineIntroduced = delivered || goldMineIntroduced;
      if (delivered) {
        firstGoldMineSpawned = firstGoldMineSpawned || firstSpawn;
        goldMineTargetRegion = null;
        sessionTelemetry.record(time, "GOLD_MINE_SPAWNED", "MACRO");
      }
    }
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
    "Digit1",
    "Digit2",
    "Digit3",
    "Digit4",
    "Digit5",
    "KeyG",
    "KeyH",
    "KeyJ",
    "KeyK",
    "KeyL",
    "KeyC",
    "KeyT",
  ]);
  window.addEventListener("keydown", (event) => {
    if (!keyboardCodes.has(event.code)) return;
    event.preventDefault();
    if (event.code === "Digit1") {
      spawnDebugSpecialEgg(SpecialEggType.Speed);
      return;
    }
    if (event.code === "Digit2") {
      spawnDebugSpecialEgg(SpecialEggType.Range);
      return;
    }
    if (event.code === "Digit3") {
      spawnDebugSpecialEgg(SpecialEggType.Orbit);
      return;
    }
    if (event.code === "Digit4") {
      spawnDebugSpecialEgg(SpecialEggType.Magnet);
      return;
    }
    if (event.code === "Digit5") {
      spawnDebugFugitive();
      return;
    }
    if (event.code === "KeyT") {
      spawnDebugFeatureShowcase();
      return;
    }
    if (PACING_DIRECTOR_CONFIG.debug) {
      if (event.code === "KeyG") goldMineSystem.debugActivate();
      if (event.code === "KeyH") goldMineSystem.debugAdvance();
      if (event.code === "KeyJ") goldMineSystem.debugFinalJackpot();
      if (event.code === "KeyK") goldMineSystem.debugExhaust();
      if (event.code === "KeyL") goldMineSystem.debugReset();
      if (event.code === "KeyC") spawnDebugCoinEgg();
      if (event.code.startsWith("Key")) return;
    }
    if (PACING_DIRECTOR_CONFIG.debug) {
      const debugTypes: Record<string, SpecialEggType> = {
        Digit1: SpecialEggType.Speed,
        Digit2: SpecialEggType.Range,
        Digit3: SpecialEggType.Orbit,
        Digit4: SpecialEggType.Magnet,
      };
      const debugType = debugTypes[event.code];
      if (debugType) {
        spawnDebugSpecialEgg(debugType);
        return;
      }
    }
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
  type PickupAnimation = {
    egg: Container;
    from: Point;
    elapsed: number;
    duration: number;
    arc: number;
    startScale: number;
    streak: number;
  };
  type PickupParticle = {
    sprite: Graphics;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
  };
  const pickupAnimations: PickupAnimation[] = [];
  const pickupAnimatingEggs = new Set<Container>();
  const pickupParticles: PickupParticle[] = [];
  const stackReactions = new Map<Container, number>();
  const pickupFx = new Container();
  world.addChild(pickupFx);
  type FugitiveExplosionParticle = {
    sprite: Graphics;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    drag: number;
  };
  const fugitiveExplosionFx = new Container();
  const fugitiveExplosionFlash = new Graphics();
  const fugitiveExplosionRing = new Graphics();
  fugitiveExplosionFlash.visible = false;
  fugitiveExplosionRing.visible = false;
  fugitiveExplosionFx.addChild(fugitiveExplosionFlash, fugitiveExplosionRing);
  world.addChild(fugitiveExplosionFx);
  const fugitiveExplosionParticles: FugitiveExplosionParticle[] = [];
  let fugitiveExplosionElapsed = 1;

  function playEggPickupSound(streak: number) {
    try {
      pickupAudioContext ??= new AudioContext();
      if (pickupAudioContext.state === "suspended")
        void pickupAudioContext.resume();
      const now = pickupAudioContext.currentTime;
      const oscillator = pickupAudioContext.createOscillator();
      const gain = pickupAudioContext.createGain();
      const pitch = Math.min(
        EGG_PICKUP_FEEDBACK.maxPitch,
        1 +
          Math.min(streak - 1, EGG_PICKUP_FEEDBACK.maxFeedbackStreak - 1) *
            EGG_PICKUP_FEEDBACK.pitchStep,
      );
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(440 * pitch, now);
      oscillator.frequency.exponentialRampToValueAtTime(
        700 * pitch,
        now + 0.075,
      );
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.045, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      oscillator.connect(gain).connect(pickupAudioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.125);
    } catch {
      // Audio is optional; browser policies and unsupported contexts must not affect gameplay.
    }
  }

  function spawnEggPickupImpact(position: Point, streak: number) {
    const intensity = Math.min(streak, EGG_PICKUP_FEEDBACK.maxFeedbackStreak);
    const count =
      4 + Math.floor(intensity * EGG_PICKUP_FEEDBACK.particleIntensity);
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + time * 0.4;
      const speed = 42 + intensity * 5 + (i % 2) * 12;
      const particle = new Graphics()
        .star(0, 0, 4, 5, 1.8)
        .fill(i % 2 ? 0xfff2a6 : 0x9cecff);
      particle.position.set(position.x, position.y);
      pickupFx.addChild(particle);
      pickupParticles.push({
        sprite: particle,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.24 + intensity * 0.012,
        maxLife: 0.24 + intensity * 0.012,
      });
    }
  }

  function beginEggPickupFeedback(egg: Container) {
    pickupStreak =
      pickupStreakElapsed <= EGG_PICKUP_FEEDBACK.streakTimeout
        ? Math.min(pickupStreak + 1, EGG_PICKUP_FEEDBACK.maxFeedbackStreak)
        : 1;
    pickupStreakElapsed = 0;
    pickupAnimations.push({
      egg,
      from: { x: egg.x, y: egg.y },
      elapsed: 0,
      duration: EGG_PICKUP_FEEDBACK.pullDuration,
      arc: (pickupStreak % 2 ? 1 : -1) * (10 + Math.min(pickupStreak, 4) * 2),
      startScale: getCarriedEggScale(),
      streak: pickupStreak,
    });
    pickupAnimatingEggs.add(egg);
    playEggPickupSound(pickupStreak);
  }

  function updateEggPickupFeedback(dt: number) {
    pickupStreakElapsed += dt;
    for (let i = pickupAnimations.length - 1; i >= 0; i -= 1) {
      const animation = pickupAnimations[i];
      animation.elapsed += dt;
      const progress = Math.min(1, animation.elapsed / animation.duration);
      const eased = 1 - (1 - progress) ** 3;
      const target = player.position;
      animation.egg.position.set(
        animation.from.x + (target.x - animation.from.x) * eased,
        animation.from.y +
          (target.y - animation.from.y) * eased +
          Math.sin(progress * Math.PI) * animation.arc,
      );
      const pop =
        progress < 0.22
          ? 1 + (EGG_PICKUP_FEEDBACK.popScale - 1) * (progress / 0.22)
          : 1 +
            (EGG_PICKUP_FEEDBACK.popScale - 1) *
              (1 - (progress - 0.22) / 0.78) *
              0.25;
      animation.egg.scale.set(animation.startScale * pop);
      if (progress >= 1) {
        const impactPosition = { x: target.x, y: target.y };
        animation.egg.scale.set(
          animation.startScale * EGG_PICKUP_FEEDBACK.impactScale,
        );
        stackReactions.set(animation.egg, 0);
        spawnEggPickupImpact(impactPosition, animation.streak);
        pickupAnimatingEggs.delete(animation.egg);
        pickupAnimations.splice(i, 1);
      }
    }
    for (const [egg, elapsed] of stackReactions) {
      const nextElapsed = elapsed + dt;
      if (nextElapsed >= 0.18) {
        stackReactions.delete(egg);
        egg.scale.set(getCarriedEggScale());
        continue;
      }
      const progress = nextElapsed / 0.18;
      const reaction =
        progress < 0.45
          ? 0.8 + (EGG_PICKUP_FEEDBACK.impactScale - 0.8) * (progress / 0.45)
          : EGG_PICKUP_FEEDBACK.impactScale -
            (EGG_PICKUP_FEEDBACK.impactScale - 1) * ((progress - 0.45) / 0.55);
      egg.scale.set(getCarriedEggScale() * reaction);
      stackReactions.set(egg, nextElapsed);
    }
    for (let i = pickupParticles.length - 1; i >= 0; i -= 1) {
      const particle = pickupParticles[i];
      particle.life -= dt;
      particle.sprite.x += particle.vx * dt;
      particle.sprite.y += particle.vy * dt;
      particle.sprite.rotation += dt * 8;
      particle.sprite.alpha = Math.max(0, particle.life / particle.maxLife);
      particle.sprite.scale.set(0.7 + (particle.life / particle.maxLife) * 0.3);
      if (particle.life <= 0) {
        particle.sprite.destroy();
        pickupParticles.splice(i, 1);
      }
    }
  }

  type DepositParticle = {
    sprite: Graphics;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
  };
  const depositParticles: DepositParticle[] = [];
  const depositFx = new Container();
  world.addChild(depositFx);

  function getDepositIntensity(count: number) {
    if (count <= DEPOSIT_FEEDBACK.smallDepositMax) return 1;
    if (count <= DEPOSIT_FEEDBACK.mediumDepositMax) return 1.25;
    return 1.6;
  }

  function pulseNest(strength: number) {
    nestPulseElapsed = 0;
    nestPulseStrength = Math.max(nestPulseStrength, strength);
  }

  function playDepositSound(index: number, count: number, final: boolean) {
    try {
      pickupAudioContext ??= new AudioContext();
      if (pickupAudioContext.state === "suspended")
        void pickupAudioContext.resume();
      const now = pickupAudioContext.currentTime;
      const oscillator = pickupAudioContext.createOscillator();
      const gain = pickupAudioContext.createGain();
      const pitch = Math.min(
        DEPOSIT_FEEDBACK.maxPitch,
        1 +
          Math.min(index, DEPOSIT_FEEDBACK.mediumDepositMax) *
            DEPOSIT_FEEDBACK.pitchStep,
      );
      oscillator.type = final ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime((final ? 520 : 330) * pitch, now);
      oscillator.frequency.exponentialRampToValueAtTime(
        (final ? 780 : 520) * pitch,
        now + (final ? 0.12 : 0.07),
      );
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(
        final ? 0.075 : 0.035,
        now + 0.008,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + (final ? 0.18 : 0.105),
      );
      oscillator.connect(gain).connect(pickupAudioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + (final ? 0.19 : 0.11));
    } catch {
      // Optional feedback must never interfere with the deposit state.
    }
  }

  function spawnDepositImpact(count: number, final: boolean) {
    const intensity = getDepositIntensity(count) * (final ? 1.5 : 1);
    const particleCount = final ? 10 : Math.max(2, Math.round(2 + intensity));
    for (let i = 0; i < particleCount; i += 1) {
      const angle = (i / particleCount) * Math.PI * 2 + time * 0.3;
      const speed = (final ? 70 : 34) * intensity + (i % 2) * 10;
      const particle = new Graphics()
        .star(0, 0, final ? 5 : 4, 5, final ? 2.2 : 1.7)
        .fill(i % 2 ? 0xfff2a6 : 0x9cecff);
      particle.position.set(base.x, base.y - 22);
      depositFx.addChild(particle);
      depositParticles.push({
        sprite: particle,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (final ? 18 : 0),
        life: final ? 0.42 : 0.25,
        maxLife: final ? 0.42 : 0.25,
      });
    }
  }

  function updateDepositFeedback(dt: number) {
    if (nestPulseStrength > 0) {
      nestPulseElapsed += dt;
      const progress = Math.min(1, nestPulseElapsed / 0.2);
      const pulse = Math.sin(progress * Math.PI) * nestPulseStrength;
      base.scale.set(1 + pulse);
      if (progress >= 1) {
        nestPulseStrength = 0;
        base.scale.set(1);
      }
    }
    for (let i = depositParticles.length - 1; i >= 0; i -= 1) {
      const particle = depositParticles[i];
      particle.life -= dt;
      particle.sprite.x += particle.vx * dt;
      particle.sprite.y += particle.vy * dt;
      particle.sprite.rotation += dt * 7;
      particle.sprite.alpha = Math.max(0, particle.life / particle.maxLife);
      if (particle.life <= 0) {
        particle.sprite.destroy();
        depositParticles.splice(i, 1);
      }
    }
  }

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
    sessionTelemetry.record(time, "UPGRADE_INTRODUCED", "MEDIUM");
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
      sessionTelemetry.record(time, "EVOLUTION", "MACRO", String(evolutionTarget));
      lastEvolutionTime = time;
      redrawPlayer();
      redrawBasePreview();
      pacingDirector.request("POST_EVOLUTION");
      if (evolutionTarget === 1 && !hideTutorialCompleted) {
        hideTutorialArmed = true;
      }
      if (basePreview.visible) {
        basePreview.scale.set(0.08);
        nestPreviewJuiceElapsed = 0;
        nestPreviewJuiceActive = true;
      }
      // First upgrade presentation is guaranteed immediately after the first evolution.
      if (evolutionTarget === 2) {
        unlockUpgradeStationTutorial();
        if (!evolution3FugitiveTriggered && !fugitiveSystem.active) {
          fugitiveSystem.spawn({
            x: Math.max(PLAYABLE_BOUNDS.left + 120, Math.min(PLAYABLE_BOUNDS.right - 120, player.x + 150)),
            y: Math.max(PLAYABLE_BOUNDS.top + 160, player.y - 720),
          });
          evolution3FugitiveTriggered = true;
          sessionTelemetry.record(time, "FUGITIVE_SPAWNED", "MACRO", "EVOLUTION_3");
        }
      }
      updateUI();
    }
  }

  function spawnCurrencyJuice(amount: number, coinEggCount = 0) {
    const start = base.toGlobal({ x: 0, y: 0 });
    const visualCount = Math.min(24, Math.max(1, Math.ceil(amount / 2)));
    for (let i = 0; i < visualCount; i += 1) {
      const sprite = new Graphics()
        .circle(0, 0, coinEggCount > 0 ? 9 : 7)
        .fill(coinEggCount > 0 ? 0xffffd0 : 0xfff2a6)
        .circle(0, 0, coinEggCount > 0 ? 4 : 3)
        .fill(coinEggCount > 0 ? 0xffd45c : 0xffc95c);
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
    powerUpManager.update(dt);
    specialEggSystem.update(dt, time);
    tryRespawnNormalPowerUps();
    trySpawnContextualPowerUp();
    goldMineSystem.update(dt, time, player.position);
    const goldMineSnapshot = goldMineSystem.getSnapshot();
    if (
      goldMineSnapshot.state === "ACTIVE" &&
      lastObservedGoldMineState !== "ACTIVE" &&
      lastObservedGoldMineState !== "EXTRACTING" &&
      lastObservedGoldMineState !== "FINAL_JACKPOT"
    ) {
      pacingDirector.recordReward("GoldMine", "SURPRISE", "HIGH");
      sessionTelemetry.record(time, "GOLD_MINE_ACTIVATED", "MACRO");
    }
    if (goldMineSnapshot.state === "EXHAUSTED" && lastObservedGoldMineState !== "EXHAUSTED") {
      sessionTelemetry.record(time, "GOLD_MINE_COMPLETED", "MACRO");
    }
    lastObservedGoldMineState = goldMineSnapshot.state;
    goldMineWaveStrength = Math.max(0, goldMineWaveStrength - dt * 1.8);
    updateMagnetPulseVfx(dt, time);
    const speedActive =
      powerUpManager.getActive(SpecialEggType.Speed) !== undefined;
    if (speedWasActive && !speedActive && PACING_DIRECTOR_CONFIG.debug) {
      console.debug("[SPEED EGG] Speed Expired");
    }
    speedWasActive = speedActive;
    const rangeActive =
      powerUpManager.getActive(SpecialEggType.Range) !== undefined;
    if (rangeWasActive && !rangeActive && PACING_DIRECTOR_CONFIG.debug) {
      console.debug("[RANGE EGG] Expired");
    }
    rangeWasActive = rangeActive;
    const orbitActive = powerUpManager.getActive(SpecialEggType.Orbit) !== undefined;
    const orbitJustActivated = !orbitWasActive && orbitActive;
    if (orbitWasActive !== orbitActive) {
      orbitWasActive = orbitActive;
      orbitTransitionRemaining = SPECIAL_EGG_CONFIG.orbit.transitionDuration;
    }
    const orbitInTransition = orbitTransitionRemaining > 0;
    if (orbitInTransition) {
      orbitTransitionRemaining = Math.max(0, orbitTransitionRemaining - dt);
    }
    const orbitLayoutActive = orbitActive || orbitInTransition;
    if (orbitLayoutActive) {
      const orbitRemaining =
        powerUpManager.getActive(SpecialEggType.Orbit)?.remaining ?? 0;
      const orbitSpeedFactor =
        orbitActive &&
        orbitRemaining <= SPECIAL_EGG_CONFIG.orbit.expirationWarningTime
          ? 0.78
          : 1;
      orbitAngle += SPECIAL_EGG_CONFIG.orbit.orbitSpeed * orbitSpeedFactor * dt;
      const cloudPosition = getCloudWorldPosition();
      orbitCenter.x += (cloudPosition.x - orbitCenter.x) * Math.min(1, dt * 18);
      orbitCenter.y += (cloudPosition.y - orbitCenter.y) * Math.min(1, dt * 18);
    } else {
      orbitCenter = getCloudWorldPosition();
    }
    const orbitFollowRate = orbitLayoutActive ? 8 : 12;
    orbitFxStrength = Math.max(
      0,
      orbitFxStrength - dt * (orbitLayoutActive ? 1.6 : 4),
    );
    if (orbitJustActivated) orbitFxStrength = 1;
    orbitFx.clear();
    if (orbitLayoutActive || orbitFxStrength > 0) {
      const orbitRadius =
        45 * getCurrentVisualScale() +
        28 +
        SPECIAL_EGG_CONFIG.orbit.orbitPadding +
        18;
      orbitFx.position.set(orbitCenter.x, orbitCenter.y);
      orbitFx.rotation = orbitAngle * 0.7;
      orbitFx.alpha = orbitLayoutActive ? 0.34 : orbitFxStrength * 0.34;
      orbitFx
        .arc(0, 0, orbitRadius, -0.95, 0.45)
        .stroke({ color: SPECIAL_EGG_CONFIG.orbit.tint, width: 3, alpha: 0.8 })
        .arc(0, 0, orbitRadius + 7, 2.1, 3.45)
        .stroke({ color: 0xffffff, width: 2, alpha: 0.72 });
    }
    updateSpeedFeedback(dt, time);
    playerSystem.updatePickupRangeIndicator(dt);
    refreshPowerUpHud();
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
      UPGRADE_CONFIG.initialCost + upgradeLevels.speed * UPGRADE_CONFIG.costStep,
      UPGRADE_CONFIG.initialCost + upgradeLevels.pickupRadius * UPGRADE_CONFIG.costStep,
    );
    upgradeAlert.visible = currency >= cheapestUpgrade;
    if (upgradeAlert.visible) {
      upgradeAlert.scale.set(1 + Math.sin(time * 7) * 0.16);
      upgradeAlert.rotation = Math.sin(time * 11) * 0.08;
    }
    pickupFlash = Math.max(0, pickupFlash - dt);
    eggSystem.updateWorldEggMotion(dt, time);
    const rangeIndicatorActive = powerUpManager.getActive(SpecialEggType.Range) !== undefined;
    if (pickupFlash > 0) {
      const progress = 1 - pickupFlash / 0.42;
      pickupIndicator.alpha = rangeIndicatorActive
        ? 0.9 + Math.sin(progress * Math.PI) * 0.1
        : 0.72 + Math.sin(progress * Math.PI) * 0.28;
    } else {
      pickupIndicator.alpha = rangeIndicatorActive ? 0.92 : 0.72;
    }
    playerSystem.move(input.x, input.y, dt, evolving);
    const currentRegionAfterMove = getCurrentRegion(player.y);
    if (
      getRegionRank(currentRegionAfterMove) >
      getRegionRank(highestRegionDiscovered)
    ) {
      highestRegionDiscovered = currentRegionAfterMove;
    }
    updateEggPickupFeedback(dt);
    updateDepositFeedback(dt);
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
    handlePlayerRegionTransition();
    updateSessionPacing(dt);
    if (!playerHidden) {
      eggSystem.updateBushReleaseDistance(distance(player.position, previousPlayerPosition));
    }
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
    fugitiveSystem.update(dt, time);
    updateJackpotBurst(dt);
    updateFugitiveExplosion(dt);
    updateMagnetAttraction(dt, time);
    for (const egg of eggSystem.eggs) {
      if (
        !depositing &&
        egg.visible &&
        egg.parent === eggLayer &&
        distance(player.position, egg.position) <
          upgrades.pickupRadius *
            powerUpManager.getModifiers().pickupRangeMultiplier
      ) {
        egg.visible = true;
        eggLayer.removeChild(egg);
        eggSystem.addCarriedEgg(egg);
        magnetizedEggs.delete(egg);
        egg.scale.set(getCarriedEggScale());
        beginEggPickupFeedback(egg);
        carried += 1;
        stackVisualController.onEggCollected(carried);
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
        lastEggPickupTime = time;
        pacingDirector.request("NEAR_LEVEL_UP");
        updateUI();
      }
    }
    for (const specialEgg of [...specialEggSystem.entities]) {
      if (
        specialEgg.state === "AVAILABLE" &&
        powerUpManager.canActivate(specialEgg.type) &&
        distance(player.position, specialEgg.container.position) <
          upgrades.pickupRadius *
            powerUpManager.getModifiers().pickupRangeMultiplier +
            24
      ) {
        if (specialEggSystem.collect(specialEgg)) {
          if (normalPowerUpEntities.get(specialEgg.type) === specialEgg) {
            normalPowerUpEntities.delete(specialEgg.type);
            pendingNormalPowerUpRespawns.add(specialEgg.type);
          }
          sessionTelemetry.record(time, "POWER_UP_COLLECTED", "MEDIUM", specialEgg.type);
          const wasActive =
            powerUpManager.getActive(specialEgg.type) !== undefined;
          const activated = powerUpManager.activate(
            specialEgg.type,
            PACING_DIRECTOR_CONFIG.debug,
          );
          if (activated) {
            playerSystem.redraw();
            if (specialEgg.type === SpecialEggType.Speed)
              spawnSpeedBurst(wasActive ? 0.75 : 1);
            if (specialEgg.type === SpecialEggType.Range) {
              playerSystem.pulsePickupRangeIndicator();
            }
            if (specialEgg.type === SpecialEggType.Magnet) {
              magnetPulseElapsed = 0;
              emitMagnetPulse(true);
            }
            if (specialEgg.type === SpecialEggType.Orbit) {
              orbitFxStrength = wasActive ? 0.68 : 1;
            }
            if (PACING_DIRECTOR_CONFIG.debug) {
              const definition = powerUpManager.getDefinition(specialEgg.type);
              console.debug(
                `[${specialEgg.type.toUpperCase()} EGG] ${wasActive ? "Refreshed" : "Collected"}`,
              );
              console.debug(
                `[${specialEgg.type.toUpperCase()} EGG] Activated`,
                {
                  multiplier:
                    definition.speedMultiplier ??
                    definition.pickupRangeMultiplier,
                  duration: definition.duration,
                },
              );
            }
          }
          pickupFlash = 0.3;
          shakeCamera(0.22, 7);
          refreshPowerUpHud();
          updateUI();
        }
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
    // If the player starts with no eggs, the opening chase must still end
    // when the red rival catches up. Otherwise it remains the active chaser
    // forever and gets stuck directly on top of the player.
    if (
      introChaseActive &&
      carried === 0 &&
      distance(enemies[0].container.position, player.position) < 88
    ) {
      redIntroChaseCompleted = true;
    }
    if (
      enemies.some(
        (enemy) =>
          enemy.container.visible &&
          distance(player.position, enemy.container.position) < 760,
      )
    ) {
      lastEnemyEncounterTime = time;
    }
    enemySystem.updateDeposits(dt);
    const goldMineActive = ["ACTIVE", "EXTRACTING", "FINAL_JACKPOT"].includes(
      goldMineSystem.getSnapshot().state,
    );
    if (
      !goldMineActive &&
      !eggRespawnPending &&
      eggSystem.countActiveWorldEggs() < eggSystem.activeTarget
    ) {
      eggRespawnPending = true;
      eggRespawnTimer = eggSystem.randomRespawnDelay();
    }
    if (!goldMineActive && eggRespawnPending) {
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
      depositEggOrigins = depositingEggs.map((egg) => ({ x: egg.x, y: egg.y }));
      depositArrivals = depositingEggs.map(() => false);
      baseVisualDelivered = progression.delivered;
      const depositProgress = depositingEggs.reduce(
        (sum, egg) => sum + eggSystem.getEggData(egg).progressionValue,
        0,
      );
      pendingDelivery = progression.recordDelivery(depositProgress);
      const stackSize = depositingEggs.length;
      depositFlightDuration = Math.max(
        DEPOSIT_FEEDBACK.minDuration,
        DEPOSIT_FEEDBACK.maxDuration - Math.min(stackSize, 30) * 0.008,
      );
      depositInterval = Math.max(
        DEPOSIT_FEEDBACK.minEggInterval,
        DEPOSIT_FEEDBACK.initialEggInterval -
          Math.max(0, stackSize - 3) * DEPOSIT_FEEDBACK.acceleration,
      );
      pulseNest(DEPOSIT_FEEDBACK.nestPulseScale - 1);
      shakeCamera(0.28, 5 + Math.min(stackSize, 12) * 0.35);
      redrawBasePreview();
      updateUI();
    }
    if (depositing) {
      depositElapsed += dt;
      for (let i = 0; i < depositingEggs.length; i += 1) {
        const egg = depositingEggs[i];
        const origin = depositEggOrigins[i];
        const startTime = i * depositInterval;
        const progress = Math.max(
          0,
          Math.min(1, (depositElapsed - startTime) / depositFlightDuration),
        );
        const eased = 1 - (1 - progress) ** 3;
        egg.x = origin.x + (base.x - origin.x) * eased;
        egg.y =
          origin.y +
          (base.y - origin.y) * eased -
          Math.sin(progress * Math.PI) * 18 * (1 - Math.min(1, i / 12));
        egg.scale.set(
          0.67 *
            (1 - eased * 0.35) *
            (progress < 0.15 ? 1 + progress * 0.8 : 1),
        );
        if (progress >= 1 && !depositArrivals[i]) {
          depositArrivals[i] = true;
          baseVisualDelivered += 1;
          const isFinalEgg = i === depositingEggs.length - 1;
          pulseNest(
            isFinalEgg
              ? DEPOSIT_FEEDBACK.finalPulseScale - 1
              : DEPOSIT_FEEDBACK.nestPulseScale - 1,
          );
          playDepositSound(i + 1, depositingEggs.length, isFinalEgg);
          spawnDepositImpact(depositingEggs.length, isFinalEgg);
          redrawBasePreview();
          updateUI();
        }
      }
      if (
        depositElapsed >=
        depositFlightDuration +
          Math.max(0, depositingEggs.length - 1) * depositInterval
      ) {
        const depositedCount = depositingEggs.length;
        const delivery = pendingDelivery!;
        lastDepositTime = time;
        if (progression.delivered > 0) {
          firstDepositCompleted = true;
          clearTutorialTarget("NEST");
        }
        playerCollected += depositedCount;
        const depositTotals = depositingEggs.reduce(
          (totals, egg) => {
            const data = eggSystem.getEggData(egg);
            totals.coins += data.coinValue;
            totals.progress += data.progressionValue;
            if (data.type === "COIN") totals.coinEggs += 1;
            return totals;
          },
          { coins: 0, progress: 0, coinEggs: 0 },
        );
        currency += depositTotals.coins;
        spawnCurrencyJuice(depositTotals.coins, depositTotals.coinEggs);
        upgradePoints += depositTotals.progress;
        sessionTelemetry.record(time, "DEPOSIT", "MACRO", `${depositedCount} eggs`);
        carried = 0;
        baseVisualDelivered = progression.delivered;
        for (const egg of depositingEggs) eggSystem.releaseEgg(egg);
        eggSystem.takeAllCarriedEggs();
        depositingEggs = [];
        depositEggOrigins = [];
        depositArrivals = [];
        depositing = false;
        if (delivery.shouldEvolve) {
          pendingEvolutionIndex = delivery.unlockedIndex;
          evolutionDelayRemaining = DEPOSIT_FEEDBACK.evolutionDelay;
        } else {
          progression.completeEvolution(delivery.unlockedIndex);
          redrawPlayer();
          redrawBasePreview();
          updateUI();
        }
        pendingDelivery = null;
        updateUI();
      }
    }
    if (!depositing && pendingEvolutionIndex !== null) {
      evolutionDelayRemaining -= dt;
      if (evolutionDelayRemaining <= 0) {
        const nextEvolutionIndex = pendingEvolutionIndex;
        pendingEvolutionIndex = null;
        startEvolutionFeedback(nextEvolutionIndex);
      }
    }
    if (!depositing && !playerHidden) {
      stackVisualController.update(
        dt,
        carried,
        orbitLayoutActive ? "ORBIT" : "TRAIL",
      );
      for (let i = 0; i < eggSystem.carriedEggs.length; i += 1) {
        const egg = eggSystem.carriedEggs[i];
        if (
          eggSystem.eggsInHideAnimation.has(egg) ||
          pickupAnimatingEggs.has(egg)
        )
          continue;
        if (eggSystem.shouldHoldBushEgg(egg, i)) {
          const compactTarget = eggSystem.getBushCompactTarget(egg, time);
          if (compactTarget) {
            const compactFollow = Math.min(1, dt * 13);
            egg.x += (compactTarget.x - egg.x) * compactFollow;
            egg.y += (compactTarget.y - egg.y) * compactFollow;
            continue;
          }
        }
        const leader = i === 0 ? player : eggSystem.carriedEggs[i - 1];
        const dx = leader.x - egg.x;
        const dy = leader.y - egg.y;
        const d = Math.hypot(dx, dy);
        const trailTarget =
          d > 0.001
            ? {
                x: leader.x - (dx / d) * getCarriedEggGap(),
                y: leader.y - (dy / d) * getCarriedEggGap(),
              }
            : { x: egg.x, y: egg.y };

        let target = trailTarget;
        if (!orbitLayoutActive && d > 0.001) {
          const sway = stackVisualController.trailSway(i, time);
          target = {
            x: trailTarget.x - (dy / d) * sway,
            y: trailTarget.y + (dx / d) * sway,
          };
        }
        if (orbitLayoutActive) {
          const orbitTarget = getOrbitSlotPosition(i, eggSystem.carriedEggs.length, time);
          if (!orbitActive) {
            const orbitBlend = Math.min(
              1,
              orbitTransitionRemaining /
                SPECIAL_EGG_CONFIG.orbit.transitionDuration,
            );
            target = {
              x: trailTarget.x + (orbitTarget.x - trailTarget.x) * orbitBlend,
              y: trailTarget.y + (orbitTarget.y - trailTarget.y) * orbitBlend,
            };
          } else {
            target = orbitTarget;
          }
        }

        const follow = Math.min(1, dt * orbitFollowRate);
        egg.x += (target.x - egg.x) * follow;
        egg.y += (target.y - egg.y) * follow;
      }
      stackVisualController.applyEggVisuals(
        eggSystem.carriedEggs,
        getCarriedEggScale(),
        time,
        (egg) => pickupAnimatingEggs.has(egg) || stackReactions.has(egg),
      );
      if (orbitLayoutActive) {
        // The cloud is the visual ground/depth line of the character. Keep
        // upper orbiting eggs behind the whole player container and lower
        // eggs in front of it, so the sprite really occludes the rear eggs.
        const depthLineY = getCloudWorldPosition().y;
        const behindPlayer = eggSystem.carriedEggs.filter(
          (egg) => egg.parent === world && egg.y < depthLineY,
        );
        const inFrontOfPlayer = eggSystem.carriedEggs.filter(
          (egg) => egg.parent === world && egg.y >= depthLineY,
        );
        for (const egg of behindPlayer) {
          world.setChildIndex(egg, world.getChildIndex(player));
        }
        for (const egg of inFrontOfPlayer) {
          world.setChildIndex(
            egg,
            Math.min(world.children.length - 1, world.getChildIndex(player) + 1),
          );
        }
      }
    } else {
      stackVisualController.update(
        dt,
        carried,
        depositing ? "TRAIL" : "BUSH",
      );
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
    updatePostEvolutionOpportunity(dt);
    pacingDirector.update(dt);
    tryRespawnGoldMine();
    const telemetryDirectorState = pacingDirector.getDebugState().state;
    if (telemetryDirectorState) {
      const visibleEggs = eggSystem.getActiveWorldEggs().filter((egg) => isVisibleOpportunityPosition(egg.position)).length;
      const nearbyEggs = eggSystem.getActiveWorldEggs().filter((egg) => distance(player.position, egg.position) < 1150).length;
      const mineState = goldMineSystem.getSnapshot().state;
      const activeMajorEvent = fugitiveSystem.active || ["ACTIVE", "EXTRACTING", "FINAL_JACKPOT"].includes(mineState) || evolving;
      sessionTelemetry.update(time, {
        activity: telemetryDirectorState.playerIntent,
        intent: telemetryDirectorState.playerIntent,
        intensity: Math.min(1, (carried > 0 ? 0.3 : 0) +
          telemetryDirectorState.nearbyEnemyCount * 0.15 +
          telemetryDirectorState.activePowerUps.length * 0.2 +
          (fugitiveSystem.active ? 0.9 : 0) +
          (["ACTIVE", "EXTRACTING", "FINAL_JACKPOT"].includes(mineState) ? 1 : 0) +
          (depositing ? 0.6 : 0) + (evolving ? 1 : 0)),
        visibleEggs,
        nearbyEggs,
        visibleOpportunities: specialEggSystem.entities.filter((entity) => isVisibleOpportunityPosition(entity.container.position)).length +
          (postEvolutionOpportunity ? 1 : 0),
        activeMajorEvent,
        returning: telemetryDirectorState.playerIntent === "RETURNING_HOME",
        depositing,
      });
    }
    if (PACING_DIRECTOR_CONFIG.debug) {
      const debug = pacingDirector.getDebugState();
      const state = debug.state;
      const carriedValue = eggSystem.carriedEggs.reduce(
        (summary, egg) => {
          const data = eggSystem.getEggData(egg);
          return {
            coinEggs: summary.coinEggs + (data.type === "COIN" ? 1 : 0),
            coinValue: summary.coinValue + data.coinValue,
          };
        },
        { coinEggs: 0, coinValue: 0 },
      );
      const stackDebug = stackVisualController.getSnapshot(
        carriedValue.coinEggs,
        carriedValue.coinValue,
      );
      pacingDebugText.text = state
        ? (() => {
            const mine = goldMineSystem.getSnapshot();
            return `PACING DIRECTOR\nPhase: ${sessionPhase}\nSession Time: ${time.toFixed(1)}s\nFirst Cluster: ${firstClusterDelivered ? "DONE" : "PENDING"}\nFirst Power-Up: ${firstPowerUpDelivered ? "DONE" : "PENDING"}\nPower-Ups Delivered: ${powerUpsDelivered}\nPower-Up Dry: ${(time - lastPowerUpDeliveredTime).toFixed(1)}s\nRegion: ${state.currentRegion}\nIntent: ${state.playerIntent}\nActivity: ${state.activityScore.toFixed(2)}\nCarried: ${state.carriedEggs}\nRemaining: ${state.remainingToLevel}\nOpportunity: ${debug.activeOpportunity?.type ?? "none"}\nTarget: ${debug.activeOpportunity?.targetRegion ?? "-"}\nZone: ${selectedOpportunityZoneId ?? "-"}\nNo opportunity: ${debug.noOpportunityElapsed.toFixed(1)}s\nChannel: ${debug.currentChannel}\nBusyness: ${debug.busyness}\nSurprise readiness: ${debug.surpriseReadiness.toFixed(2)}\nTime since surprise: ${debug.timeSinceSurprise.toFixed(1)}s\nRecovery: ${debug.recoveryActive ? `${debug.recoveryRemaining.toFixed(1)}s` : "inactive"}\nRecent rewards: ${debug.recentRewards.map((reward) => `${reward.type}/${reward.category}`).join(", ") || "-"}\nCandidate weights: ${debug.candidateScores.map((candidate) => `${candidate.candidate}:${candidate.finalWeight}`).join(", ") || "-"}\nGuaranteed/Surprise: ${debug.guaranteedCount}/${debug.surpriseCount}\nHigh intensity: ${debug.highIntensityEvents}\nLongest dry: ${debug.longestDryPeriod.toFixed(1)}s\nWorld Eggs: ${eggSystem.getActiveWorldEggs().length}\nVisible Eggs: ${eggSystem.getActiveWorldEggs().filter((egg) => isVisibleOpportunityPosition(egg.position)).length}\nNearby Eggs: ${eggSystem.getActiveWorldEggs().filter((egg) => distance(player.position, egg.position) < 1150).length}\nPopulation Spawn: ${lastPopulationSpawnTime.toFixed(1)}s\nOffscreen margin: ${PACING_DIRECTOR_CONFIG.offscreenSpawnMargin}\nPowerUps: ${state.activePowerUps.join(", ") || "inactive"}\nGOLD MINE: ${mine.state}\nUnlocked: ${goldMineUnlockRequested}\nFirst Eligible: ${Number.isFinite(goldMineFirstEligibleAt) ? goldMineFirstEligibleAt.toFixed(1) : "-"}\nIntroduced: ${goldMineIntroduced}\nWave: ${Math.min(mine.waveIndex + 1, mine.waveCount)}/${mine.waveCount}\nNext payout: ${mine.nextPayoutIn.toFixed(1)}s\nProduced: ${mine.normalEggsProduced} normal / ${mine.coinEggsProduced} coin\nInterest: ${mine.interestStrength.toFixed(2)}\nCooldown: ${mine.cooldownRemaining.toFixed(1)}s\nRespawn Eligible: ${mine.readyToRespawn}\nDirector Eligible: ${pacingDirector.canStartHighIntensity()}\nPosition: ${mine.position.x.toFixed(0)},${mine.position.y.toFixed(0)}\n\nSTACK VISUAL\nStack Size: ${stackDebug.stackSize}\nTier: ${stackDebug.tier.id}\nNext Milestone: ${stackDebug.nextMilestone ?? "-"}\nPickup Momentum: ${stackDebug.pickupMomentum.toFixed(2)}\nRecent Pickup Rate: ${stackDebug.recentPickupRate.toFixed(2)}\nRipple Active: ${stackDebug.rippleActive}\nParticle Intensity: ${stackDebug.particleIntensity.toFixed(2)}\nCurrent Layout: ${stackDebug.layout}\nCoin Eggs Carried: ${stackDebug.coinEggsCarried}\nPotential Coin Value: ${stackDebug.potentialCoinValue}`;
          })()
        : "PACING DIRECTOR\nwaiting";
      pacingDebugText.text += `\n\nBUSH STACK\nState: ${eggSystem.getBushLayoutState()}\nCarried Eggs: ${eggSystem.carriedEggs.length}\nCompact Eggs: ${eggSystem.carriedEggs.filter((egg, index) => eggSystem.shouldHoldBushEgg(egg, index)).length}\nReleased Eggs: ${eggSystem.getBushReleasedCount()}\nRelease Origin: ${JSON.stringify(eggSystem.getBushReleaseOrigin())}\nDistance Since Exit: ${eggSystem.getBushReleaseDistance().toFixed(1)}\nAnchor: ${JSON.stringify(eggSystem.getBushAnchor())}`;
    }
    previousPlayerPosition = { x: player.x, y: player.y };
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
