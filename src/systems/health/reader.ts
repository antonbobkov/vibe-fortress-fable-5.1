/**
 * Health system reader: `02-systems/17-health-and-medicine.md` § Interfaces › Reader.
 */

import { C, type Body, type Wound } from '@core/components';
import type { EntityStore } from '@core/entities';
import type { Registry } from '@core/registry';
import type { EntityId } from '@core/types';
import { BODY_SLOTS } from '@core/types';
import { PRODUCTIVITY_FLOOR } from './constants';

export interface HealthReader {
  isConscious(id: EntityId): boolean;
  bloodPercent(id: EntityId): number;
  pain(id: EntityId): number;
  isWounded(id: EntityId): boolean;
  wounds(id: EntityId): readonly Wound[];
  permanent(id: EntityId): readonly string[];
  isPatient(id: EntityId): boolean;
  needsTreatment(id: EntityId): readonly string[];
  speedModifier(id: EntityId): number;
  productivityModifier(id: EntityId): number;
  canWield(id: EntityId, hands: 1 | 2): boolean;
  canWork(id: EntityId): boolean;
  summaryText(id: EntityId): string;
}

const PART_NAMES: readonly string[] = [
  'head',
  'torso',
  'left arm',
  'right arm',
  'left leg',
  'right leg',
];

export function makeHealthReader(
  entities: EntityStore,
  registry: Registry,
  woundedSet: ReadonlySet<EntityId>,
): HealthReader {
  const getBody = (id: EntityId): Body | undefined => {
    if (!entities.alive(id)) return undefined;
    return entities.get(id, C.Body);
  };

  const isConscious = (id: EntityId): boolean => {
    const b = getBody(id);
    return b === undefined ? true : b.conscious;
  };

  const bloodPercent = (id: EntityId): number => {
    const b = getBody(id);
    if (b === undefined || b.maxBlood <= 0) return 100;
    return Math.floor((b.blood * 100) / b.maxBlood);
  };

  const pain = (id: EntityId): number => {
    const b = getBody(id);
    return b === undefined ? 0 : b.pain;
  };

  const isWounded = (id: EntityId): boolean => {
    if (woundedSet.has(id)) return true;
    const b = getBody(id);
    if (b === undefined) return false;
    return b.parts.some((p) => p.wounds.length > 0);
  };

  const wounds = (id: EntityId): readonly Wound[] => {
    const b = getBody(id);
    if (b === undefined) return [];
    return b.parts.flatMap((p) => p.wounds);
  };

  const permanent = (id: EntityId): readonly string[] => {
    const b = getBody(id);
    return b === undefined ? [] : b.permanent.slice();
  };

  const isPatient = (id: EntityId): boolean => {
    if (!entities.alive(id)) return false;
    return entities.has(id, C.Patient);
  };

  const needsTreatment = (id: EntityId): readonly string[] => {
    if (!entities.alive(id)) return [];
    return entities.get(id, C.Patient)?.needs.slice() ?? [];
  };

  const hasCrutchItem = (id: EntityId): boolean => {
    const worker = entities.get(id, C.Worker);
    if (worker !== undefined) {
      if (worker.carrying !== 0 && isCrutch(worker.carrying)) return true;
      if (worker.toolId !== 0 && isCrutch(worker.toolId)) return true;
    }
    const equip = entities.get(id, C.Equipment);
    if (equip !== undefined) {
      if (equip.weapon !== 0 && isCrutch(equip.weapon)) return true;
      if (equip.shield !== 0 && isCrutch(equip.shield)) return true;
    }
    return false;
  };

  const isCrutch = (itemId: EntityId): boolean => {
    const item = entities.get(itemId, C.Item);
    if (item === undefined) return false;
    const typeDef = registry.table<{ id: string }>('items').byIndex(item.type);
    return typeDef?.id === 'crutch';
  };

  const speedModifier = (id: EntityId): number => {
    const b = getBody(id);
    if (b === undefined) return 100;
    if (!b.conscious) return 0;
    const perm = b.permanent;
    const lostLeft = perm.includes('lost_left_leg');
    const lostRight = perm.includes('lost_right_leg');
    if (lostLeft && lostRight) return 0; // bedridden

    let factor = 1.0;
    if (lostLeft || lostRight) {
      factor *= hasCrutchItem(id) ? 0.75 : 0.50;
    }
    if (perm.includes('badly_healed_left_leg')) factor *= 0.85;
    if (perm.includes('badly_healed_right_leg')) factor *= 0.85;
    return Math.round(factor * 100);
  };

  const productivityModifier = (id: EntityId): number => {
    const b = getBody(id);
    if (b === undefined) return 100;
    if (!b.conscious) return 0;
    const perm = b.permanent;
    const lostLeftArm = perm.includes('lost_left_arm');
    const lostRightArm = perm.includes('lost_right_arm');
    if (lostLeftArm && lostRightArm) return 0;

    let armPenalties = 0;
    if (lostLeftArm || lostRightArm) armPenalties += 25;
    if (perm.includes('badly_healed_left_arm')) armPenalties += 10;
    if (perm.includes('badly_healed_right_arm')) armPenalties += 10;

    const bloodPct = b.maxBlood > 0 ? Math.floor((b.blood * 100) / b.maxBlood) : 100;
    const prod = 100 - Math.floor(b.pain / 2) - Math.floor((100 - bloodPct) / 2) - armPenalties;
    return Math.max(PRODUCTIVITY_FLOOR, prod);
  };

  const canWield = (id: EntityId, hands: 1 | 2): boolean => {
    const b = getBody(id);
    if (b === undefined) return true;
    const perm = b.permanent;
    const lostLeft = perm.includes('lost_left_arm') || (b.parts[2]?.destroyed ?? false);
    const lostRight = perm.includes('lost_right_arm') || (b.parts[3]?.destroyed ?? false);
    const workingArms = (lostLeft ? 0 : 1) + (lostRight ? 0 : 1);
    if (hands === 2) return workingArms >= 2;
    return workingArms >= 1;
  };

  const canWork = (id: EntityId): boolean => {
    const b = getBody(id);
    if (b === undefined) return true;
    if (!b.conscious) return false;
    const perm = b.permanent;
    if (perm.includes('lost_left_leg') && perm.includes('lost_right_leg')) return false;
    if (perm.includes('lost_left_arm') && perm.includes('lost_right_arm')) return false;
    // Infected check: no work with fever
    for (const p of b.parts) {
      for (const w of p.wounds) {
        if (w.infected) return false;
      }
    }
    return true;
  };

  const summaryText = (id: EntityId): string => {
    const b = getBody(id);
    if (b === undefined) return 'Healthy';
    if (!entities.alive(id)) return 'Dead';
    const partsDescs: string[] = [];

    if (!b.conscious) partsDescs.push('unconscious');

    for (let i = 0; i < b.parts.length; i += 1) {
      const part = b.parts[i];
      if (!part) continue;
      const partName = PART_NAMES[i] ?? BODY_SLOTS[i] ?? 'body';
      if (part.destroyed) {
        partsDescs.push(`lost ${partName}`);
        continue;
      }
      for (const w of part.wounds) {
        if (w.bleed > 0 && !w.bandaged) {
          partsDescs.push(`bleeding from the ${partName}`);
        } else if (w.type === 'fracture') {
          partsDescs.push(`broken ${partName}${w.splinted ? ' (splinted)' : ''}`);
        } else if (w.type === 'burn') {
          partsDescs.push(`burned ${partName}${w.dressed ? ' (dressed)' : ''}`);
        } else if (w.infected) {
          partsDescs.push(`infected ${partName}`);
        } else if (w.severity === 'serious' || w.severity === 'grievous') {
          partsDescs.push(`wounded ${partName}`);
        }
      }
    }

    if (b.pain >= 20) partsDescs.push('in pain');
    if (partsDescs.length === 0) return 'Healthy';
    // Capitalize first letter
    const text = partsDescs.join('; ');
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  return {
    isConscious,
    bloodPercent,
    pain,
    isWounded,
    wounds,
    permanent,
    isPatient,
    needsTreatment,
    speedModifier,
    productivityModifier,
    canWield,
    canWork,
    summaryText,
  };
}
