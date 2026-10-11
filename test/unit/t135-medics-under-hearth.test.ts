/**
 * T-135: medical work continues under a `hearth` alert. A dwarf that holds or can claim a job for
 * a patient leaves the shelter for the length of that job and returns to it (10 § Behavior
 * selection step 2); a hostile near the patient keeps it away (step 1).
 */

import { describe, it, expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import type { CombatReader } from '@systems/combat';
import { TestWorld } from '../scenarios/test-world';

const Z = FLAT_TEST_SURFACE_Z - 7;

function rect(w: TestWorld, x: number, y: number, width: number, height: number): TileIndex[] {
  const out: TileIndex[] = [];
  for (let dy = 0; dy < height; dy += 1) for (let dx = 0; dx < width; dx += 1) out.push(w.index(x + dx, y + dy, Z));
  return out;
}

interface Fortress {
  readonly w: TestWorld;
  readonly medic: EntityId;
  readonly patient: EntityId;
  inHall(tile: TileIndex): boolean;
}

/** A dug chamber with a hearth hall at x 17..23; the medic is in the hall, the patient at x 36. */
function fortress(seed: string): Fortress {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
  w.digRoom(14, 14, Z, 34, 14);
  for (const tile of rect(w, 14, 14, 34, 14)) w.discover(tile);
  w.build('hearth', w.index(20, 20, Z), 'granite');
  w.zone('hearth_hall', rect(w, 17, 17, 7, 7));
  w.spawnItem('easy_meal', 'dimcap', w.index(22, 22, Z), 30);
  const barrel = w.spawnItem('barrel', 'pine', w.index(22, 18, Z));
  w.spawnItem('drink', 'ale', { containerId: barrel }, 30);
  w.spawnItem('cloth', 'flax_cloth', w.index(21, 21, Z), 10);
  const medic = w.spawnDwarf({ at: w.index(19, 19, Z) });
  w.setSkill(medic, 'medicine', 10);
  w.setLabor(medic, 'medicine', true);
  // The patient is a soldier at its station outside the hall, as under a hearth alert it stays on
  // duty there (16 § Squads); a civilian would shelter in the hall.
  const patient = w.spawnDwarf({ at: w.index(36, 20, Z) });
  w.setLabor(patient, 'medicine', false);
  w.game.world.applyCommand({ type: 'CreateSquad', name: 'Watch' });
  const squad = w.readers.of<CombatReader>('16').squads().find((sq) => sq.name === 'Watch')!;
  w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: squad.id, members: [patient] });
  w.game.world.applyCommand({ type: 'SetSquadStation', squadId: squad.id, tile: w.index(36, 20, Z) });
  w.game.world.applyCommand({ type: 'SetSquadMode', squadId: squad.id, mode: 'active' });
  const hall = (tile: TileIndex): boolean => w.readers.of<BuildingsReader>('14').hearthHallTiles().includes(tile);
  return { w, medic, patient, inHall: hall };
}

function tileOf(w: TestWorld, id: EntityId): TileIndex {
  const at = w.game.world.entities.get(id, C.Position);
  if (at === undefined) throw new Error('no position');
  return w.index(at.x, at.y, at.z);
}

/** Keeps every dwarf fed so that only the wound is in play. */
function run(f: Fortress, ticks: number): void {
  for (let t = 0; t < ticks; t += 10) {
    f.w.step(10);
    for (const id of [f.medic, f.patient]) {
      for (const need of ['hunger', 'thirst', 'rest'] as const) {
        const n = f.w.game.world.entities.get(id, C.Needs);
        if (n !== undefined && n[need] > 20) f.w.setNeed(id, need, 0);
      }
    }
  }
}

function wound(f: Fortress): void {
  const body = f.w.game.world.entities.get(f.patient, C.Body)!;
  f.w.game.world.emit({ type: 'DamageDealt', defenderId: f.patient, attackerId: 0, part: 'torso', damageType: 'edge', amount: Math.floor((body.parts[1]!.maxHp * 30) / 100) });
}

describe('T-135 10 17 medical work continues under a hearth alert', () => {
  it('the medic leaves the hall for a bleeding patient outside it, bandages it, and is back in retreat', () => {
    const f = fortress('t135-bandage');
    expect(f.w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' })).toEqual({ ok: true });
    run(f, 300);
    expect(f.w.game.world.entities.get(f.medic, C.Brain)?.behavior).toBe('retreat');
    wound(f);
    run(f, 20);
    expect(f.w.game.world.entities.get(f.patient, C.Patient), 'the dwarf is a patient').toBeDefined();
    expect(f.inHall(tileOf(f.w, f.patient)), 'the patient lies outside the hall').toBe(false);
    run(f, 900);
    expect(f.w.events('TreatmentDone').some((e) => e['patientId'] === f.patient && e['kind'] === 'stop_bleeding'), 'bandaged').toBe(true);
    expect(f.w.game.world.entities.alive(f.patient)).toBe(true);
    expect(f.w.game.world.fortress.alert).toBe('hearth');
    run(f, 600);
    expect(f.w.game.world.entities.get(f.medic, C.Brain)?.behavior).toBe('retreat');
    expect(f.inHall(tileOf(f.w, f.medic)), 'the medic is back in the hall').toBe(true);
  }, 120_000);

  it('a medic does not take other work under the alert', () => {
    const f = fortress('t135-no-other-work');
    f.w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' });
    run(f, 300);
    f.w.game.world.applyCommand({ type: 'Designate', kind: 'dig', priority: 1, tiles: [f.w.index(30, 25, Z)] });
    run(f, 300);
    expect(f.w.game.world.entities.get(f.medic, C.Brain)?.behavior).toBe('retreat');
    expect(f.inHall(tileOf(f.w, f.medic))).toBe(true);
  }, 60_000);

  it('a hostile within the threat radius of the patient keeps the medic away', () => {
    const f = fortress('t135-hostile');
    f.w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' });
    run(f, 300);
    wound(f);
    const wolf = f.w.spawnCreature('wolf', f.w.index(37, 21, Z), 'wild');
    const wild = f.w.game.world.entities.get(wolf, C.Wild)!;
    f.w.game.world.entities.add(wolf, C.Wild, { ...wild, state: 'idle', stateUntil: 0, hungry: true, lastThinkTick: 0 });
    for (let t = 0; t < 200 && f.w.game.world.entities.alive(wolf); t += 10) {
      run(f, 10);
      expect(f.w.events('TreatmentDone').filter((e) => e['patientId'] === f.patient && e['kind'] === 'stop_bleeding'), 'no bandage while the wolf lives').toEqual([]);
    }
    expect(f.w.game.world.entities.alive(f.medic)).toBe(true);
  }, 60_000);
});
