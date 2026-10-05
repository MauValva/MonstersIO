import { Container, Graphics } from "pixi.js";
import { STACK_VISUAL_CONFIG, type StackVisualTier } from "../../config/game-config";

export type StackVisualLayout = "TRAIL" | "ORBIT" | "BUSH";

export type StackVisualSnapshot = {
  stackSize: number;
  tier: StackVisualTier;
  nextMilestone: number | null;
  pickupMomentum: number;
  recentPickupRate: number;
  rippleActive: boolean;
  particleIntensity: number;
  layout: StackVisualLayout;
  coinEggsCarried: number;
  potentialCoinValue: number;
};

/** Lightweight visual state layered on top of the existing egg layout systems. */
export function createStackVisualController() {
  let stackSize = 0;
  let previousStackSize = 0;
  let pickupMomentum = 0;
  let recentPickupRate = 0;
  let rippleElapsed: number = STACK_VISUAL_CONFIG.rippleDuration;
  let rippleStrength: number = 0;
  let milestonePulse: number = 0;
  let layout: StackVisualLayout = "TRAIL";

  function getTier(size = stackSize) {
    let tier = STACK_VISUAL_CONFIG.tiers[0];
    for (const candidate of STACK_VISUAL_CONFIG.tiers) {
      if (size >= candidate.min) tier = candidate;
    }
    return tier;
  }

  function getNextMilestone(size = stackSize) {
    return STACK_VISUAL_CONFIG.milestones.find((milestone) => milestone > size) ?? null;
  }

  function update(dt: number, nextStackSize: number, nextLayout: StackVisualLayout) {
    previousStackSize = stackSize;
    stackSize = Math.max(0, nextStackSize);
    layout = nextLayout;
    if (stackSize < previousStackSize) {
      rippleElapsed = 0;
      rippleStrength = Math.max(rippleStrength, STACK_VISUAL_CONFIG.lossRippleStrength);
    }
    pickupMomentum = Math.max(0, pickupMomentum - dt * STACK_VISUAL_CONFIG.momentumDecay);
    recentPickupRate = Math.max(0, recentPickupRate - dt * STACK_VISUAL_CONFIG.recentPickupDecay);
    rippleElapsed += dt;
    milestonePulse = Math.max(0, milestonePulse - dt * STACK_VISUAL_CONFIG.milestoneDecay);
    if (rippleElapsed >= STACK_VISUAL_CONFIG.rippleDuration) rippleStrength = 0;
  }

  function onEggCollected(nextStackSize?: number) {
    if (nextStackSize !== undefined) {
      previousStackSize = stackSize;
      stackSize = Math.max(0, nextStackSize);
    }
    pickupMomentum = Math.min(1, pickupMomentum + STACK_VISUAL_CONFIG.momentumPerPickup);
    recentPickupRate = Math.min(1, recentPickupRate + STACK_VISUAL_CONFIG.recentPickupRatePerPickup);
    rippleElapsed = 0;
    rippleStrength = Math.min(1, Math.max(rippleStrength, 0.72 + pickupMomentum * 0.22));
    const tier = getTier();
    if (STACK_VISUAL_CONFIG.milestones.includes(stackSize)) {
      milestonePulse = Math.max(milestonePulse, tier.milestoneStrength);
    }
  }

  function trailSway(index: number, time: number) {
    if (layout !== "TRAIL") return 0;
    const tier = getTier();
    const cappedIndex = Math.min(index, STACK_VISUAL_CONFIG.maxSwayIndex);
    return Math.sin(time * 5.2 + cappedIndex * 0.82) *
      tier.swayAmplitude * (0.72 + Math.min(0.28, pickupMomentum * 0.28));
  }

  function applyEggVisuals(
    eggs: Container[],
    carriedScale: number,
    time: number,
    isExcluded: (egg: Container) => boolean = () => false,
  ) {
    const tier = getTier();
    const rippleWindow = Math.min(eggs.length, STACK_VISUAL_CONFIG.maxRippleEggs);
    for (let i = 0; i < eggs.length; i += 1) {
      const egg = eggs[i];
      if (isExcluded(egg)) continue;
      const rippleDelay = i * STACK_VISUAL_CONFIG.rippleStep;
      const rippleProgress = (rippleElapsed - rippleDelay) / STACK_VISUAL_CONFIG.rippleDuration;
      const ripple = rippleProgress >= 0 && rippleProgress < 1 && i < rippleWindow
        ? Math.sin(rippleProgress * Math.PI) * rippleStrength * STACK_VISUAL_CONFIG.rippleScale
        : 0;
      const tierPulse = milestonePulse * 0.035 * Math.sin(time * 12 + i * 0.6);
      egg.scale.set(carriedScale * (1 + ripple + tierPulse));
      const glow = egg.children[1];
      if (glow instanceof Graphics && glow.visible) {
        const shimmer = 0.82 + Math.sin(time * 2.4 + i * 1.7) * 0.14;
        glow.alpha = shimmer * (0.86 + tier.particleRate * 0.1);
        glow.scale.set(1 + Math.max(0, shimmer - 0.82) * 0.4);
      }
    }
  }

  function getSnapshot(coinEggsCarried = 0, potentialCoinValue = 0): StackVisualSnapshot {
    const tier = getTier();
    return {
      stackSize,
      tier,
      nextMilestone: getNextMilestone(),
      pickupMomentum,
      recentPickupRate,
      rippleActive: rippleStrength > 0 && rippleElapsed < STACK_VISUAL_CONFIG.rippleDuration,
      particleIntensity: tier.particleRate * (0.35 + pickupMomentum * 0.65),
      layout,
      coinEggsCarried,
      potentialCoinValue,
    };
  }

  return { update, onEggCollected, trailSway, applyEggVisuals, getSnapshot, getTier };
}
