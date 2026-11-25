/**
 * T-730: T-723's alert for a fortress animal bleeding with no bandage or cloth opened a view that did
 * not say why the animal was dying. An animal's view now marks a wound that bleeds unbandaged
 * (`serious cut (bleeding)`, in the alert colour) and has a `Care:` line while its `bandage_animal`
 * is open, the dwarf's words for a missing dressing first; the Animals panel marks a wounded row with
 * `+` and says `bleeding` or `wounded` in its words (`ui-screens/fortress-screen.md` § Inspection
 * panel, `panels.md` § Animals). Everything fits the 36-column sidebar uncut (T-703's rule).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { EntityId } from '@core/types';
import { BODY_SLOTS } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import type { JobsReader } from '@systems/jobs';
import { drawAnimalsPanel } from '@ui/panels/animals';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { fgOfText, hexOf, keymap, strings, surface, theme } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;
const COLS = 80;
const ROWS = 42;
const LAYOUT = computeLayout(COLS, ROWS, true);
const SIDE = LAYOUT.sidebar?.col ?? 0;
const NO_DRESSING = 'Care: bleeding, and no bandage or cloth to bandage it. Buy them from a caravan, or weave cloth at a loom.';

/** A keeper (and `cloth` cloth on the floor), a war dog, and the screen. */
function setup(seed: string, cloth = 0) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none', startTick: 10 * TICKS_PER_DAY });
  const keeper = w.spawnDwarf({ at: w.index(14, 10, z), skills: { animal_care: 20 }, name: 'Sigrun Ashbrook' });
  w.setLabor(keeper, 'medicine', false);
  if (cloth > 0) w.spawnItem('cloth', 'flax_cloth', w.index(14, 12, z), cloth);
  const dog = w.spawnTame('dog', w.index(10, 10, z), { trained: 'war' });
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui: defaultUiState(z), submit: (cmd) => { w.game.world.applyCommand(cmd); },
    speed: () => 0, setSpeed: () => {}, pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
    layout: () => LAYOUT, precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements, now: () => 0,
  };
  const f = new FortressScreen(host, keymap, strings);
  const wounds = () => w.game.world.entities.get(dog, C.Body)!.parts.flatMap((p) => p.wounds);
  /** A serious cut to the torso: 30% of its hit points, edge. */
  const cut = (): void => {
    const torso = w.game.world.entities.get(dog, C.Body)!.parts[BODY_SLOTS.indexOf('torso')]!;
    w.game.world.emit({ type: 'DamageDealt', defenderId: dog, attackerId: 0, part: 'torso', damageType: 'edge', amount: Math.ceil(torso.maxHp * 0.3) });
  };
  const job = () => w.readers.of<JobsReader>('11').byKey(`bandage_animal:${dog}`);
  return { w, f, keeper, dog, wounds, cut, job };
}

/** The screen with the creature's view open: its sidebar as text, and every cut T-703 forbids. */
function view(f: FortressScreen, id: EntityId) {
  f.inspectCreature(id);
  const s = surface(COLS, ROWS);
  const cuts: string[] = [];
  const text = s.text.bind(s);
  s.text = (col, row, value, fg, bg, width = Infinity) => {
    const kept = Array.from(value).slice(0, Math.min(width, COLS - col)).join('');
    if (col >= SIDE && Array.from(value).slice(kept.length).join('').trim() !== '' && !kept.endsWith('»')) cuts.push(value.trim());
    return text(col, row, value, fg, bg, width);
  };
  f.draw(s);
  const rows = s.lines().map((line) => Array.from(line).slice(SIDE + 2).join('').trimEnd()).slice(0, LAYOUT.sidebar?.rows ?? ROWS);
  for (const row of rows) if (row.includes('»')) cuts.push(row);
  return { s, rows, cuts };
}

/** The Animals panel drawn in the sidebar's width, the dog's row selected. */
function animals(f: FortressScreen, dog: EntityId) {
  f.openPanel('animals');
  f.animals.list.selected = f.animals.groups(f.ctx).findIndex((ids) => ids.includes(dog));
  const s = surface(36, 40);
  drawAnimalsPanel(s, { col: 0, row: 0, cols: 36, rows: 40 }, f.animals, f.ctx);
  return { s, rows: s.lines().map((line) => line.trim()) };
}

describe('T-730 an animal\'s view and the Animals panel show its wounds', () => {
  it('a war dog bleeding with no cloth: the wound bleeds, the Care line names the missing dressing, the panel marks it', () => {
    const { w, f, dog, cut, job, wounds } = setup('t730-bleed');
    w.step(2);
    cut();
    w.until(() => job()?.state === 'blocked', TICKS_PER_DAY / 4);
    expect(job()?.blockedReason).toBe('missing_input');
    expect(wounds().some((x) => x.type === 'cut' && x.severity !== 'light' && x.bleed > 0 && !x.bandaged)).toBe(true);

    const { s, rows, cuts } = view(f, dog);
    const health = rows.findIndex((r) => r.startsWith('Health: Blood'));
    expect(health).toBeGreaterThan(0);
    // The Care line comes under the Health line, broken at spaces under its first word.
    const care = rows.slice(health + 1, rows.findIndex((r) => r === '  Conscious'));
    expect(care.map((r) => r.trim()).join(' ')).toBe(NO_DRESSING);
    expect(care.slice(1).every((r) => r.startsWith('      '))).toBe(true);
    expect(fgOfText(s, rows.indexOf(care[0]!), 'Care: bleeding')).toBe(hexOf(theme.alert));
    // The wound under the torso says it bleeds, in the alert colour.
    const wound = rows.findIndex((r) => /^ {4}\w+ cut \(bleeding\)$/.test(r));
    expect(wound).toBeGreaterThan(health);
    expect(rows[wound - 1]).toMatch(/^ {2}torso /);
    expect(fgOfText(s, wound, 'cut (bleeding)')).toBe(hexOf(theme.alert));
    expect(cuts).toEqual([]);

    const panel = animals(f, dog);
    expect(panel.rows.some((r) => /^\+dog +- +- +war$/.test(r))).toBe(true);
    const words = panel.rows.findIndex((r) => r.startsWith('1 dog · bleeding'));
    expect(words).toBeGreaterThan(0);
    expect(`${panel.rows[words]} ${panel.rows[words + 1]}`).toContain('1 dog · bleeding · no pasture · trained for war');
    expect(fgOfText(panel.s, words, '1 dog · bleeding')).toBe(hexOf(theme.alert));
  });

  it('bandaged, the dog has no bleeding and no Care line; the panel says it is wounded', () => {
    const { w, f, dog, cut, wounds } = setup('t730-bandaged', 2);
    w.step(2);
    cut();
    w.until(() => wounds().some((x) => x.bandaged), TICKS_PER_DAY / 2);
    expect(wounds().some((x) => x.bandaged)).toBe(true);
    const { rows, cuts } = view(f, dog);
    const text = rows.join('\n');
    expect(text).not.toContain('Care:');
    expect(text).not.toContain('bleeding');
    expect(rows.some((r) => /^ {4}\w+ cut \(bandaged\)$/.test(r))).toBe(true);
    expect(cuts).toEqual([]);
    const panel = animals(f, dog);
    expect(panel.rows.some((r) => r.startsWith('+dog '))).toBe(true);
    expect(panel.rows.join('\n')).toContain('1 dog · wounded · no pasture');
    expect(panel.rows.join('\n')).not.toContain('bleeding');
  });

  it('while no one has Animal care on, the Care line says so; under way, it names the keeper', () => {
    const { w, f, keeper, dog, cut, job } = setup('t730-labor', 2);
    w.setLabor(keeper, 'animal_care', false);
    w.step(2);
    cut();
    w.until(() => job() !== undefined, TICKS_PER_DAY / 8);
    w.step(5);
    expect(job()?.workerId).toBe(0);
    expect(view(f, dog).rows.map((r) => r.trim()).join(' ')).toContain('Care: no one has Animal care enabled ([l] Labors).');
    w.setLabor(keeper, 'animal_care', true);
    w.until(() => (job()?.workerId ?? 0) !== 0, TICKS_PER_DAY / 8);
    expect(job()?.workerId).toBe(keeper);
    expect(view(f, dog).rows.map((r) => r.trim()).join(' ')).toContain('Care: bandaging by Sigrun Ashbrook.');
  });

  it('a healthy dog: no Care line, no bleeding, no mark in the panel', () => {
    const { w, f, dog } = setup('t730-healthy');
    w.step(2);
    const { rows, cuts } = view(f, dog);
    const text = rows.join('\n');
    expect(text).toMatch(/Health: Blood 100%, Pain 0/);
    for (const word of ['Care:', 'bleeding', 'wounded', ' cut']) expect(text).not.toContain(word);
    expect(cuts).toEqual([]);
    const panel = animals(f, dog);
    expect(panel.rows.some((r) => /^dog +- +- +war$/.test(r))).toBe(true);
    expect(panel.rows.join('\n')).not.toMatch(/\+dog|wounded|bleeding/);
  });

  it('a wounded dog is a row of its own, apart from the unhurt dogs of its kind', () => {
    const { w, f, dog, cut } = setup('t730-group');
    const other = w.spawnTame('dog', w.index(10, 14, z), { trained: 'war' });
    w.step(2);
    expect(f.animals.groups(f.ctx).find((ids) => ids.includes(dog))).toContain(other);
    cut();
    w.step(2);
    expect(f.animals.groups(f.ctx).find((ids) => ids.includes(dog))).toEqual([dog]);
  });
});
