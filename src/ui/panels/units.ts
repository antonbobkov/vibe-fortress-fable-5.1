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
 * `[S-m]` adds the selection to a squad (`SetSquadMembers`), `[S-l]` with marks opens the labor
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
import { DWARF_NAME_MAX, NO_JOB } from '@systems/dwarves';
import type { HealthReader } from '@systems/health';
import type { JobsReader } from '@systems/jobs';
import type { MoraleReader } from '@systems/morale';
import { TITLE_IDS, UNITS_ACTIVITY_MIN_COLS } from '../constants';
import type { Surface } from '../surface';
import { clampList, label, Marks, separator, table, type ListState } from '../widgets';
import { whimProgressText, whimWhereMade, wrapText } from '../messages';
import { accel, type PanelContext } from './context';

type TitleId = (typeof TITLE_IDS)[number];

interface DwarvesReaderLike {
  list(): EntityId[];
  activityText(id: EntityId): string;
  isTipsy?(id: EntityId): boolean;
  whim?(): { readonly id: string; readonly text: string; readonly met: boolean; readonly have: number } | null;
  skill(id: EntityId, skill: string): number;
  isChild?(id: EntityId): boolean;
  holder?(title: TitleId): EntityId;
  unsheltered?(): EntityId[];
}

interface SkillRow {
  readonly id: string;
  readonly profession?: string;
}

/**
 * The fewest cells of the name column (the cursor mark, the name and a blank) and the cells of the
 * mood glyph after it; the name column widens to the longest name shown while the activity keeps
 * `UNITS_ACTIVITY_MIN_COLS`.
 */
const NAME_COLS = 14;
const MOOD_COLS = 2;

/** Rows under the table: the six action rows. */
const ACTION_ROWS = 6;

/** Rows the Thane line may wrap to. */
const WHIM_ROWS = 4;

/**
 * 24 § Panels, the units panel's Thane line (10 § The Thane's whim): what the Thane wishes for, by
 * the end of which season, how far the fortress is with it and whether it is met now, then, while it
 * is not, where its item is made.
 */
export function whimLine(ctx: PanelContext, whim: { readonly id: string; readonly text: string; readonly met: boolean; readonly have: number }): string {
  const s = ctx.strings;
  const progress = whimProgressText(s, ctx.registry, whim.id, whim.have);
  const text = s.get(whim.met ? 'ui.units.whim_met' : 'ui.units.whim_unmet', { whim: whim.text, season: ctx.readers.calendar.seasonName, progress });
  const where = whim.met ? '' : whimWhereMade(ctx.registry, whim.id);
  return where === '' ? text : s.get('ui.units.whim_where', { text, where });
}

export function dwarvesOf(ctx: PanelContext): EntityId[] {
  return ctx.readers.has('10') ? ctx.readers.of<DwarvesReaderLike>('10').list() : [];
}

export function nameOf(ctx: PanelContext, id: EntityId): string {
  return ctx.readers.entities.get(id, C.Creature)?.name ?? '';
}

/** The mark after the name of a dwarf who holds a title, in the Units list (`fortress-screen.md` § Sidebar open). */
export const TITLE_MARK = '♦';

/** "R. Brightvein": the given name's initial and the rest of the name; null for a name of one word. */
function initialForm(name: string): string | null {
  const at = name.indexOf(' ');
  return at <= 0 ? null : `${Array.from(name)[0] ?? ''}. ${name.slice(at + 1)}`;
}

/** `text` in `room` cells, its last cell `»` when it is cut. */
function cut(text: string, room: number): string {
  const chars = Array.from(text);
  if (chars.length <= room) return text;
  return room <= 0 ? '' : `${chars.slice(0, room - 1).join('')}»`;
}

/**
 * A dwarf's name in `room` cells, told apart from the other names of the list (`names`)
 * (`fortress-screen.md` § Sidebar open): the whole name when it fits; else, when no other name of
 * the list shortens the same way, the given name's initial and the rest ("R. Brightvein"), cut
 * with `»` if even that does not fit; else the whole name cut with `»`.
 */
export function fitName(name: string, room: number, names: readonly string[]): string {
  if (Array.from(name).length <= room) return name;
  const short = initialForm(name);
  if (short !== null && !names.some((other) => other !== name && initialForm(other) === short)) return cut(short, room);
  return cut(name, room);
}

/** Every title the dwarf holds, in the title table's order. */
export function titlesOf(ctx: PanelContext, id: EntityId): TitleId[] {
  if (!ctx.readers.has('10')) return [];
  const dwarves = ctx.readers.of<DwarvesReaderLike>('10');
  return TITLE_IDS.filter((title) => dwarves.holder?.(title) === id);
}

/** A dwarf with no activity text: the units list calls it idle. */
export function isIdle(ctx: PanelContext, id: EntityId): boolean {
  if (!ctx.readers.has('10')) return false;
  const text = ctx.readers.of<DwarvesReaderLike>('10').activityText(id);
  return text === '' || text === NO_JOB;
}

/** The need errands whose activity is the need's own name, read as verbs (10 § Player-facing behavior). */
const NEED_ACTIVITIES = new Set(['hunger', 'thirst', 'sleep', 'social', 'comfort', 'joy']);

/**
 * The words for an activity wherever a panel shows one (10 § Player-facing behavior): an idle dwarf
 * reads "Idle", or "Idle (no shelter)" while the hearth alert finds it no shelter; a need
 * errand reads as a verb ("Eating"); a job named for its recipe ("Craft (recipe)") names the recipe
 * ("Craft: wooden bolts"). Any other activity reads as 10 gives it; '' for a creature without one.
 */
export function activityLabel(ctx: Pick<PanelContext, 'readers' | 'registry' | 'strings'>, id: EntityId): string {
  if (!ctx.readers.has('10')) return '';
  const dwarves = ctx.readers.of<DwarvesReaderLike>('10');
  const raw = dwarves.activityText(id);
  if (raw === NO_JOB) return idleLabel(ctx, id);
  if (NEED_ACTIVITIES.has(raw)) return ctx.strings.get(`ui.units.need.${raw}`);
  const RECIPE = ' (recipe)';
  if (raw.endsWith(RECIPE) && ctx.readers.has('11')) {
    const recipe = ctx.readers.of<JobsReader>('11').forWorker(id)?.data['recipe'];
    const name = typeof recipe === 'string' ? ctx.registry.table<{ id: string; name: string }>('recipes').byId(recipe)?.name : undefined;
    if (name !== undefined && name !== '') {
      return ctx.strings.get('ui.units.recipe_job', { job: raw.slice(0, -RECIPE.length), recipe: `${name.charAt(0).toLowerCase()}${name.slice(1)}` });
    }
  }
  return raw;
}

/** An idle dwarf's activity: "Idle", or "Idle (no shelter)" while the hearth alert has no shelter for it (it works as under a watchful alert). */
export function idleLabel(ctx: Pick<PanelContext, 'readers' | 'strings'>, id: EntityId): string {
  const unsheltered = ctx.readers.has('10') ? ctx.readers.of<DwarvesReaderLike>('10').unsheltered?.() ?? [] : [];
  return ctx.strings.get(unsheltered.includes(id) ? 'ui.units.idle_no_shelter' : 'ui.units.idle');
}

/** How many dwarves are idle, for the panel title. */
export function idleCount(ctx: PanelContext): number {
  return dwarvesOf(ctx).filter((id) => isIdle(ctx, id)).length;
}

/** The profession of the highest skill (the units panel and the creature inspector's identity line). */
export function professionOf(ctx: Pick<PanelContext, 'readers' | 'registry' | 'strings'>, id: EntityId): string {
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
  /** `i`: only the dwarves with no activity. Kept while the fortress is open, not saved. */
  idleOnly = false;
  /** `Shift+W`: wounded dwarves first. Kept while the fortress is open, not saved. */
  woundedFirst = false;
  /** The open chooser: the titles, or the squads to add the selection to. */
  choice: { kind: 'title' | 'squad'; selected: number } | null = null;

  rows(ctx: PanelContext): EntityId[] {
    const f = this.filter.toLowerCase();
    const shown = dwarvesOf(ctx).filter((id) => (f === '' || nameOf(ctx, id).toLowerCase().includes(f)) && (!this.idleOnly || isIdle(ctx, id)));
    if (!this.woundedFirst || !ctx.readers.has('17')) return shown;
    const health = ctx.readers.of<HealthReader>('17');
    return [...shown.filter((id) => health.isWounded(id)), ...shown.filter((id) => !health.isWounded(id))];
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

  /** `Shift+W`: the wounded dwarves first, or the list order again. */
  toggleWounded(): void {
    this.woundedFirst = !this.woundedFirst;
    this.list.selected = 0;
    this.list.scroll = 0;
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
    if (accel(ctx, press) === 'i') {
      this.idleOnly = !this.idleOnly;
      this.list.selected = 0;
      this.list.scroll = 0;
      return true;
    }
    if (letter === 'w' && press.shift) {
      this.toggleWounded();
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
    // `[S-l]` with marked dwarves: the labor manager on them (bare `l` always opens Labors, D-U2).
    if (letter === 'l' && press.shift && this.marks.size > 0 && ctx.laborManager !== undefined) {
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
  // 10 § The Thane's whim: the Thane's line, under the filter, while the season has a whim.
  const whim = dwarves?.whim?.() ?? null;
  const whimRows = whim === null ? [] : wrapText(whimLine(ctx, whim), rect.cols - 2, WHIM_ROWS);
  const top = whimRows.length;
  whimRows.forEach((text, k) => {
    label(s, rect.col + 1, rect.row + 1 + k, text, { fg: whim?.met === true ? t.value : t.dim, width: rect.cols - 2, keys: false });
  });
  const height = Math.max(2, rect.rows - 2 - ACTION_ROWS - top);
  const area = { col: rect.col + 1, row: rect.row + 1 + top, cols: rect.cols - 2, rows: height };
  // The name column widens to the longest name shown (with its title mark), as far as the activity
  // keeps `UNITS_ACTIVITY_MIN_COLS`; a name that still does not fit is shortened, told apart from the others.
  const listCols = area.cols - (rows.length > height - 1 ? 1 : 0);
  const holders = new Map<EntityId, TitleId[]>();
  for (const { id: title, holder } of panel.titleRows(ctx)) if (holder !== 0) holders.set(holder, [...(holders.get(holder) ?? []), title]);
  const names = rows.map((id) => nameOf(ctx, id));
  const markCols = (id: EntityId): number => (holders.has(id) ? 2 : 0);
  const longest = rows.reduce((most, id, k) => Math.max(most, Array.from(names[k] as string).length + markCols(id)), 0);
  const nameCols = Math.max(NAME_COLS, Math.min(longest + 2, listCols - MOOD_COLS - UNITS_ACTIVITY_MIN_COLS));
  table(
    s,
    area,
    [
      { title: strings.get('ui.units.name'), width: nameCols },
      { title: '', width: MOOD_COLS },
      { title: strings.get('ui.units.activity'), width: UNITS_ACTIVITY_MIN_COLS, mark: true },
    ],
    rows.map((id, k) => {
      // 10 § Tipsy: "Tipsy" beside the activity.
      const activity = isIdle(ctx, id) ? idleLabel(ctx, id) : activityLabel(ctx, id);
      const tipsy = dwarves?.isTipsy?.(id) === true ? strings.get('ui.units.tipsy', { activity }) : activity;
      const name = fitName(names[k] as string, nameCols - 2 - markCols(id), names);
      return [`${panel.marks.has(id) ? '•' : k === panel.list.selected ? '▶' : ' '}${name}${holders.has(id) ? ` ${TITLE_MARK}` : ''}`, '', tipsy];
    }),
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
      const cell = { col: area.col + nameCols, row: area.row + 1 + r, cols: 1, rows: 1 };
      s.put(cell.col, cell.row, s.glyphs.index(mood.glyph), here ? t.black : fg, here ? fg : t.black);
      // On the status row only: a box would cover the activity of the row above.
      s.tooltip(cell, strings.get(`ui.units.mood.${tier}`), { box: false });
    }
  }
  // An idle dwarf's activity is dim, and a row's tooltip carries what the list no longer shows:
  // the whole name, the profession and the titles.
  const activityCol = area.col + nameCols + MOOD_COLS;
  for (let r = 0; r < height - 1 && panel.list.scroll + r < rows.length; r += 1) {
    const index = panel.list.scroll + r;
    const id = rows[index] as EntityId;
    const cells = { col: area.col, row: area.row + 1 + r, cols: nameCols - 1, rows: 1 };
    const titles = holders.get(id) ?? [];
    const tip = { name: names[index] as string, profession: professionOf(ctx, id), titles: titles.map((title) => strings.get(`ui.title.${title}`)).join(', ') };
    s.tooltip(cells, strings.get(titles.length > 0 ? 'ui.units.row_tip_titled' : 'ui.units.row_tip', tip), { box: false });
    if (isIdle(ctx, id) && index !== panel.list.selected) label(s, activityCol, cells.row, idleLabel(ctx, id), { fg: t.dim, width: listCols - nameCols - MOOD_COLS, keys: false });
  }
  const row = rect.row + 1 + top + height;
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
  // `■` after `[S-w] hurt` while the wounded come first.
  actionRow(s, col, row + 5, width, [
    [strings.get('ui.units.to_squad'), () => panel.openSquads(ctx)],
    [strings.get(panel.woundedFirst ? 'ui.units.hurt_on' : 'ui.units.hurt'), () => panel.toggleWounded()],
  ]);
  actionRow(s, col, row + 6, width, [
    [strings.get('ui.units.sleep', { hour: hour === null ? '--' : String(hour).padStart(2, '0') }), null],
    [strings.get('ui.units.sleep_earlier'), () => { for (const c of panel.shiftSleep(ctx, -1)) ctx.submit(c); }],
    [strings.get('ui.units.sleep_later'), () => { for (const c of panel.shiftSleep(ctx, 1)) ctx.submit(c); }],
  ]);
}
