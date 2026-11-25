/**
 * T-710: an animal's view in Look draws 08's `creature › animal` sections (`ui-screens/fortress-screen.md`
 * § Inspection panel): a tame animal's species, state, owner, pasture, hunger and training, a wild
 * one's species, state and whether it is hunted, in the Animals panel's words; no animal has a dwarf's
 * mood line. The view keeps T-706's activity line and body-part names and T-707's `[p]` row, and fits
 * the 36-column sidebar under T-703's rule (a fact never cut; only names may end in `»`).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C, type Wild } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { EntityId } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { fgOfText, hexOf, keymap, strings, surface, theme } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;
const COLS = 80;
const ROWS = 42;
const LAYOUT = computeLayout(COLS, ROWS, true);
const SIDE = LAYOUT.sidebar?.col ?? 0;

function setup(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none', startTick: 10 * TICKS_PER_DAY });
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui: defaultUiState(z), submit: (cmd) => { w.game.world.applyCommand(cmd); },
    speed: () => 0, setSpeed: () => {}, pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
    layout: () => LAYOUT, precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements, now: () => 0,
  };
  return { w, f: new FortressScreen(host, keymap, strings) };
}

/** A wild animal in a known state, as 08's brain leaves it. */
function wild(w: TestWorld, species: string, x: number, over: Partial<Wild> = {}): EntityId {
  const id = w.spawnCreature(species, w.index(x, 5, z), 'wild');
  w.game.world.entities.add(id, C.Wild, { state: 'graze', homeChunk: 0, stateUntil: 1_000_000, hungry: false, lastThinkTick: 0, arrivedTick: 0, ...over });
  return id;
}

/**
 * The screen drawn with the creature's view open, its sidebar as text from the panel's first cell
 * in, and every cut T-703 forbids: text clipped without a `»`, or a `»` at all (no name here is
 * long enough to need one).
 */
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
  const rows = s.lines().map((line) => Array.from(line).slice(SIDE + 2).join('').trimEnd());
  for (const row of rows.slice(0, LAYOUT.sidebar?.rows ?? ROWS)) if (row.includes('»')) cuts.push(row);
  return { s, rows, cuts };
}

/** The value of a section's row: the text after its label, with the rows it wraps onto. */
function field(rows: readonly string[], name: string): string | undefined {
  const at = rows.findIndex((row) => row.startsWith(`${name} `));
  if (at < 0) return undefined;
  const parts = [(rows[at] as string).slice(10)];
  for (let k = at + 1; k < rows.length && /^ {10}\S/.test(rows[k] as string); k += 1) parts.push((rows[k] as string).trim());
  return parts.join(' ');
}

describe('T-710 a tame animal\'s view: species, state, owner, pasture, hunger, training', () => {
  it('a tame cow names its species, its pasture, its hunger and that it cannot be trained, under the rule; no mood', () => {
    const { w, f } = setup('t710-cow');
    const cow = w.spawnTame('cow', w.index(20, 20, z));
    const pasture = w.zone('pasture', Array.from({ length: 12 }, (_, n) => w.index(30 + (n % 4), 30 + Math.floor(n / 4), z)));
    expect(w.game.world.applyCommand({ type: 'AssignPasture', animalId: cow, zoneId: pasture }).ok).toBe(true);
    const tame = w.game.world.entities.get(cow, C.Tame);
    if (tame === undefined) throw new Error('no Tame');
    tame.condition = 70;
    const { s, rows, cuts } = view(f, cow);
    const rule = rows.findIndex((row) => row.startsWith('─'));
    expect(rows.slice(rule + 1, rule + 7)).toEqual([
      'Species   cow',
      'State     tame',
      'Owner     the fortress',
      'Pasture   Pasture #1',
      'Hunger    70 (very hungry)',
      'Training  cannot be trained',
    ]);
    // A hungry grazer's hunger in the alert colour; the pasture is a link, in the value colour.
    expect(fgOfText(s, rule + 5, '70 (very hungry)')).toBe(hexOf(theme.alert));
    expect(fgOfText(s, rule + 4, 'Pasture #1')).toBe(hexOf(theme.value));
    // T-706's activity line and part names, T-707's [p] row stay; the dwarf's mood line is gone.
    expect(rows).toContain('Activity: Keeping to Pasture #1');
    expect(rows.some((row) => row.trim().startsWith('left foreleg '))).toBe(true);
    expect(rows).toContain('[p] pasture: Pasture #1');
    expect(rows.some((row) => row.startsWith('Mood:'))).toBe(false);
    expect(cuts).toEqual([]);
  });

  it('a starving calf, pregnant and marked for slaughter: the state wraps whole under its value, the hunger in the bad colour', () => {
    const { w, f } = setup('t710-calf');
    const cow = w.spawnTame('cow', w.index(20, 20, z), { juvenileUntil: 20 * TICKS_PER_DAY });
    const tame = w.game.world.entities.get(cow, C.Tame);
    if (tame === undefined) throw new Error('no Tame');
    tame.condition = 100;
    tame.pregnantUntil = 20 * TICKS_PER_DAY;
    expect(w.game.world.applyCommand({ type: 'MarkSlaughter', animalId: cow }).ok).toBe(true);
    const { s, rows, cuts } = view(f, cow);
    expect(field(rows, 'State')).toBe('tame, young, pregnant, marked for slaughter');
    expect(field(rows, 'Pasture')).toBe('none');
    expect(field(rows, 'Hunger')).toBe('100 (starving)');
    expect(fgOfText(s, rows.findIndex((row) => row.startsWith('Hunger ')), '100 (starving)')).toBe(hexOf(theme.bad));
    expect(cuts).toEqual([]);
  });

  it('a war dog with its dwarf: its training and whom it is with; no pasture, hunger, mood or [p] row', () => {
    const { w, f } = setup('t710-dog');
    const dwarf = w.spawnDwarf({ at: w.index(5, 5, z), name: 'Ragnhild Brightvein' });
    const dog = w.spawnTame('dog', w.index(9, 5, z), { trained: 'war' });
    expect(w.game.world.applyCommand({ type: 'AssignAnimal', animalId: dog, dwarfId: dwarf }).ok).toBe(true);
    const { s, rows, cuts } = view(f, dog);
    const rule = rows.findIndex((row) => row.startsWith('─'));
    expect(rows.slice(rule + 1, rule + 6)).toEqual([
      'Species   dog',
      'State     tame',
      'Owner     the fortress',
      'With      Ragnhild Brightvein',
      'Training  trained for war',
    ]);
    expect(fgOfText(s, rule + 4, 'Ragnhild Brightvein')).toBe(hexOf(theme.value));
    for (const gone of ['Pasture', 'Hunger', 'Mood:', 'Hunted', '[p] pasture']) expect(rows.some((row) => row.startsWith(gone)), gone).toBe(false);
    // The pinned activity line wraps under itself (T-719): nothing is cut.
    expect(cuts).toEqual([]);
    expect(rows.join('\n')).toMatch(/Activity: Following Ragnhild\n {2}Brightvein\n/);
  });

  it('a pet names the dwarf it adopted as its owner; an untrained dog is untrained', () => {
    const { w, f } = setup('t710-pet');
    const dwarf = w.spawnDwarf({ at: w.index(5, 5, z), name: 'Torvald Deepshield' });
    const dog = w.spawnTame('dog', w.index(9, 5, z));
    const tame = w.game.world.entities.get(dog, C.Tame);
    if (tame === undefined) throw new Error('no Tame');
    tame.petOf = dwarf;
    const { rows } = view(f, dog);
    expect(field(rows, 'Owner')).toBe('Torvald Deepshield');
    expect(field(rows, 'Training')).toBe('untrained');
  });
});

describe('T-710 a wild animal\'s view: species, state, hunted', () => {
  it('a wild deer says it is wild and whether it is hunted, which [h] in Animals turns', () => {
    const { w, f } = setup('t710-deer');
    const deer = wild(w, 'deer', 7);
    const first = view(f, deer);
    const { cuts } = first;
    let { rows } = first;
    const rule = rows.findIndex((row) => row.startsWith('─'));
    expect(rows.slice(rule + 1, rule + 4)).toEqual(['Species   deer', 'State     wild', 'Hunted    yes']);
    expect(rows).toContain('Activity: Grazing');
    for (const gone of ['Owner', 'Pasture', 'Hunger', 'Training', 'Mood:', '[p] pasture']) expect(rows.some((row) => row.startsWith(gone)), gone).toBe(false);
    expect(cuts).toEqual([]);
    const species = w.game.world.entities.get(deer, C.Creature)?.species ?? 0;
    expect(w.game.world.applyCommand({ type: 'SetHuntable', species, on: false }).ok).toBe(true);
    ({ rows } = view(f, deer));
    expect(field(rows, 'Hunted')).toBe('no');
  });

  it('a wolf is dangerous, and hungry while its hunger lasts', () => {
    const { w, f } = setup('t710-wolf');
    const { rows } = view(f, wild(w, 'wolf', 7, { state: 'wander', hungry: true }));
    expect(field(rows, 'State')).toBe('wild, dangerous, hungry');
  });
});

describe('T-710 a dwarf keeps a dwarf\'s view', () => {
  it('needs and mood, and none of the animal sections', () => {
    const { w, f } = setup('t710-dwarf');
    const dwarf = w.spawnDwarf({ at: w.index(5, 5, z), name: 'Gunnar Coalhammer' });
    const { rows, cuts } = view(f, dwarf);
    expect(rows).toContain('Needs');
    expect(rows.some((row) => /^Mood: \w+ \(\d+\)$/.test(row))).toBe(true);
    expect(rows.some((row) => /^Health: Blood \d+%, Pain \d+$/.test(row))).toBe(true);
    for (const gone of ['Species', 'State', 'Owner', 'Training', 'Hunted']) expect(rows.some((row) => row.startsWith(`${gone} `)), gone).toBe(false);
    expect(cuts).toEqual([]);
  });
});
