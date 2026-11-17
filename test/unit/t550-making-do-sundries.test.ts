/**
 * T-550, Making Do A4: what a site has and lacks (`02-systems/02-embark-and-loadout.md` § What a
 * site has and lacks), the scarcity price and the never-sold goods (`20-trade-and-caravans.md`
 * § The scarcity price, § Never sold), the sundries entries (`caravan-goods.md`, the Sundries
 * tables) and the new preferences.
 */

import { describe, expect, it } from 'vitest';
import { Game } from '@app/game';
import { FLAT_TEST_SPEC } from '@app/headless';
import { loadContent } from '@content/loader';
import { C, ItemFlag } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { RngStream } from '@core/rng';
import { WorldMapCompositor } from '@render/world-map';
import { lacksMaterial, localMapSpec, signatureGoodExists, siteSignature, siteSummary, type LocalMapSpec } from '@systems/embark';
import { generateGoods, neverSold, preferencePercent, SCARCITY_MARKUP, type TradeReader } from '@systems/trade';
import { merchantPrice, requiredValue } from '@systems/trade/valuation';
import { generate } from '@systems/worldgen';
import { WorldMapScreen } from '@ui/screens/world_map';
import { TestWorld } from '../scenarios/test-world';
import { MockCanvas, mockCanvasFactory } from './render/canvas-mock';
import { keymap, palette, press, registry, strings, surface, theme } from './ui/ui-fixture';

const spec = (over: Partial<LocalMapSpec>): LocalMapSpec => ({ ...FLAT_TEST_SPEC, traits: [], ...over });
const materials = registry.table('materials');

describe('T-550 what a site has and lacks', () => {
  it('unions the biome, geology and trait rows, and a good the site has is not lacking', () => {
    // A sedimentary wetland: the wetland lacks flux, the sedimentary layers have it.
    const wet = siteSignature(spec({ biome: 'wetland', geology: 'sedimentary' }), registry);
    expect(wet.has).toEqual(['reed', 'peat', 'bog_iron', 'clay', 'giant_bones', 'flux', 'coal', 'halite', 'fossils']);
    expect(wet.lacks).toEqual(['stone', 'gold', 'gem']);
    // An igneous wetland lacks it twice over, and lists it once.
    expect(siteSignature(spec({ biome: 'wetland', geology: 'igneous' }), registry).lacks).toEqual(['stone', 'flux']);
    // The Glasslands have obsidian and ash soil whatever the biome says; the mixed geology has no row.
    const glass = siteSignature(spec({ biome: 'mountain', geology: 'mixed', traits: ['glasslands'] }), registry);
    expect(glass.has).toEqual(['stone', 'sand', 'lichen', 'horn', 'ice', 'obsidian', 'ash_soil', 'wyrmtongue']);
    expect(glass.lacks).toEqual(['wood', 'soil', 'clay', 'honey']);
  });

  it('leaves out the goods the game does not have yet', () => {
    // Camels and reindeer came with T-561, honey with T-555: every word of the rows is in the game now.
    const desert = siteSignature(spec({ biome: 'desert', geology: 'igneous' }), registry);
    expect(desert.has).toEqual(['sand', 'salt', 'cactus_fiber', 'camels', 'giant_bones', 'copper', 'gem', 'basalt']);
    expect(desert.lacks).toEqual(['wood', 'clay', 'honey', 'peat', 'flux']);
    expect(siteSignature(spec({ biome: 'taiga' }), registry).has).toContain('reindeer');
    // A word whose species is not in the content is left out.
    const noCamels = { ...registry, table: (name: string) => (name === 'creatures' ? { has: () => false } : registry.table(name)) } as unknown as typeof registry;
    expect(signatureGoodExists(noCamels, 'camels')).toBe(false);
    expect(signatureGoodExists(registry, 'camels')).toBe(true);
  });

  it('a material is lacking when a lacks good names it and no has good does', () => {
    const mountain = siteSignature(spec({ biome: 'mountain', geology: 'igneous' }), registry);
    const lacks = (id: string): boolean => lacksMaterial(mountain, registry, materials.index(id));
    expect(lacks('oak')).toBe(true); // wood
    expect(lacks('clay')).toBe(true);
    expect(lacks('peat')).toBe(true); // soil
    expect(lacks('sand')).toBe(false); // soil, but the mountain has sand
    expect(lacks('limestone')).toBe(true); // flux: igneous
    expect(lacks('granite')).toBe(false);
    expect(lacks('iron')).toBe(false);
    // A sedimentary wetland lacks stone but has flux: its flux stone is not dear, its granite is.
    const wet = siteSignature(spec({ biome: 'wetland', geology: 'sedimentary' }), registry);
    expect(lacksMaterial(wet, registry, materials.index('limestone'))).toBe(false);
    expect(lacksMaterial(wet, registry, materials.index('granite'))).toBe(true);
  });

  it('the site summary carries the signature of real regions', () => {
    const world = generate('t550-sites', 32, registry);
    const desert = world.regions.find((r) => r.biome === 'desert');
    expect(desert).toBeDefined();
    const s = localMapSpec(world, desert!.id, registry);
    expect(siteSummary(s, registry).signature).toEqual(siteSignature(s, registry));
    expect(siteSummary(s, registry).signature.lacks.slice(0, 2)).toEqual(['wood', 'clay']);
  });

  it('the region panel shows the two rows after Wildlife, the lacks in the alert colour, a chance good "likely"', () => {
    const world = generate('t550-sites', 32, registry);
    const desert = world.regions.find((r) => r.biome === 'desert' && !r.traits.includes('glasslands'));
    expect(desert).toBeDefined();
    const screen = new WorldMapScreen(world, { embark: () => {}, back: () => {} }, keymap, strings, new WorldMapCompositor(registry, palette), registry);
    screen.cursor = { x: desert!.id % world.size, y: Math.floor(desert!.id / world.size) };
    const text = screen.regionLines().join(' ').replace(/\s+/g, ' ');
    expect(text).toMatch(/Wildlife .* This site has: sand, salt, cactus fiber, camels, likely giant bones, .*\. This site lacks: wood, clay, honey, peat/);
    const s = surface(100, 60);
    screen.draw(s);
    const rows = s.lines();
    const row = rows.findIndex((line) => line.includes('This site lacks:'));
    const has = rows.findIndex((line) => line.includes('This site has:'));
    expect(row).toBeGreaterThan(has);
    expect(s.cells.get(rows[row]!.indexOf('This site lacks:'), row).fg).toEqual(theme.alert);
    expect(s.cells.get(rows[has]!.indexOf('This site has:'), has).fg).not.toEqual(theme.alert);
  });
});

describe('T-550 sundries and preferences', () => {
  it('each civilization lists its sundries, the salt in bags of ten', () => {
    const goods = registry.derived<readonly { civ: string; entries: { item: string | string[]; sundries?: boolean; units?: number; container?: string; weight: number }[] }[]>('caravanGoods');
    const sundries = (civ: string): string[] => goods.find((g) => g.civ === civ)!.entries.filter((e) => e.sundries === true).map((e) => String(e.item));
    expect(sundries('mountainhome')).toEqual(['raw_stone', 'coal_bar', 'charcoal_bar', 'rough_gem', 'soil_load']);
    expect(sundries('hillfolk')).toEqual(['log', 'leather_piece', 'salt', 'soil_load', 'dung', 'cured_meat', 'honey', 'candle', 'camel']);
    expect(sundries('wildwood')).toEqual(['reed', 'fiber', 'feather', 'brightleaf', 'honey', 'beeswax']);
    for (const g of goods) for (const e of g.entries) if (e.sundries === true) expect(e.weight).toBe(6);
    const salt = goods.find((g) => g.civ === 'hillfolk')!.entries.find((e) => e.item === 'salt')!;
    expect(salt).toMatchObject({ container: 'bag', units: 10 });
  });

  it('a request for salt brings bags of ten; a request for a never-sold good brings nothing', () => {
    const rng = new RngStream(550);
    const extra = new RngStream(551);
    const goods = generateGoods(registry, 'hillfolk', 0, 0, [{ itemType: 'salt', priority: 3 }], rng, extra);
    const salt = goods.filter((g) => g.type === registry.table('items').index('salt'));
    expect(salt.length).toBeGreaterThan(0);
    for (const g of salt) {
      expect(g.container).toBe(registry.table('items').index('bag'));
      expect(g.units).toBe(10);
      expect([10, 20]).toContain(g.count);
    }
    const plain = generateGoods(registry, 'mountainhome', 0, 0, [], new RngStream(552), new RngStream(553));
    const asked = generateGoods(registry, 'mountainhome', 0, 0, [{ itemType: 'bar', material: 'deepsilver', priority: 3 }], new RngStream(552), new RngStream(553));
    expect(asked).toEqual(plain);
  });

  it('never sold: the list, and deepsilver below reputation 75', () => {
    expect(neverSold('wyrmscale', undefined, 100)).toBe(true);
    expect(neverSold('hollow_ichor', undefined, 0)).toBe(true);
    expect(neverSold('bar', 'deepsilver', 74)).toBe(true);
    expect(neverSold('bar', 'deepsilver', 75)).toBe(false);
    expect(neverSold('cloth', 'silk_cloth', 100)).toBe(true);
    expect(neverSold('log', 'oak', 0)).toBe(false);
    // No list names one.
    const goods = registry.derived<readonly { entries: { item: string | string[]; materials: { material: string }[] }[] }[]>('caravanGoods');
    for (const g of goods) {
      for (const e of g.entries) {
        for (const item of Array.isArray(e.item) ? e.item : [e.item]) expect(neverSold(item, undefined, 100), item).toBe(false);
        for (const m of e.materials) expect(neverSold('bar', m.material, 100), m.material).toBe(false);
      }
    }
  });

  it('the Hillfolk pay 150 for salt and the Wildwood 60 for bone', () => {
    expect(preferencePercent(registry, 'hillfolk', 'food/salt', 'salt', 'plant')).toBe(150);
    expect(preferencePercent(registry, 'wildwood', 'craft/totem', 'cow_bone', 'bone')).toBe(60);
    expect(preferencePercent(registry, 'mountainhome', 'craft/totem', 'cow_bone', 'bone')).toBe(130);
  });
});

describe('T-550 the scarcity price', () => {
  function atDepot(over: Partial<LocalMapSpec>): { w: TestWorld; depot: number; trade: TradeReader } {
    const w = new TestWorld({ seed: 't550-scarce', world: 'flat-test', embark: 'none', spec: spec(over), startTick: 31 * TICKS_PER_DAY });
    const depot = w.build('trade_depot', w.index(45, 8, 32), 'granite');
    w.until((world) => world.events('CaravanAtDepot').length > 0, 20 * TICKS_PER_DAY);
    return { w, depot, trade: w.readers.of<TradeReader>('20') };
  }

  /** An item of the merchant's, at the depot. */
  function merchantGood(w: TestWorld, depot: number, type: string, material: string, count = 1): number {
    const id = w.spawnItem(type, material, { containerId: depot }, count);
    w.game.world.services.items?.setFlag(id, ItemFlag.Merchant, true);
    return id;
  }

  it('a merchant\'s logs cost two and a half times as much in a desert, and say so; the fortress\'s are valued as before', () => {
    const { w, depot, trade } = atDepot({ biome: 'desert', geology: 'igneous' });
    const civ = trade.activeCaravan()!.civ;
    const logs = merchantGood(w, depot, 'log', 'oak', 1);
    const granite = merchantGood(w, depot, 'raw_stone', 'granite', 1);
    expect(trade.isScarce(logs)).toBe(true);
    expect(trade.isScarce(granite)).toBe(false);
    expect(trade.price(civ, logs)).toBeCloseTo(merchantPrice(trade.valuation(civ, logs)) * SCARCITY_MARKUP / 100);
    expect(trade.price(civ, granite)).toBeCloseTo(merchantPrice(trade.valuation(civ, granite)));
    // The fortress's own logs: not scarce, valued as before.
    const own = w.spawnItem('log', 'oak', w.index(40, 20, 32));
    expect(trade.isScarce(own)).toBe(false);

    // The offer asks the scarcity price.
    const tile = w.game.world.entities.get(depot, C.Building)!.footprint[0]!;
    const broker = w.spawnDwarf({ at: tile });
    w.submit({ type: 'AssignTitle', dwarfId: broker, title: 'broker' });
    w.step(1);
    const chair = w.spawnItem('chair', 'granite', tile);
    w.submit({ type: 'MoveToDepot', itemIds: [chair] });
    w.until((world) => ((world.game.world.entities.get(chair, C.Item)?.flags ?? 0) & ItemFlag.AtDepot) !== 0, 300);
    w.submit({ type: 'TradeOpen', depotId: depot });
    w.until(() => trade.sessionOpen(), 300);
    w.submit({ type: 'TradeOffer', give: [{ itemId: chair, count: 1 }], take: [{ itemId: logs, count: 1 }] });
    w.step(1);
    const refused = w.events('TradeRefused');
    const required = requiredValue(trade.price(civ, logs), trade.marginPercent(civ));
    if (trade.valuation(civ, chair) >= required) expect(refused).toHaveLength(0);
    else expect(refused[0]?.['shortfall']).toBe(Math.ceil(required - trade.valuation(civ, chair)));
  });

  it('in a forest the same logs are not scarce', () => {
    const { w, depot, trade } = atDepot({ biome: 'temperate_forest', geology: 'sedimentary' });
    const civ = trade.activeCaravan()!.civ;
    const logs = merchantGood(w, depot, 'log', 'oak', 1);
    expect(trade.isScarce(logs)).toBe(false);
    expect(trade.price(civ, logs)).toBeCloseTo(merchantPrice(trade.valuation(civ, logs)));
  });

  it('the requests editor refuses a never-sold good with its reason', () => {
    const { w } = atDepot({ biome: 'desert' });
    w.submit({ type: 'SetRequests', civ: 'hillfolk', entries: [{ itemType: 'wyrmscale', priority: 1 }] });
    w.step(1);
    expect(w.events('CommandRejected').some((e) => e['reason'] === 'not_traded')).toBe(true);
    w.submit({ type: 'SetRequests', civ: 'hillfolk', entries: [{ itemType: 'log', material: 'oak', priority: 3 }] });
    w.step(1);
    expect(w.readers.of<TradeReader>('20').requests('hillfolk')).toEqual([{ itemType: 'log', material: 'oak', priority: 3 }]);
  });
});

describe('T-550 the requests editor', () => {
  it('refuses a never-sold good with "The Hillfolk do not trade in that." and submits nothing', async () => {
    const game = new Game({ canvas: new MockCanvas(), seed: 't550-requests', registry: loadContent(),
      createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
    await game.start({ embark: 'default' });
    const panel = game.fortress.civilizations;
    const notes: string[] = [];
    const ctx = { ...game.fortress.ctx, notice: (text: string) => { notes.push(text); } };
    game.fortress.openPanel('civilizations');
    panel.key(ctx, press('ArrowDown'), () => {});
    expect(panel.civ()).toBe('hillfolk');
    panel.key(ctx, press('a', { shift: true }), () => {});
    panel.candidate = panel.candidates(ctx).indexOf('wyrmscale');
    expect(panel.candidate).toBeGreaterThanOrEqual(0);
    expect(panel.key(ctx, press('Enter'), () => {})).toBe(true);
    game.host.step(1);
    expect(notes).toEqual(['The Hillfolk do not trade in that.']);
    expect(game.host.readers.of<TradeReader>('20').requests('hillfolk')).toEqual([]);
    // An ordinary good is added as before.
    panel.key(ctx, press('a', { shift: true }), () => {});
    panel.candidate = panel.candidates(ctx).indexOf('log');
    panel.key(ctx, press('Enter'), () => {});
    game.host.step(1);
    expect(game.host.readers.of<TradeReader>('20').requests('hillfolk')).toEqual([{ itemType: 'log', priority: 1 }]);
  });
});
