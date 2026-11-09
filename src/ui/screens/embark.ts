/**
 * The embark screen: `04-implementation/ui-screens/embark.md`, `02-systems/02-embark-and-loadout.md`
 * § Presets, § Player-facing behavior, `03-content/embark-catalog.md`, and the `embark` keys of
 * `ui-keymap-and-screens.md` (`1` `2` `3` tabs, `+` `-` adjust, `0` clear, `r` reroll, `n` rename,
 * `p` presets, `l` loadouts, `Enter` Embark; `/` finds, § Finding things of the wireframe).
 *
 * The screen edits an {@link EmbarkSession} only through the session's commands (`SetSkill`,
 * `RerollDwarf`, `RenameDwarf`, `SetSupply`, `ApplyPreset`, `SetFortressName`, `ConfirmEmbark`),
 * so the budget and skill rules are the session's. "Embark is disabled while over budget and shows
 * why." Purchases are listed and priced here; they materialize in the wagon with M2 (T-M2-08).
 */

import { ATTRIBUTE_MAX, EMBARK_SKILL_MAX_PER_SKILL, EMBARK_SKILL_POINTS_PER_DWARF, SKILL_MAX_LEVEL } from '@core/constants';
import type { Attributes } from '@core/components';
import type { Registry } from '@core/registry';
import type { KeyPress } from '@platform/input';
import {
  EMBARK_REROLL_COST,
  EMBARK_TESTING_MAX_COUNT,
  EmbarkSession,
  TESTING_PRESET,
  TESTING_PRESET_ID,
  skillPoints,
  suppliesTotal,
  type EmbarkCommand,
  type EmbarkPresetRow,
} from '@systems/embark';
import { DRAFT_ROWS, TestingDraft, testingStep } from './embark-testing';
import { applyLoadout, loadoutOf, loadoutTotal, type LoadoutResult, type SavedLoadout } from '@systems/embark';
import { EMBARK_DEFAULT_PRESET, EMBARK_HINT_SECONDS, EMBARK_PRESET_SPACING, EMBARK_PRESETS_WIDTH, EMBARK_WHEEL_ROWS, UI_NORMAL_SPACING, UI_COMPACT_SPACING } from '../constants';
import type { KeyContext, Keymap } from '../keymap';
import { clickHit, type CellPointer, type CellWheel, type Screen } from '../screen';
import type { Strings } from '../strings';
import type { Surface } from '../surface';
import {
  bar,
  button,
  clampList,
  dropdown,
  dropdownKey,
  editText,
  normalizeName,
  label,
  numberField,
  separator,
  tabs,
  textField,
  type DropdownOption,
  type DropdownState,
  type ListState,
  type TextFieldState,
} from '../widgets';
import { LoadoutsPanel, type LoadoutLibrary } from './embark_loadouts';
import { findMatches, presetSummary, skillSummary } from './embark_lists';
import type { TextInputSpec } from './text_input';
import { wrapText } from '../messages';

/** One row of `embarkCatalog` as the screen reads it (`category` and `note`: docs/03-content/embark-catalog.md). */
export interface CatalogRow {
  readonly id: string;
  readonly entry: string;
  readonly price: number;
  readonly max: number;
  readonly species?: string;
  readonly sex?: number;
  readonly condition?: string;
  readonly note?: string;
  readonly category?: string;
}

interface SkillRow {
  readonly id: string;
  readonly name: string;
  readonly embark?: boolean;
}

interface TraitRow {
  readonly id: string;
  readonly name: string;
}

/** The supply groups of `embark-catalog.md`, in the document's order; animals have their own tab. */
export const SUPPLY_CATEGORIES = ['tools', 'food', 'drink', 'seeds', 'materials', 'furniture'] as const;

/** The Supplies tab's last view, after the groups: every chosen line, supplies and animals (`ui-screens/embark.md` § Finding things). */
export const CHOSEN_VIEW = SUPPLY_CATEGORIES.length;

/** The attributes in the wireframe's order. */
const ATTRIBUTES: readonly (keyof Attributes)[] = ['str', 'agi', 'tou', 'end', 'wil', 'wit', 'cha'];

/** Fortress names are 1–32 characters (`command-catalog.md` `RenameFortress`). */
export const FORTRESS_NAME_MAX = 32;

/** The temperature bands of `01` § Biomes, for a catalog `condition` ("only when the region is frozen or cold"). */
export function temperatureBand(tempC: number): 'frozen' | 'cold' | 'temperate' | 'warm' | 'hot' {
  if (tempC < -5) return 'frozen';
  if (tempC < 5) return 'cold';
  if (tempC < 18) return 'temperate';
  if (tempC <= 26) return 'warm';
  return 'hot';
}

/** Whether a catalog entry's `condition` holds for a region; an entry without one always does. */
export function conditionHolds(condition: string | undefined, tempC: number): boolean {
  if (condition === undefined) return true;
  const m = /only when the region is ([a-z]+(?: or [a-z]+)*)/.exec(condition);
  if (m === null) return true;
  const bands = (m[1] as string).split(' or ');
  return bands.includes(temperatureBand(tempC));
}

/** `1,600`: marks are shown with a thousands separator (24 § Panels: "`1,250 ☼`"). */
export function marks(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export interface EmbarkHost {
  embark(session: EmbarkSession): void;
  back(): void;
  /** 24 § Confirmations: the modal dialog; without it the screen embarks as asked. */
  confirm?(id: string, params: Readonly<Record<string, string | number>>, answer: (yes: boolean) => void): void;
  /** Real time in milliseconds, for the hint line that alternates every few seconds. */
  now?(): number;
  /** The saved loadouts (`02` § Loadouts); without them the screen offers none. */
  loadouts?: LoadoutLibrary;
  /** The `text_input` dialog, for a loadout's name. */
  prompt?(spec: TextInputSpec, answer: (text: string | null) => void): void;
}

/** The presets menu's last option, which opens the saved loadouts panel. */
export const LOADOUTS_OPTION = '@loadouts';

/** What the party's supply list lacks for a working start (D-U3). */
export interface MissingSupplies {
  readonly pick: boolean;
  readonly axe: boolean;
  readonly food: boolean;
  readonly drink: boolean;
}

export interface EmbarkRegion {
  readonly name: string;
  readonly peril: number;
  readonly tempC: number;
}

type Focus = 'party' | 'skills' | 'items' | 'name' | 'rename' | 'filter';

export class EmbarkScreen implements Screen {
  readonly id = 'embark' as const;

  /** The confirmation's keys while "Replace your changes" asks, the list keys while the presets dropdown is open. */
  translatedKeys(): readonly KeyContext[] { return this.pendingPreset !== null ? ['confirm'] : this.presets.open || this.loadouts?.open === true ? ['panel'] : []; }
  captionKeys(): readonly KeyContext[] { return ['embark', 'panel', 'confirm']; }
  readonly session: EmbarkSession;
  tab = 0;
  /** How many times the tab changed: each change turns the alternating hint line. */
  private tabChanges = 0;
  focus: Focus = 'party';
  category = 0;
  readonly party: ListState = { selected: 0, scroll: 0 };
  readonly skills: ListState = { selected: 0, scroll: 0 };
  readonly items: ListState = { selected: 0, scroll: 0 };
  readonly fortressName: TextFieldState;
  readonly rename: TextFieldState = { value: '', focused: false, maxLength: 32 };
  readonly filter: TextFieldState = { value: '', focused: false, maxLength: 20 };
  /** The Dwarves tab's find field, over the skill list (`/` on that tab). */
  readonly skillFind: TextFieldState = { value: '', focused: false, maxLength: 20 };
  /** Why the last key did nothing ("No skill points left …"), shown on the keys line until the next key. */
  flash: string | null = null;
  /** The rows each list showed when last drawn, for the wheel and `PageUp` `PageDown`. */
  private readonly shown = { party: 1, skills: 1, items: 1 };
  readonly presets: DropdownState = { open: false, highlighted: 0 };
  /** A preset waiting for the "replace your changes" confirmation. */
  pendingPreset: string | null = null;
  /** Anything edited since the last preset (or since the screen opened). */
  edited = false;
  private last: Surface | null = null;
  private readonly catalog: CatalogRow[];
  /** The skills offered in normal play (`embark` not `no`). */
  private readonly embarkSkillRows: SkillRow[];
  /** Every skill, for testing mode. */
  private readonly allSkillRows: SkillRow[];
  /** Testing mode's Items tab: the item being made and the free lines (`02` § Testing mode). */
  readonly draft: TestingDraft;
  private readonly traitNames: Map<string, string>;
  private readonly presetRows: EmbarkPresetRow[];
  /** The saved loadouts panel, when the host keeps loadouts. */
  readonly loadouts: LoadoutsPanel | null;

  constructor(
    private readonly registry: Registry,
    worldSeed: string,
    readonly region: EmbarkRegion,
    private readonly host: EmbarkHost,
    private readonly keymap: Keymap,
    private readonly strings: Strings,
  ) {
    this.session = new EmbarkSession(registry, worldSeed, region.peril);
    this.fortressName = { value: this.session.fortressName, focused: false, maxLength: FORTRESS_NAME_MAX };
    const catalog = registry.table<CatalogRow>('embarkCatalog');
    this.catalog = catalog.ids().map((id) => catalog.byId(id) as CatalogRow);
    const skills = registry.table<SkillRow>('skills');
    this.allSkillRows = skills
      .ids()
      .map((id) => skills.byId(id) as SkillRow)
      .sort((a, b) => a.name.localeCompare(b.name));
    this.embarkSkillRows = this.allSkillRows.filter((row) => row.embark !== false);
    this.draft = new TestingDraft(registry);
    const traits = registry.table<TraitRow>('personality');
    this.traitNames = new Map(traits.ids().map((id) => [id, (traits.byId(id) as TraitRow).name]));
    const presets = registry.table<EmbarkPresetRow>('embarkPresets');
    this.presetRows = presets.ids().map((id) => presets.byId(id) as EmbarkPresetRow);
    // `02` § Presets: "The screen opens with `balanced` applied" (D-U3, audit Q1).
    if (presets.has(EMBARK_DEFAULT_PRESET)) this.applyPreset(EMBARK_DEFAULT_PRESET);
    const library = host.loadouts;
    this.loadouts = library === undefined ? null : new LoadoutsPanel({
      library,
      current: () => loadoutOf(this.session),
      load: (loadout) => this.chooseLoadout(loadout),
      total: (loadout) => loadoutTotal(registry, loadout),
      budget: () => this.session.budget(),
      ...(host.prompt === undefined ? {} : { prompt: (spec, answer) => host.prompt?.(spec, answer) }),
      ...(host.confirm === undefined ? {} : { confirm: (id, params, answer) => host.confirm?.(id, params, answer) }),
    }, keymap, strings);
  }

  // ---------- state ----------

  apply(cmd: EmbarkCommand): boolean {
    const r = this.session.apply(cmd);
    if (r.ok && cmd.type !== 'ApplyPreset' && cmd.type !== 'ConfirmEmbark' && cmd.type !== 'SetEmbarkMode') this.edited = true;
    return r.ok;
  }

  /** Testing mode (`02` § Testing mode): no budget, any dwarves, skills and items. */
  get testing(): boolean {
    return this.session.testing;
  }

  /** The skills the Dwarves tab lists: every skill in testing mode, the embark skills otherwise. */
  get skillRows(): readonly SkillRow[] {
    return this.testing ? this.allSkillRows : this.embarkSkillRows;
  }

  /** The tab count: the Items tab exists only in testing mode. */
  tabCount(): number {
    return this.testing ? 4 : 3;
  }

  /**
   * `t`: testing mode on keeps the loadout and lifts the limits; off goes back to the default
   * preset, asking first when anything was edited.
   */
  toggleTesting(): void {
    if (!this.testing) {
      this.session.apply({ type: 'SetEmbarkMode', mode: 'testing' });
      return;
    }
    this.choosePreset(EMBARK_DEFAULT_PRESET);
  }

  /** `a` on the Dwarves tab: a new dwarf with no skills, selected. */
  addDwarf(): void {
    if (this.apply({ type: 'AddDwarf' })) this.party.selected = this.session.party.length - 1;
  }

  /** `x` on the Dwarves tab: the selected dwarf leaves the party. */
  removeDwarf(): void {
    this.apply({ type: 'RemoveDwarf', dwarf: this.party.selected });
  }

  /** `*`: every dwarf takes the selected dwarf's level in the selected skill. */
  skillAll(): void {
    const skill = this.visibleSkills()[this.skills.selected];
    const d = this.session.party[this.party.selected];
    if (skill === undefined || d === undefined) return;
    this.apply({ type: 'SetSkillAll', skill: skill.id, level: d.skills[skill.id] ?? 0 });
  }

  /** `a` on the Items tab: the item being made joins the free lines. */
  addItem(): void {
    this.apply({ type: 'AddItem', line: this.draft.line() });
  }

  count(entry: string): number {
    return this.session.supplies.find((l) => l.entry === entry)?.count ?? 0;
  }

  /**
   * The catalog rows of the current tab. On the Supplies tab: the find field's matches over every
   * entry, animals too, by name or group; else the chosen lines (the last view); else one group.
   */
  rows(): CatalogRow[] {
    const needle = this.filter.value.trim();
    const rows = this.catalog.filter((row) => {
      if (this.tab === 2) return row.category === 'animals';
      if (needle.length > 0) return findMatches(needle, row.entry, this.categoryName(row.category));
      if (this.category === CHOSEN_VIEW) return this.count(row.id) > 0;
      if (row.category === 'animals') return false;
      return row.category === SUPPLY_CATEGORIES[this.category];
    });
    if (!this.mixed()) return rows;
    // Lines of several groups come group by group, in the bar's order, the animals last.
    const group = (row: CatalogRow): number => {
      const k = (SUPPLY_CATEGORIES as readonly string[]).indexOf(row.category ?? '');
      return k < 0 ? SUPPLY_CATEGORIES.length : k;
    };
    return rows.map((row, k) => ({ row, k })).sort((a, b) => group(a.row) - group(b.row) || a.k - b.k).map((e) => e.row);
  }

  /** "Tools", "Animals": a catalog group's name. */
  categoryName(category: string | undefined): string {
    return category === undefined ? '' : this.strings.get(`ui.embark.category.${category}`);
  }

  /** Whether the Supplies list shows lines of several groups (a find, or the chosen lines), so each names its group. */
  private mixed(): boolean {
    return this.tab === 1 && (this.filter.value.trim().length > 0 || this.category === CHOSEN_VIEW);
  }

  /** The skills the Dwarves tab lists: all that can be chosen at embark, or the find field's matches. */
  visibleSkills(): readonly SkillRow[] {
    const needle = this.skillFind.value.trim();
    return needle.length === 0 ? this.skillRows : this.skillRows.filter((row) => findMatches(needle, row.name));
  }

  available(row: CatalogRow): boolean {
    return conditionHolds(row.condition, this.region.tempC);
  }

  setSupply(row: CatalogRow, delta: number): boolean {
    if (this.testing) {
      return this.apply({ type: 'SetSupply', entry: row.id, count: testingStep(this.count(row.id), delta) });
    }
    if (!this.available(row)) return false;
    const count = this.count(row.id);
    if (delta > 0 && count >= row.max) {
      this.flash = this.strings.get('ui.embark.supply_max', { max: row.max, entry: row.entry });
      return false;
    }
    const next = Math.max(0, Math.min(row.max, count + delta));
    return this.apply({ type: 'SetSupply', entry: row.id, count: next });
  }

  /**
   * A skill change, refused when the dwarf's points would pass `EMBARK_SKILL_POINTS_PER_DWARF`;
   * in testing mode any level to `SKILL_MAX_LEVEL`. A refused rise says why.
   */
  setSkill(dwarf: number, skill: string, delta: number): boolean {
    const d = this.session.party[dwarf];
    if (d === undefined) return false;
    const level = d.skills[skill] ?? 0;
    const next = level + delta;
    if (next < 0) return false;
    const max = this.testing ? SKILL_MAX_LEVEL : EMBARK_SKILL_MAX_PER_SKILL;
    if (next > max) {
      const name = this.skillRows.find((r) => r.id === skill)?.name ?? skill;
      this.flash = this.strings.get('ui.embark.skill_max', { skill: name, max });
      return false;
    }
    if (!this.testing && delta > 0 && skillPoints(d) + delta > EMBARK_SKILL_POINTS_PER_DWARF) {
      this.flash = this.strings.get('ui.embark.no_points', { name: d.name });
      return false;
    }
    return this.apply({ type: 'SetSkill', dwarf, skill, level: next });
  }

  /** `0`: the selected skill to nothing (Dwarves), none of the selected line (Supplies, Animals), or the selected free line gone (Items). */
  clear(): void {
    if (this.tab === 0) {
      const skill = this.visibleSkills()[this.skills.selected];
      const level = skill === undefined ? 0 : this.session.party[this.party.selected]?.skills[skill.id] ?? 0;
      if (skill !== undefined && level > 0) this.apply({ type: 'SetSkill', dwarf: this.party.selected, skill: skill.id, level: 0 });
      return;
    }
    if (this.tab === 3) {
      this.draft.removeSelected(this.items.selected, (cmd) => this.apply(cmd));
      return;
    }
    const row = this.rows()[this.items.selected];
    if (row !== undefined && this.count(row.id) > 0) this.apply({ type: 'SetSupply', entry: row.id, count: 0 });
  }

  /** The presets, each with its total and its dwarves' main skills, then the saved loadouts. */
  presetOptions(): DropdownOption[] {
    const library = this.host.loadouts;
    const loadoutsLabel = this.strings.get('ui.embark.loadouts.option');
    // The normal presets' totals and descriptions line up; the testing preset and the loadouts option are short.
    const width = Math.max(...this.presetRows.map((p) => Array.from(p.name).length));
    const options: DropdownOption[] = this.presetRows.map((p) => ({
      id: p.id,
      label: p.name.padEnd(width),
      detail: `${marks(suppliesTotal(this.registry, p.supplies)).padStart(5)} ☼ ${presetSummary(p.skills, this.embarkSkillRows)}`,
    }));
    options.push({ id: TESTING_PRESET_ID, label: TESTING_PRESET.name, detail: this.strings.get('ui.embark.testing_preset_detail') });
    if (library !== undefined) {
      options.push({ id: LOADOUTS_OPTION, label: loadoutsLabel, detail: this.strings.get('ui.embark.loadouts.count', { n: library.list().length }) });
    }
    return options;
  }

  choosePreset(id: string): void {
    if (id === LOADOUTS_OPTION) {
      this.presets.open = false;
      this.openLoadouts();
      return;
    }
    if (this.edited) {
      this.pendingPreset = id;
      return;
    }
    this.applyPreset(id);
  }

  /** A normal preset plays normally (leaving testing mode); the testing preset plays in testing mode. */
  applyPreset(id: string): void {
    this.pendingPreset = null;
    if (id !== TESTING_PRESET_ID && this.testing) this.session.apply({ type: 'SetEmbarkMode', mode: 'normal' });
    if (this.session.apply({ type: 'ApplyPreset', preset: id }).ok) this.edited = false;
    if (this.tab >= this.tabCount()) this.setTab(0);
  }

  /** The name of a preset, the testing preset's included. */
  presetName(id: string): string {
    return id === TESTING_PRESET_ID ? TESTING_PRESET.name : this.presetRows.find((p) => p.id === id)?.name ?? '';
  }

  /** `l`, or the presets menu's last option: the saved loadouts panel. */
  openLoadouts(): void {
    if (this.loadouts === null) return;
    this.presets.open = false;
    this.loadouts.toggle();
  }

  /** Load a saved loadout; edits are replaced only after the `c_load_loadout` confirmation. */
  chooseLoadout(loadout: SavedLoadout): void {
    if (!this.edited || this.host.confirm === undefined) {
      this.loadLoadout(loadout);
      return;
    }
    this.host.confirm('c_load_loadout', { loadout: loadout.name }, (yes) => {
      if (yes) this.loadLoadout(loadout);
    });
  }

  /**
   * Replace the skills and supplies with a saved loadout's (`02` § Loadouts). The budget stays the
   * site's: a loadout over it loads whole, and the panel says by how much so the player can trim it.
   */
  loadLoadout(loadout: SavedLoadout): LoadoutResult {
    const result = applyLoadout(this.session, this.registry, loadout, (entry) => {
      const row = this.catalog.find((r) => r.id === entry);
      return this.testing || row === undefined || this.available(row);
    });
    this.edited = false;
    if (this.tab >= this.tabCount()) this.setTab(0);
    if (this.loadouts !== null) this.loadouts.note = this.loadoutNote(loadout.name, result);
    return result;
  }

  /** "Loaded Deep start." and what the load left out or lowered, and the overspend. */
  loadoutNote(name: string, result: LoadoutResult): string {
    const s = this.strings;
    const entryName = (id: string): string => this.catalog.find((r) => r.id === id)?.entry ?? this.skillRows.find((r) => r.id === id)?.name ?? id;
    const parts = [s.get('ui.embark.loadouts.loaded', { loadout: name })];
    if (result.missing.length > 0) parts.push(s.get('ui.embark.loadouts.missing', { list: result.missing.join(', ') }));
    if (result.unavailable.length > 0) parts.push(s.get('ui.embark.loadouts.unavailable', { list: result.unavailable.map(entryName).join(', ') }));
    if (result.lowered.length > 0) parts.push(s.get('ui.embark.loadouts.lowered', { list: result.lowered.map(entryName).join(', ') }));
    if (result.extraDwarves > 0) parts.push(s.get('ui.embark.loadouts.extra_dwarves', { n: result.extraDwarves }));
    const over = this.session.total() - this.session.budget();
    if (over > 0) parts.push(s.get('ui.embark.loadouts.over', { total: marks(this.session.total()), n: marks(over) }));
    return parts.join(' ');
  }

  /** Why Embark is disabled, or `null` when it is enabled. */
  reason(): string | null {
    const s = this.strings;
    if (this.fortressName.value.trim().length === 0) return s.get('ui.embark.no_name');
    if (this.testing) return null;
    const check = this.session.canEmbark();
    if (check.ok) return null;
    const why = check.reason ?? '';
    if (why === 'over_budget') return s.get('ui.embark.over_budget', { n: marks(this.session.total() - this.session.budget()) });
    const [kind, index] = why.split(':');
    const name = this.session.party[Number(index)]?.name ?? '';
    if (kind === 'too_many_points') return s.get('ui.embark.too_many_points', { name, max: EMBARK_SKILL_POINTS_PER_DWARF });
    return s.get('ui.embark.skill_over_max', { name, max: EMBARK_SKILL_MAX_PER_SKILL });
  }

  /** "Unspent skill points: Frida Boarcloak 3": the dwarves with points left, which are lost at embark (`02` § Party generation). */
  unspent(): string | null {
    // Testing mode has no point limit, so nothing is left unspent.
    if (this.testing) return null;
    const left = this.session.party
      .filter((d) => skillPoints(d) < EMBARK_SKILL_POINTS_PER_DWARF)
      .map((d) => `${d.name} ${EMBARK_SKILL_POINTS_PER_DWARF - skillPoints(d)}`);
    return left.length === 0 ? null : this.strings.get('ui.embark.unspent', { list: left.join(', ') });
  }

  /**
   * The supply lines by the item each brings: a pick is an item of the `tool/pick` category, an
   * axe an item of `tool/axe`, food any `food/…` item, drink the `drink` item (`items.json`
   * categories).
   */
  missing(): MissingSupplies {
    const catalog = this.registry.table<CatalogRow & { item?: string }>('embarkCatalog');
    const items = this.registry.table<{ id: string; category?: string }>('items');
    const categories = this.session.supplies
      .filter((line) => line.count > 0)
      .map((line) => items.byId(catalog.byId(line.entry)?.item ?? '')?.category ?? '')
      .concat(this.session.items.map((line) => items.byId(line.item)?.category ?? ''));
    const has = (prefix: string): boolean => categories.some((c) => c === prefix || c.startsWith(`${prefix}/`));
    return { pick: !has('tool/pick'), axe: !has('tool/axe'), food: !has('food'), drink: !has('drink') };
  }

  /**
   * `Enter` Embark. A party with no pick, no axe, no food item or no drink item is asked first, one
   * question for each ("Embark without a pick?", "Embark without an axe?", "Embark with no food?",
   * "Embark with no drink?"), the safe answer being No.
   */
  confirm(): void {
    if (this.reason() !== null) return;
    const missing = this.missing();
    const asks: string[] = [];
    if (missing.pick) asks.push('c_embark_no_pick');
    if (missing.axe) asks.push('c_embark_no_axe');
    if (missing.food) asks.push('c_embark_no_food');
    if (missing.drink) asks.push('c_embark_no_drink');
    const ask = (k: number): void => {
      const id = asks[k];
      if (id === undefined || this.host.confirm === undefined) {
        this.embarkNow();
        return;
      }
      this.host.confirm(id, {}, (yes) => {
        if (yes) ask(k + 1);
      });
    };
    ask(0);
  }

  private embarkNow(): void {
    this.apply({ type: 'SetFortressName', name: normalizeName(this.fortressName.value) });
    if (!this.session.apply({ type: 'ConfirmEmbark' }).ok) return;
    this.host.embark(this.session);
  }

  // ---------- drawing ----------

  draw(surface: Surface): void {
    this.last = surface;
    const s = this.strings;
    const t = surface.theme;
    const cols = surface.cols;
    const tabItems = [
      { key: '1', label: s.get('ui.embark.tab.dwarves') },
      { key: '2', label: s.get('ui.embark.tab.supplies') },
      { key: '3', label: s.get('ui.embark.tab.animals') },
      ...(this.testing ? [{ key: '4', label: s.get('ui.embark.tab.items') }] : []),
    ];
    const tabWidth = tabItems.reduce((sum, item) => sum + Array.from(`[${item.key}] ${item.label}`).length, 0);
    const presetWidth = Array.from(`[p] ${s.get('ui.embark.presets')}`).length;
    // The Items tab of testing mode moves the tabs left, over the title, rather than off the edge.
    const compactWidth = tabWidth + (tabItems.length - 1) * UI_COMPACT_SPACING + UI_COMPACT_SPACING + presetWidth;
    const tabCol = this.testing ? Math.max(Math.min(32, cols - compactWidth), cols - 60) : Math.max(32, cols - 60);
    const compact = tabCol + tabWidth + (tabItems.length - 1) * UI_NORMAL_SPACING + EMBARK_PRESET_SPACING + presetWidth > cols;
    const title = s.get(this.testing ? 'ui.embark.title_testing' : 'ui.embark.title', { region: this.region.name });
    label(surface, 1, 0, title, { fg: this.testing ? t.bad : t.key, width: this.testing ? tabCol - 2 : 30 });
    const n = tabs(
      surface,
      tabCol,
      0,
      tabItems,
      this.tab,
      (index) => this.setTab(index),
      compact ? UI_COMPACT_SPACING : UI_NORMAL_SPACING,
    );
    const presetsCol = tabCol + n + (compact ? UI_COMPACT_SPACING : EMBARK_PRESET_SPACING);
    button(surface, presetsCol, 0, 'p', s.get('ui.embark.presets'), () => this.togglePresets());
    separator(surface, 0, 1, cols);
    const bodyRows = surface.rows - 6;
    if (this.tab === 0) this.drawDwarves(surface, 2, bodyRows);
    else if (this.tab === 3) this.draft.draw(surface, 2, bodyRows, this.drawContext());
    else this.drawCatalog(surface, 2, bodyRows);
    this.drawFooter(surface, surface.rows - 4);
    this.drawTestingLine(surface, surface.rows - 1);
    if (this.presets.open) {
      // Wide enough for each preset's description: its total and its dwarves' main skills.
      const listWidth = Math.min(cols - 2, EMBARK_PRESETS_WIDTH);
      dropdown(surface, Math.max(0, Math.min(presetsCol, cols - listWidth - 1)), 1, 31, s.get('ui.embark.presets'), this.presetOptions(), this.presets, (id) => {
        this.presets.open = false;
        this.choosePreset(id);
      }, () => this.togglePresets(), listWidth);
    }
    if (this.pendingPreset !== null) {
      const text = s.get('ui.embark.replace', { preset: this.presetName(this.pendingPreset) });
      surface.fill({ col: 0, row: surface.rows - 5, cols, rows: 1 }, t.panelBg);
      label(surface, 1, surface.rows - 5, text, { bg: t.panelBg, width: cols - 2 });
    }
    if (this.loadouts?.open === true) {
      // Modal: a click outside the panel closes it.
      const panel = this.loadouts;
      surface.hit({ col: 0, row: 0, cols, rows: surface.rows }, () => panel.close());
      panel.draw(surface, surface.rows - 4);
    }
  }

  private drawDwarves(surface: Surface, top: number, height: number): void {
    const s = this.strings;
    const t = surface.theme;
    const party = this.session.party;
    const listCols = 30;
    // The body's last row is the keys line; testing mode keeps the list's last row for `[a] add  [x] remove`.
    const listHeight = Math.max(1, height - (this.testing ? 2 : 1));
    // Each dwarf's skills on a second line, so the party's trades read at a glance; one line each when the party is too long for two.
    const perDwarf = party.length * 2 <= listHeight ? 2 : 1;
    const shown = Math.max(1, Math.floor(listHeight / perDwarf));
    this.shown.party = shown;
    clampList(this.party, party.length, shown);
    for (let k = 0; k < shown; k += 1) {
      const i = this.party.scroll + k;
      const d = party[i];
      if (d === undefined) break;
      const row = top + k * perDwarf;
      const mark = i === this.party.selected ? '▶ ' : '  ';
      const pts = this.testing ? String(skillPoints(d)) : `${skillPoints(d)}/${EMBARK_SKILL_POINTS_PER_DWARF}`;
      const text = `${mark}${d.name}`.slice(0, listCols - pts.length - 2).padEnd(listCols - pts.length - 1) + pts;
      label(surface, 0, row, text, { width: listCols });
      if (i === this.party.selected && this.focus === 'party') surface.invert({ col: 0, row, cols: listCols, rows: 1 });
      if (perDwarf === 2) {
        const summary = skillSummary(d.skills, this.skillRows, listCols - 4);
        label(surface, 3, row + 1, summary.length > 0 ? summary : s.get('ui.embark.no_skills'), { fg: t.dim, width: listCols - 4, keys: false });
      }
      surface.hit({ col: 0, row, cols: listCols, rows: perDwarf }, () => {
        this.party.selected = i;
        this.setFocus('party');
      });
    }
    if (this.testing) {
      const row = top + height - 2;
      const n = button(surface, 1, row, 'a', s.get('ui.embark.add_dwarf'), () => this.addDwarf());
      button(surface, 1 + n + 2, row, 'x', s.get('ui.embark.remove'), () => this.removeDwarf(), { enabled: party.length > 1 });
    }
    const rule = surface.glyphs.index('│');
    for (let r = 0; r < height - 1; r += 1) surface.put(listCols, top + r, rule, t.border, t.black);
    this.drawKeys(surface, top + height - 1, this.testing ? 'ui.embark.keys.dwarves_testing' : 'ui.embark.keys.dwarves');

    const d = party[this.party.selected];
    if (d === undefined) return;
    const c = listCols + 2;
    let row = top;
    if (this.focus === 'rename') textField(surface, c, row, 24, this.rename);
    else label(surface, c, row, d.name, { fg: t.key });
    button(surface, c + 32, row, 'n', s.get('ui.embark.rename'), () => this.startRename());
    row += 1;
    label(surface, c, row, s.get('ui.embark.age', { sex: s.get(`ui.embark.sex.${d.sex}`), age: d.ageYears }));
    const reroll = s.get('ui.embark.reroll', { cost: EMBARK_REROLL_COST });
    const rerollCol = Math.min(c + 32, surface.cols - Array.from(`[r] ${reroll}`).length - 1);
    button(surface, rerollCol, row, 'r', reroll, () => this.reroll());
    row += 1;
    const attributeCols = Math.min(13, Math.floor((surface.cols - c) / 4));
    const numberCols = Math.max(...ATTRIBUTES.map(attr => String(d.attributes[attr]).length));
    const barCols = Math.max(1, Math.min(5, attributeCols - 4 - 2 - numberCols));
    ATTRIBUTES.forEach((attr, k) => {
      const col = c + (k % 4) * attributeCols;
      if (k === 4) row += 1;
      label(surface, col, row, s.get(`ui.embark.attr.${attr}`));
      bar(surface, col + 4, row, d.attributes[attr], ATTRIBUTE_MAX, barCols);
      label(surface, col + 4 + barCols + 1, row, String(d.attributes[attr]), { fg: t.value });
    });
    row += 1;
    label(surface, c, row, d.personality.map((p) => this.traitNames.get(p) ?? p).join(' · '), { width: surface.cols - c - 1 });
    row += 1;
    const left = EMBARK_SKILL_POINTS_PER_DWARF - skillPoints(d);
    const maxLevel = this.testing ? SKILL_MAX_LEVEL : EMBARK_SKILL_MAX_PER_SKILL;
    const heading = this.testing ? s.get('ui.embark.skills_testing', { max: SKILL_MAX_LEVEL }) : s.get('ui.embark.skills', { n: left });
    separator(surface, c, row, surface.cols - c - 1, heading);
    // The skill list's find field sits at the rule's right end: a caption until it is in use.
    const findWidth = 10;
    const findCol = surface.cols - findWidth - 6;
    if (this.focus === 'filter' || this.skillFind.value.length > 0) textField(surface, findCol, row, findWidth, this.skillFind, () => this.setFocus('filter'));
    else {
      const caption = s.get('ui.embark.find_skill');
      button(surface, surface.cols - Array.from(`[/] ${caption}`).length - 3, row, '/', caption, () => this.setFocus('filter'));
    }
    row += 1;
    const skills = this.visibleSkills();
    const skillHeight = Math.max(1, top + height - 1 - row);
    this.shown.skills = skillHeight;
    clampList(this.skills, skills.length, skillHeight);
    if (skills.length === 0) label(surface, c, row, s.get('ui.embark.no_match', { text: this.skillFind.value.trim() }), { fg: t.dim, width: surface.cols - c - 1 });
    for (let r = 0; r < skillHeight; r += 1) {
      const index = this.skills.scroll + r;
      const skill = skills[index];
      if (skill === undefined) break;
      const level = d.skills[skill.id] ?? 0;
      const selected = index === this.skills.selected;
      const y = row + r;
      label(surface, c, y, `${selected ? '▶ ' : '  '}${skill.name}`, { width: 18 });
      if (selected && this.focus === 'skills') surface.invert({ col: c, row: y, cols: 18, rows: 1 });
      surface.hit({ col: c, row: y, cols: 18, rows: 1 }, () => {
        this.skills.selected = index;
        this.setFocus('skills');
      });
      const dwarf = this.party.selected;
      const w = numberField(surface, c + 19, y, level, (delta) => void this.setSkill(dwarf, skill.id, delta), {
        min: 0,
        max: this.testing ? maxLevel : Math.min(maxLevel, level + left),
      });
      const barCol = c + 19 + w + 2;
      const barWidth = Math.max(0, Math.min(level, surface.cols - barCol - 1));
      if (level > 0) bar(surface, barCol, y, level, level, barWidth);
    }
  }

  private drawCatalog(surface: Surface, top: number, height: number): void {
    const s = this.strings;
    const t = surface.theme;
    const finding = this.filter.value.trim().length > 0;
    let row = top;
    if (this.tab === 1) {
      label(surface, 1, row, s.get('ui.embark.filter'));
      textField(surface, 10, row, 10, this.filter, () => this.setFocus('filter'));
      // The groups, then the chosen lines; the separators close up when the bar would not fit.
      const views = [...SUPPLY_CATEGORIES.map((cat) => s.get(`ui.embark.category.${cat}`)), s.get('ui.embark.category.chosen')];
      const width = views.reduce((sum, v) => sum + Array.from(v).length, 0);
      const gap = 26 + width + 3 * (views.length - 1) <= surface.cols - 1 ? ' │ ' : '│';
      let c = 26;
      views.forEach((view, k) => {
        if (k > 0) c += label(surface, c, row, gap, { fg: t.border });
        const n = label(surface, c, row, view);
        const rect = { col: c, row, cols: n, rows: 1 };
        // A find lists every group, so no group is marked while it is in use.
        if (k === this.category && !finding) surface.invert(rect);
        surface.hit(rect, () => this.setCategory(k));
        c += n;
      });
      row += 1;
    }
    const rows = this.rows();
    const mixed = this.mixed();
    // Below the list: two lines for the selected line's note or the hint, then the keys line.
    const listHeight = Math.max(1, height - (row - top) - 3);
    this.shown.items = listHeight;
    clampList(this.items, rows.length, listHeight);
    if (rows.length === 0) {
      const empty = finding ? s.get('ui.embark.no_match', { text: this.filter.value.trim() }) : s.get('ui.embark.none_chosen');
      label(surface, 3, row, empty, { fg: t.dim, width: surface.cols - 4 });
    }
    for (let r = 0; r < listHeight; r += 1) {
      const index = this.items.scroll + r;
      const entry = rows[index];
      if (entry === undefined) break;
      const y = row + r;
      const selected = index === this.items.selected;
      const ok = this.testing || this.available(entry);
      const name = entry.entry.charAt(0).toUpperCase() + entry.entry.slice(1);
      label(surface, 1, y, `${selected ? '▶ ' : '  '}${name}`, { width: 26, fg: ok ? t.text : t.dim });
      if (selected && this.focus === 'items') surface.invert({ col: 1, row: y, cols: 26, rows: 1 });
      surface.hit({ col: 1, row: y, cols: 26, rows: 1 }, () => {
        this.items.selected = index;
        this.setFocus('items');
      });
      const price = `${String(entry.price).padStart(4)} ☼`;
      label(surface, 28, y, price, { fg: t.value });
      const count = this.count(entry.id);
      const w = numberField(surface, 36, y, count, (delta) => void this.setSupply(entry, delta), {
        min: 0,
        max: this.testing ? EMBARK_TESTING_MAX_COUNT : ok ? entry.max : count,
        width: this.testing ? 3 : 2,
      });
      if (count > 0) label(surface, 36 + w + 2, y, `= ${String(entry.price * count).padStart(this.testing ? 5 : 4)}`, { fg: t.value });
      // Lines of several groups name theirs.
      if (mixed) label(surface, 36 + w + 10, y, this.categoryName(entry.category), { fg: t.dim, width: Math.max(1, surface.cols - (36 + w + 11)) });
    }
    const current = rows[this.items.selected];
    const noteRow = row + listHeight;
    let note: string | null = null;
    if (current !== undefined && !this.testing && !this.available(current)) note = s.get('ui.embark.unavailable', { condition: current.condition ?? '' });
    else if (current?.note !== undefined) note = current.note;
    else if (this.tab === 1) {
      // The hint alternates between two lines every EMBARK_HINT_SECONDS of real time and on each tab change.
      const turn = Math.floor((this.host.now?.() ?? 0) / (EMBARK_HINT_SECONDS * 1000)) + this.tabChanges;
      note = s.get(turn % 2 === 0 ? 'ui.embark.hint' : 'ui.embark.hint_beasts');
    }
    if (note !== null) wrapText(note, surface.cols - 2, 2).forEach((line, k) => label(surface, 1, noteRow + k, line, { fg: t.dim, keys: false }));
    this.drawKeys(surface, top + height - 1, this.tab === 1 ? 'ui.embark.keys.supplies' : 'ui.embark.keys.animals');
  }

  /** The keys line at the foot of the body, or why the last key did nothing. */
  private drawKeys(surface: Surface, row: number, key: string): void {
    const t = surface.theme;
    if (this.flash !== null) label(surface, 1, row, this.flash, { fg: t.note, width: surface.cols - 2, keys: false });
    else label(surface, 1, row, this.strings.get(key), { fg: t.dim, width: surface.cols - 2 });
  }

  private drawFooter(surface: Surface, row: number): void {
    const s = this.strings;
    const t = surface.theme;
    separator(surface, 0, row, surface.cols);
    label(surface, 1, row + 1, s.get('ui.embark.fortress_name'));
    const field = textField(surface, 15, row + 1, 20, this.fortressName, () => this.setFocus('name'));
    const budget = this.session.budget();
    const spent = this.session.total();
    const full = this.testing
      ? s.get('ui.embark.budget_testing', { spent: marks(spent) })
      : spent > budget
        ? s.get('ui.embark.budget_over', { budget: marks(budget), spent: marks(spent), over: marks(spent - budget) })
        : s.get('ui.embark.budget', { budget: marks(budget), spent: marks(spent), left: marks(budget - spent) });
    // The figures close up rather than run into the name field or past the edge.
    const room = surface.cols - (15 + field + 1) - 1;
    const text = Array.from(full).length > room ? full.replace(/ {3}/g, ' ') : full;
    const budgetCol = Math.max(15 + field + 1, surface.cols - Array.from(text).length - 1);
    label(surface, budgetCol, row + 1, text, { fg: spent > budget ? t.bad : t.text });
    const reason = this.reason();
    button(surface, 1, row + 2, 'Enter', s.get('ui.embark.embark'), () => this.confirm(), { enabled: reason === null });
    // A reason Embark is off, else the dwarves whose points would be lost.
    const unspent = reason === null ? this.unspent() : null;
    if (reason !== null) label(surface, 18, row + 2, reason, { fg: t.bad, width: surface.cols - 34 });
    else if (unspent !== null) label(surface, 18, row + 2, unspent, { fg: t.note, width: surface.cols - 34, keys: false });
    button(surface, surface.cols - 12, row + 2, 'Esc', s.get('ui.embark.back'), () => this.leave());
  }

  /** The bottom line: the testing mode switch and what the mode is (`02` § Testing mode: "not the default; say so"). */
  private drawTestingLine(surface: Surface, row: number): void {
    const s = this.strings;
    const n = button(surface, 1, row, 't', s.get(this.testing ? 'ui.embark.testing_on' : 'ui.embark.testing_off'), () => this.toggleTesting());
    const note = s.get(this.testing ? 'ui.embark.testing_note_on' : 'ui.embark.testing_note_off');
    label(surface, 1 + n + 2, row, note, { fg: this.testing ? surface.theme.bad : surface.theme.dim, width: Math.max(0, surface.cols - n - 4) });
  }

  /** What the Items tab draws with (`embark-testing.ts`). */
  private drawContext(): Parameters<TestingDraft['draw']>[3] {
    return {
      session: this.session,
      strings: this.strings,
      list: this.items,
      focused: this.focus === 'items',
      filter: this.filter,
      apply: (cmd) => this.apply(cmd),
      add: () => this.addItem(),
      select: (index) => {
        this.items.selected = index;
        this.setFocus('items');
      },
      focusFilter: () => this.setFocus('filter'),
    };
  }

  // ---------- input ----------

  setTab(index: number): void {
    const last = this.tabCount() - 1;
    const next = Math.max(0, Math.min(last, index));
    if (next !== this.tab) this.tabChanges += 1;
    // The Items tab's filter names an item or a material, not a catalog entry: it starts empty there.
    if ((next === 3) !== (this.tab === 3)) this.filter.value = '';
    this.tab = next;
    this.items.selected = 0;
    this.items.scroll = 0;
    this.setFocus(this.tab === 0 ? 'party' : 'items');
  }

  /** A Supplies view: a group, or the chosen lines ({@link CHOSEN_VIEW}); choosing one ends a find. */
  setCategory(index: number): void {
    this.category = index;
    this.filter.value = '';
    this.items.selected = 0;
    this.items.scroll = 0;
    if (this.focus === 'filter') this.setFocus('items');
  }

  setFocus(focus: Focus): void {
    this.focus = focus;
    this.fortressName.focused = focus === 'name';
    this.rename.focused = focus === 'rename';
    this.filter.focused = focus === 'filter' && this.tab !== 0;
    this.skillFind.focused = focus === 'filter' && this.tab === 0;
  }

  /** The list a find field hands the keys back to. */
  private listFocus(): Focus {
    return this.tab === 0 ? (this.focus === 'filter' ? 'skills' : 'party') : 'items';
  }

  togglePresets(): void {
    this.presets.open = !this.presets.open;
    // The menu opens on the preset the loadout started from.
    this.presets.highlighted = Math.max(0, this.presetOptions().findIndex((p) => p.id === this.session.preset));
  }

  startRename(): void {
    const d = this.session.party[this.party.selected];
    if (d === undefined) return;
    this.rename.value = d.name;
    this.setFocus('rename');
  }

  reroll(): void {
    this.apply({ type: 'RerollDwarf', dwarf: this.party.selected });
  }

  /** `Esc` Back: the skills and supplies set here are lost, so after edits it asks first (`c_leave_embark`, default No). */
  leave(): void {
    if (!this.edited || this.host.confirm === undefined) {
      this.host.back();
      return;
    }
    this.host.confirm('c_leave_embark', {}, (yes) => {
      if (yes) this.host.back();
    });
  }

  /** The fields `Tab` cycles through on each tab. */
  private fields(): Focus[] {
    return this.tab === 0 ? ['party', 'skills', 'filter', 'name'] : this.tab === 2 ? ['items', 'name'] : ['items', 'filter', 'name'];
  }

  /** The list the selection keys, the wheel and `PageUp` `PageDown` move: its state, length and visible rows. */
  private focusedList(): { list: ListState; size: number; page: number } {
    if (this.tab === 0 && this.focus === 'party') return { list: this.party, size: this.session.party.length, page: this.shown.party };
    if (this.tab === 0) return { list: this.skills, size: this.visibleSkills().length, page: this.shown.skills };
    // The Items tab's form and lines do not scroll as one list: a page is the form's rows.
    if (this.tab === 3) return { list: this.items, size: this.draft.rowCount(this.session), page: DRAFT_ROWS };
    return { list: this.items, size: this.rows().length, page: this.shown.items };
  }

  key(press: KeyPress): boolean {
    this.flash = null;
    if (this.pendingPreset !== null) {
      if (press.key === 'y') this.applyPreset(this.pendingPreset);
      else this.pendingPreset = null;
      return true;
    }
    if (this.loadouts?.open === true) return this.loadouts.key(press);
    if (this.presets.open) {
      const r = dropdownKey(this.presets, this.presetOptions(), press);
      if (r !== null && r !== 'handled') this.choosePreset(r);
      if (r !== null) return true;
      if (this.keymap.resolve('embark', press)?.id === 'presets') {
        this.presets.open = false;
        return true;
      }
      return false;
    }
    if (this.focus === 'filter') {
      // A find field: `Esc` empties it; `Enter`, `Tab` and the arrows hand the keys back to its list.
      const find = this.tab === 0 ? this.skillFind : this.filter;
      const list = this.tab === 0 ? this.skills : this.items;
      if (press.key === 'Esc') find.value = '';
      if (press.key === 'Enter' || press.key === 'Tab' || press.key === 'Esc' || press.key === '↓' || press.key === '↑') {
        this.setFocus(this.listFocus());
        return true;
      }
      if (this.tab === 3) {
        // The Items tab's find narrows the selected field's choices (item, material, stone).
        const handled = editText(find, press);
        this.draft.refilter(this.items.selected, find.value);
        return handled;
      }
      list.selected = 0;
      list.scroll = 0;
      return editText(find, press);
    }
    if (this.focus === 'name' || this.focus === 'rename') {
      if (press.key === 'Enter' || press.key === 'Tab' || press.key === 'Esc') {
        if (this.focus === 'rename' && press.key !== 'Esc') {
          this.apply({ type: 'RenameDwarf', dwarf: this.party.selected, name: normalizeName(this.rename.value) });
        }
        if (this.focus === 'name' && this.fortressName.value.trim().length > 0) {
          this.apply({ type: 'SetFortressName', name: normalizeName(this.fortressName.value) });
        }
        this.setFocus(this.listFocus());
        return true;
      }
      return editText(this.focus === 'name' ? this.fortressName : this.rename, press);
    }
    if (press.key === 'Esc') {
      // A find in use is the first thing `Esc` takes back; then the screen, after asking when there are edits to lose.
      const find = this.tab === 0 ? this.skillFind : this.tab === 2 ? null : this.filter;
      if (find !== null && find.value.length > 0) {
        find.value = '';
        if (this.tab !== 3) {
          const list = this.tab === 0 ? this.skills : this.items;
          list.selected = 0;
          list.scroll = 0;
        }
      } else this.leave();
      return true;
    }
    const action = this.keymap.resolve('embark', press);
    if (action !== null) {
      switch (action.id) {
        case 'tab':
          // `4` (Items) exists only in testing mode.
          if (Number(action.arg) < this.tabCount()) this.setTab(Number(action.arg));
          return true;
        case 'adjust':
          this.adjust(Number(action.arg));
          return true;
        case 'clear':
          this.clear();
          return true;
        case 'reroll':
          this.reroll();
          return true;
        case 'rename':
          this.startRename();
          return true;
        case 'presets':
          this.togglePresets();
          return true;
        case 'loadouts':
          this.openLoadouts();
          return this.loadouts !== null;
        case 'embark':
          this.confirm();
          return true;
        case 'testing':
          this.toggleTesting();
          return true;
        case 'add':
          if (this.testing && this.tab === 0) this.addDwarf();
          else if (this.testing && this.tab === 3) this.addItem();
          return true;
        case 'remove':
          if (this.testing && this.tab === 0) this.removeDwarf();
          else if (this.testing && this.tab === 3) this.draft.removeSelected(this.items.selected, (cmd) => this.apply(cmd));
          return true;
        case 'skill_all':
          if (this.testing && this.tab === 0) this.skillAll();
          return true;
        default:
          break;
      }
    }
    const panel = this.keymap.resolve('panel', press);
    if (panel === null) return false;
    switch (panel.id) {
      case 'across': {
        if (this.tab === 3) {
          this.draft.adjust(this.items.selected, panel.arg === '←' ? -1 : 1, this.filter.value, this.session, (cmd) => this.apply(cmd));
          return true;
        }
        if (this.tab !== 1) return false;
        const d = panel.arg === '←' ? -1 : 1;
        this.setCategory((this.category + d + CHOSEN_VIEW + 1) % (CHOSEN_VIEW + 1));
        return true;
      }
      case 'select': {
        const { list, size } = this.focusedList();
        list.selected = Math.max(0, Math.min(size - 1, list.selected + (panel.arg === '↑' ? -1 : 1)));
        // On the Items tab a find is for one field: moving to another drops it.
        if (this.tab === 3) this.filter.value = '';
        return true;
      }
      case 'scroll': {
        const { list, size, page } = this.focusedList();
        list.selected = Math.max(0, Math.min(size - 1, list.selected + Number(panel.arg) * Math.max(1, page - 1)));
        if (this.tab === 3) this.filter.value = '';
        return true;
      }
      case 'field': {
        const fields = this.fields();
        const at = Math.max(0, fields.indexOf(this.focus));
        this.setFocus(fields[(at + Number(panel.arg) + fields.length) % fields.length] as Focus);
        return true;
      }
      case 'filter_focus':
        // `/` starts a new find on every tab: skills on Dwarves, every supply and animal on Supplies,
        // the selected field's choices on Items. The Animals tab has no find field of its own: the
        // Supplies find reaches the animals too.
        if (this.tab === 2) this.setTab(1);
        (this.tab === 0 ? this.skillFind : this.filter).value = '';
        this.setFocus('filter');
        return true;
      default:
        return false;
    }
  }

  /** `+`/`-` on the selected skill (Dwarves), quantity (Supplies, Animals) or Items row. */
  adjust(delta: number): void {
    if (this.tab === 0) {
      const skill = this.visibleSkills()[this.skills.selected];
      if (skill !== undefined) this.setSkill(this.party.selected, skill.id, delta);
      return;
    }
    if (this.tab === 3) {
      this.draft.adjust(this.items.selected, delta, this.filter.value, this.session, (cmd) => this.apply(cmd));
      return;
    }
    const row = this.rows()[this.items.selected];
    if (row !== undefined) this.setSupply(row, delta);
  }

  pointerDown(p: CellPointer): void {
    this.flash = null;
    clickHit(this.last, p);
  }

  /** The wheel scrolls the list under the pointer, three rows a notch; the selection stays in view. */
  wheel(w: CellWheel): void {
    const step = Math.sign(w.dy) * EMBARK_WHEEL_ROWS;
    const scroll = (list: ListState, size: number, page: number): void => {
      list.scroll = Math.max(0, Math.min(Math.max(0, size - page), list.scroll + step));
      list.selected = Math.max(list.scroll, Math.min(list.scroll + page - 1, list.selected));
    };
    if (this.tab === 0 && w.col < 30) scroll(this.party, this.session.party.length, this.shown.party);
    else if (this.tab === 0) scroll(this.skills, this.visibleSkills().length, this.shown.skills);
    // The Items tab draws its form and lines whole: the wheel moves the selection.
    else if (this.tab === 3) this.items.selected = Math.max(0, Math.min(this.draft.rowCount(this.session) - 1, this.items.selected + step));
    else scroll(this.items, this.rows().length, this.shown.items);
  }
}
