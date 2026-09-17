/**
 * The real-time clock and the frame scheduler (L0).
 *
 * Implements `01-architecture/architecture-overview.md` § Module map (`platform/realtime.ts`) and
 * `01-architecture/tech-stack.md` § Frame and simulation loop: "`requestAnimationFrame` drives
 * rendering at up to `TARGET_FPS`" and "When the tab is hidden, the simulation pauses."
 *
 * Wall-clock time enters the program only here and is injected into the simulation as the `Clock`
 * of `core/system.ts` (DECISIONS.md D-017), because `core` may not read `performance`.
 */

/** Milliseconds since an arbitrary origin; monotonic. */
export type Now = () => number;

export interface FrameScheduler {
  request(callback: (nowMs: number) => void): number;
  cancel(handle: number): void;
}

/** `performance.now()` when it exists, otherwise the frame timestamp's own origin. */
export function browserNow(): Now {
  const perf = (globalThis as { performance?: { now(): number } }).performance;
  if (perf !== undefined && typeof perf.now === 'function') return () => perf.now();
  return () => 0;
}

/** `requestAnimationFrame` as a {@link FrameScheduler}. */
export function browserFrameScheduler(): FrameScheduler {
  const g = globalThis as {
    requestAnimationFrame?: (cb: (ms: number) => void) => number;
    cancelAnimationFrame?: (handle: number) => void;
  };
  const raf = g.requestAnimationFrame;
  const caf = g.cancelAnimationFrame;
  if (raf === undefined || caf === undefined) {
    throw new Error('realtime: this environment has no requestAnimationFrame');
  }
  return { request: (cb) => raf(cb), cancel: (handle) => caf(handle) };
}

/** `document.hidden`, or always-visible where there is no document. */
export function browserHidden(): () => boolean {
  const doc = (globalThis as { document?: { hidden: boolean } }).document;
  if (doc === undefined) return () => false;
  return () => doc.hidden === true;
}

export interface FrameLoopOptions {
  readonly scheduler: FrameScheduler;
  readonly hidden?: () => boolean;
}

/**
 * One `requestAnimationFrame` loop. The callback is handed the frame timestamp and whether the
 * tab is hidden; what to do about either is the host's rule (`simulation-core.md` § The frame
 * loop), not the platform's.
 */
export class FrameLoop {
  private readonly scheduler: FrameScheduler;
  private readonly hidden: () => boolean;
  private handle: number | null = null;
  private callback: ((nowMs: number, hidden: boolean) => void) | null = null;

  constructor(options: FrameLoopOptions) {
    this.scheduler = options.scheduler;
    this.hidden = options.hidden ?? ((): boolean => false);
  }

  get running(): boolean {
    return this.handle !== null;
  }

  start(onFrame: (nowMs: number, hidden: boolean) => void): void {
    if (this.handle !== null) return;
    this.callback = onFrame;
    this.schedule();
  }

  stop(): void {
    if (this.handle !== null) this.scheduler.cancel(this.handle);
    this.handle = null;
    this.callback = null;
  }

  private schedule(): void {
    this.handle = this.scheduler.request((nowMs) => {
      this.handle = null;
      const callback = this.callback;
      if (callback === null) return;
      this.schedule();
      callback(nowMs, this.hidden());
    });
  }
}
