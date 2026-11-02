/**
 * The `attune` job: `02-systems/25-runecraft.md` § The sanctum and `03-content/jobs.md` § Magic.
 *
 * For each sanctum with a built circle, each apprentice below `runecraft` 20 with sessions left
 * today and a glowcap in stock gets one job under the key `attune:<dwarfId>`, which only that dwarf
 * may take. At completion the glowcap is consumed, the xp is granted (the row's is 0), the session
 * is counted and the mishap is rolled on stream 25.
 */

import { C } from '@core/components';
import { SKILL_MAX_LEVEL } from '@core/constants';
import type { RngStream } from '@core/rng';
import type { JobProducer, TickContext } from '@core/system';
import { BODY_SLOTS, type EntityId, type TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings/reader';
import { grantXp } from '@systems/dwarves/skills';
import type { ItemsReader } from '@systems/items';
import type { Job, JobSink } from '@systems/jobs';
import type { MaterialsReader } from '@systems/materials/reader';
import {
  ATTUNE_SESSIONS_PER_DAY,
  ATTUNE_TICKS,
  MISHAP_BLACKOUT_TICKS,
  MISHAP_SURGE_RADIUS,
} from './constants';
import { rollMishap, sessionXp, skillLevel, type MishapKind } from './rune';
import type { MishapRecord } from './state';

const KEY_PREFIX = 'attune:';
const CIRCLE_TAG = 'rune_circle';
const ATTUNE_PRIORITY = 5;
/** `BODY_SLOTS` positions of the two arms. */
const ARMS: readonly number[] = [BODY_SLOTS.indexOf('left_arm'), BODY_SLOTS.indexOf('right_arm')];

/** What the producer reads from and tells system 25. */
export interface MagicHost {
  readonly rng: RngStream;
  sweepDue: boolean;
  sanctumZones(): EntityId[];
  apprenticesOf(zoneId: EntityId): EntityId[];
  sessionsOf(id: EntityId): number;
  countSession(id: EntityId): void;
  noteMishap(zoneId: EntityId, record: MishapRecord): void;
}

interface Wanted {
  readonly dwarf: EntityId;
  readonly circle: EntityId;
  readonly zoneId: EntityId;
  readonly anchor: TileIndex;
}

export class MagicProducer implements JobProducer {
  readonly id = 'magic';

  constructor(private readonly host: MagicHost) {}

  workCentiTicks(): number {
    return ATTUNE_TICKS * 100;
  }

  /** The built rune circle of a sanctum with the lowest id, or 0. */
  private circleOf(b: BuildingsReader, zoneId: EntityId): EntityId {
    const tiles = new Set(b.zone(zoneId)?.tiles ?? []);
    for (const id of b.byTag(CIRCLE_TAG)) {
      const circle = b.get(id);
      if (circle?.state === 'built' && circle.footprint.some((t) => tiles.has(t))) return id;
    }
    return 0;
  }

  produce(ctx: TickContext, sinkIn: unknown): void {
    const sink = sinkIn as JobSink;
    const zones = this.host.sanctumZones();
    if (zones.length === 0 && !this.host.sweepDue) return;
    if (!ctx.readers.has('14')) return;
    const b = ctx.readers.of<BuildingsReader>('14');
    const runecraft = ctx.registry.table('skills').index('runecraft');
    const wanted = new Map<string, Wanted>();
    for (const zoneId of zones) {
      const circle = this.circleOf(b, zoneId);
      if (circle === 0) continue;
      const anchor = b.get(circle)?.origin ?? -1;
      for (const dwarf of this.host.apprenticesOf(zoneId)) {
        const key = `${KEY_PREFIX}${dwarf}`;
        if (wanted.has(key)) continue;
        const level = (ctx.world.entities.get(dwarf, C.Skills)?.level[runecraft] ?? 0) as number;
        if (level >= SKILL_MAX_LEVEL || this.host.sessionsOf(dwarf) >= ATTUNE_SESSIONS_PER_DAY) continue;
        wanted.set(key, { dwarf, circle, zoneId, anchor });
      }
    }
    if (this.host.sweepDue) {
      this.host.sweepDue = false;
      // A job whose dwarf, circle or sanctum went away, or whose dwarf is done for the day, goes.
      for (const id of ctx.world.entities.with(C.Labors)) {
        const key = `${KEY_PREFIX}${id}`;
        const job = sink.byKey(key);
        if (job === undefined) continue;
        const want = wanted.get(key);
        if (want === undefined || want.circle !== job.target.ref) sink.cancelKey(key, 'target_invalid');
      }
    }
    if (wanted.size === 0 || !ctx.readers.has('13')) return;
    let glowcap = ctx.readers.of<ItemsReader>('13').available('glowcap');
    const glowcapType = ctx.registry.table('items').index('glowcap');
    for (const [key, want] of wanted) {
      if (sink.exists(key)) continue;
      if (glowcap <= 0) break;
      glowcap -= 1;
      sink.create(key, {
        type: 'attune',
        target: { kind: 'building', ref: want.circle },
        workTile: 'adjacent',
        priority: ATTUNE_PRIORITY,
        inputs: [{ filter: { type: glowcapType }, count: 1 }],
        data: { assignedWorker: want.dwarf, labor: 'attunement', skill: 'runecraft', inputUnits: true, anchorTile: want.anchor, zoneId: want.zoneId },
      });
    }
  }

  onComplete(jobIn: unknown, ctx: TickContext): void {
    const job = jobIn as Job;
    const items = ctx.world.services.items;
    for (const input of job.inputs) for (const it of input.delivered) {
      if (items !== null) items.consume(it, 1);
      else ctx.world.entities.destroy(it);
    }
    const dwarf = job.workerId;
    const entities = ctx.world.entities;
    if (!entities.alive(dwarf) || !ctx.readers.has('14')) return;
    const b = ctx.readers.of<BuildingsReader>('14');
    const zoneId = typeof job.data['zoneId'] === 'number' ? job.data['zoneId'] as EntityId : 0;
    const circle = job.target.ref;
    const tier = b.room(zoneId)?.tier ?? 0;
    const level = skillLevel(entities, ctx.registry, dwarf, 'runecraft');
    const xp = sessionXp(tier, entities.get(dwarf, C.Attributes)?.wit ?? 0);
    const kind = rollMishap(this.host.rng, level, tier);
    this.host.countSession(dwarf);
    const emit = (e: Parameters<TickContext['emit']>[0]): void => ctx.emit(e);
    grantXp(entities, ctx.registry, dwarf, 'runecraft', xp, emit);
    let granted = xp;
    if (kind === 'surge') {
      grantXp(entities, ctx.registry, dwarf, 'runecraft', xp, emit);
      granted += xp;
    }
    if (kind !== null) this.mishap(kind, dwarf, circle, zoneId, ctx);
    ctx.emit({ type: 'AttuneSession', id: dwarf, xp: granted, mishap: kind ?? '' });
  }

  /** § The sanctum, Mishaps: none kills, takes a limb or touches a stockpile. */
  private mishap(kind: MishapKind, dwarf: EntityId, circle: EntityId, zoneId: EntityId, ctx: TickContext): void {
    const map = ctx.world.map;
    const origin = ctx.readers.of<BuildingsReader>('14').get(circle)?.origin ?? -1;
    this.host.noteMishap(zoneId, { kind, dwarfId: dwarf, tick: ctx.tick });
    switch (kind) {
      case 'singed':
        this.burn(dwarf, ctx);
        ctx.emit({ type: 'Mishap', id: dwarf, kind });
        return;
      case 'blackout':
        ctx.emit({ type: 'CreatureStunned', id: dwarf, until: ctx.tick + MISHAP_BLACKOUT_TICKS });
        ctx.emit({ type: 'Mishap', id: dwarf, kind });
        return;
      case 'scorched_circle':
        ctx.emit({ type: 'Mishap', id: dwarf, kind, buildingId: circle });
        return;
      case 'fire': {
        let tile = -1;
        if (origin >= 0 && ctx.readers.has('05')) {
          const materials = ctx.readers.of<MaterialsReader>('05');
          for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
            const n = map.offset(origin, dx, dy, 0);
            if (n >= 0 && materials.burnableTile(n)) { tile = n; break; }
          }
        }
        ctx.emit(tile >= 0 ? { type: 'Mishap', id: dwarf, kind, tile } : { type: 'Mishap', id: dwarf, kind });
        return;
      }
      case 'surge': {
        if (origin >= 0) {
          const ox = map.xOf(origin);
          const oy = map.yOf(origin);
          const oz = map.zOf(origin);
          const entities = ctx.world.entities;
          for (const id of entities.with(C.Body, C.Position)) {
            const p = entities.get(id, C.Position);
            if (p === undefined || p.z !== oz || !entities.alive(id)) continue;
            if (Math.max(Math.abs(p.x - ox), Math.abs(p.y - oy)) <= MISHAP_SURGE_RADIUS) this.burn(id, ctx);
          }
        }
        ctx.emit({ type: 'Mishap', id: dwarf, kind });
        return;
      }
      default:
        return;
    }
  }

  /** A light burn on a random arm, never on an arm it could take: the other arm, or nothing. */
  private burn(id: EntityId, ctx: TickContext): void {
    const body = ctx.world.entities.get(id, C.Body);
    if (body === undefined) return;
    const first = this.host.rng.int(0, 1);
    for (const k of [first, 1 - first]) {
      const slot = ARMS[k] as number;
      const part = body.parts[slot];
      if (part === undefined || part.destroyed || part.hp <= 1) continue;
      ctx.emit({ type: 'DamageDealt', defenderId: id, part: BODY_SLOTS[slot], damageType: 'burn', amount: 1, attackerId: 0, weaponId: 0 });
      return;
    }
  }
}
