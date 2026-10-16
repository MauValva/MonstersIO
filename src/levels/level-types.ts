import { Container } from "pixi.js";
import type { SceneContext } from "../game/scene-context";
import type { WorldLevelDesignConfig } from "./world-level-design";
import type { SceneRuntime } from "./scene-runtime";
import type { SceneAssetManifest } from "../assets/scene-asset-types";

export type LevelId = "grass-world" | "water-world";

export type Level = {
  id: LevelId;
  root: Container;
  design: WorldLevelDesignConfig;
  assetManifest: SceneAssetManifest;
  /** Dependency boundary for the scene; gameplay systems remain in main for now. */
  context?: SceneContext;
  /** Runtime lifecycle is attached after shared gameplay services are built. */
  runtime?: SceneRuntime;
  /** Optional now because current scenes are synchronously constructed. */
  load?(): void;
  enter(): void;
  exit(): void;
  update(dt: number): void;
  pause?(): void;
  resume?(): void;
  /** Releases scene-owned resources; does not stop the shared game loop. */
  dispose?(): void;
  /** Legacy cleanup name kept while callers migrate to dispose(). */
  destroy(): void;
};
