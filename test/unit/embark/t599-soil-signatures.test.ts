/**
 * T-599: a site's has and lacks agree with the soil its map is laid with
 * (`02-systems/02-embark-and-loadout.md` § What a site has and lacks;
 * `03-content/regions-biomes-and-traits.md` § Signatures, § Biomes). The soils a site yields
 * (tagged `soil_drop`) are on its has line exactly when its surface soil holds them, and never
 * lacking then; the rows name none as had and no biome names its own soil as lacking.
 */

import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SPEC } from '@app/headless';
import { rawTables } from '@content/loader';
import { applyGenerated } from '@content/generate';
import { validateAll } from '@content/schema';
import { lacksMaterial, siteSignature, siteSummary, type LocalMapSpec } from '@systems/embark';
import { registry } from '../ui/ui-fixture';

interface BiomeRow {
  id: string;
  soilDepth: number;
  soil: { material: string; weight: number }[];
  embarkable: boolean;
}
interface MaterialRow {
  id: string;
  class: string;
  tags?: string[];
}
interface SignatureRow {
  id: string;
  has: string[];
  lacks: string[];
}

const biomes = registry.table<BiomeRow>('biomes');
const materials = registry.table<MaterialRow>('materials');
const soilDrops = materials.ids().filter((id) => materials.byId(id)?.class === 'soil' && materials.byId(id)?.tags?.includes('soil_drop') === true);
const embarkable = biomes.ids().filter((id) => biomes.byId(id)?.embarkable === true);

const spec = (biome: string, traits: string[] = []): LocalMapSpec => ({ ...FLAT_TEST_SPEC, biome, soilDepth: biomes.byId(biome)!.soilDepth, geology: 'mixed', traits });

describe('T-599 a site signature agrees with its soil', () => {
  it('the soils it yields are on the has line exactly when its soil holds them, and never lacking then', () => {
    expect(soilDrops.sort()).toEqual(['clay', 'peat', 'sand']);
    for (const biome of embarkable) {
      for (const traits of [[], ['serene_vale'], ['glasslands']]) {
        const s = spec(biome, traits);
        const soil = siteSummary(s, registry).soil;
        const laid = soil === null ? [] : soil.materials;
        const sig = siteSignature(s, registry);
        for (const m of soilDrops) {
          const where = `${biome} ${traits.join(' ')} ${m}`;
          expect([where, sig.has.includes(m)]).toEqual([where, laid.includes(m)]);
          if (laid.includes(m)) {
            expect([where, lacksMaterial(sig, registry, materials.index(m))]).toEqual([where, false]);
            expect([where, sig.lacks.includes(m)]).toEqual([where, false]);
          }
        }
      }
    }
  });

  it('with no soil a site has none of them: alpine, and soil depth 0', () => {
    for (const biome of embarkable.filter((id) => biomes.byId(id)!.soilDepth === 0)) {
      const sig = siteSignature(spec(biome), registry);
      expect([biome, sig.has.filter((g) => soilDrops.includes(g))]).toEqual([biome, []]);
    }
    const alpine = siteSignature(spec('alpine'), registry);
    expect(alpine.has).toEqual(['stone', 'lichen', 'horn', 'ice']);
    expect(lacksMaterial(alpine, registry, materials.index('sand'))).toBe(true); // soil
    // The mountain, one level of sand and silt, has sand and does not price it.
    const mountain = siteSignature(spec('mountain'), registry);
    expect(mountain.has).toContain('sand');
    expect(lacksMaterial(mountain, registry, materials.index('sand'))).toBe(false);
  });

  it('temperate hills have clay and sand, before the biome goods, and their sand is not dear', () => {
    const hills = siteSignature(spec('temperate_hills'), registry);
    expect(hills.has).toEqual(['clay', 'sand', 'wood', 'honey', 'nettle_fiber']);
    expect(hills.lacks).toEqual(['salt']);
    expect(lacksMaterial(hills, registry, materials.index('sand'))).toBe(false);
    // A serene vale's soil is loam alone; the Glasslands' surface is obsidian.
    expect(siteSignature(spec('temperate_hills', ['serene_vale']), registry).has).toEqual(['wood', 'honey', 'nettle_fiber']);
    expect(siteSignature(spec('desert', ['glasslands']), registry).has).not.toContain('sand');
  });

  it('the rows name no yielded soil as had, and no biome names its own soil as lacking', () => {
    const rows = registry.table<SignatureRow>('signatures');
    for (const id of rows.ids()) {
      const row = rows.byId(id)!;
      expect([id, row.has.filter((g) => soilDrops.includes(g))]).toEqual([id, []]);
      const biome = biomes.byId(id);
      if (biome === undefined || biome.soilDepth <= 0) continue;
      const own = biome.soil.map((s) => s.material);
      expect([id, row.lacks.filter((g) => own.includes(g))]).toEqual([id, []]);
    }
  });

  it('content:check refuses a row that names a yielded soil as had, or its own soil as lacking', () => {
    const sigs = rawTables()['signatures'] as SignatureRow[];
    const tamper = (id: string, change: (row: SignatureRow) => SignatureRow): string[] => {
      const data: Record<string, unknown> = { ...rawTables(), signatures: sigs.map((r) => (r.id === id ? change(r) : r)) };
      applyGenerated(data);
      return validateAll(data).filter((i) => i.table === 'signatures').map((i) => `${i.row} ${i.field}`);
    };
    expect(tamper('alpine', (r) => r)).toEqual([]);
    expect(tamper('alpine', (r) => ({ ...r, has: [...r.has, 'sand'] }))).toEqual(['alpine has']);
    expect(tamper('temperate_hills', (r) => ({ ...r, lacks: [...r.lacks, 'sand'] }))).toEqual(['temperate_hills lacks']);
  });
});
