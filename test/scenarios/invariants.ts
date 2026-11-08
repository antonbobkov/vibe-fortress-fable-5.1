/** T-176: the bug hunt checker, using readers, the entity store and a stock recount. */
import { C, ItemFlag } from '@core/components';
import { NEED_MAX, MOOD_MAX, MOOD_MIN, TICKS_PER_DAY } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import type { HeadlessGame } from '@app/headless';
import type { JobsReader } from '@systems/jobs/reader';
import type { JobsSystem } from '@systems/jobs';
import type { ItemsSystem } from '@systems/items';
import type { Job } from '@systems/jobs/state';
import type { DwarvesSystem } from '@systems/dwarves';
import type { DefenseSystem } from '@systems/defense';
import type { BuildingsReader } from '@systems/buildings/reader';
import { FAILED_WALK_RETRY_TICKS, JOB_HOLD_TICKS } from '@systems/jobs/constants';

/** The sampler looks at the board every 100 ticks, so an absence is seen up to that late. */
const HELD_SAMPLE_TICKS = 100;

export interface Finding {
  inv: string;
  cls: string;
  count: number;
  firstTick: number;
  lastTick: number;
  samples: string[];
}

class Probe {
  readonly findings = new Map<string, Finding>();
  private readonly still = new Map<number, { sig: string; since: number }>();
  private readonly stillJob = new Map<number, { sig: string; since: number }>();
  private readonly fleeSince = new Map<number, number>();
  private readonly partySeen = new Map<
    number,
    { first: number; state: string; stateSince: number }
  >();
  private readonly reported = new Set<string>();
  /** T-331: the tick a job was first seen blocked as unreachable although a path to it exists. */
  private readonly blockedPath = new Map<number, { kind: 'path' | 'anchor'; since: number }>();
  /** T-331: a job whose worker's brain is not working, since when. */
  private readonly heldElsewhere = new Map<number, { worker: number; behavior: string; sig: string; since: number }>();
  /** T-519: a built container out of every dwarf's reach (T-331 3), since when. */
  private readonly noWorkTile = new Map<number, { classId: string; detail: string; since: number }>();
  calmNoHostileAlertTicks = 0;
  /** The tick and the alert of the last step observed: a script that lowers the alert after that step has not been lived through yet (T-528). */
  private observed: { tick: number; alert: string } | null = null;
  lastTick = 0;

  constructor(
    readonly label: string,
    readonly maxSamples = 4,
  ) {}

  hit(tick: number, inv: string, cls: string, detail: string, onceKey?: string): void {
    if (onceKey !== undefined) {
      const k = `${inv}|${onceKey}`;
      if (this.reported.has(k)) return;
      this.reported.add(k);
    }
    const key = `${inv}|${cls}`;
    let f = this.findings.get(key);
    if (!f) {
      f = { inv, cls, count: 0, firstTick: tick, lastTick: tick, samples: [] };
      this.findings.set(key, f);
    }
    f.count += 1;
    f.lastTick = tick;
    if (f.samples.length < this.maxSamples) f.samples.push(`t${tick}: ${detail}`);
  }

  /** Observe transitions between daily samples so repeating daily routines are not freezes. */
  observe(game: HeadlessGame): void {
    const entities = game.world.entities;
    const tick = game.tick;
    this.observed = { tick, alert: game.world.fortress.alert };
    if (tick % 100 === 0) this.sample(game);
    const board = (game.world.scheduler.byId('11') as JobsSystem).board;
    for (const job of board.jobs.values()) {
      if (!['claimed', 'fetching', 'travelling', 'working', 'completing'].includes(job.state)) {
        this.stillJob.delete(job.id);
        continue;
      }
      const p = entities.get(job.workerId, C.Position);
      const pos = p ? `(${p.x},${p.y},${p.z})` : '(none)';
      const sig = `${job.state}|${job.progress}|${job.workerId}|${pos}`;
      if (this.stillJob.get(job.id)?.sig !== sig) this.stillJob.set(job.id, { sig, since: tick });
    }
    for (const id of entities.with(C.Brain)) {
      const creature = entities.get(id, C.Creature);
      const brain = entities.get(id, C.Brain);
      const p = entities.get(id, C.Position);
      if (creature?.faction !== 'fortress' || brain === undefined || p === undefined) continue;
      const worker = entities.get(id, C.Worker);
      const sig = `${p.x},${p.y},${p.z}|${brain.behavior}|${brain.activity}|${worker?.jobId ?? 0}`;
      if (this.still.get(id)?.sig !== sig) this.still.set(id, { sig, since: tick });
      if (brain.behavior === 'flee') {
        if (!this.fleeSince.has(id)) this.fleeSince.set(id, tick);
      } else this.fleeSince.delete(id);
    }
    for (const id of entities.with(C.Party)) {
      const party = entities.get(id, C.Party)!;
      const previous = this.partySeen.get(id);
      if (previous === undefined)
        this.partySeen.set(id, { first: tick, state: party.state, stateSince: tick });
      else if (previous.state !== party.state) {
        previous.state = party.state;
        previous.stateSince = tick;
      }
    }
  }

  check(game: HeadlessGame): void {
    const world = game.world;
    const ent = world.entities;
    const map = game.map;
    const tick = world.calendar.tick;
    const dt = tick - this.lastTick;
    this.lastTick = tick;
    const jobs = world.readers.of<JobsReader>('11');
    const reg = game.registry;
    const speciesName = (s: number): string =>
      reg.table<{ id: string }>('creatures').byIndex(s)?.id ?? `sp${s}`;
    const itemName = (t: number): string =>
      reg.table<{ id: string }>('items').byIndex(t)?.id ?? `it${t}`;
    const posOf = (id: number): string => {
      const p = ent.get(id, C.Position);
      return p ? `(${p.x},${p.y},${p.z})` : '(none)';
    };

    // ---------- jobs ----------
    const allJobs = jobs.list();
    const jobById = new Map(allJobs.map((j) => [j.id, j]));
    const active = new Set(['claimed', 'fetching', 'travelling', 'working', 'completing']);
    for (const j of allJobs) {
      const type = jobs.typeOf(j.id) ?? '?';
      if (j.workerId !== 0) {
        if (!ent.alive(j.workerId))
          this.hit(
            tick,
            'job.worker-dead',
            type,
            `job ${j.id} ${type} state ${j.state} worker ${j.workerId} not alive`,
          );
        else {
          const wk = ent.get(j.workerId, C.Worker);
          if (!wk || wk.jobId !== j.id)
            this.hit(
              tick,
              'job.worker-mismatch',
              type,
              `job ${j.id} ${type} state ${j.state} says worker ${j.workerId}, worker.jobId=${wk?.jobId}`,
            );
          const body = ent.get(j.workerId, C.Body);
          if (body && !body.conscious)
            this.hit(
              tick,
              'job.worker-unconscious',
              type,
              `job ${j.id} ${type} state ${j.state} worker ${j.workerId} unconscious`,
            );
        }
        if (!active.has(j.state))
          this.hit(
            tick,
            'job.worker-on-inactive-job',
            `${type}/${j.state}`,
            `job ${j.id} state ${j.state} keeps worker ${j.workerId}`,
          );
      } else if (active.has(j.state)) {
        this.hit(
          tick,
          'job.active-without-worker',
          `${type}/${j.state}`,
          `job ${j.id} ${type} state ${j.state} workerId 0`,
        );
      }
      if (j.state === 'done' || j.state === 'cancelled')
        this.hit(tick, 'job.finished-still-listed', `${type}/${j.state}`, `job ${j.id}`);
      if (
        (j.target.kind === 'entity' || j.target.kind === 'building' || j.target.kind === 'zone') &&
        j.target.ref !== 0 &&
        !ent.alive(j.target.ref)
      ) {
        this.hit(
          tick,
          'job.target-dead',
          `${type}/${j.target.kind}/${j.state}`,
          `job ${j.id} ${type} target ${j.target.kind} ${j.target.ref} not alive, state ${j.state}, age ${tick - j.createdTick}`,
        );
      }
      for (const inp of j.inputs) {
        for (const r of inp.reserved) {
          const it = ent.get(r, C.Item);
          if (!it)
            this.hit(
              tick,
              'job.reserved-item-missing',
              type,
              `job ${j.id} ${type} reserves ${r}, not a living item`,
            );
          else if (it.reservedBy !== j.id)
            this.hit(
              tick,
              'job.reserved-item-other-owner',
              type,
              `job ${j.id} ${type} reserves ${r} (${itemName(it.type)}), item.reservedBy=${it.reservedBy}`,
            );
        }
        for (const r of inp.delivered) {
          if (!ent.get(r, C.Item))
            this.hit(
              tick,
              'job.delivered-item-missing',
              type,
              `job ${j.id} ${type} state ${j.state} delivered ${r}, not a living item`,
            );
        }
      }
      // a job stuck in an active state with the same progress
      if (active.has(j.state)) {
        const sig = `${j.state}|${j.progress}|${j.workerId}|${posOf(j.workerId)}`;
        const prev = this.stillJob.get(j.id);
        if (!prev || prev.sig !== sig) this.stillJob.set(j.id, { sig, since: tick });
        else if (tick - prev.since >= 3 * TICKS_PER_DAY)
          this.hit(
            tick,
            'job.stuck-active-3d',
            `${type}/${j.state}`,
            `job ${j.id} ${type} ${sig} unchanged since t${prev.since}`,
            `j${j.id}`,
          );
      } else this.stillJob.delete(j.id);
    }
    for (const id of ent.with(C.Worker)) {
      const wk = ent.get(id, C.Worker)!;
      if (wk.jobId !== 0) {
        const j = jobById.get(wk.jobId);
        if (!j)
          this.hit(
            tick,
            'worker.job-missing',
            '-',
            `worker ${id} has jobId ${wk.jobId}, no such job`,
          );
        else if (j.workerId !== id)
          this.hit(
            tick,
            'worker.job-other-worker',
            jobs.typeOf(j.id) ?? '?',
            `worker ${id} jobId ${wk.jobId} but job.workerId=${j.workerId}`,
          );
      }
      if (wk.carrying !== 0) {
        const it = ent.get(wk.carrying, C.Item);
        if (!it)
          this.hit(
            tick,
            'worker.carrying-missing',
            '-',
            `worker ${id} carries ${wk.carrying}, not a living item`,
          );
        else if (it.carriedBy !== id)
          this.hit(
            tick,
            'worker.carrying-mismatch',
            itemName(it.type),
            `worker ${id} carries ${wk.carrying} but item.carriedBy=${it.carriedBy} containerId=${it.containerId} pos=${posOf(wk.carrying)}`,
          );
      }
      if (wk.toolId !== 0 && !ent.get(wk.toolId, C.Item))
        this.hit(
          tick,
          'worker.tool-missing',
          '-',
          `worker ${id} tool ${wk.toolId} not a living item`,
        );
    }

    // ---------- items ----------
    const equippedBy = new Map<number, number>();
    for (const id of ent.with(C.Equipment)) {
      const eq = ent.get(id, C.Equipment)!;
      const slots: [string, number][] = [
        ['weapon', eq.weapon],
        ['shield', eq.shield],
        ['quiver', eq.quiver],
        ...Object.entries(eq.armor).map(([k, v]): [string, number] => [`armor.${k}`, v]),
        ...Object.entries(eq.clothing).map(([k, v]): [string, number] => [`clothing.${k}`, v]),
      ];
      const mine = new Set<number>();
      for (const [slot, itemId] of slots) {
        if (itemId === 0) continue;
        const it = ent.get(itemId, C.Item);
        if (!it) {
          this.hit(
            tick,
            'equip.item-missing',
            slot,
            `creature ${id} ${slot}=${itemId} not a living item`,
          );
          continue;
        }
        if (mine.has(itemId)) continue; // one item may fill two slots (D-?): not flagged
        mine.add(itemId);
        const other = equippedBy.get(itemId);
        if (other !== undefined && other !== id)
          this.hit(
            tick,
            'equip.two-wearers',
            itemName(it.type),
            `item ${itemId} equipped by ${other} and ${id}`,
          );
        equippedBy.set(itemId, id);
        if (ent.get(itemId, C.Position) !== undefined)
          this.hit(
            tick,
            'equip.item-on-floor',
            `${slot}/${itemName(it.type)}`,
            `creature ${id} ${slot}=${itemId} but the item has a Position ${posOf(itemId)}; carriedBy=${it.carriedBy}`,
          );
        if (it.containerId !== 0)
          this.hit(
            tick,
            'equip.item-in-container',
            `${slot}/${itemName(it.type)}`,
            `creature ${id} ${slot}=${itemId} but containerId=${it.containerId}`,
          );
        if (it.carriedBy !== 0 && it.carriedBy !== id)
          this.hit(
            tick,
            'equip.item-carried-by-other',
            `${slot}/${itemName(it.type)}`,
            `creature ${id} ${slot}=${itemId} carriedBy=${it.carriedBy}`,
          );
      }
    }
    const inContainerSeen = new Map<number, number>();
    for (const cid of ent.with(C.Container)) {
      const c = ent.get(cid, C.Container)!;
      for (const k of c.contents) {
        const it = ent.get(k, C.Item);
        if (!it) {
          this.hit(
            tick,
            'container.content-missing',
            c.classId,
            `container ${cid} lists ${k}, not a living item`,
          );
          continue;
        }
        if (it.containerId !== cid)
          this.hit(
            tick,
            'container.content-mismatch',
            c.classId,
            `container ${cid} lists ${k} but item.containerId=${it.containerId}`,
          );
        const prev = inContainerSeen.get(k);
        if (prev !== undefined)
          this.hit(
            tick,
            'item.in-two-containers',
            itemName(it.type),
            `item ${k} in containers ${prev} and ${cid}`,
          );
        inContainerSeen.set(k, cid);
      }
    }
    for (const id of ent.with(C.Item)) {
      const it = ent.get(id, C.Item)!;
      const name = itemName(it.type);
      const p = ent.get(id, C.Position);
      const places = (p ? 1 : 0) + (it.containerId !== 0 ? 1 : 0) + (it.carriedBy !== 0 ? 1 : 0);
      if (places > 1)
        this.hit(
          tick,
          'item.two-places',
          name,
          `item ${id} ${name} pos=${posOf(id)} containerId=${it.containerId} carriedBy=${it.carriedBy}`,
        );
      if (places === 0 && !equippedBy.has(id) && (it.flags & ItemFlag.Installed) === 0)
        this.hit(
          tick,
          'item.nowhere',
          name,
          `item ${id} ${name} x${it.count} flags=${it.flags} no position, container, carrier or wearer`,
          `i${id}`,
        );
      if (!(it.count > 0) || !Number.isInteger(it.count))
        this.hit(tick, 'item.bad-count', name, `item ${id} ${name} count=${it.count}`);
      if (it.containerId !== 0) {
        const c = ent.get(it.containerId, C.Container);
        if (!c)
          this.hit(
            tick,
            'item.container-missing',
            name,
            `item ${id} containerId=${it.containerId} is not a living container`,
          );
        else if (!c.contents.includes(id))
          this.hit(
            tick,
            'item.container-does-not-list',
            name,
            `item ${id} containerId=${it.containerId} not in its contents`,
          );
      }
      if (it.carriedBy !== 0 && !ent.alive(it.carriedBy))
        this.hit(
          tick,
          'item.carrier-dead',
          name,
          `item ${id} ${name} carriedBy=${it.carriedBy} not alive; pos=${posOf(id)} flags=${it.flags}`,
        );
      const reservedFlag = (it.flags & ItemFlag.Reserved) !== 0;
      if (reservedFlag !== (it.reservedBy !== 0))
        this.hit(
          tick,
          'item.reserved-flag-mismatch',
          name,
          `item ${id} ${name} flag=${reservedFlag} reservedBy=${it.reservedBy}`,
        );
      if (it.reservedBy !== 0) {
        const j = jobById.get(it.reservedBy);
        if (!j) {
          // 10 reserves a meal or drink for the eater: reservedBy is then the dwarf's entity id.
          if (!ent.has(it.reservedBy, C.Creature))
            this.hit(
              tick,
              'item.reserved-by-missing-job',
              name,
              `item ${id} ${name} x${it.count} reservedBy=${it.reservedBy}, no such job and no such living creature; pos=${posOf(id)} container=${it.containerId} carriedBy=${it.carriedBy}`,
            );
        } else if (
          j.tool !== null &&
          (j.data['toolToFetch'] === id || j.data['ammoToFetch'] === id || ent.get(j.workerId, C.Worker)?.toolId === id)
        ) {
          // the job's tool
        } else if (
          !j.inputs.some((inp) => inp.reserved.includes(id) || inp.delivered.includes(id))
        ) {
          this.hit(
            tick,
            'item.reserved-by-job-that-does-not-list-it',
            `${name}/${jobs.typeOf(j.id)}`,
            `item ${id} reservedBy job ${j.id} (${jobs.typeOf(j.id)}, ${j.state}), not among its inputs; target ${j.target.kind} ${j.target.ref}`,
            `i${id}`,
          );
        }
      }
      if (p) {
        if (!map.inBounds(p.x, p.y, p.z))
          this.hit(tick, 'item.out-of-bounds', name, `item ${id} at ${posOf(id)}`);
        else {
          const at = map.index(p.x, p.y, p.z);
          // 04 § Freezing and thawing: items on a water tile that froze stay inside the ice.
          if (map.kindAt(at) === TileKind.Wall && !map.fluidFrozenAt(at))
            this.hit(
              tick,
              'item.inside-wall',
              name,
              `item ${id} ${name} at ${posOf(id)} flags=${it.flags}`,
              `i${id}`,
            );
        }
      }
      if (it.ownerId !== 0 && !ent.alive(it.ownerId))
        this.hit(
          tick,
          'item.owner-dead',
          name,
          `item ${id} ${name} ownerId=${it.ownerId} not alive, flags=${it.flags} pos=${posOf(id)}`,
        );
    }

    // ---------- stock counts and wealth ----------
    const sys13 = world.scheduler.byId('13') as ItemsSystem | undefined;
    if (sys13?.core) {
      const rc = sys13.core.recount();
      const seen = new Set<number>();
      for (const [type, total, available] of rc.rows) {
        seen.add(type);
        if (sys13.core.counts.total(type) !== total)
          this.hit(
            tick,
            'stock.total-drift',
            itemName(type),
            `count ${sys13.core.counts.total(type)} recount ${total}`,
          );
        if (sys13.core.counts.available(type) !== available)
          this.hit(
            tick,
            'stock.available-drift',
            itemName(type),
            `available ${sys13.core.counts.available(type)} recount ${available}`,
          );
      }
      for (const t of sys13.core.counts.types())
        if (!seen.has(t))
          this.hit(
            tick,
            'stock.total-drift',
            itemName(t),
            `count ${sys13.core.counts.total(t)} recount 0`,
          );
      // T-345: the count of melt-marked items, which a search for the mark trusts, equals the entities' own.
      let marked = 0;
      for (const id of ent.with(C.Item)) if (((ent.get(id, C.Item) as { flags: number }).flags & ItemFlag.Melt) !== 0) marked += 1;
      if (sys13.core.meltMarked !== marked)
        this.hit(tick, 'stock.melt-mark-drift', '-', `melt marks ${sys13.core.meltMarked} recount ${marked}`);
      if (Math.abs(sys13.core.wealth - rc.wealth) > 0.01)
        this.hit(
          tick,
          'wealth.drift',
          '-',
          `item wealth ${sys13.core.wealth} recount ${rc.wealth}`,
        );
    }

    // ---------- creatures ----------
    let hostiles = 0;
    for (const id of ent.with(C.Creature)) {
      const cr = ent.get(id, C.Creature)!;
      const sp = speciesName(cr.species);
      if (ent.has(id, C.Hostile) && !cr.cagedIn) hostiles += 1;
      const p = ent.get(id, C.Position);
      const needs = ent.get(id, C.Needs);
      if (needs)
        for (const [k, v] of Object.entries(needs))
          if (!(v >= 0 && v <= NEED_MAX))
            this.hit(tick, 'need.out-of-range', k, `creature ${id} ${cr.name} ${k}=${v}`);
      const mood = ent.get(id, C.Mood);
      if (mood && !(mood.value >= MOOD_MIN && mood.value <= MOOD_MAX))
        this.hit(tick, 'mood.out-of-range', '-', `creature ${id} mood=${mood.value}`);
      const body = ent.get(id, C.Body);
      if (body) {
        if (!(body.blood >= 0 && body.blood <= body.maxBlood))
          this.hit(
            tick,
            'body.blood-out-of-range',
            sp,
            `creature ${id} blood=${body.blood}/${body.maxBlood}`,
          );
        body.parts.forEach((part, k) => {
          if (!(part.hp >= 0 && part.hp <= part.maxHp))
            this.hit(
              tick,
              'body.hp-out-of-range',
              sp,
              `creature ${id} part ${k} hp=${part.hp}/${part.maxHp}`,
            );
        });
      }
      if (p && !cr.cagedIn) {
        if (!map.inBounds(p.x, p.y, p.z))
          this.hit(tick, 'creature.out-of-bounds', sp, `creature ${id} at ${posOf(id)}`);
        else {
          const i = map.index(p.x, p.y, p.z);
          const cls = ent.get(id, C.Motion)?.movementClass ?? 'walker';
          const kind = map.kindAt(i);
          if (kind === TileKind.Wall)
            this.hit(
              tick,
              'creature.inside-wall',
              `${sp}/${cr.faction}`,
              `creature ${id} ${cr.name} at ${posOf(id)}`,
            );
          // A burning tile blocks every mover while it burns, and fire spreads under a creature that cannot move (a downed
          // animal): 05 burns the creature there, so a tile that only burns is not a place the creature should not be.
          else if (!map.hasFlag(i, TileFlag.Burning) && !game.pathing.graph.passable(i, cls))
            this.hit(
              tick,
              'creature.on-impassable',
              `${sp}/${cr.faction}/kind${kind}`,
              `creature ${id} ${cr.name} at ${posOf(id)} class ${cls} kind ${kind} fluid ${map.fluid[i]}`,
            );
        }
      }
      const heldByThief = !p && ent.has(id, C.Tame) && ent.with(C.Party).some((partyId) => {
        const party = ent.get(partyId, C.Party)!;
        const carrier = party.animalCarriers?.[id];
        return party.purpose === 'thief' && party.loot.includes(id) && carrier !== undefined &&
          party.members.includes(carrier) && ent.alive(carrier) && ent.has(carrier, C.Position) &&
          ent.get(carrier, C.Hostile)?.partyId === partyId;
      });
      if (!p && !cr.cagedIn && !heldByThief)
        this.hit(
          tick,
          'creature.no-position',
          `${sp}/${cr.faction}`,
          `creature ${id} ${cr.name}`,
          `c${id}`,
        );
      const brain = ent.get(id, C.Brain);
      if (brain && p && cr.faction === 'fortress') {
        const wk = ent.get(id, C.Worker);
        const conscious = body?.conscious !== false;
        const sig = `${p.x},${p.y},${p.z}|${brain.behavior}|${brain.activity}|${wk?.jobId ?? 0}`;
        const prev = this.still.get(id);
        if (!prev || prev.sig !== sig) this.still.set(id, { sig, since: tick });
        else if (
          conscious &&
          brain.activity !== 'sleep' &&
          brain.activity !== 'Resting in hospital' &&
          tick - prev.since >= 2 * TICKS_PER_DAY
        ) {
          this.hit(
            tick,
            'dwarf.frozen-2d',
            `${brain.behavior}/${brain.activity}`,
            `dwarf ${id} ${cr.name} ${sig} target ${brain.targetTile} unchanged since t${prev.since}; needs ${JSON.stringify(needs)}`,
            `d${id}@${prev.since}`,
          );
        }
        if (brain.behavior === 'flee') {
          if (!this.fleeSince.has(id)) this.fleeSince.set(id, tick);
        } else this.fleeSince.delete(id);
        // T-528: the alert a script lowered since the last step is one the dwarf has not stepped under yet.
        const fellSinceStep = this.observed?.tick === tick && this.observed.alert === 'hearth';
        if (brain.behavior === 'retreat' && world.fortress.alert !== 'hearth' && !fellSinceStep)
          this.hit(
            tick,
            'dwarf.retreat-without-hearth-alert',
            world.fortress.alert,
            `dwarf ${id} ${cr.name} behavior retreat, alert ${world.fortress.alert}`,
          );
      }
      const sol = ent.get(id, C.Soldier);
      if (sol && sol.squadId !== 0 && !ent.has(sol.squadId, C.Squad))
        this.hit(tick, 'soldier.squad-missing', '-', `creature ${id} squadId=${sol.squadId}`);
      const host = ent.get(id, C.Hostile);
      if (host && host.partyId !== 0 && !ent.has(host.partyId, C.Party))
        this.hit(
          tick,
          'hostile.party-missing',
          sp,
          `creature ${id} partyId=${host.partyId} role ${host.role} state ${host.behaviorState}`,
          `c${id}`,
        );
      const tame = ent.get(id, C.Tame);
      if (tame) {
        if (tame.pastureId !== 0 && !ent.has(tame.pastureId, C.Zone))
          this.hit(tick, 'tame.pasture-missing', sp, `creature ${id} pastureId=${tame.pastureId}`);
        if (tame.petOf !== 0 && !ent.alive(tame.petOf))
          this.hit(tick, 'tame.pet-owner-dead', sp, `creature ${id} petOf=${tame.petOf}`, `c${id}`);
        if (tame.assignedTo !== 0 && !ent.alive(tame.assignedTo))
          this.hit(
            tick,
            'tame.assignee-dead',
            sp,
            `creature ${id} assignedTo=${tame.assignedTo}`,
            `c${id}`,
          );
      }
      const pat = ent.get(id, C.Patient);
      if (pat && pat.hospitalZoneId !== 0 && !ent.has(pat.hospitalZoneId, C.Zone))
        this.hit(tick, 'patient.zone-missing', sp, `creature ${id}`);
    }
    for (const [id, since] of this.fleeSince) {
      if (!ent.alive(id)) {
        this.fleeSince.delete(id);
        continue;
      }
      if (tick - since >= TICKS_PER_DAY && hostiles === 0)
        this.hit(
          tick,
          'dwarf.flee-1d-no-hostile-on-map',
          '-',
          `dwarf ${id} fleeing since t${since}, no hostile creature on the map`,
          `d${id}@${since}`,
        );
    }
    if (world.fortress.alert !== 'calm' && hostiles === 0) this.calmNoHostileAlertTicks += dt;

    // ---------- squads, rooms, workshops, zones ----------
    for (const id of ent.with(C.Squad)) {
      const sq = ent.get(id, C.Squad)!;
      for (const m of sq.members) {
        if (!ent.alive(m))
          this.hit(tick, 'squad.member-dead', '-', `squad ${id} member ${m} not alive`);
        else if (ent.get(m, C.Soldier)?.squadId !== id)
          this.hit(
            tick,
            'squad.member-not-soldier',
            '-',
            `squad ${id} member ${m} soldier.squadId=${ent.get(m, C.Soldier)?.squadId}`,
          );
      }
      if (sq.leaderId !== 0 && !sq.members.includes(sq.leaderId))
        this.hit(tick, 'squad.leader-not-member', '-', `squad ${id} leader ${sq.leaderId}`);
      for (const o of sq.orders)
        if (o.kind === 'kill' && !ent.alive(o.targetId))
          this.hit(
            tick,
            'squad.kill-order-dead-target',
            '-',
            `squad ${id} kill ${o.targetId}`,
            `s${id}/${o.targetId}`,
          );
    }
    for (const id of ent.with(C.Room)) {
      const r = ent.get(id, C.Room)!;
      if (r.ownerId !== 0 && !ent.alive(r.ownerId))
        this.hit(
          tick,
          'room.owner-dead',
          '-',
          `room ${id} ownerId=${r.ownerId} not alive`,
          `r${id}/${r.ownerId}`,
        );
      if (r.zoneId !== 0 && !ent.has(r.zoneId, C.Zone))
        this.hit(tick, 'room.zone-missing', '-', `room ${id} zoneId=${r.zoneId}`);
    }
    for (const id of ent.with(C.Workshop)) {
      const ws = ent.get(id, C.Workshop)!;
      if (ws.currentJobId !== 0 && !jobById.has(ws.currentJobId))
        this.hit(
          tick,
          'workshop.job-missing',
          '-',
          `workshop ${id} currentJobId=${ws.currentJobId}, no such job`,
          `w${id}/${ws.currentJobId}`,
        );
      if (ws.assignedWorker !== 0 && !ent.alive(ws.assignedWorker))
        this.hit(
          tick,
          'workshop.assigned-worker-dead',
          '-',
          `workshop ${id} assignedWorker=${ws.assignedWorker}`,
          `w${id}`,
        );
      for (const o of ws.orders)
        if (!(o.remaining >= 0))
          this.hit(tick, 'workshop.order-negative', '-', `workshop ${id} remaining=${o.remaining}`);
    }
    for (const id of ent.with(C.Building)) {
      const b = ent.get(id, C.Building)!;
      // 14 § Rooms and furniture: a coffin reserved for a dwarf stays reserved after the dwarf dies.
      const buildingId = reg.table<{ id: string }>('buildings').byIndex(b.type)?.id ?? '?';
      if (b.ownerId !== 0 && !ent.alive(b.ownerId) && buildingId !== 'coffin')
        this.hit(
          tick,
          'building.owner-dead',
          reg.table<{ id: string }>('buildings').byIndex(b.type)?.id ?? '?',
          `building ${id} ownerId=${b.ownerId}`,
          `b${id}/${b.ownerId}`,
        );
      if (b.itemId !== 0 && !ent.get(b.itemId, C.Item))
        this.hit(
          tick,
          'building.item-missing',
          reg.table<{ id: string }>('buildings').byIndex(b.type)?.id ?? '?',
          `building ${id} state ${b.state} itemId=${b.itemId} not a living item`,
          `b${id}`,
        );
      for (const l of b.linkedIds)
        if (!ent.alive(l))
          this.hit(tick, 'building.link-dead', '-', `building ${id} linked ${l}`, `b${id}/${l}`);
    }
    for (const id of ent.with(C.Crop)) {
      const c = ent.get(id, C.Crop)!;
      if (c.plotZoneId !== 0 && !ent.has(c.plotZoneId, C.Zone))
        this.hit(tick, 'crop.plot-missing', '-', `crop ${id} plot ${c.plotZoneId}`, `c${id}`);
    }

    // ---------- parties ----------
    for (const id of ent.with(C.Party)) {
      const pt = ent.get(id, C.Party)!;
      const livingMembers = pt.members.filter((m) => ent.alive(m));
      let rec = this.partySeen.get(id);
      if (!rec) {
        rec = { first: tick, state: pt.state, stateSince: tick };
        this.partySeen.set(id, rec);
      }
      if (rec.state !== pt.state) {
        rec.state = pt.state;
        rec.stateSince = tick;
      }
      const cls = `${pt.purpose}/${pt.state}`;
      const info = `party ${id} ${pt.civ} ${pt.purpose} state ${pt.state} since t${pt.stateSince} arrived t${pt.arrivedTick} members ${livingMembers.length}/${pt.members.length} size ${pt.size} loot ${pt.loot.length} goalUnreachable=${pt.goalUnreachable} walkUnreachable=${pt.walkUnreachable} outcome=${pt.outcome}`;
      if (pt.purpose !== 'caravan') {
        if (pt.state === 'loiter') {
          const limit = (pt.purpose === 'siege' ? 5 : 2) * TICKS_PER_DAY;
          if (tick - pt.stateSince > limit + 400)
            this.hit(tick, 'party.loiter-past-limit', cls, info, `p${id}`);
        }
        if (pt.state !== 'gone' && livingMembers.length === 0 && tick - rec.first > 400)
          this.hit(tick, 'party.active-with-no-living-member', cls, info, `p${id}`);
        if (pt.state === 'retreat' && tick - pt.stateSince > 2 * TICKS_PER_DAY)
          this.hit(tick, 'party.retreat-over-2d', cls, info, `p${id}`);
        if (pt.state === 'gone' && tick - rec.stateSince > 2 * TICKS_PER_DAY)
          this.hit(tick, 'party.gone-not-removed-2d', cls, info, `p${id}`);
        if (pt.state !== 'gone' && tick - rec.first > 10 * TICKS_PER_DAY)
          this.hit(tick, 'party.active-over-10d', cls, info, `p${id}`);
        if (pt.state === 'approach' && tick - pt.stateSince > 3 * TICKS_PER_DAY)
          this.hit(tick, 'party.approach-over-3d', cls, info, `p${id}`);
        if (pt.state === 'engage' && tick - pt.stateSince > 3 * TICKS_PER_DAY)
          this.hit(tick, 'party.engage-over-3d', cls, info, `p${id}`);
      } else if (tick - rec.first > 20 * TICKS_PER_DAY)
        this.hit(tick, 'caravan.present-over-20d', cls, info, `p${id}`);
      for (const l of pt.loot)
        if (!ent.get(l, C.Item) && !ent.alive(l))
          this.hit(
            tick,
            'party.loot-missing',
            cls,
            `party ${id} loot ${l} not alive`,
            `p${id}/${l}`,
          );
    }

    // ---------- fortress cache ----------
    const f = world.fortress;
    if (!Number.isFinite(f.wealthCached) || !Number.isFinite(f.hallSpiritCached))
      this.hit(
        tick,
        'fortress.nan',
        '-',
        `wealthCached=${f.wealthCached} spirit=${f.hallSpiritCached}`,
      );

    this.sample(game);
    this.checkHolders(game, jobById);
    this.checkBlockedPaths(game);
    this.checkContainerAccess(game);
    this.checkPlaces(game);
  }

  /**
   * T-331 (1): every reservation, claim and held job has a holder that is alive and is doing the
   * thing it holds. The dead or missing job holders are reported by the job checks above; this adds
   * the personal reservations of the dwarves' own plans, the held job of a worker whose brain is
   * elsewhere, and the claim on a patient's bed.
   */
  private checkHolders(game: HeadlessGame, jobById: Map<number, Job>): void {
    const world = game.world;
    const ent = world.entities;
    const tick = world.calendar.tick;
    const dwarves = world.scheduler.byId('10') as DwarvesSystem | undefined;
    const plans = dwarves?.activities.plans;
    const itemName = (t: number): string =>
      game.registry.table<{ id: string }>('items').byIndex(t)?.id ?? `it${t}`;

    for (const id of ent.with(C.Item)) {
      const it = ent.get(id, C.Item)!;
      if (it.reservedBy === 0 || jobById.has(it.reservedBy)) continue;
      // Not a job: the personal reservation of a dwarf's hunger or thirst plan (10 reserves for the eater).
      const holder = it.reservedBy;
      if (!ent.alive(holder)) {
        this.hit(
          tick,
          'holder.reservation-holder-gone',
          itemName(it.type),
          `item ${id} ${itemName(it.type)} reservedBy ${holder}, not alive`,
          `i${id}`,
        );
      } else if (plans !== undefined && plans.get(holder)?.itemId !== id) {
        this.hit(
          tick,
          'holder.reservation-elsewhere',
          itemName(it.type),
          `item ${id} ${itemName(it.type)} reservedBy dwarf ${holder}, whose plan is ${JSON.stringify(plans.get(holder) ?? null)}`,
          `i${id}`,
        );
      }
    }
    // 10's brain moves a worker to flee, retreat, patient or a critical need without giving back a job that
    // cannot be interrupted, and the job resumes: that is only a fault once it has lasted longer than 11 holds
    // it (`JOB_HOLD_TICKS`, counted by the board from the tick it sees the absence) and the sampling interval.
    for (const [jobId, held] of this.heldElsewhere) {
      const age = tick - held.since;
      if (age > JOB_HOLD_TICKS + HELD_SAMPLE_TICKS)
        this.hit(
          tick,
          'holder.job-held-while-elsewhere',
          held.behavior,
          `job ${jobId} held by ${held.worker} for ${age} ticks while its behavior is ${held.behavior}`,
          `j${jobId}/${held.worker}@${held.since}`,
        );
    }
    // T-132: the empty container a job reserved for its output holds nothing but the job's own inputs.
    for (const j of jobById.values()) {
      const own = new Set<number>();
      for (const inp of j.inputs) for (const x of [...inp.reserved, ...inp.delivered]) own.add(x);
      for (const inp of j.inputs) {
        if (inp.filter.emptyContainer === undefined) continue;
        for (const c of new Set([...inp.reserved, ...inp.delivered])) {
          const foreign = (ent.get(c, C.Container)?.contents ?? []).filter((x) => !own.has(x));
          if (foreign.length > 0)
            this.hit(
              tick,
              'holder.reserved-container-foreign-contents',
              inp.filter.emptyContainer,
              `job ${j.id} reserves empty ${inp.filter.emptyContainer} ${c}, which holds ${foreign.join(',')} of no input of the job`,
              `j${j.id}/${c}`,
            );
        }
      }
    }
    for (const id of ent.with(C.Patient)) {
      const bedId = ent.get(id, C.Patient)!.bedId;
      if (bedId === 0) continue;
      const bed = ent.get(bedId, C.Building);
      const buildings = world.readers.has('14') ? world.readers.of<BuildingsReader>('14') : undefined;
      if (bed === undefined)
        this.hit(tick, 'holder.patient-bed-gone', '-', `patient ${id} bedId ${bedId} is not a building`, `p${id}/${bedId}`);
      else if (buildings !== undefined && bed.state === 'built' && buildings.bedHolder(bedId) !== id)
        this.hit(
          tick,
          'holder.patient-bed-held-by-other',
          '-',
          `patient ${id} bedId ${bedId} is held by ${buildings.bedHolder(bedId)}`,
          `p${id}/${bedId}`,
        );
    }
  }

  /**
   * T-331 (2): a job blocked as `unreachable` is reopened by the next retry as soon as a worker with its
   * labor reaches one of its stand tiles. It is lost when it stays blocked for more than a day (a) while
   * such a stand tile is reachable (a walk that failed and is not retried), or (b) while none of its
   * stand tiles can be stood on, although the anchor cannot be stood on and a tile beside it is passable and reachable (a work
   * tile that is a built chest's own tile). The start of the block is the first sample that saw it; a failed
   * walk's own retry tick says when it began.
   */
  private checkBlockedPaths(game: HeadlessGame): void {
    const tick = game.world.calendar.tick;
    const board = (game.world.scheduler.byId('11') as JobsSystem | undefined)?.board;
    if (board === undefined) return;
    for (const [jobId, seen] of this.blockedPath) {
      const job = board.jobs.get(jobId);
      if (job === undefined) continue;
      const age = tick - seen.since;
      if (age <= TICKS_PER_DAY) continue;
      const type = board.typeId(job);
      this.hit(
        tick,
        seen.kind === 'path' ? 'job.unreachable-with-path' : 'job.unreachable-anchor-beside',
        type,
        `job ${job.id} ${type} blocked unreachable for ${age} ticks (failedWalk ${job.failedWalk === true}, workTile ${String(job.workTile)}), target ${job.target.kind} ${job.target.ref}`,
        `j${job.id}`,
      );
    }
  }

  /**
   * Record, from the world as it is now, the three conditions that only matter once they last a day: a
   * job blocked as unreachable that should not be (T-331 2), a job held by a worker whose brain is
   * not working (T-331 1), and a built container no dwarf reaches (T-331 3, T-519). Called by every
   * check, every 100 ticks by `observe`, and by the scenario runner.
   */
  sample(game: HeadlessGame): void {
    this.sampleContainerAccess(game);
    const world = game.world;
    const ent = world.entities;
    const tick = world.calendar.tick;
    const board = (world.scheduler.byId('11') as JobsSystem | undefined)?.board;
    if (board === undefined) return;
    const pathing = world.readers.pathing;
    const map = game.map;
    const blocked = new Set<number>();
    const held = new Set<number>();
    for (const job of board.jobs.values()) {
      if (job.state === 'blocked' && job.blockedReason === 'unreachable') {
        const labor = board.jobLabor(job);
        const workers = board.workers().filter((w) => labor === 0 || board.laborEnabled(w, labor));
        let kind: 'path' | 'anchor' | null = null;
        if (workers.some((w) => board.hasReachableStand(job, w))) kind = 'path';
        else {
          const anchor = board.anchorTile(job);
          // Nobody can stand on the anchor itself (a built chest, a wall): only then is a tile beside it the way in.
          if (map.validIndex(anchor) && !pathing.passable(anchor, 'walker', { faction: 'fortress' })) {
            const labels = new Set<number>();
            for (const w of workers) {
              const at = board.workerTile(w);
              if (at >= 0) labels.add(pathing.labelOf(at, 'walker'));
            }
            for (const n of map.neighbors8(anchor)) {
              if (pathing.passable(n, 'walker', { faction: 'fortress' }) && labels.has(pathing.labelOf(n, 'walker'))) {
                kind = 'anchor';
                break;
              }
            }
          }
        }
        if (kind !== null) {
          blocked.add(job.id);
          // A walk that failed waits FAILED_WALK_RETRY_TICKS for a trigger: its block began that long before retryTick.
          const began = job.failedWalk === true ? job.retryTick - FAILED_WALK_RETRY_TICKS : tick;
          const prev = this.blockedPath.get(job.id);
          if (prev === undefined || prev.kind !== kind) this.blockedPath.set(job.id, { kind, since: Math.min(began, tick) });
          else if (began < prev.since) prev.since = began;
        }
      }
      if (['claimed', 'fetching', 'travelling', 'working', 'completing'].includes(job.state) && job.workerId !== 0 && ent.alive(job.workerId)) {
        const brain = ent.get(job.workerId, C.Brain);
        if (brain !== undefined && brain.behavior !== 'work') {
          held.add(job.id);
          // A job that has moved on since the last sample (its worker worked it between two needs) restarts the count.
          const at = ent.get(job.workerId, C.Position);
          const sig = `${job.state}|${job.progress}|${at?.x},${at?.y},${at?.z}`;
          const prev = this.heldElsewhere.get(job.id);
          if (prev === undefined || prev.worker !== job.workerId || prev.sig !== sig)
            this.heldElsewhere.set(job.id, { worker: job.workerId, behavior: brain.behavior, sig, since: tick });
        }
      }
    }
    for (const id of [...this.blockedPath.keys()]) if (!blocked.has(id)) this.blockedPath.delete(id);
    for (const id of [...this.heldElsewhere.keys()]) if (!held.has(id)) this.heldElsewhere.delete(id);
  }

  /**
   * T-331 (3): a built container that holds items, or that lies in a stockpile or hospital zone and
   * so offers slots, has a tile beside it (or under it) that a dwarf of the fortress can reach. T-519:
   * it is lost only once it has been out of reach for more than a day. A door locked on an alert cuts
   * the halls off from any dwarf left outside, and the three-year script lifts an alert that has locked
   * every dwarf out (T-363); `three-years-p4-4` (shift 400) met its daily check in that moment with its
   * last dwarf at a surface workshop.
   */
  private checkContainerAccess(game: HeadlessGame): void {
    const tick = game.world.calendar.tick;
    for (const [id, seen] of this.noWorkTile) {
      const age = tick - seen.since;
      if (age <= TICKS_PER_DAY) continue;
      this.hit(tick, 'container.no-work-tile', seen.classId, `${seen.detail}, for ${age} ticks`, `b${id}`);
    }
  }

  /** T-331 (3): the built containers that no dwarf reaches now, sampled with the day-long conditions. */
  private sampleContainerAccess(game: HeadlessGame): void {
    const world = game.world;
    const ent = world.entities;
    const map = game.map;
    const tick = world.calendar.tick;
    const pathing = world.readers.pathing;
    const out = new Set<number>();
    const forget = (): void => {
      for (const id of [...this.noWorkTile.keys()]) if (!out.has(id)) this.noWorkTile.delete(id);
    };
    const labels = new Set<number>();
    for (const id of ent.with(C.Labors)) {
      const p = ent.get(id, C.Position);
      if (p === undefined || !ent.alive(id)) continue;
      const label = pathing.labelOf(map.index(p.x, p.y, p.z), 'walker');
      if (label !== 0) labels.add(label);
    }
    if (labels.size === 0) return forget();
    // The tiles of stockpile and hospital zones: a built container there gives the zone its slots.
    const zoneTypes = game.registry.table<{ id: string }>('zoneTypes');
    const zoned = new Set<number>();
    for (const zid of ent.with(C.Zone)) {
      const zone = ent.get(zid, C.Zone)!;
      const kind = zoneTypes.byIndex(zone.type)?.id;
      if (kind === 'stockpile' || kind === 'hospital') for (const t of zone.tiles) zoned.add(t);
    }
    const fortress = { faction: 'fortress' } as const;
    for (const id of ent.with(C.Building)) {
      const b = ent.get(id, C.Building)!;
      if (b.state !== 'built' || b.itemId === 0) continue;
      const container = ent.get(b.itemId, C.Container);
      if (container === undefined) continue;
      if (container.contents.length === 0 && !b.footprint.some((t) => zoned.has(t))) continue;
      const tiles = new Set<number>();
      for (const t of b.footprint) {
        tiles.add(t);
        for (const n of map.neighbors8(t)) tiles.add(n);
      }
      let reachable = false;
      for (const t of tiles) {
        if (!pathing.passable(t, 'walker', fortress)) continue;
        if (labels.has(pathing.labelOf(t, 'walker'))) {
          reachable = true;
          break;
        }
      }
      if (reachable) continue;
      out.add(id);
      const detail = `built ${container.classId} ${id} at ${b.origin} holds ${container.contents.length} items, no tile beside it that a dwarf reaches`;
      const prev = this.noWorkTile.get(id);
      if (prev === undefined) this.noWorkTile.set(id, { classId: container.classId, detail, since: tick });
      else prev.detail = detail;
    }
    forget();
  }

  /**
   * T-331 (4): every item has a place. Beyond the direct link checked above, the place of what it
   * lies in must itself be a place: a container that lies nowhere, a furniture item that no
   * building owns, or a carrier that is not a creature leaves its contents nowhere.
   */
  private checkPlaces(game: HeadlessGame): void {
    const world = game.world;
    const ent = world.entities;
    const tick = world.calendar.tick;
    const linked = new Set<number>();
    for (const id of ent.with(C.Building)) {
      const b = ent.get(id, C.Building)!;
      if (b.itemId !== 0) linked.add(b.itemId);
    }
    // A trap holds its loaded stone, weapons or cage as installed items, in 19's trap records.
    const defense = world.scheduler.byId('19') as DefenseSystem | undefined;
    for (const trap of defense?.traps.values() ?? []) for (const item of trap.loaded) linked.add(item);
    const wearers = new Set<number>();
    for (const id of ent.with(C.Equipment)) {
      const eq = ent.get(id, C.Equipment)!;
      for (const v of [eq.weapon, eq.shield, eq.quiver, ...Object.values(eq.armor), ...Object.values(eq.clothing)])
        if (v !== 0) wearers.add(v);
    }
    const placed = (start: number): string | null => {
      let id = start;
      for (let depth = 0; depth < 9; depth += 1) {
        if (ent.has(id, C.Building) && !ent.has(id, C.Item)) return null; // the wagon holds its own contents
        const p = ent.get(id, C.Position);
        if (p !== undefined) return world.map.inBounds(p.x, p.y, p.z) ? null : `${id} is out of bounds`;
        const it = ent.get(id, C.Item);
        if (it === undefined) return ent.alive(id) && ent.has(id, C.Creature) ? null : `${id} is not an item`;
        if (it.containerId !== 0) {
          id = it.containerId;
          continue;
        }
        if (it.carriedBy !== 0) {
          if (!ent.alive(it.carriedBy)) return `carrier ${it.carriedBy} is not alive`;
          return null;
        }
        if (wearers.has(id)) return null;
        if ((it.flags & ItemFlag.Installed) !== 0) return linked.has(id) ? null : `installed item ${id} has no building`;
        return `${id} lies nowhere`;
      }
      return `chain of ${start} is too deep or a cycle`;
    };
    for (const id of ent.with(C.Item)) {
      const why = placed(id);
      if (why !== null) {
        const it = ent.get(id, C.Item)!;
        // A free item with no link at all is reported once by `item.nowhere`.
        if (it.containerId === 0 && it.carriedBy === 0 && ent.get(id, C.Position) === undefined && !wearers.has(id) && (it.flags & ItemFlag.Installed) === 0)
          continue;
        this.hit(tick, 'item.no-place', why.replace(/\d+/g, 'N'), `item ${id}: ${why}`, `i${id}`);
      }
    }
  }

  report(): string {
    const rows = Array.from(this.findings.values()).sort(
      (a, b) => a.inv.localeCompare(b.inv) || b.count - a.count,
    );
    const byInv = new Map<
      string,
      { count: number; first: number; last: number; classes: number }
    >();
    for (const r of rows) {
      const s = byInv.get(r.inv) ?? { count: 0, first: r.firstTick, last: r.lastTick, classes: 0 };
      s.count += r.count;
      s.first = Math.min(s.first, r.firstTick);
      s.last = Math.max(s.last, r.lastTick);
      s.classes += 1;
      byInv.set(r.inv, s);
    }
    const lines: string[] = [
      `== ${this.label}: ${rows.length} finding classes; alert-not-calm-with-no-hostile ticks: ${this.calmNoHostileAlertTicks}`,
    ];
    for (const [inv, s] of byInv)
      lines.push(`  ${inv}: ${s.count} hits, ${s.classes} classes, t${s.first}..t${s.last}`);
    lines.push('-- detail');
    for (const r of rows) {
      lines.push(`${r.inv} [${r.cls}] x${r.count} t${r.firstTick}..t${r.lastTick}`);
      for (const s of r.samples) lines.push(`    ${s}`);
    }
    return lines.join('\n');
  }
}

const probes = new WeakMap<HeadlessGame, Probe>();

/** Check structural invariants and retain the probe's time-based observations for this game. */
function probeOf(game: HeadlessGame): Probe {
  let probe = probes.get(game);
  if (probe === undefined) {
    probe = new Probe('T-176');
    probes.set(game, probe);
  }
  return probe;
}

export function checkInvariants(game: HeadlessGame): Finding[] {
  const probe = probeOf(game);
  probe.check(game);
  return [...probe.findings.values()];
}

/**
 * T-331: the findings every scenario must end without, the four invariants about holders and places.
 * The rest of the T-176 checker stays with the long fixtures and the scenarios that opt in: many
 * short scenarios stage equipment, creatures and terrain by hand in ways it rejects.
 *  1. no reservation, claim or held job whose holder is dead, gone or doing something else;
 *  2. no job blocked unreachable for more than a day while a path to its work tile exists;
 *  3. every built container with items or a stockpile slot has a reachable work tile (out of reach for more than a day is lost, T-519);
 *  4. every item has a place.
 */
export const SCENARIO_END_INVARIANTS: ReadonlySet<string> = new Set([
  // 1
  'job.worker-dead', 'job.worker-mismatch', 'job.worker-on-inactive-job', 'job.active-without-worker',
  'worker.job-missing', 'worker.job-other-worker', 'job.reserved-item-missing', 'job.reserved-item-other-owner',
  'item.reserved-by-missing-job', 'item.reserved-by-job-that-does-not-list-it', 'item.reserved-flag-mismatch',
  'tame.assignee-dead', 'building.owner-dead', 'room.owner-dead', 'workshop.assigned-worker-dead', 'workshop.job-missing',
  'holder.reservation-holder-gone', 'holder.reservation-elsewhere', 'holder.job-held-while-elsewhere',
  'holder.reserved-container-foreign-contents', 'holder.patient-bed-gone', 'holder.patient-bed-held-by-other',
  // 2
  'job.unreachable-with-path', 'job.unreachable-anchor-beside',
  // 3
  'container.no-work-tile',
  // 4
  'item.nowhere', 'item.no-place', 'item.carrier-dead', 'item.container-missing', 'item.container-does-not-list',
]);

/**
 * Sample the day-long conditions of T-331 (a job blocked unreachable, a job held by a worker who is
 * elsewhere) every 100 ticks while a game runs, so that a check at the end of a scenario knows how long
 * they have lasted. Returns the function that stops the sampling.
 */
export function sampleInvariants(game: HeadlessGame): () => void {
  const probe = probeOf(game);
  const original = game.world.step;
  const sampled = (): void => {
    original.call(game.world);
    if (game.tick % 100 === 0) probe.sample(game);
  };
  game.world.step = sampled;
  return () => {
    if (game.world.step === sampled) game.world.step = original;
  };
}

/** The findings of {@link SCENARIO_END_INVARIANTS} at this moment, for the end of every scenario. */
export function checkScenarioEndInvariants(game: HeadlessGame): Finding[] {
  return checkInvariants(game).filter((f) => SCENARIO_END_INVARIANTS.has(f.inv));
}

/** Observe every tick; run the full checker every 1,200 ticks, with no simulation writes. */
export function watchInvariants(
  game: HeadlessGame,
  check: (findings: Finding[]) => void,
): () => void {
  const probe = probeOf(game);
  probe.observe(game);
  const original = game.world.step;
  game.world.step = () => {
    original.call(game.world);
    probe.observe(game);
    if (game.tick % TICKS_PER_DAY === 0) check(checkInvariants(game));
  };
  return () => {
    game.world.step = original;
  };
}

/** The loaded game's identical ids continue the same observations across the save checkpoint. */
export function continueInvariantObservations(previous: HeadlessGame, loaded: HeadlessGame): void {
  probes.set(loaded, probeOf(previous));
}
