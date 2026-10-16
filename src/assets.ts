// Shared by the loader and production build: originals stay in public/assets.
export const ORIGINAL_ASSETS = {
  ground: './assets/Arts/Environment/Tile_Ground_V2.png',
  waterWorldGround: './assets/Arts/Environment/Tile_Ground_WatrerWorld.png',
  waterWorldPlayerNest: './assets/Arts/Environment/WaterWorld/PlayerNest.png',
  worldAtlas: './assets/Arts/Environment/EggMineWaterWorld.png',
  player: './assets/Arts/Player/Player_EvoMonster.png',
  upgradeUi: './assets/Arts/UI/UI_Upgrades.png',
  upgradeBase: './assets/Arts/Environment/UpgradeBase.png',
  eggs: './assets/Arts/Eggs/spr_Eggs.png',
  features: './assets/Arts/Eggs/Features.png',
  hud: './assets/Arts/UI/UI_HUD.png',
  evolutionUi: './assets/Arts/UI/UI_Evolution.png',
} as const;

// Revert any derivative independently by deleting its override below.
export const GAME_ASSETS = {
  ...ORIGINAL_ASSETS,
  upgradeBase: './assets/Optimized/UpgradeBase.png',
  eggs: './assets/Optimized/spr_Eggs.png',
  ground: './assets/Optimized/Tile_Ground_V2.png',
} as const;

export const WATER_WORLD_EVOLUTION_ASSETS = [
  './assets/Arts/Player/WaterWorld/WaterWorld_Evolution_01.png',
  './assets/Arts/Player/WaterWorld/WaterWorld_Evolution_02.png',
  './assets/Arts/Player/WaterWorld/WaterWorld_Evolution_03.png',
  './assets/Arts/Player/WaterWorld/WaterWorld_Evolution_04.png',
  './assets/Arts/Player/WaterWorld/WaterWorld_Evolution_05.png',
  './assets/Arts/Player/WaterWorld/WaterWorld_Evolution_06.png',
  './assets/Arts/Player/WaterWorld/WaterWorld_Evolution_07.png',
  './assets/Arts/Player/WaterWorld/WaterWorld_Evolution_08.png',
  './assets/Arts/Player/WaterWorld/WaterWorld_Evolution_09.png',
  './assets/Arts/Player/WaterWorld/WaterWorld_Evolution_10.png',
] as const;

export const WATER_WORLD_RIVAL_ASSETS = {
  octopus: './assets/Arts/Environment/WaterWorld/Enemy_Octopus.png',
  shark: './assets/Arts/Environment/WaterWorld/Enemy_Shark.png',
  nest01: './assets/Arts/Environment/WaterWorld/EnemyNest_01.png',
  nest02: './assets/Arts/Environment/WaterWorld/EnemyNest_02.png',
  cloud: './assets/Arts/Environment/WaterWorld/WaterCloud.png',
} as const;

export const WATER_WORLD_HIDEOUT_ASSET =
  './assets/Arts/Environment/WaterWorld/WaterRockBush.png';
export const LAVA_WORLD_PLAQUE_ASSET =
  './assets/Arts/Environment/WaterWorld/LavaWorld_Plaque.png';
export const LAVA_WORLD_PORTAL_ASSET =
  './assets/Arts/Environment/WaterWorld/LavaPortal.png';

export const GRASS_WORLD_PLAYER_NEST_ASSET =
  './assets/Arts/Environment/GrassWorld/PlayerNest.png';

export const GRASS_WORLD_SCENE_ASSETS = {
  plant: './assets/Arts/Environment/GrassWorld/Plant.png',
  edgeStone: './assets/Arts/Environment/GrassWorld/EdgeStone.png',
  cloud: './assets/Arts/Environment/GrassWorld/GrassCloud.png',
  enemyBat: './assets/Arts/Environment/GrassWorld/Enemy_Bat.png',
  enemyRed: './assets/Arts/Environment/GrassWorld/Enemy_Red.png',
  nest01: './assets/Arts/Environment/GrassWorld/EnemyNest_01.png',
  nest02: './assets/Arts/Environment/GrassWorld/EnemyNest_02.png',
} as const;
