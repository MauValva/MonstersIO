import { readFileSync } from "node:fs";
import ts from "typescript";

function loadTypeScriptModule(relativePath) {
  const source = readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      strict: true,
    },
    fileName: relativePath,
  }).outputText;
  const module = { exports: {} };
  new Function("exports", "module", output)(module.exports, module);
  return module.exports;
}

const { CampaignManager } = loadTypeScriptModule("src/campaign/campaign-manager.ts");
const progression = loadTypeScriptModule("src/systems/progression/progression-system.ts");
const runtime = loadTypeScriptModule("src/levels/scene-runtime.ts");
const manager = loadTypeScriptModule("src/levels/level-manager.ts");

function assert(condition, message) {
  if (!condition) throw new Error(`Architecture check failed: ${message}`);
}

const worldIds = ["grass-world", "water-world"];
const session = {
  campaign: { activeWorld: null, completedWorlds: new Set(), data: {} },
  coins: 0,
  upgrades: { speed: 0, pickupRadius: 0 },
};
const campaign = new CampaignManager(session, { worldOrder: ["water-world", "grass-world"] }, worldIds);
assert(campaign.getInitialWorldId() === "water-world", "reversed campaign resolves Water first");
assert(campaign.getNextWorldId() === "grass-world", "reversed campaign resolves Grass next");
const singleWorldCampaign = new CampaignManager(
  { campaign: { activeWorld: null, completedWorlds: new Set(), data: {} }, coins: 0, upgrades: {} },
  { worldOrder: ["water-world"] },
  worldIds,
);
assert(singleWorldCampaign.getNextWorldId() === "water-world", "single-world campaign wraps to its first scene");

const progressionSystem = progression.createProgressionSystem({
  worldId: "grass-world",
  stages: [
    { name: "one", threshold: 0, color: 0, scale: 1 },
    { name: "two", threshold: 2, color: 0, scale: 1 },
  ],
  portalEggRequirement: 4,
  portalScale: 1,
});
const firstDelivery = progressionSystem.recordDelivery(2);
assert(firstDelivery.shouldEvolve, "local progression unlocks the next stage");
progressionSystem.completeEvolution(firstDelivery.unlockedIndex);
const portalDelivery = progressionSystem.recordDelivery(1);
assert(!portalDelivery.portalReady, "last evolution does not complete the portal");
assert(progressionSystem.state === "PORTAL_ACTIVE", "portal becomes active after the last local evolution");
const finalDelivery = progressionSystem.recordDelivery(1);
assert(finalDelivery.portalReady, "portal requires the configured additional delivery");
assert(progressionSystem.completePortal(), "portal completes exactly once");
assert(progressionSystem.beginTransition(), "portal completion starts transition");

progressionSystem.prepareForNewWorld({
  worldId: "water-world",
  stages: [{ name: "one", threshold: 0, color: 0, scale: 1 }],
  portalEggRequirement: null,
  portalScale: 1,
});
assert(progressionSystem.delivered === 0, "new world resets local delivered progress");
assert(progressionSystem.stageIndex === 0, "new world starts at local evolution one");
assert(progressionSystem.state === "TRANSITIONING", "portal transition remains active while next world is prepared");
assert(progressionSystem.globalDelivered === 4, "new world reset preserves campaign delivery history");
progressionSystem.enterActiveWorld();
assert(progressionSystem.state === "EVOLVING", "prepared world enters active local progression once transition ends");

const mainSource = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
assert(!mainSource.includes("getGlobalEvolutionLevel"), "HUD no longer uses global evolution numbering");

const waterProgression = progression.createProgressionSystem({
  worldId: "water-world",
  stages: [{ name: "one", threshold: 0, color: 0, scale: 1 }],
  portalEggRequirement: 230,
  portalScale: 1,
});
const waterDelivery = waterProgression.recordDelivery(100);
waterProgression.completeEvolution(waterDelivery.unlockedIndex);
assert(!waterDelivery.portalReady, "Water portal requires the configured 230 delivered eggs");
assert(!waterProgression.completePortal(), "Water portal cannot complete before its requirement");

const context = { session, layers: {}, services: {}, events: {}, resources: {} };
const sceneRuntime = runtime.createSceneRuntime({
  sceneId: "water-world",
  context,
  design: { worldId: "water-world" },
  evolution: { worldId: "water-world" },
});
assert(sceneRuntime.state === "CREATED", "runtime starts in CREATED");
sceneRuntime.initialize();
sceneRuntime.enter();
assert(sceneRuntime.state === "ACTIVE", "runtime enters ACTIVE");
sceneRuntime.pause();
assert(sceneRuntime.state === "PAUSED", "runtime pauses");
sceneRuntime.resume();
sceneRuntime.exit();
assert(sceneRuntime.state === "EXITED", "runtime exits");
sceneRuntime.enter();
assert(sceneRuntime.state === "ACTIVE", "runtime can be re-entered");
sceneRuntime.dispose();
assert(sceneRuntime.state === "DISPOSED", "runtime disposes");

const calls = [];
const fakeLevel = (id) => ({
  id,
  root: {},
  design: { worldId: id },
  assetManifest: { sceneId: id, assets: [] },
  enter: () => calls.push(`${id}:enter`),
  exit: () => calls.push(`${id}:exit`),
  update: () => calls.push(`${id}:update`),
  destroy: () => {},
  context,
});
const grass = fakeLevel("grass-world");
const water = fakeLevel("water-world");
const levelManager = manager.createLevelManager([grass, water], "water-world");
assert(levelManager.activeId === "water-world", "LevelManager activates the configured initial world");
levelManager.activate("grass-world");
assert(levelManager.activeId === "grass-world", "LevelManager activates only one current world");
levelManager.pause();
levelManager.resume();
levelManager.update(1 / 60);
assert(calls.includes("grass-world:update"), "active level receives updates after resume");

console.log("Architecture checks passed");
