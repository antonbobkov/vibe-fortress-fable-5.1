/**
 * Stand-in systems for the `core_*` scenarios of M0.
 *
 * `M0-skeleton.md` T-M0-08 asks for `core_event_order`, `core_command_rejection` and
 * `core_calendar` "with no real systems": they pin the core machinery (the tick of
 * `simulation-core.md` § The tick), not any system's rules. A stand-in implements the system
 * contract of `module-interfaces.md` with a real system id and order, records what the core does
 * to it, and owns no rule beyond what the scenario states. See DECISIONS.md D-036.
 *
 * Not a `*.scenario.ts` file, so `index.test.ts` does not collect it.
 */

import { BaseSystem, type SystemId, type TickContext } from '@core/system';
import type { Command, CommandResult } from '@core/commands';
import type { CommandType } from '@core/command-types';
import type { EventType } from '@core/event-types';
import type { GameEvent } from '@core/events';

export interface StandInOptions {
  readonly subscribes?: readonly EventType[];
  readonly ownsCommands?: readonly CommandType[];
  readonly onTick?: (ctx: TickContext) => void;
  readonly onCommand?: (cmd: Command, ctx: TickContext) => CommandResult;
}

export class StandInSystem extends BaseSystem<{ handled: number }> {
  readonly id: SystemId;
  readonly order: number;
  override readonly subscribes: readonly EventType[];
  override readonly ownsCommands: readonly CommandType[];
  /** Every event handled, as `<tick>:<type>`, in the order the core delivered them. */
  readonly handled: string[] = [];
  private readonly options: StandInOptions;
  /** A log shared by several stand-ins, so the scenario sees the order across systems. */
  readonly sharedLog: string[] | null;

  constructor(id: SystemId, order: number, options: StandInOptions = {}, sharedLog: string[] | null = null) {
    super();
    this.id = id;
    this.order = order;
    this.subscribes = options.subscribes ?? [];
    this.ownsCommands = options.ownsCommands ?? [];
    this.options = options;
    this.sharedLog = sharedLog;
  }

  override tick(ctx: TickContext): void {
    this.options.onTick?.(ctx);
  }

  override handle(event: GameEvent, ctx: TickContext): void {
    this.handled.push(`${ctx.tick}:${event.type}`);
    this.sharedLog?.push(`${this.id}:${event.type}`);
  }

  override applyCommand(cmd: Command, ctx: TickContext): CommandResult {
    return this.options.onCommand?.(cmd, ctx) ?? { ok: false, reason: 'not_found' };
  }

  serialize(): { handled: number } {
    return { handled: this.handled.length };
  }

  deserialize(): void {}
}
