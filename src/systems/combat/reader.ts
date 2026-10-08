/**
 * Combat system reader interface and implementation.
 * `02-systems/16-combat.md` § Reader.
 */

import { C, type Squad } from '@core/components';
import type { EntityStore } from '@core/entities';
import type { Registry } from '@core/registry';
import type { Alert, BodySlot, DamageType, EntityId, TileIndex } from '@core/types';
import { isCreatureHostile } from './factions';
import { armorCovering, getDamageVsLayer, isWarTrained } from './melee';
import type { TargetManager } from './targets';
import { armorSpeedModifier } from './equipment';

export type SquadWithId = Squad & { id: EntityId };

export interface CombatReader {
  isHostile(a: EntityId, b: EntityId): boolean;
  factionOf(id: EntityId): string;
  targetOf(id: EntityId): EntityId;
  /** Last melee/ranged attack opportunity, from the saved engagement map. */
  lastEngagementTick(id: EntityId): number | undefined;
  squads(): readonly SquadWithId[];
  squad(id: EntityId): SquadWithId | undefined;
  squadOf(dwarfId: EntityId): SquadWithId | undefined;
  onDuty(dwarfId: EntityId): boolean;
  alert(): Alert;
  weaponOf(id: EntityId): EntityId;
  armorOf(id: EntityId): Record<'head' | 'body' | 'arms' | 'legs' | 'feet', EntityId>;
  armorValue(id: EntityId, part: BodySlot, damageType: DamageType): number;
  armorSpeedModifier(id: EntityId): number;
  lineOfSight(from: TileIndex, to: TileIndex): boolean;
}

export function makeCombatReader(
  entities: EntityStore,
  registry: Registry,
  targets: TargetManager,
  getAlert: () => Alert,
  losFn?: (from: TileIndex, to: TileIndex) => boolean,
): CombatReader {
  return {
    isHostile: (a: EntityId, b: EntityId): boolean => {
      return isCreatureHostile(entities, a, b, (id) => targets.targetOf(id));
    },

    factionOf: (id: EntityId): string => {
      return entities.get(id, C.Creature)?.faction ?? '';
    },

    targetOf: (id: EntityId): EntityId => {
      return targets.targetOf(id);
    },

    lastEngagementTick: (id: EntityId): number | undefined => targets.engagements.get(id),

    squads: (): readonly SquadWithId[] => {
      const result: SquadWithId[] = [];
      for (const squadId of entities.with(C.Squad)) {
        const sq = entities.get(squadId, C.Squad);
        if (sq !== undefined) {
          result.push({ ...sq, id: squadId });
        }
      }
      return result;
    },

    squad: (id: EntityId): SquadWithId | undefined => {
      const sq = entities.get(id, C.Squad);
      if (sq === undefined) return undefined;
      return { ...sq, id };
    },

    squadOf: (dwarfId: EntityId): SquadWithId | undefined => {
      const soldier = entities.get(dwarfId, C.Soldier);
      if (soldier === undefined || soldier.squadId === 0) return undefined;
      const sq = entities.get(soldier.squadId, C.Squad);
      if (sq === undefined) return undefined;
      return { ...sq, id: soldier.squadId };
    },

    onDuty: (dwarfId: EntityId): boolean => {
      const soldier = entities.get(dwarfId, C.Soldier);
      return soldier?.onDuty ?? false;
    },

    alert: (): Alert => {
      return getAlert();
    },

    weaponOf: (id: EntityId): EntityId => {
      const equip = entities.get(id, C.Equipment);
      if (equip && equip.weapon !== 0) return equip.weapon;
      const worker = entities.get(id, C.Worker);
      if (worker && worker.toolId !== 0) return worker.toolId;
      return 0;
    },

    armorOf: (id: EntityId): Record<'head' | 'body' | 'arms' | 'legs' | 'feet', EntityId> => {
      const equip = entities.get(id, C.Equipment);
      if (equip !== undefined) {
        return { ...equip.armor };
      }
      return { head: 0, body: 0, arms: 0, legs: 0, feet: 0 };
    },

    armorValue: (id: EntityId, part: BodySlot, damageType: DamageType): number => {
      const pieces = armorCovering(entities, registry, id, part);
      let red = 0;
      for (const piece of pieces) {
        const layerMult = getDamageVsLayer(damageType, piece.layer);
        red += piece.armor * piece.armorMult * (piece.coverage / 100) * piece.qualityArmorMult * layerMult;
      }
      const creature = entities.get(id, C.Creature);
      if (creature) {
        const speciesTable = registry.table<{ id: string; naturalArmor: number }>('creatures');
        const sp = speciesTable.byIndex(creature.species);
        const naturalArmor = (sp?.naturalArmor ?? 0) + (isWarTrained(entities, id) ? 1 : 0);
        red += naturalArmor * getDamageVsLayer(damageType, 'plate');
      }
      return red;
    },

    armorSpeedModifier: (id: EntityId): number => {
      return armorSpeedModifier(entities, registry, id);
    },

    lineOfSight: (from: TileIndex, to: TileIndex): boolean => {
      if (losFn) return losFn(from, to);
      return false;
    },
  };
}
