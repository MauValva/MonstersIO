import { Container, Sprite, Texture } from "pixi.js";
import { EGG_SPAWN_CONFIG, GOLD_MINE_CONFIG, PLAYABLE_BOUNDS, getStageVisualScale } from "../../config/game-config";
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

export type EggSystemDependencies = {
  eggLayer: Container;
  eggFrames: Texture[];
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
  const carriedEggs: Container[] = [];
  const eggHideAnimations: EggHideAnimation[] = [];
  const eggsInHideAnimation = new Set<Container>();
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
    if (sprite instanceof Sprite) sprite.scale.set(getEggWorldSpriteScale());
  }

  function spawnEgg(position: Point, stageIndex: number) {
    const eggFrame = deps.eggFrames[Math.min(stageIndex, deps.eggFrames.length - 1)];
    const safePosition = {
      x: Math.max(PLAYABLE_BOUNDS.left + 30, Math.min(PLAYABLE_BOUNDS.right - 30, position.x)),
      y: Math.max(PLAYABLE_BOUNDS.top + 30, Math.min(PLAYABLE_BOUNDS.bottom - 30, position.y)),
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
      0.19 * deps.eggResolutionScale *
        (1 + (getStageVisualScale(stageIndex) - 1) * 0.42),
    );
    if (eggSprite.parent !== egg) egg.addChild(eggSprite);
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
    const mineDistance = position
      ? Math.hypot(position.x - GOLD_MINE_CONFIG.center.x, position.y - GOLD_MINE_CONFIG.center.y)
      : Infinity;
    const config = mineDistance < 900 ? GOLD_MINE_CONFIG : EGG_SPAWN_CONFIG;
    return config.respawnMin + Math.random() * (config.respawnMax - config.respawnMin);
  }

  function addCarriedEgg(egg: Container) {
    carriedEggs.push(egg);
  }

  function takeAllCarriedEggs() {
    return carriedEggs.splice(0, carriedEggs.length);
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
    carriedEggs.forEach((egg, index) => {
      const target = hiding
        ? { x: bush.x + (index - (carriedEggs.length - 1) / 2) * 16, y: bush.y - bush.height * 0.44 + 8 }
        : { x: player.x - getCarriedEggDistance(index), y: player.y };
      egg.visible = true;
      eggsInHideAnimation.add(egg);
      eggHideAnimations.push({ egg, from: { x: egg.x, y: egg.y }, to: target, elapsed: 0, hiding: false });
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
      animation.egg.scale.set(deps.getCarriedEggScale() * (1 + Math.sin(progress * Math.PI) * 0.28));
      if (progress >= 1) {
        animation.egg.scale.set(deps.getCarriedEggScale());
        animation.egg.visible = animation.hiding ? false : true;
        eggsInHideAnimation.delete(animation.egg);
        eggHideAnimations.splice(i, 1);
      }
    }
  }

  function refreshScales() {
    for (const egg of eggs) setEggWorldSpriteScale(egg);
    for (const egg of carriedEggs) {
      setEggWorldSpriteScale(egg);
      egg.scale.set(deps.getCarriedEggScale());
    }
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
    takeAllCarriedEggs,
    updateWorldEggMotion,
    startBushHideAnimation,
    updateCarriedEggBushAnimations,
    refreshScales,
    setEggWorldSpriteScale,
    getEggWorldSpriteScale,
    getCarriedEggDistance,
  };
}
