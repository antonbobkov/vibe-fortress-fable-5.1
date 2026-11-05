import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  ContentError,
  SCHEMAS,
  TABLE_NAMES,
  validateAll,
} from '@content/schema';
import {
  contentRegistry,
  loadContent,
  rawTables,
  resetContentRegistry,
  type ItemTypeDef,
  type MaterialDef,
  type MineralDef,
  type RecipeDef,
  type SpeciesDef,
} from '@content/loader';
import { applyGenerated } from '@content/generate';
import { canonicalJson } from '@core/registry';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('T-M0-06 content: every table loads', () => {
  const registry = loadContent();

  it('the registry carries a table for every row-shaped schema', () => {
    const rowTables = Object.entries(SCHEMAS)
      .filter(([, s]) => s.shape === 'rows')
      .map(([name]) => name)
      .sort();
    expect(registry.tableNames()).toEqual(rowTables);
  });

  it('the JSON files on disk are exactly the tables the schema knows', () => {
    expect(Object.keys(rawTables()).sort()).toEqual([...TABLE_NAMES]);
  });

  it('every row-shaped table has rows', () => {
    for (const name of registry.tableNames()) {
      expect(registry.table(name).size, name).toBeGreaterThan(0);
    }
  });

  it('indices run from 1, with 0 reserved for "none"', () => {
    const materials = registry.table<MaterialDef>('materials');
    expect(materials.byIndex(0)).toBeUndefined();
    expect(materials.byIndex(1)).toBeDefined();
    expect(materials.index(materials.idOf(1))).toBe(1);
    expect(() => materials.index('no_such_material')).toThrow(RangeError);
  });

  it('rows are numbered in id order, and rows added later after them', () => {
    const items = registry.table<ItemTypeDef>('items');
    const ids = items.ids();
    const later = (rawTables()['rowOrder'] as { table: string; id: string }[]).filter((line) => line.table === 'items').map((line) => line.id);
    const older = [...ids].filter((id) => !later.includes(id));
    expect([...older].sort()).toEqual(older);
    expect([...ids]).toEqual([...older, ...later]);
    ids.forEach((id, i) => expect(items.index(id)).toBe(i + 1));
  });

  it('the derived structures of content-pipeline.md step 5 exist', () => {
    for (const name of [
      'materialsByClass',
      'recipesByWorkshop',
      'thoughtsByEvent',
      'speciesByBiome',
      'itemsByCategory',
      'itemsByTag',
    ]) {
      expect(registry.hasDerived(name), name).toBe(true);
    }
    const byClass = registry.derived<ReadonlyMap<string, readonly MaterialDef[]>>('materialsByClass');
    expect((byClass.get('stone') ?? []).length).toBeGreaterThan(10);
    const byWorkshop = registry.derived<ReadonlyMap<string, readonly RecipeDef[]>>('recipesByWorkshop');
    expect((byWorkshop.get('carpenter') ?? []).length).toBe(27); // workshops-and-recipes.md § Recipe counts
    expect((byWorkshop.get('smelter') ?? []).length).toBe(22);
  });

  it('the recipe counts match workshops-and-recipes.md § Recipe counts', () => {
    const byWorkshop = registry.derived<ReadonlyMap<string, readonly RecipeDef[]>>('recipesByWorkshop');
    const expected: Record<string, number> = {
      carpenter: 27,
      mason: 13,
      craftdwarf: 13,
      jeweler: 2,
      mechanic: 2,
      wood_furnace: 1,
      smelter: 22,
      forge: 40,
      kitchen: 4,
      still: 2,
      tannery: 1,
      leatherworks: 11,
      loom: 2,
      clothier: 8,
      farmers_workshop: 4,
      bowyer: 3,
      alchemist: 10,
      runeforge: 40,
    };
    for (const [workshop, count] of Object.entries(expected)) {
      expect((byWorkshop.get(workshop) ?? []).length, workshop).toBe(count);
    }
    expect(registry.table('recipes').size).toBe(205);
  });

  it('the content hash is a stable hex string', () => {
    expect(registry.contentHash).toMatch(/^[0-9a-f]{16}$/);
    expect(loadContent().contentHash).toBe(registry.contentHash);
  });

  it('the registry singleton is cached and resettable', () => {
    resetContentRegistry();
    const a = contentRegistry();
    expect(contentRegistry()).toBe(a);
    resetContentRegistry();
    expect(contentRegistry()).not.toBe(a);
  });
});

describe('T-M0-06 content: indices are stable across loads', () => {
  it('hematite has the same index every time', () => {
    const first = loadContent().table<MineralDef>('materials').index('hematite');
    const second = loadContent().table<MineralDef>('materials').index('hematite');
    expect(first).toBe(second);
    expect(first).toBeGreaterThan(0);
  });

  it('the index does not depend on the order of the JSON rows', () => {
    const base = loadContent();
    const shuffled = [...(rawTables()['materials'] as MaterialDef[])].reverse();
    const reordered = loadContent({ overrides: { materials: shuffled } });
    expect(reordered.table('materials').index('hematite')).toBe(
      base.table('materials').index('hematite'),
    );
    expect(reordered.contentHash).toBe(base.contentHash);
  });
});

describe('T-M0-06 content: generated recipes', () => {
  const registry = loadContent();
  const recipes = registry.table<RecipeDef>('recipes');

  it('one smelting recipe per ore', () => {
    const minerals = registry.table<MineralDef>('minerals');
    expect(minerals.size).toBe(16);
    for (const ore of minerals.ids()) {
      const recipe = recipes.byId(`smelt_${ore}`);
      expect(recipe, ore).toBeDefined();
      expect(recipe?.workshop).toBe('smelter');
      expect(recipe?.generated).toBe(true);
      expect(recipe?.baseTicks).toBe(150);
      expect(recipe?.xp).toBe(6);
    }
  });

  it('smelt_galena yields lead plus silver at 50%', () => {
    const recipe = recipes.byId('smelt_galena');
    expect(recipe?.inputs).toEqual([{ match: 'ore', count: 1, material: 'galena' }]);
    expect(recipe?.outputs).toEqual([
      { item: 'bar', count: 1, material: { fixed: 'lead' } },
      { item: 'bar', count: 1, permille: 500, material: { fixed: 'silver' } },
    ]);
  });

  it('smelt_hematite yields two iron', () => {
    expect(recipes.byId('smelt_hematite')?.outputs).toEqual([
      { item: 'bar', count: 2, material: { fixed: 'iron' } },
    ]);
  });

  it('the coal ores are their own fuel', () => {
    expect(recipes.byId('smelt_bituminous_coal')?.fuel).toBe(false);
    expect(recipes.byId('smelt_lignite')?.fuel).toBe(false);
    expect(recipes.byId('smelt_hematite')?.fuel).toBe(true);
  });

  it('the five alloys exist, steel among them', () => {
    for (const id of ['alloy_bronze', 'alloy_bismuth_bronze', 'alloy_brass', 'alloy_electrum', 'alloy_steel']) {
      const recipe = recipes.byId(id);
      expect(recipe, id).toBeDefined();
      expect(recipe?.baseTicks).toBe(200);
      expect(recipe?.xp).toBe(8);
      expect(recipe?.fuel).toBe(true);
    }
    expect(recipes.byId('alloy_bronze')?.inputs).toEqual([
      { match: 'bar', count: 1, material: 'copper' },
      { match: 'bar', count: 1, material: 'tin' },
    ]);
    expect(recipes.byId('alloy_bronze')?.outputs).toEqual([
      { item: 'bar', count: 2, material: { alloy: 'bronze' } },
    ]);
    // "1 iron bar + 1 flux + 1 fuel -> 1 steel"
    expect(recipes.byId('alloy_steel')?.inputs).toEqual([
      { match: 'bar', count: 1, material: 'iron' },
      { match: 'raw_stone', count: 1, material: 'flux' },
      { match: 'fuel', count: 1, material: 'fuel' },
    ]);
  });

  it('melt_metal_item exists at the smelter', () => {
    const recipe = recipes.byId('melt_metal_item');
    expect(recipe?.workshop).toBe('smelter');
    expect(recipe?.baseTicks).toBe(120);
    expect(recipe?.xp).toBe(3);
  });

  it('16 ores + 5 alloys + 1 melt = 22 generated recipes at the smelter; 2 per spell and 1 per enchantment at the runeforge', () => {
    expect(recipes.where('generated:smelter', (r) => r.generated === true && r.workshop === 'smelter').length).toBe(22);
    expect(recipes.where('generated', (r) => r.generated === true).length).toBe(60);
  });
});

describe('T-M0-06 content: generated materials', () => {
  const registry = loadContent();
  const materials = registry.table<MaterialDef>('materials');
  const creatures = registry.table<SpeciesDef>('creatures');

  it('every butcherable species has a meat material with its meat value', () => {
    for (const id of creatures.ids()) {
      const species = creatures.byId(id) as SpeciesDef;
      if (species.flags.butcherable !== true || species.meatValue <= 0) continue;
      const meat = materials.byId(`${id}_meat`);
      expect(meat, id).toBeDefined();
      expect(meat?.class).toBe('meat');
      expect(meat?.value).toBe(species.meatValue);
    }
  });

  it('hides and shells follow the species row', () => {
    expect(materials.byId('boar_hide')?.value).toBe(6);
    expect(materials.byId('boar_hide')?.class).toBe('leather');
    expect(materials.byId('cave_crab_shell')?.value).toBe(4);
    expect(materials.byId('cave_crab_shell')?.class).toBe('shell');
    expect(materials.byId('cave_crab_hide')).toBeUndefined();
  });

  it('the three fish materials exist with values 2, 2 and 3', () => {
    expect(materials.byId('trout_meat')?.value).toBe(2);
    expect(materials.byId('perch_meat')?.value).toBe(2);
    expect(materials.byId('blindfish_meat')?.value).toBe(3);
  });

  it('every crop and shrub species is a plant material', () => {
    for (const id of ['barley', 'turnip', 'dimcap', 'pale_bell', 'bramble_berry', 'sunfruit']) {
      const material = materials.byId(id);
      expect(material, id).toBeDefined();
      expect(material?.class).toBe('plant');
    }
  });

  it('magmaSafe is derived from the melting point', () => {
    expect(materials.byId('iron')?.magmaSafe).toBe(true); // melts at 1538
    expect(materials.byId('copper')?.magmaSafe).toBe(false); // melts at 1085
    expect(materials.byId('obsidian')?.magmaSafe).toBe(true); // melts at 1500
  });
});

describe('T-M0-06 content: validation reports table, row and field', () => {
  it('a dangling id fails with the table, row and field', () => {
    const items = [...(rawTables()['items'] as ItemTypeDef[])];
    const broken = { ...(items[0] as ItemTypeDef), fg: 'no_such_color' };
    expect(() => loadContent({ overrides: { items: [broken, ...items.slice(1)] } })).toThrow(
      ContentError,
    );
    try {
      loadContent({ overrides: { items: [broken, ...items.slice(1)] } });
    } catch (error) {
      const issues = (error as ContentError).issues;
      expect(issues).toHaveLength(1);
      expect(issues[0]?.table).toBe('items');
      expect(issues[0]?.row).toBe(broken.id);
      expect(issues[0]?.field).toBe('fg');
      expect(issues[0]?.message).toContain('no_such_color');
    }
  });

  it('a wrong field type fails with the expected type', () => {
    const labors = [...(rawTables()['labors'] as { id: string }[])];
    const broken = { ...(labors[0] as object), defaultOn: 'yes' };
    try {
      loadContent({ overrides: { labors: [broken, ...labors.slice(1)] } });
      throw new Error('expected a ContentError');
    } catch (error) {
      expect(error).toBeInstanceOf(ContentError);
      const issues = (error as ContentError).issues;
      expect(issues[0]?.field).toBe('defaultOn');
      expect(issues[0]?.message).toContain('expected a boolean');
    }
  });

  it('a missing table is reported', () => {
    try {
      loadContent({ overrides: { hints: undefined as unknown as [] } });
      // `undefined` still counts as present; delete it instead.
    } catch {
      // ignore
    }
    const data: Record<string, unknown> = { ...rawTables() };
    delete data['hints'];
    applyGenerated(data);
    const issues = validateAll(data);
    expect(issues.some((i) => i.table === 'hints' && i.message === 'table missing')).toBe(true);
  });

  it('a duplicate id is reported', () => {
    const labors = rawTables()['labors'] as { id: string }[];
    const data: Record<string, unknown> = { ...rawTables(), labors: [...labors, labors[0]] };
    applyGenerated(data);
    const issues = validateAll(data);
    expect(issues.some((i) => i.table === 'labors' && i.message === 'duplicate id')).toBe(true);
  });

  it('an unknown table is reported', () => {
    const data: Record<string, unknown> = { ...rawTables(), bogus: [] };
    applyGenerated(data);
    expect(validateAll(data).some((i) => i.table === 'bogus')).toBe(true);
  });
});

describe('T-M0-06 content: the content hash', () => {
  it('changes when a value changes', () => {
    const base = loadContent().contentHash;
    const materials = [...(rawTables()['materials'] as MaterialDef[])];
    const changed = { ...(materials[0] as MaterialDef), value: (materials[0] as MaterialDef).value + 1 };
    const other = loadContent({ overrides: { materials: [changed, ...materials.slice(1)] } });
    expect(other.contentHash).not.toBe(base);
  });

  it('does not change when only key order changes', () => {
    const materials = rawTables()['materials'] as MaterialDef[];
    const reordered = materials.map((m) => {
      const out: Record<string, unknown> = {};
      const source = m as unknown as Record<string, unknown>;
      for (const key of Object.keys(source).sort().reverse()) out[key] = source[key];
      return out as unknown as MaterialDef;
    });
    expect(loadContent({ overrides: { materials: reordered } }).contentHash).toBe(
      loadContent().contentHash,
    );
  });

  it('canonicalJson sorts keys', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalJson([1, { d: 4, c: 3 }])).toBe('[1,{"c":3,"d":4}]');
  });
});

describe('T-M0-06 content: content:check', () => {
  const run = (args: string[]): { status: number | null; output: string } => {
    const res = spawnSync('node', [join(root, 'scripts/content-check.mjs'), ...args], {
      cwd: root,
      encoding: 'utf8',
      shell: false,
    });
    return { status: res.status, output: `${res.stdout ?? ''}${res.stderr ?? ''}` };
  };

  it('exits zero on the committed tables', () => {
    const res = run([]);
    expect(res.output).toContain('no issues');
    expect(res.status).toBe(0);
  });

  it('exits non-zero on a broken fixture', () => {
    const dir = mkdtempSync(join(tmpdir(), 'deepholm-content-'));
    const file = join(dir, 'broken.json');
    try {
      const labors = rawTables()['labors'] as { id: string }[];
      writeFileSync(
        file,
        JSON.stringify({ skills: [{ id: 'bogus', name: 'Bogus', labor: 'no_such_labor', profession: null, military: null, attributes: [] }, ...(rawTables()['skills'] as object[])] }),
        'utf8',
      );
      expect(labors.length).toBeGreaterThan(0);
      const res = run(['--fixture', file]);
      expect(res.status).not.toBe(0);
      expect(res.output).toContain('no_such_labor');
      expect(res.output).toContain('skills[bogus].labor');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('F-07: recipe constraints are exported', () => {
  const reg = contentRegistry();
  const recipes = reg.table<RecipeDef>('recipes');
  const items = reg.table<ItemTypeDef>('items');
  const materials = reg.table<MaterialDef>('materials');

  it('exports recipe input constraints and output stage', () => {
    const forgeAnvil = recipes.byId('forge_anvil');
    expect(forgeAnvil?.inputs).toEqual([{ match: 'bar', count: 5, materials: ['iron', 'steel'] }]);

    const makeMechMetal = recipes.byId('make_mechanism_metal');
    expect(makeMechMetal?.inputs[0]?.materialProperty).toBe('magma_safe');

    const brew = recipes.byId('brew');
    expect(brew?.inputs[0]?.materialProperty).toBe('brewable');

    const millFlour = recipes.byId('mill_flour');
    expect(millFlour?.inputs[0]?.materials).toEqual(['barley', 'cavewheat']);

    const weaveCloth = recipes.byId('weave_cloth');
    expect(weaveCloth?.inputs[0]?.sameMaterial).toBe(true);
    expect(weaveCloth?.outputs[0]?.material).toEqual({ from: 'input', index: 0, stage: 'next' });

    const spinThread = recipes.byId('spin_thread');
    expect(spinThread?.inputs[0]?.match).toBe('fiber|wool_raw');
    expect(spinThread?.inputs[0]?.materials).toEqual(['flax_fiber', 'sporecloth_fiber', 'wool']);
    expect(spinThread?.outputs[0]?.material).toEqual({ from: 'input', index: 0, stage: 'next' });

    expect(items.byId('coal_bar')?.tags).toContain('fuel');
    expect(items.byId('charcoal_bar')?.tags).toContain('fuel');

    expect(materials.byId('flax_fiber')?.nextStage).toBe('flax_thread');
  });
});

describe("F-08: the Deep's emergences are exported", () => {
  it('exports levels 1 to 4 with non-empty emergence lists', () => {
    const raw = rawTables();
    const deep = raw['deepThresholds'] as Array<{
      level: number;
      pressure: number;
      emergence: Array<{ species: string; count: number }>;
      text: string;
    }>;
    expect(deep).toHaveLength(4);
    expect(deep[0]).toEqual({
      level: 1,
      pressure: 50,
      emergence: [{ species: 'hollow_crawler', count: 3 }],
      text: 'The Deep stirs. Something has noticed the pale metal being taken.',
    });
    expect(deep[1]).toEqual({
      level: 2,
      pressure: 150,
      emergence: [
        { species: 'hollow_stalker', count: 2 },
        { species: 'hollow_crawler', count: 3 },
      ],
      text: 'The rock cracks below. The Hollow sends its hunters.',
    });
    expect(deep[2]).toEqual({
      level: 3,
      pressure: 300,
      emergence: [
        { species: 'magma_wyrm', count: 1 },
        { species: 'hollow_stalker', count: 2 },
      ],
      text: 'Fire moves in the deep. A wyrm has come up.',
    });
    expect(deep[3]).toEqual({
      level: 4,
      pressure: 500,
      emergence: [
        { species: 'hollow_maw', count: 1 },
        { species: 'hollow_crawler', count: 4 },
        { species: 'hollow_stalker', count: 2 },
      ],
      text: 'The Hollow opens its mouth.',
    });
  });
});

describe('F-08: content never has an all-empty list column', () => {
  it('no array-valued column is empty in every row across all tables', () => {
    const raw = rawTables();
    for (const [tableName, data] of Object.entries(raw)) {
      const rows = Array.isArray(data)
        ? data
        : typeof data === 'object' && data !== null
          ? Object.values(data)
          : [];
      if (!Array.isArray(rows) || rows.length === 0) continue;

      const arrayProps = new Set<string>();
      for (const row of rows) {
        if (row && typeof row === 'object') {
          for (const [k, v] of Object.entries(row)) {
            if (Array.isArray(v)) arrayProps.add(k);
          }
        }
      }

      for (const prop of arrayProps) {
        if (tableName === 'embarkCatalog' && prop === 'sex') continue;
        if (tableName === 'weatherStates' && prop === 'tempDelta') continue;

        const someNonEmpty = rows.some((row) => {
          if (!row || typeof row !== 'object') return false;
          const val = (row as Record<string, unknown>)[prop];
          return Array.isArray(val) && val.length > 0;
        });

        expect(
          someNonEmpty,
          `table ${tableName} column ${prop} has an empty array on every row`,
        ).toBe(true);
      }
    }
  });
});

