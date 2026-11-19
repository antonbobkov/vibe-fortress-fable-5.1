/**
 * T-623: a depot across a channel from the caravan's edge. The caravan waits, and its line names the
 * depot, the edge and why, with the depot as its focus; a floor span planned across the channel in
 * one go is built from its held end, and the caravan then comes on to the depot. T-628: the line's
 * focus is where the way breaks, the channel's edge on the caravan's side.
 */
import { expect } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { TileKind } from '@core/map3d';
import type { BuildingsReader } from '@systems/buildings';
import { AnnouncementLog } from '@ui/announcements';
import { Strings } from '@ui/strings';
import type { Scenario } from './runner';

const Z = 32;
/** The channel: two levels deep, across the whole map, between the north edge and the depot. */
const CHANNEL = [10, 11, 12, 13];
const X = 45;
let depot = 0;

const scenario: Scenario = {
  id: 'td_depot_across_channel', milestone: 7, seed: 'td-depot-channel', world: 'flat-test', embark: 'none',
  startTick: 31 * TICKS_PER_DAY,
  setup: (w) => {
    const terrain = w.game.world.services.terrain;
    for (const y of CHANNEL) for (let x = 0; x < w.map.w; x += 1) {
      terrain.setKind(w.index(x, y, Z), TileKind.Open, 0);
      terrain.setKind(w.index(x, y, Z - 1), TileKind.Open, 0);
    }
    depot = w.build('trade_depot', w.index(X, 20, Z), 'granite');
  },
  run: (w) => {
    const log = new AnnouncementLog(new Strings(w.game.registry), w.game.registry);
    log.register(w.game.world.registrations.announcements);
    const buildings = w.readers.of<BuildingsReader>('14');
    const footprint = buildings.get(depot)?.footprint ?? [];

    w.until((world) => world.events('CaravanWaiting').length > 0, 20 * TICKS_PER_DAY);
    const waiting = w.events('CaravanWaiting')[0]!;
    expect(waiting['reason']).toBe('unreachable');
    expect(waiting['depotId']).toBe(depot);
    expect(waiting['edge']).toBe('n');
    const line = log.announce(waiting, w.readers, w.tick);
    expect(line?.line.text).toBe('The Hillfolk caravan cannot reach Trade depot #1 from the north edge: its pack animals need a way on foot, with no deep water or drop. Bridge the gap, or build a depot on their side.');
    expect(line?.severity).toBe('alert');
    // Its focus is where the way breaks: the channel's edge on the caravan's side, across from the depot.
    const gap = waiting['tile'] as number;
    const side = waiting['depotSide'] as number;
    expect([w.map.yOf(gap), w.map.zOf(gap)]).toEqual([CHANNEL[0]! - 1, Z]);
    expect([w.map.yOf(side), w.map.zOf(side)]).toEqual([CHANNEL[CHANNEL.length - 1]! + 1, Z]);
    const xs = footprint.map((t) => w.map.xOf(t));
    expect(w.map.xOf(gap)).toBeGreaterThanOrEqual(Math.min(...xs));
    expect(w.map.xOf(gap)).toBeLessThanOrEqual(Math.max(...xs));
    expect(w.map.xOf(side)).toBe(w.map.xOf(gap));
    expect(line?.focus).toBe(gap);

    // The span in one go, as a drag sends it: each tile after the one beside it that holds it.
    // Out of order, the middle of the channel is held by nothing and is refused.
    expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'floor', origin: w.index(X, 11, Z), materialChoice: 'granite' })).toMatchObject({ ok: false, reason: 'bad_placement' });
    for (const y of CHANNEL) {
      expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'floor', origin: w.index(X, y, Z), materialChoice: 'granite' }).ok).toBe(true);
    }
    // A builder on the depot's bank, with blocks.
    const dwarf = w.spawnDwarf({ at: w.index(X, 16, Z) });
    for (const labor of ['construction', 'masonry', 'hauling']) w.game.world.applyCommand({ type: 'SetLabor', dwarfId: dwarf, labor, on: true });
    w.spawnItem('stone_block', 'granite', w.index(X + 1, 16, Z), 5);

    // Nothing is built unheld: every floor of the span stands on a tile beside a built one when it is done.
    const built: number[] = [];
    w.game.world.onEvents((batch) => {
      for (const event of batch) {
        if (event.type !== 'BuildingCompleted' || event['buildingType'] !== 'floor') continue;
        const tile = buildings.get(event['id'] as number)?.footprint[0] ?? -1;
        built.push(w.map.yOf(tile));
      }
    });
    w.until((world) => world.events('CaravanAtDepot').length > 0, 3 * TICKS_PER_DAY);
    expect([...built].sort()).toEqual([...CHANNEL].sort());
    // Built from the depot's bank: the south end first, the north end (held by the far bank) last.
    expect(built[0]).toBe(13);
    expect(built[built.length - 1]).toBe(10);
    for (const y of CHANNEL) expect(w.map.kindAt(w.index(X, y, Z))).toBe(TileKind.Floor);
    expect(w.events('ConstructionCollapsed')).toHaveLength(0);
    expect(w.events('CaravanDeparted')).toHaveLength(0);

    const at = w.events('CaravanAtDepot')[0]!;
    const note = log.announce(at, w.readers, w.tick);
    expect(note?.line.text).toBe('The Hillfolk caravan is at Trade depot #1: [c] or the depot to trade.');
    expect(note?.severity).toBe('note');
    expect(note?.focus).toBe(footprint[0]);
    expect(w.game.world.entities.get(depot, C.Container)?.contents.length).toBeGreaterThan(0);
  },
};
export default scenario;
