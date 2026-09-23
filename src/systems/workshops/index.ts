/** 12 Workshops & Professions. */
import { C } from '@core/components';
import { reject, type Command, type CommandResult } from '@core/commands';
import type { CommandType } from '@core/command-types';
import type { EventType } from '@core/event-types';
import type { GameEvent } from '@core/events';
import { BaseSystem, type InitContext, type TickContext } from '@core/system';
import { WorkshopOperator } from './operate';
import { applyOrderCommand, applyWorkerCommand } from './orders';
import { makeReader, type WorkshopsReader } from './reader';
import type { WorkshopsStateV1 } from './state';

export { qualityForRoll, rollQuality } from './quality';
export { civilianProfession, militaryTitle } from './professions';
export { recipeInputFilter, outputFilter, resolveMaterial, WorkshopOperator, type RecipeRow } from './operate';
export type { WorkshopsReader } from './reader';

export const WORKSHOPS_ID = '12';

export class WorkshopsSystem extends BaseSystem<WorkshopsStateV1> {
  readonly id = WORKSHOPS_ID;
  readonly order = 12;
  override readonly ownsCommands: readonly CommandType[] = ['AddWorkOrder', 'EditWorkOrder', 'RemoveWorkOrder', 'ReorderWorkOrder', 'SetWorkshopWorker', 'SuspendWorkshop'];
  override readonly subscribes: readonly EventType[] = ['BuildingCompleted', 'BuildingRemoved', 'JobCancelled', 'JobCompleted', 'SkillLevelUp'];
  private op: WorkshopOperator | null = null;
  private readerRef: WorkshopsReader | null = null;
  private ticked = false;

  get operator(): WorkshopOperator { if (this.op === null) throw new Error('12 workshops: before init'); return this.op; }

  override init(ctx: InitContext): void {
    const op = new WorkshopOperator(ctx);
    this.op = op;
    this.readerRef = makeReader(op);
    ctx.register.jobProducer(op.producer());
    ctx.register.panel({ id: 'orders', title: 'Orders', hotkey: 'o' });
    ctx.register.inspector('building', { id: 'workshop', order: 30 });
    ctx.register.announcement('MasterworkCreated', { severity: 'note', stringKey: 'announce.masterwork' });
    ctx.register.announcement('WorkshopBlocked', { severity: 'alert', stringKey: 'announce.workshop_blocked', oneOf: { field: 'reason', values: ['no_magma'] } });
  }

  override tick(_ctx: TickContext): void {
    this.ticked = true;
    this.operator.mergeRegistered();
  }

  override handle(event: GameEvent, _ctx: TickContext): void {
    const op = this.operator;
    if (event.type === 'BuildingCompleted') op.ensure(event['id'] as number);
    else if (event.type === 'BuildingRemoved') {
      const id = event['id'] as number;
      const jobId = op.workshop(id)?.currentJobId ?? 0;
      if (jobId !== 0) op.ctx.world.services.jobs.cancel(jobId, 'building_removed');
      op.ctx.world.entities.remove(id, C.Workshop);
    }
    else if (event.type === 'SkillLevelUp') op.professionCache.delete(event['id'] as number);
  }

  override applyCommand(cmd: Command, _ctx: TickContext): CommandResult {
    this.operator.mergeRegistered();
    if (cmd.type === 'AddWorkOrder' || cmd.type === 'EditWorkOrder' || cmd.type === 'RemoveWorkOrder' || cmd.type === 'ReorderWorkOrder') return applyOrderCommand(this.operator, cmd);
    if (cmd.type === 'SetWorkshopWorker' || cmd.type === 'SuspendWorkshop') return applyWorkerCommand(this.operator, cmd);
    return reject('not_found');
  }

  override reader(): WorkshopsReader { if (this.readerRef === null) throw new Error('12 workshops: reader before init'); return this.readerRef; }

  serialize(): WorkshopsStateV1 {
    const op = this.operator;
    return { stateVersion: 1, globalOrders: op.globalOrders.map((o) => ({ ...o })),
      professionCache: Array.from(op.professionCache.entries()).sort((a, b) => a[0] - b[0]), rng: op.ctx.rng.state(), ticked: this.ticked };
  }

  deserialize(state: WorkshopsStateV1, ctx: InitContext): void {
    if (this.op === null) this.init(ctx);
    const op = this.operator;
    op.globalOrders.splice(0, op.globalOrders.length, ...state.globalOrders.map((o) => ({ ...o })));
    op.professionCache.clear();
    for (const [id, title] of state.professionCache) op.professionCache.set(id, title);
    op.ctx.rng.setState(state.rng);
    this.ticked = state.ticked;
    if (this.ticked) op.mergeRegistered();
  }
}
