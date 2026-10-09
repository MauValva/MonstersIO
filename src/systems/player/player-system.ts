import { Container, Graphics, Sprite, Texture } from "pixi.js";
import { PLAYABLE_BOUNDS, STAGES } from "../../config/game-config";

export type PlayerUpgrades = { speed: number; pickupRadius: number };

export type PlayerSystemDependencies = {
  world: Container;
  evolutionFrames: Texture[];
  cloudTexture: Texture;
  getStageIndex: () => number;
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
  playerCloud.width = 118;
  playerCloud.height = 59;
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

  const upgrades: PlayerUpgrades = { speed: 280, pickupRadius: 92 };
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
    const isFourthEvolution = stageIndex === 3;
    const evolutionSizeMultiplier = isFourthEvolution ? 1.3 : 1;
    playerEvolution.texture =
      deps.evolutionFrames[
        Math.min(stageIndex, deps.evolutionFrames.length - 1)
      ];
    playerEvolution.width = 105 * stage.scale * evolutionSizeMultiplier;
    playerEvolution.height = 135 * stage.scale * evolutionSizeMultiplier;
    playerCloud.width = 118 * stage.scale;
    playerCloud.height = 59 * stage.scale;
    playerCloud.position.set(0, 52 * stage.scale);
    // The player cloud disappears when the player reaches level 8.
    // `stageIndex` is zero-based, so level 8 is index 7.
    playerCloud.visible = !isFourthEvolution && stageIndex < 7;
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
    const stageScale =
      STAGES[Math.min(deps.getStageIndex(), STAGES.length - 1)].scale;
    const idleFloat = !moving && !evolving ? Math.sin(time * 3.2) * 5 : 0;
    playerEvolution.y = -10 * stageScale + idleFloat;
    playerCloud.y = 52 * stageScale + idleFloat * 0.35;
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
    getFinalPickupRange,
  };
}
