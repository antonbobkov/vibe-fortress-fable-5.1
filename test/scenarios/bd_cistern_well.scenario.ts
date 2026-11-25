/**
 * T-663: water inside the gate. A fortress with no drink drinks from a well inside its gate under
 * a hearth alert, the well standing in the hearth hall over a cistern the brook fills.
 *
 * On a generated region (a Serene Vale with a brook), from the Balanced embark, by commands: a
 * stair down to a hall six levels below the brook's banks, a door on its corridor, a hearth; under
 * the hall a cistern fed from the brook through a floodgate on a lever, laid out by
 * `cistern-well.ts`. The goods the cistern's buildings are made of (the floodgate, mechanisms, a
 * chain, blocks and the corridor's door) are laid by the wagon on day 1, as the workshops that make
 * them are other scenarios' business. The digging, the building, the lever and the water are the
 * game's own.
 *
 * Asserted: the well is built and works; the floodgate is shut again and no water ever stands on
 * the hall's level (the shaft's pressure carries through the tunnel, so the lever is pulled open
 * and at once pulled shut: left open, the cistern would fill and lift the brook into the hall); and under the hearth alert, with every drink forbidden, the dwarves sheltering
 * in the hall drink at the well (a want-level thirst is served there because the well stands in
 * the hall, 10 § Behavior selection step 2), as does one at critical thirst, and none of them goes
 * out to the brook. Then the player plays the floodgate of the finished well (T-746): pulled open
 * and at once shut, the hall stays dry; pulled open and left, the brook comes up the well's column
 * into the hall within 1,000 ticks.
 */

import { expect } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import { CRITICAL } from '@systems/dwarves/needs';
import type { JobsReader } from '@systems/jobs';
import { LINK_DELAY_TICKS } from '@systems/buildings/constants';
import type { Scenario } from './runner';
import { cmd, expectNoInvariantFindings, fortressDwarves, pathWorld, trace, wagon } from './player-path';
import { CISTERN_DEPTH, cisternWater, cisternWork, lookAtCistern, planCistern, tileOf, wellWorks, type CisternPlan, type Col } from './cistern-well';
import type { TestWorld } from './test-world';

const SEED = 'bd-cistern-well';
const PRIORITY = 4;
/** The hall lies this many levels below the brook's water, as the three-year fortress's halls do. */
const HALL_BELOW_WATER = 5;
const DIRS: readonly Col[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

interface Layout { readonly plan: CisternPlan; readonly entrance: Col; readonly g: Col; readonly across: Col }

/**
 * The hall's place, as a player picks it near the brook: a 7 × 7 block of rock on the hall's level
 * and the cistern's, a dry surface column four tiles off for the stair down, and the brook within
 * reach of a tunnel of at least six tiles (a cistern worth the name), the shortest first.
 */
function layout(w: TestWorld): Layout | null {
  const map = w.map;
  let bz = -1;
  for (let i = 0; i < map.fluid.length; i += 1) if (map.hasFlag(i, TileFlag.Outdoor) && map.fluidLevelAt(i) > 0) bz = Math.max(bz, map.zOf(i));
  const H = bz - HALL_BELOW_WATER;
  const rock = (x: number, y: number, z: number): boolean => map.kindAt(w.index(x, y, z)) === TileKind.Wall && map.fluidLevelAt(w.index(x, y, z)) === 0;
  let best: Layout | null = null;
  for (let y = 4; y < map.h - 4; y += 1) for (let x = 4; x < map.w - 4; x += 1) {
    let solid = true;
    for (let dy = -3; dy <= 3 && solid; dy += 1) for (let dx = -3; dx <= 3; dx += 1) {
      if (!rock(x + dx, y + dy, H) || !rock(x + dx, y + dy, H - CISTERN_DEPTH)) { solid = false; break; }
    }
    if (!solid) continue;
    for (const g of DIRS) {
      const entrance = { x: x + 4 * g.x, y: y + 4 * g.y };
      if (entrance.x < 2 || entrance.y < 2 || entrance.x >= map.w - 2 || entrance.y >= map.h - 2) continue;
      const top = map.columnSurfaceZ(entrance.x, entrance.y);
      if (top <= H || map.kindAt(w.index(entrance.x, entrance.y, top)) !== TileKind.Floor) continue;
      let column = true;
      for (let z = H; z < top; z += 1) if (!rock(entrance.x, entrance.y, z)) column = false;
      if (!column) continue;
      const across = { x: g.y, y: g.x };
      const plan = planCistern(w, { x, y }, H, across, 14);
      if (plan === null || plan.tunnel.length < 6) continue;
      if (best === null || plan.tunnel.length < best.plan.tunnel.length) best = { plan, entrance, g, across };
    }
  }
  return best;
}

function placed(w: TestWorld, type: string, at: TileIndex): EntityId {
  return w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: type, origin: at, orientation: 0, materialChoice: 0 }).ok
    ? (w.game.world.scheduler.byId('14') as BuildingsSystem).lastPlacedBuilding : 0;
}

function play(): void {
  const w = pathWorld(SEED);
  const map = w.map;
  const ent = w.game.world.entities;
  const b = w.readers.of<BuildingsReader>('14');
  const found = layout(w);
  expect(found, 'a hall site within reach of the brook').not.toBeNull();
  const { plan, entrance, g, across } = found as Layout;
  const H = plan.hallZ;
  const W = plan.w;
  const send = (c: Parameters<typeof cmd>[1]): boolean => w.game.world.applyCommand(c).ok;

  // The fortress: a stair down, a 5 × 5 hall around the well's column, a door on the corridor.
  cmd(w, { type: 'DesignateStairwell', x: entrance.x, y: entrance.y, zTop: map.columnSurfaceZ(entrance.x, entrance.y), zBottom: H, priority: PRIORITY });
  const hall: TileIndex[] = [];
  for (let j = -2; j <= 2; j += 1) for (let i = -2; i <= 2; i += 1) hall.push(w.index(W.x + i, W.y + j, H));
  const doorTile = w.index(W.x + 3 * g.x, W.y + 3 * g.y, H);
  cmd(w, { type: 'Designate', kind: 'dig', priority: PRIORITY, tiles: [...hall, doorTile] });
  const hearthTile = w.index(W.x - 2 * g.x, W.y - 2 * g.y, H);
  const leverTile = w.index(W.x - 2 * across.x, W.y - 2 * across.y, H);
  const { x: wx, y: wy, z: wz } = wagon(w);
  const atWagon = w.index(wx, wy, wz);
  w.spawnItem('floodgate', 'granite', atWagon);
  w.spawnItem('mechanism', 'granite', atWagon, 3);
  w.spawnItem('chain', 'iron', atWagon);
  w.spawnItem('stone_block', 'granite', atWagon, 4);
  w.spawnItem('door', 'granite', atWagon);
  const work = cisternWork(plan, leverTile, PRIORITY);
  let hearth = 0;
  let door = 0;
  let hallWet = 0;
  const look = (): void => {
    lookAtCistern(w, work, send);
    if (hearth === 0 && map.kindAt(hearthTile) === TileKind.Floor) hearth = placed(w, 'hearth', hearthTile);
    if (door === 0 && map.kindAt(doorTile) === TileKind.Floor) door = placed(w, 'door', doorTile);
    for (const t of [...hall, doorTile]) hallWet = Math.max(hallWet, map.fluidLevelAt(t));
  };
  const until = 18 * TICKS_PER_DAY;
  while (w.tick < until && !(wellWorks(w, work) && b.get(hearth)?.state === 'built' && b.get(door)?.state === 'built')) {
    w.step(20);
    look();
  }
  const built = `${trace(w, 'bd_cistern_well')}; steps ${work.log.join(', ')}; cistern water ${cisternWater(w, work)}`;
  console.log(built);
  expect(wellWorks(w, work), `the well over the cistern works; ${built}`).toBe(true);
  expect(b.mechanismState(work.floodgateId), `the floodgate is shut again; ${built}`).toBe('closed');

  // Two quiet days: the shut cistern keeps its water and the hall stays dry.
  for (let k = 0; k < (2 * TICKS_PER_DAY) / 20; k += 1) { w.step(20); look(); }
  expect(map.fluidLevelAt(tileOf(w, W, plan.cisternZ)), 'water stands under the well').toBeGreaterThan(0);
  expect(wellWorks(w, work), 'the well still works').toBe(true);

  // The alert, with every drink forbidden: the dwarves shelter in the hall.
  const drinkType = w.game.registry.table('items').index('drink');
  for (const id of ent.with(C.Item)) if (ent.get(id, C.Item)?.type === drinkType) cmd(w, { type: 'ForbidItem', itemId: id, on: true });
  cmd(w, { type: 'CreateZone', zoneType: 'hearth_hall', tiles: hall.filter((t) => map.kindAt(t) === TileKind.Floor) });
  cmd(w, { type: 'SetAlert', level: 'hearth' });
  const tileOfDwarf = (id: EntityId): TileIndex => {
    const p = ent.get(id, C.Position);
    return p === undefined ? -1 : w.index(p.x, p.y, p.z);
  };
  const inHall = new Set(hall);
  const inShelter = (): EntityId[] => fortressDwarves(w).filter((id) => ent.get(id, C.Brain)?.behavior === 'retreat' && inHall.has(tileOfDwarf(id)));
  for (let k = 0; k < TICKS_PER_DAY / 20 && inShelter().length < fortressDwarves(w).length; k += 1) { w.step(20); look(); }
  const sheltered = inShelter();
  const where = fortressDwarves(w).map((id) => `${ent.get(id, C.Brain)?.behavior}@${map.zOf(tileOfDwarf(id))}`).join(' ');
  expect(sheltered.length, `dwarves shelter in the hall; ${where}; ${trace(w, 'bd_cistern_well')}`).toBeGreaterThanOrEqual(5);
  const [critical] = sheltered;
  const atWell = (t: TileIndex): boolean => map.zOf(t) === H && Math.max(Math.abs(map.xOf(t) - W.x), Math.abs(map.yOf(t) - W.y)) === 1;
  const drinks: { id: EntityId; tile: TileIndex; outdoors: boolean }[] = [];
  w.game.world.onEvents((batch) => {
    for (const e of batch) if (e.type === 'DrankWater') drinks.push({ id: Number(e['id']), tile: tileOfDwarf(Number(e['id'])), outdoors: e['outdoors'] === true });
  });
  let outdoors = 0;
  for (const id of sheltered) w.setNeed(id, 'thirst', id === critical ? (CRITICAL.thirst ?? 85) + 1 : 60);
  for (let k = 0; k < TICKS_PER_DAY / 20; k += 1) {
    w.step(20);
    look();
    // Out for its thirst: a dwarf whose hunger turns critical goes out to the wagon's food, which is no thirst of ours.
    for (const id of sheltered) if (map.hasFlag(tileOfDwarf(id), TileFlag.Outdoor) && ent.get(id, C.Brain)?.activity === 'thirst') outdoors += 1;
  }
  const theirs = drinks.filter((d) => sheltered.includes(d.id));
  const summary = `sheltered ${sheltered.length}, their drinks ${theirs.map((d) => `${d.id}@${map.xOf(d.tile)},${map.yOf(d.tile)},${map.zOf(d.tile)}`).join(' ')}; ` +
    `others' drinks ${drinks.filter((d) => !sheltered.includes(d.id)).map((d) => (d.outdoors ? 'brook' : 'well')).join(' ')}; well at ${W.x},${W.y},${H}`;
  console.log(summary);
  expect(w.game.world.fortress.alert, summary).toBe('hearth');
  expect(new Set(theirs.map((d) => d.id)).size, `every sheltering dwarf drank; ${summary}`).toBe(sheltered.length);
  expect(theirs.every((d) => atWell(d.tile) && !d.outdoors), `they drank at the well; ${summary}`).toBe(true);
  expect(outdoors, `no sheltering dwarf went out for a drink; ${summary}`).toBe(0);
  expect(hallWet, 'no water ever stood on the hall level').toBe(0);
  const dwarf = w.game.registry.table('creatures').index('dwarf');
  expect(w.events('CreatureDied').filter((e) => e['species'] === dwarf).length, `no dwarf died; ${trace(w, 'bd_cistern_well')}`).toBe(0);
  expectNoInvariantFindings(w, 'bd_cistern_well');

  // T-746: the player plays the floodgate of the finished well. Opening it joins the settled cistern
  // to the brook's full feed, and the water under the well's column rises (04, waking a body).
  cmd(w, { type: 'SetAlert', level: 'calm' });
  const jobs = w.readers.of<JobsReader>('11');
  const gateState = (): string => b.mechanismState(work.floodgateId);
  const pull = (): void => {
    expect(send({ type: 'PullLever', leverId: work.leverId }), 'the lever takes a pull').toBe(true);
    for (let k = 0; k < TICKS_PER_DAY / 20 && jobs.list().some((job) => job.key.startsWith(`pull_lever:${work.leverId}:`)); k += 1) { w.step(20); look(); }
  };
  const waitGate = (state: string): void => {
    for (let k = 0; k < 20 && gateState() !== state; k += 1) { w.step(LINK_DELAY_TICKS / 5); look(); }
    expect(gateState(), `the floodgate ${state}`).toBe(state);
  };
  const column = (): string => {
    const out: number[] = [];
    for (let z = plan.cisternZ; z <= H; z += 1) out.push(map.fluidLevelAt(tileOf(w, W, z)));
    return out.join(' ');
  };
  const hallLevel = (): number => [...hall, doorTile].reduce((s, t) => s + map.fluidLevelAt(t), 0);
  // Pulled open and at once shut: the gate stands open a few dozen ticks, and the hall stays dry.
  const openBefore = work.openTicks;
  pull();
  pull();
  waitGate('closed');
  let wet = 0;
  for (let k = 0; k < 1000 / 20; k += 1) { w.step(20); look(); wet = Math.max(wet, hallLevel()); }
  const quick = `column ${column()}; gate open ${work.openTicks - openBefore} ticks`;
  console.log(`T-746 pulled open and shut: ${quick}`);
  expect(wet, `the hall stays dry after a quick open; ${quick}`).toBe(0);
  // Pulled open and left: the brook comes up the well's column into the hall.
  pull();
  waitGate('open');
  const opened = w.tick;
  while (w.tick - opened < 1000 && hallLevel() === 0) { w.step(20); look(); }
  const left = `column ${column()}; hall ${hallLevel()} after ${w.tick - opened} ticks`;
  console.log(`T-746 pulled open and left: ${left}`);
  expect(hallLevel(), `the open floodgate floods the hall; ${left}`).toBeGreaterThan(0);
}

const scenario: Scenario = {
  id: 'bd_cistern_well',
  milestone: 8,
  seed: SEED,
  world: 'flat-test',
  timeoutMs: 300_000,
  run: () => play(),
};

export default scenario;
