/**
 * A recording 2D-canvas mock.
 *
 * `testing-strategy.md` § Tiers runs the unit tests of `render/` under jsdom, which implements
 * no 2D context; `src/platform/canvas.ts` is written against the structural `CanvasLike` /`Ctx2D`
 * interfaces exactly so that this mock can stand in for one.
 */

import type { CanvasFactory, CanvasLike, Ctx2D } from '@platform/canvas';

export interface DrawCall {
  readonly op: string;
  readonly args: readonly unknown[];
  readonly fillStyle: string;
}

export class MockCtx implements Ctx2D {
  fillStyle: string | CanvasGradient | CanvasPattern = '#000000';
  globalCompositeOperation = 'source-over';
  font = '';
  textAlign = 'start';
  textBaseline = 'alphabetic';
  imageSmoothingEnabled = true;
  readonly calls: DrawCall[] = [];
  /** Width `measureText` reports per character; the atlas fits the font to it. */
  charWidth = 10;

  private record(op: string, args: readonly unknown[]): void {
    this.calls.push({ op, args, fillStyle: String(this.fillStyle) });
  }

  of(op: string): DrawCall[] {
    return this.calls.filter((c) => c.op === op);
  }

  clearRect(x: number, y: number, w: number, h: number): void {
    this.record('clearRect', [x, y, w, h]);
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    this.record('fillRect', [x, y, w, h]);
  }

  fillText(text: string, x: number, y: number): void {
    this.record('fillText', [text, x, y]);
  }

  measureText(text: string): { width: number } {
    return { width: text.length * this.charWidth };
  }

  drawImage(
    image: unknown,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void {
    this.record('drawImage', [image, sx, sy, sw, sh, dx, dy, dw, dh]);
  }
}

export class MockCanvas implements CanvasLike {
  width: number;
  height: number;
  readonly ctx = new MockCtx();
  readonly style = { width: '', height: '' };

  constructor(width = 0, height = 0) {
    this.width = width;
    this.height = height;
  }

  getContext(_id: '2d'): Ctx2D | null {
    return this.ctx;
  }
}

/** A factory that records every canvas it made. */
export function mockCanvasFactory(): CanvasFactory & { made: MockCanvas[] } {
  const made: MockCanvas[] = [];
  const factory = ((width: number, height: number): CanvasLike => {
    const canvas = new MockCanvas(width, height);
    made.push(canvas);
    return canvas;
  }) as CanvasFactory & { made: MockCanvas[] };
  factory.made = made;
  return factory;
}
