import type { SceneContext } from "../../game/scene-context";
import type {
  SceneTutorialConfig,
  TutorialTarget,
} from "../../config/scene-tutorial-config";

export type TutorialSystemState = "INACTIVE" | "ACTIVE" | "PAUSED" | "DISPOSED";

export type TutorialSystem = {
  readonly context: SceneContext;
  readonly config: SceneTutorialConfig;
  readonly state: TutorialSystemState;
  readonly activeTarget: TutorialTarget | null;
  initialize(): void;
  enter(): void;
  update(dt: number): void;
  pause(): void;
  resume(): void;
  setTarget(target: TutorialTarget | null): void;
  clearTarget(target?: TutorialTarget): void;
  markObjectiveComplete(id: string): void;
  isObjectiveComplete(id: string): boolean;
  reset(options?: { clearCompleted?: boolean }): void;
  exit(): void;
  dispose(): void;
};

/** Shared tutorial state machine; each Scene owns one configured instance. */
export function createTutorialSystem(options: {
  context: SceneContext;
  config: SceneTutorialConfig;
}): TutorialSystem {
  let currentState: TutorialSystemState = "INACTIVE";
  let currentTarget: TutorialTarget | null = null;
  const completedObjectives = new Set<string>();

  function initialize() {
    if (currentState === "DISPOSED") return;
    currentState = options.config.enabled ? "ACTIVE" : "INACTIVE";
  }

  function enter() {
    if (currentState === "DISPOSED") return;
    if (currentState === "INACTIVE") initialize();
    if (options.config.enabled) {
      currentState = "ACTIVE";
      if (currentTarget === null) {
        const nextObjective = options.config.objectives.find(
          (objective) => !completedObjectives.has(objective.id),
        );
        if (nextObjective) currentTarget = nextObjective.target;
      }
    }
    else currentTarget = null;
  }

  function update(_dt: number) {
    if (currentState !== "ACTIVE") return;
  }

  function pause() {
    if (currentState === "ACTIVE") currentState = "PAUSED";
  }

  function resume() {
    if (currentState === "PAUSED") currentState = "ACTIVE";
  }

  function setTarget(target: TutorialTarget | null) {
    if (currentState === "DISPOSED" || !options.config.enabled) {
      currentTarget = null;
      return;
    }
    if (currentTarget !== null && currentTarget !== target) {
      const objective = options.config.objectives.find(
        (candidate) => candidate.target === currentTarget,
      );
      if (objective) completedObjectives.add(objective.id);
    }
    currentTarget = target;
  }

  function clearTarget(target?: TutorialTarget) {
    if (target === undefined || currentTarget === target) {
      if (currentTarget !== null) {
        const objective = options.config.objectives.find(
          (candidate) => candidate.target === currentTarget,
        );
        if (objective) completedObjectives.add(objective.id);
      }
      currentTarget = null;
    }
  }

  function markObjectiveComplete(id: string) {
    if (options.config.objectives.some((objective) => objective.id === id)) {
      completedObjectives.add(id);
    }
  }

  function isObjectiveComplete(id: string) {
    return completedObjectives.has(id);
  }

  function reset(optionsForReset: { clearCompleted?: boolean } = {}) {
    currentTarget = null;
    if (optionsForReset.clearCompleted) completedObjectives.clear();
    if (currentState !== "DISPOSED") {
      currentState = options.config.enabled ? "ACTIVE" : "INACTIVE";
    }
  }

  function exit() {
    currentTarget = null;
    if (currentState !== "DISPOSED") currentState = "INACTIVE";
  }

  function dispose() {
    currentTarget = null;
    completedObjectives.clear();
    currentState = "DISPOSED";
  }

  return {
    context: options.context,
    config: options.config,
    get state() {
      return currentState;
    },
    get activeTarget() {
      return currentTarget;
    },
    initialize,
    enter,
    update,
    pause,
    resume,
    setTarget,
    clearTarget,
    markObjectiveComplete,
    isObjectiveComplete,
    reset,
    exit,
    dispose,
  };
}
