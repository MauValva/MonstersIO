import type { Level, LevelId } from "./level-types";
import type { SceneRuntime } from "./scene-runtime";

export function createLevelManager(levels: Level[], initialLevel: LevelId) {
  const byId = new Map(levels.map((level) => [level.id, level]));
  const loaded = new Set<LevelId>();
  let activeLevel: Level | null = null;
  let paused = false;

  function load(id: LevelId) {
    const level = byId.get(id);
    if (!level) throw new Error(`Unknown level: ${id}`);
    if (loaded.has(id)) return;
    level.load?.();
    level.context?.resources.assets?.assertLoaded(level.assetManifest);
    level.context?.resources.assets?.acquire(level.assetManifest);
    level.runtime?.initialize();
    loaded.add(id);
  }

  function activate(id: LevelId) {
    const nextLevel = byId.get(id);
    if (!nextLevel) throw new Error(`Unknown level: ${id}`);
    if (activeLevel === nextLevel) return;
    load(id);
    activeLevel?.runtime?.exit();
    activeLevel?.exit();
    activeLevel = nextLevel;
    if (activeLevel.context) {
      activeLevel.context.session.campaign.activeWorld = id;
    }
    activeLevel.enter();
    activeLevel.runtime?.enter();
    if (paused) activeLevel.pause?.();
    if (paused) activeLevel.runtime?.pause();
  }

  function pause() {
    if (paused) return;
    paused = true;
    activeLevel?.pause?.();
    activeLevel?.runtime?.pause();
  }

  function resume() {
    if (!paused) return;
    paused = false;
    activeLevel?.resume?.();
    activeLevel?.runtime?.resume();
  }

  function unload(id: LevelId) {
    const level = byId.get(id);
    if (!level) throw new Error(`Unknown level: ${id}`);
    if (activeLevel === level) {
      level.exit();
      level.runtime?.exit();
      activeLevel = null;
      if (level.context) level.context.session.campaign.activeWorld = null;
    }
    if (!loaded.has(id)) return;
    level.dispose?.();
    level.context?.resources.assets?.release(level.assetManifest);
    level.runtime?.dispose();
    loaded.delete(id);
  }

  activate(initialLevel);

  return {
    activate,
    load,
    pause,
    resume,
    unload,
    attachRuntime(id: LevelId, runtime: SceneRuntime) {
      const level = byId.get(id);
      if (!level) throw new Error(`Unknown level: ${id}`);
      if (runtime.sceneId !== id) {
        throw new Error(`Runtime ${runtime.sceneId} does not belong to level ${id}`);
      }
      if (level.runtime && level.runtime !== runtime) {
        level.runtime.dispose();
      }
      level.runtime = runtime;
      if (activeLevel === level) {
        runtime.initialize();
        runtime.enter();
        if (paused) runtime.pause();
      }
    },
    update(dt: number) {
      if (paused) return;
      activeLevel?.runtime?.update(dt);
      activeLevel?.update(dt);
    },
    get activeId() {
      return activeLevel?.id ?? null;
    },
    get active() {
      return activeLevel;
    },
    get isPaused() {
      return paused;
    },
  };
}
