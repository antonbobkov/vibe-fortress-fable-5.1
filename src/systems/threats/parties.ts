/**
 * Party composition, edge arrival, and trickle spawning.
 * `02-systems/18-threats-monsters-and-raids.md` § Party composition, § Arrival and warning,
 * `03-content/threat-schedules.md` § Party composition.
 */

import { C } from '@core/components';
import type { EntityStore } from '@core/entities';
import type { GameEvent } from '@core/events';
import { TileKind, type Map3D } from '@core/map3d';
import type { Registry } from '@core/registry';
import type { RngStream } from '@core/rng';
import type { Edge, EntityId, TileIndex } from '@core/types';
import { ARRIVAL_SPREAD, ARRIVAL_TICKS } from './constants';
import { assignHostileSkills, calculateGearTier, equipHostileCreature } from './gear';
import type { PendingSpawnState } from './state';

export interface ThreatWorldLike {
  entities: EntityStore;
  services: {
    spawn: {
      creature(species: number, at: number, faction: string): EntityId;
      item(type: number, material: number, at: number, count?: number, quality?: number): EntityId;
    };
  };
  emit(event: GameEvent): void;
  map: Map3D;
}

export interface PlannedMember {
  role: string;
  species: string;
  isCaptain: boolean;
}

/**
 * Calculates composition of party members:
 * Fractions of size by role; remainder after rounding goes to warriors.
 * Captain is added on top of size for raids and sieges.
 */
export function calculatePartyComposition(
  kind: string,
  size: number,
  renown: number,
  peril: number,
  isTwilightPass = false,
): PlannedMember[] {
  const members: PlannedMember[] = [];

  if (kind === 'thief') {
    const count = isTwilightPass ? 2 : size;
    for (let i = 0; i < count; i++) {
      members.push({ role: 'thief', species: 'gloam_snatcher', isCaptain: false });
    }
    return members;
  }

  if (kind === 'bandits') {
    for (let i = 0; i < size; i++) {
      members.push({ role: 'warriors', species: 'hillfolk_bandit', isCaptain: false });
    }
    return members;
  }

  if (kind === 'ambush') {
    const archersCount = Math.round(size * 0.40);
    const warriorsCount = Math.max(0, size - archersCount);
    for (let i = 0; i < archersCount; i++) {
      members.push({ role: 'archers', species: 'gloam_archer', isCaptain: false });
    }
    for (let i = 0; i < warriorsCount; i++) {
      members.push({ role: 'warriors', species: 'gloam_warrior', isCaptain: false });
    }
    return members;
  }

  if (kind === 'raid') {
    const archersCount = Math.round(size * 0.30);
    const warriorsCount = Math.max(0, size - archersCount);
    // Captain is added on top!
    members.push({ role: 'captain', species: 'gloam_captain', isCaptain: true });
    for (let i = 0; i < archersCount; i++) {
      members.push({ role: 'archers', species: 'gloam_archer', isCaptain: false });
    }
    for (let i = 0; i < warriorsCount; i++) {
      members.push({ role: 'warriors', species: 'gloam_warrior', isCaptain: false });
    }
    return members;
  }

  if (kind === 'siege') {
    const archersCount = Math.round(size * 0.30);
    const warriorsCount = Math.max(0, size - archersCount);
    const captainCount = 1 + Math.floor(size / 20);
    const trollkinCount = peril === 3
      ? Math.min(6, Math.floor(2 + renown / 15))
      : Math.min(8, Math.floor(3 + renown / 12));

    for (let i = 0; i < captainCount; i++) {
      members.push({ role: 'captain', species: 'gloam_captain', isCaptain: true });
    }
    for (let i = 0; i < trollkinCount; i++) {
      members.push({ role: 'warriors', species: 'trollkin', isCaptain: false });
    }
    for (let i = 0; i < archersCount; i++) {
      members.push({ role: 'archers', species: 'gloam_archer', isCaptain: false });
    }
    for (let i = 0; i < warriorsCount; i++) {
      members.push({ role: 'warriors', species: 'gloam_warrior', isCaptain: false });
    }
    return members;
  }

  return members;
}

/**
 * Finds walkable outdoor tiles along the given map edge, spaced by `spread`.
 */
export function findEdgeTiles(
  map: Map3D,
  edge: Edge,
  count: number,
  spread = ARRIVAL_SPREAD,
): TileIndex[] {
  const candidates: TileIndex[] = [];
  const width = map.w;
  const height = map.h;

  if (edge === 'n') {
    for (let x = 0; x < width; x += spread) {
      const z = map.columnSurfaceZ(x, 0);
      const t = map.index(x, 0, z);
      if (map.kindAt(t) === TileKind.Floor) candidates.push(t);
    }
  } else if (edge === 's') {
    for (let x = 0; x < width; x += spread) {
      const z = map.columnSurfaceZ(x, height - 1);
      const t = map.index(x, height - 1, z);
      if (map.kindAt(t) === TileKind.Floor) candidates.push(t);
    }
  } else if (edge === 'w') {
    for (let y = 0; y < height; y += spread) {
      const z = map.columnSurfaceZ(0, y);
      const t = map.index(0, y, z);
      if (map.kindAt(t) === TileKind.Floor) candidates.push(t);
    }
  } else if (edge === 'e') {
    for (let y = 0; y < height; y += spread) {
      const z = map.columnSurfaceZ(width - 1, y);
      const t = map.index(width - 1, y, z);
      if (map.kindAt(t) === TileKind.Floor) candidates.push(t);
    }
  }

  // If no candidates found with spread, try without spread
  if (candidates.length === 0) {
    if (edge === 'n' || edge === 's') {
      const y = edge === 'n' ? 0 : height - 1;
      for (let x = 0; x < width; x++) {
        const z = map.columnSurfaceZ(x, y);
        const t = map.index(x, y, z);
        if (map.kindAt(t) === TileKind.Floor) candidates.push(t);
      }
    } else {
      const x = edge === 'w' ? 0 : width - 1;
      for (let y = 0; y < height; y++) {
        const z = map.columnSurfaceZ(x, y);
        const t = map.index(x, y, z);
        if (map.kindAt(t) === TileKind.Floor) candidates.push(t);
      }
    }
  }

  if (candidates.length === 0) {
    // Ultimate fallback: corner of surface
    return new Array(count).fill(map.index(0, 0, map.columnSurfaceZ(0, 0)));
  }

  const result: TileIndex[] = [];
  for (let i = 0; i < count; i++) {
    result.push(candidates[i % candidates.length] as TileIndex);
  }
  return result;
}

/**
 * Spawns a single hostile creature member and attaches it to its party.
 */
export function spawnHostileMember(
  world: ThreatWorldLike,
  registry: Registry,
  rng: RngStream,
  partyId: EntityId,
  species: string,
  role: string,
  tile: TileIndex,
  gearTier: number,
  isCaptain: boolean,
): EntityId {
  const speciesTable = registry.table<{ id: string; flags?: { stealth?: boolean } }>('creatures');
  const speciesIdx = speciesTable.index(species);
  const faction = species.startsWith('hillfolk') ? 'hostile:hillfolk' : 'hostile:gloam';

  const creatureId = world.services.spawn.creature(speciesIdx, tile, faction);
  if (creatureId === 0) return 0;

  // Add Hostile component
  const spRow = speciesTable.byIndex(speciesIdx);
  const hasStealth = spRow?.flags?.stealth === true || role === 'thief';
  world.entities.add(creatureId, C.Hostile, {
    partyId,
    role,
    behaviorState: 'approach',
    stealthed: hasStealth,
    spotted: false,
    breakingDoorId: 0,
    breakingSince: 0,
  });

  // Assign skills and equipment
  assignHostileSkills(world.entities, registry, creatureId, gearTier, isCaptain);
  equipHostileCreature(world, registry, rng, creatureId, tile, role, gearTier, isCaptain);

  // Add to party members
  const partyComp = world.entities.get(partyId, C.Party);
  if (partyComp) {
    partyComp.members.push(creatureId);
    if (partyComp.leaderId === 0 || isCaptain) {
      partyComp.leaderId = creatureId;
    }
  }

  world.emit({
    type: 'HostileSpawned',
    id: creatureId,
    partyId,
  });

  return creatureId;
}

/**
 * Spawns a hostile party, emitting RaidArrived and scheduling member trickling over ARRIVAL_TICKS.
 */
export function arriveParty(
  world: ThreatWorldLike,
  registry: Registry,
  rng: RngStream,
  kind: string,
  civ: string,
  size: number,
  edge: Edge,
  currentTick: number,
  renown: number,
  peril: number,
  isTwilightPass: boolean,
): { partyId: EntityId; pendingSpawns: PendingSpawnState[] } {
  const partyId = world.entities.create('party');
  world.entities.add(partyId, C.Party, {
    civ,
    purpose: kind as 'thief' | 'bandits' | 'ambush' | 'raid' | 'siege' | 'restless',
    members: [],
    leaderId: 0,
    state: 'approach',
    goalTile: 0,
    goalEntity: 0,
    arrivedTick: currentTick,
    stateSince: currentTick,
    loot: [],
    edge,
    size,
  });

  world.emit({
    type: 'RaidArrived',
    partyId,
    kind,
    size,
  });

  const planned = calculatePartyComposition(kind, size, renown, peril, isTwilightPass);
  const tiles = findEdgeTiles(world.map, edge, planned.length);
  const pendingSpawns: PendingSpawnState[] = [];

  for (let i = 0; i < planned.length; i++) {
    const p = planned[i];
    const tile = tiles[i];
    if (!p || tile === undefined) continue;
    const delay = planned.length > 1 ? Math.floor((i * ARRIVAL_TICKS) / planned.length) : 0;
    const gearTier = calculateGearTier(peril, kind, p.isCaptain);

    if (delay === 0) {
      spawnHostileMember(world, registry, rng, partyId, p.species, p.role, tile, gearTier, p.isCaptain);
    } else {
      pendingSpawns.push({
        partyId,
        species: p.species,
        role: p.role,
        tile,
        tick: currentTick + delay,
        gearTier,
        isCaptain: p.isCaptain,
      });
    }
  }

  return { partyId, pendingSpawns };
}
