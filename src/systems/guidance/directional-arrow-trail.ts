import { Container, Sprite, Texture } from "pixi.js";

export type GuidanceState = {
  visible: boolean;
  target: { x: number; y: number } | null;
  type: string | null;
};

export const DIRECTIONAL_ARROW_TRAIL = {
  START_OFFSET: 82,
  SPACING: 66,
  MIN_DISTANCE: 118,
  MAX_ARROWS: 6,
  TARGET_END_MARGIN: 82,
  PULSE_SPEED: 1.0,
  BASE_ALPHA: 0.52,
  ARROW_SCALE: 0.3,
  PULSE_SCALE: 1.08,
  FADE_IN: 0.18,
  FADE_OUT: 0.14,
  POSITION_SMOOTHING: 18,
  ROTATION_SMOOTHING: 20,
} as const;

const ARROW_COUNTS = [
  { distance: 250, count: 2 },
  { distance: 400, count: 3 },
  { distance: 600, count: 4 },
  { distance: 850, count: 5 },
] as const;

export class DirectionalArrowTrail {
  readonly container = new Container();

  private readonly arrows: Sprite[] = [];
  private elapsed = 0;
  private visualAlpha = 0;
  private lastTargetX = Number.NaN;
  private lastTargetY = Number.NaN;
  private lastTargetType: string | null = null;
  private angle = 0;

  constructor(texture: Texture) {
    this.container.eventMode = "none";
    for (let index = 0; index < DIRECTIONAL_ARROW_TRAIL.MAX_ARROWS; index += 1) {
      const arrow = new Sprite(texture);
      arrow.anchor.set(0.5);
      arrow.visible = false;
      arrow.alpha = 0;
      this.container.addChild(arrow);
      this.arrows.push(arrow);
    }
  }

  update(
    state: GuidanceState,
    playerX: number,
    playerY: number,
    dt: number,
  ) {
    this.elapsed += dt;
    const target = state.visible ? state.target : null;
    if (!target) {
      this.hide(dt);
      return;
    }

    const dx = target.x - playerX;
    const dy = target.y - playerY;
    const distance = Math.hypot(dx, dy);
    if (distance < DIRECTIONAL_ARROW_TRAIL.MIN_DISTANCE) {
      this.hide(dt);
      return;
    }

    if (
      target.x !== this.lastTargetX ||
      target.y !== this.lastTargetY ||
      state.type !== this.lastTargetType
    ) {
      this.visualAlpha = Math.min(this.visualAlpha, 0.12);
      this.lastTargetX = target.x;
      this.lastTargetY = target.y;
      this.lastTargetType = state.type;
    }
    this.visualAlpha = Math.min(
      1,
      this.visualAlpha + dt / DIRECTIONAL_ARROW_TRAIL.FADE_IN,
    );

    const desiredAngle = Math.atan2(dy, dx);
    this.angle = this.approachAngle(
      this.angle,
      desiredAngle,
      Math.min(1, dt * DIRECTIONAL_ARROW_TRAIL.ROTATION_SMOOTHING),
    );

    let count = this.getArrowCount(distance);
    const lastAllowedDistance = distance - DIRECTIONAL_ARROW_TRAIL.TARGET_END_MARGIN;
    while (
      count > 0 &&
      DIRECTIONAL_ARROW_TRAIL.START_OFFSET + (count - 1) * DIRECTIONAL_ARROW_TRAIL.SPACING >
        lastAllowedDistance
    ) {
      count -= 1;
    }

    const directionX = dx / distance;
    const directionY = dy / distance;
    const pulseProgress =
      (this.elapsed / DIRECTIONAL_ARROW_TRAIL.PULSE_SPEED) % 1;
    for (let index = 0; index < this.arrows.length; index += 1) {
      const arrow = this.arrows[index];
      if (index >= count) {
        arrow.visible = false;
        continue;
      }
      const distanceAlong =
        DIRECTIONAL_ARROW_TRAIL.START_OFFSET +
        index * DIRECTIONAL_ARROW_TRAIL.SPACING;
      const desiredX = playerX + directionX * distanceAlong;
      const desiredY = playerY + directionY * distanceAlong;
      const smoothing = Math.min(
        1,
        dt * DIRECTIONAL_ARROW_TRAIL.POSITION_SMOOTHING,
      );
      arrow.position.set(
        arrow.visible
          ? arrow.x + (desiredX - arrow.x) * smoothing
          : desiredX,
        arrow.visible
          ? arrow.y + (desiredY - arrow.y) * smoothing
          : desiredY,
      );
      arrow.rotation = this.angle;
      const wavePosition = (pulseProgress * count - index + count) % count;
      const pulse = Math.sin(Math.min(1, wavePosition) * Math.PI);
      arrow.alpha =
        this.visualAlpha *
        (DIRECTIONAL_ARROW_TRAIL.BASE_ALPHA + pulse * (1 - DIRECTIONAL_ARROW_TRAIL.BASE_ALPHA));
      arrow.scale.set(
        DIRECTIONAL_ARROW_TRAIL.ARROW_SCALE *
          (1 + pulse * (DIRECTIONAL_ARROW_TRAIL.PULSE_SCALE - 1)),
      );
      arrow.visible = true;
    }
  }

  /** Immediately invalidates a target when its Scene exits. */
  clear() {
    this.visualAlpha = 0;
    this.lastTargetX = Number.NaN;
    this.lastTargetY = Number.NaN;
    this.lastTargetType = null;
    for (const arrow of this.arrows) {
      arrow.visible = false;
      arrow.alpha = 0;
    }
  }

  private getArrowCount(distance: number) {
    if (distance < DIRECTIONAL_ARROW_TRAIL.MIN_DISTANCE) return 0;
    for (const threshold of ARROW_COUNTS) {
      if (distance < threshold.distance) return threshold.count;
    }
    return DIRECTIONAL_ARROW_TRAIL.MAX_ARROWS;
  }

  private hide(dt: number) {
    this.visualAlpha = Math.max(
      0,
      this.visualAlpha - dt / DIRECTIONAL_ARROW_TRAIL.FADE_OUT,
    );
    for (const arrow of this.arrows) {
      arrow.alpha = this.visualAlpha * DIRECTIONAL_ARROW_TRAIL.BASE_ALPHA;
      arrow.visible = this.visualAlpha > 0.001;
    }
  }

  private approachAngle(current: number, target: number, amount: number) {
    let delta = target - current;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    return current + delta * amount;
  }
}
