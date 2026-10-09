import { C, ItemFlag, type Equipment } from '@core/components';
import type { RngStream } from '@core/rng';
import type { TickContext } from '@core/system';
import type { Civ, Edge, EntityId, TileIndex } from '@core/types';
import { findEdgeTiles } from '@systems/threats/parties';
import { GUARDS_BASE, GUARDS_PER_PERIL, MERCHANTS_MAX, MERCHANTS_MIN, PACK_VALUE } from './constants';
import { CARAVAN_BUNDLE_UNITS } from './constants';
import type { ActiveCaravan } from './state';
import type { PlannedGood } from './goods';

function emptyEquipment(): Equipment {
  return {
    weapon: 0, shield: 0,
    armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
    clothing: { body: 0, legs: 0, feet: 0, over: 0 }, quiver: 0,
  };
}

function guardGear(civ: Civ, reputation: number): readonly { item: string; material: string; count?: number; slot: 'weapon' | 'shield' | 'head' | 'body' | 'quiver' | 'ammo' }[] {
  if (civ === 'mountainhome') {
    const metal = reputation >= 50 ? 'steel' : 'iron';
    return [
      { item: 'axe', material: metal, slot: 'weapon' },
      { item: 'helm', material: metal, slot: 'head' },
      { item: 'mail_shirt', material: metal, slot: 'body' },
      { item: 'shield', material: metal, slot: 'shield' },
    ];
  }
  if (civ === 'wildwood') return [
    { item: 'bow', material: 'yew', slot: 'weapon' },
    { item: 'arrow', material: 'oak', count: 30, slot: 'ammo' },
    { item: 'dagger', material: 'iron', slot: 'ammo' },
    { item: 'leather_jerkin', material: 'leather', slot: 'body' },
  ];
  return [
    { item: 'spear', material: 'iron', slot: 'weapon' },
    { item: 'cap', material: 'leather', slot: 'head' },
    { item: 'leather_jerkin', material: 'leather', slot: 'body' },
    { item: 'buckler', material: 'oak', slot: 'shield' },
  ];
}

function equipGuard(ctx: TickContext, id: EntityId, tile: TileIndex, civ: Civ, reputation: number): void {
  const eq = emptyEquipment();
  const types = ctx.registry.table('items');
  const materials = ctx.registry.table('materials');
  for (const kit of guardGear(civ, reputation)) {
    if (!types.has(kit.item) || !materials.has(kit.material)) continue;
    const item = ctx.spawn.item(types.index(kit.item), materials.index(kit.material), tile, kit.count ?? 1, 1);
    if (item === 0) continue;
    ctx.world.services.items?.attachToCarrier(item, id);
    ctx.world.services.items?.setOwner(item, id);
    ctx.world.services.items?.setFlag(item, ItemFlag.Merchant, true);
    if (kit.slot === 'weapon') eq.weapon = item;
    else if (kit.slot === 'shield') eq.shield = item;
    else if (kit.slot === 'head') eq.armor.head = item;
    else if (kit.slot === 'body') eq.armor.body = item;
    else if (kit.slot === 'quiver') eq.quiver = item;
  }
  ctx.world.entities.add(id, C.Equipment, eq);
}

export function caravanGuardCount(peril: number, twilightPass: boolean): number {
  return GUARDS_BASE + peril * GUARDS_PER_PERIL + (twilightPass ? 1 : 0);
}

export function spawnCaravan(ctx: TickContext, civ: Civ, edge: Edge, peril: number, twilightPass: boolean, reputation: number, planned: readonly PlannedGood[], rng: RngStream): ActiveCaravan {
  const merchants = rng.int(MERCHANTS_MIN, MERCHANTS_MAX);
  const guards = caravanGuardCount(peril, twilightPass);
  const value = planned.reduce((sum, good) => sum + good.value, 0);
  const animals = Math.max(1, Math.ceil(value / PACK_VALUE));
  const tiles = findEdgeTiles(ctx.world.map, edge, merchants + guards + animals);
  const edgeTile = tiles[0] as TileIndex;
  const partyId = ctx.world.entities.create('party');
  const party = {
    civ, purpose: 'caravan' as const, members: [] as EntityId[], leaderId: 0,
    state: 'toDepot', goalTile: 0, goalEntity: 0, arrivedTick: ctx.tick, stateSince: ctx.tick,
    loot: [] as EntityId[], edge, size: merchants + guards + animals,
  };
  ctx.world.entities.add(partyId, C.Party, party);
  const species = ctx.registry.table('creatures');
  const speciesId = civ === 'mountainhome' ? 'dwarf' : civ === 'hillfolk' ? 'human' : 'elf';
  const memberFaction = `trader:${civ}`;
  const merchantIds: EntityId[] = [];
  const guardIds: EntityId[] = [];
  const animalIds: EntityId[] = [];
  for (let i = 0; i < merchants + guards + animals; i += 1) {
    const speciesName = i < merchants + guards ? speciesId : civ === 'wildwood' ? 'wildwood_bearer' : 'mule';
    const id = ctx.spawn.creature(species.index(speciesName), tiles[i] ?? edgeTile, memberFaction);
    party.members.push(id);
    if (i === 0) party.leaderId = id;
    if (i < merchants) {
      merchantIds.push(id);
      ctx.world.entities.add(id, C.Merchant, { partyId, goods: [] });
    } else if (i < merchants + guards) {
      guardIds.push(id);
      equipGuard(ctx, id, tiles[i] ?? edgeTile, civ, reputation);
    } else {
      animalIds.push(id);
      ctx.world.entities.add(id, C.Container, { contents: [], capacity: Number.MAX_SAFE_INTEGER, classId: 'wagon' });
    }
  }
  const goods: EntityId[] = [];
  const itemTypes = ctx.registry.table<{ id: string; stack: number }>('items');
  const pine = ctx.registry.table('materials').index('pine');
  const putStacks = (type: number, material: number, count: number, holder: EntityId): void => {
    const stack = itemTypes.byIndex(type)?.stack ?? 1;
    let remaining = count;
    while (remaining > 0) {
      const units = Math.min(remaining, stack);
      const id = ctx.spawn.item(type, material, { containerId: holder }, units, 1);
      if (id !== 0) {
        ctx.world.services.items?.setFlag(id, ItemFlag.Merchant, true);
        goods.push(id);
      }
      remaining -= units;
    }
  };
  for (let i = 0; i < planned.length; i += 1) {
    const good = planned[i] as PlannedGood;
    const carrier = animalIds[i % animalIds.length] as EntityId;
    if (good.species !== undefined) {
      for (let n = 0; n < good.count; n += 1) {
        const cage = ctx.spawn.item(good.type, good.material, { containerId: carrier }, 1, 1);
        if (cage === 0) continue;
        const occupant = ctx.spawn.creature(good.species, edgeTile, memberFaction);
        const creature = ctx.world.entities.get(occupant, C.Creature);
        if (creature) ctx.world.entities.add(occupant, C.Creature, { ...creature, cagedIn: cage });
        const from = ctx.world.services.movement?.tileOf(occupant) ?? edgeTile;
        ctx.world.services.spatial?.remove(occupant, from);
        ctx.world.entities.remove(occupant, C.Position);
        ctx.world.entities.add(occupant, C.Tame, {
          pastureId: 0, condition: 0,
          trained: civ === 'wildwood' && species.idOf(good.species) === 'bear' ? 'war'
            : civ === 'wildwood' && species.idOf(good.species) === 'dog' ? 'hunting' : 'none',
          assignedTo: 0, pregnantUntil: 0,
          lastProductTick: {}, juvenileUntil: 0, slaughter: false, petOf: 0, noBreed: false,
        });
        ctx.world.services.items?.setOccupant?.(cage, occupant);
        ctx.world.services.items?.setFlag(cage, ItemFlag.Merchant, true);
        goods.push(cage);
      }
      continue;
    }
    if (good.container) {
      const key = itemTypes.idOf(good.type);
      const unitsPerContainer = CARAVAN_BUNDLE_UNITS[key] ?? good.count;
      let remaining = good.count;
      while (remaining > 0) {
        const packageId = ctx.spawn.item(good.container, pine, { containerId: carrier }, 1, 1);
        if (packageId === 0) break;
        ctx.world.services.items?.setFlag(packageId, ItemFlag.Merchant, true);
        goods.push(packageId);
        const units = Math.min(remaining, unitsPerContainer);
        putStacks(good.type, good.material, units, packageId);
        remaining -= units;
      }
    } else {
      putStacks(good.type, good.material, good.count, carrier);
    }
    if (good.companion) putStacks(good.companion.type, good.companion.material, good.companion.count, carrier);
  }
  ctx.emit({ type: 'CaravanArrived', civ, merchants: merchantIds, guards: guardIds, animals: animalIds, partyId });
  return {
    partyId, civ, state: 'toDepot', depotId: 0, edgeTile, arrivedTick: ctx.tick,
    stateSince: ctx.tick, merchants: merchantIds, guards: guardIds, animals: animalIds,
    goods, dead: [], destinations: {}, boughtValue: 0, soldValue: 0, attacked: false, lost: false,
  };
}
