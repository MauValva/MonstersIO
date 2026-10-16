import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as PIXI from "pixi.js";

const source = readFileSync("src/systems/eggs/egg-system.ts", "utf8")
  .replace(/^import[^;]+;\r?\n/gm, "")
  .replaceAll("export type ", "type ")
  .replaceAll("export const ", "const ")
  .replaceAll("export function ", "function ");

const context = vm.createContext({
  ...PIXI,
  BUSH_STACK_CONFIG: {
    maxColumns: 8,
    jitterX: 3,
    jitterY: 2,
    slotSpacingX: 42,
    slotSpacingY: 36,
    compactDuration: 0.35,
    compactDurationPerEgg: 0.012,
    releaseSpacingMultiplier: 1,
    bobX: 1,
    bobY: 1,
  },
  EGG_SPAWN_CONFIG: {
    activeTarget: 20,
    minFromPlayer: 180,
    minFromNest: 180,
    minBetweenEggs: 80,
    respawnMin: 1,
    respawnMax: 2,
    zones: [],
  },
  PLAYABLE_BOUNDS: { left: 300, right: 5900, top: -3800, bottom: 3800 },
  getStageVisualScale: (stageIndex) =>
    [1, 1.14, 1.3, 1.5, 1.62, 1.76, 1.9, 2.04, 2.18, 2.32][Math.min(stageIndex, 9)],
});
vm.runInContext(
  ts.transpile(source, { target: ts.ScriptTarget.ES2022 }),
  context,
);

const createEggSystem = vm.runInContext("createEggSystem", context);
const eggLayer = new PIXI.Container();
const frame = new PIXI.Texture({
  source: new PIXI.TextureSource({ width: 512, height: 512 }),
});
let stageIndex = 0;
let waterWorldActive = false;
const system = createEggSystem({
  eggLayer,
  eggFrames: [frame],
  eggResolutionScale: 1,
  getStageIndex: () => stageIndex,
  getVisualScale: () => waterWorldActive ? 2.42 : [1, 1.14, 1.3, 1.5, 1.62, 1.76, 1.9, 2.04, 2.18, 2.32][stageIndex],
  getPlayerPosition: () => ({ x: 3000, y: 3000 }),
  getNestPosition: () => ({ x: 3000, y: 3500 }),
  getCarriedEggScale: () => 1,
  getCarriedEggGap: () => 30,
  getWaterWorldActive: () => waterWorldActive,
});

const worldEggScale = (egg) => egg.children[0].scale.x;
for (stageIndex = 0; stageIndex < 10; stageIndex += 1) {
  waterWorldActive = false;
  const grassEgg = system.spawnEgg({ x: 1000, y: 1000 }, stageIndex);
  const grassScale = worldEggScale(grassEgg);
  system.releaseEgg(grassEgg);

  waterWorldActive = true;
  const waterEgg = system.spawnEgg({ x: 2000, y: 2000 }, stageIndex);
  const waterScale = worldEggScale(waterEgg);
  assert.equal(waterScale, grassScale, `Water and Grass egg scales match at local evolution ${stageIndex + 1}`);
  system.refreshScales();
  assert.equal(worldEggScale(waterEgg), grassScale, `refreshScales preserves local evolution ${stageIndex + 1}`);
  system.releaseEgg(waterEgg);
}
waterWorldActive = false;
stageIndex = 0;

const pooledCandidate = system.spawnEgg({ x: 1000, y: 1000 }, 0);
system.releaseEgg(pooledCandidate);
assert.equal(pooledCandidate.destroyed, false);

// This mirrors the real world handoff: active eggs are cleared, then the
// pooled objects from the previous Scene must not be reused in the next one.
system.clear();
assert.equal(pooledCandidate.destroyed, true);

const nextWorldEgg = system.spawnEgg({ x: 2000, y: 2000 }, 0);
assert.equal(nextWorldEgg.destroyed, false);
assert.ok(nextWorldEgg.position, "new-world egg has a valid position reference");
assert.equal(nextWorldEgg.parent, eggLayer);

console.log("PASS: EggSystem clears previous-Scene pool and spawns valid next-world eggs.");
