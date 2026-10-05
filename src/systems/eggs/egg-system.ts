import { Container, Sprite, Texture } from "pixi.js";
import { BUSH_STACK_CONFIG, EGG_SPAWN_CONFIG, PLAYABLE_BOUNDS, getStageVisualScale } from "../../config/game-config";
import type { Point } from "../../game/types";
import type { Bush } from "../../world/world-scene";

type EggMotion = { phase: number; spawnElapsed: number; spawnDuration: number };
type EggHideAnimation = {
  egg: Container;
  from: Point;
  to: Point;
  elapsed: number;
  hiding: boolean;
};
type BushLayoutState = "TRAIL" | "COMPACTING" | "COMPACT" | "RELEASING";

export type EggType = "NORMAL" | "COIN";
export type EggSource = "WORLD" | "CLUSTER" | "FUGITIVE" | "FUGITIVE_JACKPOT" | "GOLD_MINE";
export type EggData = {
  type: EggType;
  coinValue: number;
  progressionValue: number;
  source: EggSource;
};

export type EggSystemDependencies = {
  eggLayer: Container;
  eggFrames: Texture[];
  coinTexture?: Texture;
  eggResolutionScale: number;
  getStageIndex: () => number;
  getPlayerPosition: () => Point;
  getNestPosition: () => Point;
  getCarriedEggScale: () => number;
  getCarriedEggGap: () => number;
};

export function createEggSystem(deps: EggSystemDependencies) {
  const eggs: Container[] = [];
  const eggPool: Container[] = [];
  const eggMotion = new Map<Container, EggMotion>();
  const eggData = new Map<Container, EggData>();
  const carriedEggs: Container[] = [];
  const eggHideAnimations: EggHideAnimation[] = [];
  const eggsInHideAnimation = new Set<Container>();
  const bushCompactTargets = new Map<Container, Point>();
  let bushLayoutState: BushLayoutState = "TRAIL";
  let bushReleaseDistance = 0;
  let bushReleasedCount = 0;
  let bushAnchor: Point = { x: 0, y: 0 };
  let bushReleaseOrigin: Point | null = null;
  let eggSerial = 0;

  const getEggWorldSpriteScale = () =>
    0.19 * deps.eggResolutionScale * Math.min(
      1.22,
      1 + (getStageVisualScale(deps.getStageIndex()) - 1) * 0.42,
    );
  const getCarriedEggDistance = (index: number) =>
    deps.getCarriedEggGap() + 28 + deps.getCarriedEggGap() * index;

  function setEggWorldSpriteScale(egg: Container) {
    const sprite = egg.children[0];
    if (!(sprite instanceof Sprite)) return;
    const data = eggData.get(egg);
    if (data?.type === "COIN" && deps.coinTexture) {
      const stageScale = Math.min(
        1.22,
        1 + (getStageVisualScale(deps.getStageIndex()) - 1) * 0.42,
      );
      sprite.width = 66 * stageScale;
      sprite.height = 82 * stageScale;
      return;
    }
    sprite.scale.set(getEggWorldSpriteScale());
  }

  function spawnEgg(
    position: Point,
    stageIndex: number,
    data: Partial<EggData> = {},
  ) {
    const eggFrame = deps.eggFrames[Math.min(stageIndex, deps.eggFrames.length - 1)];
    const safePosition = {
      x: Math.max(PLAYABLE_BOUNDS.left + 30, Math.min(PLAYABLE_BOUNDS.right - 30, position.x)),
      y: Math.max(PLAYABLE_BOUNDS.top + 30, Math.min(PLAYABLE_BOUNDS.bottom - 30, position.y)),
    };
    const egg = eggPool.pop() ?? new Container();
    egg.visible = true;
    egg.position.set(safePosition.x, safePosition.y);
    egg.label = `egg-${eggSerial++}`;
    // Pooled eggs contain only their actual art sprite. Remove any legacy
    // helper graphics so no placeholder glow or decoration survives reuse.
    while (egg.children.length > 1) {
      egg.removeChildAt(1).destroy({ children: true });
    }
    const nextData: EggData = {
      type: data.type ?? "NORMAL",
      coinValue: data.coinValue ?? (data.type === "COIN" ? 10 : 1),
      progressionValue: data.progressionValue ?? 1,
      source: data.source ?? "WORLD",
    };
    const eggSprite = (egg.children[0] as Sprite | undefined) ?? new Sprite(eggFrame);
    eggSprite.texture = nextData.type === "COIN" && deps.coinTexture ? deps.coinTexture : eggFrame;
    eggSprite.position.set(0);
    eggSprite.rotation = 0;
    eggSprite.anchor.set(0.5);
    if (nextData.type === "COIN" && deps.coinTexture) {
      const stageScale = 1 + (getStageVisualScale(stageIndex) - 1) * 0.42;
      eggSprite.width = 66 * stageScale;
      eggSprite.height = 82 * stageScale;
    } else {
      eggSprite.scale.set(
        0.19 * deps.eggResolutionScale *
          (1 + (getStageVisualScale(stageIndex) - 1) * 0.42),
      );
    }
    if (eggSprite.parent !== egg) egg.addChild(eggSprite);
    eggData.set(egg, nextData);
    eggSprite.tint = 0xffffff;
    egg.scale.set(0.12);
    deps.eggLayer.addChild(egg);
    eggs.push(egg);
    eggMotion.set(egg, { phase: Math.random() * Math.PI * 2, spawnElapsed: 0, spawnDuration: 0.42 });
    return egg;
  }

  function releaseEgg(egg: Container) {
    egg.removeFromParent();
    egg.visible = false;
    const index = eggs.indexOf(egg);
    if (index !== -1) eggs.splice(index, 1);
    eggMotion.delete(egg);
    eggData.delete(egg);
    bushCompactTargets.delete(egg);
    eggsInHideAnimation.delete(egg);
    for (let i = eggHideAnimations.length - 1; i >= 0; i -= 1) {
      if (eggHideAnimations[i].egg === egg) eggHideAnimations.splice(i, 1);
    }
    if (eggPool.length < EGG_SPAWN_CONFIG.activeTarget) eggPool.push(egg);
    else egg.destroy({ children: true });
  }

  function getActiveWorldEggs() {
    return eggs.filter((egg) => egg.visible && egg.parent === deps.eggLayer);
  }

  function countActiveWorldEggs() {
    let count = 0;
    for (const egg of eggs) if (egg.visible && egg.parent === deps.eggLayer) count += 1;
    return count;
  }

  function spawnDirectorEgg(bushes: Bush[]) {
    const activeEggs = getActiveWorldEggs();
    const zone = [...EGG_SPAWN_CONFIG.zones]
      .sort(
        (a, b) =>
          activeEggs.filter((egg) => b.bounds.left <= egg.x && egg.x <= b.bounds.right && b.bounds.top <= egg.y && egg.y <= b.bounds.bottom).length -
          activeEggs.filter((egg) => a.bounds.left <= egg.x && egg.x <= a.bounds.right && a.bounds.top <= egg.y && egg.y <= a.bounds.bottom).length,
      )
      .find((candidate) =>
        activeEggs.filter((egg) => candidate.bounds.left <= egg.x && egg.x <= candidate.bounds.right && candidate.bounds.top <= egg.y && egg.y <= candidate.bounds.bottom).length < candidate.target,
      );
    if (!zone) return false;
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const position = {
        x: zone.bounds.left + Math.random() * (zone.bounds.right - zone.bounds.left),
        y: zone.bounds.top + Math.random() * (zone.bounds.bottom - zone.bounds.top),
      };
      if (Math.hypot(position.x - deps.getPlayerPosition().x, position.y - deps.getPlayerPosition().y) < EGG_SPAWN_CONFIG.minFromPlayer) continue;
      if (Math.hypot(position.x - deps.getNestPosition().x, position.y - deps.getNestPosition().y) < EGG_SPAWN_CONFIG.minFromNest) continue;
      if (activeEggs.some((egg) => Math.hypot(position.x - egg.x, position.y - egg.y) < EGG_SPAWN_CONFIG.minBetweenEggs)) continue;
      if (bushes.some((bush) => {
        const normalizedX = (position.x - bush.x) / (bush.width * 0.5);
        const normalizedY = (position.y - (bush.y - bush.height * 0.44)) / (bush.height * 0.5);
        return Math.hypot(normalizedX, normalizedY) < 0.8;
      })) continue;
      spawnEgg(position, deps.getStageIndex());
      return true;
    }
    return false;
  }

  function randomRespawnDelay(position?: Point) {
    void position;
    return EGG_SPAWN_CONFIG.respawnMin +
      Math.random() * (EGG_SPAWN_CONFIG.respawnMax - EGG_SPAWN_CONFIG.respawnMin);
  }

  function addCarriedEgg(egg: Container) {
    carriedEggs.push(egg);
  }

  function takeCarriedEggs(predicate?: (egg: Container) => boolean) {
    const taken = predicate
      ? carriedEggs.filter(predicate)
      : carriedEggs.splice(0, carriedEggs.length);
    if (predicate) {
      for (let i = carriedEggs.length - 1; i >= 0; i -= 1) {
        if (predicate(carriedEggs[i])) carriedEggs.splice(i, 1);
      }
    }
    if (carriedEggs.length === 0) {
      bushCompactTargets.clear();
      bushLayoutState = "TRAIL";
      bushReleaseDistance = 0;
      bushReleasedCount = 0;
      bushReleaseOrigin = null;
    }
    return taken;
  }

  function takeAllCarriedEggs() {
    return takeCarriedEggs();
  }

  function updateWorldEggMotion(dt: number, time: number) {
    for (const egg of eggs) {
      if (!egg.visible || egg.parent !== deps.eggLayer) continue;
      const motion = eggMotion.get(egg);
      const sprite = egg.children[0];
      if (!motion || !(sprite instanceof Sprite)) continue;
      const motionTime = time * 1.45 + motion.phase;
      motion.spawnElapsed = Math.min(motion.spawnDuration, motion.spawnElapsed + dt);
      const spawnProgress = Math.min(1, motion.spawnElapsed / motion.spawnDuration);
      const spawnEased = 1 - (1 - spawnProgress) ** 3;
      const spawnOvershoot = Math.sin(spawnProgress * Math.PI) * 0.12;
      egg.scale.set(0.12 + spawnEased * 0.88 + spawnOvershoot);
      sprite.y = Math.sin(motionTime) * 2.5;
      sprite.rotation = Math.sin(motionTime * 0.8) * 0.045;
    }
  }

  function startBushHideAnimation(player: Point, hiding: boolean, bushes: Bush[]) {
    eggHideAnimations.length = 0;
    eggsInHideAnimation.clear();
    if (carriedEggs.length === 0) return;
    const bush = bushes.reduce((closest, candidate) => {
      const currentDistance = Math.hypot(player.x - candidate.x, player.y - (candidate.y - candidate.height * 0.44));
      const closestDistance = Math.hypot(player.x - closest.x, player.y - (closest.y - closest.height * 0.44));
      return currentDistance < closestDistance ? candidate : closest;
    }, bushes[0]);
    if (hiding) {
      bushLayoutState = "COMPACTING";
      bushReleaseDistance = 0;
      bushReleasedCount = 0;
      bushReleaseOrigin = null;
      bushAnchor = {
        x: player.x * 0.55 + bush.x * 0.45,
        y: player.y * 0.55 + (bush.y - bush.height * 0.44) * 0.45 + 18,
      };
      bushCompactTargets.clear();
    } else {
      bushLayoutState = "RELEASING";
      bushReleaseDistance = 0;
      bushReleasedCount = 0;
      bushReleaseOrigin = { ...bushAnchor };
    }
    const columns = Math.min(BUSH_STACK_CONFIG.maxColumns, Math.max(3, Math.ceil(Math.sqrt(carriedEggs.length * 1.35))));
    carriedEggs.forEach((egg, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const rowCount = Math.min(columns, carriedEggs.length - row * columns);
      const jitterX = Math.sin(index * 12.9898) * BUSH_STACK_CONFIG.jitterX;
      const jitterY = Math.cos(index * 7.233) * BUSH_STACK_CONFIG.jitterY;
      const target = {
        x: bushAnchor.x + (column - (rowCount - 1) / 2) * BUSH_STACK_CONFIG.slotSpacingX + jitterX,
        y: bushAnchor.y + row * BUSH_STACK_CONFIG.slotSpacingY + jitterY,
      };
      if (hiding) bushCompactTargets.set(egg, target);
      const from = { x: egg.x, y: egg.y };
      egg.visible = true;
      if (hiding) {
        eggsInHideAnimation.add(egg);
        eggHideAnimations.push({
          egg,
          from,
          to: target,
          elapsed: -index * BUSH_STACK_CONFIG.cascadeStep,
          hiding: true,
        });
      }
    });
    if (!hiding && carriedEggs.length === 0) bushLayoutState = "TRAIL";
  }

  function updateCarriedEggBushAnimations(dt: number) {
    for (let i = eggHideAnimations.length - 1; i >= 0; i -= 1) {
      const animation = eggHideAnimations[i];
      animation.elapsed += dt;
      const progress = Math.min(1, Math.max(0, animation.elapsed / (BUSH_STACK_CONFIG.compactDuration + Math.min(carriedEggs.length, 70) * BUSH_STACK_CONFIG.compactDurationPerEgg)));
      const eased = 1 - (1 - progress) ** 3;
      animation.egg.position.set(
        animation.from.x + (animation.to.x - animation.from.x) * eased,
        animation.from.y + (animation.to.y - animation.from.y) * eased,
      );
      animation.egg.scale.set(deps.getCarriedEggScale() * (1 + Math.sin(progress * Math.PI) * 0.28));
      if (progress >= 1) {
        animation.egg.scale.set(deps.getCarriedEggScale());
        animation.egg.visible = true;
        eggsInHideAnimation.delete(animation.egg);
        eggHideAnimations.splice(i, 1);
      }
    }
    if (bushLayoutState === "COMPACTING" && eggHideAnimations.length === 0) {
      bushLayoutState = "COMPACT";
    }
  }

  function updateBushReleaseDistance(distance: number) {
    if (bushLayoutState !== "RELEASING" || carriedEggs.length === 0) return;
    bushReleaseDistance += Math.max(0, distance);
    bushReleasedCount = Math.min(
      carriedEggs.length,
      Math.floor(bushReleaseDistance / Math.max(18, deps.getCarriedEggGap() * BUSH_STACK_CONFIG.releaseSpacingMultiplier)),
    );
    if (bushReleasedCount >= carriedEggs.length) {
      bushLayoutState = "TRAIL";
      bushCompactTargets.clear();
      bushReleaseOrigin = null;
    }
  }

  function shouldHoldBushEgg(egg: Container, index: number) {
    if (bushLayoutState === "COMPACT" || bushLayoutState === "COMPACTING") return true;
    return bushLayoutState === "RELEASING" && index >= bushReleasedCount && bushCompactTargets.has(egg);
  }

  function getBushCompactTarget(egg: Container, time: number): Point | null {
    const target = bushCompactTargets.get(egg);
    if (!target) return null;
    return {
      x: target.x + Math.sin(time * 1.8 + egg.x * 0.01) * BUSH_STACK_CONFIG.bobX,
      y: target.y + Math.cos(time * 1.6 + egg.y * 0.01) * BUSH_STACK_CONFIG.bobY,
    };
  }

  function refreshScales() {
    for (const egg of eggs) setEggWorldSpriteScale(egg);
    for (const egg of carriedEggs) {
      setEggWorldSpriteScale(egg);
      egg.scale.set(deps.getCarriedEggScale());
    }
  }

  function getEggData(egg: Container): EggData {
    return eggData.get(egg) ?? {
      type: "NORMAL",
      coinValue: 1,
      progressionValue: 1,
      source: "WORLD",
    };
  }

  return {
    activeTarget: EGG_SPAWN_CONFIG.activeTarget,
    eggs,
    carriedEggs,
    eggHideAnimations,
    eggsInHideAnimation,
    spawnEgg,
    releaseEgg,
    getActiveWorldEggs,
    countActiveWorldEggs,
    spawnDirectorEgg,
    randomRespawnDelay,
    addCarriedEgg,
    takeCarriedEggs,
    takeAllCarriedEggs,
    updateWorldEggMotion,
    startBushHideAnimation,
    updateCarriedEggBushAnimations,
    updateBushReleaseDistance,
    shouldHoldBushEgg,
    getBushCompactTarget,
    getBushLayoutState: () => bushLayoutState,
    getBushReleaseDistance: () => bushReleaseDistance,
    getBushReleasedCount: () => bushReleasedCount,
    getBushReleaseOrigin: () => bushReleaseOrigin,
    getBushAnchor: () => bushAnchor,
    refreshScales,
    setEggWorldSpriteScale,
    getEggWorldSpriteScale,
    getCarriedEggDistance,
    getEggData,
  };
}
