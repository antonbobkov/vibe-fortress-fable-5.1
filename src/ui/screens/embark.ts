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

import { ATTRIBUTE_MAX, EMBARK_SKILL_MAX_PER_SKILL, EMBARK_SKILL_POINTS_PER_DWARF } from '@core/constants';
import type { Attributes } from '@core/components';
import type { Registry } from '@core/registry';
import type { KeyPress } from '@platform/input';
import { EMBARK_REROLL_COST, EmbarkSession, skillPoints, suppliesTotal, type EmbarkCommand, type EmbarkPresetRow } from '@systems/embark';
import { EMBARK_DEFAULT_PRESET } from '../constants';
import type { Keymap } from '../keymap';
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
}

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
  readonly session: EmbarkSession;
  tab = 0;
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
  private readonly skillRows: SkillRow[];
  private readonly traitNames: Map<string, string>;
  private readonly presetRows: EmbarkPresetRow[];

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
    this.skillRows = skills
      .ids()
      .map((id) => skills.byId(id) as SkillRow)
      .sort((a, b) => a.name.localeCompare(b.name));
    const traits = registry.table<TraitRow>('personality');
    this.traitNames = new Map(traits.ids().map((id) => [id, (traits.byId(id) as TraitRow).name]));
    const presets = registry.table<EmbarkPresetRow>('embarkPresets');
    this.presetRows = presets.ids().map((id) => presets.byId(id) as EmbarkPresetRow);
    // `02` § Presets: "The screen opens with `balanced` applied" (D-U3, audit Q1).
    if (presets.has(EMBARK_DEFAULT_PRESET)) this.applyPreset(EMBARK_DEFAULT_PRESET);
  }

  // ---------- state ----------

  apply(cmd: EmbarkCommand): boolean {
    const r = this.session.apply(cmd);
    if (r.ok && cmd.type !== 'ApplyPreset' && cmd.type !== 'ConfirmEmbark') this.edited = true;
    return r.ok;
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
    if (!this.available(row)) return false;
    const next = Math.max(0, Math.min(row.max, this.count(row.id) + delta));
    return this.apply({ type: 'SetSupply', entry: row.id, count: next });
  }

  /** A skill change, refused when the dwarf's points would pass `EMBARK_SKILL_POINTS_PER_DWARF`. */
  setSkill(dwarf: number, skill: string, delta: number): boolean {
    const d = this.session.party[dwarf];
    if (d === undefined) return false;
    const level = d.skills[skill] ?? 0;
    const next = level + delta;
    if (next < 0 || next > EMBARK_SKILL_MAX_PER_SKILL) return false;
    if (delta > 0 && skillPoints(d) + delta > EMBARK_SKILL_POINTS_PER_DWARF) return false;
    return this.apply({ type: 'SetSkill', dwarf, skill, level: next });
  }

  presetOptions(): DropdownOption[] {
    return this.presetRows.map((p) => ({
      id: p.id,
      label: p.name,
      detail: `${marks(suppliesTotal(this.registry, p.supplies))} ☼`,
    }));
  }

  choosePreset(id: string): void {
    if (this.edited) {
      this.pendingPreset = id;
      return;
    }
    this.applyPreset(id);
  }

  applyPreset(id: string): void {
    this.pendingPreset = null;
    if (this.session.apply({ type: 'ApplyPreset', preset: id }).ok) this.edited = false;
  }

  /** Why Embark is disabled, or `null` when it is enabled. */
  reason(): string | null {
    const s = this.strings;
    if (this.fortressName.value.trim().length === 0) return s.get('ui.embark.no_name');
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
      .map((line) => items.byId(catalog.byId(line.entry)?.item ?? '')?.category ?? '');
    const has = (prefix: string): boolean => categories.some((c) => c === prefix || c.startsWith(`${prefix}/`));
    return { pick: !has('tool/pick'), axe: !has('tool/axe'), food: !has('food'), drink: !has('drink') };
  }

  /**
   * `Enter` Embark. A party with no pick, no axe, or with no food or no drink, is asked first
   * ("Embark without a pick?", "Embark without an axe?", "Embark without food or drink?"), the safe
   * answer being No (D-U3, revised for axe).
   */
  confirm(): void {
    if (this.reason() !== null) return;
    const missing = this.missing();
    const asks: string[] = [];
    if (missing.pick) asks.push('c_embark_no_pick');
    if (missing.axe) asks.push('c_embark_no_axe');
    if (missing.food || missing.drink) asks.push('c_embark_no_food_drink');
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
    label(surface, 1, 0, s.get('ui.embark.title', { region: this.region.name }), { fg: t.key, width: 30 });
    const tabCol = Math.max(32, cols - 60);
    const n = tabs(
      surface,
      tabCol,
      0,
      [
        { key: '1', label: s.get('ui.embark.tab.dwarves') },
        { key: '2', label: s.get('ui.embark.tab.supplies') },
        { key: '3', label: s.get('ui.embark.tab.animals') },
      ],
      this.tab,
      (index) => this.setTab(index),
    );
    const presetsCol = tabCol + n + 4;
    button(surface, presetsCol, 0, 'p', s.get('ui.embark.presets'), () => this.togglePresets());
    separator(surface, 0, 1, cols);
    const bodyRows = surface.rows - 6;
    if (this.tab === 0) this.drawDwarves(surface, 2, bodyRows);
    else this.drawCatalog(surface, 2, bodyRows);
    this.drawFooter(surface, surface.rows - 4);
    if (this.presets.open) {
      dropdown(surface, Math.max(0, Math.min(presetsCol, cols - 32)), 1, 31, s.get('ui.embark.presets'), this.presetOptions(), this.presets, (id) => {
        this.presets.open = false;
        this.choosePreset(id);
      }, () => this.togglePresets());
    }
    if (this.pendingPreset !== null) {
      const preset = this.presetRows.find((p) => p.id === this.pendingPreset);
      const text = s.get('ui.embark.replace', { preset: preset?.name ?? '' });
      surface.fill({ col: 0, row: surface.rows - 5, cols, rows: 1 }, t.panelBg);
      label(surface, 1, surface.rows - 5, text, { bg: t.panelBg, width: cols - 2 });
    }
  }

  private drawDwarves(surface: Surface, top: number, height: number): void {
    const s = this.strings;
    const t = surface.theme;
    const party = this.session.party;
    const listCols = 30;
    clampList(this.party, party.length, height);
    party.forEach((d, i) => {
      const row = top + i;
      if (i >= height) return;
      const mark = i === this.party.selected ? '▶ ' : '  ';
      const pts = `${skillPoints(d)}/${EMBARK_SKILL_POINTS_PER_DWARF}`;
      const text = `${mark}${d.name}`.slice(0, listCols - pts.length - 2).padEnd(listCols - pts.length - 1) + pts;
      label(surface, 0, row, text, { width: listCols });
      if (i === this.party.selected && this.focus === 'party') surface.invert({ col: 0, row, cols: listCols, rows: 1 });
      surface.hit({ col: 0, row, cols: listCols, rows: 1 }, () => {
        this.party.selected = i;
        this.setFocus('party');
      });
    });
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
    button(surface, c + 32, row, 'r', s.get('ui.embark.reroll', { cost: EMBARK_REROLL_COST }), () => this.reroll());
    row += 1;
    ATTRIBUTES.forEach((attr, k) => {
      const col = c + (k % 4) * 13;
      if (k === 4) row += 1;
      label(surface, col, row, s.get(`ui.embark.attr.${attr}`));
      bar(surface, col + 4, row, d.attributes[attr], ATTRIBUTE_MAX, 5);
      label(surface, col + 10, row, String(d.attributes[attr]), { fg: t.value });
    });
    row += 1;
    label(surface, c, row, d.personality.map((p) => this.traitNames.get(p) ?? p).join(' · '), { width: surface.cols - c - 1 });
    row += 1;
    const left = EMBARK_SKILL_POINTS_PER_DWARF - skillPoints(d);
    separator(surface, c, row, surface.cols - c - 1, s.get('ui.embark.skills', { n: left }));
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
        max: Math.min(EMBARK_SKILL_MAX_PER_SKILL, level + left),
      });
      if (level > 0) bar(surface, c + 19 + w + 2, y, level, EMBARK_SKILL_MAX_PER_SKILL, level);
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
      const ok = this.available(entry);
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
        max: ok ? entry.max : count,
        width: 2,
      });
      if (count > 0) label(surface, 36 + w + 2, y, `= ${String(entry.price * count).padStart(4)}`, { fg: t.value });
    }
    const current = rows[this.items.selected];
    const noteRow = row + listHeight;
    if (current !== undefined && !this.available(current)) {
      label(surface, 1, noteRow, s.get('ui.embark.unavailable', { condition: current.condition ?? '' }), { fg: t.dim });
    } else if (current?.note !== undefined) {
      label(surface, 1, noteRow, current.note, { fg: t.dim });
    } else if (this.tab === 1) {
      label(surface, 1, noteRow, s.get('ui.embark.hint'), { fg: t.dim });
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
    const text = s.get('ui.embark.budget', { budget: marks(budget), spent: marks(spent), left: marks(budget - spent) });
    label(surface, 42, row + 1, text, { fg: spent > budget ? t.bad : t.text });
    const reason = this.reason();
    button(surface, 1, row + 2, 'Enter', s.get('ui.embark.embark'), () => this.confirm(), { enabled: reason === null });
    if (reason !== null) label(surface, 18, row + 2, reason, { fg: t.bad, width: surface.cols - 34 });
    button(surface, surface.cols - 12, row + 2, 'Esc', s.get('ui.embark.back'), () => this.host.back());
  }

  // ---------- input ----------

  setTab(index: number): void {
    this.tab = Math.max(0, Math.min(2, index));
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
    return this.tab === 0 ? ['party', 'skills', 'name'] : this.tab === 1 ? ['items', 'filter', 'name'] : ['items', 'name'];
  }

  key(press: KeyPress): boolean {
    if (this.pendingPreset !== null) {
      if (press.key === 'y') this.applyPreset(this.pendingPreset);
      else this.pendingPreset = null;
      return true;
    }
    if (this.presets.open) {
      const r = dropdownKey(this.presets, this.presetOptions(), press);
      if (r !== null && r !== 'handled') this.choosePreset(r);
      if (r !== null) return true;
      if (press.key === 'p') {
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
          this.setTab(Number(action.arg));
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
        case 'embark':
          this.confirm();
          return true;
        default:
          break;
      }
    }
    if (press.key === '=') {
      this.adjust(1);
      return true;
    }
    if (this.tab === 1 && (press.key === '←' || press.key === '→')) {
      const d = press.key === '←' ? -1 : 1;
      this.category = (this.category + d + SUPPLY_CATEGORIES.length) % SUPPLY_CATEGORIES.length;
      this.items.selected = 0;
      return true;
    }
    const panel = this.keymap.resolve('panel', press);
    if (panel === null) return false;
    switch (panel.id) {
      case 'select': {
        const d = panel.arg === '↑' ? -1 : 1;
        const list = this.focus === 'party' ? this.party : this.focus === 'skills' ? this.skills : this.items;
        list.selected = Math.max(0, list.selected + d);
        const size = this.focus === 'party' ? this.session.party.length : this.focus === 'skills' ? this.skillRows.length : this.rows().length;
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
        if (this.tab === 1) this.setFocus('filter');
        return true;
      default:
        return false;
    }
  }

  /** `+`/`-` on the selected skill (Dwarves) or quantity (Supplies, Animals). */
  adjust(delta: number): void {
    if (this.tab === 0) {
      const skill = this.skillRows[this.skills.selected];
      if (skill !== undefined) this.setSkill(this.party.selected, skill.id, delta);
      return;
    }
    const row = this.rows()[this.items.selected];
    if (row !== undefined) this.setSupply(row, delta);
  }

  pointerDown(p: CellPointer): void {
    clickHit(this.last, p);
  }
}
