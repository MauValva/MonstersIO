import { Container, Graphics, Sprite, Texture } from "pixi.js";
import { PLAYABLE_BOUNDS, STAGES } from "../../config/game-config";

export type PlayerUpgrades = { speed: number; pickupRadius: number };

// Water World crops are authored at a much larger visual scale than the
// Grass player sprites. Keep the UI evolution presentation unchanged and
// reduce only the in-world player monster.
export const WATER_WORLD_MONSTER_SCALE = 0.45;
const WATER_WORLD_FIRST_EVOLUTION_SCALE = WATER_WORLD_MONSTER_SCALE * 0.5;
const WATER_WORLD_FIRST_EVOLUTION_Y_OFFSET = 18;
const WATER_WORLD_SECOND_EVOLUTION_SCALE = 0.75;
const WATER_WORLD_SECOND_EVOLUTION_Y_OFFSET = 85;
const WATER_WORLD_SECOND_EVOLUTION_CLOUD_Y_OFFSET = -20;
const WATER_WORLD_THIRD_EVOLUTION_Y_OFFSET = 25;
const WATER_WORLD_FOURTH_EVOLUTION_Y_OFFSET = 38;
const WATER_WORLD_SIXTH_EVOLUTION_Y_OFFSET = 18;
const WATER_WORLD_SEVENTH_EVOLUTION_Y_OFFSET = 76;
const WATER_WORLD_SEVENTH_EVOLUTION_CLOUD_Y_OFFSET = 0;
const WATER_WORLD_EIGHTH_EVOLUTION_SCALE = 1.1;
const WATER_WORLD_NINTH_EVOLUTION_SCALE = 1.3;
const WATER_WORLD_TENTH_EVOLUTION_SCALE = 1.45;
const WATER_WORLD_CLOUD_SCALE = 0.7;
const CLOUD_SIZE_MULTIPLIER = 1.15;
const PLAYER_CLOUD_Y = 20;
const PLAYER_WITH_CLOUD_Y = -42;
const PLAYER_WITHOUT_CLOUD_Y = -10;
const LOWERED_EVOLUTION_INDICES = new Set([3, 4, 5]);
const LOWERED_EVOLUTION_OFFSET = 12;

const INITIAL_PLAYER_UPGRADES: Readonly<PlayerUpgrades> = {
  speed: 280,
  pickupRadius: 92,
};

export type PlayerSystemDependencies = {
  world: Container;
  evolutionFrames: Texture[];
  waterWorldEvolutionFrames?: Texture[];
  cloudTexture: Texture;
  waterWorldCloudTexture?: Texture;
  getStageIndex: () => number;
  getVisualScale?: () => number;
  getWaterWorldActive?: () => boolean;
  getSpeedMultiplier?: () => number;
  getPickupRangeMultiplier?: () => number;
};

export function createPlayerSystem(deps: PlayerSystemDependencies) {
  const player = new Container();
  player.position.set(3000, 3300);
  const playerBody = new Graphics();
  const playerEyes = new Graphics();
  const playerCloud = new Sprite(deps.cloudTexture);
  playerCloud.anchor.set(0.5);
  playerCloud.position.set(0, 52);
  playerCloud.width = 118 * CLOUD_SIZE_MULTIPLIER;
  playerCloud.height = 59 * CLOUD_SIZE_MULTIPLIER;
  const playerEvolution = new Sprite(deps.evolutionFrames[0]);
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
  deps.world.addChild(player);

  const upgrades: PlayerUpgrades = { ...INITIAL_PLAYER_UPGRADES };
  const getSpeedMultiplier = () => deps.getSpeedMultiplier?.() ?? 1;
  const getPickupRangeMultiplier = () => deps.getPickupRangeMultiplier?.() ?? 1;
  let displayedPickupRange = upgrades.pickupRadius * getPickupRangeMultiplier();
  let pickupRangeTarget = displayedPickupRange;
  let pickupRangeTransitionElapsed = 1;
  let pickupRangeTransitionDuration = 0.26;
  let pickupRangeTransitionFrom = displayedPickupRange;
  let pickupRangePulse = 0;

  function getFinalPickupRange() {
    return upgrades.pickupRadius * getPickupRangeMultiplier();
  }

  function drawPickupIndicator(pickupRange: number) {
    pickupIndicator.clear();
    const rangeActive = getPickupRangeMultiplier() > 1.01;
    if (rangeActive) {
      pickupIndicator.circle(0, 0, pickupRange).stroke({
        color: 0xffffff,
        alpha: Math.min(1, 0.86 + pickupRangePulse * 0.14),
        width: 4.5,
      });
      pickupIndicator.alpha = 1;
      return;
    }
    const segments = 36;
    for (let i = 0; i < segments; i += 2) {
      const start = (i / segments) * Math.PI * 2;
      const end = ((i + 1) / segments) * Math.PI * 2;
      pickupIndicator.moveTo(
        Math.cos(start) * pickupRange,
        Math.sin(start) * pickupRange,
      );
      pickupIndicator.arc(0, 0, pickupRange, start, end).stroke({
        color: 0xffffd2,
        alpha: Math.min(1, 0.72 + pickupRangePulse * 0.28),
        width: 3.5,
      });
    }
    pickupIndicator.alpha = 1;
  }

  function beginPickupRangeTransition(duration = 0.26) {
    const target = getFinalPickupRange();
    if (Math.abs(target - pickupRangeTarget) < 0.01) return;
    pickupRangeTransitionFrom = displayedPickupRange;
    pickupRangeTarget = target;
    pickupRangeTransitionElapsed = 0;
    pickupRangeTransitionDuration = duration;
  }

  function redraw() {
    const stageIndex = deps.getStageIndex();
    const stage = STAGES[Math.min(stageIndex, STAGES.length - 1)];
    const stageScale = deps.getVisualScale?.() ?? stage.scale;
    const waterWorldActive = deps.getWaterWorldActive?.() ?? false;
    const evolutionFrames = waterWorldActive && deps.waterWorldEvolutionFrames?.length
      ? deps.waterWorldEvolutionFrames
      : deps.evolutionFrames;
    const evolutionIndex = stageIndex;
    const isFourthEvolution = !waterWorldActive && stageIndex === 3;
    const evolutionVerticalOffset = waterWorldActive && stageIndex === 0
      ? WATER_WORLD_FIRST_EVOLUTION_Y_OFFSET
      : waterWorldActive && stageIndex === 1
        ? WATER_WORLD_SECOND_EVOLUTION_Y_OFFSET
        : waterWorldActive && stageIndex === 2
          ? WATER_WORLD_THIRD_EVOLUTION_Y_OFFSET
        : waterWorldActive && stageIndex === 3
          ? WATER_WORLD_FOURTH_EVOLUTION_Y_OFFSET
          : waterWorldActive && stageIndex === 5
            ? WATER_WORLD_SIXTH_EVOLUTION_Y_OFFSET
            : waterWorldActive && stageIndex === 6
              ? WATER_WORLD_SEVENTH_EVOLUTION_Y_OFFSET
      : !waterWorldActive && LOWERED_EVOLUTION_INDICES.has(stageIndex)
        ? LOWERED_EVOLUTION_OFFSET
        : 0;
    const evolutionSizeMultiplier = isFourthEvolution ? 1.3 : 1;
    const waterWorldEvolutionScale = waterWorldActive && stageIndex === 0
      ? WATER_WORLD_FIRST_EVOLUTION_SCALE
      : waterWorldActive && stageIndex === 1
        ? WATER_WORLD_MONSTER_SCALE * WATER_WORLD_SECOND_EVOLUTION_SCALE
      : waterWorldActive && stageIndex === 7
        ? WATER_WORLD_MONSTER_SCALE * WATER_WORLD_EIGHTH_EVOLUTION_SCALE
      : waterWorldActive && stageIndex === 8
        ? WATER_WORLD_MONSTER_SCALE * WATER_WORLD_NINTH_EVOLUTION_SCALE
      : waterWorldActive && stageIndex === 9
        ? WATER_WORLD_MONSTER_SCALE * WATER_WORLD_TENTH_EVOLUTION_SCALE
      : WATER_WORLD_MONSTER_SCALE;
    const cloudVerticalOffset = waterWorldActive && stageIndex === 1
      ? WATER_WORLD_SECOND_EVOLUTION_CLOUD_Y_OFFSET
      : waterWorldActive && stageIndex === 6
        ? WATER_WORLD_SEVENTH_EVOLUTION_CLOUD_Y_OFFSET
        : evolutionVerticalOffset;
    playerEvolution.texture =
      evolutionFrames[
        Math.min(evolutionIndex, evolutionFrames.length - 1)
      ];
    const targetEvolutionHeight =
      135 * stageScale * evolutionSizeMultiplier *
      (waterWorldActive ? waterWorldEvolutionScale : 1);
    if (waterWorldActive) {
      // Water World sprites are manually cropped with different dimensions.
      // Keep their authored proportions instead of forcing every monster into
      // the old 105 x 135 rectangle.
      playerEvolution.height = targetEvolutionHeight;
      playerEvolution.width =
        targetEvolutionHeight *
        (playerEvolution.texture.width / Math.max(1, playerEvolution.texture.height));
    } else if (stageIndex === 5) {
      playerEvolution.height = targetEvolutionHeight;
      playerEvolution.width =
        targetEvolutionHeight *
        (playerEvolution.texture.width / Math.max(1, playerEvolution.texture.height));
    } else {
      playerEvolution.width = 105 * stageScale * evolutionSizeMultiplier;
      playerEvolution.height = targetEvolutionHeight;
    }
    const waterCloudEvolution = waterWorldActive && (stageIndex === 1 || stageIndex === 6);
    playerCloud.texture = waterCloudEvolution
      ? deps.waterWorldCloudTexture ?? deps.cloudTexture
      : deps.cloudTexture;
    if (waterCloudEvolution && deps.waterWorldCloudTexture) {
      const cloudWidth = 118 * CLOUD_SIZE_MULTIPLIER * stageScale * WATER_WORLD_CLOUD_SCALE;
      const cloudHeight = 59 * CLOUD_SIZE_MULTIPLIER * stageScale * WATER_WORLD_CLOUD_SCALE;
      const textureAspect =
        playerCloud.texture.width / Math.max(1, playerCloud.texture.height);
      const boxAspect = cloudWidth / cloudHeight;
      if (textureAspect >= boxAspect) {
        playerCloud.width = cloudWidth;
        playerCloud.height = cloudWidth / textureAspect;
      } else {
        playerCloud.height = cloudHeight;
        playerCloud.width = cloudHeight * textureAspect;
      }
    } else {
      const waterCloudScale = waterWorldActive ? WATER_WORLD_CLOUD_SCALE : 1;
      playerCloud.width = 118 * CLOUD_SIZE_MULTIPLIER * stageScale * waterCloudScale;
      playerCloud.height = 59 * CLOUD_SIZE_MULTIPLIER * stageScale * waterCloudScale;
    }
    // The player cloud disappears when the player reaches level 8.
    // `stageIndex` is zero-based, so level 8 is index 7.
    playerCloud.visible = waterCloudEvolution ||
      (!waterWorldActive && !isFourthEvolution && stageIndex < 7);
    playerCloud.position.set(
      0,
      (playerCloud.visible ? PLAYER_CLOUD_Y : 52) * stageScale + cloudVerticalOffset,
    );
    playerEvolution.position.set(
      0,
      (playerCloud.visible ? PLAYER_WITH_CLOUD_Y : PLAYER_WITHOUT_CLOUD_Y) * stageScale + evolutionVerticalOffset,
    );
    playerBody
      .clear()
      .circle(0, 0, 45 * stageScale)
      .fill(stage.color)
      .circle(0, 0, 31 * stageScale)
      .fill({ color: 0xffffff, alpha: 0.14 });
    playerEyes
      .clear()
      .ellipse(-14 * stageScale, -7 * stageScale, 6, 10)
      .fill(0x18263b)
      .ellipse(14 * stageScale, -7 * stageScale, 6, 10)
      .fill(0x18263b);
    player.scale.set(1);
    beginPickupRangeTransition();
    drawPickupIndicator(displayedPickupRange);
  }

  function updatePickupRangeIndicator(dt: number) {
    const target = getFinalPickupRange();
    if (Math.abs(target - pickupRangeTarget) >= 0.01) {
      pickupRangeTransitionFrom = displayedPickupRange;
      pickupRangeTarget = target;
      pickupRangeTransitionElapsed = 0;
      pickupRangeTransitionDuration =
        target > displayedPickupRange ? 0.26 : 0.3;
    }
    if (pickupRangeTransitionElapsed < 1) {
      pickupRangeTransitionElapsed = Math.min(
        1,
        pickupRangeTransitionElapsed + dt / pickupRangeTransitionDuration,
      );
      const progress = pickupRangeTransitionElapsed;
      const eased = 1 - (1 - progress) ** 3;
      displayedPickupRange =
        pickupRangeTransitionFrom +
        (pickupRangeTarget - pickupRangeTransitionFrom) * eased;
    }
    pickupRangePulse = Math.max(0, pickupRangePulse - dt * 4.5);
    drawPickupIndicator(displayedPickupRange);
  }

  function pulsePickupRangeIndicator() {
    pickupRangePulse = 1;
  }

  function resetForNewWorld() {
    upgrades.speed = INITIAL_PLAYER_UPGRADES.speed;
    upgrades.pickupRadius = INITIAL_PLAYER_UPGRADES.pickupRadius;
    displayedPickupRange = getFinalPickupRange();
    pickupRangeTarget = displayedPickupRange;
    pickupRangeTransitionFrom = displayedPickupRange;
    pickupRangeTransitionElapsed = 1;
    pickupRangePulse = 0;
    player.rotation = 0;
    redraw();
  }

  function move(inputX: number, inputY: number, dt: number, blocked: boolean) {
    if (!blocked) {
      player.x += inputX * upgrades.speed * getSpeedMultiplier() * dt;
      player.y += inputY * upgrades.speed * getSpeedMultiplier() * dt;
    }
    player.x = Math.max(
      PLAYABLE_BOUNDS.left,
      Math.min(PLAYABLE_BOUNDS.right, player.x),
    );
    player.y = Math.max(
      PLAYABLE_BOUNDS.top,
      Math.min(PLAYABLE_BOUNDS.bottom, player.y),
    );
  }

  function updateIdleVisual(
    time: number,
    moving: boolean,
    evolving: boolean,
    inputMagnitude: number,
  ) {
    const stageIndex = deps.getStageIndex();
    const waterWorldActive = deps.getWaterWorldActive?.() ?? false;
    const stageScale =
      deps.getVisualScale?.() ??
      STAGES[Math.min(stageIndex, STAGES.length - 1)].scale;
    const evolutionVerticalOffset = waterWorldActive && stageIndex === 0
      ? WATER_WORLD_FIRST_EVOLUTION_Y_OFFSET
      : waterWorldActive && stageIndex === 1
        ? WATER_WORLD_SECOND_EVOLUTION_Y_OFFSET
        : waterWorldActive && stageIndex === 2
          ? WATER_WORLD_THIRD_EVOLUTION_Y_OFFSET
        : waterWorldActive && stageIndex === 3
          ? WATER_WORLD_FOURTH_EVOLUTION_Y_OFFSET
          : waterWorldActive && stageIndex === 5
            ? WATER_WORLD_SIXTH_EVOLUTION_Y_OFFSET
            : waterWorldActive && stageIndex === 6
              ? WATER_WORLD_SEVENTH_EVOLUTION_Y_OFFSET
        : !waterWorldActive && LOWERED_EVOLUTION_INDICES.has(stageIndex)
          ? LOWERED_EVOLUTION_OFFSET
          : 0;
    const cloudVerticalOffset = waterWorldActive && stageIndex === 1
      ? WATER_WORLD_SECOND_EVOLUTION_CLOUD_Y_OFFSET
      : waterWorldActive && stageIndex === 6
        ? WATER_WORLD_SEVENTH_EVOLUTION_CLOUD_Y_OFFSET
        : evolutionVerticalOffset;
    const idleFloat = !moving && !evolving ? Math.sin(time * 3.2) * 5 : 0;
    playerEvolution.y =
      (playerCloud.visible ? PLAYER_WITH_CLOUD_Y : PLAYER_WITHOUT_CLOUD_Y) *
        stageScale +
      evolutionVerticalOffset +
      idleFloat;
    playerCloud.y =
      (playerCloud.visible ? PLAYER_CLOUD_Y : 52) * stageScale +
      cloudVerticalOffset +
      idleFloat * 0.35;
    player.rotation = Math.sin(time * 8) * 0.035 * Math.min(1, inputMagnitude);
  }

  return {
    player,
    playerEvolution,
    playerCloud,
    pickupIndicator,
    upgrades,
    redraw,
    move,
    updateIdleVisual,
    updatePickupRangeIndicator,
    pulsePickupRangeIndicator,
    resetForNewWorld,
    getFinalPickupRange,
  };
}
