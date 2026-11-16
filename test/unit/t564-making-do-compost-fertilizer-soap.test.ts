/**
 * T-564, Making Do B5b: the compost heap, fertilizer and soap (`13` § The compost heap; `07` § Fertilizer;
 * `17` § Patients and hospitals, `wash_patient`; `12` § Recipes, `make_soap`).
 */
import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { contentRegistry } from '@content/loader';
import type { Command } from '@core/commands';
import { C, type Crop, type Item } from '@core/components';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '@core/constants';
import { RngStream, seedFor } from '@core/rng';
import type { EntityId, TileIndex } from '@core/types';
import { INFECTION_PERMILLE } from '@systems/health';
import { HOSPITAL_DEFAULT_SUPPLIES } from '@systems/health/constants';
import type { ItemsSystem } from '@systems/items';
import { COMPOST_DAYS_DUNG, COMPOST_DAYS_ROTTEN } from '@systems/items/constants';
import type { ItemCore } from '@systems/items/api';
import { FERTILIZER_YIELD_BONUS } from '@systems/plants/constants';
import type { PlantsReader } from '@systems/plants';
import { PlantFacts } from '@systems/plants/facts';
import { stageLength } from '@systems/plants/growth';
import type { KeymapRow } from '@ui/keymap';
import { TestWorld } from '../scenarios/test-world';

const registry = contentRegistry();
const items = registry.table<{ id: string; category: string; container: string; stack: number; tags?: readonly string[] }>('items');
const materials = registry.table<{ id: string; class: string; value: number; color: string; tags?: readonly string[] }>('materials');
const facts = new PlantFacts(registry);
const LABORS = registry.table<{ id: string }>('labors').ids();
const NEEDS = ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const;

function world(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

/** A worker with only `labor` on and no needs pressing. */
function worker(w: TestWorld, at: TileIndex, labor: string, skills: Record<string, number> = {}): EntityId {
  const id = w.spawnDwarf({ at, skills });
  for (const l of LABORS) w.setLabor(id, l, l === labor);
  for (const need of NEEDS) w.setNeed(id, need, 0);
  return id;
}

function row(w: TestWorld, x: number, y: number, n: number): TileIndex[] {
  const out: TileIndex[] = [];
  for (let dx = 0; dx < n; dx += 1) out.push(w.index(x + dx, y, Z));
  return out;
}

function units(w: TestWorld, type: string, material?: string): number {
  const t = items.index(type);
  let n = 0;
  for (const id of w.game.world.entities.with(C.Item)) {
    const it = w.game.world.entities.get(id, C.Item) as Item;
    if (it.type === t && (material === undefined || it.material === materials.index(material))) n += it.count;
  }
  return n;
}

function itemsOfType(w: TestWorld, type: string): EntityId[] {
  const t = items.index(type);
  return w.game.world.entities.with(C.Item).filter((id) => w.game.world.entities.get(id, C.Item)?.type === t);
}

function core(w: TestWorld): ItemCore {
  return (w.game.world.scheduler.byId('13') as ItemsSystem).core;
}

/** Step to the next hour boundary and past it, so the hourly compost pass has run. */
function pastHour(w: TestWorld): void {
  w.step(TICKS_PER_HOUR - (w.tick % TICKS_PER_HOUR) + 2);
}

describe('T-564 the rows', () => {
  it('compost and soap: their materials, items, the recipe, the job, the zone type, the setting and the colours', () => {
    expect(materials.byId('compost')).toMatchObject({ class: 'soil', value: 0, color: 'loam_brown' });
    expect(materials.byId('compost')?.tags).toEqual(['fertilizer']);
    expect(materials.byId('soap')).toMatchObject({ class: 'liquid', value: 3, color: 'soap_white' });
    expect(items.byId('compost')).toMatchObject({ category: 'farm/compost', container: 'bag', stack: 10 });
    expect(items.byId('compost')?.tags).toEqual(['fertilizer']);
    expect(items.byId('soap')).toMatchObject({ category: 'medical/soap', container: 'bag', stack: 20 });
    // Every fertilizer of the rule reads the tag: dung, compost and bone ash.
    for (const id of ['dung', 'compost', 'bone_ash']) expect(items.byId(id)?.tags).toContain('fertilizer');
    const recipe = registry.table<{ id: string; workshop: string; skill: string; inputs: { match: string; count: number }[]; outputs: { item: string; count: number; material?: unknown }[] }>('recipes').byId('make_soap');
    expect(recipe).toMatchObject({ workshop: 'kitchen', skill: 'cooking' });
    expect(recipe?.inputs.map((i) => i.match)).toEqual(['tallow', 'potash']);
    expect(recipe?.outputs).toEqual([{ item: 'soap', count: 2, material: { fixed: 'soap' } }]);
    expect(registry.table<{ id: string; labor: string; skill: string; xp: number }>('jobTypes').byId('wash_patient')).toMatchObject({ labor: 'medicine', skill: 'medicine', xp: 4 });
    const zones = registry.table<{ id: string; room: boolean; settings: readonly string[] }>('zoneTypes');
    expect(zones.byId('compost')).toMatchObject({ room: false, settings: [] });
    expect(zones.byId('farm_plot')?.settings).toEqual(['crop per season', 'fertilize']);
    const palette = registry.table<{ id: string }>('palette');
    expect(palette.has('soap_white')).toBe(true);
    expect(palette.has('zone_compost')).toBe(true);
    expect(HOSPITAL_DEFAULT_SUPPLIES['soap']).toBe(0);
    const keys = registry.derived<readonly KeymapRow[]>('keymap');
    expect(keys.find((k) => k.context === 'zones_panel' && k.action === 'compost heap')?.key).toBe('[S-k]');
    expect(keys.find((k) => k.context === 'zone_inspector' && k.action === 'a farm plot: turn fertilize on or off')?.key).toBe('[S-f]');
  });
});

describe('T-564 the compost heap', () => {
  it('a hauler carries dung onto a heap tile with no bag; the stockpile commands refuse a heap', () => {
    const w = world('t564-heap-haul');
    const heap = w.zone('compost', row(w, 20, 20, 3));
    w.spawnItem('dung', 'dung', w.index(25, 25, Z), 3);
    worker(w, w.index(24, 25, Z), 'hauling');
    const store = (w.game.world.scheduler.byId('13') as ItemsSystem).stockpiles;
    w.until(() => itemsOfType(w, 'dung').some((id) => store.stockpileAt(core(w).tileOf(id)) === heap), 2000);
    const dung = itemsOfType(w, 'dung')[0] as EntityId;
    expect(core(w).get(dung)?.containerId).toBe(0);
    expect(store.stockpile(heap)?.filter).toMatchObject({ categories: ['refuse/rotten', 'farm/dung'], allowRot: true });
    const refused: Command[] = [
      { type: 'SetStockpileFilter', zoneId: heap, filter: 'food' },
      { type: 'SetStockpileContainers', zoneId: heap, wants: { bag: 1 } },
      { type: 'SetStockpilePriority', zoneId: heap, priority: 3 },
      { type: 'SetStockpileCellar', zoneId: heap, on: true },
    ];
    for (const cmd of refused) expect(w.game.world.applyCommand(cmd)).toEqual({ ok: false, reason: 'not_found' });
  });

  it('dung on a heap turns to compost in 7 days, one a unit, on its tile; a save keeps the count', () => {
    const w = world('t564-dung');
    const tiles = row(w, 20, 20, 2);
    w.zone('compost', tiles);
    const dung = w.spawnItem('dung', 'dung', tiles[0] as TileIndex, 4);
    pastHour(w);
    const at = core(w).get(dung)?.compostAt ?? 0;
    expect(at).toBeGreaterThan(w.tick);
    expect(at - w.tick).toBeLessThanOrEqual(COMPOST_DAYS_DUNG * TICKS_PER_DAY);
    expect(at - w.tick).toBeGreaterThan(COMPOST_DAYS_DUNG * TICKS_PER_DAY - TICKS_PER_HOUR - 5);
    const loaded = roundTrip(w.game).game;
    expect(loaded.world.entities.get(dung, C.Item)?.compostAt).toBe(at);
    w.step(at - w.tick - TICKS_PER_HOUR);
    expect(units(w, 'dung')).toBe(4);
    w.step(2 * TICKS_PER_HOUR);
    expect(units(w, 'dung')).toBe(0);
    expect(units(w, 'compost', 'compost')).toBe(4);
    expect(w.events('ItemDestroyed').some((e) => e['reason'] === 'composted')).toBe(true);
    for (const id of itemsOfType(w, 'compost')) expect(core(w).tileOf(id)).toBe(tiles[0]);
  });

  it('raw meat left on a heap rots, is not destroyed at its gone stage, and turns 14 days after it rotted', () => {
    const w = world('t564-rotten');
    const tiles = row(w, 30, 30, 1);
    w.zone('compost', tiles);
    w.forceTemperature(tiles[0] as TileIndex, 15);
    const meat = w.spawnItem('raw_meat', 'boar_meat', tiles[0] as TileIndex, 1);
    w.until(() => core(w).get(meat)?.rotStage === 2, 20 * TICKS_PER_DAY);
    expect(core(w).get(meat)?.type).toBe(items.index('rotten'));
    // Its gone stage (150% of six days) passes: on the heap it waits.
    w.step(4 * TICKS_PER_DAY);
    expect(core(w).get(meat)?.rotStage).toBe(2);
    w.until(() => units(w, 'compost') > 0, (COMPOST_DAYS_ROTTEN + 1) * TICKS_PER_DAY);
    expect(units(w, 'compost', 'compost')).toBe(1);
    expect(core(w).get(meat)).toBeUndefined();
  });

  it('an item lifted from a heap loses its count; a heap removed clears the counts on its tiles', () => {
    const w = world('t564-clear');
    const tiles = row(w, 20, 20, 2);
    const heap = w.zone('compost', tiles);
    const a = w.spawnItem('dung', 'dung', tiles[0] as TileIndex, 1);
    const b = w.spawnItem('dung', 'dung', tiles[1] as TileIndex, 1);
    pastHour(w);
    expect(core(w).get(a)?.compostAt ?? 0).toBeGreaterThan(0);
    core(w).attachToCarrier(a, w.spawnDwarf({ at: w.index(19, 20, Z) }));
    expect(core(w).get(a)?.compostAt).toBeUndefined();
    expect(w.game.world.applyCommand({ type: 'RemoveZone', zoneId: heap }).ok).toBe(true);
    w.step(12);
    expect(core(w).get(b)?.compostAt).toBeUndefined();
  });
});

describe('T-564 fertilizer', () => {
  it('the setting is a boolean; with it on one plant job takes the one dung, the other plants without it', () => {
    const w = world('t564-fertilize');
    const tiles = row(w, 30, 30, 2);
    const zoneId = w.zone('farm_plot', tiles);
    const cmd = w.game.world.applyCommand.bind(w.game.world);
    expect(cmd({ type: 'SetZoneSetting', zoneId, key: 'fertilize', value: 'yes' })).toEqual({ ok: false, reason: 'bad_setting' });
    expect(cmd({ type: 'SetZoneSetting', zoneId, key: 'fertilize', value: true }).ok).toBe(true);
    expect(w.readers.of<PlantsReader>('07').plotFertilize(zoneId)).toBe(true);
    expect(cmd({ type: 'SetPlotCrop', zoneId, season: 0, speciesId: 'barley' }).ok).toBe(true);
    w.spawnItem('seed', 'barley', w.index(30, 32, Z), 5);
    w.spawnItem('dung', 'dung', w.index(31, 32, Z), 1);
    worker(w, w.index(30, 33, Z), 'farming', { farming: 2 });
    w.until(() => w.events('CropPlanted').length >= 2, 4000);
    const plants = w.readers.of<PlantsReader>('07');
    const crops = tiles.map((t) => plants.cropInfo(plants.cropAt(t)));
    expect(crops.filter((c) => c?.fertilized === true)).toHaveLength(1);
    expect(crops.filter((c) => c?.fertilized === false)).toHaveLength(1);
    expect(units(w, 'dung')).toBe(0);
    const loaded = roundTrip(w.game).game;
    const fertilized = loaded.world.entities.with(C.Crop).filter((id) => loaded.world.entities.get(id, C.Crop)?.fertilized === true);
    expect(fertilized).toHaveLength(1);
  });

  it('a plant job whose fertilizer is gone does not wait: it is made again without it', () => {
    const w = world('t564-no-wait');
    const tiles = row(w, 30, 30, 2);
    const zoneId = w.zone('farm_plot', tiles);
    const cmd = w.game.world.applyCommand.bind(w.game.world);
    expect(cmd({ type: 'SetZoneSetting', zoneId, key: 'fertilize', value: true }).ok).toBe(true);
    expect(cmd({ type: 'SetPlotCrop', zoneId, season: 0, speciesId: 'barley' }).ok).toBe(true);
    w.spawnItem('seed', 'barley', w.index(30, 32, Z), 5);
    const dung = w.spawnItem('dung', 'dung', w.index(31, 32, Z), 1);
    w.step(20);
    const jobs = (): { key: string; inputs: unknown[] }[] =>
      w.readers.of<{ list(): { key: string; inputs: unknown[] }[] }>('11').list().filter((j) => j.key.startsWith('plant:'));
    expect(jobs().map((j) => j.inputs.length).sort()).toEqual([1, 2]);
    core(w).destroy(dung, 'consumed');
    worker(w, w.index(30, 33, Z), 'farming', { farming: 2 });
    w.until(() => w.events('CropPlanted').length >= 2, 2 * TICKS_PER_DAY);
    expect(w.events('JobCancelled').some((e) => e['reason'] === 'no_fertilizer')).toBe(true);
    const plants = w.readers.of<PlantsReader>('07');
    for (const t of tiles) expect(plants.cropInfo(plants.cropAt(t))?.fertilized).toBe(false);
  });

  it('a fertilized crop yields one more at harvest than the same harvest unfertilized', () => {
    const counts: number[] = [];
    for (const fertilized of [false, true]) {
      const w = world('t564-yield');
      const tile = w.index(40, 40, Z);
      w.zone('farm_plot', [tile]);
      const id = w.plantCrop(tile, 'barley', 3);
      const crop = w.game.world.entities.get(id, C.Crop) as Crop;
      const plant = facts.row(facts.indexOf('barley'));
      w.game.world.entities.add(id, C.Crop, { ...crop, growth: stageLength(plant!), ...(fertilized ? { fertilized: true as const } : {}) });
      expect(w.game.world.applyCommand({ type: 'DesignateHarvest', tiles: [tile] }).ok).toBe(true);
      worker(w, w.index(40, 42, Z), 'farming', { farming: 2 });
      w.until(() => w.events('CropHarvested').length > 0, 2000);
      counts.push(w.events('CropHarvested')[0]?.['count'] as number);
    }
    expect(counts[1]).toBe((counts[0] as number) + FERTILIZER_YIELD_BONUS);
  });
});

describe('T-564 soap', () => {
  it('the kitchen boils 1 tallow and 1 potash into 2 soap', () => {
    const w = world('t564-soap');
    const kitchen = w.build('kitchen', w.index(15, 15, Z), 'granite');
    worker(w, w.index(20, 18, Z), 'cooking', { cooking: 5 });
    w.spawnItem('tallow', 'tallow', w.index(21, 18, Z), 1);
    w.spawnItem('potash', 'potash', w.index(21, 19, Z), 1);
    w.step(1);
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: kitchen, order: { recipeId: 'make_soap', mode: 'once', remaining: 1, priority: 5 } })).toEqual({ ok: true });
    w.until(() => units(w, 'soap') > 0, 3000);
    expect(units(w, 'soap', 'soap')).toBe(2);
    expect(units(w, 'tallow')).toBe(0);
    expect(units(w, 'potash')).toBe(0);
  });

  it('a medic washes a patient with soap once an admission; a hospital takes soap as a supply', () => {
    const w = world('t564-wash');
    const world_ = w.game.world;
    const patient = w.spawnDwarf({ at: w.index(10, 10, Z) });
    for (const l of LABORS) w.setLabor(patient, l, false);
    worker(w, w.index(14, 10, Z), 'medicine', { medicine: 10 });
    w.spawnItem('soap', 'soap', w.index(12, 12, Z), 3);
    // No cloth: the cut stays unbandaged, and its dwarf admitted, while it bleeds a little.
    world_.emit({ type: 'DamageDealt', defenderId: patient, attackerId: 0, part: 'torso', damageType: 'edge', amount: 21 });
    w.step(3);
    expect(world_.entities.has(patient, C.Patient)).toBe(true);
    world_.entities.get(patient, C.Body)!.parts.flatMap((p) => p.wounds)[0]!.bleed = 1;
    w.until(() => world_.entities.get(patient, C.Patient)?.washed === true || !world_.entities.has(patient, C.Patient), 2 * TICKS_PER_DAY);
    expect(w.events('TreatmentDone').filter((e) => e['kind'] === 'wash_patient' && e['patientId'] === patient)).toHaveLength(1);
    expect(units(w, 'soap')).toBe(2);
    w.step(TICKS_PER_DAY / 2);
    // Once an admission: no second wash.
    expect(w.events('TreatmentDone').filter((e) => e['kind'] === 'wash_patient')).toHaveLength(1);

    const tiles = row(w, 30, 30, 3);
    const hospital = w.zone('hospital', tiles);
    const store = (world_.scheduler.byId('13') as ItemsSystem).stockpiles;
    const soap = itemsOfType(w, 'soap')[0] as EntityId;
    expect(store.acceptsKind(hospital, core(w).get(soap) as Item)).toBe(false);
    expect(world_.applyCommand({ type: 'SetHospitalSupplies', zoneId: hospital, wants: { soap: 4 } }).ok).toBe(true);
    expect(store.acceptsKind(hospital, core(w).get(soap) as Item)).toBe(true);
  });
});

/** A real saved state of the health stream whose next draws would all infect. */
function infectingState(): ReturnType<RngStream['state']> {
  for (let n = 0; n < 100_000; n += 1) {
    const rng = new RngStream(seedFor(`t564-infect-${n}`, '17'));
    const state = rng.state();
    if ([0, 1, 2, 3].every(() => rng.int(0, 999) < INFECTION_PERMILLE)) return state;
  }
  throw new Error('no infecting state');
}

describe('T-564 a washed patient takes no infection', () => {
  function oldCut(seed: string, washed: boolean) {
    const w = world(seed);
    const world_ = w.game.world;
    const id = w.spawnDwarf({ at: w.index(10, 10, Z) });
    for (const l of LABORS) w.setLabor(id, l, false);
    world_.emit({ type: 'DamageDealt', defenderId: id, attackerId: 0, part: 'torso', damageType: 'edge', amount: 21 });
    w.step(2);
    const cut = world_.entities.get(id, C.Body)!.parts.flatMap((p) => p.wounds)[0]!;
    expect(cut.type).toBe('cut');
    // It bleeds a little, so it stays admitted through the day.
    cut.bleed = 1;
    w.until(() => w.tick % TICKS_PER_DAY === TICKS_PER_DAY - 5, TICKS_PER_DAY);
    cut.createdTick = w.tick - TICKS_PER_DAY;
    const admitted = world_.entities.get(id, C.Patient);
    expect(admitted).toBeDefined();
    if (washed) world_.entities.add(id, C.Patient, { ...admitted!, washed: true });
    world_.rngFor('17').setState(infectingState());
    w.step(10);
    return { cut, infections: w.events('InfectionStarted').filter((e) => e['id'] === id) };
  }

  it('the open cut of an unwashed patient is infected by the roll', () => {
    const a = oldCut('t564-unwashed', false);
    expect(a.infections).toHaveLength(1);
    expect(a.cut.infected).toBe(true);
  });

  it('the open cut of a washed patient is not rolled', () => {
    const a = oldCut('t564-washed', true);
    expect(a.infections).toHaveLength(0);
    expect(a.cut.infected).toBe(false);
  });
});
