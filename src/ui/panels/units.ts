/**
 * The units panel: `ui-screens/fortress-screen.md` § Sidebar open (units panel) and `10`
 * § Player-facing behavior ("a table of every dwarf with name, profession, activity, mood tier
 * glyph"). Rows: `▶` marks the cursor and `•` a marked row; the mood tier glyph follows the name;
 * the activity is `dwarves.activityText`. The profession is the `profession` of the dwarf's
 * highest skill (`skills-and-professions.md`, ties by the skill table's order; "Peasant" with no
 * skill, D-077).
 *
 * U-06 (UI audit M10, § 3 "Multi-select units"): `Space` marks rows, `Shift`-click a range, `*`
 * all; an action then applies to every marked dwarf when the cursor's row is marked, else to the
 * cursor's dwarf. `[S-t] title` opens a list of the four titles (`AssignTitle`; one holder each,
 * so it acts on the cursor's dwarf), `[S-n] rename` the `text_input` dialog (`RenameDwarf`),
 * `[S-m]` adds the selection to a squad (`SetSquadMembers`), `[l]` with marks opens the labor
 * manager on them, and `[` `]` move the sleep hour (`SetSchedule`). The new keys avoid the panel
 * hotkeys (D-U2).
 */

import { C } from '@core/components';
import type { Command } from '@core/commands';
import { SQUAD_MAX_SIZE } from '@core/constants';
import type { EntityId, MoodTier } from '@core/types';
import type { KeyPress } from '@platform/input';
import type { Rect } from '@render/cellbuffer';
import type { CombatReader, SquadWithId } from '@systems/combat';
import { DWARF_NAME_MAX } from '@systems/dwarves';
import type { MoraleReader } from '@systems/morale';
import { TITLE_IDS } from '../constants';
import type { Surface } from '../surface';
import { clampList, label, Marks, separator, table, type ListState } from '../widgets';
import type { PanelContext } from './context';

type TitleId = (typeof TITLE_IDS)[number];

interface DwarvesReaderLike {
  list(): EntityId[];
  activityText(id: EntityId): string;
  skill(id: EntityId, skill: string): number;
  isChild?(id: EntityId): boolean;
  holder?(title: TitleId): EntityId;
}

interface SkillRow {
  readonly id: string;
  readonly profession?: string;
}

/** The cells of the name column and of the mood glyph after it. */
const NAME_COLS = 17;
const MOOD_COLS = 2;

/** Rows under the table: the five action rows. */
const ACTION_ROWS = 5;

export function dwarvesOf(ctx: PanelContext): EntityId[] {
  return ctx.readers.has('10') ? ctx.readers.of<DwarvesReaderLike>('10').list() : [];
}

export function nameOf(ctx: PanelContext, id: EntityId): string {
  return ctx.readers.entities.get(id, C.Creature)?.name ?? '';
}

/** The profession of the highest skill. */
export function professionOf(ctx: PanelContext, id: EntityId): string {
  if (!ctx.readers.has('10')) return '';
  const dwarves = ctx.readers.of<DwarvesReaderLike>('10');
  const skills = ctx.registry.table<SkillRow>('skills');
  let best: SkillRow | null = null;
  let level = 0;
  for (const sid of skills.ids()) {
    const row = skills.byId(sid);
    if (row?.profession === undefined) continue;
    const l = dwarves.skill(id, sid);
    if (l > level) {
      level = l;
      best = row;
    }
  }
  return best?.profession ?? ctx.strings.get('ui.units.peasant');
}

/**
 * The mood tier glyph of `fortress-screen.md` § Sidebar open: `☺` white from Fine up, `☻` yellow
 * Unhappy, `‼` red Miserable (the glyph differs with the colour, D-U10).
 */
export function moodGlyph(tier: MoodTier): { glyph: string; color: 'text' | 'alert' | 'danger' } {
  if (tier === 0) return { glyph: '‼', color: 'danger' };
  if (tier === 1) return { glyph: '☻', color: 'alert' };
  return { glyph: '☺', color: 'text' };
}

export class UnitsPanel {
  readonly list: ListState = { selected: 0, scroll: 0 };
  filter = '';
  /** `/` focuses the filter; letters then type into it until `Enter` or `Esc`. */
  editing = false;
  /** The marked dwarves (U-06). */
  readonly marks = new Marks();
  /** The open chooser: the titles, or the squads to add the selection to. */
  choice: { kind: 'title' | 'squad'; selected: number } | null = null;

  rows(ctx: PanelContext): EntityId[] {
    const f = this.filter.toLowerCase();
    return dwarvesOf(ctx).filter((id) => f === '' || nameOf(ctx, id).toLowerCase().includes(f));
  }

  selectedId(ctx: PanelContext): EntityId {
    return this.rows(ctx)[this.list.selected] ?? 0;
  }

  move(delta: number, ctx: PanelContext): void {
    const n = this.rows(ctx).length;
    this.list.selected = Math.max(0, Math.min(Math.max(0, n - 1), this.list.selected + delta));
  }

  /** What an action applies to: the marked dwarves when the cursor's row is marked, else the cursor's dwarf. */
  targets(ctx: PanelContext): EntityId[] {
    const id = this.selectedId(ctx);
    return this.marks.targets(dwarvesOf(ctx), id === 0 ? undefined : id);
  }

  /** `Space`: mark the cursor's row. */
  toggleMark(ctx: PanelContext): void {
    const id = this.selectedId(ctx);
    if (id === 0) ctx.notice?.(ctx.strings.get('ui.units.no_dwarf'));
    else this.marks.toggle(id);
  }

  /** A click on a row: select it; with `Shift`, mark the range from the last marked row. */
  clickRow(ctx: PanelContext, index: number): void {
    this.list.selected = index;
    const rows = this.rows(ctx);
    const id = rows[index];
    if (id !== undefined && ctx.shiftClick()) this.marks.range(rows, id);
  }

  private isChild(ctx: PanelContext, id: EntityId): boolean {
    return ctx.readers.has('10') && ctx.readers.of<DwarvesReaderLike>('10').isChild?.(id) === true;
  }

  // ---------- titles ----------

  /** Each title and its holder (0 when vacant). */
  titleRows(ctx: PanelContext): { id: TitleId; holder: EntityId }[] {
    const dwarves = ctx.readers.has('10') ? ctx.readers.of<DwarvesReaderLike>('10') : null;
    return TITLE_IDS.map((id) => ({ id, holder: dwarves?.holder?.(id) ?? 0 }));
  }

  /** `Enter` in the title list: give the title to the cursor's dwarf, or take it away when they hold it. */
  assignTitle(ctx: PanelContext, index: number): Command | null {
    const dwarf = this.selectedId(ctx);
    const row = this.titleRows(ctx)[index];
    this.choice = null;
    if (dwarf === 0 || row === undefined) return null;
    const title = ctx.strings.get(`ui.title.${row.id}`);
    if (row.holder === dwarf) {
      ctx.notice?.(ctx.strings.get('ui.units.title_vacated', { dwarf: nameOf(ctx, dwarf), title }));
      return { type: 'AssignTitle', dwarfId: 0, title: row.id };
    }
    if (this.isChild(ctx, dwarf)) {
      ctx.notice?.(ctx.strings.get('ui.units.title_child', { dwarf: nameOf(ctx, dwarf) }));
      return null;
    }
    return { type: 'AssignTitle', dwarfId: dwarf, title: row.id };
  }

  // ---------- rename ----------

  /** `[S-n]`: the `text_input` dialog, then `RenameDwarf`. */
  rename(ctx: PanelContext): void {
    const dwarf = this.selectedId(ctx);
    if (dwarf === 0) {
      ctx.notice?.(ctx.strings.get('ui.units.no_dwarf'));
      return;
    }
    const name = nameOf(ctx, dwarf);
    ctx.prompt?.({ title: ctx.strings.get('ui.units.rename_title', { dwarf: name }), value: name, maxLength: DWARF_NAME_MAX }, (text) => {
      if (text !== null && text !== name) ctx.submit({ type: 'RenameDwarf', dwarfId: dwarf, name: text });
    });
  }

  // ---------- squads ----------

  squads(ctx: PanelContext): readonly SquadWithId[] {
    return ctx.readers.has('16') ? ctx.readers.of<CombatReader>('16').squads() : [];
  }

  /**
   * `Enter` in the squad list: add the selection to the squad in one `SetSquadMembers`. Children,
   * dwarves already in a squad and those the squad has no room for are left out, and the status
   * row says how many.
   */
  addToSquad(ctx: PanelContext, index: number): Command | null {
    const squad = this.squads(ctx)[index];
    const targets = this.targets(ctx);
    this.choice = null;
    if (squad === undefined) return null;
    const taken = new Set(this.squads(ctx).flatMap((sq) => sq.members));
    const eligible = targets.filter((id) => !taken.has(id) && !this.isChild(ctx, id));
    const add = eligible.slice(0, Math.max(0, SQUAD_MAX_SIZE - squad.members.length));
    const skipped = targets.length - add.length;
    if (add.length === 0) {
      ctx.notice?.(ctx.strings.get('ui.units.squad_nobody', { squad: squad.name }));
      return null;
    }
    ctx.notice?.(ctx.strings.get(skipped > 0 ? 'ui.units.squad_added_skipped' : 'ui.units.squad_added', { n: add.length, squad: squad.name, skipped }));
    this.marks.clear();
    return { type: 'SetSquadMembers', squadId: squad.id, members: [...squad.members, ...add] };
  }

  // ---------- sleep hour ----------

  sleepHour(ctx: PanelContext, id: EntityId): number | null {
    return ctx.readers.entities.get(id, C.Schedule)?.sleepStartHour ?? null;
  }

  /** `[` and `]`: the selection sleeps an hour earlier or later (`SetSchedule`; the hours wrap at midnight). */
  shiftSleep(ctx: PanelContext, delta: number): Command[] {
    const out: Command[] = [];
    for (const id of this.targets(ctx)) {
      const hour = this.sleepHour(ctx, id);
      if (hour !== null) out.push({ type: 'SetSchedule', dwarfId: id, sleepStartHour: (hour + delta + 24) % 24 });
    }
    if (out.length === 0) ctx.notice?.(ctx.strings.get('ui.units.no_dwarf'));
    return out;
  }

  // ---------- keys ----------

  openTitles(ctx: PanelContext): void {
    if (this.selectedId(ctx) === 0) ctx.notice?.(ctx.strings.get('ui.units.no_dwarf'));
    else this.choice = { kind: 'title', selected: 0 };
  }

  openSquads(ctx: PanelContext): void {
    if (this.targets(ctx).length === 0) ctx.notice?.(ctx.strings.get('ui.units.no_dwarf'));
    else if (this.squads(ctx).length === 0) ctx.notice?.(ctx.strings.get('ui.units.no_squads'));
    else this.choice = { kind: 'squad', selected: 0 };
  }

  /** `Enter` or a click in the open chooser. */
  choose(ctx: PanelContext, index: number): void {
    const command = this.choice?.kind === 'title' ? this.assignTitle(ctx, index) : this.addToSquad(ctx, index);
    if (command !== null) ctx.submit(command);
  }

  /**
   * The keys U-06 adds; the rest of the panel's keys stay with the fortress screen. `Space` reaches
   * here through the screen's mark key, before it would pause.
   */
  key(ctx: PanelContext, press: KeyPress): boolean {
    if (press.ctrl || press.alt || press.meta) return false;
    const k = press.key;
    const letter = k.length === 1 ? k.toLowerCase() : '';
    if (this.choice !== null) {
      const count = this.choice.kind === 'title' ? TITLE_IDS.length : this.squads(ctx).length;
      const up = k === '↑' || k === 'ArrowUp';
      const down = k === '↓' || k === 'ArrowDown';
      if (up || down) this.choice.selected = Math.max(0, Math.min(count - 1, this.choice.selected + (up ? -1 : 1)));
      else if (k === 'Enter') this.choose(ctx, this.choice.selected);
      else if (k === 'Backspace') this.choice = null;
      // The chooser is modal within the panel: the list keys under it wait.
      return true;
    }
    if (k === ' ' || k === 'Space') {
      this.toggleMark(ctx);
      return true;
    }
    if (k === '*') {
      this.marks.all(this.rows(ctx));
      return true;
    }
    if (letter === 't' && press.shift) {
      this.openTitles(ctx);
      return true;
    }
    if (letter === 'n' && press.shift) {
      this.rename(ctx);
      return true;
    }
    if (letter === 'm' && press.shift) {
      this.openSquads(ctx);
      return true;
    }
    if (k === '[' || k === ']') {
      for (const c of this.shiftSleep(ctx, k === '[' ? -1 : 1)) ctx.submit(c);
      return true;
    }
    // `[l]` with marked dwarves: the labor manager on them.
    if (letter === 'l' && this.marks.size > 0 && ctx.laborManager !== undefined) {
      ctx.laborManager({ marked: this.marks.list(dwarvesOf(ctx)), focus: this.selectedId(ctx) || undefined });
      return true;
    }
    return false;
  }
}

/** One row of `[key] text` actions, each clickable; a `null` action is only text. */
function actionRow(s: Surface, col: number, row: number, width: number, parts: readonly (readonly [string, (() => void) | null])[]): void {
  let at = col;
  for (const [text, action] of parts) {
    const room = width - (at - col);
    if (room <= 0) break;
    const n = label(s, at, row, text, { width: room });
    if (action !== null) s.hit({ col: at, row, cols: n, rows: 1 }, action);
    at += n + 2;
  }
}

/** The title or squad chooser, in place of the table. */
function drawChoice(s: Surface, rect: Rect, panel: UnitsPanel, ctx: PanelContext): void {
  const choice = panel.choice;
  if (choice === null) return;
  const strings = ctx.strings;
  const col = rect.col + 1;
  const width = rect.cols - 2;
  const title = choice.kind === 'title'
    ? strings.get('ui.units.choose_title', { dwarf: nameOf(ctx, panel.selectedId(ctx)) })
    : strings.get('ui.units.choose_squad', { n: panel.targets(ctx).length });
  label(s, col, rect.row, title, { fg: s.theme.key, width, keys: false });
  const lines = choice.kind === 'title'
    ? panel.titleRows(ctx).map((r) => `${strings.get(`ui.title.${r.id}`).padEnd(12)} ${r.holder === 0 ? strings.get('ui.units.vacant') : nameOf(ctx, r.holder)}`)
    : panel.squads(ctx).map((sq) => `${sq.name.padEnd(20)} ${sq.members.length}/${SQUAD_MAX_SIZE}`);
  const height = Math.max(1, rect.rows - 3);
  const state = { selected: choice.selected, scroll: 0 };
  clampList(state, lines.length, height);
  choice.selected = state.selected;
  for (let r = 0; r < height && state.scroll + r < lines.length; r += 1) {
    const index = state.scroll + r;
    const cells = { col, row: rect.row + 1 + r, cols: width, rows: 1 };
    label(s, col, cells.row, lines[index] as string, { width, keys: false });
    if (index === choice.selected) s.invert(cells);
    s.hit(cells, () => panel.choose(ctx, index));
  }
  actionRow(s, col, rect.row + rect.rows - 1, width, [
    [strings.get(choice.kind === 'title' ? 'ui.units.choice_title_keys' : 'ui.units.choice_squad_keys'), () => panel.choose(ctx, choice.selected)],
    [strings.get('ui.units.choice_back'), () => { panel.choice = null; }],
  ]);
}

export function drawUnitsPanel(s: Surface, rect: Rect, panel: UnitsPanel, ctx: PanelContext): void {
  const t = s.theme;
  const strings = ctx.strings;
  panel.marks.prune(dwarvesOf(ctx));
  if (panel.choice !== null) {
    drawChoice(s, rect, panel, ctx);
    return;
  }
  label(s, rect.col + 1, rect.row, strings.get('ui.units.filter', { filter: panel.filter + (panel.editing ? '_' : '') }), { fg: panel.editing ? t.value : t.text, width: rect.cols - 2 });
  const rows = panel.rows(ctx);
  const dwarves = ctx.readers.has('10') ? ctx.readers.of<DwarvesReaderLike>('10') : null;
  const morale = ctx.readers.has('15') ? ctx.readers.of<MoraleReader>('15') : null;
  const height = Math.max(2, rect.rows - 2 - ACTION_ROWS);
  const area = { col: rect.col + 1, row: rect.row + 1, cols: rect.cols - 2, rows: height };
  table(
    s,
    area,
    [
      { title: strings.get('ui.units.name'), width: NAME_COLS },
      { title: '', width: MOOD_COLS },
      { title: strings.get('ui.units.profession'), width: 9 },
      { title: strings.get('ui.units.activity'), width: 6 },
    ],
    rows.map((id, k) => [`${panel.marks.has(id) ? '•' : k === panel.list.selected ? '▶' : ' '}${nameOf(ctx, id)}`, '', professionOf(ctx, id), dwarves?.activityText(id) || strings.get('ui.units.no_job')]),
    panel.list,
    (index) => panel.clickRow(ctx, index),
  );
  // The mood tier glyph after the name, in its tier's colour (inverted with the cursor's row).
  if (morale !== null) {
    for (let r = 0; r < height - 1 && panel.list.scroll + r < rows.length; r += 1) {
      const index = panel.list.scroll + r;
      const tier = morale.tier(rows[index] as EntityId);
      const mood = moodGlyph(tier);
      const fg = mood.color === 'danger' ? t.danger : mood.color === 'alert' ? t.alert : t.text;
      const here = index === panel.list.selected;
      const cell = { col: area.col + NAME_COLS, row: area.row + 1 + r, cols: 1, rows: 1 };
      s.put(cell.col, cell.row, s.glyphs.index(mood.glyph), here ? t.black : fg, here ? fg : t.black);
      s.tooltip(cell, strings.get(`ui.units.mood.${tier}`));
    }
  }
  const row = rect.row + 1 + height;
  const col = rect.col + 1;
  const width = rect.cols - 2;
  separator(s, col, row, width);
  label(s, col, row + 1, strings.get('ui.units.actions1'), { width });
  label(s, col, row + 2, strings.get('ui.units.actions2'), { width });
  actionRow(s, col, row + 3, width, [
    [strings.get('ui.units.mark'), () => panel.toggleMark(ctx)],
    [strings.get('ui.units.mark_all'), () => panel.marks.all(rows)],
    [strings.get('ui.units.marked', { n: panel.marks.size }), null],
  ]);
  actionRow(s, col, row + 4, width, [
    [strings.get('ui.units.title'), () => panel.openTitles(ctx)],
    [strings.get('ui.units.rename'), () => panel.rename(ctx)],
  ]);
  const selected = panel.selectedId(ctx);
  const hour = selected === 0 ? null : panel.sleepHour(ctx, selected);
  actionRow(s, col, row + 5, width, [
    [strings.get('ui.units.to_squad'), () => panel.openSquads(ctx)],
    [strings.get('ui.units.sleep', { hour: hour === null ? '--' : String(hour).padStart(2, '0') }), null],
    [strings.get('ui.units.sleep_earlier'), () => { for (const c of panel.shiftSleep(ctx, -1)) ctx.submit(c); }],
    [strings.get('ui.units.sleep_later'), () => { for (const c of panel.shiftSleep(ctx, 1)) ctx.submit(c); }],
  ]);
}
