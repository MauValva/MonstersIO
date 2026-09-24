// Headless logic regression checks using real Pixi scene classes; no GPU/FPS claim.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import * as PIXI from 'pixi.js';
import sharp from 'sharp';

const inventory = JSON.parse(readFileSync('reports/assets.json', 'utf8').replace(/^\uFEFF/, ''));
for (const asset of inventory) {
  assert.equal(createHash('sha256').update(readFileSync(asset.path)).digest('hex').toUpperCase(), asset.sha256, `Original changed: ${asset.path}`);
}
const baseline = process.argv.includes('--baseline');
const simulateUpgradeFailure = process.argv.includes('--upgrade-failure');
const assetSource = readFileSync(baseline ? 'reports/stage2/baseline/assets.ts' : 'src/assets.ts', 'utf8');
const manifestContext = {};
vm.runInNewContext(ts.transpile(assetSource.replaceAll('export const', 'const') + '\nglobalThis.GAME_ASSETS = GAME_ASSETS;', { target: ts.ScriptTarget.ES2022 }), manifestContext);
const textures = new Map();
for (const path of Object.values(manifestContext.GAME_ASSETS)) {
  const assetPath = `public/${path.slice(2)}`;
  const asset = await sharp(assetPath).metadata();
  if (!baseline) assert.deepEqual(readFileSync(`dist/${path.slice(2)}`), readFileSync(assetPath));
  textures.set(path, new PIXI.Texture({ source: new PIXI.TextureSource({ width: asset.width, height: asset.height }) }));
}
let tick;
const events = [];
const loadRequests = [];
class Application {
  stage = new PIXI.Container();
  screen = new PIXI.Rectangle(0, 0, 1280, 720);
  canvas = {};
  ticker = { add(callback) { tick = callback; } };
  async init() {}
}
const sandbox = {
  ...PIXI, Application, GAME_ASSETS: manifestContext.GAME_ASSETS,
  Assets: { async load(path) {
    loadRequests.push(path); assert.ok(textures.has(path));
    if (simulateUpgradeFailure && path === manifestContext.GAME_ASSETS.upgradeBase &&
        loadRequests.filter(p=>p===path).length <= 2) throw new Error('simulated upgrade network failure');
    return textures.get(path);
  } },
  window: { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 2, addEventListener() {} },
  document: { querySelector: () => ({ appendChild() {} }) },
  poki: { async init() { events.push('init'); }, loadingFinished() { events.push('loaded'); }, gameplayStart() { events.push('start'); }, gameplayStop() { events.push('stop'); } },
  console,
};
let randomSeed = 12345;
const seededMath = Object.create(Math);
seededMath.random = () => ((randomSeed = (randomSeed * 1664525 + 1013904223) >>> 0) / 4294967296);
sandbox.Math = seededMath;
let framesChecked = 0;
sandbox.Texture = class extends PIXI.Texture {
  constructor(options) {
    super(options);
    const f = this.frame;
    assert.ok(f.x >= 0 && f.y >= 0 && f.x + f.width <= this.source.width + 1e-6 && f.y + f.height <= this.source.height + 1e-6, 'Frame outside atlas');
    framesChecked++;
  }
};
let source = readFileSync(baseline ? 'reports/stage2/baseline/main.ts' : 'src/main.ts', 'utf8').replace(/^import[\s\S]*?;\r?\n/gm, '');
source = source.slice(0, source.indexOf('void bootstrap().catch'));
source = source.replace('  app.ticker.add((ticker) => {', `
  globalThis.testGame = {
    eggs, eggPool, eggMotion, eggLayer, world, player, carriedEggs, enemies,
    eggHideAnimations, eggsInHideAnimation, spawnEgg, releaseEgg, updateUI,
    redrawBasePreview, basePreviewFillMask, updateEnemy, startGameplay, base,
    get delivered() { return delivered; },
    get currency() { return currency; },
    animateCarriedEggsForBush, updateCarriedEggBushAnimations,
    upgradeState: () => ({ ready: typeof upgradeAssetsReady === 'undefined' ? true : upgradeAssetsReady,
      unlocked: upgradeStationUnlocked, visible: upgradeStation.visible, menu: upgradePanel.visible,
      width: upgradeBaseSprite.width, height: upgradeBaseSprite.height,
      status: typeof upgradeLoadStatus === 'undefined' ? '' : upgradeLoadStatus.text,
      statusVisible: typeof upgradeLoadStatus === 'undefined' ? false : upgradeLoadStatus.visible }),
    unlockUpgradeStationTutorial,
    retryUpgradeArtwork: () => typeof preloadUpgradeAssets === 'undefined' ? Promise.resolve(true) : preloadUpgradeAssets(),
    geometry() {
      const visual = (sprite) => ({ width: sprite.width, height: sprite.height,
        x: sprite.x, y: sprite.y, anchor: sprite.anchor ? [sprite.anchor.x, sprite.anchor.y] : null });
      const stages = [];
      const savedSkin = skinIndex;
      for (let stage = 0; stage < STAGES.length; stage++) {
        skinIndex = stage; redrawPlayer();
        const egg = spawnEgg({ x: 1000, y: 1000 }, stage);
        stages.push({ player: visual(playerEvolution), bushes: bushes.map(b => visual(b.sprite)),
          eggSpawn: visual(egg.children[0]) });
        setEggWorldSpriteScale(egg);
        stages[stage].eggProgression = visual(egg.children[0]);
        releaseEgg(egg);
      }
      skinIndex = savedSkin; redrawPlayer();
      return { stages, enemy: enemies.map(e => visual(e.art)),
        nests: enemyBases.map(b => visual(b.children[0])), upgrade: visual(upgradeBaseSprite),
        bushes: bushes.map(b=>({x:b.x,y:b.y,width:b.width,height:b.height})),
        ground: [waterGround, grassGround].map(s=>({width:s.width,height:s.height,
          tileWidth:s.texture.width*s.tileScale.x,tileHeight:s.texture.height*s.tileScale.y})),
        shorelineWidth };
    },
    carry(count) {
      for (const egg of [...eggs]) releaseEgg(egg);
      carriedEggs.length = 0;
      player.position.set(3000, 1800);
      for (let i = 0; i < count; i++) {
        const egg = spawnEgg({ x: 3000 - i * 90, y: 1800 }, 0);
        world.addChild(egg); carriedEggs.push(egg);
      }
      carried = count;
    },
  };
  app.ticker.add((ticker) => {`);
vm.createContext(sandbox);
const helper = readFileSync('src/art-textures.ts', 'utf8').replace(/^import.*;\r?\n/gm, '').replaceAll('export function','function');
vm.runInContext(ts.transpile(helper, { target: ts.ScriptTarget.ES2022 }), sandbox);
const loader = readFileSync('src/upgrade-assets.ts', 'utf8').replace(/^import.*;\r?\n/gm, '').replaceAll('export function','function');
vm.runInContext(ts.transpile(loader, { target: ts.ScriptTarget.ES2022 }), sandbox);
vm.runInContext(ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None }), sandbox);
await vm.runInContext('bootstrap()', sandbox);
const game = sandbox.testGame;
const geometry = JSON.parse(JSON.stringify(game.geometry()));
if (baseline) {
  writeFileSync('reports/stage2/geometry-before.json', JSON.stringify(geometry, null, 2));
} else {
  const expected = JSON.parse(readFileSync('reports/stage2/geometry-before.json','utf8'));
  function compare(actual, expected, path='geometry') {
    if (typeof expected === 'number') assert.ok(Math.abs(actual-expected)<1e-8, `${path}: ${actual} != ${expected}`);
    else if (expected && typeof expected === 'object') for (const key of Object.keys(expected)) compare(actual[key],expected[key],`${path}.${key}`);
    else assert.equal(actual,expected,path);
  }
  compare(geometry,expected);
}
assert.deepEqual(events, ['init', 'loaded']);
assert.equal(game.eggs.length, 20);
if (!baseline) {
  assert.equal(loadRequests.length, 9, 'Only essential images belong to boot');
  assert.equal(game.upgradeState().ready, false);
  assert.equal(game.upgradeState().visible, false);
}
game.startGameplay(); game.startGameplay();
await new Promise(resolve => setImmediate(resolve));
assert.equal(events.filter(value => value === 'start').length, 1);
assert.equal(loadRequests.length, 11);
assert.equal(new Set(loadRequests).size, 11);
if (simulateUpgradeFailure) {
  assert.equal(game.upgradeState().ready, false);
  assert.equal(game.upgradeState().visible, false);
  assert.equal(game.upgradeState().menu, false);
  game.unlockUpgradeStationTutorial();
  assert.equal(game.upgradeState().visible, false, 'Keep station hidden while retry is pending');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(game.upgradeState().ready, false);
  assert.equal(game.upgradeState().visible, false);
  assert.equal(game.upgradeState().statusVisible, true);
  assert.match(game.upgradeState().status, /retry/);
  const retry = game.retryUpgradeArtwork();
  assert.equal(retry, game.retryUpgradeArtwork(), 'Game must also share its binding Promise');
  assert.equal(await retry, true);
  assert.equal(game.upgradeState().ready, true);
  assert.equal(game.upgradeState().visible, true);
  assert.equal(game.upgradeState().statusVisible, false);
  assert.equal(loadRequests.length, 13);
  assert.equal(loadRequests.filter(p=>p===manifestContext.GAME_ASSETS.upgradeUi).length, 1);
}
assert.equal(game.upgradeState().ready, true);
assert.equal(game.upgradeState().width, 172);
assert.equal(game.upgradeState().height, 175);
if (!simulateUpgradeFailure) assert.equal(game.upgradeState().visible, false, 'Preload must not unlock early');
for (const texture of textures.values()) assert.equal(texture.destroyed, false);
// Exercise the full ticker without browser rendering.
for (let i = 0; i < 120; i++) tick({ deltaMS: 1000 / 60 });
// Repeated UI calls must not rebuild the preview mask.
let clears = 0;
const clear = game.basePreviewFillMask.clear.bind(game.basePreviewFillMask);
game.basePreviewFillMask.clear = (...args) => { clears++; return clear(...args); };
for (let i = 0; i < 100; i++) game.updateUI();
assert.equal(clears, 0);
for (const count of [10, 20, 30, 50]) {
  game.carry(count);
  game.animateCarriedEggsForBush(false);
  assert.equal(game.eggsInHideAnimation.size, count);
  game.updateCarriedEggBushAnimations(0.5);
  assert.equal(game.eggsInHideAnimation.size, 0);
  for (let i = 0; i < 5; i++) tick({ deltaMS: 1000 / 60 });
  for (const egg of [...game.carriedEggs]) game.releaseEgg(egg);
  game.carriedEggs.length = 0;
  assert.ok(game.eggPool.length <= 20);
  assert.equal(game.eggMotion.size, game.eggs.length);
}
for (let cycle = 0; cycle < 100; cycle++) {
  const batch = Array.from({ length: 50 }, (_, index) => game.spawnEgg({ x: 500 + index * 20, y: -1000 }, 0));
  for (const egg of batch) game.releaseEgg(egg);
}
assert.ok(game.eggPool.length <= 20);
assert.equal(game.eggMotion.size, game.eggs.length);
const reused = game.spawnEgg({ x: 1234, y: 2345 }, 3);
assert.equal(reused.visible, true);
assert.equal(reused.x, 1234);
assert.equal(reused.children[0].rotation, 0);
assert.equal(reused.children[0].y, 0);
for (const texture of textures.values()) assert.equal(texture.destroyed, false);
game.carry(50);
game.player.position.copyFrom(game.base.position);
const deliveredBefore = game.delivered;
const currencyBefore = game.currency;
for (let i = 0; i < 240; i++) tick({ deltaMS: 1000 / 60 });
assert.equal(game.delivered - deliveredBefore, 50);
assert.equal(game.currency - currencyBefore, 500);
assert.equal(game.carriedEggs.length, 0);
assert.ok(game.eggPool.length <= 20);
console.log(`PASS: original hashes intact; 11 published assets match manifest; ${framesChecked} atlas frames in bounds; world geometry matches baseline in all 10 stages; deferred upgrade loading; boot/Poki call order; 120 ticks; UI caching; queues 10/20/30/50; 5,000 egg lifecycles; deposit 50 eggs = 500 currency.`);
