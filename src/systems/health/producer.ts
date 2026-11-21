/**
 * Health system job producer: `02-systems/17-health-and-medicine.md` Â§ Registrations,
 * `03-content/jobs.md` Â§ Health, and `04-implementation/algorithms/combat-and-health.md`.
 */

import { C, type Wound } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { EntityStore } from '@core/entities';
import type { Map3D } from '@core/map3d';
import type { Registry } from '@core/registry';
import type { RngStream } from '@core/rng';
import type { JobProducer, TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings/reader';
import type { ItemsReader } from '@systems/items/reader';
import { grantXp } from '@systems/dwarves/skills';
import type { Job, JobSink } from '@systems/jobs';
import {
  DIAGNOSE_XP,
  HEALTH_CADENCE,
  INFECTION_CURE_DAYS,
  TREAT_FAIL_PERMILLE,
  TREAT_TICKS,
  BANDAGE_TICKS,
} from './constants';
import { updatePatient } from './tick';
import { awaitsBandage, needsCleaning, woundTreatmentNeeds } from './wounds';

/** 17 § Patients and hospitals: the honey a medic takes in place of a bucket or a cloth, when they are not to be had. */
const HONEY_FILTER = { category: 'food/honey' } as const;
/** The supply a treatment takes before honey: `clean_wound`'s bucket of water, `dress_burn`'s cloth. */
const REGULAR_SUPPLY: Readonly<Record<string, { readonly category: string }>> = Object.freeze({
  clean_wound: { category: 'container/bucket' },
  dress_burn: { category: 'textile/cloth' },
});

/**
 * 17 § Patients and hospitals: `feed_patient` brings a meal, or any food a dwarf on its feet would
 * eat (10 § Eating and drinking) when no meal is to be had.
 */
const MEAL_FILTER = { category: 'food/meal', edible: true } as const;
const FOOD_FILTER = { edible: true } as const;

/** 17 § Patients and hospitals: the soap `wash_patient` takes. */
const SOAP_FILTER = { category: 'medical/soap' } as const;

/** The treatments a wound asks for (`woundTreatmentNeeds`). */
const WOUND_TREATMENTS = ['stop_bleeding', 'set_bone', 'suture', 'clean_wound', 'dress_burn'];

export interface HealthProducerHost {
  readonly rng: RngStream;
  readonly entities: EntityStore;
  readonly map: Map3D;
  readonly registry: Registry;
  readonly pendingTreatments: Map<EntityId, Set<string>>;
}

export class HealthProducer implements JobProducer {
  readonly id = 'health';

  constructor(private readonly host: HealthProducerHost) {}

  private typeIdOf(job: Job): string {
    return this.host.registry.table<{ id: string }>('jobTypes').idOf(job.type) ?? '';
  }

  /** An infection acquired after planning must bring brightleaf before work completes. */
  canComplete(jobIn: unknown): boolean {
    const job = jobIn as Job;
    if (this.typeIdOf(job) !== 'clean_wound') return true;
    const body = this.host.entities.get(job.target.ref, C.Body);
    const infected = body?.parts.some(part => part.wounds.some(wound => wound.infected && needsCleaning(wound))) ?? false;
    return !infected || job.inputs.some(input => input.filter.category === 'medical/brightleaf' && input.count >= 1);
  }

  workCentiTicks(jobIn: unknown): number | undefined {
    const job = jobIn as Job;
    const typeStr = this.typeIdOf(job);
    switch (typeStr) {
      case 'bandage_animal': {
        const ticks = this.host.registry.table<{ id: string; baseTicks: number | string }>('jobTypes').byIndex(job.type)?.baseTicks;
        return typeof ticks === 'number' ? ticks * 100 : undefined;
      }
      case 'stop_bleeding':
        return BANDAGE_TICKS * 100;
      case 'suture':
      case 'clean_wound':
      case 'dress_burn':
      case 'wash_patient':
        return TREAT_TICKS * 100;
      case 'set_bone':
        return Math.floor(TREAT_TICKS * 1.5) * 100;
      case 'diagnose':
        return Math.floor(TREAT_TICKS / 2) * 100;
      case 'give_crutch':
      case 'water_patient':
        return 30 * 100;
      case 'feed_patient':
        return 40 * 100;
      case 'carry_patient':
        return 10 * 100;
      default:
        return undefined;
    }
  }

  extraStandTiles(jobIn: unknown): readonly TileIndex[] {
    const job = jobIn as Job;
    if (job.target.kind === 'entity') {
      const pos = this.host.entities.get(job.target.ref, C.Position);
      if (pos) {
        return [this.host.map.index(pos.x, pos.y, pos.z)];
      }
    }
    return [];
  }

  produce(ctx: TickContext, sinkIn: unknown): void {
    const sink = sinkIn as JobSink;
    const entities = ctx.world.entities;

    // Chief Medic resolution
    let chiefMedicId: EntityId = 0;
    for (const id of entities.with(C.Title)) {
      if (entities.get(id, C.Title)?.title === 'chief_medic' && entities.alive(id)) {
        chiefMedicId = id;
        break;
      }
    }

    // A failed treatment remains a request even if its target has been discharged. A dwarf with an
    // undressed light burn is not admitted, but the treatments its wounds need are made for it.
    const burned = new Set(ctx.tick % HEALTH_CADENCE !== 0 ? [] : entities.with(C.Attributes, C.Body).filter(id =>
      !entities.has(id, C.Patient) && entities.alive(id) &&
      entities.get(id, C.Body)?.parts.some(p => p.wounds.some(w => w.type === 'burn' && !w.dressed)) === true));
    const targets = new Set([...entities.with(C.Patient), ...this.host.pendingTreatments.keys(), ...burned]);
    // 17 § Patients and hospitals: honey stands in for the bucket and the cloth only when they are not to be had.
    const items = ctx.readers.has('13') ? ctx.readers.of<ItemsReader>('13') : null;
    let honeyLeft = items === null || !ctx.registry.table('items').has('honey') ? 0 : items.countAvailable(HONEY_FILTER);
    const regularOut = new Map<string, boolean>();
    // 17 § Patients and hospitals: a patient is washed once an admission while a soap is to be had, one soap a job.
    let soapLeft: number | null = null;
    const soapToHave = (): number => {
      soapLeft ??= items === null || !ctx.registry.table('items').has('soap') ? 0 : items.countAvailable(SOAP_FILTER);
      return soapLeft;
    };
    // T-664: a patient is fed raw food when no meal is to be had; the meals are counted once a pass.
    let mealsOut: boolean | undefined;
    const noMeal = (): boolean => {
      mealsOut ??= items !== null && items.countAvailable(MEAL_FILTER) === 0 && items.countAvailable(FOOD_FILTER) > 0;
      return mealsOut;
    };
    const byHoney = (need: string): boolean => {
      const regular = REGULAR_SUPPLY[need];
      if (honeyLeft <= 0 || regular === undefined || items === null) return false;
      let out = regularOut.get(need);
      if (out === undefined) {
        out = items.countAvailable(regular) === 0;
        regularOut.set(need, out);
      }
      return out;
    };
    for (const patientId of Array.from(targets).sort((a, b) => a - b)) {
      if (!entities.alive(patientId)) {
        this.host.pendingTreatments.delete(patientId);
        continue;
      }
      const b = entities.get(patientId, C.Body);
      if (!b) { this.host.pendingTreatments.delete(patientId); continue; }
      const patient = entities.get(patientId, C.Patient);
      const previousRetries = Array.from(this.host.pendingTreatments.get(patientId) ?? []).sort();
      const retries = this.refreshRetries(patientId);
      const woundNeeds = burned.has(patientId) ? woundTreatmentNeeds(b.parts.flatMap(part => part.wounds)) : [];
      const treatmentNeeds = Array.from(new Set([...(patient?.needs ?? []), ...retries, ...woundNeeds]));

      if (patient !== undefined) {
        let bedTile = -1;
        if (patient.bedId !== 0 && ctx.readers.has('14')) {
          const bView = ctx.readers.of<BuildingsReader>('14').get(patient.bedId);
          if (bView) bedTile = bView.origin;
        }

        // Unconscious patient: carry to bed if not at bed, once it is bandaged where it lies
        const pos = entities.get(patientId, C.Position);
        const currentTile = pos ? ctx.world.map.index(pos.x, pos.y, pos.z) : -1;
        const carryKey = `carry_patient:${patientId}`;
        if (!b.conscious && bedTile >= 0 && currentTile !== bedTile) {
          if (!sink.exists(carryKey) && !awaitsBandage(ctx.readers, patientId, ctx.tick)) {
            sink.create(carryKey, {
              type: 'carry_patient',
              target: { kind: 'entity', ref: patientId },
              workTile: bedTile,
              priority: 1,
              data: { patient: patientId, bedTile, excludeWorker: patientId },
            });
          }
        } else if (sink.exists(carryKey)) {
          sink.cancelKey(carryKey, 'already_in_bed');
        }

        // Food and water for bedridden / patient
        const needs = entities.get(patientId, C.Needs);
        const feedKey = `feed_patient:${patientId}`;
        const waterKey = `water_patient:${patientId}`;
        if (needs) {
          if (needs.hunger >= 60) {
            // T-664: a job waiting for a meal while none is to be had and other food is gives way
            // to one that takes that food; it is made again on the next pass.
            const fed = sink.byKey(feedKey);
            if (fed !== undefined && fed.state === 'blocked' && fed.blockedReason === 'missing_input' && fed.data['raw'] !== true && noMeal()) {
              sink.cancelKey(feedKey, 'no_meal');
            }
            if (!sink.exists(feedKey)) {
              const raw = noMeal();
              sink.create(feedKey, {
                type: 'feed_patient',
                target: { kind: 'entity', ref: patientId },
                workTile: 'adjacent',
                priority: 2,
                inputs: [{ filter: { ...(raw ? FOOD_FILTER : MEAL_FILTER) }, count: 1 }],
                data: { patient: patientId, excludeWorker: patientId, ...(raw ? { raw: true } : {}) },
              });
            }
          } else if (sink.exists(feedKey)) {
            sink.cancelKey(feedKey, 'not_hungry');
          }

          if (needs.thirst >= 60) {
            if (!sink.exists(waterKey)) {
              sink.create(waterKey, {
                type: 'water_patient',
                target: { kind: 'entity', ref: patientId },
                workTile: 'adjacent',
                priority: 2,
                inputs: [
                  {
                    filter: {
                      category: 'drink',
                    },
                    count: 1,
                  },
                ],
                data: { patient: patientId, excludeWorker: patientId },
              });
            }
          } else if (sink.exists(waterKey)) {
            sink.cancelKey(waterKey, 'not_thirsty');
          }
        }

        const washKey = `wash_patient:${patientId}`;
        if (patient.washed !== true && !sink.exists(washKey) && soapToHave() > 0) {
          soapLeft = soapToHave() - 1;
          sink.create(washKey, {
            type: 'wash_patient',
            target: { kind: 'entity', ref: patientId },
            workTile: 'adjacent',
            priority: 3,
            inputs: [{ filter: { ...SOAP_FILTER }, count: 1 }],
            data: { patient: patientId, inputUnits: true, excludeWorker: patientId },
          });
        }

      }

      // Needs list
      for (const need of treatmentNeeds) {
        const key = `${need}:${patientId}`;
        const existing = sink.byKey(key);
        if (existing && need === 'clean_wound' && !this.canComplete(existing)) {
          sink.cancelKey(key, 'infection_requires_brightleaf');
        } else if (existing && existing.workerId === 0 && existing.data['honey'] !== true && byHoney(need)) {
          // A waiting treatment with no bucket or cloth to be had takes honey instead.
          sink.cancelKey(key, 'honey_in_place');
        }
        if (sink.exists(key)) continue;

        switch (need) {
          case 'stop_bleeding':
            sink.create(key, {
              type: 'stop_bleeding',
              target: { kind: 'entity', ref: patientId },
              workTile: 'adjacent',
              priority: 1,
              inputs: [
                {
                  filter: {
                    category: 'textile/cloth',
                  },
                  count: 1,
                },
              ],
              data: { patient: patientId, inputUnits: true, excludeWorker: patientId },
            });
            break;
          case 'set_bone':
            sink.create(key, {
              type: 'set_bone',
              target: { kind: 'entity', ref: patientId },
              workTile: 'adjacent',
              priority: 2,
              inputs: [
                {
                  filter: {
                    category: 'medical/splint',
                  },
                  count: 1,
                },
              ],
              data: { patient: patientId, inputUnits: true, excludeWorker: patientId },
            });
            break;
          case 'suture':
            sink.create(key, {
              type: 'suture',
              target: { kind: 'entity', ref: patientId },
              workTile: 'adjacent',
              priority: 3,
              inputs: [
                {
                  filter: {
                    category: 'textile/thread',
                  },
                  count: 1,
                },
              ],
              data: { patient: patientId, inputUnits: true, excludeWorker: patientId },
            });
            break;
          case 'clean_wound': {
            const anyInfected = b.parts.some((p) => p.wounds.some((w) => w.infected && needsCleaning(w)));
            const inputs: { filter: Record<string, unknown>; count: number }[] = anyInfected
              ? [
                  {
                    filter: {
                      category: 'medical/brightleaf',
                    },
                    count: 1,
                  },
                ]
              : [];
            // A fortress with no bucket cleans its wounds with honey: no tool, a honey as an input.
            const honey = byHoney(need);
            if (honey) {
              inputs.push({ filter: { ...HONEY_FILTER }, count: 1 });
              honeyLeft -= 1;
            }
            sink.create(key, {
              type: 'clean_wound',
              target: { kind: 'entity', ref: patientId },
              workTile: 'adjacent',
              priority: 3,
              inputs,
              ...(honey ? { tool: null } : {}),
              data: { patient: patientId, inputUnits: true, excludeWorker: patientId, ...(honey ? { honey: true } : {}) },
            });
            break;
          }
          case 'dress_burn': {
            // Cloth first; honey when no cloth is to be had, and a honeyed burn is cleaned as well.
            const honey = byHoney(need);
            if (honey) honeyLeft -= 1;
            sink.create(key, {
              type: 'dress_burn',
              target: { kind: 'entity', ref: patientId },
              workTile: 'adjacent',
              priority: 3,
              inputs: [
                {
                  filter: honey ? { ...HONEY_FILTER } : {
                    category: 'textile/cloth',
                  },
                  count: 1,
                },
              ],
              data: { patient: patientId, inputUnits: true, excludeWorker: patientId, ...(honey ? { honey: true } : {}) },
            });
            break;
          }
          case 'diagnose': {
            const data: Record<string, unknown> = { patient: patientId, excludeWorker: patientId };
            if (chiefMedicId !== 0) {
              data['assignedWorker'] = chiefMedicId;
            }
            sink.create(key, {
              type: 'diagnose',
              target: { kind: 'entity', ref: patientId },
              workTile: 'adjacent',
              priority: 4,
              data,
            });
            break;
          }
          case 'give_crutch':
            sink.create(key, {
              type: 'give_crutch',
              target: { kind: 'entity', ref: patientId },
              workTile: 'adjacent',
              priority: 5,
              inputs: [
                {
                  filter: {
                    category: 'tool/crutch',
                  },
                  count: 1,
                },
              ],
              data: { patient: patientId },
            });
            break;
        }
      }

      // Clean up jobs whose need is no longer present
      const allTreatmentTypes = [
        'stop_bleeding',
        'set_bone',
        'suture',
        'clean_wound',
        'dress_burn',
        'diagnose',
        'give_crutch',
      ];
      // Outside admission, manage only failed requests; other existing care is untouched.
      for (const t of patient === undefined ? previousRetries : allTreatmentTypes) {
        if (!treatmentNeeds.includes(t)) {
          const key = `${t}:${patientId}`;
          if (sink.exists(key)) sink.cancelKey(key, 'need_cleared');
        }
      }
    }

    // Outside admission a treatment job made earlier ends once no wound needs it, even under way, and
    // `diagnose` once no wound remains. A failed request stays a need while its wound needs it
    // (above); `give_crutch` outlives discharge. Every dwarf is looked at, the healed too.
    if (ctx.tick % HEALTH_CADENCE === 0) {
      for (const id of entities.with(C.Attributes, C.Body).sort((a, b) => a - b)) {
        if (entities.has(id, C.Patient) || !entities.alive(id)) continue;
        // A wash belongs to its admission: discharged, the dwarf is washed no more.
        if (sink.exists(`wash_patient:${id}`)) sink.cancelKey(`wash_patient:${id}`, 'need_cleared');
        const keys = [...WOUND_TREATMENTS, 'diagnose'].filter(kind => sink.exists(`${kind}:${id}`));
        if (keys.length === 0) continue;
        const wounds = entities.get(id, C.Body)?.parts.flatMap(part => part.wounds) ?? [];
        const needs = woundTreatmentNeeds(wounds);
        for (const kind of keys) {
          const done = kind === 'diagnose' ? wounds.length === 0 || entities.get(id, C.Body)?.diagnosed === true : !needs.includes(kind);
          if (done) sink.cancelKey(`${kind}:${id}`, 'need_cleared');
        }
      }
    }

    // Tame animals: bandaging only.
    for (const animalId of entities.with(C.Tame, C.Body)) {
      // A summon is no animal to tend (25 § Summons).
      if (!entities.alive(animalId) || entities.has(animalId, C.Summoned)) continue;
      const ab = entities.get(animalId, C.Body);
      if (!ab) continue;
      const isBleeding = ab.parts.some((p) => p.wounds.some((w) => w.bleed > 0 && !w.bandaged));
      const key = `bandage_animal:${animalId}`;
      if (isBleeding) {
        if (!sink.exists(key)) {
          sink.create(key, {
            type: 'bandage_animal',
            target: { kind: 'entity', ref: animalId },
            workTile: 'adjacent',
            priority: 1,
            inputs: [
              {
                filter: {
                  category: 'textile/cloth',
                },
                count: 1,
              },
            ],
            data: { labor: 'animal_care', patient: animalId, inputUnits: true },
          });
        }
      } else if (sink.exists(key)) {
        sink.cancelKey(key, 'healed');
      }
    }
  }

  onComplete(jobIn: unknown, ctx: TickContext): void {
    const job = jobIn as Job;
    const patientId = job.data['patient'] as EntityId;
    if (typeof patientId !== 'number' || !ctx.world.entities.alive(patientId)) {
      this.consumeDelivered(job, ctx);
      return;
    }

    const typeStr = this.typeIdOf(job);
    // A bandage on a dwarf does not fail (§ Patients and hospitals); the other treatments can.
    const canFail = [
      'bandage_animal',
      'set_bone',
      'suture',
      'clean_wound',
      'dress_burn',
    ].includes(typeStr);

    if (canFail) {
      const skills = ctx.world.entities.get(job.workerId, C.Skills);
      const skillDef = ctx.registry.table<{ id: string }>('skills');
      const isAnimalCare = job.data['labor'] === 'animal_care';
      const skillId = isAnimalCare ? 'animal_care' : 'medicine';
      const skillIdx = skillDef.index(skillId);
      const skillLevel = skills && skillIdx > 0 ? skills.level[skillIdx] ?? 0 : 0;
      const failPermille = Math.max(0, TREAT_FAIL_PERMILLE - skillLevel * 10);
      const roll = this.host.rng.int(0, 999);
      if (roll < failPermille) {
        // Failed: consume inputs without effect
        this.consumeDelivered(job, ctx);
        const body = this.host.entities.get(patientId, C.Body);
        if (this.host.entities.has(patientId, C.Attributes) && body !== undefined &&
            woundTreatmentNeeds(body.parts.flatMap(part => part.wounds)).includes(typeStr)) {
          let pending = this.host.pendingTreatments.get(patientId);
          if (pending === undefined) {
            pending = new Set(); this.host.pendingTreatments.set(patientId, pending);
          }
          pending.add(typeStr);
        }
        updatePatient(ctx, patientId);
        return;
      }
    }

    // Success: apply treatment effects
    switch (typeStr) {
      case 'carry_patient': {
        const bedTile = job.data['bedTile'] as TileIndex;
        if (typeof bedTile === 'number' && bedTile >= 0) {
          const pos = ctx.world.map.unpack(bedTile);
          ctx.world.entities.add(patientId, C.Position, { x: pos.x, y: pos.y, z: pos.z });
        }
        break;
      }
      case 'feed_patient': {
        this.consumeDelivered(job, ctx);
        const needs = ctx.world.entities.get(patientId, C.Needs);
        if (needs) {
          needs.hunger = 0;
        }
        break;
      }
      case 'water_patient': {
        this.consumeDelivered(job, ctx);
        const needs = ctx.world.entities.get(patientId, C.Needs);
        if (needs) {
          needs.thirst = 0;
        }
        break;
      }
      case 'bandage_animal': {
        this.consumeDelivered(job, ctx);
        const body = ctx.world.entities.get(patientId, C.Body);
        if (body !== undefined) for (const part of body.parts) for (const wound of part.wounds) {
          if (wound.bleed > 0 && !wound.bandaged) {
            wound.bandaged = true;
            wound.bleed = 0;
          }
        }
        ctx.emit({ type: 'TreatmentDone', patientId, medicId: job.workerId, kind: 'bandage_animal' });
        break;
      }
      case 'stop_bleeding': {
        // 17 Â§ Patients: "1 `cloth` â†’ every bleeding wound `bandaged`"; bandaging sets bleed 0.
        this.consumeDelivered(job, ctx);
        const b = ctx.world.entities.get(patientId, C.Body);
        if (b) for (const p of b.parts) for (const w of p.wounds) {
          if (w.bleed > 0 && !w.bandaged) {
            w.bandaged = true;
            w.bleed = 0;
          }
        }
        ctx.emit({ type: 'TreatmentDone', patientId, medicId: job.workerId, kind: 'stop_bleeding' });
        break;
      }
      case 'set_bone': {
        this.consumeDelivered(job, ctx);
        const b = ctx.world.entities.get(patientId, C.Body);
        if (b) {
          for (const p of b.parts) {
            const w = p.wounds.find((wnd) => wnd.type === 'fracture' && !wnd.splinted);
            if (w) {
              w.splinted = true;
              break;
            }
          }
        }
        ctx.emit({ type: 'TreatmentDone', patientId, medicId: job.workerId, kind: 'set_bone' });
        break;
      }
      case 'suture': {
        this.consumeDelivered(job, ctx);
        const b = ctx.world.entities.get(patientId, C.Body);
        if (b) {
          for (const p of b.parts) {
            const w = p.wounds.find(
              (wnd) =>
                (wnd.type === 'cut' || wnd.type === 'puncture') &&
                (wnd.severity === 'serious' || wnd.severity === 'grievous') &&
                !wnd.sutured,
            );
            if (w) {
              w.sutured = true;
              break;
            }
          }
        }
        ctx.emit({ type: 'TreatmentDone', patientId, medicId: job.workerId, kind: 'suture' });
        break;
      }
      case 'clean_wound': {
        this.consumeDelivered(job, ctx);
        const b = ctx.world.entities.get(patientId, C.Body);
        if (b) {
          let targetWound: Wound | undefined;
          for (const p of b.parts) {
            targetWound = p.wounds.find((wnd) => wnd.infected && needsCleaning(wnd));
            if (targetWound) break;
          }
          if (!targetWound) {
            for (const p of b.parts) {
              targetWound = p.wounds.find(needsCleaning);
              if (targetWound) break;
            }
          }
          if (targetWound) {
            targetWound.cleaned = true;
            if (targetWound.infected) {
              targetWound.curedAt = ctx.tick + INFECTION_CURE_DAYS * TICKS_PER_DAY;
            }
          }
        }
        ctx.emit({ type: 'TreatmentDone', patientId, medicId: job.workerId, kind: 'clean_wound' });
        break;
      }
      case 'dress_burn': {
        this.consumeDelivered(job, ctx);
        const b = ctx.world.entities.get(patientId, C.Body);
        if (b) {
          for (const p of b.parts) {
            const w = p.wounds.find((wnd) => wnd.type === 'burn' && !wnd.dressed);
            if (w) {
              w.dressed = true;
              w.pain = Math.floor(w.pain / 2);
              // 17 § Patients and hospitals: a burn dressed with honey is cleaned too, never rolled for infection.
              if (job.data['honey'] === true) w.cleaned = true;
              break;
            }
          }
        }
        ctx.emit({ type: 'TreatmentDone', patientId, medicId: job.workerId, kind: 'dress_burn' });
        break;
      }
      case 'diagnose': {
        const b = ctx.world.entities.get(patientId, C.Body);
        if (b) {
          b.diagnosed = true;
        }
        ctx.emit({ type: 'TreatmentDone', patientId, medicId: job.workerId, kind: 'diagnose' });
        break;
      }
      case 'wash_patient': {
        // 17 § Patients and hospitals: a washed patient has no wound rolled for infection this admission.
        this.consumeDelivered(job, ctx);
        const admitted = ctx.world.entities.get(patientId, C.Patient);
        if (admitted !== undefined) ctx.world.entities.add(patientId, C.Patient, { ...admitted, washed: true });
        ctx.emit({ type: 'TreatmentDone', patientId, medicId: job.workerId, kind: 'wash_patient' });
        break;
      }
      case 'give_crutch': {
        const crutchId = job.inputs[0]?.delivered[0] ?? 0;
        if (crutchId !== 0) {
          const items = ctx.world.services.items;
          if (items) {
            items.attachToCarrier(crutchId, patientId);
            items.setOwner(crutchId, patientId);
          }
          const worker = ctx.world.entities.get(patientId, C.Worker);
          if (worker) {
            worker.toolId = crutchId;
          } else {
            const equip = ctx.world.entities.get(patientId, C.Equipment);
            if (equip) equip.weapon = crutchId;
          }
        }
        ctx.emit({ type: 'TreatmentDone', patientId, medicId: job.workerId, kind: 'give_crutch' });
        break;
      }
    }

    if (WOUND_TREATMENTS.includes(typeStr)) this.diagnoseByTreatment(ctx, patientId, job.workerId);
    updatePatient(ctx, patientId);
    this.refreshRetries(patientId);
  }

  /**
   * The medic who diagnoses (the Chief Medic, or any medic when there is none) diagnoses an
   * undiagnosed dwarf while treating it: the treatment does what `diagnose` does.
   */
  private diagnoseByTreatment(ctx: TickContext, patientId: EntityId, medicId: EntityId): void {
    const entities = ctx.world.entities;
    const body = entities.get(patientId, C.Body);
    if (body === undefined || body.diagnosed || !entities.has(patientId, C.Attributes)) return;
    const chief = entities.with(C.Title).find(id => entities.alive(id) && entities.get(id, C.Title)?.title === 'chief_medic') ?? 0;
    if (chief !== 0 && chief !== medicId) return;
    body.diagnosed = true;
    grantXp(entities, ctx.registry, medicId, 'medicine', DIAGNOSE_XP, (e) => ctx.emit(e));
    ctx.emit({ type: 'TreatmentDone', patientId, medicId, kind: 'diagnose' });
  }

  private refreshRetries(patientId: EntityId): string[] {
    const pending = this.host.pendingTreatments.get(patientId);
    if (pending === undefined) return [];
    const body = this.host.entities.get(patientId, C.Body);
    const needs = body === undefined || !this.host.entities.alive(patientId)
      ? [] : woundTreatmentNeeds(body.parts.flatMap(part => part.wounds));
    for (const kind of pending) if (!needs.includes(kind)) pending.delete(kind);
    if (pending.size === 0) this.host.pendingTreatments.delete(patientId);
    return needs.filter(kind => pending.has(kind));
  }

  private consumeDelivered(job: Job, ctx: TickContext): void {
    const items = ctx.world.services.items;
    for (const inp of job.inputs) {
      for (const it of inp.delivered) {
        if (items) {
          items.consume(it, 1);
        } else {
          ctx.world.entities.destroy(it);
        }
      }
    }
  }
}
