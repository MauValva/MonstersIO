import { Container, Graphics, Sprite, Text, TextStyle, Texture } from "pixi.js";
import {
  FUGITIVE_EGG_CONFIG,
  FUGITIVE_RAINBOW_COLORS,
  PLAYABLE_BOUNDS,
} from "../../config/game-config";
import type { Point } from "../../game/types";

export type FugitiveState =
  | "DORMANT"
  | "ALERT"
  | "CHASE"
  | "NEAR_CAPTURE"
  | "CAPTURE"
  | "ESCAPED";

export type FugitiveEventSnapshot = {
  state: FugitiveState;
  position: Point;
  distanceToPlayer: number;
  chaseElapsed: number;
  closestDistance: number;
};

export function createFugitiveEggSystem(deps: {
  layer: Container;
  texture: Texture;
  getPlayerPosition: () => Point;
  getPlayerSpeed: () => number;
  onCapture: (position: Point) => void;
  onEscape: (position: Point) => void;
  debug?: boolean;
}) {
  let event: {
    container: Container;
    egg: Sprite;
    alertText: Text;
    state: FugitiveState;
    elapsed: number;
    chaseElapsed: number;
    abandonElapsed: number;
    closestDistance: number;
    direction: Point;
    phase: number;
    trailElapsed: number;
  } | null = null;
  type TrailParticle = {
    sprite: Graphics;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
  };
  const trailParticles: TrailParticle[] = [];

  function clearTrailParticles() {
    for (const particle of trailParticles) particle.sprite.destroy();
    trailParticles.length = 0;
  }

  function setState(next: FugitiveState) {
    if (!event || event.state === next) return;
    event.state = next;
    if (deps.debug) console.debug("[FUGITIVE] State", next);
  }

  function spawn(position: Point) {
    clear();
    const container = new Container();
    container.position.set(
      Math.max(PLAYABLE_BOUNDS.left + 80, Math.min(PLAYABLE_BOUNDS.right - 80, position.x)),
      Math.max(PLAYABLE_BOUNDS.top + 80, Math.min(PLAYABLE_BOUNDS.bottom - 80, position.y)),
    );
    const glow = new Graphics().circle(0, 0, 12).fill({ color: 0xff78c8, alpha: 0.1 });
    const egg = new Sprite(deps.texture);
    egg.anchor.set(0.5);
    egg.width = 24;
    egg.height = 24;
    const alertText = new Text({
      text: "?",
      style: new TextStyle({ fontFamily: "Arial", fontSize: 36, fontWeight: "900", fill: 0xffffff }),
    });
    alertText.anchor.set(0.5);
    alertText.position.set(0, -32);
    alertText.visible = false;
    container.addChild(glow, egg, alertText);
    deps.layer.addChild(container);
    event = {
      container,
      egg,
      alertText,
      state: "DORMANT",
      elapsed: 0,
      chaseElapsed: 0,
      abandonElapsed: 0,
      closestDistance: Infinity,
      direction: { x: 0, y: -1 },
      phase: Math.random() * Math.PI * 2,
      trailElapsed: 0,
    };
    if (deps.debug) console.debug("[FUGITIVE] Spawned", { position });
    return container;
  }

  function finish(next: "CAPTURE" | "ESCAPED") {
    if (!event) return;
    const position = { x: event.container.x, y: event.container.y };
    setState(next);
    if (next === "CAPTURE") deps.onCapture(position);
    else deps.onEscape(position);
    clearTrailParticles();
    event.container.destroy({ children: true });
    event = null;
  }

  function update(dt: number, time: number) {
    for (let i = trailParticles.length - 1; i >= 0; i -= 1) {
      const particle = trailParticles[i];
      particle.life -= dt;
      particle.sprite.x += particle.vx * dt;
      particle.sprite.y += particle.vy * dt;
      particle.sprite.alpha = Math.max(0, particle.life / particle.maxLife);
      particle.sprite.scale.set(0.65 + (particle.life / particle.maxLife) * 0.45);
      if (particle.life <= 0) {
        particle.sprite.destroy();
        trailParticles.splice(i, 1);
      }
    }
    if (!event) return;
    event.elapsed += dt;
    const player = deps.getPlayerPosition();
    const dx = player.x - event.container.x;
    const dy = player.y - event.container.y;
    const distance = Math.hypot(dx, dy);
    event.closestDistance = Math.min(event.closestDistance, distance);
    event.container.rotation = Math.sin(time * 2.4 + event.phase) * 0.06;
    event.egg.scale.set(1 + Math.sin(time * 8 + event.phase) * (event.state === "NEAR_CAPTURE" ? 0.1 : 0.045));
    event.alertText.visible = event.state === "ALERT" || event.state === "NEAR_CAPTURE";
    event.alertText.text = event.state === "NEAR_CAPTURE" ? "!" : "?";

    // Contact is valid as soon as the player reaches the Fugitive. The alert
    // pause must never make a direct touch feel non-responsive.
    if (distance <= FUGITIVE_EGG_CONFIG.captureRadius) {
      finish("CAPTURE");
      return;
    }

    if (event.state === "DORMANT") {
      event.container.y += Math.sin(time * 3 + event.phase) * dt * 5;
      if (distance <= FUGITIVE_EGG_CONFIG.alertRadius) {
        setState("ALERT");
        event.elapsed = 0;
      }
      return;
    }
    if (event.state === "ALERT") {
      event.container.y -= dt * 18;
      if (event.elapsed >= FUGITIVE_EGG_CONFIG.alertDelay) {
        setState("CHASE");
        event.elapsed = 0;
      }
      return;
    }
    if (event.state !== "CHASE" && event.state !== "NEAR_CAPTURE") return;
    event.chaseElapsed += dt;
    event.trailElapsed += dt;
    if (event.trailElapsed >= FUGITIVE_EGG_CONFIG.trailInterval) {
      event.trailElapsed = 0;
      const color = FUGITIVE_RAINBOW_COLORS[
        Math.floor(event.chaseElapsed / FUGITIVE_EGG_CONFIG.trailInterval) % FUGITIVE_RAINBOW_COLORS.length
      ];
      const particle = new Graphics()
        .circle(0, 0, 7.5 + Math.random() * 4.5)
        .fill({ color, alpha: 0.96 });
      particle.position.set(event.container.x, event.container.y + 4);
      deps.layer.addChildAt(particle, Math.max(0, deps.layer.children.indexOf(event.container)));
      trailParticles.push({
        sprite: particle,
        vx: -event.direction.x * 38,
        vy: -event.direction.y * 38,
        life: FUGITIVE_EGG_CONFIG.trailLife,
        maxLife: FUGITIVE_EGG_CONFIG.trailLife,
      });
    }
    if (distance <= FUGITIVE_EGG_CONFIG.nearCaptureDistance) setState("NEAR_CAPTURE");
    else setState("CHASE");
    // Temporary test mode: keep the Fugitive active until capture.
    // Re-enable this block when the escape lifecycle is ready to be tested:
    // if (distance > FUGITIVE_EGG_CONFIG.abandonDistance) event.abandonElapsed += dt;
    // else event.abandonElapsed = Math.max(0, event.abandonElapsed - dt * 0.5);
    // if (
    //   event.abandonElapsed >= FUGITIVE_EGG_CONFIG.abandonTime ||
    //   event.chaseElapsed >= FUGITIVE_EGG_CONFIG.maxChaseDuration
    // ) {
    //   finish("ESCAPED");
    //   return;
    // }

    const length = distance || 1;
    const awayX = -dx / length;
    const awayY = -dy / length;
    const forwardX = 0;
    const forwardY = -1;
    const edgeX = event.container.x < PLAYABLE_BOUNDS.left + 180 ? 1 : event.container.x > PLAYABLE_BOUNDS.right - 180 ? -1 : 0;
    const edgeY = event.container.y < PLAYABLE_BOUNDS.top + 180 ? 1 : event.container.y > PLAYABLE_BOUNDS.bottom - 180 ? -1 : 0;
    const variation = Math.sin(event.chaseElapsed * 3 + event.phase) * FUGITIVE_EGG_CONFIG.directionVariation;
    const desiredX = awayX * FUGITIVE_EGG_CONFIG.awayBias + forwardX * FUGITIVE_EGG_CONFIG.upwardBias + edgeX + (-awayY) * variation;
    const desiredY = awayY * FUGITIVE_EGG_CONFIG.awayBias + forwardY * FUGITIVE_EGG_CONFIG.upwardBias + edgeY + awayX * variation;
    const desiredLength = Math.hypot(desiredX, desiredY) || 1;
    const targetX = desiredX / desiredLength;
    const targetY = desiredY / desiredLength;
    const steer = Math.min(1, dt * FUGITIVE_EGG_CONFIG.steeringStrength);
    event.direction.x += (targetX - event.direction.x) * steer;
    event.direction.y += (targetY - event.direction.y) * steer;
    const directionLength = Math.hypot(event.direction.x, event.direction.y) || 1;
    event.direction.x /= directionLength;
    event.direction.y /= directionLength;
    const distanceFactor = Math.max(0, Math.min(1, 1 - distance / FUGITIVE_EGG_CONFIG.idealChaseDistance));
    const speed = FUGITIVE_EGG_CONFIG.baseSpeed * (
      distanceFactor > 0
        ? FUGITIVE_EGG_CONFIG.nearPlayerSpeedMultiplier
        : FUGITIVE_EGG_CONFIG.farPlayerSpeedMultiplier
    );
    const playerSpeed = deps.getPlayerSpeed();
    const cappedSpeed = Math.min(speed, Math.max(180, playerSpeed * 0.92));
    event.container.x = Math.max(PLAYABLE_BOUNDS.left + 45, Math.min(PLAYABLE_BOUNDS.right - 45, event.container.x + event.direction.x * cappedSpeed * dt));
    event.container.y = Math.max(PLAYABLE_BOUNDS.top + 45, Math.min(PLAYABLE_BOUNDS.bottom - 45, event.container.y + event.direction.y * cappedSpeed * dt));
  }

  function clear() {
    clearTrailParticles();
    event?.container.destroy({ children: true });
    event = null;
  }

  function getSnapshot(): FugitiveEventSnapshot | null {
    if (!event) return null;
    const player = deps.getPlayerPosition();
    return {
      state: event.state,
      position: { x: event.container.x, y: event.container.y },
      distanceToPlayer: Math.hypot(player.x - event.container.x, player.y - event.container.y),
      chaseElapsed: event.chaseElapsed,
      closestDistance: event.closestDistance,
    };
  }

  return { spawn, update, clear, getSnapshot, get active() { return event !== null; } };
}
