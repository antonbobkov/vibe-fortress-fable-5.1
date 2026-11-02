/**
 * Health tick and event handling:
 * `02-systems/17-health-and-medicine.md` and `04-implementation/algorithms/combat-and-health.md`.
 */

import { C, type Wound } from '@core/components';
import {
  BLOOD_DEATH_PERCENT,
  BLOOD_REGEN_PER_TICK,
  BLOOD_UNCONSCIOUS_PERCENT,
  CLOT_TICKS,
  DROWN_DAMAGE,
  FALL_DAMAGE_PER_LEVEL_SQ,
  INFECTION_DEATH_PERMILLE,
  INFECTION_PERMILLE,
  PAIN_DISCHARGE,
  PAIN_UNCONSCIOUS,
  SUTURED_HEAL_PERCENT,
  UNTREATED_FRACTURE_PERCENT,
} from './constants';
import { COLD_INJURY_C, HEAT_INJURY_C } from '@systems/materials/constants';
import { FLUID_DEEP_LEVEL, FLUID_MAX_LEVEL, TICKS_PER_DAY } from '@core/constants';
import { WADE_LARGE_SIZE } from '@core/path-constants';
import { FluidType, TileFlag } from '@core/map3d';
import type { RngStream } from '@core/rng';
import type { TickContext } from '@core/system';
import type { BodySlot, EntityId, TileIndex } from '@core/types';
import { BODY_SLOTS } from '@core/types';
import type { BuildingsReader } from '@systems/buildings/reader';
import { createWound, exposed, severityFor, woundTreatmentNeeds, woundTypeFor } from './wounds';
import { hasCrutchItem } from './reader';

const LIMB_SLOTS: readonly BodySlot[] = ['left_arm', 'right_arm', 'left_leg', 'right_leg'];

// Death is delivered at the end of the tick. Until then the entity remains alive and another
// lethal event can reach this function. Entity stores differ after save/load, so this guard cannot
// carry a pending death into a restored world.
const emittedDeaths = new WeakMap<object, Set<EntityId>>();

export function killCreature(
  ctx: TickContext,
  id: EntityId,
  cause: string,
  killerId: EntityId = 0,
): void {
  const entities = ctx.world.entities;
  if (!entities.alive(id)) return;
  let emitted = emittedDeaths.get(entities);
  if (emitted?.has(id)) return;
  if (emitted === undefined) {
    emitted = new Set<EntityId>();
    emittedDeaths.set(entities, emitted);
  }
  emitted.add(id);
  const pos = entities.get(id, C.Position);
  const tile = pos ? ctx.world.map.index(pos.x, pos.y, pos.z) : -1;
  const creature = entities.get(id, C.Creature);
  const equip = entities.get(id, C.Equipment);
  const wornItems = equip
    ? [
        equip.weapon,
        equip.shield,
        ...Object.values(equip.armor),
        ...Object.values(equip.clothing),
        equip.quiver,
      ].filter((w) => w !== 0)
    : [];

  ctx.emit({
    type: 'CreatureDied',
    id,
    cause,
    killerId,
    tile,
    species: creature?.species,
    name: creature?.name,
    faction: creature?.faction,
    // A wild animal is the killer's enemy while it attacks; combat reads this once the victim is gone.
    wildState: entities.get(id, C.Wild)?.state,
    ageTicks: creature?.ageTicks,
    wornItems,
  });
}

function findHospitalOrFreeBed(ctx: TickContext, patientId: EntityId): { hospitalZoneId: EntityId; bedId: EntityId; hospitalTier: number } {
  if (!ctx.readers.has('14')) return { hospitalZoneId: 0, bedId: 0, hospitalTier: 0 };
  const buildings = ctx.readers.of<BuildingsReader>('14');
  const beds = new Set(buildings.byTag('sleep'));
  for (const hz of buildings.zonesOfType('hospital')) {
    for (const tile of buildings.zone(hz)?.tiles ?? []) {
      const bedId = buildings.at(tile);
      if (!beds.has(bedId) || buildings.get(bedId)?.state !== 'built') continue;
      const holder = buildings.bedHolder(bedId);
      if (holder === 0 || holder === patientId) {
        return { hospitalZoneId: hz, bedId, hospitalTier: buildings.room(hz)?.tier ?? 0 };
      }
    }
  }
  return { hospitalZoneId: 0, bedId: buildings.freeBeds(patientId)[0] ?? 0, hospitalTier: 0 };
}

export function updatePatient(
  ctx: TickContext,
  id: EntityId,
  lastHospitalTier?: Map<EntityId, number>,
): void {
  const entities = ctx.world.entities;
  if (!entities.alive(id)) return;
  // Patient flow is for dwarves (entities with Attributes)
  if (!entities.has(id, C.Attributes)) return;
  const b = entities.get(id, C.Body);
  if (b === undefined) return;

  const allWounds = b.parts.flatMap((p) => p.wounds);
  const anyBleeds = allWounds.some((w) => w.bleed > 0 && !w.bandaged);
  const anyUnsplintedFracture = allWounds.some((w) => w.type === 'fracture' && !w.splinted);
  // A light burn admits no one: its dwarf keeps working, and the producer still dresses it.
  const anyUndressedBurn = allWounds.some((w) => w.type === 'burn' && w.severity !== 'light' && !w.dressed);
  const anyInfected = allWounds.some((w) => w.infected);
  // A stun (25's `CreatureStunned`) leaves the body unconscious with wounds that allow consciousness:
  // it admits no one.
  const unconscious = !b.conscious && !(b.pain < PAIN_UNCONSCIOUS && b.blood >= Math.floor((b.maxBlood * BLOOD_UNCONSCIOUS_PERCENT) / 100));

  const shouldBePatient =
    anyBleeds || anyUnsplintedFracture || anyUndressedBurn || anyInfected || unconscious;

  const existingPatient = entities.get(id, C.Patient);

  if (shouldBePatient || existingPatient !== undefined) {
    const needs = woundTreatmentNeeds(allWounds);
    if (!b.diagnosed) needs.push('diagnose');
    const lostLeg = b.permanent.includes('lost_left_leg') || b.permanent.includes('lost_right_leg');
    if (lostLeg && !hasCrutchItem(entities, ctx.registry, id)) needs.push('give_crutch');

    if (!shouldBePatient && existingPatient !== undefined) {
      // A treated patient can remain admitted for pain, but needs no repeated treatment.
      entities.add(id, C.Patient, { ...existingPatient, needs });
    } else if (existingPatient === undefined) {
      const bedInfo = findHospitalOrFreeBed(ctx, id);
      entities.add(id, C.Patient, {
        hospitalZoneId: bedInfo.hospitalZoneId,
        bedId: bedInfo.bedId,
        needs,
        admittedTick: ctx.tick,
      });
      if (lastHospitalTier) lastHospitalTier.set(id, bedInfo.hospitalTier);
      ctx.emit({ type: 'PatientAdmitted', id, hospitalTier: bedInfo.hospitalTier });
    } else {
      if (existingPatient.bedId === 0 || (ctx.readers.has('14') &&
          ctx.readers.of<BuildingsReader>('14').bedHolder(existingPatient.bedId) !== id)) {
        const bedInfo = findHospitalOrFreeBed(ctx, id);
        existingPatient.bedId = bedInfo.bedId;
        if (bedInfo.bedId !== 0) existingPatient.hospitalZoneId = bedInfo.hospitalZoneId;
      }
      entities.add(id, C.Patient, {
        ...existingPatient,
        needs,
      });
    }
  }
  if (!shouldBePatient && existingPatient !== undefined) {
    // Discharge: no bleeding, no unsplinted fractures, no undressed burns, no infection, conscious, pain < PAIN_DISCHARGE
    if (
      !anyBleeds &&
      !anyUnsplintedFracture &&
      !anyUndressedBurn &&
      !anyInfected &&
      !unconscious &&
      b.pain < PAIN_DISCHARGE
    ) {
      let hospitalTier = 0;
      if (existingPatient.hospitalZoneId !== 0 && ctx.readers.has('14')) {
        const room = ctx.readers.of<BuildingsReader>('14').room(existingPatient.hospitalZoneId);
        hospitalTier = room?.tier ?? 0;
      }
      entities.remove(id, C.Patient);
      ctx.emit({ type: 'PatientDischarged', id, hospitalTier });
      const allLightOrGone = allWounds.every((w) => w.severity === 'light');
      if (allLightOrGone) {
        ctx.emit({ type: 'PatientHealed', id, hospitalTier });
      }
    }
  }
}

export function applyDamage(
  ctx: TickContext,
  id: EntityId,
  partSlot: BodySlot | number,
  damageType: string,
  amount: number,
  attackerId: EntityId,
  woundedSet: Set<EntityId>,
  lastAttacker: Map<EntityId, EntityId>,
  lethalCause = 'killed',
  lastHospitalTier?: Map<EntityId, number>,
  /** The wound is made `cleaned`, so it cannot take infection (25's mishap burns). */
  clean = false,
): void {
  if (amount <= 0) return;
  const entities = ctx.world.entities;
  if (!entities.alive(id)) return;
  const b = entities.get(id, C.Body);
  if (b === undefined) return;

  const partIndex = typeof partSlot === 'number' ? partSlot : BODY_SLOTS.indexOf(partSlot);
  if (partIndex < 0 || partIndex >= b.parts.length) return;
  const part = b.parts[partIndex];
  if (!part || part.destroyed) return;

  const maxHp = part.maxHp;
  const sev = severityFor(amount, maxHp);

  part.hp -= amount;

  if (attackerId !== 0) {
    lastAttacker.set(id, attackerId);
  }

  // Part destroyed?
  if (part.hp <= 0) {
    part.hp = 0;
    const slotName = BODY_SLOTS[partIndex];
    if (slotName === 'head' || slotName === 'torso') {
      killCreature(ctx, id, lethalCause, attackerId);
      return;
    }
    // Limb destroyed -> lost limb
    part.destroyed = true;
    part.wounds = [];
    const permName = `lost_${slotName}`;
    if (!b.permanent.includes(permName)) {
      b.permanent.push(permName);
    }
    // Add grievous cut at stump
    const stumpWound = createWound('cut', 'grievous', maxHp, ctx.tick);
    part.wounds.push(stumpWound);
    woundedSet.add(id);
    ctx.emit({ type: 'LimbLost', id, part: slotName });
    ctx.emit({ type: 'WoundInflicted', id, part: slotName, woundType: 'cut', severity: 'grievous' });
    updatePatient(ctx, id, lastHospitalTier);
    return;
  }

  // Non-destroyed part: create wound
  const wType = woundTypeFor(damageType, amount, maxHp);
  const wound = createWound(wType, sev, amount, ctx.tick);
  if (clean) wound.cleaned = true;
  part.wounds.push(wound);
  woundedSet.add(id);

  const slotName = BODY_SLOTS[partIndex];
  ctx.emit({ type: 'WoundInflicted', id, part: slotName, woundType: wType, severity: sev });

  updatePatient(ctx, id, lastHospitalTier);
}

/**
 * Check creatures for drowning: each health tick while submerged.
 */
function checkSubmersion(
  ctx: TickContext,
  woundedSet: Set<EntityId>,
  lastAttacker: Map<EntityId, EntityId>,
): void {
  const map = ctx.world.map;
  const entities = ctx.world.entities;
  const speciesTable = ctx.registry.table<{ id: string; movementClass: string; size: number }>('creatures');

  for (const id of entities.with(C.Creature, C.Position)) {
    if (!entities.alive(id)) continue;
    const pos = entities.get(id, C.Position);
    if (!pos) continue;
    const tile = map.index(pos.x, pos.y, pos.z);
    if (!map.validIndex(tile)) continue;

    if (map.fluidFrozenAt(tile)) continue;
    if (map.fluidTypeAt(tile) !== FluidType.Water) continue;
    const level = map.fluidLevelAt(tile);
    if (level < FLUID_DEEP_LEVEL) continue;

    const creature = entities.get(id, C.Creature);
    if (!creature) continue;
    const speciesRow = speciesTable.byIndex(creature.species);
    if (!speciesRow) continue;

    if (speciesRow.movementClass === 'aquatic' || speciesRow.movementClass === 'amphibious') continue;
    if (speciesRow.size >= WADE_LARGE_SIZE && level < FLUID_MAX_LEVEL) continue;

    ctx.emit({ type: 'CreatureSubmerged', id, tile });
    applyDamage(ctx, id, 'torso', 'bruise', DROWN_DAMAGE, 0, woundedSet, lastAttacker, 'drowned');
  }
}

/**
 * Run health simulation for one health tick (every 5 ticks).
 */
export function tickHealth(
  ctx: TickContext,
  woundedSet: Set<EntityId>,
  lastAttacker: Map<EntityId, EntityId>,
  lastHospitalTier?: Map<EntityId, number>,
  stunnedUntil?: Map<EntityId, number>,
): void {
  // 1. Submersion environmental check
  checkSubmersion(ctx, woundedSet, lastAttacker);

  // 2. Process wounds and every admitted patient, even after its last wound healed.
  const entities = ctx.world.entities;
  const sortedWounded = Array.from(new Set([...woundedSet, ...entities.with(C.Patient)])).sort((a, b) => a - b);

  for (const id of sortedWounded) {
    if (!entities.alive(id)) {
      woundedSet.delete(id);
      lastAttacker.delete(id);
      continue;
    }
    if (entities.get(id, C.Creature)?.cagedIn) continue;
    const b = entities.get(id, C.Body);
    if (b === undefined) {
      woundedSet.delete(id);
      continue;
    }

    const allWounds = b.parts.flatMap((p) => p.wounds);

    // Sum unbandaged bleeding; a light wound stops bleeding by itself after CLOT_TICKS.
    let bleed = 0;
    for (const w of allWounds) {
      if (w.bleed > 0 && w.severity === 'light' && ctx.tick - w.createdTick >= CLOT_TICKS) w.bleed = 0;
      if (w.bleed > 0 && !w.bandaged) {
        bleed += w.bleed;
      }
    }

    const anyInfected = allWounds.some((w) => w.infected);

    // Apply blood change
    if (bleed > 0) {
      b.blood -= bleed;
    } else if (!anyInfected) {
      b.blood = Math.min(b.maxBlood, b.blood + BLOOD_REGEN_PER_TICK);
    }

    // Pain calculation
    let rawPain = 0;
    for (const w of allWounds) {
      rawPain += w.pain;
    }
    if (anyInfected) rawPain += 10;

    const attrs = entities.get(id, C.Attributes);
    if (attrs !== undefined) {
      b.pain = Math.floor((rawPain * (100 - attrs.wil / 2)) / 100);
    } else {
      b.pain = rawPain;
    }

    // Consciousness
    const wasConscious = b.conscious;
    const unconsciousBloodThreshold = Math.floor((b.maxBlood * BLOOD_UNCONSCIOUS_PERCENT) / 100);
    // 17 § Consciousness: a stun holds it down until its tick (25's daze and blackout).
    const stunEnd = stunnedUntil?.get(id) ?? 0;
    const stunned = ctx.tick < stunEnd;
    if (stunEnd !== 0 && !stunned) stunnedUntil?.delete(id);
    b.conscious = b.pain < PAIN_UNCONSCIOUS && b.blood >= unconsciousBloodThreshold && !stunned;

    if (wasConscious && !b.conscious) {
      ctx.emit({ type: 'CreatureUnconscious', id });
    } else if (!wasConscious && b.conscious) {
      ctx.emit({ type: 'CreatureConscious', id });
    }

    // Death from blood loss
    const deathBloodThreshold = Math.floor((b.maxBlood * BLOOD_DEATH_PERCENT) / 100);
    if (b.blood < deathBloodThreshold) {
      killCreature(ctx, id, 'bled_out', lastAttacker.get(id) ?? 0);
      woundedSet.delete(id);
      lastAttacker.delete(id);
      continue;
    }

    // Healing
    for (let partIdx = 0; partIdx < b.parts.length; partIdx += 1) {
      const part = b.parts[partIdx];
      if (!part || part.destroyed) continue;

      const remainingWounds: Wound[] = [];
      for (const w of part.wounds) {
        if (w.infected && w.curedAt !== undefined && ctx.tick >= w.curedAt) {
          w.infected = false;
          delete w.curedAt;
          ctx.emit({ type: 'InfectionCured', id });
        }
        // Healing rate
        let rate = 100;
        if (w.infected) {
          rate = 0;
        } else if (w.type === 'wasting') {
          // Wasting does not heal while starving
          const needs = entities.get(id, C.Needs);
          if (needs !== undefined && (needs.hunger >= 100 || needs.thirst >= 100)) {
            rate = 0;
          }
        } else if (w.type === 'fracture' && !w.splinted) {
          rate = UNTREATED_FRACTURE_PERCENT;
        }

        if (rate > 0) {
          const sutureMult = w.sutured ? SUTURED_HEAL_PERCENT / 100 : 1;
          w.healRemaining -= 5 * (rate / 100) * sutureMult;
        }

        if (w.healRemaining <= 0) {
          // Wound healed!
          part.hp = Math.min(part.maxHp, part.hp + w.damage);
          if (w.type === 'fracture' && !w.splinted) {
            const slotName = BODY_SLOTS[partIdx];
            const permName = `badly_healed_${slotName}`;
            if (!b.permanent.includes(permName)) {
              b.permanent.push(permName);
            }
          }
        } else {
          remainingWounds.push(w);
        }
      }
      part.wounds = remainingWounds;
    }

    // Check if fully healed and blood restored
    const remainingWoundCount = b.parts.reduce((acc, p) => acc + p.wounds.length, 0);
    if (remainingWoundCount === 0 && b.blood >= b.maxBlood && !stunned) {
      woundedSet.delete(id);
      lastAttacker.delete(id);
    }

    const allWoundsNow = b.parts.flatMap((p) => p.wounds);
    const allLightOrGoneNow = allWoundsNow.every((w) => w.severity === 'light');
    if (allLightOrGoneNow && lastHospitalTier && lastHospitalTier.has(id)) {
      const tier = lastHospitalTier.get(id) ?? 0;
      lastHospitalTier.delete(id);
      ctx.emit({ type: 'PatientHealed', id, hospitalTier: tier });
    }

    updatePatient(ctx, id, lastHospitalTier);
  }
}

/**
 * Handle falling damage: `Fell { id, levels, landedOn }`
 */
export function handleFell(
  event: Record<string, unknown>,
  ctx: TickContext,
  rng: RngStream,
  woundedSet: Set<EntityId>,
  lastAttacker: Map<EntityId, EntityId>,
): void {
  const id = event['id'] as EntityId;
  const levels = (event['levels'] as number) ?? 0;
  if (levels <= 0) return;
  const entities = ctx.world.entities;
  if (!entities.alive(id)) return;
  const b = entities.get(id, C.Body);
  if (b === undefined) return;

  const rawAmount = levels * levels * FALL_DAMAGE_PER_LEVEL_SQ;
  const roll = rng.int(0, 99);

  // 60% leg, 40% torso
  if (roll < 60) {
    const legSlot = roll < 30 ? 'left_leg' : 'right_leg';
    const partIdx = BODY_SLOTS.indexOf(legSlot);
    const leg = b.parts[partIdx];
    if (leg && !leg.destroyed) {
      // Limb damage capped at leg.hp - 1
      const cappedAmount = Math.max(0, Math.min(rawAmount, leg.hp - 1));
      applyDamage(ctx, id, legSlot, 'blunt', cappedAmount, 0, woundedSet, lastAttacker);
    }
  } else {
    applyDamage(ctx, id, 'torso', 'blunt', rawAmount, 0, woundedSet, lastAttacker);
  }
}

/**
 * Handle hourly temperature check for outdoors creatures.
 */
export function handleHourlyTemperature(
  ctx: TickContext,
  rng: RngStream,
  woundedSet: Set<EntityId>,
  lastAttacker: Map<EntityId, EntityId>,
): void {
  const entities = ctx.world.entities;
  const map = ctx.world.map;
  if (!ctx.readers.has('05')) return;
  const materialsReader = ctx.readers.of<{ temperatureAt(tile: TileIndex): number }>('05');

  for (const id of entities.with(C.Creature, C.Position)) {
    if (!entities.alive(id)) continue;
    const pos = entities.get(id, C.Position);
    if (!pos) continue;
    const tile = map.index(pos.x, pos.y, pos.z);
    if (!map.validIndex(tile)) continue;
    if ((map.flagsAt(tile) & TileFlag.Outdoor) === 0) continue;

    const temp = materialsReader.temperatureAt(tile);
    const isHot = temp > HEAT_INJURY_C;
    const isCold = temp < COLD_INJURY_C;
    if (!isHot && !isCold) continue;

    // Clothing halves chance
    const equip = entities.get(id, C.Equipment);
    const hasClothing = equip && Object.values(equip.clothing).some((c) => c !== 0);
    const chance = hasClothing ? 50 : 100;
    if (rng.int(0, 99) >= chance) continue;

    // Random limb
    const limb = LIMB_SLOTS[rng.int(0, LIMB_SLOTS.length - 1)] as BodySlot;
    const damageType = isHot ? 'burn' : 'frost';
    applyDamage(ctx, id, limb, damageType, 5, 0, woundedSet, lastAttacker);
  }
}

/**
 * Handle daily infection check.
 */
export function handleDailyInfection(
  ctx: TickContext,
  rng: RngStream,
  woundedSet: Set<EntityId>,
  lastAttacker: Map<EntityId, EntityId>,
  floorSleepers?: ReadonlySet<EntityId>,
): void {
  const entities = ctx.world.entities;
  const map = ctx.world.map;
  const itemsReader = ctx.readers.has('13')
    ? ctx.readers.of<{ isMiasma(t: TileIndex): boolean }>('13')
    : null;

  for (const id of Array.from(woundedSet)) {
    if (!entities.alive(id)) continue;
    if (entities.get(id, C.Creature)?.cagedIn) continue;
    const b = entities.get(id, C.Body);
    if (b === undefined) continue;

    const pos = entities.get(id, C.Position);
    const tile = pos ? map.index(pos.x, pos.y, pos.z) : -1;
    const inMiasma = tile >= 0 && itemsReader?.isMiasma(tile) === true;
    const sleptOnFloor = floorSleepers?.has(id) === true;

    for (const part of b.parts) {
      for (const w of part.wounds) {
        if (exposed(w) && !w.infected && ctx.tick - w.createdTick >= TICKS_PER_DAY) {
          const permille = (inMiasma || sleptOnFloor) ? INFECTION_PERMILLE * 2 : INFECTION_PERMILLE;
          if (rng.int(0, 999) < permille) {
            w.infected = true;
            w.infectedSince = ctx.tick;
            ctx.emit({ type: 'InfectionStarted', id });
          }
        }
      }
    }

    // Daily death roll for infected creature
    const allWounds = b.parts.flatMap((p) => p.wounds);
    if (allWounds.some((w) => w.infected)) {
      if (rng.int(0, 999) < INFECTION_DEATH_PERMILLE) {
        killCreature(ctx, id, 'infection', lastAttacker.get(id) ?? 0);
      }
    }
  }
}
