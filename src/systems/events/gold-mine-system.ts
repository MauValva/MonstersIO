import { Container, Graphics, Sprite, Texture } from "pixi.js";
import { GOLD_MINE_CONFIG } from "../../config/game-config";
import type { Point } from "../../game/types";

export type GoldMineState =
  | "LOCKED"
  | "READY"
  | "ACTIVE"
  | "EXTRACTING"
  | "FINAL_JACKPOT"
  | "DESPAWNING"
  | "EXHAUSTED"
  | "RECHARGING";

export type GoldMinePayout = {
  position: Point;
  waveIndex: number;
  normalEggs: number;
  coinEggs: number;
  final: boolean;
};

export type GoldMineInterest = {
  position: Point;
  strength: number;
  radius: number;
  type: "GOLD_MINE" | "FUGITIVE_JACKPOT";
};

export type GoldMineSnapshot = {
  state: GoldMineState;
  playerInside: boolean;
  waveIndex: number;
  waveCount: number;
  nextPayoutIn: number;
  normalEggsProduced: number;
  coinEggsProduced: number;
  interestStrength: number;
  cooldownRemaining: number;
  activeDuration: number;
  completed: boolean;
  readyToRespawn: boolean;
  position: Point;
};

type GoldMineDeps = {
  layer: Container;
  texture: Texture;
  onPayout: (payout: GoldMinePayout) => void;
  onMetric?: (metric: string, details?: Record<string, unknown>) => void;
};

type BurstParticle = {
  sprite: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  drag: number;
};

export function createGoldMineSystem(deps: GoldMineDeps) {
  const visual = new Container();
  visual.position.set(GOLD_MINE_CONFIG.center.x, GOLD_MINE_CONFIG.center.y);
  visual.label = "gold-mine";

  const glow = new Graphics();
  const rock = new Graphics();
  const goldCore = new Graphics();
  const mineArt = new Sprite(deps.texture);
  const burstFlash = new Graphics();
  const burstRing = new Graphics();
  const burstParticles: BurstParticle[] = [];
  let burstElapsed = 0;
  let burstActive = false;
  mineArt.anchor.set(0.5);
  mineArt.width = 215;
  mineArt.height = 107.5;
  mineArt.position.set(0, 8);
  visual.addChild(glow, rock, goldCore, mineArt);
  rock.visible = false;
  goldCore.visible = false;
  deps.layer.addChild(visual);
  deps.layer.addChild(burstFlash, burstRing);
  burstFlash.visible = false;
  burstRing.visible = false;

  let state: GoldMineState = GOLD_MINE_CONFIG.initiallyLocked ? "LOCKED" : "READY";
  let waveIndex = 0;
  let waveElapsed = 0;
  let cooldownRemaining = 0;
  let activeDuration = 0;
  let normalEggsProduced = 0;
  let coinEggsProduced = 0;
  let completed = false;
  let lastPlayerInside = false;
  let despawnElapsed = 0;
  let readyToRespawn = false;
  visual.visible = state !== "LOCKED";

  function emit(metric: string, details?: Record<string, unknown>) {
    deps.onMetric?.(metric, details);
  }

  function setState(next: GoldMineState) {
    if (state === next) return;
    state = next;
    emit(`GoldMine${next[0]}${next.slice(1).toLowerCase()}`);
  }

  function resetRun() {
    waveIndex = 0;
    waveElapsed = 0;
    activeDuration = 0;
    normalEggsProduced = 0;
    coinEggsProduced = 0;
    completed = false;
    lastPlayerInside = false;
    despawnElapsed = 0;
    readyToRespawn = false;
  }

  function activate() {
    if (state !== "READY") return false;
    resetRun();
    setState("ACTIVE");
    emit("GoldMineActivated");
    return true;
  }

  function finish() {
    completed = true;
    emit("GoldMineCompleted", {
      waveIndex,
      normalEggsProduced,
      coinEggsProduced,
    });
    setState("EXHAUSTED");
    // Completion immediately makes the mine eligible to respawn elsewhere.
    // The player leaving the area must not interrupt a started run.
    cooldownRemaining = 0;
    readyToRespawn = true;
  }

  function beginDespawn() {
    despawnElapsed = 0;
    setState("DESPAWNING");
    emit("GoldMineDespawning");
  }

  function finishDespawn() {
    visual.visible = false;
    finish();
    emit("GoldMineDespawned");
  }

  function payout() {
    const wave = GOLD_MINE_CONFIG.waves[waveIndex];
    if (!wave) return;
    const final = "final" in wave && wave.final === true;
    normalEggsProduced += wave.normalEggs;
    coinEggsProduced += wave.coinEggs;
    emit("GoldMineWave", {
      waveIndex: waveIndex + 1,
      normalEggs: wave.normalEggs,
      coinEggs: wave.coinEggs,
    });
    deps.onPayout({
      position: { x: visual.x, y: visual.y },
      waveIndex,
      normalEggs: wave.normalEggs,
      coinEggs: wave.coinEggs,
      final,
    });
    if (final) {
      emit("GoldMineFinalJackpot", { waveIndex: waveIndex + 1 });
      startFinalBurst();
      // The final payout is also the mine's PUF moment. Start the normal
      // despawn lifecycle immediately so the visual cannot remain stuck in a
      // transparent final state after the jackpot.
      beginDespawn();
    } else {
      waveIndex += 1;
      setState("ACTIVE");
    }
  }

  function startFinalBurst() {
    burstActive = true;
    burstElapsed = 0;
    burstFlash.position.set(visual.x, visual.y);
    burstRing.position.set(visual.x, visual.y);
    burstFlash.visible = true;
    burstRing.visible = true;
    for (let i = 0; i < 34; i += 1) {
      const angle = (i / 34) * Math.PI * 2 + (i % 2) * 0.08;
      const speed = 95 + (i % 5) * 24 + Math.random() * 35;
      const particle = new Graphics()
        .circle(0, 0, 5 + (i % 4) * 2)
        .fill(i % 3 === 0 ? 0xffffe0 : i % 2 === 0 ? 0xfff0a1 : 0xffc52f);
      particle.position.set(visual.x, visual.y);
      deps.layer.addChild(particle);
      burstParticles.push({
        sprite: particle,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 35,
        life: 0.58 + (i % 4) * 0.08,
        maxLife: 0.58 + (i % 4) * 0.08,
        drag: 0.84 + (i % 3) * 0.025,
      });
    }
  }

  function updateFinalBurst(dt: number) {
    if (!burstActive) return;
    burstElapsed += dt;
    const progress = Math.min(1, burstElapsed / 0.9);
    const eased = 1 - (1 - progress) ** 3;
    burstFlash
      .clear()
      .circle(0, 0, 30 + eased * 125)
      .fill({ color: 0xfff3a0, alpha: Math.max(0, 0.5 * (1 - progress) ** 1.8) });
    burstRing
      .clear()
      .circle(0, 0, 36 + eased * 190)
      .stroke({ color: 0xffd45c, alpha: Math.max(0, 0.85 * (1 - progress)), width: 7 - progress * 4 });
    for (let i = burstParticles.length - 1; i >= 0; i -= 1) {
      const particle = burstParticles[i];
      particle.life -= dt;
      particle.vx *= Math.pow(particle.drag, dt * 60);
      particle.vy = particle.vy * Math.pow(particle.drag, dt * 60) + 95 * dt;
      particle.sprite.x += particle.vx * dt;
      particle.sprite.y += particle.vy * dt;
      particle.sprite.alpha = Math.max(0, particle.life / particle.maxLife);
      particle.sprite.scale.set(0.7 + particle.life / particle.maxLife * 0.7);
      if (particle.life <= 0) {
        particle.sprite.destroy();
        burstParticles.splice(i, 1);
      }
    }
    if (burstElapsed >= 0.9 && burstParticles.length === 0) {
      burstFlash.visible = false;
      burstRing.visible = false;
      burstActive = false;
    }
  }

  function updateVisual(time: number, playerInside: boolean) {
    const wave = GOLD_MINE_CONFIG.waves[Math.min(waveIndex, GOLD_MINE_CONFIG.waves.length - 1)];
    const nextProgress =
      state === "EXTRACTING" && wave
        ? Math.min(1, waveElapsed / wave.at)
        : 0;
    const heat = state === "READY"
      ? 0.22
      : state === "RECHARGING" || state === "EXHAUSTED"
        ? 0.05
        : 0.35 + nextProgress * 0.65;
    const pulse = 1 + Math.sin(time * GOLD_MINE_CONFIG.visual.pulseFrequency) * 0.06;
    const despawnProgress =
      state === "DESPAWNING"
        ? Math.min(1, despawnElapsed / GOLD_MINE_CONFIG.despawnDuration)
        : 0;
    visual.scale.set(
      state === "DESPAWNING"
        ? pulse * (1 - despawnProgress * 0.88)
        : pulse,
    );
    visual.alpha =
      state === "RECHARGING"
        ? 0.48
        : state === "DESPAWNING"
          ? 1 - despawnProgress
          : 1;
    glow.clear()
      .circle(0, 0, GOLD_MINE_CONFIG.visual.baseRadius + heat * 28)
      .fill({ color: 0xffc83d, alpha: 0.07 + heat * 0.14 })
      .circle(0, 0, GOLD_MINE_CONFIG.visual.heatRadius * (0.78 + heat * 0.22))
      .stroke({ color: 0xffe38a, alpha: 0.12 + heat * 0.24, width: 4 });
    rock.clear()
      .ellipse(-38, 20, 54, 30)
      .fill({ color: state === "EXHAUSTED" ? 0x4c4b4a : 0x5e5146, alpha: 0.98 })
      .ellipse(35, 18, 48, 28)
      .fill({ color: state === "EXHAUSTED" ? 0x3d3d3d : 0x705d4b, alpha: 0.98 })
      .ellipse(0, -4, 49, 34)
      .fill({ color: state === "EXHAUSTED" ? 0x555555 : 0x80664e, alpha: 1 });
    goldCore.clear()
      .circle(0, -12, 18 + heat * 8)
      .fill({ color: 0xffc52f, alpha: 0.32 + heat * 0.5 })
      .circle(-14, -18, 7)
      .fill({ color: 0xffffd0, alpha: 0.45 + heat * 0.4 })
      .circle(16, -4, 5)
      .fill({ color: 0xffec73, alpha: 0.45 + heat * 0.4 });
  }

  function update(dt: number, time: number, playerPosition: Point) {
    updateFinalBurst(dt);
    if (state === "LOCKED") {
      updateVisual(time, false);
      visual.visible = false;
      return;
    }
    if (state === "DESPAWNING") {
      despawnElapsed += dt;
      if (despawnElapsed >= GOLD_MINE_CONFIG.despawnDuration) finishDespawn();
      updateVisual(time, false);
      return;
    }
    if (state === "RECHARGING" || state === "EXHAUSTED") {
      // Do not leave a misleading transparent ghost on the map while the
      // mine is cooling down. Respawn restores it at full opacity.
      visual.visible = false;
      cooldownRemaining = Math.max(0, cooldownRemaining - dt);
      if (cooldownRemaining <= 0 && !readyToRespawn) {
        readyToRespawn = true;
        if (state === "EXHAUSTED") setState("RECHARGING");
        emit("GoldMineCooldownReady");
      }
      updateVisual(time, false);
      return;
    }

    const distance = Math.hypot(
      playerPosition.x - visual.x,
      playerPosition.y - visual.y,
    );
    const playerInside = distance <= GOLD_MINE_CONFIG.activeRadius;
    if (state === "READY" && distance <= GOLD_MINE_CONFIG.activationRadius) {
      activate();
    }
    if (state === "ACTIVE" || state === "EXTRACTING") {
      // Proximity only activates the mine. Once started, every wave runs to
      // completion without requiring the player to remain nearby.
      setState("EXTRACTING");
      activeDuration += dt;
      waveElapsed += dt;
      const wave = GOLD_MINE_CONFIG.waves[waveIndex];
      if (wave && waveElapsed >= wave.at) payout();
    }
    lastPlayerInside = playerInside;
    updateVisual(time, playerInside);
  }

  function getInterestTarget(): GoldMineInterest | null {
    if (state !== "ACTIVE" && state !== "EXTRACTING" && state !== "FINAL_JACKPOT") return null;
    const wave = GOLD_MINE_CONFIG.waves[Math.min(waveIndex, GOLD_MINE_CONFIG.waves.length - 1)];
    const progress = wave ? Math.min(1, waveElapsed / wave.at) : 1;
    const waveFactor = Math.min(1, (waveIndex + progress) / GOLD_MINE_CONFIG.waves.length);
    return {
      position: { x: visual.x, y: visual.y },
      strength: 0.25 + waveFactor * 1.15,
      radius: GOLD_MINE_CONFIG.interestRadius,
      type: "GOLD_MINE",
    };
  }

  function getSnapshot(): GoldMineSnapshot {
    const wave = GOLD_MINE_CONFIG.waves[waveIndex];
    return {
      state,
      playerInside: lastPlayerInside,
      waveIndex,
      waveCount: GOLD_MINE_CONFIG.waves.length,
      nextPayoutIn: wave ? Math.max(0, wave.at - waveElapsed) : 0,
      normalEggsProduced,
      coinEggsProduced,
      interestStrength: getInterestTarget()?.strength ?? 0,
      cooldownRemaining,
      activeDuration,
      completed,
      readyToRespawn,
      position: { x: visual.x, y: visual.y },
    };
  }

  function debugAdvance() {
    if (state === "READY") activate();
    if (state === "ACTIVE" || state === "EXTRACTING") {
      waveElapsed = GOLD_MINE_CONFIG.waves[waveIndex]?.at ?? 0;
    }
  }

  function debugActivate() {
    activate();
  }

  function debugFinalJackpot() {
    if (state === "READY") activate();
    waveIndex = GOLD_MINE_CONFIG.waves.length - 1;
    waveElapsed = GOLD_MINE_CONFIG.waves[waveIndex]?.at ?? 0;
  }

  function debugExhaust() {
    setState("EXHAUSTED");
    cooldownRemaining = GOLD_MINE_CONFIG.cooldown;
  }

  function canRespawn() {
    return readyToRespawn &&
      (state === "RECHARGING" || state === "EXHAUSTED") &&
      cooldownRemaining <= 0;
  }

  function unlock() {
    if (state !== "LOCKED") return false;
    state = "RECHARGING";
    cooldownRemaining = 0;
    readyToRespawn = true;
    visual.visible = false;
    emit("GoldMineUnlocked");
    return true;
  }

  function getPosition(): Point {
    return { x: visual.x, y: visual.y };
  }

  function respawn(position: Point) {
    if (!canRespawn()) return false;
    visual.position.set(position.x, position.y);
    visual.visible = true;
    visual.alpha = 1;
    visual.scale.set(1);
    burstFlash.visible = false;
    burstRing.visible = false;
    resetRun();
    setState("READY");
    emit("GoldMineReadyAgain", { position: { ...position } });
    return true;
  }

  function debugReset() {
    for (const particle of burstParticles) particle.sprite.destroy();
    burstParticles.length = 0;
    burstActive = false;
    burstFlash.visible = false;
    burstRing.visible = false;
    cooldownRemaining = 0;
    resetRun();
    visual.visible = true;
    visual.alpha = 1;
    visual.scale.set(1);
    setState("READY");
  }

  function debugPlace(position: Point) {
    debugReset();
    visual.position.set(position.x, position.y);
  }

  return {
    visual,
    update,
    getInterestTarget,
    getSnapshot,
    getPosition,
    unlock,
    canRespawn,
    respawn,
    debugActivate,
    debugAdvance,
    debugFinalJackpot,
    debugExhaust,
    debugReset,
    debugPlace,
  };
}
