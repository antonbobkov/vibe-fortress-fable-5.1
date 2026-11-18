/**
 * T-595: raw food and drink are named by their material alone, as the stocks panel names their
 * stacks (24 § Announcements and lists, `items.md` § Food): "10 boar meat", "20 turnip", "20 ale",
 * not "10 boar meat raw meat", "20 turnip plant", "20 ale drink". Look's Items tab, the hover line,
 * a building's held items and the trade lists share `materialItemName`, so they agree.
 */

import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { Game } from '@app/game';
import type { EntityId } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import { materialItemName } from '@ui/messages';
import { drawLookPanel, tileContents } from '@ui/panels/look';
import { TestWorld } from '../../scenarios/test-world';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { registry, strings, surface } from './ui-fixture';

type ItemRow = { id: string; name: string; plural?: string; category?: string };
const items = registry.table<ItemRow>('items');
const materials = registry.table<{ id: string; name: string }>('materials');
const name = (material: string, type: string, n = 1): string => materialItemName(materials.byId(material)?.name ?? '', items.byId(type) as ItemRow, n);

describe('T-595 raw food and drink are named by their material', () => {
  it('names the default embark\'s goods once each', () => {
    expect(name('boar_meat', 'raw_meat', 10)).toBe('boar meat');
    expect(name('turnip', 'plant_food', 20)).toBe('turnip');
    expect(name('dimcap', 'plant_food', 20)).toBe('dimcap');
    expect(name('ale', 'drink', 20)).toBe('ale');
    expect(name('dimcap_ale', 'drink', 20)).toBe('dimcap ale');
    expect(name('trout_meat', 'raw_fish')).toBe('trout');
  });

  it('keeps the cured forms and every other item as they were', () => {
    expect(name('boar_meat', 'cured_meat')).toBe('cured boar meat');
    expect(name('turnip', 'seed', 5)).toBe('turnip seeds');
    expect(name('oak', 'log', 5)).toBe('oak logs');
    expect(name('wool_cloth', 'cloth', 3)).toBe('wool cloth');
    expect(materialItemName('', items.byId('drink') as ItemRow)).toBe('drink');
  });

  it('Look\'s Items tab on the wagon lists the goods with no doubled word', async () => {
    const game = new Game({ canvas: new MockCanvas(), seed: 't595', registry, createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
    await game.start({ embark: 'default' });
    const b = game.host.readers.of<BuildingsReader>('14');
    const wagon = b.byTag('container').find((x) => b.get(x)?.typeId === 'wagon') as EntityId;
    const it = game.host.readers.of<ItemsReader>('13');
    const centre = it.tileOf(it.inContainer(wagon)[0] as EntityId);
    const s = surface(60, 120);
    drawLookPanel(s, { col: 0, row: 0, cols: 60, rows: 120 }, game.host.readers, registry, strings, centre, 1);
    const text = s.lines().join('\n');
    expect(text).toMatch(/\b10 boar meat\b/);
    expect(text).toMatch(/\b20 turnip\b/);
    expect(text).toMatch(/\b20 ale\b/);
    expect(text).not.toMatch(/raw meat|turnip plant|dimcap plant|ale drink/);
  });

  it('the hover line names a lone item the same way', () => {
    const w = new TestWorld({ seed: 't595-hover', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const tile = w.index(30, 30, Z);
    w.spawnItem('raw_meat', 'boar_meat', tile, 10);
    expect(tileContents(w.readers, w.game.registry, strings, tile)).toContain('10 boar meat');
    expect(tileContents(w.readers, w.game.registry, strings, tile)).not.toContain('raw meat');
  });
});
