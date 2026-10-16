import type { SceneContext } from "../game/scene-context";
import type { WorldEvolutionConfig } from "../config/world-evolution-config";
import type { LevelId } from "./level-types";
import type { WorldLevelDesignConfig } from "./world-level-design";

export type SceneRuntimeState =
  | "CREATED"
  | "LOADED"
  | "ACTIVE"
  | "PAUSED"
  | "EXITED"
  | "DISPOSED";

export type SceneRuntimeDependencies = {
  initialize?: () => void;
  enter?: () => void;
  update?: (dt: number) => void;
  pause?: () => void;
  resume?: () => void;
  exit?: () => void;
  dispose?: () => void;
};

export type SceneRuntime = {
  readonly sceneId: LevelId;
  readonly context: SceneContext;
  readonly design: WorldLevelDesignConfig;
  readonly evolution: WorldEvolutionConfig;
  readonly state: SceneRuntimeState;
  initialize(): void;
  enter(): void;
  update(dt: number): void;
  pause(): void;
  resume(): void;
  exit(): void;
  dispose(): void;
};

/**
 * Lifecycle boundary for one world. Gameplay systems can remain temporarily
 * shared by main.ts, but their scene-owned reset hooks are invoked here.
 */
export function createSceneRuntime(options: {
  sceneId: LevelId;
  context: SceneContext;
  design: WorldLevelDesignConfig;
  evolution: WorldEvolutionConfig;
  dependencies?: SceneRuntimeDependencies;
}): SceneRuntime {
  let currentState: SceneRuntimeState = "CREATED";
  const dependencies = options.dependencies ?? {};

  function initialize() {
    if (currentState !== "CREATED") return;
    dependencies.initialize?.();
    currentState = "LOADED";
  }

  function enter() {
    if (currentState === "DISPOSED" || currentState === "ACTIVE") return;
    if (currentState === "CREATED") initialize();
    if (currentState !== "LOADED" && currentState !== "EXITED") return;
    dependencies.enter?.();
    currentState = "ACTIVE";
  }

  function update(dt: number) {
    if (currentState !== "ACTIVE") return;
    dependencies.update?.(dt);
  }

  function pause() {
    if (currentState !== "ACTIVE") return;
    dependencies.pause?.();
    currentState = "PAUSED";
  }

  function resume() {
    if (currentState !== "PAUSED") return;
    dependencies.resume?.();
    currentState = "ACTIVE";
  }

  function exit() {
    if (currentState !== "ACTIVE" && currentState !== "PAUSED") return;
    dependencies.exit?.();
    currentState = "EXITED";
  }

  function dispose() {
    if (currentState === "DISPOSED") return;
    if (currentState === "ACTIVE" || currentState === "PAUSED") exit();
    dependencies.dispose?.();
    currentState = "DISPOSED";
  }

  return {
    sceneId: options.sceneId,
    context: options.context,
    design: options.design,
    evolution: options.evolution,
    get state() {
      return currentState;
    },
    initialize,
    enter,
    update,
    pause,
    resume,
    exit,
    dispose,
  };
}
