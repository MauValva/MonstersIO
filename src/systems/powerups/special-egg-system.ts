import { Container, Sprite, Texture } from "pixi.js";
import { PLAYABLE_BOUNDS } from "../../config/game-config";
import { SpecialEggType, type PowerUpDefinition } from "./power-up-system";
import type { Point } from "../../game/types";

export type SpecialEggState = "SPAWNING" | "AVAILABLE" | "COLLECTED";
export type SpecialEggEntity = {
  id: string;
  type: SpecialEggType;
  container: Container;
  state: SpecialEggState;
  opportunityId?: string;
  zoneId?: string;
  elapsed: number;
  phase: number;
  baseY: number;
};

export function createSpecialEggSystem(deps: {
  layer: Container;
  textures: Record<SpecialEggType, Texture>;
  getDefinition: (type: SpecialEggType) => PowerUpDefinition;
}) {
  const entities: SpecialEggEntity[] = [];
  let serial = 0;

  function spawn(type: SpecialEggType, position: Point, metadata: { opportunityId?: string; zoneId?: string } = {}) {
    const container = new Container();
    const sprite = new Sprite(deps.textures[type]);
    sprite.anchor.set(0.5);
    sprite.tint = 0xffffff;
    sprite.width = 96;
    // Preserve the source frame's aspect ratio; forcing every crop into a
    // square visibly squashes the orbit egg.
    sprite.height = 96 * (deps.textures[type].height / deps.textures[type].width);
    // The source artwork already contains the complete visual identity.
    // Do not add placeholder glows or icon badges on top of it.
    container.addChild(sprite);
    container.position.set(
      Math.max(PLAYABLE_BOUNDS.left + 30, Math.min(PLAYABLE_BOUNDS.right - 30, position.x)),
      Math.max(PLAYABLE_BOUNDS.top + 30, Math.min(PLAYABLE_BOUNDS.bottom - 30, position.y)),
    );
    container.scale.set(0.2);
    deps.layer.addChild(container);
    const entity: SpecialEggEntity = {
      id: `special-egg-${serial++}`,
      type,
      container,
      state: "SPAWNING",
      ...metadata,
      elapsed: 0,
      phase: Math.random() * Math.PI * 2,
      baseY: container.y,
    };
    entities.push(entity);
    return entity;
  }

  function update(dt: number, time: number) {
    for (const entity of entities) {
      if (entity.state === "COLLECTED") continue;
      entity.elapsed += dt;
      const spawnProgress = Math.min(1, entity.elapsed / 0.42);
      const eased = 1 - (1 - spawnProgress) ** 3;
      entity.container.scale.set(0.2 + eased * 0.8);
      if (spawnProgress >= 1) entity.state = "AVAILABLE";
      const isSpeedEgg = entity.type === SpecialEggType.Speed;
      const pulse = 1 + Math.sin(time * (isSpeedEgg ? 5.2 : 3.6) + entity.phase) * (isSpeedEgg ? 0.085 : 0.055);
      entity.container.scale.set(entity.container.scale.x * pulse);
      entity.container.y = entity.baseY + Math.sin(time * 1.5 + entity.phase) * 2.5;
      entity.container.rotation = Math.sin(time * 0.9 + entity.phase) * 0.035;
    }
  }

  function collect(entity: SpecialEggEntity) {
    if (entity.state !== "AVAILABLE") return false;
    entity.state = "COLLECTED";
    entity.container.removeFromParent();
    const index = entities.indexOf(entity);
    if (index !== -1) entities.splice(index, 1);
    entity.container.destroy({ children: true });
    return true;
  }

  function clear() {
    for (const entity of entities) entity.container.destroy({ children: true });
    entities.length = 0;
  }

  return { entities, spawn, update, collect, clear };
}
