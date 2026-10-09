/**
 * 11 Jobs & labor: the system. `02-systems/11-jobs-and-labor.md` (all), `algorithms/jobs-and-
 * hauling.md` § Jobs tick, § Assignment, § Job steps, `03-content/jobs.md` (job types, loaded as
 * content) and `skills-and-professions.md` § Labors.
 *
 * The board is installed as the world's jobs API (D-049): producers registered through
 * `register.jobProducer` are polled every tick in registration order; 10 queues and steps workers.
 */

import { OK, reject, type Command, type CommandResult } from '@core/commands';
import type { CommandType } from '@core/command-types';
import type { EventType } from '@core/event-types';
import type { GameEvent } from '@core/events';
import { BaseSystem, Registrations, type InitContext, type TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import type { ItemsReader } from '@systems/items';
import { JobBoard } from './board';
import { dropStrandedTools, dropUnusedTools, itemSourceOf } from './items-adapter';
import { NO_ITEMS } from './producers';
import {
  applyCancelJob,
  applySetJobPriority,
  applySetLabor,
  applySetLaborPriority,
  applySetStandingOrder,
} from './commands';
import { makeReader, type JobsReader } from './reader';
import type { Job, JobsStateV1 } from './state';

export { JobBoard, RETRY_TRIGGERS, type JobTypeRow } from './board';
export { NO_ITEMS, type ItemSource, type JobSink, type JobSpec } from './producers';
export type { JobsReader, JobCounts } from './reader';
export * from './assign';
export { workCentiTicks, chooseStand } from './steps';
export { itemSourceOf, toolFilter } from './items-adapter';
export type { Job, JobState, ItemFilter, Tool } from './state';

export const JOBS_ID = '11';

/** 13's reader id. */
const ITEMS_READER = '13';

const COMMAND_HANDLERS: Partial<Record<CommandType, (board: JobBoard, cmd: Command) => CommandResult>> = {
  SetLabor: applySetLabor,
  SetLaborPriority: applySetLaborPriority,
  CancelJob: applyCancelJob,
  SetJobPriority: applySetJobPriority,
  SetStandingOrder: applySetStandingOrder,
};

export class JobsSystem extends BaseSystem<JobsStateV1> {
  readonly id = JOBS_ID;
  readonly order = 11;
  override readonly subscribes: readonly EventType[] = [
    'TilesChanged',
    'BuildingStateChanged',
    'FluidsChanged',
    'ItemCreated',
    'ItemDestroyed',
    'ItemReleased',
    'StocksChanged',
    'CreatureDied',
    'CorpseCreated',
    'ImmigrantsArrived',
    'NeedCritical',
    'AlertChanged',
    'ThreatNearby',
    'ToolDropped',
  ];
  override readonly ownsCommands: readonly CommandType[] = ['SetLabor', 'SetLaborPriority', 'CancelJob', 'SetJobPriority', 'SetStandingOrder'];

  private boardRef: JobBoard | null = null;
  private readerRef: JobsReader | null = null;
  private registrations: Registrations | null = null;
  private producersRead = false;

  get board(): JobBoard {
    if (this.boardRef === null) throw new Error('11 jobs: used before init');
    return this.boardRef;
  }

  /** The init context, for connecting 13 on load (D-082). */
  private initCtx: InitContext | null = null;

  override init(ctx: InitContext): void {
    this.initCtx = ctx;
    this.boardRef?.dispose();
    const board = new JobBoard(ctx.world, ctx.registry, ctx.readers);
    this.boardRef = board;
    this.readerRef = makeReader(board);
    this.registrations = ctx.register instanceof Registrations ? ctx.register : null;
    ctx.world.services.jobs = board;
    ctx.register.panel({ id: 'jobs', title: 'Jobs', hotkey: 'j' });
    ctx.register.panel({ id: 'labors', title: 'Labors', hotkey: 'l' });
    ctx.register.inspector('creature', { id: 'current_job', order: 20 });
  }

  /** Registration is read lazily on the first tick (`module-interfaces.md` § Registration APIs). */
  private readProducers(): void {
    if (this.producersRead) return;
    this.producersRead = true;
    const board = this.board;
    for (const p of this.registrations?.jobProducers ?? []) if (!board.producers.includes(p)) board.producers.push(p);
  }

  /** 13's items replace the D-054 seam once 13 is present (T-M2-02). */
  private connectItems(ctx: Pick<TickContext, 'world' | 'readers'>): void {
    const board = this.board;
    if (board.items !== NO_ITEMS) return;
    const api = ctx.world.services.items;
    if (api === null || !ctx.readers.has(ITEMS_READER)) return;
    board.items = itemSourceOf(api, ctx.readers.of<ItemsReader>(ITEMS_READER), ctx.readers.entities);
  }

  override tick(ctx: TickContext): void {
    this.readProducers();
    this.connectItems(ctx);
    dropStrandedTools(this.board, ctx);
    dropUnusedTools(this.board, ctx);
    this.board.tick(ctx);
  }

  override handle(event: GameEvent, ctx: TickContext): void {
    const board = this.board;
    const type = event.type;
    if (type === 'TilesChanged') {
      const map = board.world.map;
      const chunks = new Set<number>();
      for (const t of event['tiles'] as readonly TileIndex[]) chunks.add(map.chunkOf(t));
      board.trigger('unreachable', chunks);
    } else if (type === 'BuildingStateChanged') {
      board.trigger('unreachable');
    } else if (type === 'FluidsChanged') {
      board.trigger('unreachable');
      board.trigger('no_magma');
    } else if (type === 'ItemCreated') {
      board.trigger('missing_input');
      board.trigger('no_tool');
    } else if (type === 'ItemDestroyed') {
      const itemId = event['id'] as EntityId;
      for (const id of board.ids) {
        const job = board.jobs.get(id);
        for (const input of job?.inputs ?? []) {
          if (job !== undefined && (input.reserved.includes(itemId) || input.delivered.includes(itemId))) job.data['inputsInvalidated'] = true;
          input.reserved = input.reserved.filter((id) => id !== itemId);
          input.delivered = input.delivered.filter((id) => id !== itemId);
        }
      }
      board.trigger('missing_input');
    } else if (type === 'ItemReleased' || type === 'StocksChanged') {
      board.trigger('missing_input');
    } else if (type === 'ToolDropped') {
      board.trigger('no_tool');
    } else if (type === 'ImmigrantsArrived') {
      board.trigger('no_worker');
    } else if (type === 'CreatureDied') {
      board.workerDied(event['id'] as EntityId);
    } else if (type === 'CorpseCreated') {
      // A hunt job hauls the corpse of the creature it hunted (09 § Hunting).
      for (const id of board.ids) {
        const job = board.jobs.get(id) as Job;
        if ((job.data['animal'] ?? job.target.ref) === event['creatureId'] && board.typeId(job) === 'hunt') job.data['corpseId'] = event['itemId'] as EntityId;
      }
    } else if (type === 'NeedCritical' || type === 'ThreatNearby') {
      // "A need at or above its critical threshold interrupts any job"; jobs marked not
      // interruptible in `jobs.md` are short enough to finish first.
      const id = event['id'] as EntityId;
      const jobId = board.workerOf(id).jobId;
      const job = jobId === 0 ? undefined : board.jobs.get(jobId);
      if (job !== undefined && (board.typeRow(job).interruptible || type === 'ThreatNearby')) board.interrupt(id, true);
    } else if (type === 'AlertChanged') {
      if (event['to'] === 'hearth') {
        const onDuty = ctx.readers.has('16')
          ? (id: EntityId) => ctx.readers.of<{ onDuty(id: EntityId): boolean }>('16').onDuty(id)
          : () => false;
        for (const id of board.workers()) {
          const jobId = board.workerOf(id).jobId;
          if (jobId !== 0 && !onDuty(id)) {
            const job = board.jobs.get(jobId);
            if (job !== undefined && board.typeRow(job).interruptible) {
              board.interrupt(id, true);
            }
          }
        }
      }
    }
  }

  override applyCommand(cmd: Command, _ctx: TickContext): CommandResult {
    const handler = COMMAND_HANDLERS[cmd.type];
    if (handler === undefined) return reject('not_found');
    const result = handler(this.board, cmd);
    return result.ok ? OK : result;
  }

  override reader(): JobsReader {
    if (this.readerRef === null) throw new Error('11 jobs: reader before init');
    return this.readerRef;
  }

  serialize(): JobsStateV1 {
    return { ...this.board.serialize(), ticked: this.producersRead };
  }

  /**
   * The producers and 13's items are connected on the first tick; a game saved after it has them
   * connected before its first loaded tick, because 10 steps workers before 11 ticks (D-082).
   */
  deserialize(state: JobsStateV1, ctx: InitContext): void {
    if (this.boardRef === null) this.init(ctx);
    this.board.deserialize(state);
    if (state.ticked === true) {
      this.readProducers();
      const connect = this.initCtx ?? ctx;
      if (connect !== undefined) this.connectItems(connect);
    }
  }
}
