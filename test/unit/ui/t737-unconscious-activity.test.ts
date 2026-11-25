/**
 * T-737: a creature that is down reads "Unconscious" wherever its activity is shown (its view's
 * activity line, the tile list, the hover line, the Units list and its All tab), over the job word
 * its brain kept from before it fell ("Resting in hospital" on a stair, the playtest of
 * 2026-11-25). 10's `activityText` says "Unconscious" for a dwarf 17 holds unconscious and
 * "Carried to the hospital" while a `carry_patient` job has a worker; the panels add where it lies
 * ("Unconscious on the stairs", "on a ramp", "in bed"), and the Units list draws it in the alert
 * colour. On waking it reads its real activity again.
 */

import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C, type Wild } from '@core/components';
import { TileKind } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import { toHex } from '@render/palette';
import { CARRIED_ACTIVITY, UNCONSCIOUS_ACTIVITY, type DwarvesReader } from '@systems/dwarves';
import type { JobsReader } from '@systems/jobs';
import type { PanelContext } from '@ui/panels/context';
import { creatureActivity } from '@ui/panels/look-activity';
import { creatureSummary, drawCreatureView, tileListRows } from '@ui/panels/look';
import { activityLabel, isIdle } from '@ui/panels/units';
import { creatureFact } from '@ui/panels/units-all';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, press, strings, surface, theme } from './ui-fixture';

const NEEDS = ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const;
const LAYOUT = computeLayout(80, 42, true);

function quiet(w: TestWorld, id: EntityId): void {
  for (const need of NEEDS) w.setNeed(id, need, 0);
}

function ctxOf(w: TestWorld): PanelContext {
  return { readers: w.readers, registry: w.game.registry, strings } as unknown as PanelContext;
}

function conscious(w: TestWorld, id: EntityId): boolean {
  return w.game.world.entities.get(id, C.Body)?.conscious !== false;
}

/** Every place a creature's activity is shown, in its words. */
function shown(w: TestWorld, id: EntityId): { view: string; row: string; hover: string; units: string; all: string } {
  const registry = w.game.registry;
  const pos = w.game.world.entities.get(id, C.Position)!;
  const tile = w.index(pos.x, pos.y, pos.z);
  const s = surface(40, 30);
  drawCreatureView(s, { col: 0, row: 0, cols: 40, rows: 30 }, w.readers, registry, strings, id, pos.z);
  const view = s.lines().map((line) => line.trim()).find((line) => line.startsWith('Activity:')) ?? '';
  const row = tileListRows(w.readers, registry, strings, tile).find((r) => r.target?.kind === 'creature' && r.target.id === id)?.fact ?? '';
  const name = w.game.world.entities.get(id, C.Creature)?.name ?? '';
  const hover = creatureSummary(w.readers, registry, strings, id).slice(name.length + 2);
  const ctx = ctxOf(w);
  const dwarf = w.game.world.entities.has(id, C.Brain);
  const units = dwarf ? activityLabel(ctx, id) : creatureActivity(ctx, id);
  const all = creatureFact(ctx, { id, kind: dwarf ? 'dwarf' : 'wild', name });
  return { view, row, hover, units, all };
}

/** The Units panel's Dwarves tab drawn: the dwarf's row's activity and its colour. */
function unitsRow(w: TestWorld, id: EntityId): { text: string; fg: string } {
  const host: FortressHost = {
    readers: w.readers,
    registry: w.game.registry,
    ui: defaultUiState(Z),
    submit: (cmd) => w.submit(cmd),
    speed: () => 0,
    setSpeed: () => {},
    pan: () => {},
    changeZ: () => {},
    centerOn: () => {},
    home: () => {},
    zoom: () => {},
    layout: () => LAYOUT,
    precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements,
    now: () => 1000,
    confirm: (_id, _params, reply) => reply(true),
  };
  const screen = new FortressScreen(host, keymap, strings);
  screen.openPanel('units');
  // The cursor's row is inverted: put the cursor on another dwarf's row.
  if (screen.units.selectedId(screen.ctx) === id) screen.key(press('↓'));
  expect(screen.units.selectedId(screen.ctx)).not.toBe(id);
  const s = surface(80, 42);
  screen.draw(s);
  const name = w.game.world.entities.get(id, C.Creature)?.name ?? '';
  const lines = s.lines();
  const row = lines.findIndex((l, k) => k > 0 && l.includes(name));
  const line = lines[row] ?? '';
  const bar = LAYOUT.sidebar!;
  const chars = Array.from(line).slice(bar.col + 1).join('');
  const words = activityLabel(ctxOf(w), id).slice(0, 6);
  const at = chars.indexOf(words);
  return { text: chars.slice(at).trimEnd(), fg: at < 0 ? '' : toHex(s.cells.get(bar.col + 1 + at, row).fg) };
}

/** A dwarf planting at a farm plot, holding the job with its seed in hand; a second dwarf to keep the cursor. */
function planter(seed: string): { w: TestWorld; dwarf: EntityId } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const world = w.game.world;
  const tile = w.index(30, 20, Z);
  const zoneId = w.zone('farm_plot', [tile]);
  expect(world.applyCommand({ type: 'SetPlotCrop', zoneId, season: world.calendar.season, speciesId: 'barley' }).ok).toBe(true);
  w.spawnItem('seed', 'barley', w.index(40, 20, Z), 1);
  const dwarf = w.spawnDwarf({ at: w.index(24, 20, Z), name: 'Zuli Zinc' });
  quiet(w, dwarf);
  const jobs = w.readers.of<JobsReader>('11');
  const working = (): boolean => jobs.byKey(`plant:${tile}`)?.workerId === dwarf && !['', 'No job'].includes(world.entities.get(dwarf, C.Brain)?.activity ?? '');
  w.until(working, 2000);
  expect(working()).toBe(true);
  // A second dwarf, first in the list, keeps the Units cursor off this one's row.
  quiet(w, w.spawnDwarf({ at: w.index(10, 30, Z), name: 'Aban Aaronsson' }));
  return { w, dwarf };
}

describe('T-737 a creature that is down reads Unconscious wherever its activity is shown', () => {
  it('a dwarf knocked out mid-job reads Unconscious in every place, alert in Units, and its job word again on waking', () => {
    const { w, dwarf } = planter('t737-planter');
    const before = shown(w, dwarf);
    expect(before.units).not.toBe('');
    expect(before.units).not.toMatch(/Unconscious/);
    expect(before.view).toMatch(/^Activity: /);
    expect(unitsRow(w, dwarf).fg).toBe(toHex(theme.text));

    w.game.world.emit({ type: 'CreatureStunned', id: dwarf, until: w.tick + 300 });
    w.step(1);
    expect(conscious(w, dwarf)).toBe(false);
    // The brain keeps the word it had; 10's reader and the panels do not show it.
    const kept = w.game.world.entities.get(dwarf, C.Brain)?.activity ?? '';
    expect(['', 'No job', UNCONSCIOUS_ACTIVITY]).not.toContain(kept);
    expect(w.readers.of<DwarvesReader>('10').activityText(dwarf)).toBe(UNCONSCIOUS_ACTIVITY);
    // A stun puts it among the wounded while it lasts (17 § Bleeding, pain, consciousness): "· hurt".
    expect(shown(w, dwarf)).toEqual({ view: 'Activity: Unconscious', row: 'Unconscious', hover: 'Unconscious', units: 'Unconscious', all: 'Unconscious · hurt' });
    expect(isIdle(ctxOf(w), dwarf), 'a dwarf that is down is not idle').toBe(false);
    expect(unitsRow(w, dwarf)).toEqual({ text: 'Unconscious', fg: toHex(theme.alert) });

    for (let t = 0; t < 400 && !conscious(w, dwarf); t += 1) w.step(1);
    expect(conscious(w, dwarf)).toBe(true);
    quiet(w, dwarf);
    w.step(5);
    const after = shown(w, dwarf);
    expect(w.readers.of<DwarvesReader>('10').activityText(dwarf)).toBe(w.game.world.entities.get(dwarf, C.Brain)?.activity);
    expect(after.units).not.toMatch(/Unconscious/);
    expect(after.units).not.toBe('');
    expect(after.row).toBe(after.units);
    expect(after.hover).toBe(after.units);
    expect(unitsRow(w, dwarf).fg).not.toBe(toHex(theme.alert));
  });

  it('a casualty reads "Carried to the hospital" while its carry_patient job has a worker, then "Unconscious in bed"', () => {
    const w = new TestWorld({ seed: 't737-carry', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const bedTile = w.index(24, 20, Z);
    w.build('bed', bedTile, 'oak');
    w.build('chest', w.index(25, 20, Z), 'oak');
    w.zone('hospital', [bedTile, w.index(25, 20, Z)]);
    const patient = w.spawnDwarf({ at: w.index(20, 20, Z) });
    w.spawnDwarf({ at: w.index(23, 20, Z), skills: { medicine: 20 } });
    const body = w.game.world.entities.get(patient, C.Body)!;
    body.blood = Math.floor(body.maxBlood * 0.3);
    body.conscious = false;
    w.game.world.emit({ type: 'DamageDealt', defenderId: patient, attackerId: 0, part: 'torso', damageType: 'edge', amount: 1 });
    const jobs = w.readers.of<JobsReader>('11');
    const dwarves = w.readers.of<DwarvesReader>('10');
    w.until(() => jobs.byKey(`carry_patient:${patient}`) !== undefined, 400);
    expect(jobs.byKey(`carry_patient:${patient}`)?.workerId).toBe(0);
    expect(dwarves.activityText(patient)).toBe(UNCONSCIOUS_ACTIVITY);
    w.until(() => (jobs.byKey(`carry_patient:${patient}`)?.workerId ?? 0) !== 0, 400);
    expect(dwarves.activityText(patient)).toBe(CARRIED_ACTIVITY);
    expect(shown(w, patient)).toMatchObject({ view: 'Activity: Carried to the hospital', row: 'Carried to the hospital', hover: 'Carried to the hospital', units: 'Carried to the hospital' });
    w.until((v) => v.events('JobCompleted').some((e) => e['jobType'] === 'carry_patient'), 400);
    w.step(1);
    expect(conscious(w, patient)).toBe(false);
    expect(dwarves.activityText(patient)).toBe(UNCONSCIOUS_ACTIVITY);
    expect(activityLabel(ctxOf(w), patient)).toBe('Unconscious in bed');
  });

  it('says where it lies: on the stairs, on a ramp, on the floor', () => {
    const w = new TestWorld({ seed: 't737-where', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const ctx = ctxOf(w);
    const at = (x: number): TileIndex => w.index(x, 20, Z);
    const onStair = w.spawnDwarf({ at: at(10) });
    const onRamp = w.spawnDwarf({ at: at(14) });
    const onFloor = w.spawnDwarf({ at: at(22) });
    w.step(2);
    w.carve(at(10), TileKind.StairsDown);
    w.carve(at(14), TileKind.Ramp);
    for (const id of [onStair, onRamp, onFloor]) w.game.world.emit({ type: 'CreatureStunned', id, until: w.tick + 300 });
    w.step(1);
    expect(activityLabel(ctx, onStair)).toBe('Unconscious on the stairs');
    expect(activityLabel(ctx, onRamp)).toBe('Unconscious on a ramp');
    expect(activityLabel(ctx, onFloor)).toBe('Unconscious');
    expect(tileListRows(w.readers, w.game.registry, strings, at(10)).find((r) => r.target?.kind === 'creature' && r.target.id === onStair)?.fact)
      .toBe('Unconscious on the stairs');
  });

  it('a grazing deer knocked out reads Unconscious, and "Wild, unconscious" on the All tab', () => {
    const w = new TestWorld({ seed: 't737-deer', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const deer = w.spawnCreature('deer', w.index(20, 20, Z), 'wild');
    const row: Wild = { state: 'graze', homeChunk: 0, stateUntil: 1_000_000, hungry: false, lastThinkTick: 0, arrivedTick: 0 };
    w.game.world.entities.add(deer, C.Wild, row);
    expect(shown(w, deer).row).toBe('Grazing');
    w.game.world.emit({ type: 'CreatureStunned', id: deer, until: w.tick + 300 });
    w.step(1);
    expect(conscious(w, deer)).toBe(false);
    const down = shown(w, deer);
    expect(down.row).toBe('Unconscious');
    expect(down.hover).toBe('Unconscious');
    expect(down.units).toBe('Unconscious');
    expect(down.all).toBe('Wild, unconscious · hurt');
  });
});
