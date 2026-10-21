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
import type { Job, JobSink } from '@systems/jobs';
import {
  INFECTION_CURE_DAYS,
  TREAT_FAIL_PERMILLE,
  TREAT_TICKS,
} from './constants';
import { updatePatient } from './tick';
import { awaitsBandage, needsCleaning, woundTreatmentNeeds } from './wounds';

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
      case 'suture':
      case 'clean_wound':
      case 'dress_burn':
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

    // A failed treatment remains a request even if its target has been discharged.
    const targets = new Set([...entities.with(C.Patient), ...this.host.pendingTreatments.keys()]);
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
      const treatmentNeeds = Array.from(new Set([...(patient?.needs ?? []), ...retries]));

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
              data: { patient: patientId, bedTile },
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
            if (!sink.exists(feedKey)) {
              sink.create(feedKey, {
                type: 'feed_patient',
                target: { kind: 'entity', ref: patientId },
                workTile: 'adjacent',
                priority: 2,
                inputs: [
                  {
                    filter: {
                      category: 'food/meal',
                    },
                    count: 1,
                  },
                ],
                data: { patient: patientId },
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
                data: { patient: patientId },
              });
            }
          } else if (sink.exists(waterKey)) {
            sink.cancelKey(waterKey, 'not_thirsty');
          }
        }

      }

      // Needs list
      for (const need of treatmentNeeds) {
        const key = `${need}:${patientId}`;
        const existing = sink.byKey(key);
        if (existing && need === 'clean_wound' && !this.canComplete(existing)) {
          sink.cancelKey(key, 'infection_requires_brightleaf');
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
              data: { patient: patientId, inputUnits: true },
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
              data: { patient: patientId, inputUnits: true },
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
              data: { patient: patientId, inputUnits: true },
            });
            break;
          case 'clean_wound': {
            const anyInfected = b.parts.some((p) => p.wounds.some((w) => w.infected && needsCleaning(w)));
            const inputs = anyInfected
              ? [
                  {
                    filter: {
                      category: 'medical/brightleaf',
                    },
                    count: 1,
                  },
                ]
              : [];
            sink.create(key, {
              type: 'clean_wound',
              target: { kind: 'entity', ref: patientId },
              workTile: 'adjacent',
              priority: 3,
              inputs,
              data: { patient: patientId, inputUnits: true },
            });
            break;
          }
          case 'dress_burn':
            sink.create(key, {
              type: 'dress_burn',
              target: { kind: 'entity', ref: patientId },
              workTile: 'adjacent',
              priority: 3,
              inputs: [
                {
                  filter: {
                    category: 'textile/cloth',
                  },
                  count: 1,
                },
              ],
              data: { patient: patientId, inputUnits: true },
            });
            break;
          case 'diagnose': {
            const data: Record<string, unknown> = { patient: patientId };
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

    // Tame animals: bandaging only.
    for (const animalId of entities.with(C.Tame, C.Body)) {
      if (!entities.alive(animalId)) continue;
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

    updatePatient(ctx, patientId);
    this.refreshRetries(patientId);
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
