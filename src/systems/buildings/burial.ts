/** Coffin reservations, corpse hauling, and named memorials (14 § Burial; 15 § Grief). */
import { C, type Building } from '@core/components';
import { OK, reject, type Command, type CommandResult } from '@core/commands';
import type { GameEvent } from '@core/events';
import type { TickContext } from '@core/system';
import type { EntityId } from '@core/types';
import type { Job } from '@systems/jobs';
import type { BuildingStore } from './build';
import type { RoomStore } from './rooms';
import type { ZoneStore } from './zones';

export interface DeadDwarf {
  id: EntityId;
  name: string;
  corpseId: EntityId;
  buried: boolean;
}

export class BurialStore {
  readonly dead = new Map<EntityId, DeadDwarf>();
  readonly assignments = new Map<EntityId, EntityId>();

  constructor(private readonly buildings: BuildingStore, private readonly rooms: RoomStore,
    private readonly zones: ZoneStore) {}

  eligible(id: EntityId): boolean {
    const dead = this.dead.get(id);
    if (dead === undefined || dead.buried) return false;
    const item = this.buildings.host.entities.get(dead.corpseId, C.Item);
    return item === undefined || item.rotStage >= 3;
  }

  handle(event: GameEvent, ctx: TickContext): void {
    if (event.type === 'CorpseCreated') {
      const id = event['creatureId'] as EntityId;
      const corpseId = event['id'] as EntityId;
      const corpse = ctx.world.entities.get(corpseId, C.Corpse);
      if (corpse?.dwarfName !== null && corpse?.dwarfName !== undefined) {
        this.dead.set(id, { id, name: corpse.dwarfName, corpseId, buried: false });
      }
    } else if (event.type === 'ItemDestroyed') {
      const itemId = event['id'] as EntityId;
      for (const dead of Array.from(this.dead.values()).sort((a, b) => a.id - b.id)) {
        if (dead.corpseId === itemId) dead.corpseId = 0;
      }
      this.assignments.delete(itemId);
    } else if (event.type === 'BuildingCompleted') {
      const id = event['id'] as EntityId;
      const b = this.buildings.get(id);
      if (b === undefined || this.buildings.typeIdOf(id) !== 'memorial_slab') return;
      const named = ctx.world.entities.get(b.itemId, C.Item)?.memorialDwarfId;
      if (named === undefined || !this.eligible(named)) return;
      const dead = this.dead.get(named) as DeadDwarf;
      dead.buried = true;
      const corpse = ctx.world.entities.get(dead.corpseId, C.Corpse);
      if (corpse !== undefined) ctx.world.entities.add(dead.corpseId, C.Corpse, { ...corpse, memorialized: true });
      ctx.emit({ type: 'Buried', dwarfId: named, coffinId: 0, tombTier: 'none' });
    }
  }

  assign(cmd: Command, ctx: TickContext): CommandResult {
    const coffinId = cmd['coffinId'];
    const dwarfId = cmd['dwarfId'];
    const coffin = typeof coffinId === 'number' ? this.buildings.get(coffinId) : undefined;
    if (coffin === undefined || this.buildings.typeIdOf(coffinId as EntityId) !== 'coffin') return reject('not_found');
    if (coffin.state !== 'built' || (coffin.settings['occupantId'] as number | undefined ?? 0) !== 0) return reject('precondition_failed');
    if (typeof dwarfId !== 'number' || (dwarfId !== 0 &&
      (!ctx.world.entities.alive(dwarfId) || !ctx.world.entities.has(dwarfId, C.Attributes)))) return reject('not_found');
    ctx.world.entities.add(coffinId as EntityId, C.Building, { ...coffin, ownerId: dwarfId });
    return OK;
  }

  produce(ctx: TickContext): void {
    const entities = ctx.world.entities;
    for (const [corpseId, coffinId] of this.assignments) {
      if (!ctx.jobs.exists(`bury:${corpseId}`) || !entities.alive(corpseId) || this.buildings.get(coffinId)?.state !== 'built') {
        this.assignments.delete(corpseId);
      }
    }
    const taken = new Set(this.assignments.values());
    for (const dead of Array.from(this.dead.values()).sort((a, b) => a.id - b.id)) {
      const corpseId = dead.corpseId;
      if (dead.buried || corpseId === 0 || !entities.alive(corpseId) || this.assignments.has(corpseId)) continue;
      const corpse = entities.get(corpseId, C.Corpse);
      if (corpse === undefined || corpse.memorialized === true) continue;
      const coffins = this.buildings.coffins.filter((id) => {
        const b = this.buildings.get(id);
        return b?.state === 'built' && (b.settings['occupantId'] as number | undefined ?? 0) === 0 &&
          (b.ownerId === 0 || b.ownerId === dead.id) && !taken.has(id);
      }).sort((a, b) => {
        const reservedA = this.buildings.get(a)?.ownerId === dead.id ? 0 : 1;
        const reservedB = this.buildings.get(b)?.ownerId === dead.id ? 0 : 1;
        return reservedA - reservedB || a - b;
      });
      const coffinId = coffins[0];
      if (coffinId === undefined) continue;
      const coffin = this.buildings.get(coffinId) as Building;
      ctx.jobs.create(`bury:${corpseId}`, { type: 'bury', target: { kind: 'building', ref: coffinId },
        workTile: 'adjacent', inputs: [{ filter: { itemId: corpseId }, count: 1, wholeItem: true }],
        data: { dwarfId: dead.id, corpseId, coffinId, anchorTile: coffin.origin } });
      this.assignments.set(corpseId, coffinId);
      taken.add(coffinId);
    }
  }

  complete(job: Job, ctx: TickContext): void {
    const corpseId = job.data['corpseId'] as EntityId;
    const coffinId = job.data['coffinId'] as EntityId;
    const dwarfId = job.data['dwarfId'] as EntityId;
    this.assignments.delete(corpseId);
    const coffin = this.buildings.get(coffinId);
    const dead = this.dead.get(dwarfId);
    if (coffin?.state !== 'built' || dead === undefined || dead.buried || !ctx.world.entities.alive(corpseId)) return;
    ctx.world.entities.add(coffinId, C.Building, { ...coffin, settings: { ...coffin.settings, occupantId: dwarfId } });
    dead.buried = true;
    dead.corpseId = 0;
    ctx.world.services.items?.destroy(corpseId, 'buried');
    let tombTier: number | 'none' = 'none';
    for (const zoneId of this.zones.zonesAt(coffin.origin)) {
      if (this.zones.typeIdOf(zoneId) === 'tomb') {
        tombTier = this.rooms.room(zoneId)?.tier ?? 0;
        break;
      }
    }
    ctx.emit({ type: 'Buried', dwarfId, coffinId, tombTier });
  }

  serialize(): DeadDwarf[] {
    return Array.from(this.dead.values()).sort((a, b) => a.id - b.id).map((d) => ({ ...d }));
  }

  restore(dead: readonly DeadDwarf[], assignments: readonly [EntityId, EntityId][]): void {
    this.dead.clear();
    for (const d of dead) this.dead.set(d.id, { ...d });
    this.assignments.clear();
    for (const [corpse, coffin] of assignments) this.assignments.set(corpse, coffin);
  }
}
