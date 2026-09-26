/**
 * Health & Medicine system: `02-systems/17-health-and-medicine.md`.
 */

import { C } from '@core/components';
import type { CommandType } from '@core/command-types';
import { OK, reject, type Command, type CommandResult } from '@core/commands';
import type { EventType } from '@core/event-types';
import type { GameEvent } from '@core/events';
import type { RngStream } from '@core/rng';
import {
  BaseSystem,
  type InitContext,
  type SystemId,
  type TickContext,
} from '@core/system';
import type { BodySlot, EntityId, TileIndex } from '@core/types';
import { BODY_SLOTS } from '@core/types';
import type { BuildingsReader } from '@systems/buildings/reader';
import {
  DROWN_DAMAGE,
  HEALTH_CADENCE,
  HEALTH_PHASE,
  STARVE_PERCENT,
} from './constants';
import { HealthProducer } from './producer';
import { type HealthReader, makeHealthReader } from './reader';
import type { HealthStateV1 } from './state';
import {
  applyDamage,
  handleDailyInfection,
  handleFell,
  handleHourlyTemperature,
  killCreature,
  tickHealth,
} from './tick';

export type { HealthReader } from './reader';
export * from './constants';
export * from './wounds';
export * from './state';

export class HealthSystem extends BaseSystem<HealthStateV1> {
  override readonly id: SystemId = '17';
  override readonly order: number = 17;
  override readonly cadence: number = HEALTH_CADENCE;
  override readonly phase: number = HEALTH_PHASE;

  override readonly subscribes: readonly EventType[] = [
    'DamageDealt',
    'BurnDamage',
    'MagmaContact',
    'CreatureSubmerged',
    'Fell',
    'LightningStrike',
    'Starvation',
    'HourPassed',
    'DayPassed',
    'CreatureDied',
    'Slept',
  ];

  override readonly ownsCommands: readonly CommandType[] = ['SetHospitalSupplies'];

  private rngRef: RngStream | null = null;
  private readerRef: HealthReader | null = null;
  private readonly wounded: Set<EntityId> = new Set();
  private readonly hospitals: EntityId[] = [];
  private readonly lastAttacker: Map<EntityId, EntityId> = new Map();
  private readonly lastDrownTick: Map<EntityId, number> = new Map();
  private readonly floorSleepers: Set<EntityId> = new Set();
  private readonly lastHospitalTier: Map<EntityId, number> = new Map();

  get rng(): RngStream {
    if (this.rngRef === null) throw new Error('17 health: used before init');
    return this.rngRef;
  }

  override init(ctx: InitContext): void {
    this.rngRef = ctx.rng;
    this.readerRef = makeHealthReader(ctx.world.entities, ctx.registry, this.wounded);

    // Registrations
    ctx.register.inspector('creature', { id: 'health', order: 12 });
    ctx.register.announcement('PatientAdmitted', {
      severity: 'note',
      stringKey: 'announce.patient_admitted',
    });
    ctx.register.announcement('CreatureUnconscious', {
      severity: 'alert',
      stringKey: 'announce.dwarf_unconscious',
    });
    ctx.register.announcement('CreatureDied', {
      severity: 'danger',
      stringKey: 'announce.dwarf_died',
    });
    ctx.register.announcement('InfectionStarted', {
      severity: 'alert',
      stringKey: 'announce.infection',
    });
    ctx.register.announcement('LimbLost', {
      severity: 'alert',
      stringKey: 'announce.limb_lost',
    });

    ctx.register.jobProducer(
      new HealthProducer({
        rng: ctx.rng,
        entities: ctx.world.entities,
        map: ctx.world.map,
        registry: ctx.registry,
      }),
    );
  }

  override applyCommand(cmd: Command, ctx: TickContext): CommandResult {
    if (cmd.type === 'SetHospitalSupplies') {
      const zoneId = cmd['zoneId'] as EntityId;
      const wants = cmd['wants'] as Record<string, number>;
      if (!ctx.readers.has('14')) return reject('precondition_failed');
      const buildings = ctx.readers.of<BuildingsReader>('14');
      const z = buildings.zone(zoneId);
      if (!z || z.type !== 'hospital') return reject('precondition_failed');
      const zoneComp = ctx.world.entities.get(zoneId, C.Zone);
      if (zoneComp) {
        ctx.world.entities.add(zoneId, C.Zone, {
          ...zoneComp,
          settings: { ...zoneComp.settings, 'desired supplies': { ...wants } },
        });
      }
      return OK;
    }
    return reject('precondition_failed');
  }

  override reader(): HealthReader {
    if (this.readerRef === null) throw new Error('17 health: reader before init');
    return this.readerRef;
  }

  override tick(ctx: TickContext): void {
    tickHealth(ctx, this.wounded, this.lastAttacker, this.lastHospitalTier);
  }

  override handle(event: GameEvent, ctx: TickContext): void {
    if (event.type === 'CreatureDied') {
      const id = event['id'] as EntityId;
      this.wounded.delete(id);
      this.lastAttacker.delete(id);
      this.lastDrownTick.delete(id);
      this.lastHospitalTier.delete(id);
      return;
    }

    if (event.type === 'DamageDealt') {
      const defender = (event['defenderId'] ?? event['defender']) as EntityId;
      const attacker = (event['attackerId'] ?? event['attacker'] ?? 0) as EntityId;
      const part = event['part'] as BodySlot;
      const damageType = (event['damageType'] ?? 'blunt') as string;
      const amount = (event['amount'] as number) ?? 0;
      applyDamage(ctx, defender, part, damageType, amount, attacker, this.wounded, this.lastAttacker, 'killed', this.lastHospitalTier);
      return;
    }

    if (event.type === 'Fell') {
      handleFell(event as Record<string, unknown>, ctx, this.rng, this.wounded, this.lastAttacker);
      return;
    }

    if (event.type === 'BurnDamage') {
      const id = event['id'] as EntityId;
      const amount = (event['amount'] as number) ?? 5;
      const b = ctx.world.entities.get(id, C.Body);
      if (b !== undefined) {
        const nonDestroyedParts: BodySlot[] = [];
        for (let i = 0; i < b.parts.length; i += 1) {
          if (!b.parts[i]?.destroyed) nonDestroyedParts.push(BODY_SLOTS[i] as BodySlot);
        }
        if (nonDestroyedParts.length > 0) {
          const part = nonDestroyedParts[this.rng.int(0, nonDestroyedParts.length - 1)] as BodySlot;
          applyDamage(ctx, id, part, 'burn', amount, 0, this.wounded, this.lastAttacker, 'burnt');
        }
      }
      return;
    }

    if (event.type === 'MagmaContact') {
      const entities = (event['entities'] as readonly EntityId[]) ?? [];
      const speciesTable = ctx.registry.table<{ id: string; magmaSafe?: boolean }>('creatures');
      for (const id of entities) {
        if (!ctx.world.entities.alive(id)) continue;
        const creature = ctx.world.entities.get(id, C.Creature);
        if (creature) {
          const sp = speciesTable.byIndex(creature.species);
          if (sp?.magmaSafe === true) continue;
        }
        const b = ctx.world.entities.get(id, C.Body);
        const torsoHp = b?.parts[1]?.maxHp ?? 60;
        applyDamage(ctx, id, 'torso', 'burn', torsoHp * 2, 0, this.wounded, this.lastAttacker, 'magma');
      }
      return;
    }

    if (event.type === 'CreatureSubmerged') {
      const id = event['id'] as EntityId;
      if (!ctx.world.entities.alive(id)) return;
      const lastTick = this.lastDrownTick.get(id);
      if (lastTick === ctx.tick) return; // already damaged this tick
      this.lastDrownTick.set(id, ctx.tick);

      const creature = ctx.world.entities.get(id, C.Creature);
      if (creature) {
        const speciesTable = ctx.registry.table<{ id: string; movementClass: string }>('creatures');
        const sp = speciesTable.byIndex(creature.species);
        if (sp?.movementClass === 'aquatic' || sp?.movementClass === 'amphibious') return;
      }
      applyDamage(ctx, id, 'torso', 'bruise', DROWN_DAMAGE, 0, this.wounded, this.lastAttacker, 'drowned');
      return;
    }

    if (event.type === 'LightningStrike') {
      const tile = event['tile'] as TileIndex;
      if (typeof tile !== 'number') return;
      const here = ctx.readers.spatial.at(tile);
      for (const id of here) {
        if (!ctx.world.entities.alive(id)) continue;
        const b = ctx.world.entities.get(id, C.Body);
        if (b !== undefined) {
          const headHp = b.parts[0]?.maxHp ?? 30;
          const torsoHp = b.parts[1]?.maxHp ?? 60;
          applyDamage(ctx, id, 'head', 'burn', Math.floor(headHp * 0.6), 0, this.wounded, this.lastAttacker, 'lightning');
          applyDamage(ctx, id, 'torso', 'burn', Math.floor(torsoHp * 0.6), 0, this.wounded, this.lastAttacker, 'lightning');
        }
      }
      return;
    }

    if (event.type === 'Starvation') {
      const id = event['id'] as EntityId;
      if (!ctx.world.entities.alive(id)) return;
      if (!ctx.world.entities.has(id, C.Needs)) {
        // Animal starvation -> death
        killCreature(ctx, id, 'starvation');
        return;
      }
      // Dwarf starvation: 8% of torso hp daily as wasting
      const b = ctx.world.entities.get(id, C.Body);
      if (b !== undefined && b.parts[1]) {
        const torsoMaxHp = b.parts[1].maxHp;
        const amount = (torsoMaxHp * STARVE_PERCENT) / 100;
        applyDamage(ctx, id, 'torso', 'wasting', amount, 0, this.wounded, this.lastAttacker, 'starvation');
      }
      return;
    }

    if (event.type === 'Slept') {
      if (event['onFloor'] === true) {
        this.floorSleepers.add(event['id'] as EntityId);
      }
      return;
    }

    if (event.type === 'HourPassed') {
      handleHourlyTemperature(ctx, this.rng, this.wounded, this.lastAttacker);
      return;
    }

    if (event.type === 'DayPassed') {
      handleDailyInfection(ctx, this.rng, this.wounded, this.lastAttacker, this.floorSleepers);
      this.floorSleepers.clear();
      return;
    }
  }

  serialize(): HealthStateV1 {
    return {
      stateVersion: 1,
      wounded: Array.from(this.wounded).sort((a, b) => a - b),
      hospitals: this.hospitals.slice(),
      patientJobs: [],
      rng: this.rng.state(),
    };
  }

  deserialize(state: HealthStateV1, ctx: InitContext): void {
    if (this.rngRef === null) this.init(ctx);
    this.wounded.clear();
    for (const id of state.wounded) this.wounded.add(id);
    this.hospitals.length = 0;
    this.hospitals.push(...state.hospitals);
    this.rng.setState(state.rng);
  }
}
