import type { LevelId } from "../levels/level-types";

/**
 * Persistent upgrades belong to the match/campaign, not to an individual
 * scene. The open index keeps this contract forward-compatible with new
 * upgrade types without moving the current player-system state yet.
 */
export type PersistentUpgrades = {
  [upgradeId: string]: number | undefined;
};

export type CampaignSessionState = {
  activeWorld: LevelId | null;
  completedWorlds: Set<LevelId>;
  data: Record<string, unknown>;
};

/** Shared state contract for the current match. */
export type GameSession = {
  coins: number;
  upgrades: PersistentUpgrades;
  campaign: CampaignSessionState;
};

export function createGameSession(
  initial: Partial<GameSession> = {},
): GameSession {
  return {
    coins: initial.coins ?? 0,
    upgrades: initial.upgrades ?? {},
    campaign: {
      activeWorld: initial.campaign?.activeWorld ?? null,
      completedWorlds: new Set(initial.campaign?.completedWorlds ?? []),
      data: initial.campaign?.data ?? {},
    },
  };
}
