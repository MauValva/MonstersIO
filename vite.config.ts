import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import {
  GAME_ASSETS,
  GRASS_WORLD_PLAYER_NEST_ASSET,
  GRASS_WORLD_SCENE_ASSETS,
  LAVA_WORLD_PLAQUE_ASSET,
  LAVA_WORLD_PORTAL_ASSET,
  WATER_WORLD_HIDEOUT_ASSET,
  WATER_WORLD_EVOLUTION_ASSETS,
  WATER_WORLD_RIVAL_ASSETS,
} from './src/assets';

export default defineConfig({
  plugins: [{
    name: 'game-assets-only',
    apply: 'build',
    config: () => ({ build: { copyPublicDir: false } }),
    generateBundle() {
      for (const path of [
        ...Object.values(GAME_ASSETS),
        GRASS_WORLD_PLAYER_NEST_ASSET,
        ...Object.values(GRASS_WORLD_SCENE_ASSETS),
        ...WATER_WORLD_EVOLUTION_ASSETS,
        ...Object.values(WATER_WORLD_RIVAL_ASSETS),
        WATER_WORLD_HIDEOUT_ASSET,
        LAVA_WORLD_PLAQUE_ASSET,
        LAVA_WORLD_PORTAL_ASSET,
      ]) {
        this.emitFile({
          type: 'asset',
          fileName: path.replace(/^\.\//, ''),
          source: readFileSync(new URL(`./public/${path}`, import.meta.url)),
        });
      }
    },
  }],
});
