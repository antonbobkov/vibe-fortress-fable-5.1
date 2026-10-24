/**
 * A recording 2D-canvas mock.
 *
 * `testing-strategy.md` § Tiers runs the unit tests of `render/` under jsdom, which implements
 * no 2D context; `src/platform/canvas.ts` is written against the structural `CanvasLike` /`Ctx2D`
 * interfaces exactly so that this mock can stand in for one.
 */

import type { CanvasFactory, CanvasLike, Ctx2D, ImageDataLike } from '@platform/canvas';

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

  /**
   * The pixels the recorded `fillText` calls would have made, as a stand-in font: each call fills
   * a square of the font size centred on its point. A full block covers it all; a space nothing;
   * any other character a pattern of its own in partial alphas, so the atlas's threshold has
   * work to do.
   */
  getImageData(sx: number, sy: number, sw: number, sh: number): ImageDataLike {
    const data = new Uint8ClampedArray(sw * sh * 4);
    const size = Number(/(\d+)px/.exec(this.font)?.[1] ?? 16);
    for (const call of this.of('fillText')) {
      const [text, cx, cy] = call.args as [string, number, number];
      const code = text.codePointAt(0) ?? 32;
      const x0 = Math.round(cx - size / 2);
      const y0 = Math.round(cy - size / 2);
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const px = x0 + x - sx;
          const py = y0 + y - sy;
          if (px < 0 || py < 0 || px >= sw || py >= sh) continue;
          const alpha = text === '█' ? 255 : text === ' ' ? 0 : (code * 37 + Math.floor(x / 4) * 53 + Math.floor(y / 4) * 91 + x + y) % 256;
          data[(py * sw + px) * 4 + 3] = alpha;
        }
      }
    }
    return { width: sw, height: sh, data };
  }

  createImageData(sw: number, sh: number): ImageDataLike {
    return { width: sw, height: sh, data: new Uint8ClampedArray(sw * sh * 4) };
  }

  /** The last image written, for the tests to read. */
  image: ImageDataLike | null = null;

  putImageData(image: ImageDataLike, dx: number, dy: number): void {
    this.image = image;
    this.record('putImageData', [dx, dy, image.width, image.height]);
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
