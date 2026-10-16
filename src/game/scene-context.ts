import { Container, Texture } from "pixi.js";
import type { GameSession } from "./game-session";
import type { SceneAssetRegistry } from "../assets/scene-asset-registry";

export type SceneEventMap = Record<string, unknown>;

export type SceneEventBus<Events extends SceneEventMap = SceneEventMap> = {
  on<K extends keyof Events>(
    type: K,
    listener: (payload: Events[K]) => void,
  ): () => void;
  emit<K extends keyof Events>(type: K, payload: Events[K]): void;
};

export function createSceneEventBus<
  Events extends SceneEventMap = SceneEventMap,
>(): SceneEventBus<Events> {
  const listeners = new Map<keyof Events, Set<(payload: unknown) => void>>();

  return {
    on(type, listener) {
      const typeListeners = listeners.get(type) ?? new Set();
      typeListeners.add(listener as (payload: unknown) => void);
      listeners.set(type, typeListeners);
      return () => typeListeners.delete(listener as (payload: unknown) => void);
    },
    emit(type, payload) {
      listeners.get(type)?.forEach((listener) => listener(payload));
    },
  };
}

export type SceneLayers = {
  world: Container;
  scenes: Container;
};

export type SceneServices = {
  camera?: Container;
};

export type SceneResources = {
  textures: Readonly<Record<string, Texture>>;
  assets?: SceneAssetRegistry;
};

/** Explicit dependency boundary for a level/scene. */
export type SceneContext = {
  session: GameSession;
  layers: SceneLayers;
  services: SceneServices;
  events: SceneEventBus;
  resources: SceneResources;
};
