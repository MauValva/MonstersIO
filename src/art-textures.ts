import { Rectangle, Texture } from 'pixi.js';

// Derivative atlases use 2 px guards on every frame. Original paths remain
// supported so any individual asset can be reverted in the manifest.
export function gridTextures(texture: Texture, path: string, columns: number, rows: number) {
  const padding = path.includes('/Optimized/') ? 2 : 0;
  const cellWidth = texture.width / columns;
  const cellHeight = texture.height / rows;
  return Array.from({ length: columns * rows }, (_, index) => new Texture({
    source: texture.source,
    frame: new Rectangle(
      (index % columns) * cellWidth + padding,
      Math.floor(index / columns) * cellHeight + padding,
      cellWidth - padding * 2,
      cellHeight - padding * 2,
    ),
  }));
}
