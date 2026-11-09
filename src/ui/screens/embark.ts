/**
 * The embark screen: `04-implementation/ui-screens/embark.md`, `02-systems/02-embark-and-loadout.md`
 * § Presets, § Player-facing behavior, `03-content/embark-catalog.md`, and the `embark` keys of
 * `ui-keymap-and-screens.md` (`1` `2` `3` tabs, `+` `-` adjust, `r` reroll, `n` rename, `p`
 * presets, `Enter` Embark).
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
import { TestingDraft, testingStep } from './embark-testing';
import { applyLoadout, loadoutOf, loadoutTotal, type LoadoutResult, type SavedLoadout } from '@systems/embark';
import { EMBARK_DEFAULT_PRESET, EMBARK_HINT_SECONDS, EMBARK_PRESET_SPACING, UI_NORMAL_SPACING, UI_COMPACT_SPACING } from '../constants';
import type { KeyContext, Keymap } from '../keymap';
import { clickHit, type CellPointer, type Screen } from '../screen';
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
import type { TextInputSpec } from './text_input';

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
    const skill = this.skillRows[this.skills.selected];
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

  /** The catalog rows of the current tab (and category and filter on the supplies tab). */
  rows(): CatalogRow[] {
    const needle = this.filter.value.trim().toLowerCase();
    return this.catalog.filter((row) => {
      if (this.tab === 2) return row.category === 'animals';
      if (row.category === 'animals') return false;
      if (needle.length > 0) return row.entry.toLowerCase().includes(needle);
      return row.category === SUPPLY_CATEGORIES[this.category];
    });
  }

  available(row: CatalogRow): boolean {
    return conditionHolds(row.condition, this.region.tempC);
  }

  setSupply(row: CatalogRow, delta: number): boolean {
    if (this.testing) {
      return this.apply({ type: 'SetSupply', entry: row.id, count: testingStep(this.count(row.id), delta) });
    }
    if (!this.available(row)) return false;
    const next = Math.max(0, Math.min(row.max, this.count(row.id) + delta));
    return this.apply({ type: 'SetSupply', entry: row.id, count: next });
  }

  /**
   * A skill change, refused when the dwarf's points would pass `EMBARK_SKILL_POINTS_PER_DWARF`;
   * in testing mode any level to `SKILL_MAX_LEVEL`.
   */
  setSkill(dwarf: number, skill: string, delta: number): boolean {
    const d = this.session.party[dwarf];
    if (d === undefined) return false;
    const level = d.skills[skill] ?? 0;
    const next = level + delta;
    if (next < 0 || next > (this.testing ? SKILL_MAX_LEVEL : EMBARK_SKILL_MAX_PER_SKILL)) return false;
    if (!this.testing && delta > 0 && skillPoints(d) + delta > EMBARK_SKILL_POINTS_PER_DWARF) return false;
    return this.apply({ type: 'SetSkill', dwarf, skill, level: next });
  }

  presetOptions(): DropdownOption[] {
    const options: DropdownOption[] = this.presetRows.map((p) => ({
      id: p.id,
      label: p.name,
      detail: `${marks(suppliesTotal(this.registry, p.supplies))} ☼`,
    }));
    options.push({ id: TESTING_PRESET_ID, label: TESTING_PRESET.name, detail: this.strings.get('ui.embark.testing_preset_detail') });
    const library = this.host.loadouts;
    if (library !== undefined) {
      options.push({ id: LOADOUTS_OPTION, label: this.strings.get('ui.embark.loadouts.option'), detail: this.strings.get('ui.embark.loadouts.count', { n: library.list().length }) });
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
      dropdown(surface, Math.max(0, Math.min(presetsCol, cols - 32)), 1, 31, s.get('ui.embark.presets'), this.presetOptions(), this.presets, (id) => {
        this.presets.open = false;
        this.choosePreset(id);
      }, () => this.togglePresets());
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
    // Testing mode keeps the list's last row for `[a] add  [x] remove`, and the list scrolls.
    const listHeight = this.testing ? Math.max(1, height - 1) : height;
    clampList(this.party, party.length, listHeight);
    for (let r = 0; r < listHeight; r += 1) {
      const i = this.party.scroll + r;
      const d = party[i];
      if (d === undefined) break;
      const row = top + r;
      const mark = i === this.party.selected ? '▶ ' : '  ';
      const pts = this.testing ? String(skillPoints(d)) : `${skillPoints(d)}/${EMBARK_SKILL_POINTS_PER_DWARF}`;
      const text = `${mark}${d.name}`.slice(0, listCols - pts.length - 2).padEnd(listCols - pts.length - 1) + pts;
      label(surface, 0, row, text, { width: listCols });
      if (i === this.party.selected && this.focus === 'party') surface.invert({ col: 0, row, cols: listCols, rows: 1 });
      surface.hit({ col: 0, row, cols: listCols, rows: 1 }, () => {
        this.party.selected = i;
        this.setFocus('party');
      });
    }
    if (this.testing) {
      const row = top + height - 1;
      const n = button(surface, 1, row, 'a', s.get('ui.embark.add_dwarf'), () => this.addDwarf());
      button(surface, 1 + n + 2, row, 'x', s.get('ui.embark.remove'), () => this.removeDwarf(), { enabled: party.length > 1 });
    }
    const rule = surface.glyphs.index('│');
    for (let r = 0; r < height; r += 1) surface.put(listCols, top + r, rule, t.border, t.black);

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
    row += 1;
    const skillHeight = Math.max(1, top + height - row);
    clampList(this.skills, this.skillRows.length, skillHeight);
    for (let r = 0; r < skillHeight; r += 1) {
      const index = this.skills.scroll + r;
      const skill = this.skillRows[index];
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
    let row = top;
    if (this.tab === 1) {
      label(surface, 1, row, s.get('ui.embark.filter'));
      textField(surface, 10, row, 10, this.filter, () => this.setFocus('filter'));
      let c = 26;
      SUPPLY_CATEGORIES.forEach((cat, k) => {
        if (k > 0) c += label(surface, c, row, ' │ ', { fg: t.border });
        const n = label(surface, c, row, s.get(`ui.embark.category.${cat}`));
        const rect = { col: c, row, cols: n, rows: 1 };
        if (k === this.category) surface.invert(rect);
        surface.hit(rect, () => {
          this.category = k;
          this.items.selected = 0;
        });
        c += n;
      });
      row += 1;
    }
    const rows = this.rows();
    const listHeight = Math.max(1, height - (row - top) - 2);
    clampList(this.items, rows.length, listHeight);
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
    }
    const current = rows[this.items.selected];
    const noteRow = row + listHeight;
    if (current !== undefined && !this.testing && !this.available(current)) {
      label(surface, 1, noteRow, s.get('ui.embark.unavailable', { condition: current.condition ?? '' }), { fg: t.dim });
    } else if (current?.note !== undefined) {
      label(surface, 1, noteRow, current.note, { fg: t.dim });
    } else if (this.tab === 1) {
      // The hint alternates between two lines every EMBARK_HINT_SECONDS of real time and on each tab change.
      const turn = Math.floor((this.host.now?.() ?? 0) / (EMBARK_HINT_SECONDS * 1000)) + this.tabChanges;
      label(surface, 1, noteRow, s.get(turn % 2 === 0 ? 'ui.embark.hint' : 'ui.embark.hint_beasts'), { fg: t.dim });
    }
  }

  private drawFooter(surface: Surface, row: number): void {
    const s = this.strings;
    const t = surface.theme;
    separator(surface, 0, row, surface.cols);
    label(surface, 1, row + 1, s.get('ui.embark.fortress_name'));
    textField(surface, 15, row + 1, 20, this.fortressName, () => this.setFocus('name'));
    const budget = this.session.budget();
    const spent = this.session.total();
    const text = this.testing
      ? s.get('ui.embark.budget_testing', { spent: marks(spent) })
      : s.get('ui.embark.budget', { budget: marks(budget), spent: marks(spent), left: marks(budget - spent) });
    const budgetCol = Math.max(36, surface.cols - Array.from(text).length - 1);
    label(surface, budgetCol, row + 1, text, { fg: spent > budget ? t.bad : t.text });
    const reason = this.reason();
    button(surface, 1, row + 2, 'Enter', s.get('ui.embark.embark'), () => this.confirm(), { enabled: reason === null });
    if (reason !== null) label(surface, 18, row + 2, reason, { fg: t.bad, width: surface.cols - 34 });
    button(surface, surface.cols - 12, row + 2, 'Esc', s.get('ui.embark.back'), () => this.host.back());
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

  setFocus(focus: Focus): void {
    this.focus = focus;
    this.fortressName.focused = focus === 'name';
    this.rename.focused = focus === 'rename';
    this.filter.focused = focus === 'filter';
  }

  togglePresets(): void {
    this.presets.open = !this.presets.open;
    this.presets.highlighted = 0;
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

  /** The fields `Tab` cycles through on each tab. */
  private fields(): Focus[] {
    return this.tab === 0 ? ['party', 'skills', 'name'] : this.tab === 1 || this.tab === 3 ? ['items', 'filter', 'name'] : ['items', 'name'];
  }

  key(press: KeyPress): boolean {
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
    if (this.focus === 'name' || this.focus === 'rename' || this.focus === 'filter') {
      if (press.key === 'Enter' || press.key === 'Tab' || press.key === 'Esc') {
        if (this.focus === 'rename' && press.key !== 'Esc') {
          this.apply({ type: 'RenameDwarf', dwarf: this.party.selected, name: normalizeName(this.rename.value) });
        }
        if (this.focus === 'name' && this.fortressName.value.trim().length > 0) {
          this.apply({ type: 'SetFortressName', name: normalizeName(this.fortressName.value) });
        }
        this.setFocus(this.tab === 0 ? 'party' : 'items');
        return true;
      }
      if (this.focus === 'filter' && this.tab === 3) {
        // The Items tab's filter narrows the selected field's choices (item, material, stone).
        const handled = editText(this.filter, press);
        this.draft.refilter(this.items.selected, this.filter.value);
        return handled;
      }
      if (this.focus === 'filter') this.items.selected = 0;
      return editText(this.focus === 'name' ? this.fortressName : this.focus === 'rename' ? this.rename : this.filter, press);
    }
    if (press.key === 'Esc') {
      this.host.back();
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
        this.category = (this.category + d + SUPPLY_CATEGORIES.length) % SUPPLY_CATEGORIES.length;
        this.items.selected = 0;
        return true;
      }
      case 'select': {
        const d = panel.arg === '↑' ? -1 : 1;
        const list = this.focus === 'party' ? this.party : this.focus === 'skills' ? this.skills : this.items;
        list.selected = Math.max(0, list.selected + d);
        if (this.tab === 3) this.filter.value = '';
        const items = this.tab === 3 ? this.draft.rowCount(this.session) : this.rows().length;
        const size = this.focus === 'party' ? this.session.party.length : this.focus === 'skills' ? this.skillRows.length : items;
        list.selected = Math.min(size - 1, list.selected);
        return true;
      }
      case 'field': {
        const fields = this.fields();
        const at = Math.max(0, fields.indexOf(this.focus));
        this.setFocus(fields[(at + Number(panel.arg) + fields.length) % fields.length] as Focus);
        return true;
      }
      case 'filter_focus':
        // On the Items tab a filter is for the selected field only: it starts empty.
        if (this.tab === 3) this.filter.value = '';
        if (this.tab === 1 || this.tab === 3) this.setFocus('filter');
        return true;
      default:
        return false;
    }
  }

  /** `+`/`-` on the selected skill (Dwarves), quantity (Supplies, Animals) or Items row. */
  adjust(delta: number): void {
    if (this.tab === 0) {
      const skill = this.skillRows[this.skills.selected];
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
    clickHit(this.last, p);
  }
}
