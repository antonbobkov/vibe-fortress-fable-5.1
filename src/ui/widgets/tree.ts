/**
 * `Tree` (24 § Concepts › Widget): the stockpile filter's category tree "with tri-state for partial
 * subtrees" (`13` § Player-facing behavior; `ui-screens/panels.md` § Zones: `[■] all`, `[□]`,
 * `[▪] partial`).
 *
 * The selection is a set of node paths, each meaning "this node and everything under it" (13's
 * `categoryUnder`). A node is `all` when it or an ancestor is selected, `none` when nothing at or
 * below it is, and `partial` otherwise. Toggling an `all` node deselects exactly its subtree
 * (a selected ancestor is split into its other children); toggling any other node selects its
 * subtree; a parent whose every child is selected is stored as the parent. The stored set is
 * always sorted and minimal.
 */

import type { Rect } from '@render/cellbuffer';
import type { Surface } from '../surface';
import { label } from './label';

export type TriState = 'all' | 'none' | 'partial';

export interface TreeNode {
  readonly id: string;
  readonly name: string;
  readonly children: readonly TreeNode[];
}

/** A forest from category paths (`food`, `food/meat`, …), in the order the paths are given. */
export function buildTree(paths: readonly string[]): TreeNode[] {
  const byId = new Map<string, { id: string; name: string; children: TreeNode[] }>();
  const roots: TreeNode[] = [];
  for (const path of paths) {
    if (byId.has(path)) continue;
    const parts = path.split('/');
    const node = { id: path, name: parts[parts.length - 1] as string, children: [] as TreeNode[] };
    byId.set(path, node);
    const parent = byId.get(parts.slice(0, -1).join('/'));
    if (parts.length > 1 && parent !== undefined) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

function parentOf(id: string): string | null {
  const at = id.lastIndexOf('/');
  return at < 0 ? null : id.slice(0, at);
}

function under(id: string, node: string): boolean {
  return id === node || id.startsWith(`${node}/`);
}

export function findNode(forest: readonly TreeNode[], id: string): TreeNode | undefined {
  for (const n of forest) {
    if (n.id === id) return n;
    if (under(id, n.id)) {
      const found = findNode(n.children, id);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/** The tri-state of a node under a selection. */
export function nodeState(selected: readonly string[], id: string): TriState {
  if (selected.some((s) => under(id, s))) return 'all';
  if (selected.some((s) => under(s, id))) return 'partial';
  return 'none';
}

/** Toggle a node: the new, sorted, minimal selection. */
export function toggleNode(forest: readonly TreeNode[], selected: readonly string[], id: string): string[] {
  const set = new Set(selected);
  if (nodeState(selected, id) === 'all') {
    const holder = selected.find((s) => under(id, s)) as string;
    set.delete(holder);
    // Split the selected ancestor into the siblings along the path down to the node.
    let cur = holder;
    while (cur !== id) {
      const node = findNode(forest, cur);
      if (node === undefined) break;
      const next = node.children.find((c) => under(id, c.id));
      if (next === undefined) break;
      for (const c of node.children) if (c.id !== next.id) set.add(c.id);
      cur = next.id;
    }
  } else {
    for (const s of Array.from(set)) if (under(s, id)) set.delete(s);
    set.add(id);
    // Collapse upward while every child of the parent is selected.
    let cur: string | null = id;
    for (;;) {
      const parent: string | null = cur === null ? null : parentOf(cur);
      if (parent === null) break;
      const node = findNode(forest, parent);
      if (node === undefined || node.children.length === 0 || !node.children.every((c) => set.has(c.id))) break;
      for (const c of node.children) set.delete(c.id);
      set.add(parent);
      cur = parent;
    }
  }
  return Array.from(set).sort();
}

/** The glyph of a state: `■` all, `□` none, `▪` partial. */
export function stateGlyph(state: TriState): string {
  return state === 'all' ? '■' : state === 'partial' ? '▪' : '□';
}

export interface TreeRow {
  readonly node: TreeNode;
  readonly depth: number;
}

/** The visible rows: roots, and the children of every expanded node, depth first. */
export function visibleRows(forest: readonly TreeNode[], expanded: ReadonlySet<string>): TreeRow[] {
  const out: TreeRow[] = [];
  const walk = (nodes: readonly TreeNode[], depth: number): void => {
    for (const n of nodes) {
      out.push({ node: n, depth });
      if (expanded.has(n.id)) walk(n.children, depth + 1);
    }
  };
  walk(forest, 0);
  return out;
}

export interface TreeState {
  selected: number;
  scroll: number;
  readonly expanded: Set<string>;
}

/**
 * Draw the rows: `▸`/`▾` (expandable) and the name, then the `[■]` box; a click on the box toggles,
 * a click on the name expands. `extra` adds a right-hand text per row (counts, values).
 */
export function tree(
  s: Surface,
  rect: Rect,
  forest: readonly TreeNode[],
  state: TreeState,
  checked: ((node: TreeNode) => TriState) | null,
  handlers: { toggle?: (node: TreeNode) => void; select?: (index: number) => void },
  extra?: (node: TreeNode) => string,
): TreeRow[] {
  const rows = visibleRows(forest, state.expanded);
  state.selected = Math.max(0, Math.min(rows.length - 1, state.selected));
  if (state.selected < state.scroll) state.scroll = state.selected;
  if (state.selected >= state.scroll + rect.rows) state.scroll = state.selected - rect.rows + 1;
  state.scroll = Math.max(0, Math.min(Math.max(0, rows.length - rect.rows), state.scroll));
  for (let r = 0; r < rect.rows; r += 1) {
    const index = state.scroll + r;
    const row = rect.row + r;
    s.fill({ col: rect.col, row, cols: rect.cols, rows: 1 }, s.theme.black);
    const item = rows[index];
    if (item === undefined) continue;
    const n = item.node;
    const arrow = n.children.length === 0 ? ' ' : state.expanded.has(n.id) ? '▾' : '▸';
    const head = `${'  '.repeat(item.depth)}${arrow} ${n.name}`;
    const nameWidth = Math.max(4, Math.min(rect.cols - 6, 18));
    label(s, rect.col, row, head, { width: nameWidth, keys: false });
    let col = rect.col + nameWidth;
    if (checked !== null) {
      const box = `[${stateGlyph(checked(n))}]`;
      label(s, col, row, box, { fg: s.theme.value, keys: false });
      if (handlers.toggle !== undefined) {
        const toggle = handlers.toggle;
        s.hit({ col, row, cols: 3, rows: 1 }, () => toggle(n));
      }
      col += 4;
    }
    if (extra !== undefined) label(s, col, row, extra(n), { fg: s.theme.value, width: rect.col + rect.cols - col, keys: false });
    if (index === state.selected) s.invert({ col: rect.col, row, cols: nameWidth, rows: 1 });
    const select = handlers.select;
    s.hit({ col: rect.col, row, cols: nameWidth, rows: 1 }, () => {
      state.selected = index;
      if (n.children.length > 0) {
        if (state.expanded.has(n.id)) state.expanded.delete(n.id);
        else state.expanded.add(n.id);
      }
      select?.(index);
    });
  }
  return rows;
}
