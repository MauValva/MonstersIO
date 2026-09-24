import { Assets, type Texture } from 'pixi.js';
import { GAME_ASSETS } from './assets';

// Successful/in-flight individual loads survive a retry of the other asset.
// All callers share one transaction; failed requests alone can be retried.
export function createUpgradeAssetLoader(
  load: (path: string) => Promise<Texture> = path => Assets.load<Texture>(path),
) {
  let ui: Promise<Texture> | undefined;
  let base: Promise<Texture> | undefined;
  let transaction: Promise<{ ui: Texture; base: Texture }> | undefined;
  return () => {
    if (!transaction) {
      ui ??= load(GAME_ASSETS.upgradeUi).catch(error => { ui = undefined; throw error; });
      base ??= load(GAME_ASSETS.upgradeBase).catch(error => { base = undefined; throw error; });
      transaction = Promise.all([ui, base])
        .then(([ui, base]) => ({ ui, base }))
        .catch(error => { transaction = undefined; throw error; });
    }
    return transaction;
  };
}
