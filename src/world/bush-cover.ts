import type { Point } from "../game/types";
import type { Bush } from "./world-scene";
import type { Container } from "pixi.js";

export type BushCoverSystem = {
  getCover: (point: Point) => number;
  getNearestBush: (point: Point) => Bush;
  setHideFeedback: (point: Point, hidden: boolean) => void;
  refreshVisualScale: (scale: number) => void;
};

export function createBushCoverSystem(
  obstacles: Container,
  bushes: Bush[],
): BushCoverSystem {
  const getCover = (point: Point) =>
    bushes.reduce((maxCover, bush) => {
      const bushCenterY = bush.y - bush.height * 0.44;
      const normalizedX = (point.x - bush.x) / (bush.width * 0.5);
      const normalizedY = (point.y - bushCenterY) / (bush.height * 0.5);
      return Math.max(maxCover, Math.max(0, 1 - Math.hypot(normalizedX, normalizedY)));
    }, 0);

  const getNearestBush = (point: Point) =>
    bushes.reduce(
      (closest, candidate) =>
        Math.hypot(
          point.x - candidate.x,
          point.y - (candidate.y - candidate.height * 0.44),
        ) <
        Math.hypot(
          point.x - closest.x,
          point.y - (closest.y - closest.height * 0.44),
        )
          ? candidate
          : closest,
      bushes[0],
    );

  const setHideFeedback = (point: Point, hidden: boolean) => {
    let hidingBush: Bush | null = null;
    if (hidden) {
      hidingBush = bushes.reduce(
        (best, bush) => {
          const bushCenterY = bush.y - bush.height * 0.44;
          const cover = Math.max(
            0,
            1 -
              Math.hypot(
                (point.x - bush.x) / (bush.width * 0.5),
                (point.y - bushCenterY) / (bush.height * 0.5),
              ),
          );
          if (!best) return cover >= 0.5 ? bush : null;
          const bestCenterY = best.y - best.height * 0.44;
          const bestCover = Math.max(
            0,
            1 -
              Math.hypot(
                (point.x - best.x) / (best.width * 0.5),
                (point.y - bestCenterY) / (best.height * 0.5),
              ),
          );
          return cover > bestCover ? bush : best;
        },
        null as Bush | null,
      );
    }
    for (const bush of bushes) bush.sprite.alpha = hidingBush === bush ? 0.42 : 1;
  };

  const refreshVisualScale = (scale: number) => {
    const bushScale = Math.min(1.18, 1 + (scale - 1) * 0.2);
    for (const bush of bushes) {
      bush.sprite.width = bush.width * bushScale;
      bush.sprite.height = bush.height * bushScale;
      bush.sprite.scale.x = bush.flipX * Math.abs(bush.sprite.scale.x);
    }
  };

  return { getCover, getNearestBush, setHideFeedback, refreshVisualScale };
}
