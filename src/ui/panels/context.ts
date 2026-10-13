/**
 * What the fortress panels of T-M2-09 reach: the readers, the content, the strings, and the
 * command and view actions of the fortress screen (24 § Panels: "panels handle actions and submit
 * commands").
 */

import type { Command } from '@core/commands';
import type { ReaderSet } from '@core/readers';
import type { Registry } from '@core/registry';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import type { KeyPress } from '@platform/input';
import { acceleratorOf } from '../keymap';
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
  /** A message on the status row: why an action did nothing (D-U4). Absent outside the fortress screen. */
  notice?(text: string): void;
  /** An interactive pick prompt replaces an earlier status notice. */
  clearNotice?(): void;
  /** The letters that open panels: an accelerator on one of them needs `Shift` (D-U2). The defaults when absent. */
  readonly panelLetters?: ReadonlySet<string>;
  /**
   * Ask through the confirmation dialog (24 § Confirmations) and run on Yes. Absent on a bare host
   * (a test without dialogs), where {@link confirmThen} runs at once.
   */
  confirm?(id: string, params: Readonly<Record<string, string | number>>, run: () => void): void;
  /** Open the labor manager, with these dwarves marked or the cursor on one (U-06). Absent outside the app. */
  laborManager?(open: { readonly marked?: readonly EntityId[]; readonly focus?: EntityId | undefined }): void;
  /** Ask for a line of text (the `text_input` dialog): a rename (U-06). Absent outside the app. */
  prompt?(spec: { readonly title: string; readonly value: string; readonly maxLength: number }, answer: (text: string | null) => void): void;
}

/** A destructive action: ask first where the host can ask (D-U2), otherwise do it as asked. */
export function confirmThen(ctx: PanelContext, id: string, params: Readonly<Record<string, string | number>>, run: () => void): void {
  if (ctx.confirm === undefined) run();
  else ctx.confirm(id, params, run);
}

/** The accelerator a press means in a panel: see {@link acceleratorOf}. */
export function accel(ctx: PanelContext, press: KeyPress): string {
  return acceleratorOf(press, ctx.panelLetters);
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
