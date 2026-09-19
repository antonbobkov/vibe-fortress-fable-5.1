/**
 * What the fortress panels of T-M2-09 reach: the readers, the content, the strings, and the
 * command and view actions of the fortress screen (24 § Panels: "panels handle actions and submit
 * commands").
 */

import type { Command } from '@core/commands';
import type { ReaderSet } from '@core/readers';
import type { Registry } from '@core/registry';
import type { TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import type { Strings } from '../strings';

export interface PanelContext {
  readonly readers: ReaderSet;
  readonly registry: Registry;
  readonly strings: Strings;
  submit(command: Command): void;
  /** Centre the view on a tile ("Clicking a location reference … centers the map"). */
  focusOn(tile: TileIndex): void;
  /** Open the look panel on a tile. */
  look(tile: TileIndex): void;
  /** Open another panel. */
  openPanel(id: string): void;
  /** Whether the pointer's `Shift` was down for the click being handled. */
  shiftClick(): boolean;
}

export function items(ctx: PanelContext): ItemsReader | null {
  return ctx.readers.has('13') ? ctx.readers.of<ItemsReader>('13') : null;
}

export function buildings(ctx: PanelContext): BuildingsReader | null {
  return ctx.readers.has('14') ? ctx.readers.of<BuildingsReader>('14') : null;
}

/** "Numbers are shown with units; … marks as `1,250 ☼`." */
export function marks(n: number): string {
  return `${Math.round(n).toLocaleString('en-US')} ☼`;
}

export function tileXyz(ctx: PanelContext, i: TileIndex): { x: number; y: number; z: number } {
  const map = ctx.readers.map;
  return { x: i % map.w, y: Math.floor(i / map.w) % map.h, z: Math.floor(i / (map.w * map.h)) };
}
