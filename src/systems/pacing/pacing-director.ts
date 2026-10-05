export type PacingReason =
  | "POST_EVOLUTION"
  | "NEAR_LEVEL_UP"
  | "DEAD_MOMENT"
  | "EXPLORATION_STALL";

export type OpportunityType =
  | "UseExistingOpportunity"
  | "EggBreadcrumb"
  | "EggCluster"
  | "ExplorationBreadcrumb"
  | "SpecialEgg"
  | "Speed"
  | "Range"
  | "Orbit"
  | "Magnet"
  | "Fugitive"
  | "GoldMine";

export type RewardChannel = "GUARANTEED" | "SURPRISE";
export type RewardCategory = "RESOURCE" | "POWER_UP" | "EVENT" | "PROGRESSION";
export type RewardIntensity = "LOW" | "MEDIUM" | "HIGH";

export type RecentReward = {
  type: OpportunityType;
  category: RewardCategory;
  channel: RewardChannel;
  intensity: RewardIntensity;
  timestamp: number;
  direction?: "LEFT" | "RIGHT" | "UP";
};

export type PlayerIntent = "EXPLORING" | "RETURNING_HOME" | "DEPOSITING" | "IDLE";

export type PacingState = {
  playerLevel: number;
  depositedProgress: number;
  requiredProgress: number;
  carriedEggs: number;
  remainingToLevel: number;
  nearbyEggCount: number;
  visibleEggCount: number;
  nearbyEnemyCount: number;
  visibleEnemyCount: number;
  timeSinceLastEggPickup: number;
  timeSinceLastDeposit: number;
  timeSinceLastEvolution: number;
  timeSinceLastEnemyEncounter: number;
  currentRegion: string;
  highestRegionDiscovered: string;
  activeOpportunity: boolean;
  relevantOpportunityVisible: boolean;
  activePowerUps: string[];
  playerIntent: PlayerIntent;
  activityScore: number;
  tutorialActive: boolean;
  evolving: boolean;
  goldMineState?: string;
  goldMineActive?: boolean;
  sessionPhase?: string;
  firstPowerUpDelivered?: boolean;
};

export type PacingDecision = {
  type: OpportunityType;
  reason: PacingReason;
  targetRegion: string;
  specialEggType?: "Speed" | "Range" | "Orbit" | "Magnet";
  channel?: RewardChannel;
  category?: RewardCategory;
  intensity?: RewardIntensity;
};

export type PacingDirectorConfig = {
  evaluationInterval: number;
  deadMomentSeconds: number;
  noOpportunityThreshold: number;
  explorationStallSeconds: number;
  lowActivityThreshold: number;
  opportunityTimeout: number;
  heavyStackThreshold: number;
  noveltyHistorySize: number;
  recentZoneHistorySize?: number;
  surpriseMinDelay?: number;
  surpriseIdealDelay?: number;
  surpriseMaxDryTime?: number;
  surpriseReadinessRate?: number;
  surpriseRecoveryDuration?: number;
  highIntensityCooldown?: number;
  rewardHistorySize?: number;
  guaranteedFloorSeconds?: number;
  categoryRepetitionPenalty?: number;
  typeRepetitionPenalty?: number;
  directionRepetitionPenalty?: number;
};

export const DEFAULT_PACING_DIRECTOR_CONFIG: PacingDirectorConfig = {
  evaluationInterval: 0.75,
  deadMomentSeconds: 5,
  noOpportunityThreshold: 5,
  explorationStallSeconds: 8,
  lowActivityThreshold: 1.15,
  opportunityTimeout: 12,
  heavyStackThreshold: 10,
  noveltyHistorySize: 4,
  recentZoneHistorySize: 4,
  surpriseMinDelay: 8,
  surpriseIdealDelay: 14,
  surpriseMaxDryTime: 25,
  surpriseReadinessRate: 0.075,
  surpriseRecoveryDuration: 8,
  highIntensityCooldown: 12,
  rewardHistorySize: 8,
  guaranteedFloorSeconds: 6,
  categoryRepetitionPenalty: 0.58,
  typeRepetitionPenalty: 0.5,
  directionRepetitionPenalty: 0.72,
};

type PacingDirectorDependencies = {
  getState: () => PacingState;
  onDecision: (decision: PacingDecision) => boolean;
  config?: Partial<PacingDirectorConfig>;
  debug?: boolean;
};

const reasonPriority: Record<PacingReason, number> = {
  POST_EVOLUTION: 4,
  NEAR_LEVEL_UP: 3,
  DEAD_MOMENT: 2,
  EXPLORATION_STALL: 1,
};

export function createPacingDirector(deps: PacingDirectorDependencies) {
  const config = { ...DEFAULT_PACING_DIRECTOR_CONFIG, ...deps.config };
  let evaluationElapsed = config.evaluationInterval;
  let now = 0;
  let activeOpportunity: (PacingDecision & { expiresAt: number }) | null = null;
  let pendingReasons = new Set<PacingReason>();
  let recentOpportunities: OpportunityType[] = [];
  let lastState: PacingState | null = null;
  let lastDecision: PacingDecision | null = null;
  let noOpportunityElapsed = 0;
  let surpriseReadiness = 0;
  let timeSinceSurprise = Number.POSITIVE_INFINITY;
  let recoveryRemaining = 0;
  let highIntensityCooldownRemaining = 0;
  let guaranteedCount = 0;
  let surpriseCount = 0;
  let highIntensityEvents = 0;
  let longestDryPeriod = 0;
  let rewardHistory: RecentReward[] = [];
  let lastCandidateScores: Array<{ candidate: OpportunityType; finalWeight: number }> = [];
  let deliveryRetryRemaining = 0;

  function log(message: string, details?: unknown) {
    if (!deps.debug) return;
    console.debug(`[PacingDirector] ${message}`, details ?? "");
  }

  function targetRegion(state: PacingState) {
    if (state.currentRegion === "Nest") return "Exploration";
    if (state.currentRegion === "Exploration") return "EnemyTerritory";
    if (state.currentRegion === "EnemyTerritory") return "GoldMine";
    return state.highestRegionDiscovered;
  }

  function hasRecent(type: OpportunityType) {
    return recentOpportunities.includes(type);
  }

  function categoryOf(type: OpportunityType): RewardCategory {
    if (type === "Fugitive" || type === "GoldMine") return "EVENT";
    if (type === "SpecialEgg" || type === "Speed" || type === "Range" || type === "Orbit" || type === "Magnet") return "POWER_UP";
    if (type === "EggBreadcrumb" || type === "EggCluster" || type === "ExplorationBreadcrumb") return "RESOURCE";
    return "PROGRESSION";
  }

  function intensityOf(type: OpportunityType): RewardIntensity {
    if (type === "Fugitive" || type === "GoldMine") return "HIGH";
    if (type === "SpecialEgg" || type === "Speed" || type === "Range" || type === "Orbit" || type === "Magnet" || type === "EggCluster") return "MEDIUM";
    return "LOW";
  }

  function intensityValue(intensity: RewardIntensity) {
    return intensity === "HIGH" ? 1 : intensity === "MEDIUM" ? 0.55 : 0.2;
  }

  function rememberReward(decision: PacingDecision, channel: RewardChannel) {
    const type = decision.specialEggType ?? decision.type;
    const entry: RecentReward = {
      type,
      category: decision.category ?? categoryOf(type),
      channel,
      intensity: decision.intensity ?? intensityOf(type),
      timestamp: now,
    };
    rewardHistory = [entry, ...rewardHistory].slice(0, config.rewardHistorySize ?? 8);
    recentOpportunities = [type, ...recentOpportunities].slice(0, config.noveltyHistorySize);
    if (channel === "SURPRISE") {
      surpriseCount += 1;
      surpriseReadiness = Math.max(0, surpriseReadiness - 0.82);
      timeSinceSurprise = 0;
      if (entry.intensity === "HIGH") {
        highIntensityEvents += 1;
        recoveryRemaining = config.surpriseRecoveryDuration ?? 8;
        highIntensityCooldownRemaining = config.highIntensityCooldown ?? 12;
      }
    } else {
      guaranteedCount += 1;
    }
  }

  function repetitionScore(type: OpportunityType) {
    const category = categoryOf(type);
    let score = 1;
    for (let i = 0; i < rewardHistory.length; i += 1) {
      const reward = rewardHistory[i];
      if (reward.type === type) score *= config.typeRepetitionPenalty ?? 0.5;
      else if (reward.category === category) score *= config.categoryRepetitionPenalty ?? 0.58;
      if (i >= 3) break;
    }
    return Math.max(0.08, score);
  }

  function weightedPick(items: OpportunityType[], weights: number[]) {
    const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
    if (total <= 0 || items.length === 0) return undefined;
    let cursor = Math.random() * total;
    for (let i = 0; i < items.length; i += 1) {
      cursor -= Math.max(0, weights[i]);
      if (cursor <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  function chooseAvailable(types: OpportunityType[], state: PacingState, surprise = false) {
    const eligible = types.filter((type) => {
      if (type === "Fugitive") return state.sessionPhase !== "OPENING" && state.depositedProgress > 0 && state.nearbyEnemyCount === 0;
      if (type === "SpecialEgg") return state.sessionPhase !== "OPENING" || state.firstPowerUpDelivered === true;
      if (type === "Orbit") return !state.activePowerUps.includes("Orbit") && state.carriedEggs >= 6;
      if (type === "Magnet") return !state.activePowerUps.includes("Magnet") && state.nearbyEggCount >= 3;
      if (type === "Range") return !state.activePowerUps.includes("Range");
      if (type === "Speed") return !state.activePowerUps.includes("Speed");
      return true;
    });
    if (eligible.length === 0) return types[0];
    const weights = eligible.map((type) => {
      const intensity = intensityValue(intensityOf(type));
      let context = 1;
      if (type === "Magnet") context += Math.min(1.2, state.nearbyEggCount * 0.12 + state.visibleEggCount * 0.08);
      if (type === "Orbit") context += Math.min(0.9, state.carriedEggs * 0.045 + state.nearbyEnemyCount * 0.2);
      if (type === "Speed" && state.currentRegion === "EnemyTerritory") context += 0.22;
      if (type === "Range") context += state.visibleEggCount >= 3 ? 0.3 : 0;
      const recoveryPenalty = recoveryRemaining > 0 && intensity > 0.55 ? 0.18 : 1;
      return context * repetitionScore(type) * recoveryPenalty * (surprise ? 1 + intensity * surpriseReadiness : 1);
    });
    lastCandidateScores = eligible.map((candidate, index) => ({
      candidate,
      finalWeight: Number(weights[index].toFixed(3)),
    }));
    if (surprise) log("Candidates", lastCandidateScores);
    return weightedPick(eligible, weights) ?? eligible[0];
  }

  function decide(reason: PacingReason, state: PacingState): PacingDecision {
    const target = targetRegion(state);
    const guaranteed = (type: OpportunityType): PacingDecision => ({
      type,
      reason,
      targetRegion: target,
      channel: "GUARANTEED",
      category: categoryOf(type),
      intensity: intensityOf(type),
    });
    const surprise = (type: OpportunityType, specialEggType?: PacingDecision["specialEggType"]): PacingDecision => ({
      type,
      reason,
      targetRegion: target,
      channel: "SURPRISE",
      category: categoryOf(specialEggType ?? type),
      intensity: intensityOf(specialEggType ?? type),
      ...(specialEggType ? { specialEggType } : {}),
    });
    if (state.goldMineActive) {
      return guaranteed("UseExistingOpportunity");
    }
    if (state.activeOpportunity || state.evolving || state.tutorialActive) {
      return guaranteed("UseExistingOpportunity");
    }
    if (
      state.carriedEggs >= config.heavyStackThreshold &&
      state.playerIntent === "RETURNING_HOME"
    ) {
      return guaranteed("UseExistingOpportunity");
    }
    if (reason === "NEAR_LEVEL_UP") {
      if (state.remainingToLevel <= 0 || state.carriedEggs >= state.remainingToLevel) {
        return guaranteed("UseExistingOpportunity");
      }
      if (state.nearbyEggCount >= state.remainingToLevel || state.visibleEggCount > 0) {
        return guaranteed("UseExistingOpportunity");
      }
      return guaranteed(state.nearbyEggCount > 0 ? "EggBreadcrumb" : "EggCluster");
    }
    if (reason === "POST_EVOLUTION") {
      if (state.nearbyEggCount >= 3 || state.visibleEggCount > 0) {
        return guaranteed("UseExistingOpportunity");
      }
      const type = state.currentRegion === "Nest"
        ? "ExplorationBreadcrumb"
        : chooseAvailable(["EggBreadcrumb", "EggCluster", "ExplorationBreadcrumb"], state);
      return guaranteed(type);
    }
    const surpriseReady =
      timeSinceSurprise >= (config.surpriseMinDelay ?? 8) &&
      surpriseReadiness > 0.2 &&
      recoveryRemaining <= 0 &&
      highIntensityCooldownRemaining <= 0 &&
      state.playerIntent === "EXPLORING" &&
      state.nearbyEnemyCount === 0 &&
      !state.activeOpportunity &&
      state.visibleEnemyCount === 0;
    if ((reason === "DEAD_MOMENT" || reason === "EXPLORATION_STALL") && surpriseReady) {
      const surpriseType = chooseAvailable(
        ["Fugitive", "SpecialEgg", "EggCluster", "ExplorationBreadcrumb"],
        state,
        true,
      );
      if (surpriseType === "Fugitive") return surprise("Fugitive");
      if (surpriseType === "SpecialEgg") {
        const special = chooseAvailable(["Magnet", "Orbit", "Range", "Speed"], state, true);
        return surprise("SpecialEgg", special as PacingDecision["specialEggType"]);
      }
      return surprise(surpriseType);
    }
    if (reason === "EXPLORATION_STALL" && (state.playerIntent === "RETURNING_HOME" || state.carriedEggs > 0)) {
      return guaranteed("UseExistingOpportunity");
    }
    if (
      state.activityScore > config.lowActivityThreshold ||
      state.nearbyEnemyCount > 0 ||
      state.relevantOpportunityVisible
    ) {
      return guaranteed("UseExistingOpportunity");
    }
    return guaranteed(chooseAvailable(["EggBreadcrumb", "EggCluster", "ExplorationBreadcrumb"], state));
  }

  function evaluate(reason: PacingReason) {
    const state = deps.getState();
    lastState = state;
    if (activeOpportunity && now >= activeOpportunity.expiresAt) {
      log("Opportunity expired", activeOpportunity);
      activeOpportunity = null;
    }
    if (activeOpportunity || state.activeOpportunity) {
      log("DO NOTHING: active opportunity", state);
      return;
    }
    const decision = decide(reason, state);
    lastDecision = decision;
    pendingReasons.delete(reason);
    if (decision.type === "UseExistingOpportunity") {
      log("DO NOTHING", { reason, state });
      return;
    }
    log("Selected opportunity", decision);
    const delivered = deps.onDecision(decision);
    if (!delivered) {
      deliveryRetryRemaining = 0.9;
      log("FAILED_TEMPORARY", { decision, budgetPreserved: true });
      return;
    }
    activeOpportunity = { ...decision, expiresAt: now + config.opportunityTimeout };
    rememberReward(decision, decision.channel ?? "GUARANTEED");
    log("DELIVERED", decision);
  }

  function request(reason: PacingReason) {
    if (reason === "POST_EVOLUTION") activeOpportunity = null;
    pendingReasons.add(reason);
    if (reason === "POST_EVOLUTION") evaluate(reason);
  }

  function update(dt: number) {
    now += dt;
    deliveryRetryRemaining = Math.max(0, deliveryRetryRemaining - dt);
    timeSinceSurprise += dt;
    recoveryRemaining = Math.max(0, recoveryRemaining - dt);
    highIntensityCooldownRemaining = Math.max(0, highIntensityCooldownRemaining - dt);
    if (timeSinceSurprise >= (config.surpriseMinDelay ?? 8)) {
      surpriseReadiness = Math.min(
        1,
        surpriseReadiness + dt * (config.surpriseReadinessRate ?? 0.075) *
          (recoveryRemaining > 0 ? 0.2 : 1),
      );
    }
    if (timeSinceSurprise >= (config.surpriseMaxDryTime ?? 25)) {
      surpriseReadiness = Math.max(surpriseReadiness, 0.92);
    }
    longestDryPeriod = Math.max(longestDryPeriod, timeSinceSurprise);
    evaluationElapsed += dt;
    if (evaluationElapsed < config.evaluationInterval) return;
    evaluationElapsed = 0;
    if (deliveryRetryRemaining > 0) return;
    const state = deps.getState();
    lastState = state;
    if (pendingReasons.size > 0) {
      const reason = [...pendingReasons].sort((a, b) => reasonPriority[b] - reasonPriority[a])[0];
      evaluate(reason);
      return;
    }
    if (state.relevantOpportunityVisible || state.playerIntent === "DEPOSITING") {
      noOpportunityElapsed = 0;
    } else {
      noOpportunityElapsed += config.evaluationInterval;
    }
    if (noOpportunityElapsed >= (config.noOpportunityThreshold ?? config.deadMomentSeconds)) {
      request("DEAD_MOMENT");
    } else if (
      state.currentRegion === "Nest" &&
      state.timeSinceLastEvolution >= config.explorationStallSeconds &&
      state.timeSinceLastEggPickup >= config.explorationStallSeconds
    ) {
      request("EXPLORATION_STALL");
    }
  }

  function getDebugState() {
    return {
      state: lastState,
      activeOpportunity,
      lastDecision,
      recentOpportunities,
      noOpportunityElapsed,
      currentChannel: surpriseReadiness > 0.2 && recoveryRemaining <= 0 ? "SURPRISE" : "GUARANTEED",
      busyness: lastState
        ? lastState.activityScore > 1.8 || lastState.goldMineActive || lastState.evolving
          ? "HIGH"
          : lastState.activityScore > 0.7 || lastState.carriedEggs > 0
            ? "MEDIUM"
            : "LOW"
        : "LOW",
      surpriseReadiness,
      timeSinceSurprise,
      recoveryActive: recoveryRemaining > 0,
      recoveryRemaining,
      recentRewards: rewardHistory,
      guaranteedCount,
      surpriseCount,
      highIntensityEvents,
      longestDryPeriod,
      highIntensityCooldownRemaining,
      candidateScores: lastCandidateScores,
    };
  }

  return {
    request,
    update,
    getDebugState,
    recordReward: (type: OpportunityType, channel: RewardChannel, intensity: RewardIntensity = intensityOf(type)) => {
      rememberReward({ type, reason: "DEAD_MOMENT", targetRegion: "-", intensity, category: categoryOf(type) }, channel);
    },
    canStartHighIntensity: () => recoveryRemaining <= 0 && highIntensityCooldownRemaining <= 0,
  };
}
