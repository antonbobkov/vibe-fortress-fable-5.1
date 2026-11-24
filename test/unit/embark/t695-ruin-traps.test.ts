/**
 * T-695: a ruin's traps and mechanisms stand on the next embark (02 § Ruins, 14 § Wrecks, 19 § Trap
 * targeting). Levers, plates, floodgates, drawbridges and most traps stand as wrecks, their links
 * lost; a few weapon, cage and stone-fall traps stay armed with their loaded items weathered, owned
 * by no faction, so they spring on anyone, the new expedition's dwarves too, until the fortress
 * chooses their mode or takes them apart.
 */
import { describe, expect, it } from 'vitest';
import { HeadlessGame } from '@app/headless';
import { loadGame, saveGame } from '@app/game-save';
import { composeRuin } from '@app/ruins';
import { InProcessHost } from '@app/sim-host';
import { ThingLayers } from '@render/things';
import { C, type Building, type Item, type Position } from '@core/components';
import { WORLD_SIZE_SMALL } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import { contentRegistry } from '@content/loader';
import { BuildingsSystem, type BuildingsReader } from '@systems/buildings';
import { DefenseSystem, type DefenseReader } from '@systems/defense';
import { localMapSpec, RUIN_TRAP_ARMED_PERMILLE } from '@systems/embark';
import { ruinsOf, withRuin } from '@systems/terrain/generate/ruins';
import { generate, type RuinRecord, type RuinWreck, type WorldMap } from '@systems/worldgen';
import { palette } from '../ui/ui-fixture';

const registry = contentRegistry();
const world: WorldMap = generate('t686-world', WORLD_SIZE_SMALL, registry);
const embarkable = world.regions.filter((r) => registry.table<{ id: string; embarkable: boolean }>('biomes').byId(r.biome)?.embarkable === true);
const site = embarkable[0]!;
const other = embarkable[1]!;
const items = registry.table<{ id: string }>('items');
const materials = registry.table<{ id: string }>('materials');
const buildingTypes = registry.table<{ id: string }>('buildings');

function embarkOn(w: WorldMap, regionId: number): HeadlessGame {
  return new HeadlessGame({ seed: w.seed, world: 'local', spec: localMapSpec(w, regionId, registry), embark: 'default', ruins: ruinsOf(w, regionId) });
}

function system(game: HeadlessGame): BuildingsSystem {
  return game.world.scheduler.inOrder().find((s) => s instanceof BuildingsSystem) as BuildingsSystem;
}

function defense(game: HeadlessGame): DefenseReader {
  return game.world.readers.of<DefenseReader>('19');
}

function buildingAt(game: HeadlessGame, tile: number): { id: number; b: Building; type: string } | undefined {
  const id = game.map.buildingAtTile(tile);
  const b = id === 0 ? undefined : game.world.entities.get<Building>(id, C.Building);
  return b === undefined ? undefined : { id, b, type: buildingTypes.byIndex(b.type)?.id ?? '' };
}

/**
 * The origins of free rows of surface floor near the wagon, one of each width in `widths`, each with a
 * free ring around it: the same tiles on every embark on the site, since the map is generated again.
 */
function spots(game: HeadlessGame, widths: readonly number[]): number[] {
  const map = game.map;
  const wagon = game.arrival!.wagon;
  const taken = new Set<number>();
  for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) taken.add(map.index(wagon.x + dx, wagon.y + dy, wagon.z));
  const out: number[] = [];
  for (const width of widths) {
    let found = -1;
    for (let r = 3; r <= 16 && found < 0; r += 1) {
      for (let dy = -r; dy <= r && found < 0; dy += 1) {
        for (let dx = -r; dx <= r && found < 0; dx += 1) {
          const x = wagon.x + dx;
          const y = wagon.y + dy;
          if (x < 1 || y < 1 || x + width >= map.w || y + 1 >= map.h) continue;
          const tiles: number[] = [];
          for (let i = 0; i < width; i += 1) tiles.push(map.index(x + i, y, wagon.z));
          const ring: number[] = [];
          for (let j = -1; j <= 1; j += 1) for (let i = -1; i <= width; i += 1) ring.push(map.index(x + i, y + j, wagon.z));
          if (ring.some((t) => taken.has(t))) continue;
          if (!tiles.every((t) => map.kind[t] === TileKind.Floor && map.buildingAtTile(t) === 0)) continue;
          found = tiles[0]!;
          for (const t of ring) taken.add(t);
        }
      }
    }
    expect(found, `a free floor ${width} wide`).toBeGreaterThanOrEqual(0);
    out.push(found);
  }
  return out;
}

/** Place a building and finish it at once, as `TestWorld.build` does. */
function build(game: HeadlessGame, type: string, origin: number, material: string, size?: { width: number; height: number }): number {
  const store = system(game).buildings;
  for (let i = 0; i < (size?.width ?? 1); i += 1) {
    const t = game.map.offset(origin, i, 0, 0);
    game.map.flags[t] = (game.map.flags[t] as number) | TileFlag.Discovered;
  }
  let placed = 0;
  const result = store.place({ type: 'PlaceBuilding', buildingType: type, origin, orientation: 0, materialChoice: material, ...(size ?? {}) }, (id) => { placed = id; });
  expect(result, `${type} ${JSON.stringify(result)}`).toMatchObject({ ok: true });
  system(game).completeNow(placed, materials.index(material));
  expect(store.get(placed)!.state).toBe('built');
  return placed;
}

interface Old { game: HeadlessGame; weapon: number; cage: number; stone: number; spike: number; lever: number; plate: number; gate: number; bridge: number }

/** A first fortress with its gate's traps and mechanisms on the surface by the wagon. */
function firstFortress(): Old {
  const game = embarkOn(world, site.id);
  const [weapon, cage, stone, spike, lever, plate, gate, bridge] = spots(game, [1, 1, 1, 1, 1, 1, 1, 3]) as [number, number, number, number, number, number, number, number];
  build(game, 'weapon_trap', weapon, 'iron');
  build(game, 'cage_trap', cage, 'iron');
  build(game, 'stone_fall_trap', stone, 'granite');
  build(game, 'spike_trap', spike, 'iron');
  build(game, 'lever', lever, 'granite');
  build(game, 'pressure_plate', plate, 'granite');
  build(game, 'floodgate_building', gate, 'granite');
  build(game, 'drawbridge', bridge, 'granite', { width: 3, height: 1 });
  // 19 registers the traps on the tick's BuildingCompleted.
  game.step(1);
  expect(defense(game).trapState(game.map.buildingAtTile(weapon))).toBe('armed');
  return { game, weapon, cage, stone, spike, lever, plate, gate, bridge };
}

function entryAt(ruin: RuinRecord, tile: number): RuinWreck | undefined {
  return ruin.wrecks?.find((w) => w.tile === tile);
}

/** The ruin of `old` with its weapon and cage traps still armed, as the stream might leave them. */
function armedRuin(old: Old): RuinRecord {
  const ruin = composeRuin(old.game, world, registry)!;
  const arm = (w: RuinWreck): RuinWreck => {
    if (w.tile === old.weapon) return { ...w, loaded: [{ type: 'bow', material: 'iron', quality: 0 }] };
    if (w.tile === old.cage) return { ...w, loaded: [{ type: 'cage', material: 'iron', quality: 0 }] };
    return w;
  };
  return { ...ruin, wrecks: (ruin.wrecks ?? []).map(arm) };
}

/** The items of a type lying on a tile, in units. */
function unitsAt(game: HeadlessGame, tile: number, type: string): number {
  const at = game.map.unpack(tile);
  let n = 0;
  for (const id of game.world.entities.with(C.Item, C.Position)) {
    const pos = game.world.entities.get<Position>(id, C.Position)!;
    const item = game.world.entities.get<Item>(id, C.Item)!;
    if (pos.x === at.x && pos.y === at.y && pos.z === at.z && item.type === items.index(type)) n += item.count;
  }
  return n;
}

function dwarves(game: HeadlessGame): number[] {
  return game.world.entities.with(C.Labors, C.Position);
}

describe('T-695: a ruin\'s traps still stand, some still armed', () => {
  it('a ruin keeps its mechanisms and traps as wrecks, and an armed trap with its loaded items weathered', () => {
    const old = firstFortress();
    const ruin = composeRuin(old.game, world, registry)!;
    // Levers, plates and floodgates hold nothing: their one mechanism or floodgate was the first unit.
    for (const [tile, type] of [[old.lever, 'lever'], [old.plate, 'pressure_plate'], [old.gate, 'floodgate_building']] as const) {
      expect(entryAt(ruin, tile)).toEqual({ tile, type, orientation: 0, material: 'granite', inputs: [] });
    }
    // A drawbridge keeps its size and every second unit: its second block and its mechanism.
    expect(entryAt(ruin, old.bridge)).toMatchObject({ type: 'drawbridge', width: 3, height: 1, inputs: [{ type: 'stone_block', material: 'granite', count: 1 }, { type: 'mechanism', material: 'granite', count: 1 }] });
    // A spike trap is extended only by a link, and links are lost: always a wreck.
    expect(entryAt(ruin, old.spike)).toEqual({ tile: old.spike, type: 'spike_trap', orientation: 0, material: 'iron', inputs: [] });
    // Each armable trap is a wreck holding nothing, or still armed with what it held, a level worse.
    for (const tile of [old.weapon, old.cage, old.stone]) {
      const entry = entryAt(ruin, tile)!;
      const b = old.game.world.entities.get<Building>(old.game.map.buildingAtTile(tile), C.Building)!;
      const held = (b.settings['trapLoaded'] as number[]).map((id) => old.game.world.entities.get<Item>(id, C.Item)!);
      expect(entry.inputs).toEqual([]);
      if (entry.loaded !== undefined) {
        expect(entry.loaded).toEqual(held.map((it) => ({ type: items.byIndex(it.type)!.id, material: materials.byIndex(it.material)!.id, quality: Math.max(0, it.quality - 1) })));
      }
    }
    // The same end leaves the same ruin.
    expect(composeRuin(old.game, world, registry)).toEqual(ruin);
    // A testing fortress leaves no wrecks and no armed traps.
    old.game.world.fortress.testing = true;
    expect(composeRuin(old.game, world, registry)!.wrecks).toBeUndefined();
  }, 120_000);

  it('about one armed trap in four stays armed', () => {
    const game = embarkOn(world, site.id);
    const tiles = spots(game, Array.from({ length: 24 }, () => 1));
    for (const t of tiles) build(game, 'weapon_trap', t, 'iron');
    game.step(1);
    const ruin = composeRuin(game, world, registry)!;
    const armed = (ruin.wrecks ?? []).filter((w) => w.loaded !== undefined).length;
    // RUIN_MECHANISMS_MAX keeps 20 of the 24; RUIN_TRAP_ARMED_PERMILLE arms about a quarter.
    expect(ruin.wrecks?.length).toBe(20);
    expect(armed).toBeGreaterThan(0);
    expect(armed).toBeLessThan(20 * (RUIN_TRAP_ARMED_PERMILLE * 2) / 1000);
    // A spent or jammed trap never stays armed: it is a wreck.
    const traps = (game.world.scheduler.inOrder().find((s) => s instanceof DefenseSystem) as DefenseSystem).traps;
    let k = 0;
    for (const record of traps.values()) record.state = k++ % 2 === 0 ? 'spent' : 'jammed';
    expect((composeRuin(game, world, registry)!.wrecks ?? []).filter((w) => w.loaded !== undefined)).toEqual([]);
  }, 120_000);

  it('the next embark finds the wrecks doing nothing and an armed old trap that springs on a new dwarf', async () => {
    const old = firstFortress();
    const ruin = armedRuin(old);
    const next = embarkOn(withRuin(world, ruin), site.id);
    next.step(1);
    const r = next.world.readers.of<BuildingsReader>('14');
    // The mechanisms and the spike and stone-fall traps stand as wrecks: no links, nothing works.
    for (const tile of [old.lever, old.plate, old.gate, old.spike]) expect(buildingAt(next, tile)!.b.state).toBe('ruined');
    const bridge = buildingAt(next, old.bridge)!;
    expect([bridge.type, bridge.b.state, bridge.b.footprint.length]).toEqual(['drawbridge', 'ruined', 3]);
    for (const t of bridge.b.footprint) expect(r.blocksMovementAt(t, 'walker')).toBe(false);
    expect(next.world.applyCommand({ type: 'PullLever', leverId: buildingAt(next, old.lever)!.id })).toMatchObject({ ok: false });
    // The weapon trap stands built and armed, its bow a level worse, owned by no one.
    const trap = buildingAt(next, old.weapon)!;
    expect([trap.type, trap.b.state]).toEqual(['weapon_trap', 'built']);
    expect(defense(next).trapAt(old.weapon)).toBe(trap.id);
    expect(defense(next).trapState(trap.id)).toBe('armed');
    expect(defense(next).trapMode(trap.id)).toBe('anyone');
    const bow = (trap.b.settings['trapLoaded'] as number[]).map((id) => next.world.entities.get<Item>(id, C.Item)!);
    expect(bow.map((it) => [items.byIndex(it.type)?.id, it.material, it.quality])).toEqual([['bow', materials.index('iron'), 0]]);
    // Drawn red once found, as a locked door is: it springs on the player's dwarves too.
    const things = new ThingLayers(registry, palette, (ch) => ch.codePointAt(0) ?? 0);
    const black = palette.color('black');
    expect(things.buildingOver({ glyph: 0, fg: black, bg: black }, old.weapon, next.world.readers).fg).toEqual(palette.color('red'));
    // A save keeps it.
    const loaded = (await loadGame(await saveGame(next, { kind: 'manual' }))).game;
    expect(loaded.hash()).toBe(next.hash());
    expect(defense(loaded).trapMode(trap.id)).toBe('anyone');
    // The new expedition's first dwarf to step on it is struck.
    const dwarf = dwarves(next)[0]!;
    next.world.services.movement?.teleport(dwarf, old.weapon);
    const struck: unknown[] = [];
    next.world.onEvents((batch) => { for (const e of batch) if (e.type === 'TrapTriggered' && e['trapId'] === trap.id) struck.push(e['creatureId']); });
    next.step(2);
    expect(struck).toContain(dwarf);
  }, 120_000);

  it('an old cage trap cages the new expedition\'s dwarf; a trap the fortress has claimed spares it', () => {
    const old = firstFortress();
    const next = embarkOn(withRuin(world, armedRuin(old)), site.id);
    next.step(1);
    const cage = buildingAt(next, old.cage)!;
    expect(defense(next).trapMode(cage.id)).toBe('anyone');
    const [first, second] = dwarves(next) as [number, number];
    // Claimed: the fortress's own trap, sparing its dwarves as any `enemies` trap does.
    const weapon = buildingAt(next, old.weapon)!;
    expect(next.world.applyCommand({ type: 'SetTrapMode', trapId: weapon.id, mode: 'enemies' })).toEqual({ ok: true });
    expect(next.world.applyCommand({ type: 'SetTrapMode', trapId: weapon.id, mode: 'anyone' })).toMatchObject({ ok: false, reason: 'bad_setting' });
    const caught: number[] = [];
    const struck: number[] = [];
    next.world.onEvents((batch) => {
      for (const e of batch) {
        if (e.type === 'CreatureCaged') caught.push(e['creatureId'] as number);
        if (e.type === 'TrapTriggered' && e['trapId'] === weapon.id) struck.push(e['creatureId'] as number);
      }
    });
    next.world.services.movement?.teleport(first, old.cage);
    next.world.services.movement?.teleport(second, old.weapon);
    next.step(2);
    expect(caught).toEqual([first]);
    expect(next.world.entities.get(first, C.Creature)?.cagedIn).not.toBe(0);
    expect(defense(next).trapState(cage.id)).toBe('spent');
    expect(struck).toEqual([]);
    // No one keeps the spent old cage trap: it is not rearmed.
    next.step(200);
    expect(next.world.readers.of<{ byKey(key: string): unknown }>('11').byKey(`rearm_trap:${cage.id}`)).toBeUndefined();
  }, 120_000);

  it('taken apart, an armed old trap gives back its mechanism and its weapon, a wreck what it holds', () => {
    const old = firstFortress();
    const next = embarkOn(withRuin(world, armedRuin(old)), site.id);
    next.step(1);
    const store = system(next).buildings;
    const trap = buildingAt(next, old.weapon)!;
    const bridge = buildingAt(next, old.bridge)!;
    const lever = buildingAt(next, old.lever)!;
    const at = { trap: store.anchorOf(trap.b), bridge: store.anchorOf(bridge.b), lever: store.anchorOf(lever.b) };
    for (const id of [trap.id, bridge.id, lever.id]) expect(next.world.applyCommand({ type: 'DeconstructBuilding', buildingId: id })).toEqual({ ok: true });
    for (let t = 0; t < 60 && [old.weapon, old.bridge, old.lever].some((tile) => next.map.buildingAtTile(tile) !== 0); t += 1) next.step(100);
    for (const tile of [old.weapon, old.bridge, old.lever]) expect(next.map.buildingAtTile(tile)).toBe(0);
    // Its one mechanism and its one bow: nothing more.
    expect([unitsAt(next, at.trap, 'mechanism'), unitsAt(next, at.trap, 'bow')]).toEqual([1, 1]);
    expect(defense(next).trapAt(old.weapon)).toBe(0);
    // The drawbridge's wreck its block and mechanism; the lever's nothing.
    expect([unitsAt(next, at.bridge, 'stone_block'), unitsAt(next, at.bridge, 'mechanism')]).toEqual([1, 1]);
    expect(unitsAt(next, at.lever, 'mechanism')).toBe(0);
  }, 120_000);

  it('a site with no ended fortress is unchanged', async () => {
    const old = firstFortress();
    const ruined = withRuin(world, armedRuin(old));
    expect(ruined.ruins?.[0]?.wrecks?.some((w) => w.loaded !== undefined)).toBe(true);
    const hashOf = async (w: WorldMap): Promise<string> => {
      const host = new InProcessHost(() => 0);
      await host.newGame({ seed: w.seed, world: 'local', spec: localMapSpec(w, other.id, registry), embark: 'default', worldMap: w });
      return host.headless.hash();
    };
    expect(await hashOf(ruined)).toBe(await hashOf(world));
  }, 60_000);
});
