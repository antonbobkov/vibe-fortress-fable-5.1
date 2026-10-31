import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileKind, TileFlag } from '@core/map3d';
import type { DwarvesReader } from '@systems/dwarves';
import { NEED_RETRY_TICKS } from '@systems/dwarves/constants';
import { TestWorld } from '../../scenarios/test-world';
import { stairShaft } from '../../scenarios/m1-helpers';
import type { JobsReader, JobSink } from '@systems/jobs';
import type { ItemsReader } from '@systems/items';

const Z = 32;

describe('T-M4-06 activities', () => {
  it('passes out at the current tile when rest reaches 100', () => {
    const w = new TestWorld({ seed: 'm4-pass-out', world: 'flat-test', embark: 'none' });
    const at = w.index(12, 12, Z);
    const id = w.spawnDwarf({ at });
    w.setNeed(id, 'rest', 100);
    w.step(1);
    expect(w.dwarves.activities.plans.get(id)?.target).toBe(at);
    expect(w.dwarves.activities.plans.get(id)?.itemId).toBe(0);
  });

  it('chooses a reachable meal before nearer raw food and consumes one unit', () => {
    const w = new TestWorld({ seed: 'm4-meal', world: 'flat-test', embark: 'none' });
    const id = w.spawnDwarf({ at: w.index(12, 12, Z) });
    w.spawnItem('plant_food', 'dimcap', w.index(12, 12, Z), 2);
    const meal = w.spawnItem('easy_meal', 'dimcap', w.index(13, 12, Z));
    w.setNeed(id, 'hunger', 55);
    w.step(1);
    expect(w.dwarves.activities.plans.get(id)?.itemId).toBe(meal);
    w.step(100);
    expect(w.events('MealEaten')).toMatchObject([{ type: 'MealEaten', id, kind: 'meal' }]);
    expect(w.dwarves.reader().need(id, 'hunger')).toBeLessThan(20);
  });

  it('T-124: a quality-4 meal relieves hunger and joy, neither write undoes the other', () => {
    const w = new TestWorld({ seed: 't124-fine-meal', world: 'flat-test', embark: 'none' });
    const id = w.spawnDwarf({ at: w.index(12, 12, Z) });
    w.spawnItem('easy_meal', 'dimcap', w.index(13, 12, Z), 1, 4);
    w.setNeed(id, 'hunger', 65);
    w.setNeed(id, 'joy', 80);
    w.step(100);
    expect(w.events('MealEaten')).toMatchObject([{ type: 'MealEaten', id, kind: 'meal', quality: 4 }]);
    expect(w.dwarves.reader().need(id, 'hunger')).toBeLessThan(20);
    expect(w.dwarves.reader().need(id, 'joy')).toBeLessThan(80);
  });

  it('uses alcohol, then a working well, then adjacent surface water', () => {
    const w = new TestWorld({ seed: 'm4-drink', world: 'flat-test', embark: 'none' });
    const at = w.index(60, 59, Z);
    const id = w.spawnDwarf({ at });
    const site = w.index(60, 60, Z);
    const water = w.index(60, 60, 29);
    for (const z of [30, 31, Z]) {
      w.carve(w.index(60, 60, z), TileKind.Open);
      w.map.setFlag(w.index(60, 60, z), TileFlag.Outdoor, true);
    }
    w.carve(water, TileKind.Floor);
    w.discover(site);
    w.setFluid(water, 5);
    w.build('well', site, 'granite');
    w.zone('stockpile', [at]);
    const barrel = w.spawnItem('barrel', 'oak', at);
    const drink = w.spawnItem('drink', 'ale', at, 2);
    expect(w.game.world.services.items?.putIn(drink, barrel)).toBe(true);
    w.setNeed(id, 'thirst', 55);
    w.step(1);
    expect(w.dwarves.activities.plans.get(id)?.itemId).toBeGreaterThan(0);
    w.step(80);
    expect(w.events('DrankAlcohol').some((e) => e['id'] === id)).toBe(true);
    w.setNeed(id, 'thirst', 55);
    w.step(2);
    expect(w.dwarves.activities.plans.get(id)?.itemId).toBeGreaterThan(0);
    // Consume the remaining drink, then the well is selected.
    w.step(80);
    w.setNeed(id, 'thirst', 55);
    w.step(2);
    expect(w.dwarves.activities.plans.get(id)?.itemId).toBe(0);
    expect(w.dwarves.activities.plans.get(id)?.target).toBe(at);
    w.step(100);
    expect(w.events('DrankWater').some((e) => e['id'] === id)).toBe(true);

    const bare = new TestWorld({ seed: 'm4-water', world: 'flat-test', embark: 'none' });
    const start = bare.index(12, 12, Z);
    const b = bare.spawnDwarf({ at: start });
    bare.setFluid(bare.index(13, 12, Z), 1, 'water');
    bare.setNeed(b, 'thirst', 55);
    bare.step(1);
    expect(bare.dwarves.activities.plans.get(b)?.target).toBe(start);
    bare.step(50);
    expect(bare.events('DrankWater').some((e) => e['id'] === b && e['outdoors'] === true)).toBe(true);
  });

  it('D-120: loose alcohol is drunk only when no stocked barrel, well or water exists', () => {
    const w = new TestWorld({ seed: 'd120-loose-alcohol', world: 'flat-test', embark: 'none' });
    const at = w.index(12, 12, Z);
    const id = w.spawnDwarf({ at });
    // One thirsty dwarf and a loose drink stack: it drinks the loose stack.
    w.spawnItem('drink', 'ale', w.index(13, 12, Z), 5);
    w.setNeed(id, 'thirst', 55);
    w.step(1);
    const planLoose = w.dwarves.activities.plans.get(id);
    expect(planLoose?.itemId).toBeGreaterThan(0);
    expect(w.readers.of<ItemsReader>('13').containerOf(planLoose!.itemId!)).toBe(0);
    w.step(80);
    expect(w.events('DrankAlcohol').some((e) => e['id'] === id)).toBe(true);

    // Then add a barrel of ale on a drink stockpile and make it thirsty again: it drinks from the barrel.
    const pileTile = w.index(14, 12, Z);
    const pile = w.zone('stockpile', [pileTile]);
    w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: pile, filter: 'drink' });
    const barrel = w.spawnItem('barrel', 'oak', pileTile);
    w.spawnItem('drink', 'ale', { containerId: barrel }, 10);
    w.setNeed(id, 'thirst', 55);
    w.step(1);
    const planBarrel = w.dwarves.activities.plans.get(id);
    expect(planBarrel?.itemId).toBeGreaterThan(0);
    expect(w.readers.of<ItemsReader>('13').containerOf(planBarrel!.itemId!)).toBe(barrel);
    w.step(80);
    expect(w.events('DrankAlcohol').filter((e) => e['id'] === id)).toHaveLength(2);
  });

  it('talks five times to make a friend and relieves both dwarves', () => {
    const w = new TestWorld({ seed: 'm4-friends', world: 'flat-test', embark: 'none' });
    const aa = w.index(12, 12, Z);
    const bb = w.index(13, 12, Z);
    w.zone('meeting_area', [aa, bb]);
    const a = w.spawnDwarf({ at: aa });
    const b = w.spawnDwarf({ at: bb });
    // Two dwarves standing together have one talk in passing, not an errand each.
    for (let k = 0; k < 10; k += 1) {
      w.setNeed(a, 'social', 55);
      w.setNeed(b, 'social', 55);
      w.setNeed(a, 'rest', 0);
      w.setNeed(b, 'rest', 0);
      w.step(105);
    }
    expect(w.events('Talked').length).toBeGreaterThanOrEqual(5);
    expect(w.readers.of<DwarvesReader>('10').isFriend(a, b)).toBe(true);
    expect(w.readers.of<DwarvesReader>('10').isFriend(b, a)).toBe(true);
  });

  it('a want level need waits behind a priority 1 job', () => {
    const w = new TestWorld({ seed: 'm4-priority', world: 'flat-test', embark: 'none' });
    const at = w.index(12, 12, Z);
    const id = w.spawnDwarf({ at });
    w.game.world.applyCommand({ type: 'SetLabor', dwarfId: id, labor: 'mining', on: true });
    w.spawnItem('pick', 'copper', at);
    w.spawnItem('plant_food', 'dimcap', at);
    const target = w.index(14, 12, Z);
    w.game.world.services.terrain.setKind(target, TileKind.Wall, w.game.registry.table('materials').index('granite'));
    const producer = { id: 'urgent-dig-test', done: false, produce(_ctx: unknown, sink: JobSink): void {
      if (this.done) return;
      this.done = true;
      sink.create('urgent-dig', { type: 'dig', target: { kind: 'tile', ref: target }, workTile: 'adjacent', priority: 1 });
    } };
    w.game.world.registrations.jobProducer(producer);
    w.step(2);
    expect(w.readers.of<JobsReader>('11').byKey('urgent-dig')).toBeDefined();
    w.setNeed(id, 'hunger', 55);
    w.step(2);
    expect(w.game.world.entities.get(id, C.Worker)?.jobId).toBeGreaterThan(0);
    expect(w.dwarves.activities.plans.has(id)).toBe(false);
  });
});

describe('F-05 need activities', () => {
  it('any dwarf present in the meeting area is a partner', () => {
    const w = new TestWorld({ seed: 'f05-partner', world: 'flat-test', embark: 'none' });
    const meetingTiles: number[] = [];
    for (let y = 20; y <= 22; y += 1) {
      for (let x = 20; x <= 22; x += 1) {
        meetingTiles.push(w.index(x, y, Z));
      }
    }
    w.zone('meeting_area', meetingTiles);

    const b = w.spawnDwarf({ at: w.index(21, 21, Z) });
    const a = w.spawnDwarf({ at: w.index(30, 21, Z) });
    const c = w.spawnDwarf({ at: w.index(60, 60, Z) });

    // C is A's friend
    const relA = w.game.world.entities.get(a, C.Relationships);
    if (relA) w.game.world.entities.add(a, C.Relationships, { ...relA, friends: [c] });

    w.setNeed(a, 'social', 55);

    for (let t = 0; t < 8; t += 1) {
      w.step(50);
      for (const need of ['hunger', 'thirst', 'rest', 'comfort', 'purpose', 'joy'] as const) {
        w.setNeed(a, need, 0);
        w.setNeed(b, need, 0);
        w.setNeed(c, need, 0);
      }
      if (w.events('Talked').length > 0) break;
    }

    const talked = w.events('Talked');
    expect(talked.some((e) => (e['a'] === a && e['b'] === b) || (e['a'] === b && e['b'] === a))).toBe(true);
  });

  it('an unreachable bed is not chosen and does not loop', () => {
    const w = new TestWorld({ seed: 'f05-unreachable-bed', world: 'flat-test', embark: 'none' });
    const start = w.index(20, 20, Z);
    const id = w.spawnDwarf({ at: start });

    // Bed 1 at distance 3: (23, 20, Z), walled on every side (no door)
    const bed1 = w.index(23, 20, Z);
    const granite = w.game.registry.table('materials').index('granite');
    for (let y = 19; y <= 21; y += 1) {
      for (let x = 22; x <= 24; x += 1) {
        if (x === 23 && y === 20) continue;
        w.carve(w.index(x, y, Z), TileKind.Wall, granite);
      }
    }
    w.build('bed', bed1, 'oak');

    // Bed 2 reachable at distance 12: (20, 32, Z)
    const bed2 = w.index(20, 32, Z);
    w.build('bed', bed2, 'oak');

    // Dwarf rest 95, outside the sleep window
    w.game.world.applyCommand({ type: 'SetSchedule', dwarfId: id, sleepStartHour: 22 });
    w.setNeed(id, 'rest', 95);

    let sleptAtBed2 = false;
    for (let t = 0; t < 600; t += 1) {
      w.step(1);
      const slept = w.events('Slept').find((e) => e['id'] === id);
      if (slept) {
        expect(slept['onFloor']).toBe(false);
        const dwarfTile = w.game.world.services.movement?.tileOf(id);
        expect(dwarfTile).toBe(bed2);
        sleptAtBed2 = true;
        break;
      }
    }
    expect(sleptAtBed2).toBe(true);
  });

  it('a need whose only target is unreachable is retried at most once an hour', () => {
    const w = new TestWorld({ seed: 'f05-retry-block', world: 'flat-test', embark: 'none' });
    const start = w.index(20, 20, Z);
    const id = w.spawnDwarf({ at: start });

    // The only water is a tile inside a sealed room; no drink items.
    const waterTile = w.index(25, 20, Z);
    const granite = w.game.registry.table('materials').index('granite');
    for (let y = 19; y <= 21; y += 1) {
      for (let x = 24; x <= 26; x += 1) {
        if (x === 25 && y === 20) continue;
        w.carve(w.index(x, y, Z), TileKind.Wall, granite);
      }
    }
    w.setFluid(waterTile, 5, 'water', true);

    // Thirst 55, a dig designation reachable, a pick on the ground.
    w.setNeed(id, 'thirst', 55);
    const digTarget = w.index(20, 22, Z);
    w.carve(digTarget, TileKind.Wall, granite);
    w.spawnItem('pick', 'copper', start);
    w.game.world.applyCommand({ type: 'SetLabor', dwarfId: id, labor: 'mining', on: true });
    w.game.world.applyCommand({ type: 'Designate', tiles: [digTarget], kind: 'dig' });

    let thirstStarts = 0;
    let prevNeed: string | undefined = undefined;

    for (let t = 0; t < 600; t += 1) {
      w.step(1);
      const curNeed = w.dwarves.activities.plans.get(id)?.need;
      if (curNeed === 'thirst' && prevNeed !== 'thirst') {
        thirstStarts += 1;
      }
      prevNeed = curNeed;
    }

    expect(thirstStarts).toBeLessThanOrEqual(Math.ceil(600 / NEED_RETRY_TICKS) + 1);
    // The dig job completes (the dwarf still works)
    expect(w.map.kindAt(digTarget)).toBe(TileKind.Floor);
  });

  it('a dwarf underground drinks from surface water', () => {
    const w = new TestWorld({ seed: 'f05-surface-water', world: 'flat-test', embark: 'none' });
    const granite = w.game.registry.table('materials').index('granite');

    // stairShaft from z 32 to 29
    stairShaft(w, 20, 20, 32, 29);

    // with the dwarf at z 29 in a dug 3x3 room
    for (let y = 19; y <= 21; y += 1) {
      for (let x = 19; x <= 21; x += 1) {
        if (x === 20 && y === 20) continue;
        w.carve(w.index(x, y, 29), TileKind.Floor, granite);
      }
    }
    const id = w.spawnDwarf({ at: w.index(19, 19, 29) });

    // A water source at level 7 on a surface floor tile (x, y, 32) whose four cardinal neighbours
    // are set to Wall granite; its diagonal (x+1, y+1, 32) stays floor.
    const wx = 25;
    const wy = 20;
    const waterTile = w.index(wx, wy, 32);
    w.carve(waterTile, TileKind.Floor);
    w.setFluid(waterTile, 7, 'water', true);

    w.carve(w.index(wx + 1, wy, 32), TileKind.Wall, granite);
    w.carve(w.index(wx - 1, wy, 32), TileKind.Wall, granite);
    w.carve(w.index(wx, wy + 1, 32), TileKind.Wall, granite);
    w.carve(w.index(wx, wy - 1, 32), TileKind.Wall, granite);
    w.carve(w.index(wx + 1, wy + 1, 32), TileKind.Floor);

    // Thirst 55, no drink items
    w.setNeed(id, 'thirst', 55);

    w.step(800);
    expect(w.events('DrankWater').some((e) => e['id'] === id)).toBe(true);
  });

  it('retry block on unreachable walk failure blocks the need for NEED_RETRY_TICKS and serializes', () => {
    const w = new TestWorld({ seed: 'f05-retry-serialize', world: 'flat-test', embark: 'none' });
    const id = w.spawnDwarf({ at: w.index(10, 10, Z) });
    const unreachableTile = w.index(40, 40, Z);

    // Directly set plan to unreachable tile
    w.dwarves.activities.plans.set(id, {
      need: 'comfort',
      phase: 'travel',
      itemId: 0,
      partner: 0,
      target: unreachableTile,
      until: 0,
      ownBed: false,
      roomTier: 0,
      startedRest: 0,
      atTable: false,
    });
    const brain = w.game.world.entities.get(id, C.Brain)!;
    w.game.world.entities.add(id, C.Brain, { ...brain, behavior: 'need', activity: 'comfort', targetTile: unreachableTile });

    // Mock movement to return unreachable
    const origWalkTo = w.game.world.services.movement!.walkTo;
    w.game.world.services.movement!.walkTo = () => 'unreachable';

    w.step(1);
    expect(w.dwarves.activities.plans.has(id)).toBe(false);
    expect(w.dwarves.activities.isBlocked(id, 'comfort', w.game.world.calendar.tick)).toBe(true);

    // Serialize and deserialize
    const serialized = w.dwarves.serialize();
    expect(serialized.needRetryUntil).toBeDefined();
    expect(serialized.needRetryUntil?.some(([d, need]) => d === id && need === 'comfort')).toBe(true);

    // Restore movement
    w.game.world.services.movement!.walkTo = origWalkTo;
  });
});

