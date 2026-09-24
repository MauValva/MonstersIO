import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { GAME_ASSETS } from './src/assets';

export default defineConfig({
  plugins: [{
    name: 'game-assets-only',
    apply: 'build',
    config: () => ({ build: { copyPublicDir: false } }),
    generateBundle() {
      for (const path of Object.values(GAME_ASSETS)) {
        this.emitFile({
          type: 'asset',
          fileName: path.replace(/^\.\//, ''),
          source: readFileSync(new URL(`./public/${path}`, import.meta.url)),
        });
      }
    },
  }],
});
