/**
 * T-602: the Thane wishes only for what the fortress could make from what it has (`10` § The Thane's
 * whim, possible): a recipe counts when its inputs are at hand (in stock, or made at a built workshop
 * from what is in stock), a masterwork when a dwarf could roll one, a featherbed when its bedding and
 * pillow could be stuffed with feathers.
 */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { DAYS_PER_SEASON, TICKS_PER_DAY } from '@core/constants';
import type { EntityId, TileIndex } from '@core/types';
import type { DwarvesReader } from '@systems/dwarves';
import { whimFacts, whimPossible, whimRows } from '@systems/dwarves/whims';
import { TestWorld } from '../scenarios/test-world';

const Z = 25;
const SEASON = TICKS_PER_DAY * DAYS_PER_SEASON;

function world(seed: string, startTick?: number): TestWorld {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none', ...(startTick === undefined ? {} : { startTick }) });
  w.digRoom(10, 10, Z, 14, 8);
  for (let y = 9; y <= 18; y += 1) for (let x = 9; x <= 24; x += 1) w.discover(w.index(x, y, Z));
  return w;
}

/** The whims possible now, in row order. */
function possible(w: TestWorld): string[] {
  const facts = whimFacts(w.readers.of<DwarvesReader>('10'), w.game.world.entities);
  return whimRows(w.game.registry).filter((row) => whimPossible(w.readers, w.game.registry, row, facts)).map((row) => row.id);
}

function at(w: TestWorld, x: number): TileIndex {
  return w.index(x, 16, Z);
}

/** A bedding or pillow stuffed with a material, as the clothier records it. */
function stuffed(w: TestWorld, type: string, x: number, stuffing: string): EntityId {
  const id = w.spawnItem(type, 'flax_cloth', at(w, x));
  w.game.world.entities.get(id, C.Item)!.stuffing = w.game.registry.table('materials').index(stuffing);
  return id;
}

describe('T-602 a whim the fortress can reach', () => {
  it('a lantern takes a glass block and a candle at hand, or sand and tallow its workshops turn into them', () => {
    const w = world('t602-lantern');
    w.spawnDwarf({ at: at(w, 12) });
    w.build('kiln', w.index(14, 11, Z), 'granite');
    expect(possible(w)).not.toContain('whim_lantern');
    w.spawnItem('stone_block', 'glass', at(w, 14));
    expect(possible(w)).not.toContain('whim_lantern');
    w.spawnItem('candle', 'tallow', at(w, 15));
    expect(possible(w)).toContain('whim_lantern');

    const raw = world('t602-lantern-raw');
    raw.spawnDwarf({ at: at(raw, 12) });
    raw.build('kiln', raw.index(14, 11, Z), 'granite');
    raw.spawnItem('soil_load', 'sand', at(raw, 14), 2);
    raw.spawnItem('tallow', 'tallow', at(raw, 15));
    // The kiln turns the sand into glass; nothing yet turns the tallow into candles.
    expect(possible(raw)).not.toContain('whim_lantern');
    raw.build('craftdwarf', raw.index(18, 11, Z), 'granite');
    expect(possible(raw)).toContain('whim_lantern');
  }, 60_000);

  it('mead takes the honey a brew needs; a still alone is not enough', () => {
    const w = world('t602-mead');
    w.spawnDwarf({ at: at(w, 12) });
    w.build('still', w.index(14, 11, Z), 'oak');
    expect(possible(w)).not.toContain('whim_mead');
    w.spawnItem('honey', 'honey', at(w, 14), 3);
    expect(possible(w)).not.toContain('whim_mead');
    w.spawnItem('honey', 'honey', at(w, 15), 1);
    expect(possible(w)).toContain('whim_mead');
  }, 60_000);

  it('a masterwork takes a quality recipe with its inputs at hand and a dwarf who could roll one', () => {
    const w = world('t602-masterwork');
    w.spawnDwarf({ at: at(w, 12), skills: { crafting: 12 } });
    w.build('craftdwarf', w.index(14, 11, Z), 'granite');
    w.spawnItem('tusk', 'ivory', at(w, 14));
    // Level 12 rolls at most 100: exceptional, never a masterwork (12 § Quality).
    expect(possible(w)).not.toContain('whim_masterwork');
    w.spawnDwarf({ at: at(w, 13), skills: { crafting: 13 } });
    expect(possible(w)).toContain('whim_masterwork');

    const idle = world('t602-masterwork-idle');
    idle.spawnDwarf({ at: at(idle, 12), skills: { crafting: 20 } });
    idle.build('craftdwarf', idle.index(14, 11, Z), 'granite');
    // A legend with nothing to carve.
    expect(possible(idle)).not.toContain('whim_masterwork');
  }, 60_000);

  it('a featherbed takes a bed and a bedding and pillow of feathers at hand', () => {
    const w = world('t602-featherbed');
    w.spawnDwarf({ at: at(w, 12) });
    w.spawnItem('bed', 'oak', at(w, 12));
    w.build('clothier', w.index(14, 11, Z), 'oak');
    w.spawnItem('cloth', 'flax_cloth', at(w, 13), 6);
    w.spawnItem('straw', 'barley', at(w, 14), 6);
    // Cloth and straw make a soft bed, not a featherbed.
    expect(possible(w)).not.toContain('whim_featherbed');
    w.spawnItem('feather', 'feather', at(w, 15), 2);
    expect(possible(w)).toContain('whim_featherbed');

    const made = world('t602-featherbed-made');
    made.spawnDwarf({ at: at(made, 12) });
    made.build('bed', made.index(12, 11, Z), 'oak');
    stuffed(made, 'bedding', 14, 'feather');
    expect(possible(made)).not.toContain('whim_featherbed');
    stuffed(made, 'pillow', 15, 'feather');
    // A built bed is its bed; the feather bedding and pillow are in stock.
    expect(possible(made)).toContain('whim_featherbed');
  }, 60_000);

  it('spirits take a brew of 20 at hand: one in stock, or the honey the still brews to mead first', () => {
    const w = world('t602-spirits');
    w.spawnDwarf({ at: at(w, 12) });
    w.build('still', w.index(14, 11, Z), 'oak');
    w.spawnItem('drink', 'strawberry_wine', at(w, 14), 10);
    w.spawnItem('drink', 'cavewheat_beer', at(w, 15), 10);
    // Twenty units, but of two brews: the still distils one brew at a time.
    expect(possible(w)).not.toContain('whim_spirits');
    w.spawnItem('honey', 'honey', at(w, 16), 4);
    expect(possible(w)).toEqual(expect.arrayContaining(['whim_mead', 'whim_spirits']));
  }, 60_000);

  it('the season draws among what is at hand: a kiln, a glass block and a candle, and the Thane wishes for a lantern', () => {
    const w = world('t602-draw', SEASON - 5);
    const thane = w.spawnDwarf({ at: at(w, 12) });
    expect(w.game.world.applyCommand({ type: 'AssignTitle', dwarfId: thane, title: 'thane' })).toEqual({ ok: true });
    w.build('kiln', w.index(14, 11, Z), 'granite');
    w.spawnItem('stone_block', 'glass', at(w, 14));
    w.spawnItem('candle', 'tallow', at(w, 15));
    w.step(10);
    expect(w.events('WhimSet')).toEqual([expect.objectContaining({ thaneId: thane, whimId: 'whim_lantern' })]);
  }, 60_000);
});
