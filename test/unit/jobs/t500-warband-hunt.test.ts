/**
 * T-500: the Warband's hunt. An off-duty soldier with an axe in its weapon slot took the hunt,
 * fetched the crossbow and bolts, could not shoot them (16 shoots the weapon in the weapon slot),
 * dropped the hunt as `no_ammo` and kept the crossbow, so every later hunt was blocked `no_tool`.
 * A worker whose weapon slot holds another weapon does not take a ranged job (09 § Hunting,
 * 11 § Assignment step 5).
 */

import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { EntityId } from '@core/types';
import type { CombatReader } from '@systems/combat';
import type { DwarvesReader } from '@systems/dwarves';
import type { ItemsReader } from '@systems/items';
import { cmd, fortressDwarves, pathWorld, playUntil, surfaceZ, wagon, zoneRect } from '../../scenarios/player-path';

describe('T-500 the Warband hunts while its axe dwarves are in a squad', () => {
  it('the hunt goes to a dwarf with a free hand, who shoots; no soldier holds the crossbow', () => {
    const w = pathWorld('pp-defence', { preset: 'warband' }, { traits: [] });
    const ent = w.game.world.entities;
    const items = w.readers.of<ItemsReader>('13');
    const dwarves = w.readers.of<DwarvesReader>('10');
    const typeId = (id: EntityId): string => w.game.registry.table<{ id: string }>('items').byIndex(ent.get(id, C.Item)?.type ?? -1)?.id ?? '?';
    const { x: cx, y: cy } = wagon(w);
    // As pp_defence plays it: a stockpile, woodcutting off, the two axe dwarves in a squad that takes any weapon.
    const stockpile = zoneRect(w, 'stockpile', cx - 12, cy + 3, surfaceZ(w, cx, cy), 14, 8);
    cmd(w, { type: 'SetStockpileFilter', zoneId: stockpile, filter: 'everything' });
    for (const dwarfId of fortressDwarves(w)) cmd(w, { type: 'SetLabor', dwarfId, labor: 'woodcutting', on: false });
    const axes = ent.with(C.Item).filter((id) => typeId(id) === 'axe');
    playUntil(w, () => axes.every((id) => items.stockpileAt(items.tileOf(id)) === stockpile), 3 * TICKS_PER_DAY);
    const members = fortressDwarves(w).sort((a, b) => dwarves.skill(b, 'axe') - dwarves.skill(a, 'axe') || a - b).slice(0, 2);
    cmd(w, { type: 'CreateSquad', name: 'Wagon Guard' });
    const squadId = w.readers.of<CombatReader>('16').squads()[0]!.id;
    cmd(w, { type: 'SetSquadMembers', squadId, members });
    cmd(w, { type: 'SetSquadEquipment', squadId, equipment: { weaponClass: 'any', armor: 'any' } });

    const crossbow = ent.with(C.Item).find((id) => typeId(id) === 'crossbow') as EntityId;
    const heldBySoldier: string[] = [];
    const shot = playUntil(w, () => w.events('ProjectileFired').length > 0, 10 * TICKS_PER_DAY, () => {
      const by = items.get(crossbow)?.carriedBy ?? 0;
      if (members.includes(by)) heldBySoldier.push(`tick ${w.tick}: soldier ${by}`);
    });
    expect(heldBySoldier.slice(0, 1), 'no soldier with an axe in hand takes the crossbow').toEqual([]);
    expect(w.events('HuntAbandoned'), 'no hunt is dropped for want of a launcher in hand').toEqual([]);
    expect(shot, 'the hunter shoots within ten days').toBe(true);
    const shooter = Number(w.events('ProjectileFired')[0]!['shooterId']);
    expect(members).not.toContain(shooter);
  });
});
