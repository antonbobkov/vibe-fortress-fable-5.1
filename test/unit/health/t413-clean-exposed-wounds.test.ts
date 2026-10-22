/**
 * T-413: `clean_wound` is asked only for a wound that can still be infected (a cut, puncture or burn
 * that is not bandaged, sutured or cleaned) or that is infected and not yet being cured. A covered
 * wound, and a wound that cannot be infected at all (a bruise, a fracture), asks for no cleaning.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C, type Wound } from '@core/components';
import { createWound, woundTreatmentNeeds } from '@systems/health';
import type { JobBoard } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';

const wound = (type: Wound['type'], flags: Partial<Wound> = {}): Wound => ({ ...createWound(type, 'serious', 20, 0), ...flags });
const cleans = (w: Wound): boolean => woundTreatmentNeeds([w]).includes('clean_wound');

describe('T-413 the medic cleans only wounds that can be infected', () => {
  it.each([
    ['an open cut', true, wound('cut', { bleed: 0 })],
    ['an open puncture', true, wound('puncture', { bleed: 0 })],
    ['an open burn', true, wound('burn', { bleed: 0 })],
    ['a bandaged cut', false, wound('cut', { bandaged: true, bleed: 0 })],
    ['a sutured cut', false, wound('cut', { bandaged: true, sutured: true, bleed: 0 })],
    ['a cleaned cut', false, wound('cut', { bleed: 0, cleaned: true })],
    ['a fracture', false, wound('fracture', { bleed: 0 })],
    ['a bruise', false, wound('bruise')],
    ['an infected bandaged cut', true, wound('cut', { bandaged: true, bleed: 0, infected: true })],
    ['an infected cut whose cure is pending', false, wound('cut', { bandaged: true, bleed: 0, infected: true, cleaned: true, curedAt: 100 })],
  ] as const)('%s: cleaning asked = %s', (_, expected, w) => {
    expect(cleans(w)).toBe(expected);
  });

  it('a bandaged serious cut gets no cleaning job from a medic with a bucket at hand', () => {
    const w = new TestWorld({ seed: 't413-covered', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const world = w.game.world;
    const patient = w.spawnDwarf({ at: w.index(10, 10, Z) });
    for (const l of w.game.registry.table<{ id: string }>('labors').ids()) w.setLabor(patient, l, false);
    const medic = w.spawnDwarf({ at: w.index(12, 10, Z), skills: { medicine: 20 } });
    for (const l of w.game.registry.table<{ id: string }>('labors').ids()) w.setLabor(medic, l, l === 'medicine');
    w.spawnItem('cloth', 'flax_cloth', w.index(12, 11, Z), 3);
    w.spawnItem('bucket', 'oak', w.index(13, 11, Z));
    world.emit({ type: 'DamageDealt', defenderId: patient, attackerId: 0, part: 'torso', damageType: 'edge', amount: 21 });
    const board = world.services.jobs as JobBoard;
    const bandaged = () => w.events('TreatmentDone').some((e) => e['patientId'] === patient && e['kind'] === 'stop_bleeding');
    w.until(bandaged, 800);
    w.step(20);
    const cut = world.entities.get(patient, C.Body)!.parts.flatMap((p) => p.wounds)[0]!;
    expect(cut.bandaged).toBe(true);
    expect(world.entities.get(patient, C.Patient)?.needs ?? []).not.toContain('clean_wound');
    expect(board.byKey(`clean_wound:${patient}`)).toBeUndefined();
  });
});
