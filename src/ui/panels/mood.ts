/**
 * `ui-screens/panels.md` § Mood; `15` § Player-facing behavior. The panel opens on a summary: the
 * hall spirit and the thoughts held by most dwarves, each with its weight and how many hold it;
 * `Enter` on one lists only the dwarves who hold it. Under it, every dwarf with its tier and its
 * strongest thoughts under its name, one to a row, each wrapped under itself. A negative thought with
 * a `ui.mood.helps.<thought>` string says what helps under it: the summary's three heaviest negative
 * thoughts, and each dwarf's strongest negative thought that has one.
 */
import type { EntityId } from '@core/types';
import type { Rect } from '@render/cellbuffer';
import type { MoraleReader, ThoughtView } from '@systems/morale';
import { MOOD_SUMMARY_THOUGHTS } from '../constants';
import type { Strings } from '../strings';
import type { Surface } from '../surface';
import { label, separator, wrapHang, wrapLabel, type ListState } from '../widgets';
import { dwarvesOf, fitName, nameOf } from './units';
import type { PanelContext } from './context';

/** A mood tier's name (15 § Tiers), lowest first: `ui.mood_tier.<tier>`. */
export function moodTierName(strings: Strings, tier: number): string {
  return strings.get(`ui.mood_tier.${tier}`);
}

/** Cells of the tier column: the longest tier name and a blank. */
const TIER_COLS = 10;
/** Thoughts a dwarf's row lists, strongest first. */
const TOP_THOUGHTS = 3;
/** Indent of a dwarf's second row, under its name. */
const THOUGHT_INDENT = 2;
/** The summary's negative thoughts, most held first, that say what helps. */
const HELPS_THOUGHTS = 3;
/** Indent of a "Helps:" line under its thought. */
const HELPS_INDENT = 2;

/** "Helps: a bed or a pallet for each dwarf [b > Furniture]": what relieves a thought (10 § Needs, § Social, comfort, joy), or null for a thought with no `ui.mood.helps.<id>` string. */
export function helpsText(strings: Strings, thoughtId: string): string | null {
  const key = `ui.mood.helps.${thoughtId}`;
  return strings.has(key) ? strings.get('ui.mood.helps_line', { what: strings.get(key) }) : null;
}

/** Of a dwarf's thoughts, strongest first, the id of the first negative one that says what helps; null for none. */
export function helpedThought(strings: Strings, thoughts: readonly { readonly id: string; readonly value: number }[]): string | null {
  return thoughts.find((t) => Math.round(t.value) < 0 && helpsText(strings, t.id) !== null)?.id ?? null;
}

/** One thought as the summary counts it: its text, its weight (the holders' mean, rounded) and who holds it. */
export interface HeldThought {
  /** The id of the first thought counted with this text. */
  readonly id: string;
  readonly text: string;
  readonly value: number;
  readonly holders: readonly EntityId[];
}

/** "+5 Had a meal.": a thought's weight as a whole number with its sign, as the creature inspector writes it. */
export function thoughtText(t: { readonly value: number; readonly text: string }): string {
  const value = Math.round(t.value);
  return `${value > 0 ? '+' : ''}${value} ${t.text}`;
}

/** A dwarf's thoughts that move its mood by a whole point or more, strongest first. */
export function weighedThoughts(morale: MoraleReader, id: EntityId): ThoughtView[] {
  return morale.thoughts(id).filter((t) => Math.round(t.value) !== 0).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

/**
 * Every thought the dwarves hold, by its text, with the number of dwarves who hold it: most held
 * first, then the heavier (the larger total weight), then by text. A thought that rounds to 0 is
 * not counted; a dwarf holding one text twice counts once, at its stronger weight.
 */
export function heldThoughts(morale: MoraleReader, ids: readonly EntityId[]): HeldThought[] {
  const byText = new Map<string, { id: string; sum: number; holders: EntityId[] }>();
  for (const id of ids) {
    const strongest = new Map<string, { id: string; value: number }>();
    for (const t of weighedThoughts(morale, id)) if (!strongest.has(t.text)) strongest.set(t.text, { id: t.id, value: Math.round(t.value) });
    for (const [text, { id: thought, value }] of strongest) {
      const entry = byText.get(text) ?? { id: thought, sum: 0, holders: [] };
      entry.sum += value;
      entry.holders.push(id);
      byText.set(text, entry);
    }
  }
  return [...byText.entries()]
    .map(([text, { id, sum, holders }]) => ({ id, text, value: Math.round(sum / holders.length), holders, sum }))
    .sort((a, b) => b.holders.length - a.holders.length || Math.abs(b.sum) - Math.abs(a.sum) || (a.text < b.text ? -1 : a.text > b.text ? 1 : 0))
    .map(({ id, text, value, holders }) => ({ id, text, value, holders }));
}

export class MoodPanel {
  /** `selected` is the cursor over the summary's rows and then the dwarves; `scroll` the first dwarf shown. */
  readonly list: ListState = { selected: 0, scroll: 0 };
  sorted = false;
  /** The thought whose holders the list shows (`Enter` on a summary row); null lists every dwarf. */
  held: string | null = null;

  private morale(ctx: PanelContext): MoraleReader | null {
    return ctx.readers.has('15') ? ctx.readers.of<MoraleReader>('15') : null;
  }

  /** The summary's rows: the thoughts held by most dwarves, and the listed thought when it is not among them. */
  summary(ctx: PanelContext): HeldThought[] {
    const morale = this.morale(ctx);
    if (morale === null) return [];
    const all = heldThoughts(morale, dwarvesOf(ctx));
    const top = all.slice(0, MOOD_SUMMARY_THOUGHTS);
    const held = this.held === null ? undefined : all.find((t) => t.text === this.held);
    if (held === undefined) this.held = null;
    else if (!top.includes(held)) top[top.length - 1] = held;
    return top;
  }

  /** The dwarves listed: every dwarf, or the holders of the listed thought; by tier when sorted. */
  rows(ctx: PanelContext, summary: readonly HeldThought[] = this.summary(ctx)): EntityId[] {
    const held = this.held === null ? undefined : summary.find((t) => t.text === this.held);
    const ids = held === undefined ? dwarvesOf(ctx) : dwarvesOf(ctx).filter((id) => held.holders.includes(id));
    const morale = this.morale(ctx);
    if (this.sorted && morale !== null) ids.sort((a, b) => morale.mood(a) - morale.mood(b) || a - b);
    return ids;
  }

  /** The dwarf under the cursor; 0 while the cursor is on the summary. */
  selected(ctx: PanelContext): EntityId {
    const summary = this.summary(ctx);
    const at = this.list.selected - summary.length;
    return at < 0 ? 0 : this.rows(ctx, summary)[at] ?? 0;
  }

  /** The summary row under the cursor, or null while it is on a dwarf. */
  selectedThought(ctx: PanelContext, summary: readonly HeldThought[] = this.summary(ctx)): HeldThought | null {
    return summary[this.list.selected] ?? null;
  }

  move(delta: number, ctx: PanelContext): void {
    const summary = this.summary(ctx);
    const count = summary.length + this.rows(ctx, summary).length;
    this.list.selected = Math.max(0, Math.min(Math.max(0, count - 1), this.list.selected + delta));
  }

  /** `[S-s]`: sort by tier or back, the cursor on the first dwarf. */
  toggleSort(ctx: PanelContext): void {
    this.sorted = !this.sorted;
    this.list.selected = this.summary(ctx).length;
    this.list.scroll = 0;
  }

  /**
   * `Enter`: on a summary row, list who holds that thought (or everyone again, when it is the
   * listed one), the cursor on the first of them; on a dwarf, the dwarf to inspect. 0 when there
   * is nothing to inspect.
   */
  enter(ctx: PanelContext): EntityId {
    const thought = this.selectedThought(ctx);
    if (thought === null) return this.selected(ctx);
    this.held = this.held === thought.text ? null : thought.text;
    this.list.selected = this.summary(ctx).length;
    this.list.scroll = 0;
    return 0;
  }

  /** `Backspace`: every dwarf again. False when the list already shows every dwarf. */
  showAll(ctx: PanelContext): boolean {
    if (this.held === null) return false;
    this.held = null;
    this.list.selected = this.summary(ctx).length;
    this.list.scroll = 0;
    return true;
  }
}

/** A dwarf's rows: its name and tier, then its strongest thoughts one to a row, each wrapped under itself. */
interface DwarfLayout {
  readonly id: EntityId;
  readonly full: string;
  readonly name: string;
  readonly tier: string;
  /** The thoughts' rows, under the name. */
  readonly lines: readonly string[];
}

function layoutDwarves(ctx: PanelContext, morale: MoraleReader, ids: readonly EntityId[], listCols: number): { nameCols: number; dwarves: DwarfLayout[] } {
  const names = ids.map((id) => nameOf(ctx, id));
  const longest = names.reduce((most, name) => Math.max(most, Array.from(name).length), 0);
  const nameCols = Math.max(1, Math.min(longest + 1, listCols - TIER_COLS));
  const room = listCols - THOUGHT_INDENT;
  const dwarves = ids.map((id, k) => {
    const shown = weighedThoughts(morale, id).slice(0, TOP_THOUGHTS);
    const helped = helpedThought(ctx.strings, shown);
    return {
      id,
      full: names[k] as string,
      name: fitName(names[k] as string, nameCols - 1, names),
      tier: moodTierName(ctx.strings, morale.tier(id)),
      lines: shown.flatMap((t) => {
        const own = wrapHang(thoughtText(t), room, THOUGHT_INDENT);
        const helps = t.id === helped ? helpsText(ctx.strings, t.id) : null;
        return helps === null ? own : [...own, ...wrapHang(helps, room - HELPS_INDENT, THOUGHT_INDENT).map((line) => `${' '.repeat(HELPS_INDENT)}${line}`)];
      }),
    };
  });
  return { nameCols, dwarves };
}

export function drawMoodPanel(s: Surface, rect: Rect, panel: MoodPanel, ctx: PanelContext): void {
  if (!ctx.readers.has('15')) return;
  const t = s.theme;
  const r = ctx.readers.of<MoraleReader>('15'); const col = rect.col + 1; const width = rect.cols - 2;
  label(s, col, rect.row, ctx.strings.get('ui.mood.hall_spirit', { tier: moodTierName(ctx.strings, r.hallSpiritTier()), value: Math.round(r.hallSpirit()) }), { fg: t.value, width });

  // The summary: the thoughts held by most dwarves, each with its weight and how many hold it.
  const summary = panel.summary(ctx);
  const ids = panel.rows(ctx, summary);
  const total = summary.length + ids.length;
  panel.list.selected = Math.max(0, Math.min(Math.max(0, total - 1), panel.list.selected));
  label(s, col, rect.row + 1, ctx.strings.get('ui.mood.held'), { fg: t.key, width, keys: false });
  if (summary.length === 0) label(s, col, rect.row + 2, ctx.strings.get('ui.mood.held_none'), { fg: t.dim, width, keys: false });
  // A thought too long for its row wraps under itself, its count staying on the first row.
  // Under each of the three heaviest negative thoughts, most held first, what helps, dim.
  const helped = summary.filter((thought) => thought.value < 0).slice(0, HELPS_THOUGHTS);
  let summaryRow = rect.row + 2;
  summary.forEach((thought, k) => {
    const row = summaryRow;
    const count = `×${thought.holders.length}`;
    const mark = thought.text === panel.held ? '•' : ' ';
    const room = width - 1 - Array.from(count).length - 1;
    label(s, col, row, mark, { fg: t.value, width: 1, keys: false });
    let rows = wrapLabel(s, col + 1, row, thoughtText(thought), { width: room, indent: 2, keys: false });
    const helps = helped.includes(thought) ? helpsText(ctx.strings, thought.id) : null;
    if (helps !== null) rows += wrapLabel(s, col + 1 + HELPS_INDENT, row + rows, helps, { fg: t.dim, width: room - HELPS_INDENT, indent: 2, keys: false });
    label(s, col + width - Array.from(count).length, row, count, { fg: t.value, keys: false });
    const cells = { col, row, cols: width, rows };
    if (k === panel.list.selected) s.invert(cells);
    s.hit(cells, () => {
      panel.list.selected = k;
      panel.enter(ctx);
    });
    summaryRow += rows;
  });

  // The dwarves: a header, then each dwarf's row and its thoughts' rows under it.
  const head = Math.max(rect.row + 3, summaryRow);
  const bottom = rect.row + rect.rows - 4;
  const height = Math.max(1, bottom - head - 1);
  let layout = layoutDwarves(ctx, r, ids, width);
  const rowsOf = (d: DwarfLayout): number => 1 + d.lines.length;
  const scrollbar = layout.dwarves.reduce((n, d) => n + rowsOf(d), 0) > height;
  if (scrollbar) layout = layoutDwarves(ctx, r, ids, width - 1);
  const listCols = scrollbar ? width - 1 : width;
  const { nameCols, dwarves } = layout;
  const strings = ctx.strings;
  label(s, col, head, strings.get('ui.mood.name'), { fg: t.key, width: nameCols, keys: false });
  label(s, col + nameCols, head, strings.get('ui.mood.tier'), { fg: t.key, width: TIER_COLS, keys: false });

  // Keep the cursor's dwarf in view.
  const cursor = panel.list.selected - summary.length;
  const state = panel.list;
  state.scroll = Math.max(0, Math.min(state.scroll, Math.max(0, dwarves.length - 1)));
  if (cursor >= 0) {
    if (cursor < state.scroll) state.scroll = cursor;
    const span = (from: number, to: number): number => dwarves.slice(from, to + 1).reduce((n, d) => n + rowsOf(d), 0);
    while (state.scroll < cursor && span(state.scroll, cursor) > height) state.scroll += 1;
  }
  let row = head + 1;
  for (let k = state.scroll; k < dwarves.length && row < head + 1 + height; k += 1) {
    const d = dwarves[k] as DwarfLayout;
    const rows = Math.min(rowsOf(d), head + 1 + height - row);
    const cells = { col, row, cols: listCols, rows };
    label(s, col, row, d.name, { width: nameCols - 1, keys: false });
    if (d.name !== d.full) s.tooltip({ col, row, cols: nameCols - 1, rows: 1 }, d.full);
    label(s, col + nameCols, row, d.tier, { width: TIER_COLS - 1, keys: false });
    d.lines.slice(0, rows - 1).forEach((line, n) => label(s, col + THOUGHT_INDENT, row + 1 + n, line, { fg: t.dim, width: listCols - THOUGHT_INDENT, keys: false }));
    if (summary.length + k === panel.list.selected) s.invert(cells);
    const index = summary.length + k;
    s.hit(cells, () => { panel.list.selected = index; });
    row += rows;
  }
  if (scrollbar) {
    const track = { col: col + width - 1, row: head + 1, cols: 1, rows: height };
    const thumb = Math.floor((state.scroll * (height - 1)) / Math.max(1, dwarves.length - 1));
    // A press on the track jumps there, the cursor on the first dwarf shown.
    const jump = (at: number): void => {
      state.scroll = Math.round((Math.max(0, Math.min(height - 1, at)) * Math.max(0, dwarves.length - 1)) / Math.max(1, height - 1));
      state.selected = summary.length + state.scroll;
    };
    for (let k = 0; k < height; k += 1) {
      s.put(track.col, track.row + k, s.glyphs.index(k === thumb ? '█' : '│'), t.border, t.black);
      s.hit({ col: track.col, row: track.row + k, cols: 1, rows: 1 }, () => jump(k));
    }
    s.scrollbar(track, (at) => jump(at - track.row));
  }

  separator(s, col, bottom, width);
  const actions = panel.selectedThought(ctx, summary) !== null ? 'ui.mood.actions_held' : panel.held !== null ? 'ui.mood.actions_holders' : 'ui.mood.actions';
  label(s, col, bottom + 1, strings.get(actions), { width });
}
