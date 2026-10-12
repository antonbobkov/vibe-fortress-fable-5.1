import { describe, expect, it, vi } from 'vitest';
import { C, type Wound } from '@core/components';
import type { EntityId } from '@core/types';
import type { JobsReader } from '@systems/jobs';
import type { MoraleReader } from '@systems/morale';
import { drawLookPanel } from '@ui/panels/look';
import { TestWorld } from '../../scenarios/test-world';
import { strings, surface, theme } from './ui-fixture';

const Z = 32;

function wound(over: Partial<Wound> = {}): Wound {
  return {
    type: 'cut',
    severity: 'serious',
    bleed: 3,
    pain: 15,
    healRemaining: 100_000,
    damage: 10,
    bandaged: false,
    sutured: false,
    splinted: false,
    cleaned: false,
    dressed: false,
    infected: false,
    infectedSince: 0,
    createdTick: 0,
    ...over,
  };
}

interface Scene {
  readonly w: TestWorld;
  readonly patient: EntityId;
  readonly medic: EntityId;
  readonly bed: EntityId;
}

interface SceneOptions {
  /** A hospital zone over three tiles, with a bed and a chest in it. */
  readonly hospital?: 'none' | 'zone' | 'bed';
  readonly medic?: boolean;
  readonly wound?: Partial<Wound>;
  readonly diagnosed?: boolean;
  readonly unconscious?: boolean;
  /** The patient lies on the hospital bed's tile. */
  readonly inBed?: boolean;
}

/** A patient, optionally a medic and a hospital; nothing has been stepped yet. */
function scene(o: SceneOptions = {}): Scene {
  const w = new TestWorld({ seed: 't277-care', world: 'flat-test', embark: 'none' });
  const bedTile = w.index(20, 10, Z);
  const hospital = o.hospital ?? 'bed';
  let bed = 0;
  if (hospital !== 'none') {
    w.zone('hospital', [bedTile, w.index(21, 10, Z), w.index(22, 10, Z)]);
    w.build('chest', w.index(21, 10, Z), 'granite');
    if (hospital === 'bed') bed = w.build('bed', bedTile, 'pine');
  }
  const patient = w.spawnDwarf({ at: o.inBed === true ? bedTile : w.index(10, 10, Z) });
  const medic = o.medic === false ? 0 : w.spawnDwarf({ at: w.index(14, 10, Z) });
  const body = w.game.world.entities.get(patient, C.Body)!;
  body.parts[2]!.wounds.push(wound({ ...(o.unconscious === true ? { pain: 400, bleed: 0, bandaged: true, type: 'bruise', severity: 'light' as const } : {}), ...o.wound }));
  body.diagnosed = o.diagnosed ?? false;
  w.game.world.entities.add(patient, C.Patient, { hospitalZoneId: 0, bedId: 0, needs: [], admittedTick: 0 });
  return { w, patient, medic, bed };
}

function lookLines(w: TestWorld, patient: EntityId, cols = 80): { text: string; lines: string[]; s: ReturnType<typeof surface> } {
  const tile = w.game.world.map.index(
    w.game.world.entities.get(patient, C.Position)!.x,
    w.game.world.entities.get(patient, C.Position)!.y,
    w.game.world.entities.get(patient, C.Position)!.z,
  );
  const s = surface(cols, 60);
  drawLookPanel(s, { col: 0, row: 0, cols, rows: 60 }, w.readers, w.game.registry, strings, tile, 2);
  const lines = s.lines().map((l) => l.trimEnd());
  return { text: lines.join('\n'), lines, s };
}

/** The Care line and its continuation lines, joined. */
function careOf(lines: string[]): string | undefined {
  const at = lines.findIndex((l) => l.trimStart().startsWith('Care:'));
  if (at < 0) return undefined;
  let text = lines[at]!.trim();
  for (let i = at + 1; i < lines.length && /^ {7}\S/.test(lines[i]!); i += 1) text += ` ${lines[i]!.trim()}`;
  return text;
}

function careColor(s: ReturnType<typeof surface>, lines: string[]): unknown {
  const row = lines.findIndex((l) => l.trimStart().startsWith('Care:'));
  const col = lines[row]!.indexOf('Care:');
  return s.cells.get(col, row).fg;
}

describe('T-277 Look: the mood is a whole number', () => {
  it('prints the rounded mood next to the tier name', () => {
    const w = new TestWorld({ seed: 't277-mood', world: 'flat-test', embark: 'none' });
    const id = w.spawnDwarf({ at: w.index(10, 10, Z) });
    w.step(2);
    const morale = w.readers.of<MoraleReader>('15');
    vi.spyOn(morale, 'mood').mockReturnValue(36.686247314646366);
    const { text } = lookLines(w, id);
    expect(text).toMatch(/Mood: \w+ \(37\)/);
    expect(text).not.toContain('36.68');
  });
});

describe('T-277 Look: a wounded dwarf shows what happens next', () => {
  it('names the missing hospital, in the alert colour, under the Health line', () => {
    const { w, patient } = scene({ hospital: 'none' });
    w.step(10);
    const { lines, s } = lookLines(w, patient);
    expect(careOf(lines)).toBe('Care: no hospital. Make one in Zones [z] > Hospital.');
    expect(careColor(s, lines)).toBe(theme.alert);
    const health = lines.findIndex((l) => l.includes('Health:'));
    expect(lines[health + 1]!.trimStart().startsWith('Care:')).toBe(true);
  });

  it('keeps the undiagnosed Health line and still shows the Care line', () => {
    const { w, patient } = scene({ hospital: 'none', diagnosed: false });
    w.step(1);
    const { text } = lookLines(w, patient);
    expect(text).toContain('Health: Wounded, bleeding');
    expect(text).toContain('Care: no hospital.');
    expect(text).not.toContain('hp');
  });

  it('says there is no free hospital bed when the hospital has none', () => {
    const { w, patient } = scene({ hospital: 'zone' });
    w.step(10);
    const { lines, s } = lookLines(w, patient);
    expect(careOf(lines)).toBe('Care: no free hospital bed.');
    expect(careColor(s, lines)).toBe(theme.alert);
  });

  it('says no one has Medicine enabled', () => {
    const { w, patient, medic } = scene();
    w.setLabor(patient, 'medicine', false);
    w.setLabor(medic, 'medicine', false);
    w.step(10);
    const { lines, s } = lookLines(w, patient);
    expect(careOf(lines)).toBe('Care: no one has Medicine enabled ([l] Labors).');
    expect(careColor(s, lines)).toBe(theme.alert);
  });

  it('says an unconscious patient waits to be carried', () => {
    const { w, patient, medic } = scene({ unconscious: true });
    w.setLabor(medic, 'hauling', false);
    w.setLabor(patient, 'hauling', false);
    w.step(10);
    const jobs = w.readers.of<JobsReader>('11');
    expect(jobs.byKey(`carry_patient:${patient}`)?.workerId).toBe(0);
    const { lines, s } = lookLines(w, patient);
    expect(careOf(lines)).toBe('Care: waiting to be carried to the hospital.');
    expect(careColor(s, lines)).toBe(theme.text);
  });

  it('names the treatment and the medic who is doing it', () => {
    const { w, patient, medic } = scene({ unconscious: true, inBed: true });
    const jobs = w.readers.of<JobsReader>('11');
    const name = w.game.world.entities.get(medic, C.Creature)!.name;
    w.until(() => jobs.forWorker(medic)?.target.ref === patient, 400);
    expect(jobs.typeOf(jobs.forWorker(medic)!.id)).toBe('diagnose');
    const { lines, s } = lookLines(w, patient);
    expect(careOf(lines)).toBe(`Care: diagnosis by ${name}.`);
    expect(careColor(s, lines)).toBe(theme.text);
  });

  it('names the supply a blocked treatment waits for, with the stock count', () => {
    const { w, patient } = scene({ diagnosed: true });
    w.step(30);
    const jobs = w.readers.of<JobsReader>('11');
    const job = jobs.byKey(`stop_bleeding:${patient}`);
    expect(job?.state).toBe('blocked');
    const { lines, s } = lookLines(w, patient);
    expect(careOf(lines)).toBe('Care: needs cloth (0 in stock).');
    expect(careColor(s, lines)).toBe(theme.alert);
  });

  it('counts what is in stock when a treatment still waits for a supply', () => {
    const { w, patient } = scene({ diagnosed: true });
    w.step(30);
    // The cloth is forbidden: it exists but cannot be used, so the job stays blocked.
    const cloth = w.spawnItem('cloth', 'flax_cloth', w.index(30, 30, Z), 3);
    w.game.world.applyCommand({ type: 'ForbidItem', itemId: cloth, on: true });
    w.step(30);
    const { lines } = lookLines(w, patient);
    expect(careOf(lines)).toMatch(/^Care: needs cloth \(\d+ in stock\)\.$/);
  });

  it('says the patient waits for a medic when no one is free to treat', () => {
    const { w, patient } = scene({ unconscious: true, inBed: true, medic: false });
    w.step(20);
    const { lines, s } = lookLines(w, patient);
    expect(careOf(lines)).toBe('Care: waiting for a medic.');
    expect(careColor(s, lines)).toBe(theme.text);
  });

  it('says a treated patient is resting until healed', () => {
    const { w, patient } = scene({
      inBed: true,
      diagnosed: true,
      wound: { bleed: 0, bandaged: true, sutured: true, cleaned: true, type: 'bruise', severity: 'light', pain: 45 },
    });
    w.step(10);
    expect(w.game.world.entities.has(patient, C.Patient)).toBe(true);
    const { lines, s } = lookLines(w, patient);
    expect(careOf(lines)).toBe('Care: resting until healed.');
    expect(careColor(s, lines)).toBe(theme.text);
  });

  it('shows no Care line for a dwarf who is not a patient', () => {
    const w = new TestWorld({ seed: 't277-none', world: 'flat-test', embark: 'none' });
    const id = w.spawnDwarf({ at: w.index(10, 10, Z) });
    const { text } = lookLines(w, id);
    expect(text).not.toContain('Care:');
  });

  it('wraps a long Care line in a narrow panel instead of cutting it', () => {
    const { w, patient } = scene({ hospital: 'none' });
    w.step(10);
    const { lines } = lookLines(w, patient, 36);
    expect(careOf(lines)).toBe('Care: no hospital. Make one in Zones [z] > Hospital.');
  });
});
