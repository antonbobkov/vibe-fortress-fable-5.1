/**
 * The canvas adapter (L0).
 *
 * Implements `01-architecture/architecture-overview.md` § Module map (`platform/canvas.ts`) and
 * `02-systems/23-rendering.md` § Canvas and cells: "One `<canvas>` filling the window, sized in
 * device pixels (`devicePixelRatio` aware), CSS-sized to the window."
 *
 * Everything above L0 talks to the structural interfaces below, never to `HTMLCanvasElement`, so
 * the renderer and the atlas run under a mock in unit tests (`testing-strategy.md`: unit tests
 * of `render/` run in jsdom, which has no 2D context).
 */

/** The subset of `CanvasRenderingContext2D` the renderer and the atlas use. */
export interface Ctx2D {
  fillStyle: string | CanvasGradient | CanvasPattern;
  globalCompositeOperation: GlobalCompositeOperation | string;
  font: string;
  textAlign: CanvasTextAlign | string;
  textBaseline: CanvasTextBaseline | string;
  imageSmoothingEnabled: boolean;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
  /** `image` is a {@link CanvasLike} sheet; it is typed loosely so a mock canvas fits too. */
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
  ): void;
}

/** The subset of `HTMLCanvasElement` the platform uses. */
export interface CanvasLike {
  width: number;
  height: number;
  getContext(id: '2d'): Ctx2D | null;
  readonly style?: { width: string; height: string };
}

/** Creates an offscreen canvas of a pixel size; the atlas builds its sheets through one. */
export type CanvasFactory = (width: number, height: number) => CanvasLike;

/** `document.createElement('canvas')` as a {@link CanvasFactory}. */
export function domCanvasFactory(doc: Document): CanvasFactory {
  return (width, height) => {
    const element = doc.createElement('canvas') as unknown as CanvasLike;
    element.width = width;
    element.height = height;
    return element;
  };
}

export interface SurfaceOptions {
  /** Device pixels per CSS pixel; the app passes `window.devicePixelRatio`. */
  readonly devicePixelRatio?: number;
  /** Cell grids are pixel art: keep the atlas blits sharp. */
  readonly smoothing?: boolean;
}

/**
 * One canvas plus its 2D context, sized in device pixels and CSS-sized to the window.
 *
 * `resize` is idempotent: it only touches the element when the size actually changed, because
 * writing `canvas.width` clears the canvas.
 */
export class CanvasSurface {
  readonly canvas: CanvasLike;
  readonly ctx: Ctx2D;
  private dpr: number;
  private cssW = 0;
  private cssH = 0;
  private readonly smoothing: boolean;

  constructor(canvas: CanvasLike, options: SurfaceOptions = {}) {
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('canvas: no 2D context');
    this.canvas = canvas;
    this.ctx = ctx;
    this.dpr = options.devicePixelRatio ?? 1;
    this.smoothing = options.smoothing ?? false;
    this.ctx.imageSmoothingEnabled = this.smoothing;
  }

  /** Width in device pixels; the renderer draws in this space. */
  get widthPx(): number {
    return this.canvas.width;
  }

  get heightPx(): number {
    return this.canvas.height;
  }

  get pixelRatio(): number {
    return this.dpr;
  }

  /** CSS width in pixels, which may be smaller than the device width. */
  get cssWidth(): number {
    return this.cssW;
  }

  get cssHeight(): number {
    return this.cssH;
  }

  /**
   * Size the backing store to `cssWidth × dpr` device pixels and the element to `cssWidth` CSS
   * pixels. `cssScale` below 1 is the step-down rule's CSS scaling (23 § Canvas and cells): the
   * backing store keeps the full grid and the element is drawn smaller.
   */
  resize(cssWidth: number, cssHeight: number, dpr = this.dpr, cssScale = 1): void {
    const w = Math.max(1, Math.floor(cssWidth * dpr));
    const h = Math.max(1, Math.floor(cssHeight * dpr));
    this.dpr = dpr;
    this.cssW = cssWidth;
    this.cssH = cssHeight;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.ctx.imageSmoothingEnabled = this.smoothing;
    }
    const style = this.canvas.style;
    if (style !== undefined) {
      style.width = `${Math.floor(cssWidth * cssScale)}px`;
      style.height = `${Math.floor(cssHeight * cssScale)}px`;
    }
  }
}
