import path from "node:path";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const input = path.join(
  projectRoot,
  "public/assets/Arts/Environment/Assets_GrassWorld.png",
);
const outputDirectory = path.join(
  projectRoot,
  "public/assets/Arts/Environment/GrassWorld",
);

const metadata = await sharp(input).metadata();
if (metadata.width !== 855 || metadata.height !== 627) {
  throw new Error(
    `Unexpected Assets_GrassWorld dimensions: ${metadata.width}x${metadata.height}`,
  );
}

// These regions intentionally mirror crop-water-world-assets.mjs. The two
// atlases use the same authored layout; only the world skin changes.
const assets = [
  { name: "GrassWorld_Plaque.png", left: 0, top: 0, width: 205, height: 195 },
  { name: "GrassPortal.png", left: 215, top: 0, width: 340, height: 285 },
  // The Grass atlas places the purple rival immediately below the rock. Keep
  // the crop above that neighboring sprite's top edge.
  { name: "EdgeStone.png", left: 600, top: 0, width: 255, height: 230 },
  { name: "Plant.png", left: 0, top: 205, width: 215, height: 180 },
  { name: "GrassCloud.png", left: 280, top: 295, width: 220, height: 130 },
  { name: "Enemy_Bat.png", left: 655, top: 235, width: 200, height: 190 },
  { name: "EnemyNest_01.png", left: 0, top: 420, width: 215, height: 207 },
  { name: "EnemyNest_02.png", left: 225, top: 425, width: 205, height: 202 },
  { name: "PlayerNest.png", left: 450, top: 425, width: 205, height: 202 },
  { name: "Enemy_Red.png", left: 660, top: 425, width: 195, height: 202 },
];

await mkdir(outputDirectory, { recursive: true });

for (const asset of assets) {
  await sharp(input)
    .extract({
      left: asset.left,
      top: asset.top,
      width: asset.width,
      height: asset.height,
    })
    .png()
    .toFile(path.join(outputDirectory, asset.name));
}

console.log(`Cropped ${assets.length} Grass World assets into ${outputDirectory}.`);
