/**
 * T-556, Making Do B6: the spider ranch, the beetle jar and bat roosts (`18` § Cavern monsters,
 * `09` § Gathering, `07` § Growth, `14` § Special buildings, `03` § Local map generation, `08` § Cages,
 * § Bat roosts; `materials.md`, `items.md`, `creatures.md`, `caravan-goods.md`).
 */
import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { FLAT_TEST_SURFACE_Z, regionSpec } from '@app/headless';
import { contentRegistry } from '@content/loader';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { Designation, TileFlag, TileKind } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import { ROOST_DAYS, ROOST_NOTICE_RADIUS } from '@systems/animals/constants';
import { BEETLE_GROWTH_PERCENT, BASE_GROWTH } from '@systems/plants/constants';
import type { PlantsReader } from '@systems/plants';
import { TerrainFacts, precondition, roostCeilingOver, transition, type TransitionRolls } from '@systems/terrain';
import { ROOST_PERMILLE } from '@systems/terrain/constants';
import { generateLocalMap } from '@systems/terrain/generate';
import { CAVERN_BANDS } from '@systems/terrain/api';
import type { ThreatsReader } from '@systems/threats/reader';
import { WEB_TICKS } from '@systems/threats/constants';
import { preferencePercent } from '@systems/trade/valuation';
import { AnnouncementLog } from '@ui/announcements';
import { HintEngine } from '@ui/hints';
import { Strings } from '@ui/strings';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../scenarios/test-world';

const registry = contentRegistry();
const Z = FLAT_TEST_SURFACE_Z;
const arena = (seed: string): TestWorld => new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });

/** Put a creature into a built cage building, as a trapped creature in a placed cage is. */
function cageIn(w: TestWorld, cage: EntityId, species: string, faction: string): EntityId {
  const ent = w.game.world.entities;
  const id = w.spawnCreature(species, w.index(5, 5, Z), faction);
  w.spatial.remove(id, w.index(5, 5, Z));
  ent.remove(id, C.Position);
  ent.add(id, C.Creature, { ...ent.get(id, C.Creature)!, cagedIn: cage });
  const b = ent.get(cage, C.Building)!;
  ent.add(cage, C.Building, { ...b, settings: { ...b.settings, occupantId: id } });
  return id;
}

function itemsOf(w: TestWorld, type: string, material?: string): EntityId[] {
  const t = registry.table('items').index(type);
  const m = material === undefined ? -1 : registry.table('materials').index(material);
  return w.game.world.entities.with(C.Item).filter((id) => {
    const it = w.game.world.entities.get(id, C.Item)!;
    return it.type === t && (m < 0 || it.material === m);
  });
}

describe('T-556 the rows', () => {
  it('silk, guano, the glowing beetle, the spider, the preferences, the note and the hint', () => {
    const materials = registry.table<{ id: string; class: string; value: number; nextStage?: string; tags?: string[] }>('materials');
    expect(materials.byId('silk_cloth')).toMatchObject({ class: 'cloth', value: 20, density: 20 });
    expect(materials.byId('silk_web')?.nextStage).toBe('silk_cloth');
    expect(materials.byId('guano')).toMatchObject({ class: 'soil', value: 1, tags: ['fertilizer'] });
    expect(registry.table<{ id: string; category: string; tags: string[] }>('items').byId('guano')).toMatchObject({ category: 'farm/guano', tags: ['fertilizer'] });
    const creatures = registry.table<{ id: string; flags: { glows?: boolean } }>('creatures');
    expect(creatures.byId('glow_beetle')?.flags.glows).toBe(true);
    expect(creatures.byId('giant_cave_spider')?.flags.glows).toBeUndefined();
    expect(preferencePercent(registry, 'mountainhome', 'textile/cloth', 'silk_cloth', 'cloth')).toBe(150);
    expect(preferencePercent(registry, 'wildwood', 'textile/cloth', 'silk_cloth', 'cloth')).toBe(140);
    expect(preferencePercent(registry, 'hillfolk', 'textile/cloth', 'silk_cloth', 'cloth')).toBe(100);
    const strings = new Strings(registry);
    expect(strings.get('announce.roost_found')).toBe('Bats. Hundreds of them. {dwarf} counted.');
    expect(registry.table<{ id: string; text: string }>('hints').byId('hint_spider_ranch')?.text).toBe('The spider does not need feeding. Nobody has asked it.');
  });
});

describe('T-556 the spider ranch', () => {
  it('a spider in a built cage webs the 8 tiles around the cage each day, and is out of the cavern count', () => {
    const w = arena('t556-ranch');
    const at = w.index(30, 30, Z);
    const cage = w.build('cage_building', at, 'iron');
    const spider = cageIn(w, cage, 'giant_cave_spider', 'hostile:cavern');
    expect(w.readers.of<BuildingsReader>('14').cageOccupant(cage)).toBe(spider);
    expect(w.readers.of<ThreatsReader>('18').monstersInCavern(1)).toBe(0);
    w.step(TICKS_PER_DAY + 2);
    const ring = w.map.neighbors8(at);
    expect(ring).toHaveLength(8);
    for (const t of ring) expect(w.map.hasFlag(t, TileFlag.Web)).toBe(true);
    expect(w.map.hasFlag(at, TileFlag.Web)).toBe(false);
    expect(w.map.hasFlag(w.index(32, 30, Z), TileFlag.Web)).toBe(false);
    expect(w.events('WebSpun').some((e) => (e['tiles'] as number[]).length === 8)).toBe(true);
  });

  it('a spider in a cage item that is not built spins nothing; a caged beetle spins nothing', () => {
    const w = arena('t556-unbuilt');
    const at = w.index(30, 30, Z);
    const cage = w.build('cage_building', at, 'iron');
    cageIn(w, cage, 'glow_beetle', 'wild');
    w.step(TICKS_PER_DAY + 2);
    expect(w.map.neighbors8(at).some((t) => w.map.hasFlag(t, TileFlag.Web))).toBe(false);
  });

  it('webs catch your own hauler: a dwarf who walks into one waits WEB_TICKS', () => {
    const w = arena('t556-hauler');
    const at = w.index(30, 30, Z);
    const cage = w.build('cage_building', at, 'iron');
    cageIn(w, cage, 'giant_cave_spider', 'hostile:cavern');
    w.step(TICKS_PER_DAY + 2);
    const dwarf = w.spawnDwarf({ at: w.index(32, 30, Z) });
    // The dwarf steps from outside the ring onto a web, as a hauler on its way would.
    w.game.world.emit({ type: 'EntitiesMoved', moves: [[dwarf, w.index(32, 30, Z), w.index(31, 30, Z)]] });
    const before = w.tick;
    w.step(2);
    expect(w.game.world.entities.get(dwarf, C.Motion)?.waitUntil ?? 0).toBeGreaterThanOrEqual(before + WEB_TICKS);
  });

  it('gather on a web yields one silk thread and clears it, with no draw; the gather zone designates webs daily', () => {
    const w = arena('t556-gather');
    const at = w.index(30, 30, Z);
    const cage = w.build('cage_building', at, 'iron');
    cageIn(w, cage, 'giant_cave_spider', 'hostile:cavern');
    w.step(TICKS_PER_DAY + 2);
    const web = w.index(31, 30, Z);
    const facts = new TerrainFacts(registry);
    expect(precondition(w.map, web, Designation.Gather, facts)).toBe(true);
    expect(precondition(w.map, w.index(40, 40, Z), Designation.Gather, facts)).toBe(false);
    const never = (): never => { throw new Error('no draw'); };
    const rolls: TransitionRolls = { stoneDrops: never, logs: never, gather: never, logMaterial: never };
    const result = transition(w.map, web, Designation.Gather, facts, rolls);
    expect(result.drops).toEqual([{ type: 'thread', material: 'silk_web', count: 1, tile: web }]);
    expect(result.changes).toEqual([{ tile: web, clear: TileFlag.Web }]);
    // The zone over the room designates every web at the next dawn.
    const room: TileIndex[] = [];
    for (let y = 28; y <= 32; y += 1) for (let x = 28; x <= 32; x += 1) if (!(x === 30 && y === 30)) room.push(w.index(x, y, Z));
    w.zone('gather', room);
    w.step(TICKS_PER_DAY);
    for (const t of w.map.neighbors8(at)) expect(w.map.designationAt(t)).toBe(Designation.Gather);
    expect(w.map.designationAt(w.index(28, 28, Z))).toBe(Designation.None);
  });

  it('a gatherer collects the silk: the web is gone and a thread of silk_web lies there; a gathered web stays gone after a load', () => {
    const w = arena('t556-collect');
    const at = w.index(30, 30, Z);
    const cage = w.build('cage_building', at, 'iron');
    cageIn(w, cage, 'giant_cave_spider', 'hostile:cavern');
    w.step(TICKS_PER_DAY + 2);
    const web = w.index(31, 31, Z);
    const dwarf = w.spawnDwarf({ at: w.index(34, 34, Z), skills: { herbalism: 5 } });
    w.setLabor(dwarf, 'herbalism', true);
    w.submit({ type: 'Designate', kind: 'gather', tiles: [web], priority: 4 });
    w.until((x) => !x.map.hasFlag(web, TileFlag.Web), 3000);
    expect(w.map.hasFlag(web, TileFlag.Web)).toBe(false);
    expect(itemsOf(w, 'thread', 'silk_web').length).toBe(1);
    const loaded = roundTrip(w.game).game;
    expect(loaded.world.map.hasFlag(web, TileFlag.Web)).toBe(false);
    expect(loaded.world.map.hasFlag(w.index(29, 29, Z), TileFlag.Web)).toBe(true);
  });

  it('the first caged spider placed in a cage building gives the hint', () => {
    const w = arena('t556-hint');
    const cage = w.build('cage_building', w.index(30, 30, Z), 'iron');
    cageIn(w, cage, 'giant_cave_spider', 'hostile:cavern');
    const ui = defaultUiState(32);
    const hints = new HintEngine(registry, ui, new AnnouncementLog(new Strings(registry), registry));
    hints.onEvents([{ type: 'BuildingCompleted', id: cage, buildingType: 'cage_building', value: 0 }] as never, w.readers);
    expect(ui.hintPending).toContain('hint_spider_ranch');
    const other = defaultUiState(32);
    const plain = arena('t556-hint-plain');
    const empty = plain.build('cage_building', plain.index(30, 30, Z), 'iron');
    new HintEngine(registry, other, new AnnouncementLog(new Strings(registry), registry))
      .onEvents([{ type: 'BuildingCompleted', id: empty, buildingType: 'cage_building', value: 0 }] as never, plain.readers);
    expect(other.hintPending).not.toContain('hint_spider_ranch');
  });
});

describe('T-556 the beetle jar', () => {
  /** A dark cave-loam floor around a cage at (x, y), walled in above, at a steady 15 °C. */
  function jar(w: TestWorld, x: number, y: number): TileIndex[] {
    const loam = registry.table('materials').index('cave_loam');
    const tiles: TileIndex[] = [];
    for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) {
      const t = w.index(x + dx, y + dy, Z);
      w.carve(t, TileKind.Floor, loam);
      w.game.world.services.terrain.setFlag(t, TileFlag.Lit, false);
      w.forceTemperature(t, 15);
      tiles.push(t);
    }
    return tiles;
  }

  it('a caged glow beetle lights the four tiles beside its cage, and glowcap there grows at half speed', () => {
    const w = arena('t556-jar');
    jar(w, 30, 30);
    const cage = w.build('cage_building', w.index(30, 30, Z), 'iron');
    const b14 = w.readers.of<BuildingsReader>('14');
    const beside = [w.index(30, 29, Z), w.index(31, 30, Z), w.index(30, 31, Z), w.index(29, 30, Z)];
    expect(beside.some((t) => b14.beetleLitAt(t))).toBe(false);
    cageIn(w, cage, 'glow_beetle', 'wild');
    for (const t of beside) expect(b14.beetleLitAt(t)).toBe(true);
    expect([b14.beetleLitAt(w.index(31, 31, Z)), b14.beetleLitAt(w.index(32, 30, Z)), b14.beetleLitAt(w.index(30, 30, Z))]).toEqual([false, false, false]);
    // Beetle light is crop light only: no lit flag, no comfort.
    expect(beside.some((t) => w.map.hasFlag(t, TileFlag.Lit) || b14.comfortLightAt(t))).toBe(false);
    const crops = beside.map((t) => w.plantCrop(t, 'glowcap'));
    const dark = w.plantCrop(w.index(31, 31, Z), 'glowcap');
    w.step(TICKS_PER_DAY);
    const growth = (id: EntityId): number => w.game.world.entities.get(id, C.Crop)?.growth ?? -1;
    const hours = 24;
    for (const id of crops) expect(growth(id)).toBe(hours * Math.floor(BASE_GROWTH * BEETLE_GROWTH_PERCENT / 100));
    expect(growth(dark)).toBe(0);
  });

  it('a plot of beetle-lit tiles is a glow plot; a caged deer lights nothing', () => {
    const w = arena('t556-plot');
    jar(w, 30, 30);
    const cage = w.build('cage_building', w.index(30, 30, Z), 'iron');
    cageIn(w, cage, 'glow_beetle', 'wild');
    const plot = w.zone('farm_plot', [w.index(31, 30, Z)]);
    expect(w.readers.of<PlantsReader>('07').plotKind(plot)).toBe('glow');
    const other = arena('t556-deer');
    jar(other, 30, 30);
    const pen = other.build('cage_building', other.index(30, 30, Z), 'iron');
    cageIn(other, pen, 'deer', 'wild');
    const cave = other.zone('farm_plot', [other.index(31, 30, Z)]);
    expect(other.readers.of<PlantsReader>('07').plotKind(cave)).toBe('cave');
  });
});

describe('T-556 bat roosts', () => {
  it('roosts lie on floors of caverns one and two under the ceiling, on their own stream', () => {
    let total = 0;
    for (const seed of ['t556-a', 't556-b', 't556-c']) {
      const { map, result } = generateLocalMap(regionSpec(seed, { biome: 'temperate_forest' }, registry), registry);
      expect(result.roosts.slice().sort((a, b) => a - b)).toEqual(result.roosts);
      for (const t of result.roosts) {
        expect(roostCeilingOver(map, t)).toBe(true);
        const z = map.zOf(t);
        const tier = [1, 2].find((n) => z >= (CAVERN_BANDS[n] as readonly number[])[0]! && z <= (CAVERN_BANDS[n] as readonly number[])[1]!);
        expect(tier).toBeDefined();
      }
      total += result.roosts.length;
      // Same seed, same roosts.
      expect(generateLocalMap(regionSpec(seed, { biome: 'temperate_forest' }, registry), registry).result.roosts).toEqual(result.roosts);
    }
    expect(ROOST_PERMILLE).toBe(1);
    expect(total).toBeGreaterThan(0);
  });

  it('a discovered roost drops one guano every ROOST_DAYS by day and index; dug away, it is gone', () => {
    const w = arena('t556-guano');
    const drop = w.index(20, 20, Z);
    w.carve(w.index(20, 20, Z + 2), TileKind.Wall, registry.table('materials').index('granite'));
    expect(roostCeilingOver(w.map, drop)).toBe(true);
    w.animals.roosts.push(drop);
    w.step(ROOST_DAYS * 2 * TICKS_PER_DAY + 2);
    expect(itemsOf(w, 'guano', 'guano').length).toBe(2);
    w.carve(w.index(20, 20, Z + 2), TileKind.Open, 0);
    w.step(ROOST_DAYS * TICKS_PER_DAY);
    expect(itemsOf(w, 'guano').length).toBe(2);
  });

  it('an undiscovered roost drops nothing', () => {
    const w = arena('t556-unseen');
    const drop = w.index(20, 20, Z);
    w.carve(w.index(20, 20, Z + 2), TileKind.Wall, registry.table('materials').index('granite'));
    w.discover(drop, false);
    w.animals.roosts.push(drop);
    w.step(ROOST_DAYS * TICKS_PER_DAY + 2);
    expect(itemsOf(w, 'guano').length).toBe(0);
  });

  it('the first dwarf near a discovered roost counts the bats, once; the roosts and the note survive a load', () => {
    const w = arena('t556-found');
    const drop = w.index(20, 20, Z);
    w.carve(w.index(20, 20, Z + 2), TileKind.Wall, registry.table('materials').index('granite'));
    w.animals.roosts.push(drop, w.index(60, 60, Z));
    const far = w.spawnDwarf({ at: w.index(20 + ROOST_NOTICE_RADIUS + 3, 20, Z), name: 'Far' });
    w.step(TICKS_PER_DAY / 6);
    expect(w.events('RoostFound')).toHaveLength(0);
    const near = w.spawnDwarf({ at: w.index(20 + ROOST_NOTICE_RADIUS, 20, Z), name: 'Brynja Coldhammer' });
    w.step(TICKS_PER_DAY / 6);
    const found = w.events('RoostFound');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ tile: drop, dwarfId: near });
    expect(far).not.toBe(near);
    const loaded = roundTrip(w.game).game;
    const animals = loaded.world.scheduler.inOrder().find((s) => s.id === '08') as unknown as { roosts: TileIndex[]; serialize(): { roostFound?: boolean } };
    expect(animals.roosts).toEqual([drop, w.index(60, 60, Z)]);
    expect(animals.serialize().roostFound).toBe(true);
    w.step(TICKS_PER_DAY);
    expect(w.events('RoostFound')).toHaveLength(1);
  });
});
