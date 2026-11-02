import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { gameSections, loadGame, type EntityStoreState } from '@app/game-save';
import { readJsonSection, type SaveSection } from '@app/save-manager';
import { applyGenerated } from '@content/generate';
import { loadContent, rawTables } from '@content/loader';
import { ContentError } from '@content/schema';
import { C } from '@core/components';
import { PRIORITY_DEFAULT } from '@core/constants';
import { contentHashOf, makeTable, type Registry, type Row } from '@core/registry';
import type { JobsReader } from '@systems/jobs';
import { getSkill } from '@systems/combat/melee';

const { readRowBaseline, rowBaselineIssues } = await import(new URL('../../scripts/lib/row-baseline.mjs', import.meta.url).href) as {
  readRowBaseline(): Record<string, string[]>;
  rowBaselineIssues(data: Record<string, unknown>, baseline: Record<string, string[]>): string[];
};

type Rows = (Row & Record<string, unknown>)[];

/** The real table of rows added since the baseline. */
const realOrder = (): { table: string; id: string }[] => rawTables()['rowOrder'] as { table: string; id: string }[];

const baseline = readRowBaseline();

/** The hash of the baseline as it was written. It does not change: a new row goes in rowOrder. */
const PINNED_BASELINE_HASH = '766a7a820b0f76c2';

/** Every table as the loader sees it, after the generated rows. */
function tables(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const data = JSON.parse(JSON.stringify({ ...rawTables(), ...overrides })) as Record<string, unknown>;
  applyGenerated(data);
  return data;
}

/** The authored rows of a table with copies of its first row under new ids. */
function withRows(table: string, ...ids: string[]): Rows {
  const rows = rawTables()[table] as Rows;
  return [...rows, ...ids.map((id) => ({ ...(rows[0] as Row), id }))];
}

describe('T-478 makeTable numbers appended rows last', () => {
  const rows = [{ id: 'c' }, { id: 'a' }, { id: 'd' }, { id: 'b' }];

  it('sorts the unnamed rows, then takes the named ones in the order listed', () => {
    const table = makeTable('t', rows, ['d', 'a']);
    expect(table.ids()).toEqual(['b', 'c', 'd', 'a']);
    expect(['b', 'c', 'd', 'a'].map((id) => table.index(id))).toEqual([1, 2, 3, 4]);
    expect(table.rows.slice(1).map((r) => r.id)).toEqual(['b', 'c', 'd', 'a']);
    expect(table.where('all', () => true).map((r) => r.id)).toEqual(['b', 'c', 'd', 'a']);
    expect(table.idOf(4)).toBe('a');
    expect(table.size).toBe(4);
  });

  it('sorts as before with nothing appended', () => {
    expect(makeTable('t', rows).ids()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('throws on an appended id that is unknown or listed twice, and on a duplicate row', () => {
    expect(() => makeTable('t', rows, ['z'])).toThrow(/"z"/);
    expect(() => makeTable('t', rows, ['a', 'a'])).toThrow(/twice/);
    expect(() => makeTable('t', [...rows, { id: 'a' }], ['a'])).toThrow(/duplicate id "a"/);
    expect(() => makeTable('t', [...rows, { id: 'a' }])).toThrow(/duplicate id "a"/);
  });
});

describe('T-478 the rowOrder table', () => {
  it('numbers its rows after the baseline, in the order listed', () => {
    const plain = loadContent();
    for (const name of Object.keys(baseline)) {
      const listed = realOrder().filter((line) => line.table === name).map((line) => line.id);
      expect(plain.table(name).ids()).toEqual([...(baseline[name] as string[]), ...listed]);
    }
  });

  it('is not hashed: naming a row that already numbers last changes nothing', () => {
    const last = (baseline['biomes'] as string[]).at(-1) as string;
    const listed = loadContent({ overrides: { rowOrder: [...realOrder(), { table: 'biomes', id: last }] } });
    expect(listed.contentHash).toBe(loadContent().contentHash);
  });

  it('moves the content hash when it moves a row', () => {
    const first = (baseline['materials'] as string[])[0] as string;
    const listed = loadContent({ overrides: { rowOrder: [{ table: 'materials', id: first }] } });
    expect(listed.contentHash).not.toBe(loadContent().contentHash);
  });

  it('numbers a generated row last too', () => {
    const first = (baseline['materials'] as string[]).find((id) => id.endsWith('_meat') || id.endsWith('_bone'));
    if (first === undefined) throw new Error('the table has no generated material');
    const registry = loadContent({ overrides: { rowOrder: [{ table: 'materials', id: first }] } });
    expect(registry.table('materials').index(first)).toBe(registry.table('materials').size);
  });

  it('refuses a listed row that does not exist, a table that has no rows, and a line given twice', () => {
    const load = (rowOrder: unknown): (() => Registry) => () => loadContent({ overrides: { rowOrder } });
    expect(load([{ table: 'materials', id: 'no_such_row' }])).toThrow(ContentError);
    expect(load([{ table: 'materials', id: 'no_such_row' }])).toThrow(/no_such_row/);
    expect(load([{ table: 'no_such_table', id: 'granite' }])).toThrow(/no_such_table/);
    expect(load([{ table: 'biomeLookup', id: 'granite' }])).toThrow(/biomeLookup/);
    const first = (baseline['skills'] as string[])[0] as string;
    expect(load([{ table: 'skills', id: first }, { table: 'skills', id: first }])).toThrow(/twice/);
    expect(load([{ table: 'skills' }])).toThrow(ContentError);
  });
});

describe('T-478 every row keeps its number for good', () => {
  it('the baseline is the frozen one: a row is added to rowOrder, never to this file', () => {
    expect(contentHashOf(baseline)).toBe(PINNED_BASELINE_HASH);
  });

  it('holds every table of rows, but a table born after it, whose every row is in rowOrder', () => {
    const registry = loadContent();
    const listed = realOrder();
    for (const name of registry.tableNames()) {
      if (Object.keys(baseline).includes(name)) continue;
      const ids = registry.table(name).ids();
      expect(ids.length, name).toBeGreaterThan(0);
      expect(listed.filter((r) => r.table === name).map((r) => r.id), `${name} is newer than the baseline: every row of it is in rowOrder`).toEqual(ids);
    }
  });

  it('every id in it keeps its index in the real tables', () => {
    const registry = loadContent();
    for (const [name, ids] of Object.entries(baseline)) {
      const table = registry.table(name);
      ids.forEach((id, i) => {
        expect(table.has(id), `${name}: row "${id}" is gone`).toBe(true);
        expect(table.index(id), `${name}: row "${id}" must keep number ${i + 1}; add new rows to docs/03-content/row-order.md`).toBe(i + 1);
      });
    }
  });

  it('every row of the real tables is in it or in rowOrder', () => {
    expect(rowBaselineIssues(tables(), baseline)).toEqual([]);
  });
});

describe('T-478 forgetting rowOrder fails clearly', () => {
  it('a new row that sorts into the middle shifts the rows after it, and the check names the fix', () => {
    const issues = rowBaselineIssues(tables({ skills: withRows('skills', 'aaa_new_skill') }), baseline);
    expect(issues.join('\n')).toMatch(/moved from number 1 to 2/);
    expect(issues.join('\n')).toContain('| skills | aaa_new_skill |');
    expect(issues.join('\n')).toContain('docs/03-content/row-order.md');
  });

  it('content:check exits non-zero and prints the line to add', () => {
    const dir = mkdtempSync(join(tmpdir(), 'deepholm-rows-'));
    const file = join(dir, 'new-row.json');
    try {
      writeFileSync(file, JSON.stringify({ skills: withRows('skills', 'aaa_new_skill') }), 'utf8');
      const root = fileURLToPath(new URL('../../', import.meta.url));
      const res = spawnSync(process.execPath, ['scripts/content-check.mjs', '--fixture', file], { cwd: root, encoding: 'utf8' });
      expect(res.status).not.toBe(0);
      expect(res.stderr).toContain('| skills | aaa_new_skill |');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a new row that sorts last shifts nothing and still fails', () => {
    const issues = rowBaselineIssues(tables({ materials: withRows('materials', 'zzz_new_material') }), baseline);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('| materials | zzz_new_material |');
  });

  it('a new row in a table the baseline has never seen fails', () => {
    const issues = rowBaselineIssues(tables(), { ...baseline, skills: [] });
    expect(issues.length).toBe((baseline['skills'] as string[]).length);
    expect(issues[0]).toContain('| skills |');
  });

  it('a generated row fails like any other', () => {
    const creature = { ...(rawTables()['creatures'] as Rows).find((c) => c.id === 'cow') as Row, id: 'aaa_new_creature' };
    const issues = rowBaselineIssues(tables({ creatures: [...(rawTables()['creatures'] as Rows), creature] }), baseline);
    expect(issues.join('\n')).toContain('| creatures | aaa_new_creature |');
    expect(issues.join('\n')).toMatch(/\| materials \| aaa_new_creature_meat \|/);
  });

  it('a row listed in rowOrder passes', () => {
    const data = tables({
      skills: withRows('skills', 'aaa_new_skill'),
      rowOrder: [...realOrder(), { table: 'skills', id: 'aaa_new_skill' }],
    });
    expect(rowBaselineIssues(data, baseline)).toEqual([]);
  });

  it('an old row moved into rowOrder fails, and so does a removed one', () => {
    const first = (baseline['skills'] as string[])[0] as string;
    const moved = rowBaselineIssues(tables({ rowOrder: [{ table: 'skills', id: first }] }), baseline);
    expect(moved.join('\n')).toContain(`row "${first}" is older than the numbering rule`);
    const removed = rowBaselineIssues(tables({ skills: (rawTables()['skills'] as Rows).filter((s) => s.id !== first) }), baseline);
    expect(removed.join('\n')).toContain(`row "${first}" is gone`);
  });
});

describe('T-478 an older save under appended rows', () => {
  const fixture = new Uint8Array(readFileSync(fileURLToPath(new URL('../fixtures/played-fortress.deepholm', import.meta.url))));
  // These labors take the table up to 32, across a byte of the bitset; all of them, the
  // material and the skill sort first, so without the rule they would shift everything.
  const newLabors = Array.from({ length: 32 - (rawTables()['labors'] as Rows).length }, (_, n) => `aaa_new_labor_${n + 1}`);
  const appended = (): Registry => loadContent({
    overrides: {
      materials: withRows('materials', 'aaa_new_material'),
      skills: withRows('skills', 'aaa_new_skill'),
      labors: withRows('labors', ...newLabors),
      rowOrder: [
        ...realOrder(),
        { table: 'materials', id: 'aaa_new_material' },
        { table: 'skills', id: 'aaa_new_skill' },
        ...newLabors.map((id) => ({ table: 'labors', id })),
      ],
    },
  });

  const section = (sections: readonly SaveSection[], name: string): SaveSection => {
    const found = sections.find((s) => s.name === name || s.name.startsWith(`${name}:`));
    if (found === undefined) throw new Error(`no section ${name}`);
    return found;
  };

  it('loads with every tile, skill and labor bit as it was, and the new rows empty', async () => {
    const before = (await loadGame(fixture, { registry: loadContent() })).game;
    const { game: after, content } = await loadGame(fixture, { registry: appended() });
    expect(content.match).toBe('soft');

    // Every tile's material, by number and by id.
    expect(Array.from(after.map.material)).toEqual(Array.from(before.map.material));
    const oldMaterials = before.registry.table('materials');
    const newMaterials = after.registry.table('materials');
    for (const m of new Set(before.map.material)) {
      if (m !== 0) expect(newMaterials.idOf(m)).toBe(oldMaterials.idOf(m));
    }

    const oldSkills = before.registry.table('skills');
    const newSkills = after.registry.table('skills');
    const oldLabors = before.registry.table('labors');
    const newLabors = after.registry.table('labors');
    const bit = (bytes: Uint8Array, labor: number): boolean => ((bytes[labor >> 3] ?? 0) & (1 << (labor & 7))) !== 0;
    const dwarves = before.world.entities.with(C.Skills, C.Labors);
    expect(dwarves.length).toBeGreaterThan(0);
    for (const id of dwarves) {
      const was = before.world.entities.get(id, C.Skills);
      const is = after.world.entities.get(id, C.Skills);
      if (was === undefined || is === undefined) throw new Error('skills lost');
      expect(is.level).toBeInstanceOf(Uint8Array);
      expect(is.xp).toBeInstanceOf(Uint16Array);
      expect(is.level.length).toBe(newSkills.size + 1);
      expect(is.xp.length).toBe(newSkills.size + 1);
      expect(is.lastRaised).toBe(was.lastRaised);
      for (const skill of oldSkills.ids()) {
        expect(newSkills.index(skill)).toBe(oldSkills.index(skill));
        expect(is.level[newSkills.index(skill)]).toBe(was.level[oldSkills.index(skill)]);
        expect(is.xp[newSkills.index(skill)]).toBe(was.xp[oldSkills.index(skill)]);
      }
      expect(is.level[newSkills.index('aaa_new_skill')]).toBe(0);
      expect(is.xp[newSkills.index('aaa_new_skill')]).toBe(0);
      expect(getSkill(after.world.entities, after.registry, id, 'aaa_new_skill')).toBe(0);

      const wasOn = before.world.entities.get(id, C.Labors)?.enabled as Uint8Array;
      const isOn = after.world.entities.get(id, C.Labors)?.enabled as Uint8Array;
      expect(isOn.length).toBe(5);
      for (const labor of oldLabors.ids()) {
        expect(newLabors.index(labor)).toBe(oldLabors.index(labor));
        expect(bit(isOn, newLabors.index(labor))).toBe(bit(wasOn, oldLabors.index(labor)));
      }
      for (const labor of newLabors.ids().slice(oldLabors.size)) expect(bit(isOn, newLabors.index(labor))).toBe(false);
    }

    // The new labors stand at the default priority; the old ones keep theirs.
    const oldJobs = before.world.readers.of<JobsReader>('11');
    const newJobs = after.world.readers.of<JobsReader>('11');
    for (const labor of oldLabors.ids()) expect(newJobs.laborPriority(labor)).toBe(oldJobs.laborPriority(labor));
    for (const labor of newLabors.ids().slice(oldLabors.size)) expect(newJobs.laborPriority(labor)).toBe(PRIORITY_DEFAULT);
  });

  it('leaves everything else in the save as it was', async () => {
    const before = gameSections((await loadGame(fixture, { registry: loadContent() })).game);
    const after = gameSections((await loadGame(fixture, { registry: appended() })).game);
    for (const grid of ['map.kind', 'map.material', 'map.fluid', 'map.designation', 'map.flags', 'map.tempOverride', 'map.buildingAt', 'fortress', 'calendar', 'rng', 'commandLog', 'queues']) {
      expect(section(after, grid).bytes, grid).toEqual(section(before, grid).bytes);
    }
    const parts = (sections: readonly SaveSection[]): Record<string, [number, unknown][]> => (readJsonSection(section(sections, 'entities')) as EntityStoreState).components;
    const was = parts(before);
    const is = parts(after);
    expect(Object.keys(is)).toEqual(Object.keys(was));
    for (const name of Object.keys(was)) {
      if (name !== 'Skills' && name !== 'Labors') expect(JSON.stringify(is[name]), name).toBe(JSON.stringify(was[name]));
    }
  });

  it('keeps playing, and a new labor can be switched on', async () => {
    const { game } = await loadGame(fixture, { registry: appended() });
    const dwarf = game.world.entities.with(C.Labors)[0] as number;
    const labor = game.registry.table('labors').index(newLabors.at(-1) as string);
    expect(labor).toBe(32);
    expect(game.world.applyCommand({ type: 'SetLabor', dwarfId: dwarf, labor, on: true }).ok).toBe(true);
    const enabled = game.world.entities.get(dwarf, C.Labors)?.enabled as Uint8Array;
    expect((enabled[4] as number) & 1).toBe(1);
    game.step(20);
    expect(game.tick).toBeGreaterThan(0);
  });

  it('grows nothing when no row was added', async () => {
    const { game } = await loadGame(fixture, { registry: loadContent() });
    const size = game.registry.table('skills').size + 1;
    for (const id of game.world.entities.with(C.Skills)) expect(game.world.entities.get(id, C.Skills)?.level.length).toBe(size);
    for (const id of game.world.entities.with(C.Labors)) expect(game.world.entities.get(id, C.Labors)?.enabled.length).toBe(4);
  });
});
