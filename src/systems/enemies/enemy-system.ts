import { Container, Graphics, Sprite, Texture } from "pixi.js";
import { ENEMY_EGG_CAPACITY, PLAYABLE_BOUNDS, FOLLOW_DISTANCE } from "../../config/game-config";
import type { Point } from "../../game/types";
import type { WorldRivalLayout } from "../../levels/world-level-design";

const CLOUD_SIZE_MULTIPLIER = 1.15;
const ENEMY_ART_SIZE_MULTIPLIER = 1.25;
const NEST_ART_SIZE_MULTIPLIER = 1.15;
const ENEMY_CLOUD_Y = 6;
const ENEMY_WITH_CLOUD_Y = -36;
const ENEMY_WITHOUT_CLOUD_Y = -12;

export type Enemy = {
  container: Container;
  body: Graphics;
  eyes: Graphics;
  art: Sprite;
  cloud: Sprite;
  eggs: Container[];
  target: Container | null;
  interestTarget: Point | null;
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
  getEggData: (egg: Container) => {
    type: "NORMAL" | "COIN";
    source: "WORLD" | "CLUSTER" | "FUGITIVE" | "FUGITIVE_JACKPOT" | "GOLD_MINE";
  };
  addCarriedEgg: (egg: Container) => void;
  takeCarriedEggs: (predicate: (egg: Container) => boolean) => Container[];
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
  getWorldInterest?: (enemyPosition: Point) => {
    position: Point;
    strength: number;
    radius: number;
    type: string;
  } | null;
  onRedIntroSteal: () => void;
  onEnemyCollectedEgg: () => void;
  onPlayerCarriedCountChanged: (count: number) => void;
  getRivalLayout?: () => WorldRivalLayout;
  getRivalVisuals?: () => EnemyVisualSet;
};

export type EnemyVisualSet = {
  enemyFrames: Texture[];
  enemyNestFrames: Texture[];
  preserveAspectRatio?: boolean;
  hideCloud?: boolean;
  cloudTextures?: readonly (Texture | null)[];
};

export function createEnemySystem(deps: EnemySystemDependencies) {
  const isEnemyCollectibleEgg = (egg: Container) => {
    const data = deps.eggSystem.getEggData(egg);
    // Only the regular egg layer is eligible for rivals. The explicit
    // source guard keeps the fugitive/event payout path isolated as well.
    return (data.type === "NORMAL" || data.type === "COIN") && data.source !== "FUGITIVE";
  };

  function setNestArtSize(nestArt: Sprite, preserveAspectRatio: boolean) {
    if (!preserveAspectRatio) {
      nestArt.scale.set(
        (887 * 0.26 * NEST_ART_SIZE_MULTIPLIER) / nestArt.texture.width,
        (887 * 0.26 * NEST_ART_SIZE_MULTIPLIER) / nestArt.texture.height,
      );
      return;
    }
    const maxSize = 887 * 0.26 * NEST_ART_SIZE_MULTIPLIER;
    const scale = Math.min(maxSize / Math.max(1, nestArt.texture.width), maxSize / Math.max(1, nestArt.texture.height));
    nestArt.scale.set(scale);
  }

  function setEnemyArtSize(art: Sprite, preserveAspectRatio: boolean) {
    if (!preserveAspectRatio) {
      art.width = 112 * ENEMY_ART_SIZE_MULTIPLIER;
      art.height = 112 * ENEMY_ART_SIZE_MULTIPLIER;
      return;
    }
    const maxSize = 112 * ENEMY_ART_SIZE_MULTIPLIER;
    const scale = Math.min(maxSize / Math.max(1, art.texture.width), maxSize / Math.max(1, art.texture.height));
    art.scale.set(scale);
  }

  function createEnemyBase(position: Point, artTexture: Texture, preserveAspectRatio: boolean) {
    const enemyBase = new Container();
    enemyBase.position.set(position.x, position.y);
    enemyBase.visible = false;
    const nestArt = new Sprite(artTexture);
    nestArt.anchor.set(0.5);
    setNestArtSize(nestArt, preserveAspectRatio);
    enemyBase.addChild(nestArt);
    deps.world.addChild(enemyBase);
    return enemyBase;
  }

  function createEnemy(position: Point, color: number, homeBase: Container, artTexture: Texture, preserveAspectRatio: boolean, hideCloud: boolean, cloudTexture: Texture): Enemy {
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
    const cloud = new Sprite(cloudTexture);
    cloud.anchor.set(0.5);
    cloud.position.set(0, ENEMY_CLOUD_Y);
    cloud.width = 124 * CLOUD_SIZE_MULTIPLIER;
    cloud.height = 62 * CLOUD_SIZE_MULTIPLIER;
    cloud.tint = color === 0xff6f78 ? 0xff9c9c : 0xd7b8ff;
    cloud.visible = !hideCloud;
    const art = new Sprite(artTexture);
    art.anchor.set(0.5);
    art.position.set(0, cloud.visible ? ENEMY_WITH_CLOUD_Y : ENEMY_WITHOUT_CLOUD_Y);
    setEnemyArtSize(art, preserveAspectRatio);
    body.visible = false;
    eyes.visible = false;
    container.addChild(cloud, art, body, eyes);
    deps.world.addChild(container);
    container.visible = false;
    return {
      container, body, eyes, art, cloud, eggs: [], target: null, interestTarget: null,
      speed: 155, homeBase, dazedUntil: 0, collected: 0, depositing: false,
    };
  }

  const rivalLayout = deps.getRivalLayout?.() ?? {
    bases: [{ x: 2200, y: 850 }, { x: 4700, y: -1500 }],
    enemies: [{ x: 2200, y: 850 }, { x: 4400, y: -1200 }],
  };
  const initialVisuals: EnemyVisualSet = deps.getRivalVisuals?.() ?? {
    enemyFrames: deps.enemyFrames,
    enemyNestFrames: deps.enemyNestFrames,
    preserveAspectRatio: false,
  };
  const enemyBases = rivalLayout.bases.map((position, index) =>
    createEnemyBase(position, initialVisuals.enemyNestFrames[index % initialVisuals.enemyNestFrames.length], Boolean(initialVisuals.preserveAspectRatio)),
  );
  const enemies: Enemy[] = rivalLayout.enemies.map((position, index) =>
    createEnemy(
      position,
      index === 0 ? 0xff6f78 : 0x9c7dff,
      enemyBases[Math.min(index, enemyBases.length - 1)],
      initialVisuals.enemyFrames[index % initialVisuals.enemyFrames.length],
      Boolean(initialVisuals.preserveAspectRatio),
      initialVisuals.cloudTextures
        ? Boolean(initialVisuals.cloudTextures[index])
        : !Boolean(initialVisuals.hideCloud),
      initialVisuals.cloudTextures?.[index] ?? deps.playerCloudTexture,
    ),
  );
  const enemyDepositAnimations: EnemyDepositAnimation[] = [];

  function updateVisuals(visuals: EnemyVisualSet) {
    const preserveAspectRatio = Boolean(visuals.preserveAspectRatio);
    for (let i = 0; i < enemies.length; i += 1) {
      const enemy = enemies[i];
      enemy.art.texture = visuals.enemyFrames[i % visuals.enemyFrames.length];
      setEnemyArtSize(enemy.art, preserveAspectRatio);
      if (visuals.cloudTextures) {
        const cloudTexture = visuals.cloudTextures[i] ?? deps.playerCloudTexture;
        enemy.cloud.texture = cloudTexture;
        enemy.cloud.visible = Boolean(visuals.cloudTextures[i]);
      } else {
        enemy.cloud.texture = deps.playerCloudTexture;
        enemy.cloud.visible = !Boolean(visuals.hideCloud);
      }
      enemy.cloud.y = ENEMY_CLOUD_Y;
      enemy.art.y = enemy.cloud.visible ? ENEMY_WITH_CLOUD_Y : ENEMY_WITHOUT_CLOUD_Y;
      const nestArt = enemyBases[i].children.find((child) => child instanceof Sprite) as Sprite | undefined;
      if (nestArt) {
        nestArt.texture = visuals.enemyNestFrames[i % visuals.enemyNestFrames.length];
        setNestArtSize(nestArt, preserveAspectRatio);
      }
    }
  }

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
    if (chasingPlayer) enemy.interestTarget = null;
    if (!chasingPlayer) enemy.interestTarget = null;
    if (enemy.eggs.length >= ENEMY_EGG_CAPACITY) enemy.target = null;
    if (!chasingPlayer && enemy.eggs.length < ENEMY_EGG_CAPACITY) {
      let nearestDistance = enemy.target &&
        enemy.target.visible &&
        enemy.target.parent === deps.eggLayer &&
        isEnemyCollectibleEgg(enemy.target)
        ? Math.hypot(enemy.container.x - enemy.target.x, enemy.container.y - enemy.target.y)
        : Infinity;
      if (nearestDistance === Infinity) enemy.target = null;
      if (!enemy.target) {
        let closestEgg: Container | null = null;

        for (const egg of deps.eggSystem.eggs) {
          if (!egg.visible || egg.parent !== deps.eggLayer) continue;
          // Rivals can still collect regular and coin eggs, but never the
          // fugitive/event egg. Special power-ups live in another layer.
          if (!isEnemyCollectibleEgg(egg)) continue;
          const candidateDistance = Math.hypot(enemy.container.x - egg.x, enemy.container.y - egg.y);
          if (candidateDistance < nearestDistance) {
            nearestDistance = candidateDistance;
            closestEgg = egg;
          }
        }
        enemy.target = closestEgg;
      }
      const interest = deps.getWorldInterest?.({
        x: enemy.container.x,
        y: enemy.container.y,
      });
      if (
        interest &&
        Math.hypot(
          interest.position.x - enemy.container.x,
          interest.position.y - enemy.container.y,
        ) <= interest.radius
      ) {
        const interestPriority = interest.strength * 700;
        if (!enemy.target || nearestDistance > interestPriority) {
          enemy.target = null;
          enemy.interestTarget = { ...interest.position };
        } else {
          enemy.interestTarget = null;
        }
      } else {
        enemy.interestTarget = null;
      }
    }
    const destination = chasingPlayer
      ? deps.getPlayerPosition()
      : enemy.eggs.length >= ENEMY_EGG_CAPACITY
        ? enemy.homeBase.position
        : enemy.target?.position ?? enemy.interestTarget;
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
    if (
      enemy.target &&
      enemy.target.parent === deps.eggLayer &&
      isEnemyCollectibleEgg(enemy.target) &&
      Math.hypot(enemy.container.x - enemy.target.x, enemy.target.y - enemy.container.y) < 72
    ) {
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
            isEnemyCollectibleEgg(egg) &&
            (enemyNearPlayer ||
              Math.hypot(enemy.container.x - egg.x, enemy.container.y - egg.y) < 54)
        );
        if (playerQueueEgg) {
          enemy.eggs.push(...deps.eggSystem.takeCarriedEggs(
            isEnemyCollectibleEgg,
          ));
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

  function clear() {
    const pendingEggs = new Set<Container>();
    for (const enemy of enemies) {
      for (const egg of enemy.eggs) pendingEggs.add(egg);
      enemy.eggs.length = 0;
      enemy.target = null;
      enemy.interestTarget = null;
      enemy.depositing = false;
      enemy.container.visible = false;
    }
    for (const animation of enemyDepositAnimations) {
      for (const egg of animation.eggs) pendingEggs.add(egg);
    }
    enemyDepositAnimations.length = 0;
    for (const egg of pendingEggs) deps.eggSystem.releaseEgg(egg);
    for (const base of enemyBases) base.visible = false;
  }

  function resetForScene(layout = deps.getRivalLayout?.() ?? rivalLayout) {
    clear();
    updateVisuals(deps.getRivalVisuals?.() ?? {
      enemyFrames: deps.enemyFrames,
      enemyNestFrames: deps.enemyNestFrames,
      preserveAspectRatio: false,
    });
    for (let i = 0; i < enemyBases.length; i += 1) {
      const position = layout.bases[i] ?? layout.bases[layout.bases.length - 1];
      if (!position) continue;
      enemyBases[i].position.set(position.x, position.y);
    }
    for (let i = 0; i < enemies.length; i += 1) {
      const position = layout.enemies[i] ?? layout.enemies[layout.enemies.length - 1];
      if (!position) continue;
      enemies[i].container.position.set(position.x, position.y);
      enemies[i].homeBase = enemyBases[Math.min(i, enemyBases.length - 1)];
      enemies[i].dazedUntil = 0;
      enemies[i].collected = 0;
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
    clear,
    resetForScene,
  };
}
