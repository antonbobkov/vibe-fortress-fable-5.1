/**
 * The spawn API: `01-architecture/module-interfaces.md` § The spawn API ("create entities with
 * every component the data model requires for that kind. This keeps component invariants in one
 * place") and `schemas/components.md` § Component ownership.
 *
 * `creature` builds `Kind`, `Position` (through the movement helper, so the spatial index and the
 * tick's move batch see it), `Creature`, `Motion` and `Body` for every creature; a dwarf also gets
 * the components 10 owns, handed over by its creator (02, 21) as `overrides.dwarf`, and 11's
 * `Labors` and `Worker`; a wild creature gets 08's `Wild`. `item` is a stub until the item system
 * (T-M2-01): it records the intended item and creates no entity (DECISIONS.md D-060).
 */

import {
  C,
  type Attributes,
  type Body,
  type BodyPart,
  type Brain,
  type Needs,
  type Personality,
  type Relationships,
  type Schedule,
  type Skills,
  type Title,
} from './components';
import type { EntityStore } from './entities';
import type { Map3D } from './map3d';
import type { Registry } from './registry';
import type { MovementApi, SpawnApi } from './system';
import type { EntityId, MovementClass, Tick, TileIndex } from './types';
import { BODY_SLOTS } from './types';

/** The components 10 owns, as the creator of a dwarf hands them to the spawn API. */
export interface DwarfParts {
  readonly attributes: Attributes;
  readonly skills: Skills;
  readonly needs: Needs;
  readonly personality: Personality;
  readonly schedule: Schedule;
  readonly relationships: Relationships;
  readonly title: Title;
  readonly brain: Brain;
}

/** The overrides `creature` understands. */
export interface CreatureOverrides {
  readonly name?: string;
  readonly sex?: 0 | 1;
  readonly ageTicks?: number;
  /** A dwarf: 10's components (`dwarfComponents` of `systems/dwarves`). */
  readonly dwarf?: DwarfParts;
  /** For a dwarf: true when a child (`hauling` is then its only labor, fixed; 11 § Labors). */
  readonly child?: boolean;
}

/** An item the spawn API was asked for before items exist. */
export interface IntendedItem {
  readonly type: number;
  readonly material: number;
  readonly at: TileIndex | { containerId: EntityId };
  readonly count: number;
  readonly quality: number;
  readonly tick: Tick;
}

interface SpeciesRow {
  readonly id: string;
  readonly plan: string;
  readonly size: number;
  readonly speed: number;
  readonly movementClass: MovementClass;
}

interface PlanRow {
  readonly id: string;
  readonly parts: Readonly<Record<string, { readonly hpFactor: number }>>;
}

interface LaborRow {
  readonly id: string;
  readonly children: boolean;
}

/** `17` § Concepts: `maxHp(part) = size × partHpFactor(bodyPlan, part)`, the factor in thousandths. */
export function partMaxHp(size: number, hpFactor: number): number {
  return Math.floor((size * hpFactor) / 1000);
}

/** A `Body` from the plan: every part at full hp, no wounds (T-M1-11: "hp only"). */
export function bodyFor(plan: PlanRow, size: number): Body {
  const parts: BodyPart[] = BODY_SLOTS.map((slot) => {
    const hp = partMaxHp(size, plan.parts[slot]?.hpFactor ?? 0);
    return { hp, maxHp: hp, wounds: [], destroyed: false };
  });
  // Blood is 17's (`maxBlood` needs its `BLOOD_PER_SIZE`); it is filled when 17 arrives (D-060).
  return { parts, blood: 0, maxBlood: 0, pain: 0, conscious: true, permanent: [], diagnosed: false };
}

export class CoreSpawn implements SpawnApi {
  /** Items asked for before the item system exists, in order (D-060). */
  readonly intendedItems: IntendedItem[] = [];

  constructor(
    private readonly map: Map3D,
    private readonly entities: EntityStore,
    private readonly registry: Registry,
    private readonly movement: MovementApi,
    private readonly now: () => Tick,
  ) {}

  creature(species: number, at: TileIndex, faction: string, overridesIn?: Readonly<Record<string, unknown>>): EntityId {
    const overrides = (overridesIn ?? {}) as CreatureOverrides;
    const row = this.registry.table<SpeciesRow>('creatures').byIndex(species);
    if (row === undefined) throw new RangeError(`spawn.creature: unknown species index ${species}`);
    if (!this.map.validIndex(at)) throw new RangeError(`spawn.creature: tile out of range ${at}`);
    const plans = this.registry.table<PlanRow>('bodyPlans');
    const plan = plans.byId(row.plan);
    if (plan === undefined) throw new RangeError(`spawn.creature: species ${row.id} has no body plan ${row.plan}`);
    const e = this.entities;
    const id = e.create('creature');
    e.add(id, C.Creature, {
      species,
      name: overrides.name ?? row.id,
      sex: overrides.sex ?? 0,
      // A creature the creator gives no age starts at 0 and ages from its spawn (D-060).
      ageTicks: overrides.ageTicks ?? 0,
      faction,
      sizeClass: row.size,
      bodyPlan: plans.index(row.plan),
    });
    e.add(id, C.Motion, {
      pathId: 0,
      stepIndex: 0,
      progress: 0,
      speed: row.speed,
      movementClass: row.movementClass,
      repathCount: 0,
      waitUntil: 0,
    });
    e.add(id, C.Body, bodyFor(plan, row.size));
    const dwarf = overrides.dwarf;
    if (dwarf !== undefined) {
      e.add(id, C.Attributes, { ...dwarf.attributes });
      e.add(id, C.Skills, { level: dwarf.skills.level.slice(), xp: dwarf.skills.xp.slice(), lastRaised: dwarf.skills.lastRaised });
      e.add(id, C.Needs, { ...dwarf.needs });
      e.add(id, C.Personality, { traits: [...dwarf.personality.traits] as Personality['traits'] });
      e.add(id, C.Schedule, { ...dwarf.schedule });
      e.add(id, C.Relationships, {
        friends: dwarf.relationships.friends.slice(),
        grudges: dwarf.relationships.grudges.map((g) => ({ ...g })),
        talkCount: dwarf.relationships.talkCount.map((t) => [t[0], t[1]] as [EntityId, number]),
        spouse: dwarf.relationships.spouse,
        pets: dwarf.relationships.pets.slice(),
      });
      e.add(id, C.Title, { ...dwarf.title });
      e.add(id, C.Brain, { ...dwarf.brain });
      e.add(id, C.Labors, { enabled: this.labors(overrides.child === true) });
      e.add(id, C.Worker, { jobId: 0, phase: 0, carrying: 0, toolId: 0 });
    }
    if (faction === 'wild') {
      e.add(id, C.Wild, { state: 'idle', homeChunk: this.map.chunkOf(at), stateUntil: 0, hungry: false, lastThinkTick: 0, arrivedTick: this.now() });
    }
    this.movement.teleport(id, at);
    return id;
  }

  /** `02` § Arrival step 5: "all labors enabled"; a child has `hauling` only (`11` § Labors). */
  private labors(child: boolean): Uint8Array {
    const table = this.registry.table<LaborRow>('labors');
    const enabled = new Uint8Array((table.size >> 3) + 1);
    for (let k = 1; k <= table.size; k += 1) {
      if (child && (table.byIndex(k) as LaborRow).children !== true) continue;
      enabled[k >> 3] = (enabled[k >> 3] as number) | (1 << (k & 7));
    }
    return enabled;
  }

  /** The stub of T-M2-01: record the item; there is no entity yet (returns 0). */
  item(type: number, material: number, at: TileIndex | { containerId: EntityId }, count = 1, quality = 1): EntityId {
    this.intendedItems.push({ type, material, at, count, quality, tick: this.now() });
    return 0;
  }
}
