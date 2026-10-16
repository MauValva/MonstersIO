import type { WorldEvolutionConfig } from "../../config/world-evolution-config";

export type ProgressionState =
  | "EVOLVING"
  | "PORTAL_ACTIVE"
  | "PORTAL_COMPLETED"
  | "TRANSITIONING"
  | "WORLD_COMPLETED";

export type ProgressionSaveState = {
  delivered: number;
  globalDelivered: number;
  stageIndex: number;
  state: ProgressionState;
};

export function createProgressionSystem(
  initialConfig: WorldEvolutionConfig,
  initialState?: Partial<ProgressionSaveState>,
) {
  let config = initialConfig;
  let delivered = Math.max(0, initialState?.delivered ?? 0);
  let globalDelivered = Math.max(0, initialState?.globalDelivered ?? delivered);
  let stageIndex = Math.max(0, Math.min(
    initialState?.stageIndex ?? 0,
    initialConfig.stages.length - 1,
  ));
  let state: ProgressionState = initialState?.state ?? "EVOLVING";

  function getNextThreshold(progress = delivered) {
    if (
      stageIndex >= config.stages.length - 1 &&
      config.portalEggRequirement !== null &&
      progress < config.portalEggRequirement
    ) {
      return config.portalEggRequirement;
    }
    return (
      config.stages.find((stage) => stage.threshold > progress)?.threshold ??
      config.stages[config.stages.length - 1].threshold
    );
  }

  function recordDelivery(amount: number) {
    const safeAmount = Math.max(0, amount);
    delivered += safeAmount;
    globalDelivered += safeAmount;
    const next = config.stages.findIndex((stage) => delivered < stage.threshold);
    const unlockedIndex =
      next === -1 ? config.stages.length - 1 : Math.max(0, next - 1);
    return {
      delivered,
      globalDelivered,
      unlockedIndex,
      shouldEvolve: unlockedIndex > stageIndex,
      portalReady:
        stageIndex >= config.stages.length - 1 &&
        config.portalEggRequirement !== null &&
        delivered >= config.portalEggRequirement,
    };
  }

  function completeEvolution(nextIndex: number) {
    stageIndex = Math.max(
      0,
      Math.min(nextIndex, config.stages.length - 1),
    );
    if (
      stageIndex >= config.stages.length - 1 &&
      config.portalEggRequirement !== null
    ) {
      state = "PORTAL_ACTIVE";
    } else {
      state = "EVOLVING";
    }
  }

  function completePortal() {
    if (
      state !== "PORTAL_ACTIVE" ||
      config.portalEggRequirement === null ||
      delivered < config.portalEggRequirement
    ) {
      return false;
    }
    state = "PORTAL_COMPLETED";
    return true;
  }

  function beginTransition() {
    if (state !== "PORTAL_COMPLETED") return false;
    state = "TRANSITIONING";
    return true;
  }

  function enterWorld(nextConfig: WorldEvolutionConfig) {
    prepareForNewWorld(nextConfig);
    enterActiveWorld();
  }

  /**
   * Changes the local world configuration while preserving a portal
   * transition in progress. The transition animation still owns the final
   * state change; this only prepares the next world's local counters.
   */
  function prepareForNewWorld(nextConfig: WorldEvolutionConfig) {
    config = nextConfig;
    delivered = 0;
    stageIndex = 0;
  }

  function enterActiveWorld() {
    state = "EVOLVING";
  }

  function completeWorld() {
    state = "WORLD_COMPLETED";
  }

  function restore(next: Partial<ProgressionSaveState>) {
    delivered = Math.max(0, next.delivered ?? delivered);
    globalDelivered = Math.max(0, next.globalDelivered ?? globalDelivered);
    stageIndex = Math.max(0, Math.min(next.stageIndex ?? stageIndex, config.stages.length - 1));
    state = next.state ?? state;
  }

  return {
    get delivered() { return delivered; },
    get globalDelivered() { return globalDelivered; },
    get stageIndex() { return stageIndex; },
    get localEvolutionLevel() { return stageIndex; },
    get visualScale() { return config.stages[stageIndex].scale; },
    get stages() { return config.stages; },
    get portalEggRequirement() { return config.portalEggRequirement; },
    get state() { return state; },
    get isPortalActive() { return state === "PORTAL_ACTIVE"; },
    get isPortalCompleted() {
      return state === "PORTAL_COMPLETED" || state === "TRANSITIONING";
    },
    getNextThreshold,
    recordDelivery,
    completeEvolution,
    completePortal,
    beginTransition,
    enterWorld,
    prepareForNewWorld,
    enterActiveWorld,
    completeWorld,
    restore,
  };
}
