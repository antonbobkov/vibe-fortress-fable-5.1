/**
 * T-788: in Year 4 of playtest 7 Hospital #1 read "Requirements met · Beds: 1 … Patients: None" for
 * 80 dwarves while fifteen wounded lay in their own beds, and nothing said there was no cloth until a
 * wound bled. The Beds line now counts against the living dwarves, the patients list holds every
 * dwarf under care with where it lies, a standing alert comes before the wound, and the trade screen
 * marks the dressings the hospital wants (17 § Player-facing behavior).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import type { EntityId } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import { HOSPITAL_ALERT_DWARVES, HOSPITAL_BEDS_PER } from '@systems/health/constants';
import { AnnouncementLog, lineText } from '@ui/announcements';
import { hospitalWantsItem } from '@ui/hospital';
import type { PanelContext } from '@ui/panels/context';
import { hospitalBedsLine, hospitalPatientLines } from '@ui/panels/zones';
import { defaultUiState, fromSaved, toSaved } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { strings } from './ui-fixture';

function world(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

function ctxOf(w: TestWorld): PanelContext {
  return { readers: w.readers, registry: w.game.registry, strings,
    submit: (cmd) => w.submit(cmd), focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false };
}

function dwarves(w: TestWorld, n: number): EntityId[] {
  return Array.from({ length: n }, (_, k) => w.spawnDwarf({ at: w.index(10 + (k % 20), 30 + Math.floor(k / 20), Z) }));
}

/** A hospital of two tiles with a bed and a chest. */
function hospital(w: TestWorld): EntityId {
  w.build('bed', w.index(40, 40, Z), 'pine');
  w.build('chest', w.index(41, 40, Z), 'granite');
  return w.zone('hospital', [w.index(40, 40, Z), w.index(41, 40, Z), w.index(42, 40, Z)]);
}

function admit(w: TestWorld, id: EntityId, zoneId: EntityId, bedId: EntityId, needs: string[]): void {
  w.game.world.entities.add(id, C.Patient, { hospitalZoneId: zoneId, bedId, needs, admittedTick: w.tick });
}

describe('T-788 the hospital says what the fortress needs before the wounded come', () => {
  it('the Beds line counts against the living dwarves, in the alert colour while short', () => {
    const w = world('t788-beds');
    dwarves(w, 12);
    const zoneId = hospital(w);
    w.step(1);
    const ctx = ctxOf(w);
    const zone = w.readers.of<BuildingsReader>('14').zone(zoneId)!;
    expect(hospitalBedsLine(ctx, zone)).toEqual({ text: `Beds: 1 for 12 dwarves (aim for 1 in ${HOSPITAL_BEDS_PER})`, short: true });
    w.build('bed', w.index(42, 40, Z), 'pine');
    expect(hospitalBedsLine(ctx, zone)).toEqual({ text: 'Beds: 2 for 12 dwarves (aim for 1 in 10)', short: false });
    // A second hospital: this one's beds and all of them.
    w.build('bed', w.index(44, 44, Z), 'pine');
    w.zone('hospital', [w.index(44, 44, Z)]);
    expect(hospitalBedsLine(ctx, zone).text).toBe('Beds: 2 here, 3 in all, for 12 dwarves (aim for 1 in 10)');
  });

  it('the patients list holds every dwarf under care, this hospital\'s first, the others with where they lie', () => {
    const w = world('t788-patients');
    const [kari, sif] = dwarves(w, 2) as [EntityId, EntityId];
    const zoneId = hospital(w);
    w.step(1);
    admit(w, kari, 0, 0, ['stop_bleeding']);
    admit(w, sif, zoneId, 0, ['suture']);
    const ctx = ctxOf(w);
    const lines = hospitalPatientLines(ctx, w.readers.of<BuildingsReader>('14').zone(zoneId)!);
    const name = (id: EntityId): string => w.game.world.entities.get(id, C.Creature)!.name;
    const at = w.game.world.entities.get(kari, C.Position)!;
    expect(lines).toEqual([
      `${name(sif)}: suture`,
      `${name(kari)} · lying in the open (${at.x},${at.y},z${at.z}) · stop_bleeding`,
    ]);
  });

  it('the standing alert holds from the first patient or from HOSPITAL_ALERT_DWARVES, before any bleeding, and clears when cloth comes', () => {
    const w = world('t788-alert');
    dwarves(w, 5);
    const log = new AnnouncementLog(strings, w.game.registry);
    w.step(1);
    // A small fortress with no patient yet: nothing.
    expect(log.hospitalAlert(w.readers, w.tick, false)).toBeNull();
    // After the first patient, no hospital: make one.
    const none = log.hospitalAlert(w.readers, w.tick, true);
    expect(lineText(none!.line, strings)).toBe('! No hospital: [z] [o] makes one.');
    hospital(w);
    w.step(1);
    const dry = log.hospitalAlert(w.readers, w.tick, true);
    expect(lineText(dry!.line, strings)).toBe('! The hospital has no cloth or bandages: a bleeding dwarf cannot be bandaged. Buy them [c] or weave cloth at a loom.');
    expect(dry?.severity).toBe('alert');
    // From HOSPITAL_ALERT_DWARVES living dwarves, with no patient ever.
    dwarves(w, HOSPITAL_ALERT_DWARVES - 5);
    w.step(1);
    expect(log.hospitalAlert(w.readers, w.tick, false)).not.toBeNull();
    expect(w.game.world.entities.with(C.Patient)).toHaveLength(0);
    // Cloth to be had: the alert is gone.
    w.spawnItem('cloth', 'flax_cloth', w.index(30, 40, Z), 3);
    expect(log.hospitalAlert(w.readers, w.tick, false)).toBeNull();
  });

  it('the UI state keeps that a patient has come', () => {
    const ui = defaultUiState(Z);
    expect(ui.patientSeen).toBe(false);
    ui.patientSeen = true;
    const back = defaultUiState(Z);
    fromSaved(back, toSaved(ui, []));
    expect(back.patientSeen).toBe(true);
    const none = defaultUiState(Z);
    fromSaved(none, toSaved(defaultUiState(Z), []));
    expect(none.patientSeen).toBe(false);
  });

  it('the trade screen marks cloth and bandages while the hospitals hold fewer dressings than they want', () => {
    const w = world('t788-trade');
    hospital(w);
    w.step(1);
    const env = { readers: w.readers, registry: w.game.registry };
    const cloth = w.spawnItem('cloth', 'flax_cloth', w.index(30, 40, Z), 1);
    const bandage = w.spawnItem('bandage', 'flax_cloth', w.index(31, 40, Z), 1);
    const log = w.spawnItem('log', 'oak', w.index(32, 40, Z), 1);
    expect(hospitalWantsItem(env, cloth)).toBe(true);
    expect(hospitalWantsItem(env, bandage)).toBe(true);
    expect(hospitalWantsItem(env, log)).toBe(false);
    // Ten dressings in the hospital: what it wants by default (cloth 10, bandages 0).
    w.spawnItem('cloth', 'flax_cloth', w.index(42, 40, Z), 10);
    expect(hospitalWantsItem(env, cloth)).toBe(false);
    expect(hospitalWantsItem(env, bandage)).toBe(false);
  });
});
