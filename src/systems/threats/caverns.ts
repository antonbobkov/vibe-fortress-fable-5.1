/**
 * Cavern monsters, webs, and restless dead implementation.
 * `02-systems/18-threats-monsters-and-raids.md` § Cavern monsters,
 * `03-content/creatures.md` cavern monster rows.
 */

import { C } from '@core/components';
import { TileFlag, TileKind, type Map3D } from '@core/map3d';
import type { Registry } from '@core/registry';
import type { RngStream } from '@core/rng';
import type { TickContext, WorldLike } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import { PERCEPTION_RADIUS } from '@systems/combat/constants';
import { CAVERN_BANDS } from '@systems/terrain/api';
import type { TerrainReader } from '@systems/terrain/reader';
import type { PathingReader } from '@core/readers';
import { SEASON_NAMES, seasonOf } from '@core/calendar';
import {
  CAVE_RETURN_TICKS,
  CAVE_SEEK_RADIUS,
  RESTLESS_PER_NIGHT_MAX,
  RESTLESS_PER_NIGHT_MIN,
  WEB_TICKS,
} from './constants';
import { findAdjacentLockedDoor } from './ai';

export interface CavernMonsterInfo {
  tier: number;
  species: string;
  lairTile: TileIndex;
  noTargetTicks: number;
}

export interface CavernSpawnRow {
  tier: number;
  species: string;
  initial?: string;
  cap: number;
  respawnPermille: number;
}

/**
 * Returns all walkable floor tiles in the given cavern tier band.
 */
export function getWalkableCavernTiles(
  map: Map3D,
  pathing: PathingReader | undefined,
  tier: number,
): TileIndex[] {
  if (!map || typeof map.kindAt !== 'function' || typeof map.index !== 'function') return [];
  const band = CAVERN_BANDS[tier];
  if (!band) return [];
  const out: TileIndex[] = [];
  for (let z = band[0]; z <= band[1]; z++) {
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        const i = map.index(x, y, z);
        const fluid = typeof map.fluidLevelAt === 'function' ? map.fluidLevelAt(i) : 0;
        if (map.kindAt(i) === TileKind.Floor && fluid === 0) {
          if (!pathing || pathing.passable(i, 'walker')) {
            out.push(i);
          }
        }
      }
    }
  }
  return out;
}

/**
 * Spawns initial cavern spawns placed asleep at random walkable tiles in each cavern band.
 */
export function spawnInitialCavernMonsters(
  world: WorldLike,
  registry: Registry,
  rng: RngStream,
  traits: readonly string[],
  monsterInfo: Map<EntityId, CavernMonsterInfo>,
  webs: Map<TileIndex, EntityId>,
  pathing?: PathingReader,
): void {
  const spawns = registry.derived<readonly CavernSpawnRow[]>('cavernSpawns');
  const speciesTable = registry.table<{
    id: string;
    flags?: { stealth?: boolean; breaksDoors?: boolean; magmaSafe?: boolean };
  }>('creatures');

  for (let tier = 1; tier <= 3; tier++) {
    const tiles = getWalkableCavernTiles(world.map, pathing, tier);
    if (tiles.length === 0) continue;

    const rows = spawns.filter((r) => r.tier === tier);
    for (const r of rows) {
      if (r.species === 'cave_crawler') {
        // "2 packs of 3–5"
        for (let p = 0; p < 2; p++) {
          const center = tiles[rng.int(0, tiles.length - 1)] ?? tiles[0] ?? 0;
          const packSize = rng.int(3, 5);
          const neighbors =
            typeof world.map.neighbors8 === 'function' ? world.map.neighbors8(center) : [];
          const packTiles = [center, ...neighbors].filter((t) => {
            const fluid = typeof world.map.fluidLevelAt === 'function' ? world.map.fluidLevelAt(t) : 0;
            return world.map.kindAt(t) === TileKind.Floor && fluid === 0;
          });
          for (let k = 0; k < packSize; k++) {
            const tile = packTiles[k % packTiles.length] ?? center;
            const spIdx = speciesTable.index(r.species);
            const id = world.services.spawn.creature(spIdx, tile, 'hostile:cavern');
            if (id !== 0) {
              world.entities.add(id, C.Hostile, {
                partyId: 0,
                role: 'cavern_monster',
                behaviorState: 'asleep',
                stealthed: false,
                spotted: false,
                breakingDoorId: 0,
                breakingSince: 0,
              });
              monsterInfo.set(id, { tier, species: r.species, lairTile: tile, noTargetTicks: 0 });
            }
          }
        }
      } else if (r.species === 'giant_cave_spider') {
        // "2"
        for (let k = 0; k < 2; k++) {
          const tile = tiles[rng.int(0, tiles.length - 1)] ?? tiles[0] ?? 0;
          const spIdx = speciesTable.index(r.species);
          const id = world.services.spawn.creature(spIdx, tile, 'hostile:cavern');
          if (id !== 0) {
            world.entities.add(id, C.Hostile, {
              partyId: 0,
              role: 'cavern_monster',
              behaviorState: 'asleep',
              stealthed: true,
              spotted: false,
              breakingDoorId: 0,
              breakingSince: 0,
            });
            monsterInfo.set(id, { tier, species: r.species, lairTile: tile, noTargetTicks: 0 });
            // Spin initial webs around lair
            const neighbors =
              typeof world.map.neighbors8 === 'function' ? world.map.neighbors8(tile) : [];
            for (const n of neighbors) {
              const fluid = typeof world.map.fluidLevelAt === 'function' ? world.map.fluidLevelAt(n) : 0;
              if (world.map.kindAt(n) === TileKind.Floor && fluid === 0) {
                if (typeof world.map.setFlag === 'function') {
                  world.map.setFlag(n, TileFlag.Web, true);
                }
                webs.set(n, id);
              }
            }
          }
        }
      } else if (r.species === 'blind_stalker') {
        // "3"
        for (let k = 0; k < 3; k++) {
          const tile = tiles[rng.int(0, tiles.length - 1)] ?? tiles[0] ?? 0;
          const spIdx = speciesTable.index(r.species);
          const id = world.services.spawn.creature(spIdx, tile, 'hostile:cavern');
          if (id !== 0) {
            world.entities.add(id, C.Hostile, {
              partyId: 0,
              role: 'cavern_monster',
              behaviorState: 'asleep',
              stealthed: true,
              spotted: false,
              breakingDoorId: 0,
              breakingSince: 0,
            });
            monsterInfo.set(id, { tier, species: r.species, lairTile: tile, noTargetTicks: 0 });
          }
        }
      } else if (r.species === 'troll') {
        // "2"
        for (let k = 0; k < 2; k++) {
          const tile = tiles[rng.int(0, tiles.length - 1)] ?? tiles[0] ?? 0;
          const spIdx = speciesTable.index(r.species);
          const id = world.services.spawn.creature(spIdx, tile, 'hostile:cavern');
          if (id !== 0) {
            world.entities.add(id, C.Hostile, {
              partyId: 0,
              role: 'cavern_monster',
              behaviorState: 'asleep',
              stealthed: false,
              spotted: false,
              breakingDoorId: 0,
              breakingSince: 0,
            });
            monsterInfo.set(id, { tier, species: r.species, lairTile: tile, noTargetTicks: 0 });
          }
        }
      } else if (r.species === 'magma_wyrm') {
        // "1 with wyrm_roost, else 0"
        if (traits.includes('wyrm_roost')) {
          const tile = tiles[rng.int(0, tiles.length - 1)] ?? tiles[0] ?? 0;
          const spIdx = speciesTable.index(r.species);
          const id = world.services.spawn.creature(spIdx, tile, 'hostile:cavern');
          if (id !== 0) {
            world.entities.add(id, C.Hostile, {
              partyId: 0,
              role: 'cavern_monster',
              behaviorState: 'asleep',
              stealthed: false,
              spotted: false,
              breakingDoorId: 0,
              breakingSince: 0,
            });
            monsterInfo.set(id, { tier, species: r.species, lairTile: tile, noTargetTicks: 0 });
          }
        }
      }
    }
  }
}

/**
 * Wakes all sleeping cavern monsters of the specified tier on CavernBreached.
 */
export function wakeCavernMonsters(
  world: WorldLike,
  tier: number,
  monsterInfo: Map<EntityId, CavernMonsterInfo>,
): void {
  for (const [id, info] of monsterInfo) {
    if (!world.entities.alive(id)) continue;
    if (info.tier === tier) {
      const H = world.entities.get(id, C.Hostile);
      if (H && H.behaviorState === 'asleep') {
        H.behaviorState = 'wander';
        world.emit({ type: 'MonsterSpawned', id, cavern: tier });
      }
    }
  }
}

/**
 * Checks if a dwarf enters within 12 tiles of a sleeping monster (e.g. wyrm_roost or sunken_halls).
 */
export function checkProximityWake(
  ctx: TickContext,
  monsterInfo: Map<EntityId, CavernMonsterInfo>,
): void {
  const entities = ctx.world.entities;
  const dwarves = entities.with(C.Brain, C.Position).flatMap((id) => {
    const pos = entities.get(id, C.Position);
    return pos === undefined ? [] : [pos];
  });

  for (const [id] of monsterInfo) {
    if (!entities.alive(id)) continue;
    const H = entities.get(id, C.Hostile);
    if (!H || H.behaviorState !== 'asleep') continue;

    const mPos = entities.get(id, C.Position);
    if (!mPos) continue;

    for (const dPos of dwarves) {
      const dist = Math.max(
        Math.abs(dPos.x - mPos.x),
        Math.abs(dPos.y - mPos.y),
        Math.abs(dPos.z - mPos.z),
      );
      if (dist <= 12) {
        H.behaviorState = 'wander';
        break;
      }
    }
  }
}

/**
 * Daily respawn for breached caverns toward species caps.
 */
export function dailyCavernRespawn(
  ctx: TickContext,
  rng: RngStream,
  traits: readonly string[],
  monsterInfo: Map<EntityId, CavernMonsterInfo>,
  webs: Map<TileIndex, EntityId>,
): void {
  if (!ctx.readers.has('03')) return;
  const terrain = ctx.readers.of<TerrainReader>('03');
  const registry = ctx.registry;
  const spawns = registry.derived<readonly CavernSpawnRow[]>('cavernSpawns');
  const speciesTable = registry.table<{
    id: string;
    flags?: { stealth?: boolean; breaksDoors?: boolean };
  }>('creatures');

  // Collect dwarf positions
  const dwarfTiles: TileIndex[] = [];
  for (const d of ctx.world.entities.with(C.Brain, C.Position)) {
    const p = ctx.world.entities.get(d, C.Position);
    if (p) dwarfTiles.push(ctx.world.map.index(p.x, p.y, p.z));
  }

  for (let tier = 1; tier <= 3; tier++) {
    if (!terrain.cavernBreached(tier)) continue;

    const tiles = getWalkableCavernTiles(ctx.world.map, ctx.readers.pathing, tier);
    if (tiles.length === 0) continue;

    const rows = spawns.filter((r) => r.tier === tier);
    for (const r of rows) {
      if (r.respawnPermille <= 0) continue;

      let cap = r.cap;
      if (traits.includes('fungal_depths')) {
        cap = Math.floor(cap * 1.5);
      }

      // Count living monsters of this species in this tier
      let currentCount = 0;
      for (const [id, info] of monsterInfo) {
        if (ctx.world.entities.alive(id) && info.tier === tier && info.species === r.species) {
          currentCount++;
        }
      }

      if (currentCount >= cap) continue;

      if (!rng.chance(r.respawnPermille)) continue;

      // Filter tiles at least SPAWN_MIN_DISTANCE (24) away from dwarves
      const candidates = tiles.filter((t) => {
        const tx = ctx.world.map.xOf(t);
        const ty = ctx.world.map.yOf(t);
        const tz = ctx.world.map.zOf(t);
        for (const dt of dwarfTiles) {
          const dx = Math.abs(ctx.world.map.xOf(dt) - tx);
          const dy = Math.abs(ctx.world.map.yOf(dt) - ty);
          const dz = Math.abs(ctx.world.map.zOf(dt) - tz);
          if (Math.max(dx, dy, dz) < 24) return false;
        }
        return true;
      });

      const spawnTiles = candidates.length > 0 ? candidates : tiles;
      const spawnTile = spawnTiles[rng.int(0, spawnTiles.length - 1)] ?? spawnTiles[0] ?? 0;

      const spIdx = speciesTable.index(r.species);
      const id = ctx.world.services.spawn.creature(spIdx, spawnTile, 'hostile:cavern');
      if (id !== 0) {
        const hasStealth = speciesTable.byIndex(spIdx)?.flags?.stealth === true;
        ctx.world.entities.add(id, C.Hostile, {
          partyId: 0,
          role: 'cavern_monster',
          behaviorState: 'wander',
          stealthed: hasStealth,
          spotted: false,
          breakingDoorId: 0,
          breakingSince: 0,
        });
        monsterInfo.set(id, { tier, species: r.species, lairTile: spawnTile, noTargetTicks: 0 });

        if (r.species === 'giant_cave_spider') {
          for (const n of ctx.world.map.neighbors8(spawnTile)) {
            if (ctx.world.map.kindAt(n) === TileKind.Floor && ctx.world.map.fluidLevelAt(n) === 0) {
              ctx.world.map.setFlag(n, TileFlag.Web, true);
              webs.set(n, id);
            }
          }
        }

        ctx.emit({
          type: 'MonsterSpawned',
          id,
          cavern: tier,
        });
      }
    }
  }
}

/**
 * Giant cave spider spins web on 8 tiles around its lair each day.
 */
export function spinSpiderWebs(
  ctx: TickContext,
  monsterInfo: Map<EntityId, CavernMonsterInfo>,
  webs: Map<TileIndex, EntityId>,
): void {
  for (const [id, info] of monsterInfo) {
    if (!ctx.world.entities.alive(id) || info.species !== 'giant_cave_spider') continue;
    const pos = ctx.world.entities.get(id, C.Position);
    const center = pos ? ctx.world.map.index(pos.x, pos.y, pos.z) : info.lairTile;
    const webbed: TileIndex[] = [];

    for (const n of ctx.world.map.neighbors8(center)) {
      if (ctx.world.map.kindAt(n) === TileKind.Floor && ctx.world.map.fluidLevelAt(n) === 0) {
        ctx.world.map.setFlag(n, TileFlag.Web, true);
        webs.set(n, id);
        webbed.push(n);
      }
    }
    if (webbed.length > 0) {
      ctx.emit({ type: 'WebSpun', tiles: webbed });
    }
  }
}

/**
 * Web entangles creatures that step on it for WEB_TICKS.
 */
export function handleWebEntangle(
  ctx: TickContext,
  moves: readonly [EntityId, TileIndex, TileIndex][],
): void {
  for (const [id, _from, to] of moves) {
    if (to >= 0 && ctx.world.map.hasFlag(to, TileFlag.Web)) {
      const creature = ctx.world.entities.get(id, C.Creature);
      if (creature) {
        const spTable = ctx.registry.table<{ id: string }>('creatures');
        const spRow = spTable.byIndex(creature.species);
        if (spRow?.id !== 'giant_cave_spider') {
          const m = ctx.world.entities.get(id, C.Motion);
          if (m) {
            ctx.world.entities.add(id, C.Motion, {
              ...m,
              waitUntil: Math.max(m.waitUntil, ctx.tick + WEB_TICKS),
            });
          }
        }
      }
    }
  }
}

/**
 * Restless dead dusk rising and dawn collapse on old_battlefield autumn nights.
 */
export function handleRestlessDeadHour(
  ctx: TickContext,
  rng: RngStream,
  renown: number,
  traits: readonly string[],
  wasDaylight: boolean,
  isDaylight: boolean,
): void {
  if (!traits.includes('old_battlefield')) return;

  const season = SEASON_NAMES[seasonOf(ctx.tick)];
  if (season !== 'autumn') return;

  // Dusk: was daylight, now night
  if (wasDaylight && !isDaylight) {
    riseRestlessDead(ctx, rng, renown);
  }
  // Dawn: was night, now daylight
  else if (!wasDaylight && isDaylight) {
    collapseRestlessDead(ctx);
  }
}

export function riseRestlessDead(
  ctx: TickContext,
  rng: RngStream,
  renown: number,
): void {
  const count = Math.min(
    RESTLESS_PER_NIGHT_MAX,
    Math.max(RESTLESS_PER_NIGHT_MIN, Math.floor(2 + (renown / 100) * 6)),
  );

  const map = ctx.world.map;
  const outdoorTiles: TileIndex[] = [];

  for (let y = 0; y < map.h; y++) {
    for (let x = 0; x < map.w; x++) {
      const z = map.columnSurfaceZ(x, y);
      if (z >= 0) {
        const i = map.index(x, y, z);
        if (
          map.kindAt(i) === TileKind.Floor &&
          map.fluidLevelAt(i) === 0 &&
          map.hasFlag(i, TileFlag.Outdoor)
        ) {
          outdoorTiles.push(i);
        }
      }
    }
  }

  if (outdoorTiles.length === 0) return;

  const spTable = ctx.registry.table<{ id: string }>('creatures');
  const spIdx = spTable.index('restless_dead');

  for (let k = 0; k < count; k++) {
    const tile = outdoorTiles[rng.int(0, outdoorTiles.length - 1)] ?? outdoorTiles[0] ?? 0;
    const id = ctx.world.services.spawn.creature(spIdx, tile, 'hostile:undead');
    if (id !== 0) {
      ctx.world.entities.add(id, C.Hostile, {
        partyId: 0,
        role: 'restless',
        behaviorState: 'attack',
        stealthed: false,
        spotted: true,
        breakingDoorId: 0,
        breakingSince: 0,
      });

      // 30% chance of rusted weapon
      if (rng.chance(300)) {
        const itemsTable = ctx.registry.table<{ id: string }>('items');
        const materialsTable = ctx.registry.table<{ id: string }>('materials');
        const swordIdx = itemsTable.index('short_sword');
        const ironIdx = materialsTable.index('iron');
        if (swordIdx >= 0 && ironIdx >= 0) {
          const weaponId = ctx.world.services.spawn.item(swordIdx, ironIdx, tile, 1, 0);
          if (weaponId !== 0) {
            ctx.world.entities.add(id, C.Equipment, {
              weapon: weaponId,
              shield: 0,
              armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
              clothing: { body: 0, legs: 0, feet: 0, over: 0 },
              quiver: 0,
            });
            ctx.world.services.items?.attachToCarrier(weaponId, id);
          }
        }
      }

      // Target nearest fortress creature
      let nearestTarget = 0;
      let minDist = Infinity;
      for (const d of ctx.world.entities.with(C.Brain, C.Position)) {
        const p = ctx.world.entities.get(d, C.Position);
        if (p) {
          const dist = Math.max(
            Math.abs(p.x - map.xOf(tile)),
            Math.abs(p.y - map.yOf(tile)),
            Math.abs(p.z - map.zOf(tile)),
          );
          if (dist < minDist) {
            minDist = dist;
            nearestTarget = d;
          }
        }
      }
      if (nearestTarget !== 0) {
        ctx.world.services.combat?.setTarget(id, nearestTarget);
      }
    }
  }

  ctx.emit({ type: 'RestlessRose', count });
}

export function collapseRestlessDead(ctx: TickContext): void {
  const toDestroy: EntityId[] = [];
  const spTable = ctx.registry.table<{ id: string }>('creatures');

  for (const id of ctx.world.entities.with(C.Creature)) {
    const c = ctx.world.entities.get(id, C.Creature);
    if (!c) continue;
    const spRow = spTable.byIndex(c.species);
    const H = ctx.world.entities.get(id, C.Hostile);
    if (spRow?.id === 'restless_dead' || H?.role === 'restless') {
      toDestroy.push(id);
    }
  }

  const itemsTable = ctx.registry.table<{ id: string }>('items');
  const materialsTable = ctx.registry.table<{ id: string }>('materials');
  const boneIdx = itemsTable.index('bone_pile');
  const matIdx = materialsTable.index('bone');

  for (const id of toDestroy) {
    const pos = ctx.world.entities.get(id, C.Position);
    const tile = pos ? ctx.world.map.index(pos.x, pos.y, pos.z) : 0;
    if (tile >= 0 && boneIdx >= 0 && matIdx >= 0) {
      ctx.world.services.spawn.item(boneIdx, matIdx, tile, 1, 0);
    }
    // 18 § Party composition: what it wears and carries drops on its tile, as at any other death.
    const items = ctx.world.services.items;
    if (items !== null && items !== undefined && pos !== undefined) {
      const equip = ctx.world.entities.get(id, C.Equipment);
      const worn = equip === undefined ? [] :
        [equip.weapon, equip.shield, equip.quiver, ...Object.values(equip.armor), ...Object.values(equip.clothing)];
      const carried = ctx.readers.has('13') ? ctx.readers.of<{ carriedItems(id: EntityId): EntityId[] }>('13').carriedItems(id) : [];
      for (const itemId of new Set([...worn, ...carried])) if (itemId !== 0) items.dropAt(itemId, tile);
    }
    ctx.emit({ type: 'CreatureDied', id, species: 'restless_dead', tile });
    ctx.world.entities.destroy(id);
  }
}

/**
 * Finds the nearest walkable tile in the cavern band to return to.
 */
function findNearestWalkableTileInBand(
  myTile: TileIndex,
  band: readonly [number, number],
  ctx: TickContext,
): TileIndex {
  const map = ctx.world.map;
  const pathing = ctx.readers.pathing;
  const myX = map.xOf(myTile);
  const myY = map.yOf(myTile);

  let bestTile = -1;
  let bestDist = Infinity;

  for (let z = band[0]; z <= band[1]; z++) {
    for (let dy = -15; dy <= 15; dy++) {
      for (let dx = -15; dx <= 15; dx++) {
        const x = myX + dx;
        const y = myY + dy;
        if (!map.inBounds(x, y, z)) continue;
        const i = map.index(x, y, z);
        if (map.kindAt(i) === TileKind.Floor && map.fluidLevelAt(i) === 0) {
          if (!pathing || pathing.passable(i, 'walker')) {
            const dist = Math.abs(dx) + Math.abs(dy);
            if (dist < bestDist) {
              bestDist = dist;
              bestTile = i;
            }
          }
        }
      }
    }
  }

  return bestTile;
}

/**
 * Picks a random walkable tile within the cavern band.
 */
function pickRandomCavernTileInBand(
  myTile: TileIndex,
  band: readonly [number, number],
  ctx: TickContext,
  rng: RngStream,
): TileIndex {
  const map = ctx.world.map;
  const pathing = ctx.readers.pathing;
  const myX = map.xOf(myTile);
  const myY = map.yOf(myTile);
  const myZ = Math.max(band[0], Math.min(band[1], map.zOf(myTile)));

  const candidates: TileIndex[] = [];

  for (let dy = -10; dy <= 10; dy++) {
    for (let dx = -10; dx <= 10; dx++) {
      const x = myX + dx;
      const y = myY + dy;
      if (!map.inBounds(x, y, myZ)) continue;
      const i = map.index(x, y, myZ);
      if (map.kindAt(i) === TileKind.Floor && map.fluidLevelAt(i) === 0) {
        if (!pathing || pathing.passable(i, 'walker')) {
          candidates.push(i);
        }
      }
    }
  }

  if (candidates.length === 0) return -1;
  return candidates[rng.int(0, candidates.length - 1)] ?? candidates[0] ?? -1;
}

/**
 * Steps cavern monsters: seeking fortress creatures, wandering in band, or returning to band.
 */
export function stepCavernMonsters(
  ctx: TickContext,
  rng: RngStream,
  monsterInfo: Map<EntityId, CavernMonsterInfo>,
): void {
  const map = ctx.world.map;
  const entities = ctx.world.entities;
  const spTable = ctx.registry.table<{
    id: string;
    temper?: string;
    breaksDoors?: boolean;
    flags?: { breaksDoors?: boolean };
  }>('creatures');

  checkProximityWake(ctx, monsterInfo);
  // Monster movement cannot move fortress targets: share their stable positions for this pass.
  const fortress = new Map<number, { id: EntityId; pos: { x: number; y: number; z: number } }[]>();
  for (const id of entities.with(C.Position, C.Creature)) {
    if (entities.get(id, C.Creature)?.faction !== 'fortress') continue;
    const pos = entities.get(id, C.Position);
    if (pos === undefined) continue;
    const label = ctx.readers.pathing.labelOf(map.index(pos.x, pos.y, pos.z), 'walker');
    if (label === 0) continue;
    let targets = fortress.get(label);
    if (targets === undefined) { targets = []; fortress.set(label, targets); }
    targets.push({ id, pos });
  }

  for (const [m, info] of monsterInfo) {
    if (!entities.alive(m)) continue;
    const H = entities.get(m, C.Hostile);
    if (!H || H.behaviorState === 'asleep') continue;

    const pos = entities.get(m, C.Position);
    if (!pos) continue;
    const myTile = map.index(pos.x, pos.y, pos.z);
    const band = CAVERN_BANDS[info.tier] ?? [pos.z, pos.z];

    const creature = entities.get(m, C.Creature);
    const spRow = creature ? spTable.byIndex(creature.species) : undefined;
    const breaksDoors = spRow?.flags?.breaksDoors === true || spRow?.breaksDoors === true;

    // 1. Check current combat target
    const currentTarget = ctx.world.services.combat?.targetOf(m) ?? 0;
    if (currentTarget !== 0 && entities.alive(currentTarget)) {
      info.noTargetTicks = 0;
      H.behaviorState = 'attack';
      if (breaksDoors) {
        const lockedDoor = findAdjacentLockedDoor(myTile, ctx);
        if (lockedDoor !== 0) {
          H.breakingDoorId = lockedDoor;
          ctx.emit({ type: 'DoorBreakAttempt', id: m, doorId: lockedDoor });
        } else {
          H.breakingDoorId = 0;
        }
      }
      continue;
    }

    // 2. No target
    info.noTargetTicks += 1;

    // 3. Aggressive seek check:
    // Fortress creatures within CAVE_SEEK_RADIUS (30) of any cavern tile
    if (spRow?.temper === 'aggressive') {
      let bestTarget = 0;
      let bestDist = Infinity;
      const label = ctx.readers.pathing.labelOf(myTile, 'walker');

      for (const { id: c, pos: cPos } of fortress.get(label) ?? []) {

        // Distance to cavern band: z distance if outside band, 0 if inside band
        const zDist =
          cPos.z < band[0] ? band[0] - cPos.z : cPos.z > band[1] ? cPos.z - band[1] : 0;
        if (zDist <= CAVE_SEEK_RADIUS) {
          // Check reachability
          if (
            ctx.world.services.movement &&
            label !== 0
          ) {
            const dist = Math.max(
              Math.abs(cPos.x - pos.x),
              Math.abs(cPos.y - pos.y),
              Math.abs(cPos.z - pos.z),
            );
            if (dist < bestDist) {
              bestDist = dist;
              bestTarget = c;
            }
          }
        }
      }

      if (bestTarget !== 0) {
        info.noTargetTicks = 0;
        const to = entities.get(bestTarget, C.Position);
        const near = to !== undefined && Math.max(Math.abs(to.x - pos.x), Math.abs(to.y - pos.y)) <= PERCEPTION_RADIUS && Math.abs(to.z - pos.z) <= 2;
        if (near || to === undefined) {
          ctx.world.services.combat?.setTarget(m, bestTarget);
        } else {
          // 16 keeps no target out of perception: until it is in reach of one, the monster walks.
          const movement = ctx.world.services.movement;
          if (H.behaviorState !== 'seek') movement?.stopWalking(m);
          const walking = movement?.walkTarget(m) ?? -1;
          movement?.walkTo(m, walking >= 0 ? walking : map.index(to.x, to.y, to.z), 'wander', ctx);
        }
        H.behaviorState = 'seek';
        continue;
      }
    }

    // 4. Outside cavern band and no target for CAVE_RETURN_TICKS -> return!
    const isInsideBand = pos.z >= band[0] && pos.z <= band[1];
    if (!isInsideBand && info.noTargetTicks >= CAVE_RETURN_TICKS) {
      H.behaviorState = 'return';
      const returnTile = findNearestWalkableTileInBand(myTile, band, ctx);
      if (returnTile >= 0) {
        ctx.world.services.movement?.walkTo(m, returnTile, 'wander', ctx);
      }
      continue;
    }

    // 5. Inside cavern band -> wander
    // "monsters wander their cavern"
    // "monsters do not leave the band without a target"
    H.behaviorState = 'wander';
    if (isInsideBand) {
      const walkTarget = ctx.world.services.movement?.walkTarget(m) ?? -1;
      const targetZ = walkTarget >= 0 ? map.zOf(walkTarget) : -1;
      if (walkTarget < 0 || targetZ < band[0] || targetZ > band[1]) {
        const wanderTile = pickRandomCavernTileInBand(myTile, band, ctx, rng);
        if (wanderTile >= 0) {
          ctx.world.services.movement?.walkTo(m, wanderTile, 'wander', ctx);
        }
      }
    }
  }
}
