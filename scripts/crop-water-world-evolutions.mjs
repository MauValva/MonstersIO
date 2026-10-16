import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const input = path.join(
  projectRoot,
  "public/assets/Arts/Player/EVO_WaterWorld.png",
);
const outputDirectory = path.join(
  projectRoot,
  "public/assets/Arts/Player/WaterWorld",
);

const metadata = await sharp(input).metadata();
if (metadata.width !== 2048 || metadata.height !== 765) {
  throw new Error(
    `Unexpected EVO_WaterWorld dimensions: ${metadata.width}x${metadata.height}`,
  );
}

// The first row is authored with intentionally varied spacing, so equal
// 5-column slicing would cut the fifth monster in half. These loose regions
// preserve their transparent padding so the individual sprites remain stable
// when used by the Pixi player renderer.
const regions = [
  { left: 0, top: 0, width: 270, height: 350 },
  { left: 270, top: 0, width: 320, height: 350 },
  { left: 590, top: 0, width: 320, height: 350 },
  { left: 900, top: 0, width: 370, height: 350 },
  { left: 1270, top: 0, width: 777, height: 350 },
  { left: 0, top: 383, width: 410, height: 382 },
  { left: 410, top: 383, width: 375, height: 382 },
  { left: 785, top: 383, width: 405, height: 382 },
  // Evolutions 9 and 10 rise above the nominal second-row boundary.
  { left: 1190, top: 350, width: 456, height: 415 },
  { left: 1646, top: 350, width: 402, height: 415 },
];

await sharp(input).toFormat("png").ensureAlpha();
await (await import("node:fs/promises")).mkdir(outputDirectory, { recursive: true });

for (const [offset, region] of regions.entries()) {
    const index = offset + 1;
    await sharp(input)
      .extract(region)
      .png()
      .toFile(
        path.join(
          outputDirectory,
          `WaterWorld_Evolution_${String(index).padStart(2, "0")}.png`,
        ),
      );
}

console.log("Cropped 10 Water World evolution sprites.");
