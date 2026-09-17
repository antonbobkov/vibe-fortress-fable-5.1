/**
 * Keyboard and mouse (L0).
 *
 * Implements `01-architecture/architecture-overview.md` § Module map (`platform/input.ts`): the
 * platform normalises DOM events into the small records below and hands them up. Which key means
 * what is the keymap's business (`03-content/ui-keymap-and-screens.md`, read by `ui/keymap.ts` in
 * T-M1-14); this layer never interprets.
 *
 * Key names are the DOM `KeyboardEvent.key` values the keymap table already uses (`Escape` is
 * normalised to the table's `Esc`, arrows to `←` `→` `↑` `↓`).
 */

/** The DOM surface the input source attaches to. */
export interface EventTargetLike {
  addEventListener(type: string, listener: (event: never) => void, options?: unknown): void;
  removeEventListener(type: string, listener: (event: never) => void, options?: unknown): void;
}

export interface Modifiers {
  readonly shift: boolean;
  readonly ctrl: boolean;
  readonly alt: boolean;
  readonly meta: boolean;
}

export interface KeyPress extends Modifiers {
  /** The keymap's spelling: `Esc`, `←`, `>`, `a`, `F5`. */
  readonly key: string;
  readonly repeat: boolean;
}

export interface PointerAction extends Modifiers {
  /** Pixels from the top-left of the target element. */
  readonly x: number;
  readonly y: number;
  /** 0 left, 1 middle, 2 right. */
  readonly button: number;
}

export interface WheelAction extends Modifiers {
  readonly x: number;
  readonly y: number;
  readonly dx: number;
  readonly dy: number;
}

export interface InputHandlers {
  onKey?(key: KeyPress): void;
  onPointerDown?(action: PointerAction): void;
  onPointerUp?(action: PointerAction): void;
  onPointerMove?(action: PointerAction): void;
  onWheel?(action: WheelAction): void;
}

const KEY_ALIASES: Readonly<Record<string, string>> = {
  Escape: 'Esc',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
};

/** The keymap's spelling of a DOM `KeyboardEvent.key`. */
export function normalizeKey(key: string): string {
  return KEY_ALIASES[key] ?? key;
}

interface KeyboardEventLike {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  repeat?: boolean;
  preventDefault?(): void;
}

interface MouseEventLike {
  clientX: number;
  clientY: number;
  button?: number;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  deltaX?: number;
  deltaY?: number;
  preventDefault?(): void;
}

function modifiers(event: KeyboardEventLike | MouseEventLike): Modifiers {
  return {
    shift: event.shiftKey === true,
    ctrl: event.ctrlKey === true,
    alt: event.altKey === true,
    meta: event.metaKey === true,
  };
}

export interface InputOptions {
  /** Maps client coordinates to coordinates inside the canvas; identity by default. */
  readonly toLocal?: (x: number, y: number) => { x: number; y: number };
  /** Keys the game consumes, so the browser does not scroll the page; default: arrows and space. */
  readonly swallow?: (key: KeyPress) => boolean;
}

const DEFAULT_SWALLOW = new Set(['←', '→', '↑', '↓', ' ', 'Tab']);

/**
 * Attaches to a keyboard target and a pointer target and forwards normalised events. `dispose()`
 * removes every listener it added.
 */
export class InputSource {
  private readonly disposers: (() => void)[] = [];
  private readonly toLocal: (x: number, y: number) => { x: number; y: number };
  private readonly swallow: (key: KeyPress) => boolean;

  constructor(
    private readonly keyTarget: EventTargetLike,
    private readonly pointerTarget: EventTargetLike,
    private readonly handlers: InputHandlers,
    options: InputOptions = {},
  ) {
    this.toLocal = options.toLocal ?? ((x, y) => ({ x, y }));
    this.swallow = options.swallow ?? ((key) => DEFAULT_SWALLOW.has(key.key));
  }

  attach(): void {
    this.on(this.keyTarget, 'keydown', (event: KeyboardEventLike) => {
      const press: KeyPress = {
        key: normalizeKey(event.key),
        repeat: event.repeat === true,
        ...modifiers(event),
      };
      if (this.swallow(press)) event.preventDefault?.();
      this.handlers.onKey?.(press);
    });
    this.on(this.pointerTarget, 'mousedown', (event: MouseEventLike) =>
      this.handlers.onPointerDown?.(this.pointer(event)),
    );
    this.on(this.pointerTarget, 'mouseup', (event: MouseEventLike) =>
      this.handlers.onPointerUp?.(this.pointer(event)),
    );
    this.on(this.pointerTarget, 'mousemove', (event: MouseEventLike) =>
      this.handlers.onPointerMove?.(this.pointer(event)),
    );
    this.on(this.pointerTarget, 'wheel', (event: MouseEventLike) => {
      const at = this.toLocal(event.clientX, event.clientY);
      this.handlers.onWheel?.({
        x: at.x,
        y: at.y,
        dx: event.deltaX ?? 0,
        dy: event.deltaY ?? 0,
        ...modifiers(event),
      });
    });
  }

  dispose(): void {
    for (let i = this.disposers.length - 1; i >= 0; i -= 1) (this.disposers[i] as () => void)();
    this.disposers.length = 0;
  }

  private pointer(event: MouseEventLike): PointerAction {
    const at = this.toLocal(event.clientX, event.clientY);
    return { x: at.x, y: at.y, button: event.button ?? 0, ...modifiers(event) };
  }

  private on<T>(target: EventTargetLike, type: string, listener: (event: T) => void): void {
    const wrapped = listener as (event: never) => void;
    target.addEventListener(type, wrapped);
    this.disposers.push(() => target.removeEventListener(type, wrapped));
  }
}
