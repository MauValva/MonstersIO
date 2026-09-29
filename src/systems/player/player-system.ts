import { Container, Graphics, Sprite, Texture } from "pixi.js";
import { PLAYABLE_BOUNDS, STAGES } from "../../config/game-config";

export type PlayerUpgrades = { speed: number; pickupRadius: number };

export type PlayerSystemDependencies = {
  world: Container;
  evolutionFrames: Texture[];
  cloudTexture: Texture;
  getStageIndex: () => number;
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
  player.addChild(pickupIndicator, playerCloud, playerEvolution, playerBody, playerEyes);
  deps.world.addChild(player);

  const upgrades: PlayerUpgrades = { speed: 280, pickupRadius: 92 };

  function redraw() {
    const stage = STAGES[Math.min(deps.getStageIndex(), STAGES.length - 1)];
    playerEvolution.texture = deps.evolutionFrames[Math.min(deps.getStageIndex(), deps.evolutionFrames.length - 1)];
    playerEvolution.width = 105 * stage.scale;
    playerEvolution.height = 135 * stage.scale;
    playerCloud.width = 118 * stage.scale;
    playerCloud.height = 59 * stage.scale;
    playerCloud.position.set(0, 52 * stage.scale);
    playerCloud.visible = deps.getStageIndex() < STAGES.length - 2;
    playerEvolution.position.set(0, -10 * stage.scale);
    playerBody.clear()
      .circle(0, 0, 45 * stage.scale)
      .fill(stage.color)
      .circle(0, 0, 31 * stage.scale)
      .fill({ color: 0xffffff, alpha: 0.14 });
    playerEyes.clear()
      .ellipse(-14 * stage.scale, -7 * stage.scale, 6, 10)
      .fill(0x18263b)
      .ellipse(14 * stage.scale, -7 * stage.scale, 6, 10)
      .fill(0x18263b);
    player.scale.set(1);
    pickupIndicator.clear();
    const segments = 36;
    for (let i = 0; i < segments; i += 2) {
      const start = (i / segments) * Math.PI * 2;
      const end = ((i + 1) / segments) * Math.PI * 2;
      pickupIndicator.moveTo(Math.cos(start) * upgrades.pickupRadius, Math.sin(start) * upgrades.pickupRadius);
      pickupIndicator.arc(0, 0, upgrades.pickupRadius, start, end)
        .stroke({ color: 0xfff2a6, alpha: 0.9, width: 3 });
    }
    pickupIndicator.alpha = 0.48;
  }

  function move(inputX: number, inputY: number, dt: number, blocked: boolean) {
    if (!blocked) {
      player.x += inputX * upgrades.speed * dt;
      player.y += inputY * upgrades.speed * dt;
    }
    player.x = Math.max(PLAYABLE_BOUNDS.left, Math.min(PLAYABLE_BOUNDS.right, player.x));
    player.y = Math.max(PLAYABLE_BOUNDS.top, Math.min(PLAYABLE_BOUNDS.bottom, player.y));
  }

  function updateIdleVisual(time: number, moving: boolean, evolving: boolean, inputMagnitude: number) {
    const stageScale = STAGES[Math.min(deps.getStageIndex(), STAGES.length - 1)].scale;
    const idleFloat = !moving && !evolving ? Math.sin(time * 3.2) * 5 : 0;
    playerEvolution.y = -10 * stageScale + idleFloat;
    playerCloud.y = 52 * stageScale + idleFloat * 0.35;
    player.rotation = Math.sin(time * 8) * 0.035 * Math.min(1, inputMagnitude);
  }

  return { player, playerEvolution, playerCloud, pickupIndicator, upgrades, redraw, move, updateIdleVisual };
}
