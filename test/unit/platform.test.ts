/**
 * T-M0-12's platform layer: the canvas adapter, the input normaliser and the frame scheduler.
 *
 * The modules take their DOM surfaces as arguments (`01-architecture/architecture-overview.md`
 * § Dependency rule: "the small `platform` interfaces injected at startup"), so these run in the
 * plain Node environment against stubs.
 */

import { describe, it, expect, vi } from 'vitest';
import { CanvasSurface, domCanvasFactory, type CanvasLike } from '@platform/canvas';
import {
  InputSource,
  normalizeKey,
  type EventTargetLike,
  type KeyPress,
  type PointerAction,
  type WheelAction,
} from '@platform/input';
import {
  FrameLoop,
  browserFrameScheduler,
  browserHidden,
  browserNow,
  type FrameScheduler,
} from '@platform/realtime';
import { MockCanvas } from './render/canvas-mock';

describe('T-M0-12 platform: the canvas surface', () => {
  it('sizes the backing store in device pixels and the element in CSS pixels', () => {
    const canvas = new MockCanvas();
    const surface = new CanvasSurface(canvas, { devicePixelRatio: 2 });
    surface.resize(800, 600, 2);
    expect(surface.widthPx).toBe(1600);
    expect(surface.heightPx).toBe(1200);
    expect(surface.cssWidth).toBe(800);
    expect(surface.cssHeight).toBe(600);
    expect(surface.pixelRatio).toBe(2);
    expect(canvas.style.width).toBe('800px');
    expect(canvas.style.height).toBe('600px');
  });

  it('applies the CSS scale of the step-down rule without shrinking the grid', () => {
    const canvas = new MockCanvas();
    const surface = new CanvasSurface(canvas);
    surface.resize(960, 540, 1, 0.5);
    expect(surface.widthPx).toBe(960);
    expect(canvas.style.width).toBe('480px');
    expect(canvas.style.height).toBe('270px');
  });

  it('does not touch the backing store when the size did not change', () => {
    const canvas = new MockCanvas();
    const surface = new CanvasSurface(canvas);
    surface.resize(400, 300, 1);
    canvas.ctx.calls.length = 0;
    const before = canvas.width;
    surface.resize(400, 300, 1);
    expect(canvas.width).toBe(before);
    expect(surface.ctx).toBe(canvas.ctx);
  });

  it('refuses a canvas with no 2D context', () => {
    const blind: CanvasLike = { width: 0, height: 0, getContext: () => null };
    expect(() => new CanvasSurface(blind)).toThrow(/no 2D context/);
  });

  it('makes offscreen canvases through the document', () => {
    const created: MockCanvas[] = [];
    const doc = {
      createElement: (tag: string) => {
        expect(tag).toBe('canvas');
        const canvas = new MockCanvas();
        created.push(canvas);
        return canvas;
      },
    } as unknown as Document;
    const canvas = domCanvasFactory(doc)(64, 16);
    expect(created).toHaveLength(1);
    expect(canvas.width).toBe(64);
    expect(canvas.height).toBe(16);
  });
});

describe('T-M0-12 platform: input normalisation', () => {
  interface Listener {
    type: string;
    fn: (event: unknown) => void;
  }

  function target(): EventTargetLike & { listeners: Listener[]; fire(type: string, event: unknown): void } {
    const listeners: Listener[] = [];
    return {
      listeners,
      addEventListener(type: string, fn: (event: never) => void): void {
        listeners.push({ type, fn: fn as (event: unknown) => void });
      },
      removeEventListener(type: string, fn: (event: never) => void): void {
        const at = listeners.findIndex((l) => l.type === type && l.fn === fn);
        if (at >= 0) listeners.splice(at, 1);
      },
      fire(type: string, event: unknown): void {
        for (const l of listeners.filter((x) => x.type === type)) l.fn(event);
      },
    };
  }

  it('spells keys the way the keymap table does', () => {
    expect(normalizeKey('Escape')).toBe('Esc');
    expect(normalizeKey('ArrowLeft')).toBe('←');
    expect(normalizeKey('ArrowDown')).toBe('↓');
    expect(normalizeKey('>')).toBe('>');
    expect(normalizeKey('F5')).toBe('F5');
  });

  it('forwards keys with their modifiers and swallows the ones the game uses', () => {
    const keys: KeyPress[] = [];
    const dom = target();
    const source = new InputSource(dom, dom, { onKey: (key) => keys.push(key) });
    source.attach();
    const prevented = vi.fn();
    dom.fire('keydown', {
      key: 'ArrowUp',
      shiftKey: true,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      preventDefault: prevented,
    });
    dom.fire('keydown', {
      key: '>',
      shiftKey: false,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      repeat: true,
      preventDefault: prevented,
    });
    expect(keys).toEqual([
      { key: '↑', repeat: false, shift: true, ctrl: false, alt: false, meta: false },
      { key: '>', repeat: true, shift: false, ctrl: false, alt: false, meta: false },
    ]);
    expect(prevented).toHaveBeenCalledTimes(1);
  });

  it('maps pointer and wheel events into the canvas', () => {
    const downs: PointerAction[] = [];
    const moves: PointerAction[] = [];
    const ups: PointerAction[] = [];
    const wheels: WheelAction[] = [];
    const dom = target();
    const source = new InputSource(
      dom,
      dom,
      {
        onPointerDown: (a) => downs.push(a),
        onPointerMove: (a) => moves.push(a),
        onPointerUp: (a) => ups.push(a),
        onWheel: (a) => wheels.push(a),
      },
      { toLocal: (x, y) => ({ x: x - 10, y: y - 20 }) },
    );
    source.attach();
    const base = { shiftKey: false, ctrlKey: false, altKey: false, metaKey: false };
    dom.fire('mousedown', { ...base, clientX: 50, clientY: 60, button: 2 });
    dom.fire('mousemove', { ...base, clientX: 50, clientY: 60 });
    dom.fire('mouseup', { ...base, clientX: 50, clientY: 60, button: 0 });
    dom.fire('wheel', { ...base, ctrlKey: true, clientX: 10, clientY: 20, deltaY: -120 });
    expect(downs[0]).toEqual({ x: 40, y: 40, button: 2, clicks: 1, shift: false, ctrl: false, alt: false, meta: false });
    expect(moves[0]?.x).toBe(40);
    expect(ups[0]?.button).toBe(0);
    // T-M7-09: `MouseEvent.detail` is the click count, which § Mouse's double-click row needs.
    dom.fire('mousedown', { ...base, clientX: 50, clientY: 60, button: 0, detail: 2 });
    expect(downs[1]?.clicks).toBe(2);
    expect(wheels[0]).toEqual({ x: 0, y: 0, dx: 0, dy: -120, shift: false, ctrl: true, alt: false, meta: false });
  });

  it('removes every listener it added', () => {
    const dom = target();
    const source = new InputSource(dom, dom, {});
    source.attach();
    expect(dom.listeners.length).toBe(5);
    source.dispose();
    expect(dom.listeners.length).toBe(0);
  });
});

describe('T-M0-12 platform: the frame loop', () => {
  function scheduler(): FrameScheduler & { run(ms: number): void; cancelled: number[] } {
    let next = 1;
    const pending = new Map<number, (ms: number) => void>();
    const cancelled: number[] = [];
    return {
      cancelled,
      request(callback): number {
        const handle = next;
        next += 1;
        pending.set(handle, callback);
        return handle;
      },
      cancel(handle): void {
        cancelled.push(handle);
        pending.delete(handle);
      },
      run(ms: number): void {
        const due = Array.from(pending.entries());
        pending.clear();
        for (const [, callback] of due) callback(ms);
      },
    };
  }

  it('reschedules itself until it is stopped and reports the hidden tab', () => {
    const sched = scheduler();
    let hidden = false;
    const loop = new FrameLoop({ scheduler: sched, hidden: () => hidden });
    const frames: { ms: number; hidden: boolean }[] = [];
    loop.start((ms, isHidden) => frames.push({ ms, hidden: isHidden }));
    expect(loop.running).toBe(true);
    sched.run(16);
    hidden = true;
    sched.run(32);
    expect(frames).toEqual([
      { ms: 16, hidden: false },
      { ms: 32, hidden: true },
    ]);
    loop.stop();
    expect(loop.running).toBe(false);
    expect(sched.cancelled).toHaveLength(1);
    sched.run(48);
    expect(frames).toHaveLength(2);
  });

  it('start is idempotent and stop before start is harmless', () => {
    const sched = scheduler();
    const loop = new FrameLoop({ scheduler: sched });
    loop.stop();
    const frames: number[] = [];
    loop.start((ms) => frames.push(ms));
    loop.start(() => frames.push(-1));
    sched.run(8);
    expect(frames).toEqual([8]);
    loop.stop();
  });

  it('reads the clock, the scheduler and the visibility from the environment', () => {
    const g = globalThis as Record<string, unknown>;
    expect(browserNow()()).toBeGreaterThanOrEqual(0);
    expect(browserHidden()()).toBe(false);
    expect(() => browserFrameScheduler()).toThrow(/requestAnimationFrame/);

    const saved = { raf: g['requestAnimationFrame'], caf: g['cancelAnimationFrame'], doc: g['document'] };
    try {
      const calls: number[] = [];
      g['requestAnimationFrame'] = (cb: (ms: number) => void): number => {
        cb(4);
        return 7;
      };
      g['cancelAnimationFrame'] = (handle: number): void => {
        calls.push(handle);
      };
      g['document'] = { hidden: true };
      const sched = browserFrameScheduler();
      let seen = 0;
      expect(sched.request((ms) => (seen = ms))).toBe(7);
      expect(seen).toBe(4);
      sched.cancel(7);
      expect(calls).toEqual([7]);
      expect(browserHidden()()).toBe(true);
    } finally {
      if (saved.raf === undefined) delete g['requestAnimationFrame'];
      else g['requestAnimationFrame'] = saved.raf;
      if (saved.caf === undefined) delete g['cancelAnimationFrame'];
      else g['cancelAnimationFrame'] = saved.caf;
      if (saved.doc === undefined) delete g['document'];
      else g['document'] = saved.doc;
    }
  });
});
