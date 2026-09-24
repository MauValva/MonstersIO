// Shared by the loader and production build: originals stay in public/assets.
export const ORIGINAL_ASSETS = {
  ground: './assets/Arts/Environment/Tile_Ground_V2.png',
  nest: './assets/Arts/Environment/Nest_Player.png',
  enemyNest: './assets/Arts/Environment/enemyNest.png',
  player: './assets/Arts/Player/Player_EvoMonster.png',
  cloud: './assets/Arts/Player/PlayerCloud.png',
  enemy: './assets/Arts/Enemy/Enemies.png',
  upgradeUi: './assets/Arts/UI/UI_Upgrades.png',
  upgradeBase: './assets/Arts/Environment/UpgradeBase.png',
  eggs: './assets/Arts/Eggs/spr_Eggs.png',
  plant: './assets/Arts/Environment/Plant.png',
  hud: './assets/Arts/UI/UI_HUD.png',
} as const;

// Revert any derivative independently by deleting its override below.
export const GAME_ASSETS = {
  ...ORIGINAL_ASSETS,
  enemy: './assets/Optimized/Enemies.png',
  plant: './assets/Optimized/Plant.png',
  upgradeBase: './assets/Optimized/UpgradeBase.png',
  enemyNest: './assets/Optimized/enemyNest.png',
  eggs: './assets/Optimized/spr_Eggs.png',
  ground: './assets/Optimized/Tile_Ground_V2.png',
} as const;
