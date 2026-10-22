/**
 * T-418: a dwarf takes no health job whose target is itself, except `give_crutch` (it fetches its own
 * crutch). A discharged dwarf with the medicine labor and a cut still to suture used to suture itself.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import type { JobBoard } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';

const NEEDS = ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const;

/** A dwarf with the medicine labor and a bandaged serious cut (discharged, its suture still to do); thread beside it. */
function cutMedic(seed: string, otherMedic: boolean) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const world = w.game.world;
  const labors = w.game.registry.table<{ id: string }>('labors').ids();
  const self = w.spawnDwarf({ at: w.index(10, 10, Z), skills: { medicine: 20 } });
  const ids = [self];
  let other = 0;
  if (otherMedic) { other = w.spawnDwarf({ at: w.index(30, 30, Z), skills: { medicine: 20 } }); ids.push(other); }
  for (const id of ids) {
    for (const l of labors) w.setLabor(id, l, l === 'medicine');
    for (const need of NEEDS) w.setNeed(id, need, 0);
  }
  w.spawnItem('thread', 'flax_thread', w.index(11, 10, Z), 3);
  world.emit({ type: 'DamageDealt', defenderId: self, attackerId: 0, part: 'torso', damageType: 'edge', amount: 21 });
  w.step(2);
  const cut = world.entities.get(self, C.Body)!.parts.flatMap((p) => p.wounds)[0]!;
  Object.assign(cut, { bandaged: true, bleed: 0, cleaned: true });
  world.entities.get(self, C.Body)!.diagnosed = true;
  w.step(10);
  expect(world.entities.has(self, C.Patient)).toBe(false);
  const board = world.services.jobs as JobBoard;
  const sutures = () => w.events('TreatmentDone').filter((e) => e['patientId'] === self && e['kind'] === 'suture');
  return { w, world, self, other, cut, board, sutures };
}

describe('T-418 a dwarf does not treat itself', () => {
  it('a discharged medic does not suture its own cut; the other medic does', () => {
    const a = cutMedic('t418-other', true);
    expect(a.board.byKey(`suture:${a.self}`)).toBeDefined();
    a.w.until(() => a.sutures().length === 1, 1200);
    expect(a.sutures()[0]!['medicId']).toBe(a.other);
    expect(a.cut.sutured).toBe(true);
  });

  it('with no other medic the suture waits; the dwarf never takes it', () => {
    const a = cutMedic('t418-alone', false);
    a.w.step(600);
    expect(a.sutures()).toHaveLength(0);
    expect(a.board.byKey(`suture:${a.self}`)?.workerId ?? 0).toBe(0);
    expect(a.cut.sutured).toBe(false);
  });
});
