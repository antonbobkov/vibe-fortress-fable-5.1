/** T-279: announcements name what they say, merge by the day, and carry dates; item names never repeat a word. */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { TICKS_PER_DAY, DAYS_PER_SEASON, DAYS_PER_YEAR } from '@core/constants';
import { C } from '@core/components';
import { EVENT_FIELDS, type EventType } from '@core/event-types';
import type { GameEvent } from '@core/events';
import { AnnouncementLog } from '@ui/announcements';
import { HintEngine } from '@ui/hints';
import { filterText, materialItemName } from '@ui/messages';
import { drawLogPanel, logDate } from '@ui/panels/log';
import { defaultUiState, type UiState } from '@ui/ui-state';
import { Strings, UI_STRINGS } from '@ui/strings';
import { TestWorld } from '../../scenarios/test-world';
import { registry, strings, surface } from './ui-fixture';

function world(seed: string): { w: TestWorld; log: AnnouncementLog } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const log = new AnnouncementLog(new Strings(w.game.registry), w.game.registry);
  log.register(w.game.world.registrations.announcements);
  return { w, log };
}

/** An event with every field of its catalog row filled with a value the announcement can read. */
function sample(type: EventType, ids: { dwarf: number; beast: number; item: number }, keyValue: string | undefined, keyField: string | undefined): GameEvent {
  const event: Record<string, unknown> = { type };
  for (const raw of EVENT_FIELDS[type].split(',')) {
    const name = raw.replace(/[[\]\s]/g, '').replace(/\{.*$/, '');
    if (name === '') continue;
    if (name === 'itemId') event[name] = ids.item;
    else if (name === 'thoughtId') event[name] = registry.table<{ id: string }>('thoughts').ids()[0];
    else if (name === 'id' || /Id$/.test(name)) event[name] = name === 'targetId' || name === 'victimId' || name === 'creatureId' ? ids.beast : ids.dwarf;
    else if (name === 'species' || /Species$/.test(name)) event[name] = 'wolf';
    else if (/^(count|children|n|amount|delta|tier|size|level|value|total|year|day|hour)$/.test(name)) event[name] = 99;
    else event[name] = 'other';
  }
  if (keyField !== undefined) event[keyField] = keyValue;
  return event as unknown as GameEvent;
}

describe('T-279 no announcement prints a raw placeholder, an empty hole or a doubled space', () => {
  it('formats every registered announcement from the fields of its event', () => {
    const { w, log } = world('t279-placeholders');
    const dwarf = w.spawnDwarf({ at: w.index(10, 10, Z) });
    const beast = w.spawnCreature('deer', w.index(11, 10, Z), 'wild');
    const item = w.spawnItem('log', 'pine', w.index(12, 10, Z), 1);
    const checked = new Set<string>();
    for (const { type, spec } of w.game.world.registrations.announcements) {
      const values: (string | undefined)[] = spec.keyField === undefined ? [undefined]
        : Object.keys(UI_STRINGS).filter((key) => key.startsWith(`${spec.stringKey}.`)).map((key) => key.slice(spec.stringKey.length + 1));
      for (const value of values) {
        const event = sample(type, { dwarf, beast, item }, value, spec.keyField);
        const fields = event as unknown as Record<string, number>;
        if (spec.atLeast !== undefined) fields[spec.atLeast.field] = spec.atLeast.value;
        if (spec.atMost !== undefined) fields[spec.atMost.field] = spec.atMost.value;
        if (spec.oneOf !== undefined) (fields as Record<string, unknown>)[spec.oneOf.field] = spec.oneOf.values[0];
        const announced = log.announce(event, w.readers, 1 + checked.size);
        if (announced === null) continue;
        checked.add(`${type}:${value ?? ''}`);
        expect(announced.line.text, `${type} ${value ?? ''}`).not.toMatch(/\{\w+/);
        expect(announced.line.text, `${type} ${value ?? ''}`).not.toMatch(/ {2}| \.|\(\)/);
      }
    }
    expect(checked.size).toBeGreaterThan(60);
  });
});

describe('T-279 kills and hunts', () => {
  it('the kill of a hunt quarry is announced once, by the hunt line, named for the deer after it is gone', () => {
    const w = new TestWorld({ seed: 't279-hunt', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const log = new AnnouncementLog(new Strings(w.game.registry), w.game.registry);
    log.register(w.game.world.registrations.announcements);
    const ent = w.game.world.entities;
    const hunter = w.spawnDwarf({ at: w.index(21, 20, Z), name: 'Oskar Stonetongue', skills: { crossbow: 10, hunting: 5 } });
    const items = w.game.registry.table('items');
    const iron = w.game.registry.table('materials').index('iron');
    const crossbow = w.spawnItem(items.index('crossbow'), iron, w.index(21, 20, Z));
    const bolts = w.spawnItem(items.index('bolt'), iron, w.index(21, 20, Z), 20);
    ent.add(hunter, C.Equipment, { weapon: crossbow, shield: 0, armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
      clothing: { body: 0, legs: 0, feet: 0, over: 0 }, quiver: bolts });
    const deerSpecies = w.game.registry.table('creatures').index('deer');
    const deer = w.game.world.services.spawn.creature(deerSpecies, w.index(25, 20, Z), 'wild');
    w.until((v) => v.events('HuntKill').length > 0 && v.events('KillRecorded').length > 0, TICKS_PER_DAY);
    expect(ent.alive(deer)).toBe(false);
    const kill = w.events('KillRecorded')[0]!;
    expect(kill['hunted']).toBe(true);
    expect(kill['victimSpecies']).toBe(deerSpecies);
    expect(log.announce(kill, w.readers, 5)).toBeNull();
    const hunt = log.announce(w.events('HuntKill')[0]!, w.readers, 5);
    expect(hunt?.line.text).toBe('Oskar Stonetongue has brought down a deer.');
  }, 120_000);

  it('a dwarf kill of a deer that no hunt job claimed is still announced as a kill', () => {
    const { w, log } = world('t279-not-a-hunt');
    const dwarf = w.spawnDwarf({ at: w.index(10, 10, Z), name: 'Oskar Stonetongue' });
    w.setLabor(dwarf, 'hunting', false);
    const deer = w.spawnCreature('deer', w.index(11, 10, Z), 'wild');
    const body = w.game.world.entities.get(deer, C.Body)!;
    w.game.world.emit({ type: 'DamageDealt', attackerId: dwarf, defenderId: deer, part: 'torso', damageType: 'edge', amount: body.parts[1]!.maxHp * 2 });
    w.until((v) => v.events('KillRecorded').length > 0, 30);
    const kill = w.events('KillRecorded')[0]!;
    expect(kill['hunted']).toBe(false);
    expect(log.announce(kill, w.readers, 5)?.line.text).toBe('Oskar Stonetongue has slain a deer.');
  });

  it('a trap kill is named for the trap', () => {
    const { w, log } = world('t279-trap');
    const trap = w.build('stone_fall_trap', w.index(14, 10, Z));
    const gloam = w.spawnCreature('gloam_warrior', w.index(15, 10, Z), 'hostile:gloam');
    const body = w.game.world.entities.get(gloam, C.Body)!;
    w.game.world.emit({ type: 'DamageDealt', attackerId: trap, defenderId: gloam, part: 'torso', damageType: 'blunt', amount: body.parts[1]!.maxHp * 4 });
    w.until((v) => v.events('KillRecorded').length > 0, 30);
    const text = log.announce(w.events('KillRecorded')[0]!, w.readers, 5)?.line.text;
    expect(text).toMatch(/^Stone-fall trap has slain an? [\w ]+\.$/);
  });

  it('a kill of an enemy names both, though the enemy is gone', () => {
    const { w, log } = world('t279-slain');
    const wolf = w.spawnCreature('wolf', w.index(10, 10, Z), 'wild');
    const dwarf = w.spawnDwarf({ at: w.index(11, 10, Z), name: 'Ketil Ironhand' });
    const e = w.game.world.entities;
    e.add(wolf, C.Wild, { ...e.get(wolf, C.Wild)!, state: 'attack' });
    const body = e.get(dwarf, C.Body)!;
    w.game.world.emit({ type: 'DamageDealt', attackerId: wolf, defenderId: dwarf, part: 'torso', damageType: 'edge', amount: body.parts[1]!.maxHp * 4 });
    w.until((v) => v.events('KillRecorded').length > 0, 30);
    expect(e.alive(dwarf)).toBe(false);
    const kill = w.events('KillRecorded')[0]!;
    expect(kill['hunted']).toBe(false);
    expect(log.announce(kill, w.readers, 5)?.line.text).toBe('A wolf has slain Ketil Ironhand.');
  });

  it('names a quarry that is already gone from the species the event carries', () => {
    const { w, log } = world('t279-prey');
    const hunter = w.spawnDwarf({ at: w.index(10, 10, Z), name: 'Oskar Stonetongue' });
    const species = w.game.registry.table('creatures').index('elk');
    expect(log.announce({ type: 'HuntKill', hunterId: hunter, targetId: 9999, targetSpecies: species }, w.readers, 1)?.line.text)
      .toMatch(/^Oskar Stonetongue has brought down an? \w+\.$/);
  });
});

describe('T-279 merging and dates', () => {
  it('raises the counter of an identical line of the same day though other lines came between', () => {
    const { log } = world('t279-merge');
    const day = 5 * TICKS_PER_DAY;
    log.append('note', 'Obsidian has formed.', day + 10);
    log.append('note', 'Something else.', day + 300);
    log.append('note', 'Obsidian has formed.', day + 900);
    log.append('note', 'Third thing.', day + 901);
    log.append('note', 'Obsidian has formed.', day + 1100);
    expect(log.lines.filter((line) => line.text === 'Obsidian has formed.')).toHaveLength(1);
    expect(log.lines.find((line) => line.text === 'Obsidian has formed.')?.count).toBe(3);
    expect(log.lines).toHaveLength(3);
    log.append('note', 'Obsidian has formed.', 6 * TICKS_PER_DAY + 5);
    expect(log.lines.filter((line) => line.text === 'Obsidian has formed.')).toHaveLength(2);
  });

  it('announces obsidian once a day however often it forms', () => {
    const { w, log } = world('t279-obsidian');
    const day = 52 * TICKS_PER_DAY;
    for (let k = 0; k < 6; k += 1) {
      log.announce({ type: 'ObsidianFormed', tile: 10 + k }, w.readers, day + k * 150);
      log.append('note', `Other line ${k}.`, day + k * 150 + 1);
    }
    const obsidian = log.lines.filter((line) => line.text === 'Obsidian has formed.');
    expect(obsidian).toHaveLength(1);
    expect(obsidian[0]?.count).toBe(6);
  });

  it('a line merged after midnight does not stop a later same-day merge', () => {
    const { log } = world('t279-scan');
    const day = 8 * TICKS_PER_DAY;
    // P is refreshed by window merges across midnight and ends up before Q, which stays in the old day.
    log.append('note', 'P line.', day - 200);
    log.append('note', 'Q line.', day - 190);
    for (const at of [-110, -20, 30, 60]) log.append('note', 'P line.', day + at);
    expect(log.lines.map((line) => `${line.text}${line.count}`)).toEqual(['P line.5', 'Q line.1']);
  });

  it('draws the day in front of each Log row, with the year for an earlier year', () => {
    const { log } = world('t279-dates');
    const spring8 = 7 * TICKS_PER_DAY + 40;
    log.append('note', 'Early line.', spring8);
    log.append('note', 'Later line.', (DAYS_PER_YEAR + DAYS_PER_SEASON + 11) * TICKS_PER_DAY);
    const now = (DAYS_PER_YEAR + DAYS_PER_SEASON + 11) * TICKS_PER_DAY + 5;
    expect(logDate(strings, spring8, spring8)).toBe('Sp 8');
    expect(logDate(strings, spring8, now)).toBe('Y1 Sp 8');
    expect(logDate(strings, now, now)).toBe('Su 12');
    const s = surface(40, 8);
    drawLogPanel(s, { col: 0, row: 0, cols: 40, rows: 8 }, log.lines, 0, strings, now, () => {});
    const lines = s.lines();
    expect(lines[2]).toMatch(/Su 12\s+Later line\./);
    expect(lines[3]).toContain('Y1 Sp 8');
    expect(lines[3]).toContain('Early line.');
    // The date is dim; the text keeps its severity colour.
    const date = s.cells.get(1, 2);
    expect(date.fg).toEqual(s.theme.dim);
  });
});

describe('T-279 item names never repeat a word', () => {
  it('drops the type when the material already ends with it, and the material when the type ends with it', () => {
    expect(materialItemName('wool cloth', { name: 'cloth' }, 3)).toBe('wool cloth');
    expect(materialItemName('meal', { name: 'easy meal' }, 8)).toBe('easy meals');
    expect(materialItemName('meal', { name: 'easy meal' }, 1)).toBe('easy meal');
    expect(materialItemName('oak', { name: 'log' }, 5)).toBe('oak logs');
    expect(materialItemName('iron', { name: 'bar', plural: 'bars' }, 1)).toBe('iron bar');
    expect(materialItemName('', { name: 'door' }, 2)).toBe('doors');
    expect(materialItemName('clothes', { name: 'cloth' }, 1)).toBe('clothes cloth');
    expect(materialItemName('leather', { name: 'leather boots', plural: 'leather boots' }, 2)).toBe('leather boots');
  });

  it('holds in the name of a filter too', () => {
    expect(filterText(registry, { type: registry.table('items').index('cloth'), materialId: registry.table('materials').index('wool_cloth') }, 3)).toBe('3 wool cloth');
  });

  it('holds for every item type with every material of the tables', () => {
    const items = registry.table<{ id: string; name: string; plural?: string }>('items');
    const materials = registry.table<{ id: string; name: string }>('materials');
    for (const item of items.rows.filter((row) => row !== undefined)) {
      for (const material of materials.rows.filter((row) => row !== undefined)) {
        for (const n of [1, 2]) {
          const words = materialItemName(material.name, item, n).split(' ');
          for (let k = 1; k < words.length; k += 1) expect(words[k], `${material.name} ${item.name}`).not.toBe(words[k - 1]);
        }
      }
    }
  });
});

describe('T-279 the hospital hint', () => {
  function hint(): { w: TestWorld; engine: HintEngine; ui: UiState; log: AnnouncementLog } {
    const { w, log } = world('t279-hospital');
    const ui = defaultUiState(Z);
    return { w, log, ui, engine: new HintEngine(w.game.registry, ui, log) };
  }

  it('is pending for a wound to a dwarf of the fortress', () => {
    const { w, engine, ui } = hint();
    const dwarf = w.spawnDwarf({ at: w.index(10, 10, Z) });
    engine.onEvents([{ type: 'WoundInflicted', id: dwarf, part: 'torso', woundType: 'cut', severity: 'serious' } as unknown as GameEvent], w.readers);
    expect(ui.hintPending).toContain('hint_hospital');
  });

  it('is not pending for a wound to a beast or an invader', () => {
    const { w, engine, ui } = hint();
    const wolf = w.spawnCreature('wolf', w.index(10, 10, Z), 'wild');
    const gloam = w.spawnCreature('gloam_warrior', w.index(12, 10, Z), 'hostile:gloam');
    for (const id of [wolf, gloam]) {
      engine.onEvents([{ type: 'WoundInflicted', id, part: 'torso', woundType: 'cut', severity: 'grievous' } as unknown as GameEvent], w.readers);
    }
    expect(ui.hintPending).not.toContain('hint_hospital');
  });
});
