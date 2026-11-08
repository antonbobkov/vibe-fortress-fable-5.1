/**
 * T-526: a hunter keeps its crossbow and bolts after the hunt (`Worker.toolId`). When it then takes
 * a mining job it fetches a pick, and a worker holds one tool (11 § Assignment): it puts the
 * crossbow down, and the unowned bolts with it, so that another dwarf can take them for a hunt.
 */

import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { EntityId } from '@core/types';
import type { ItemsReader } from '@systems/items';
import { cmd, fortressDwarves, pathWorld, playUntil, stairToRock, surfaceZ, wagon, zoneRect } from '../../scenarios/player-path';

describe('T-526 a hunter who takes a pick puts the crossbow down', () => {
  it('the crossbow and bolts leave the miner, and another dwarf takes them', () => {
    const w = pathWorld('pp-defence', { preset: 'warband' }, { traits: [] });
    const ent = w.game.world.entities;
    const items = w.readers.of<ItemsReader>('13');
    const typeId = (id: EntityId): string => w.game.registry.table<{ id: string }>('items').byIndex(ent.get(id, C.Item)?.type ?? -1)?.id ?? '?';
    const { x: cx, y: cy } = wagon(w);
    const stockpile = zoneRect(w, 'stockpile', cx - 12, cy + 3, surfaceZ(w, cx, cy), 14, 8);
    cmd(w, { type: 'SetStockpileFilter', zoneId: stockpile, filter: 'everything' });
    for (const dwarfId of fortressDwarves(w)) cmd(w, { type: 'SetLabor', dwarfId, labor: 'woodcutting', on: false });
    const picks = ent.with(C.Item).filter((id) => typeId(id) === 'pick');
    playUntil(w, () => picks.every((id) => items.stockpileAt(items.tileOf(id)) === stockpile), 3 * TICKS_PER_DAY);

    // A dwarf hunts and keeps the crossbow and its bolts.
    const crossbow = ent.with(C.Item).find((id) => typeId(id) === 'crossbow') as EntityId;
    expect(playUntil(w, () => w.events('ProjectileFired').length > 0, 10 * TICKS_PER_DAY), 'a dwarf hunts').toBe(true);
    const hunter = Number(w.events('ProjectileFired')[0]!['shooterId']) as EntityId;
    expect(items.get(crossbow)?.carriedBy, 'the hunter holds the crossbow').toBe(hunter);
    playUntil(w, () => ent.get(hunter, C.Worker)?.jobId === 0, 2 * TICKS_PER_DAY);
    expect(ent.get(hunter, C.Worker)?.toolId, 'the crossbow is its tool').toBe(crossbow);

    // The hunter alone mines (and no longer hunts); everyone else keeps hunting.
    for (const dwarfId of fortressDwarves(w)) cmd(w, { type: 'SetLabor', dwarfId, labor: 'mining', on: dwarfId === hunter });
    cmd(w, { type: 'SetLabor', dwarfId: hunter, labor: 'hunting', on: false });
    const { top, rockZ } = stairToRock(w, cx, cy + 12);
    expect(top, 'a stairwell was designated').toBeGreaterThan(rockZ);
    const fetchedPick = (): boolean => w.events('ToolEquipped').some((e) => Number(e['dwarfId']) === hunter && typeId(Number(e['itemId'])) === 'pick');
    expect(playUntil(w, fetchedPick, 10 * TICKS_PER_DAY), 'the hunter fetches a pick').toBe(true);

    expect(items.get(crossbow)?.carriedBy, 'the miner has put the crossbow down').toBe(0);
    expect(typeId(ent.get(hunter, C.Worker)!.toolId), 'its tool is the pick').toBe('pick');
    expect(items.carriedItems(hunter).filter((id) => typeId(id) === 'bolt'), 'and the bolts with it').toEqual([]);
    expect(w.events('ToolDropped').some((e) => Number(e['itemId']) === crossbow), 'ToolDropped for the crossbow').toBe(true);

    // Another dwarf claims a hunt and fetches the crossbow (it was `no_tool` while the miner carried it).
    const equipped = (): boolean => w.events('ToolEquipped').some((e) => Number(e['itemId']) === crossbow && Number(e['dwarfId']) !== hunter);
    expect(playUntil(w, equipped, 10 * TICKS_PER_DAY), 'another dwarf takes the crossbow within ten days').toBe(true);
  });
});
