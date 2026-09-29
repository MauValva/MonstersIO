import { Container, Graphics, Sprite, Texture } from "pixi.js";
import { ENEMY_EGG_CAPACITY, PLAYABLE_BOUNDS, FOLLOW_DISTANCE } from "../../config/game-config";
import type { Point } from "../../game/types";

export type Enemy = {
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

type EnemyDepositAnimation = { enemy: Enemy; eggs: Container[]; elapsed: number };

export type EnemyEggApi = {
  eggs: Container[];
  carriedEggs: Container[];
  addCarriedEgg: (egg: Container) => void;
  takeAllCarriedEggs: () => Container[];
  releaseEgg: (egg: Container) => void;
  setEggWorldSpriteScale: (egg: Container) => void;
};

export type EnemySystemDependencies = {
  world: Container;
  eggLayer: Container;
  eggSystem: EnemyEggApi;
  enemyFrames: Texture[];
  enemyNestFrames: Texture[];
  playerCloudTexture: Texture;
  label: (content: string, size?: number, color?: number) => import("pixi.js").Text;
  getPlayerPosition: () => Point;
  getTime: () => number;
  getCarriedEggScale: () => number;
  onRedIntroSteal: () => void;
  onEnemyCollectedEgg: () => void;
  onPlayerCarriedCountChanged: (count: number) => void;
};

export function createEnemySystem(deps: EnemySystemDependencies) {
  function createEnemyBase(position: Point, color: number, artTexture: Texture) {
    const enemyBase = new Container();
    enemyBase.position.set(position.x, position.y);
    enemyBase.visible = false;
    const nestArt = new Sprite(artTexture);
    nestArt.anchor.set(0.5);
    nestArt.scale.set((887 * 0.26) / artTexture.width, (887 * 0.26) / artTexture.height);
    enemyBase.addChild(nestArt);
    const baseLabel = deps.label("RIVAL NEST", 13, color);
    baseLabel.anchor.set(0.5);
    baseLabel.position.set(0, 62);
    enemyBase.addChild(baseLabel);
    deps.world.addChild(enemyBase);
    return enemyBase;
  }

  function createEnemy(position: Point, color: number, homeBase: Container, artTexture: Texture): Enemy {
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
    const cloud = new Sprite(deps.playerCloudTexture);
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
    deps.world.addChild(container);
    container.visible = false;
    return {
      container, body, eyes, art, cloud, eggs: [], target: null,
      speed: 155, homeBase, dazedUntil: 0, collected: 0, depositing: false,
    };
  }

  const enemyBases = [
    createEnemyBase({ x: 2200, y: 850 }, 0xff6f78, deps.enemyNestFrames[0]),
    createEnemyBase({ x: 4700, y: -1500 }, 0x9c7dff, deps.enemyNestFrames[1]),
  ];
  const enemies: Enemy[] = [
    createEnemy({ x: 2200, y: 850 }, 0xff6f78, enemyBases[0], deps.enemyFrames[0]),
    createEnemy({ x: 4400, y: -1200 }, 0x9c7dff, enemyBases[1], deps.enemyFrames[1]),
  ];
  const enemyDepositAnimations: EnemyDepositAnimation[] = [];

  function updateVisibility(rivalsActive: boolean) {
    for (let i = 0; i < enemies.length; i += 1) {
      enemies[i].container.visible = rivalsActive;
      enemyBases[i].visible = rivalsActive;
    }
  }

  function updateEnemy(
    enemy: Enemy,
    dt: number,
    chasingPlayer: boolean,
    openingChase: boolean,
  ) {
    if (enemy.depositing) return;
    // A hidden player immediately cancels the chase. Do not keep an old egg
    // target selected while pursuing, otherwise the rival can continue along
    // the direction where the player disappeared.
    if (chasingPlayer) enemy.target = null;
    if (enemy.eggs.length >= ENEMY_EGG_CAPACITY) enemy.target = null;
    if (!chasingPlayer && enemy.eggs.length < ENEMY_EGG_CAPACITY && (!enemy.target || !enemy.target.visible || enemy.target.parent !== deps.eggLayer)) {
      enemy.target = null;
      let nearestDistance = Infinity;
      for (const egg of deps.eggSystem.eggs) {
        if (!egg.visible || egg.parent !== deps.eggLayer) continue;
        const candidateDistance = Math.hypot(enemy.container.x - egg.x, enemy.container.y - egg.y);
        if (candidateDistance < nearestDistance) {
          nearestDistance = candidateDistance;
          enemy.target = egg;
        }
      }
    }
    const destination = chasingPlayer
      ? deps.getPlayerPosition()
      : enemy.eggs.length >= ENEMY_EGG_CAPACITY
        ? enemy.homeBase.position
        : enemy.target?.position;
    if (destination) {
      const dx = destination.x - enemy.container.x;
      const dy = destination.y - enemy.container.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      // The opening chase must be visible and able to catch up with the
      // player. Once it ends, the enemy returns to its regular state speed.
      const movementSpeed = openingChase ? Math.max(enemy.speed, 320) : enemy.speed;
      enemy.container.x += (dx / d) * movementSpeed * dt;
      enemy.container.y += (dy / d) * movementSpeed * dt;
    }
    enemy.container.x = Math.max(PLAYABLE_BOUNDS.left, Math.min(PLAYABLE_BOUNDS.right, enemy.container.x));
    enemy.container.y = Math.max(PLAYABLE_BOUNDS.top, Math.min(PLAYABLE_BOUNDS.bottom, enemy.container.y));
    if (enemy.target && enemy.target.parent === deps.eggLayer && Math.hypot(enemy.container.x - enemy.target.x, enemy.container.y - enemy.target.y) < 72) {
      const egg = enemy.target;
      deps.eggLayer.removeChild(egg);
      egg.scale.set(deps.getCarriedEggScale() * 0.84);
      enemy.eggs.push(egg);
      deps.onEnemyCollectedEgg();
      enemy.target = null;
      deps.world.addChildAt(egg, deps.world.getChildIndex(enemy.container));
    }
    if (enemy.eggs.length > 0 && Math.hypot(enemy.container.x - enemy.homeBase.x, enemy.container.y - enemy.homeBase.y) < 125) {
      enemy.collected += enemy.eggs.length;
      enemy.depositing = true;
      enemyDepositAnimations.push({ enemy, eggs: [...enemy.eggs], elapsed: 0 });
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

  function updateAI(
    dt: number,
    activeChaser: Enemy | null,
    openingChaser: Enemy | null = null,
  ) {
    for (const enemy of enemies) {
      updateEnemy(
        enemy,
        dt,
        enemy === activeChaser,
        enemy === openingChaser,
      );
    }
  }

  function resolveStealing() {
    let playerRecoveredEgg = false;
    for (const enemy of enemies) {
      if (deps.getTime() >= enemy.dazedUntil) {
        const enemyNearPlayer =
          Math.hypot(
            enemy.container.x - deps.getPlayerPosition().x,
            enemy.container.y - deps.getPlayerPosition().y,
          ) < 72;
        const playerQueueEgg = deps.eggSystem.carriedEggs.find(
          (egg) =>
            enemyNearPlayer ||
            Math.hypot(enemy.container.x - egg.x, enemy.container.y - egg.y) < 54,
        );
        if (playerQueueEgg) {
          enemy.eggs.push(...deps.eggSystem.takeAllCarriedEggs());
          deps.onPlayerCarriedCountChanged(deps.eggSystem.carriedEggs.length);
          if (enemy === enemies[0]) deps.onRedIntroSteal();
        }
      }
      for (let i = enemy.eggs.length - 1; i >= 0; i -= 1) {
        if (Math.hypot(deps.getPlayerPosition().x - enemy.eggs[i].x, deps.getPlayerPosition().y - enemy.eggs[i].y) < 54) {
          deps.eggSystem.addCarriedEgg(enemy.eggs.splice(i, 1)[0]);
          deps.onPlayerCarriedCountChanged(deps.eggSystem.carriedEggs.length);
          enemy.dazedUntil = deps.getTime() + 4;
          playerRecoveredEgg = true;
          break;
        }
      }
    }
    return playerRecoveredEgg;
  }

  function updateDeposits(dt: number) {
    for (let i = enemyDepositAnimations.length - 1; i >= 0; i -= 1) {
      const animation = enemyDepositAnimations[i];
      animation.elapsed += dt;
      const depositDuration = 0.52;
      for (let eggIndex = 0; eggIndex < animation.eggs.length; eggIndex += 1) {
        const egg = animation.eggs[eggIndex];
        const progress = Math.max(0, Math.min(1, (animation.elapsed - eggIndex * 0.055) / depositDuration));
        const eased = 1 - (1 - progress) ** 3;
        egg.x += (animation.enemy.homeBase.x - egg.x) * Math.min(1, dt * 18) * eased;
        egg.y += (animation.enemy.homeBase.y - egg.y) * Math.min(1, dt * 18) * eased;
        egg.scale.set(0.67 * (1 - eased * 0.35));
      }
      if (animation.elapsed >= depositDuration + Math.max(0, animation.eggs.length - 1) * 0.055) {
        for (const egg of animation.eggs) deps.eggSystem.releaseEgg(egg);
        animation.enemy.depositing = false;
        enemyDepositAnimations.splice(i, 1);
      }
    }
  }

  function refreshVisualScales(progressionScale: number) {
    for (const enemy of enemies) {
      enemy.container.scale.set(Math.min(1.16, 1 + (progressionScale - 1) * 0.3));
      for (const egg of enemy.eggs) {
        deps.eggSystem.setEggWorldSpriteScale(egg);
        egg.scale.set(deps.getCarriedEggScale() * 0.84);
      }
    }
  }

  return {
    enemies,
    enemyBases,
    updateVisibility,
    updateAI,
    resolveStealing,
    updateDeposits,
    refreshVisualScales,
  };
}
