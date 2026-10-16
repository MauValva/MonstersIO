import { Assets, Texture } from "pixi.js";
import type { SceneAssetDefinition, SceneAssetManifest } from "./scene-asset-types";

type LoadedAsset = {
  definition: SceneAssetDefinition;
  texture: Texture;
  owners: Set<string>;
};

export type SceneAssetRegistry = {
  loadManifest(manifest: SceneAssetManifest): Promise<Readonly<Record<string, Texture>>>;
  loadManifests(manifests: readonly SceneAssetManifest[]): Promise<Readonly<Record<string, Texture>>>;
  get(id: string): Texture;
  isLoaded(manifest: SceneAssetManifest): boolean;
  assertLoaded(manifest: SceneAssetManifest): void;
  acquire(manifest: SceneAssetManifest): void;
  release(manifest: SceneAssetManifest): void;
};

/**
 * Ownership/reference bookkeeping over Pixi's Assets cache.
 * We intentionally do not call Assets.unload in this checkpoint: gameplay,
 * transition sprites and derived atlas textures may still reference sources.
 */
export function createSceneAssetRegistry(): SceneAssetRegistry {
  const byId = new Map<string, LoadedAsset>();
  const byPath = new Map<string, Promise<Texture>>();

  async function loadDefinition(definition: SceneAssetDefinition) {
    const existing = byId.get(definition.id);
    if (existing) return existing.texture;
    const pending = byPath.get(definition.path) ?? Assets.load<Texture>(definition.path);
    byPath.set(definition.path, pending);
    let texture: Texture;
    try {
      texture = await pending;
    } catch (error) {
      if (byPath.get(definition.path) === pending) byPath.delete(definition.path);
      throw error;
    }
    const loaded: LoadedAsset = {
      definition,
      texture,
      owners: new Set(),
    };
    byId.set(definition.id, loaded);
    return texture;
  }

  async function loadManifest(manifest: SceneAssetManifest) {
    const entries = await Promise.all(
      manifest.assets.map(async (definition) => [
        definition.id,
        await loadDefinition(definition),
      ] as const),
    );
    acquire(manifest);
    return Object.fromEntries(entries) as Readonly<Record<string, Texture>>;
  }

  async function loadManifests(manifests: readonly SceneAssetManifest[]) {
    const entries = await Promise.all(
      manifests.flatMap((manifest) =>
        manifest.assets.map(async (definition) => [
          definition.id,
          await loadDefinition(definition),
        ] as const),
      ),
    );
    for (const manifest of manifests) acquire(manifest);
    return Object.fromEntries(entries) as Readonly<Record<string, Texture>>;
  }

  function get(id: string) {
    const asset = byId.get(id);
    if (!asset) throw new Error(`Asset not loaded: ${id}`);
    return asset.texture;
  }

  function isLoaded(manifest: SceneAssetManifest) {
    return manifest.assets.every((definition) => byId.has(definition.id));
  }

  function assertLoaded(manifest: SceneAssetManifest) {
    if (!isLoaded(manifest)) {
      throw new Error(`Scene assets are not loaded: ${manifest.sceneId}`);
    }
  }

  function acquire(manifest: SceneAssetManifest) {
    for (const definition of manifest.assets) {
      const asset = byId.get(definition.id);
      if (!asset) continue;
      asset.owners.add(manifest.sceneId);
    }
  }

  function release(manifest: SceneAssetManifest) {
    for (const definition of manifest.assets) {
      byId.get(definition.id)?.owners.delete(manifest.sceneId);
    }
  }

  return { loadManifest, loadManifests, get, isLoaded, assertLoaded, acquire, release };
}
