import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { Registrations, type TickContext } from '@core/system';
import { roundTrip } from '@app/game-save';
import type { DwarvesSystem } from '@systems/dwarves';
import type { BuildingsReader } from '@systems/buildings';
import type { JobsReader } from '@systems/jobs';
import type { ItemsReader } from '@systems/items';
import { findFleeTile } from '@systems/dwarves/brain';
import { TestWorld } from '../scenarios/test-world';
import { runScenario } from '../scenarios/runner';
import stairThreat, { setupStairThreat } from '../scenarios/dw_stair_threat_return.scenario';

function context(w: TestWorld): TickContext {
  return { world: w.game.world, registry: w.game.registry, readers: w.readers,
    tick: w.tick, emit: (event) => w.game.world.emit(event), jobs: w.game.world.services.jobs,
    terrain: w.game.world.services.terrain, spawn: w.game.world.services.spawn,
    rng: w.game.world.rngFor('10'), register: new Registrations() };
}
function escaped(seed: string): { w: TestWorld; id: number; enemy: number; hall: number } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
  const actors = setupStairThreat(w);
  w.step(100);
  return { w, ...actors };
}

describe('T-141 remembered entrance threats', () => {
  it('filters contained and ground food in the radius search and stock fallback', () => {
    const w = new TestWorld({ seed: 't141-item-search', world: 'flat-test', embark: 'none' });
    const from = w.index(10, 10, 32);
    const barrel = w.spawnItem('barrel', 'pine', from);
    w.spawnItem('easy_meal', 'dimcap', { containerId: barrel });
    const near = w.spawnItem('easy_meal', 'dimcap', w.index(12, 10, 32));
    const far = w.spawnItem('easy_meal', 'dimcap', w.index(90, 90, 32));
    w.step(1);
    const items = w.readers.of<ItemsReader>('13');
    expect(items.findItem({ edible: true }, from, 'walker', { reservable: true,
      allowedTile: (tile) => tile !== from })).toBe(near);
    expect(items.findItem({ edible: true }, from, 'walker', { reservable: true,
      allowedTile: (tile) => tile === w.index(90, 90, 32) })).toBe(far);
  });

  it('does not oscillate between levels, and eats when hunger becomes critical', () => runScenario(stairThreat));

  it('finishes critical eating despite new threat scans when escape is available', () => {
    const { w, id } = escaped('t141-critical');
    w.setNeed(id, 'hunger', 90);
    w.until(() => w.events('MealEaten').some((e) => e['id'] === id), 500);
    expect(w.game.world.entities.get(id, C.Needs)?.hunger).toBeLessThan(50);
  });

  it('prefers a reachable hall even beyond the bounded fallback search', () => {
    const w = new TestWorld({ seed: 't141-distant-hall', world: 'flat-test', embark: 'none' });
    const id = w.spawnDwarf({ at: w.index(48, 48, 32) });
    const enemy = w.spawnCreature('gloam_warrior', w.index(53, 48, 32), 'hostile:gloam');
    w.build('hearth', w.index(80, 48, 32), 'granite');
    w.step(1);
    const goal = findFleeTile(context(w), id, enemy);
    expect(w.readers.of<BuildingsReader>('14').hearthHallTiles()).toContain(goal);
  });

  it('takes a safe job instead of the higher priority target near the remembered hostile', () => {
    const { w, id, hall } = escaped('t141-jobs');
    w.movement.teleport(id, hall);
    w.setNeed(id, 'hunger', 0);
    const brain = w.game.world.entities.get(id, C.Brain)!;
    w.game.world.entities.add(id, C.Brain, { ...brain, behavior: 'idle', activity: 'No job', behaviorUntil: w.tick });
    const unsafe = w.index(48, 47, 32);
    const safe = w.index(49, 49, 30);
    for (const [key, tile, priority] of [['t141:unsafe', unsafe, 1], ['t141:safe', safe, 5]] as const) {
      w.game.world.services.jobs.create(key, { type: 'build', target: { kind: 'tile', ref: tile }, workTile: tile, priority, inputs: [], data: { labor: 'construction' } });
    }
    w.step(1);
    expect(w.readers.of<JobsReader>('11').forWorker(id)?.key).toBe('t141:safe');
  });

  it('chooses safe food and retains its threat memory across a save', () => {
    const { w, id, enemy, hall } = escaped('t141-save');
    w.spawnItem('easy_meal', 'dimcap', hall, 1);
    const dwarfSystem = w.game.world.scheduler.byId('10') as DwarvesSystem;
    expect(dwarfSystem.serialize().threatened?.find(([dwarf]) => dwarf === id)?.[1].hostileId).toBe(enemy);
    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(w.hash());
    w.step(250);
    loaded.step(250);
    expect(loaded.hash()).toBe(w.hash());
    expect(w.events('MealEaten').some((e) => e['id'] === id)).toBe(true);
    expect(w.game.world.entities.get(id, C.Position)?.z).toBe(30);
  });

  it('allows the old target again when the living hostile moves beyond its last seen radius', () => {
    const { w, id, enemy } = escaped('t141-threat-leaves');
    w.movement.teleport(enemy, w.index(70, 48, 32));
    w.until(() => w.events('MealEaten').some((e) => e['id'] === id), 500);
    expect((w.game.world.scheduler.byId('10') as DwarvesSystem).serialize().threatened).toBeUndefined();
    expect(w.game.world.entities.get(id, C.Needs)?.hunger).toBeLessThan(50);
  });
});
