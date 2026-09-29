import { STAGES, getStageVisualScale } from "../../config/game-config";

export function createProgressionSystem() {
  let delivered = 0;
  let stageIndex = 0;

  function recordDelivery(amount: number) {
    delivered += amount;
    const next = STAGES.findIndex((stage) => delivered < stage.threshold);
    const unlockedIndex = next === -1 ? STAGES.length - 1 : Math.max(0, next - 1);
    return {
      delivered,
      unlockedIndex,
      shouldEvolve: unlockedIndex > stageIndex,
    };
  }

  function completeEvolution(nextIndex: number) {
    stageIndex = Math.min(nextIndex, STAGES.length - 1);
  }

  function getNextThreshold() {
    return STAGES.find((stage) => stage.threshold > delivered)?.threshold ??
      STAGES[STAGES.length - 1].threshold;
  }

  return {
    get delivered() { return delivered; },
    get stageIndex() { return stageIndex; },
    get visualScale() { return getStageVisualScale(stageIndex); },
    getNextThreshold,
    recordDelivery,
    completeEvolution,
  };
}
