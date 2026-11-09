/**
 * The embark screen's Items tab, in testing mode only: `ui-screens/embark.md` § Testing mode,
 * `02-systems/02-embark-and-loadout.md` § Testing mode (T-532).
 *
 * A form makes one free item line (item, material, quality, a stone for a wand or a staff or an
 * enchantment for a weapon, armor piece or ammunition, and a count); `[a]` adds it to the lines
 * below, which keep their own `[-] n [+]` and `[x]`. The filter narrows the choices of the
 * selected field, so "steel" or "staff" is a few keys away among a hundred materials.
 */

import type { Registry } from '@core/registry';
import {
  EMBARK_TESTING_MAX_COUNT,
  channelStones,
  materialFits,
  slotEnchants,
  testingItemSlot,
  type EmbarkCommand,
  type EmbarkSession,
  type TestingItemLine,
  type TestingItemSlot,
} from '@systems/embark';
import type { Strings } from '../strings';
import type { Surface } from '../surface';
import { button, clampList, label, numberField, separator, textField, type ListState, type TextFieldState } from '../widgets';

/** The form's rows, before the lines: item, material, quality, stone or enchantment, count. */
export const DRAFT_ROWS = 5;
const ITEM = 0;
const MATERIAL = 1;
const QUALITY = 2;
const EXTRA = 3;
const COUNT = 4;

/** Quality 0 poor … 5 masterwork. */
const QUALITY_MAX = 5;

/**
 * A testing quantity's next value: steps of 1 to 10, of 10 to 100, of 100 beyond, so that a
 * hundred is a few presses away; clamped to `0..EMBARK_TESTING_MAX_COUNT`.
 */
export function testingStep(count: number, delta: number): number {
  const base = delta > 0 ? count : count - 1;
  const step = base < 10 ? 1 : base < 100 ? 10 : 100;
  return Math.max(0, Math.min(EMBARK_TESTING_MAX_COUNT, count + Math.sign(delta) * step));
}

interface Option {
  readonly id: string;
  readonly label: string;
  /** A material that suits the item by its `materials` column; the others are listed after, as unusual. */
  readonly fits?: boolean;
}

interface NamedRow {
  readonly id: string;
  readonly name: string;
}

/** What the Items tab draws with: the screen's session, strings, list state and filter. */
export interface ItemsTabContext {
  readonly session: EmbarkSession;
  readonly strings: Strings;
  readonly list: ListState;
  readonly focused: boolean;
  readonly filter: TextFieldState;
  apply(cmd: EmbarkCommand): boolean;
  add(): void;
  select(index: number): void;
  focusFilter(): void;
}

/** The item being made on the Items tab, and the drawing of the tab. */
export class TestingDraft {
  item: string;
  material: string;
  quality = 1;
  /** The stone (a channel) or the enchantment (a weapon, armor, ammunition); `''` is none. */
  extra = '';
  count = 1;
  private readonly itemOptions: Option[];
  private readonly lines: ListState = { selected: 0, scroll: 0 };

  constructor(private readonly registry: Registry) {
    const items = registry.table<NamedRow>('items');
    this.itemOptions = items
      .ids()
      .map((id) => ({ id, label: items.byId(id)?.name ?? id }))
      .sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
    this.item = items.has('staff') ? 'staff' : this.itemOptions[0]?.id ?? '';
    this.material = this.materialOptions()[0]?.id ?? '';
  }

  /** Every material: those that suit the item first, then the rest, each by name. */
  materialOptions(): Option[] {
    const materials = this.registry.table<NamedRow>('materials');
    const all = materials.ids().map((id) => ({ id, label: materials.byId(id)?.name ?? id, fits: materialFits(this.registry, this.item, id) }));
    const byName = (a: Option, b: Option): number => a.label.localeCompare(b.label) || a.id.localeCompare(b.id);
    return [...all.filter((o) => o.fits).sort(byName), ...all.filter((o) => !o.fits).sort(byName)];
  }

  slot(): TestingItemSlot {
    return testingItemSlot(this.registry, this.item);
  }

  /** None, then a channel's stones ("garnet · Emberbolt") or the slot's enchantments ("of blaze · ruby"). */
  extraOptions(): Option[] {
    const slot = this.slot();
    const materials = this.registry.table<NamedRow>('materials');
    const none = { id: '', label: '—' };
    if (slot === 'channel') {
      const spells = this.registry.table<{ id: string; name: string; stone: string }>('spells');
      return [
        none,
        ...channelStones(this.registry).map((stone) => ({
          id: stone,
          label: `${materials.byId(stone)?.name ?? stone} · ${spells.rows.find((sp) => sp?.stone === stone)?.name ?? ''}`,
        })),
      ];
    }
    const enchants = this.registry.hasTable('enchants') ? this.registry.table<{ id: string; suffix: string; stone: string }>('enchants') : null;
    return [
      none,
      ...slotEnchants(this.registry, slot).map((id) => {
        const row = enchants?.byId(id);
        return { id, label: `${row?.suffix ?? id} · ${materials.byId(row?.stone ?? '')?.name ?? row?.stone ?? ''}` };
      }),
    ];
  }

  /** The choices of a form row, or `null` for quality and count. */
  options(row: number): Option[] | null {
    if (row === ITEM) return this.itemOptions;
    if (row === MATERIAL) return this.materialOptions();
    if (row === EXTRA) return this.extraOptions();
    return null;
  }

  /** A row's choices that match the filter (all of them when none match). */
  visible(row: number, needle: string): Option[] {
    const all = this.options(row) ?? [];
    const n = needle.trim().toLowerCase();
    if (n.length === 0) return all;
    const matching = all.filter((o) => o.label.toLowerCase().includes(n) || o.id.includes(n));
    return matching.length > 0 ? matching : all;
  }

  private value(row: number): string {
    return row === ITEM ? this.item : row === MATERIAL ? this.material : this.extra;
  }

  private set(row: number, id: string): void {
    if (row === ITEM) this.setItem(id);
    else if (row === MATERIAL) this.material = id;
    else if (row === EXTRA) this.extra = id;
  }

  /** A new item keeps the material when it suits, else takes the first that does; the stone or enchantment resets. */
  setItem(id: string): void {
    this.item = id;
    if (!materialFits(this.registry, id, this.material)) this.material = this.materialOptions()[0]?.id ?? this.material;
    this.extra = '';
  }

  /** The line the form describes. */
  line(): TestingItemLine {
    const slot = this.slot();
    return {
      item: this.item,
      material: this.material,
      count: this.count,
      ...(this.quality === 1 ? {} : { quality: this.quality }),
      ...(this.extra === '' ? {} : slot === 'channel' ? { stone: this.extra } : { enchant: this.extra }),
    };
  }

  /** A typed filter moves the selected field to its first match. */
  refilter(row: number, needle: string): void {
    if (row !== ITEM && row !== MATERIAL && row !== EXTRA) return;
    const shown = this.visible(row, needle);
    if (needle.trim().length > 0 && !shown.some((o) => o.id === this.value(row)) && shown[0] !== undefined) this.set(row, shown[0].id);
  }

  /** `←` `→` `+` `-` on a row: the next choice, quality or count; on a line, its count. */
  adjust(selected: number, delta: number, needle: string, session: EmbarkSession, apply: (cmd: EmbarkCommand) => boolean): void {
    const d = Math.sign(delta);
    if (selected === QUALITY) this.quality = Math.max(0, Math.min(QUALITY_MAX, this.quality + d));
    else if (selected === COUNT) this.count = Math.max(1, testingStep(this.count, d));
    else if (selected < DRAFT_ROWS) {
      const shown = this.visible(selected, needle);
      if (shown.length === 0) return;
      const at = shown.findIndex((o) => o.id === this.value(selected));
      const next = shown[((at < 0 ? (d > 0 ? -1 : 0) : at) + d + shown.length) % shown.length] as Option;
      this.set(selected, next.id);
    } else {
      // A line in the session: its count by the testing steps; 0 removes it.
      this.adjustLine(session, selected - DRAFT_ROWS, d, apply);
    }
  }

  private adjustLine(session: EmbarkSession, index: number, d: number, apply: (cmd: EmbarkCommand) => boolean): void {
    const count = session.items[index]?.count;
    if (count === undefined) return;
    apply({ type: 'SetItemCount', index, count: testingStep(count, d) });
  }

  /** `x` on a line: it goes. */
  removeSelected(selected: number, apply: (cmd: EmbarkCommand) => boolean): void {
    if (selected >= DRAFT_ROWS) apply({ type: 'SetItemCount', index: selected - DRAFT_ROWS, count: 0 });
  }

  /** The tab's rows: the form's, then the session's lines. */
  rowCount(session: EmbarkSession): number {
    return DRAFT_ROWS + session.items.length;
  }

  /** "2 x superior steel staff · garnet (Emberbolt)". */
  lineText(line: TestingItemLine, strings: Strings): string {
    const items = this.registry.table<NamedRow>('items');
    const materials = this.registry.table<NamedRow>('materials');
    const quality = (line.quality ?? 1) === 1 ? '' : `${strings.get(`ui.embark.quality.${line.quality ?? 1}`)} `;
    // "60 x rune vial", not "rune rune vial": a material the item's name already says is not repeated.
    const itemName = items.byId(line.item)?.name ?? line.item;
    const materialName = materials.byId(line.material)?.name ?? line.material;
    const base = `${line.count} x ${quality}${itemName.includes(materialName) ? '' : `${materialName} `}${itemName}`;
    if (line.stone !== undefined) {
      const spell = this.registry.table<{ id: string; name: string; stone: string }>('spells').rows.find((sp) => sp?.stone === line.stone);
      return `${base} · ${materials.byId(line.stone)?.name ?? line.stone} (${spell?.name ?? ''})`;
    }
    if (line.enchant !== undefined && this.registry.hasTable('enchants')) {
      return `${base} ${this.registry.table<{ id: string; suffix: string }>('enchants').byId(line.enchant)?.suffix ?? line.enchant}`;
    }
    return base;
  }

  draw(surface: Surface, top: number, height: number, ctx: ItemsTabContext): void {
    const s = ctx.strings;
    const t = surface.theme;
    const cols = surface.cols;
    const rowCount = this.rowCount(ctx.session);
    clampList(ctx.list, rowCount, rowCount);
    const selected = ctx.list.selected;
    const needle = ctx.filter.value;
    let row = top;
    label(surface, 1, row, s.get('ui.embark.filter'));
    textField(surface, 10, row, 10, ctx.filter, () => ctx.focusFilter());
    label(surface, 22, row, s.get('ui.embark.items_note'), { fg: t.dim, width: Math.max(0, cols - 23) });
    row += 1;
    separator(surface, 0, row, cols, s.get('ui.embark.new_item'));
    row += 1;

    const slot = this.slot();
    const extraName = slot === 'channel' || slot === null ? 'ui.embark.field.stone' : 'ui.embark.field.enchant';
    const names = ['ui.embark.field.item', 'ui.embark.field.material', 'ui.embark.field.quality', extraName, 'ui.embark.field.count'];
    const materialFitsNow = materialFits(this.registry, this.item, this.material);
    for (let r = 0; r < DRAFT_ROWS; r += 1) {
      const y = row + r;
      const on = r === selected;
      label(surface, 1, y, `${on ? '▶ ' : '  '}${s.get(names[r] as string)}`, { width: 12 });
      if (on && ctx.focused) surface.invert({ col: 1, row: y, cols: 12, rows: 1 });
      surface.hit({ col: 1, row: y, cols: 12, rows: 1 }, () => ctx.select(r));
      const c = 14;
      if (r === COUNT) {
        const w = numberField(surface, c, y, this.count, (delta) => this.adjust(COUNT, delta, needle, ctx.session, ctx.apply), { min: 1, max: EMBARK_TESTING_MAX_COUNT, width: 3 });
        button(surface, c + w + 3, y, 'a', s.get('ui.embark.add'), () => ctx.add());
        continue;
      }
      const text = r === QUALITY
        ? s.get(`ui.embark.quality.${this.quality}`)
        : (this.options(r) ?? []).find((o) => o.id === this.value(r))?.label ?? '—';
      const choices = r === QUALITY ? QUALITY_MAX + 1 : (this.options(r) ?? []).length;
      if (choices <= 1) {
        label(surface, c, y, `  ${text}`, { fg: t.dim, width: 40 });
        continue;
      }
      label(surface, c, y, '◄');
      surface.hit({ col: c, row: y, cols: 1, rows: 1 }, () => this.adjust(r, -1, needle, ctx.session, ctx.apply));
      const n = label(surface, c + 2, y, text, { fg: t.value, width: 36 });
      label(surface, c + 3 + n, y, '►');
      surface.hit({ col: c + 3 + n, row: y, cols: 1, rows: 1 }, () => this.adjust(r, 1, needle, ctx.session, ctx.apply));
      if (r === MATERIAL && !materialFitsNow) label(surface, c + 5 + n, y, s.get('ui.embark.unusual'), { fg: t.dim });
    }
    row += DRAFT_ROWS;
    const lines = ctx.session.items;
    separator(surface, 0, row, cols, s.get('ui.embark.bring', { n: lines.length }));
    row += 1;
    const listHeight = Math.max(1, top + height - row);
    if (lines.length === 0) {
      label(surface, 1, row, s.get('ui.embark.no_lines'), { fg: t.dim, width: cols - 2 });
      return;
    }
    this.lines.selected = Math.max(0, selected - DRAFT_ROWS);
    clampList(this.lines, lines.length, listHeight);
    const textCols = Math.max(10, cols - 22);
    for (let r = 0; r < listHeight; r += 1) {
      const index = this.lines.scroll + r;
      const line = lines[index];
      if (line === undefined) break;
      const y = row + r;
      const on = index + DRAFT_ROWS === selected;
      label(surface, 1, y, `${on ? '▶ ' : '  '}${this.lineText(line, s)}`, { width: textCols });
      if (on && ctx.focused) surface.invert({ col: 1, row: y, cols: textCols, rows: 1 });
      surface.hit({ col: 1, row: y, cols: textCols, rows: 1 }, () => ctx.select(index + DRAFT_ROWS));
      const w = numberField(surface, textCols + 2, y, line.count, (delta) => this.adjustLine(ctx.session, index, delta, ctx.apply), { min: 0, max: EMBARK_TESTING_MAX_COUNT, width: 3 });
      button(surface, textCols + 3 + w, y, '', '[x]', () => ctx.apply({ type: 'SetItemCount', index, count: 0 }));
    }
  }
}
