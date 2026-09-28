/**
 * Screens.
 *
 * `02-systems/24-ui-and-input.md` § Concepts: "**Screen**: a full-window mode on a stack:
 * `main_menu`, `world_gen`, `world_map`, `embark`, `fortress`, …". A screen draws itself as text
 * cells into the frame's buffer and turns keys and mouse gestures into actions; everything it
 * cannot do itself (generate a world, build the local map, change screens) it asks of the app
 * through the {@link ScreenHost} it is given, because `ui/` may not import `app/` (tooling.md
 * § ESLint boundaries).
 */

import type { KeyPress, Modifiers } from '@platform/input';
import type { Surface } from './surface';

export type ScreenId =
  | 'main_menu'
  | 'world_gen'
  | 'world_map'
  | 'embark'
  | 'fortress'
  | 'legend'
  | 'game_menu'
  | 'settings'
  | 'load'
  | 'trade_session'
  | 'confirm'
  | 'text_input';

/** A mouse gesture in cell coordinates (`algorithms/compositor.md` § Mouse mapping). */
export interface CellPointer extends Modifiers {
  readonly col: number;
  readonly row: number;
  /** 0 left, 1 middle, 2 right. */
  readonly button: number;
}

export interface CellWheel extends Modifiers {
  readonly col: number;
  readonly row: number;
  /** Positive: wheel down. */
  readonly dy: number;
}

export interface Screen {
  readonly id: ScreenId;
  /** Draw into the frame's buffer; widgets record their clickable regions on the surface. */
  draw(surface: Surface): void;
  /** Returns whether the key was consumed. */
  key(press: KeyPress): boolean;
  pointerDown?(p: CellPointer): void;
  pointerMove?(p: CellPointer): void;
  pointerUp?(p: CellPointer): void;
  wheel?(w: CellWheel): void;
}

/** Click the widget under a pointer-down, from the regions the last frame recorded. */
export function clickHit(surface: Surface | null, p: CellPointer): boolean {
  if (surface === null || p.button !== 0) return false;
  const hit = surface.hitAt(p.col, p.row);
  if (hit === null) return false;
  hit.action();
  return true;
}
