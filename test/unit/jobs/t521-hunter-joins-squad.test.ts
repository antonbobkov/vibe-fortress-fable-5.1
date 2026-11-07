/**
 * T-521: a hunter keeps its crossbow and bolts after the hunt (`Worker.toolId`), as a miner keeps a
 * pick. When that hunter joins a squad that claims it a melee weapon, the axe fills its weapon slot:
 * it is no longer offered a hunt (11 § Assignment step 5), and the crossbow it still held kept every
 * other hunter's claim `no_tool`. A worker whose weapon slot holds a weapon that is not a launcher
 * puts down the launcher it holds as its tool, and that launcher's ammunition (11 § Assignment).
 */

import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { EntityId } from '@core/types';
import type { CombatReader } from '@systems/combat';
import type { ItemsReader } from '@systems/items';
import { cmd, fortressDwarves, pathWorld, playUntil, surfaceZ, wagon, zoneRect } from '../../scenarios/player-path';

describe('T-521 a hunter who joins a squad and takes an axe puts the crossbow down', () => {
  it('the crossbow and bolts leave the soldier, and another dwarf hunts with them', () => {
    const w = pathWorld('pp-defence', { preset: 'warband' }, { traits: [] });
    const ent = w.game.world.entities;
    const items = w.readers.of<ItemsReader>('13');
    const typeId = (id: EntityId): string => w.game.registry.table<{ id: string }>('items').byIndex(ent.get(id, C.Item)?.type ?? -1)?.id ?? '?';
    const { x: cx, y: cy } = wagon(w);
    const stockpile = zoneRect(w, 'stockpile', cx - 12, cy + 3, surfaceZ(w, cx, cy), 14, 8);
    cmd(w, { type: 'SetStockpileFilter', zoneId: stockpile, filter: 'everything' });
    for (const dwarfId of fortressDwarves(w)) cmd(w, { type: 'SetLabor', dwarfId, labor: 'woodcutting', on: false });
    const axes = ent.with(C.Item).filter((id) => typeId(id) === 'axe');
    playUntil(w, () => axes.every((id) => items.stockpileAt(items.tileOf(id)) === stockpile), 3 * TICKS_PER_DAY);

    // A dwarf hunts and keeps the crossbow and its bolts.
    const crossbow = ent.with(C.Item).find((id) => typeId(id) === 'crossbow') as EntityId;
    expect(playUntil(w, () => w.events('ProjectileFired').length > 0, 10 * TICKS_PER_DAY), 'a dwarf hunts').toBe(true);
    const hunter = Number(w.events('ProjectileFired')[0]!['shooterId']) as EntityId;
    expect(items.get(crossbow)?.carriedBy, 'the hunter holds the crossbow').toBe(hunter);
    playUntil(w, () => ent.get(hunter, C.Worker)?.jobId === 0, 2 * TICKS_PER_DAY);

    // It joins a squad that takes any weapon: an axe fills its weapon slot.
    cmd(w, { type: 'CreateSquad', name: 'Wagon Guard' });
    const squadId = w.readers.of<CombatReader>('16').squads()[0]!.id;
    cmd(w, { type: 'SetSquadMembers', squadId, members: [hunter] });
    cmd(w, { type: 'SetSquadEquipment', squadId, equipment: { weaponClass: 'any', armor: 'any' } });
    const firedBefore = w.events('ProjectileFired').length;
    w.step(10);
    const weapon = ent.get(hunter, C.Equipment)?.weapon ?? 0;
    expect(typeId(weapon), 'the soldier holds a melee weapon').toBe('axe');
    expect(items.get(crossbow)?.carriedBy, 'the soldier has put the crossbow down').toBe(0);
    expect(ent.get(hunter, C.Worker)?.toolId, 'its tool is cleared').toBe(0);
    const bolts = items.carriedItems(hunter).filter((id) => typeId(id) === 'bolt');
    expect(bolts, 'and the bolts with it').toEqual([]);

    // Another dwarf fetches them and hunts.
    const shotByOther = playUntil(w, () => w.events('ProjectileFired').slice(firedBefore).some((e) => Number(e['shooterId']) !== hunter), 10 * TICKS_PER_DAY);
    expect(shotByOther, 'another dwarf hunts with the crossbow within ten days').toBe(true);
  });
});
