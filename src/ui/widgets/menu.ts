/**
 * `Menu` (24 § Concepts › Widget): a vertical list of `[k] Label` entries with a `▶` marking the
 * selection, as the main menu draws it (`ui-screens/menus-and-world.md` § Main menu). Hidden
 * entries take no row; disabled ones are dim and cannot be chosen.
 */

import type { Surface } from '../surface';
import { label } from './label';

export interface MenuItem {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  /** Extra text after the label, dimmed (`Continue   (Emberhall · Year 2)`). */
  readonly detail?: string;
  readonly hidden?: boolean;
  readonly enabled?: boolean;
}

export const MENU_MARK = '▶';

/** The entries a menu shows, in order. */
export function visibleItems(items: readonly MenuItem[]): MenuItem[] {
  return items.filter((i) => i.hidden !== true);
}

/**
 * Move a selection by `delta` over the visible, enabled entries, wrapping; returns the new id.
 */
export function moveSelection(items: readonly MenuItem[], selected: string, delta: number): string {
  const choices = visibleItems(items).filter((i) => i.enabled !== false);
  if (choices.length === 0) return selected;
  const at = Math.max(0, choices.findIndex((i) => i.id === selected));
  const next = (((at + delta) % choices.length) + choices.length) % choices.length;
  return (choices[next] as MenuItem).id;
}

export function menu(
  s: Surface,
  col: number,
  row: number,
  items: readonly MenuItem[],
  selected: string,
  onChoose: (id: string) => void,
): number {
  let r = row;
  for (const item of visibleItems(items)) {
    const enabled = item.enabled !== false;
    if (item.id === selected) s.text(col, r, MENU_MARK, s.theme.key);
    const caption = `[${item.key}] ${item.label}`;
    const n = enabled ? label(s, col + 2, r, caption) : s.text(col + 2, r, caption, s.theme.dim);
    let width = n;
    if (item.detail !== undefined) width += s.text(col + 2 + n, r, `   ${item.detail}`, s.theme.dim);
    if (enabled) s.hit({ col, row: r, cols: width + 2, rows: 1 }, () => onChoose(item.id));
    r += 1;
  }
  return r - row;
}
