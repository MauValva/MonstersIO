import path from "node:path";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const input = path.join(
  projectRoot,
  "public/assets/Arts/Environment/Assets_WaterWorld.png",
);
const outputDirectory = path.join(
  projectRoot,
  "public/assets/Arts/Environment/WaterWorld",
);

const metadata = await sharp(input).metadata();
if (metadata.width !== 855 || metadata.height !== 627) {
  throw new Error(
    `Unexpected Assets_WaterWorld dimensions: ${metadata.width}x${metadata.height}`,
  );
}

// Loose regions preserve transparent padding around each authored asset. The
// atlas remains the source of truth; these files are only scene-ready crops.
const assets = [
  { name: "LavaWorld_Plaque.png", left: 0, top: 0, width: 205, height: 195 },
  { name: "LavaPortal.png", left: 215, top: 0, width: 340, height: 285 },
  { name: "CornerRock.png", left: 600, top: 0, width: 255, height: 285 },
  { name: "WaterRockBush.png", left: 0, top: 205, width: 215, height: 180 },
  { name: "WaterCloud.png", left: 280, top: 295, width: 220, height: 130 },
  { name: "Enemy_Octopus.png", left: 655, top: 235, width: 200, height: 190 },
  { name: "EnemyNest_01.png", left: 0, top: 420, width: 215, height: 207 },
  { name: "EnemyNest_02.png", left: 225, top: 425, width: 205, height: 202 },
  { name: "PlayerNest.png", left: 450, top: 425, width: 205, height: 202 },
  { name: "Enemy_Shark.png", left: 660, top: 425, width: 195, height: 202 },
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

console.log(`Cropped ${assets.length} Water World assets into ${outputDirectory}.`);
