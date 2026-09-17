/**
 * The event queue.
 *
 * Implements `01-architecture/simulation-core.md` § Events and § The tick step 3: events are
 * queued by `ctx.emit`, drained once per tick in emission order, and delivered to every subscribed
 * system in system order and then to the presentation listeners. Events emitted while a batch is
 * being dispatched stay in the queue for the next tick, which is what `drain()` taking the whole
 * batch at once gives for free.
 */

import type { EventType } from './event-types';

/** A plain record with a `type` and typed fields. Fields are ids and plain values, never objects. */
export interface GameEvent {
  readonly type: EventType;
  readonly [field: string]: unknown;
}

export type EventListener = (events: readonly GameEvent[]) => void;
export type Unsubscribe = () => void;

/** FIFO, one batch per tick. */
export class EventQueue {
  private pending: GameEvent[] = [];
  private sealed = false;

  /** Number of events waiting for the next drain. */
  get size(): number {
    return this.pending.length;
  }

  /**
   * Queue an event. Nothing runs when this is called.
   * Throws while the queue is sealed, which is how the rule "presentation listeners may not emit
   * events" is enforced.
   */
  emit(event: GameEvent): void {
    if (this.sealed) {
      throw new Error(`a presentation listener may not emit events (tried ${event.type})`);
    }
    this.pending.push(event);
  }

  /** Take the whole queued batch, in emission order, leaving the queue empty. */
  drain(): GameEvent[] {
    const batch = this.pending;
    this.pending = [];
    return batch;
  }

  /** The queued events without removing them; for the debug panel and tests. */
  peek(): readonly GameEvent[] {
    return this.pending;
  }

  /** Refuse emissions until {@link unseal}. */
  seal(): void {
    this.sealed = true;
  }

  unseal(): void {
    this.sealed = false;
  }

  get isSealed(): boolean {
    return this.sealed;
  }

  clear(): void {
    this.pending = [];
    this.sealed = false;
  }
}

/**
 * The presentation-side listener list. Listeners receive every event after all systems have
 * handled it; they may submit commands but not emit events.
 */
export class EventListeners {
  private readonly listeners: EventListener[] = [];

  add(listener: EventListener): Unsubscribe {
    this.listeners.push(listener);
    return () => {
      const i = this.listeners.indexOf(listener);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }

  get count(): number {
    return this.listeners.length;
  }

  /** Deliver a batch, in registration order. */
  deliver(events: readonly GameEvent[]): void {
    if (events.length === 0) return;
    for (let i = 0; i < this.listeners.length; i += 1) {
      (this.listeners[i] as EventListener)(events);
    }
  }

  clear(): void {
    this.listeners.length = 0;
  }
}

/**
 * The dispatch table the scheduler builds at startup from each system's static `subscribes` list.
 * Subscribers are kept in system order.
 */
export class EventDispatchTable<S extends { readonly subscribes: readonly EventType[] }> {
  private readonly byType = new Map<EventType, S[]>();

  /** `systems` must already be in the fixed system order. */
  constructor(systems: readonly S[]) {
    for (const system of systems) {
      for (const type of system.subscribes) {
        const list = this.byType.get(type);
        if (list === undefined) this.byType.set(type, [system]);
        else list.push(system);
      }
    }
  }

  subscribersTo(type: EventType): readonly S[] {
    return this.byType.get(type) ?? EMPTY;
  }

  types(): readonly EventType[] {
    return Array.from(this.byType.keys()).sort();
  }
}

const EMPTY: readonly never[] = Object.freeze([]);
