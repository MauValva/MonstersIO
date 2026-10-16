import type { GameSession } from "../game/game-session";
import type { LevelId } from "../levels/level-types";

export type CampaignConfig = {
  worldOrder: readonly string[];
};

export class CampaignManager {
  private readonly worldOrder: readonly LevelId[];

  constructor(
    private readonly session: GameSession,
    config: CampaignConfig,
    registeredWorldIds: readonly LevelId[],
  ) {
    this.worldOrder = validateCampaignConfig(config, registeredWorldIds);
    if (this.session.campaign.activeWorld === null) {
      this.session.campaign.activeWorld = this.worldOrder[0];
    }
  }

  getInitialWorldId(): LevelId {
    return this.worldOrder[0];
  }

  getCurrentWorldId(): LevelId {
    return this.session.campaign.activeWorld ?? this.getInitialWorldId();
  }

  /** Returns the next registered campaign world, wrapping at the end. */
  getNextWorldId(): LevelId | null {
    const currentIndex = this.worldOrder.indexOf(this.getCurrentWorldId());
    if (currentIndex < 0 || this.worldOrder.length === 0) {
      return null;
    }
    return this.worldOrder[(currentIndex + 1) % this.worldOrder.length];
  }

  completeCurrentWorld(): void {
    this.session.campaign.completedWorlds.add(this.getCurrentWorldId());
  }

  isWorldCompleted(id: LevelId): boolean {
    return this.session.campaign.completedWorlds.has(id);
  }

  isCampaignCompleted(): boolean {
    return this.worldOrder.every((id) => this.isWorldCompleted(id));
  }
}

function validateCampaignConfig(
  config: CampaignConfig,
  registeredWorldIds: readonly LevelId[],
): readonly LevelId[] {
  if (config.worldOrder.length === 0) {
    throw new Error("Campaign must contain at least one world");
  }

  const registered = new Set<string>(registeredWorldIds);
  const seen = new Set<string>();
  for (const id of config.worldOrder) {
    if (!registered.has(id)) {
      throw new Error(`Campaign references unknown world: ${id}`);
    }
    if (seen.has(id)) {
      throw new Error(`Campaign contains duplicate world: ${id}`);
    }
    seen.add(id);
  }

  return [...config.worldOrder] as LevelId[];
}
