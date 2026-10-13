/** U-07 M7: keyboard and mouse configure the same stockpile through existing commands. */
import { PRIORITY_MIN, PRIORITY_MAX } from '@core/constants';
import type { EntityId, Quality } from '@core/types';
import type { KeyPress } from '@platform/input';
import type { Rect } from '@render/cellbuffer';
import { CATEGORY_TREE, STOCKPILE_PRESETS, defaultStockpile } from '@systems/items';
import { STOCKPILE_QUALITY_MIN, STOCKPILE_QUALITY_MAX } from '../constants';
import { acceleratorLabel } from '../keymap';
import { capitalize, stockpilePreset, zoneEditorMessage, zoneName } from '../messages';
import type { Surface } from '../surface';
import { buildTree, button, dropdown, dropdownKey, label, list, nodeState, numberField, tree, toggleNode, visibleRows, type DropdownState, type ListState, type TreeNode, type TreeState } from '../widgets';
import { accel, buildings, items, type PanelContext } from './context';

export const PRESET_ORDER: readonly string[] = Object.keys(STOCKPILE_PRESETS).filter((id) => id !== 'hospital');
export const STOCKPILE_FIELDS = ['barrel', 'bag', 'bin', 'priority', 'minQuality', 'maxQuality'] as const;
export type StockpileField = typeof STOCKPILE_FIELDS[number];
type Focus = 'tree' | StockpileField;

/** Reading an undelivered zone must neither mutate the world nor pretend it was deleted. */
function stockpileForEditor(ctx: PanelContext, zoneId: EntityId) {
  const r = items(ctx);
  const zone = buildings(ctx)?.zone(zoneId);
  if (r === null || zone === undefined || (zone.type !== 'stockpile' && zone.type !== 'hospital')) return undefined;
  return r.stockpile(zoneId) ?? defaultStockpile(zone.type);
}

export class StockpileEditor {
  readonly tree: TreeState = { selected: 0, scroll: 0, expanded: new Set() };
  readonly preset: DropdownState = { open: false, highlighted: 0 };
  readonly materials: ListState = { selected: 0, scroll: 0 };
  materialsOpen = false;
  linkingFor: EntityId = 0;
  unlinkingFor: EntityId = 0;
  readonly sources: ListState = { selected: 0, scroll: 0 };
  focus: Focus = 'tree';
  private forest: TreeNode[] | null = null;

  categories(): TreeNode[] {
    return this.forest ??= buildTree(CATEGORY_TREE);
  }

  cancel(): boolean {
    if (!this.preset.open && !this.materialsOpen && this.linkingFor === 0 && this.unlinkingFor === 0) return false;
    this.linkingFor = 0; this.unlinkingFor = 0;
    this.preset.open = false;
    this.materialsOpen = false;
    return true;
  }

  reset(): void { this.cancel(); this.focus = 'tree'; }

  private fail(ctx: PanelContext, reason: Parameters<typeof zoneEditorMessage>[1]): void {
    ctx.notice?.(zoneEditorMessage(ctx, reason));
  }

  presetOptions(ctx: PanelContext): { id: string; label: string }[] {
    return PRESET_ORDER.map((id) => ({ id, label: ctx.strings.get(`ui.stockpile.preset.${id}`) }));
  }

  openPreset(ctx: PanelContext, zoneId: EntityId): void {
    const f = stockpileForEditor(ctx, zoneId)?.filter;
    if (f === undefined) { this.fail(ctx, 'unavailable'); return; }
    this.materialsOpen = false;
    this.preset.open = true;
    this.preset.highlighted = Math.max(0, PRESET_ORDER.indexOf(stockpilePreset(f) ?? ''));
  }

  choosePreset(ctx: PanelContext, zoneId: EntityId, id: string): void {
    this.preset.open = false;
    ctx.submit({ type: 'SetStockpileFilter', zoneId, filter: id });
  }

  classes(ctx: PanelContext): string[] {
    return [...new Set(ctx.registry.table<{ id: string; class: string }>('materials').rows.slice(1).map((r) => r.class))].sort();
  }

  toggleMaterial(ctx: PanelContext, zoneId: EntityId, index: number): void {
    const f = stockpileForEditor(ctx, zoneId)?.filter;
    if (f === undefined) { this.fail(ctx, 'unavailable'); return; }
    const classes = this.classes(ctx);
    let materialClasses: string[] | 'any';
    if (index === 0) materialClasses = f.materialClasses === 'any' ? [] : 'any';
    else {
      const id = classes[index - 1];
      if (id === undefined) { this.fail(ctx, 'unavailable'); return; }
      const set = new Set(f.materialClasses === 'any' ? classes : f.materialClasses);
      if (set.has(id)) set.delete(id); else set.add(id);
      materialClasses = [...set].sort();
    }
    ctx.submit({ type: 'SetStockpileFilter', zoneId, filter: { ...f, materialClasses } });
  }

  adjust(ctx: PanelContext, zoneId: EntityId, field: StockpileField, delta: number): void {
    const sp = stockpileForEditor(ctx, zoneId);
    if (sp === undefined) { this.fail(ctx, 'unavailable'); return; }
    this.focus = field;
    if (field === 'barrel' || field === 'bag' || field === 'bin') {
      const value = sp.containersWanted[field] + delta;
      if (!Number.isSafeInteger(value) || value < 0) { this.fail(ctx, 'bounds'); return; }
      ctx.submit({ type: 'SetStockpileContainers', zoneId, wants: { ...sp.containersWanted, [field]: value } });
    } else if (field === 'priority') {
      const value = sp.priority + delta;
      if (value < PRIORITY_MIN || value > PRIORITY_MAX) { this.fail(ctx, 'bounds'); return; }
      ctx.submit({ type: 'SetStockpilePriority', zoneId, priority: value });
    } else {
      const f = sp.filter;
      const value = f[field] + delta;
      const min = field === 'minQuality' ? value : f.minQuality;
      const max = field === 'maxQuality' ? value : f.maxQuality;
      if (min < STOCKPILE_QUALITY_MIN || max > STOCKPILE_QUALITY_MAX || min > max) { this.fail(ctx, 'quality'); return; }
      ctx.submit({ type: 'SetStockpileFilter', zoneId, filter: { ...f, [field]: value as Quality } });
    }
  }

  toggleCategory(ctx: PanelContext, zoneId: EntityId, id: string): void {
    const f = stockpileForEditor(ctx, zoneId)?.filter;
    if (f === undefined) { this.fail(ctx, 'unavailable'); return; }
    ctx.submit({ type: 'SetStockpileFilter', zoneId, filter: { ...f, categories: toggleNode(this.categories(), f.categories, id) } });
  }

  startLink(ctx: PanelContext, zoneId: EntityId): void {
    if (buildings(ctx)?.zone(zoneId)?.type !== 'stockpile') { this.fail(ctx, 'unavailable'); return; }
    this.cancel(); this.linkingFor = zoneId; ctx.clearNotice?.();
  }
  pickSource(ctx: PanelContext, tile: number): void {
    const destination = this.linkingFor;
    if (destination === 0) return;
    if (buildings(ctx)?.zone(destination)?.type !== 'stockpile') { this.fail(ctx, 'unavailable'); return; }
    const source = buildings(ctx)?.zoneAt(tile) ?? 0;
    if (source === destination || buildings(ctx)?.zone(source)?.type !== 'stockpile') { this.fail(ctx, 'link_source'); return; }
    ctx.submit({ type: 'LinkStockpile', zoneId: destination, sourceZoneId: source, on: true });
    this.linkingFor = 0; ctx.clearNotice?.();
  }
  sourceIds(ctx: PanelContext, zoneId: EntityId): EntityId[] {
    return (stockpileForEditor(ctx, zoneId)?.linkedSources ?? []).filter(id => buildings(ctx)?.zone(id)?.type === 'stockpile');
  }
  startUnlink(ctx: PanelContext, zoneId: EntityId): void {
    if (stockpileForEditor(ctx, zoneId) === undefined) { this.fail(ctx, 'unavailable'); return; }
    if (this.sourceIds(ctx, zoneId).length === 0) { this.fail(ctx, 'no_links'); return; }
    this.cancel(); this.unlinkingFor = zoneId; this.sources.selected = 0; this.sources.scroll = 0; ctx.clearNotice?.();
  }
  selectSource(ctx: PanelContext, index: number): void {
    const ids = this.sourceIds(ctx, this.unlinkingFor);
    this.sources.selected = Math.max(0, Math.min(ids.length - 1, index));
    const id = ids[this.sources.selected];
    const tile = id === undefined ? undefined : buildings(ctx)?.zone(id)?.tiles[0];
    if (tile !== undefined) ctx.focusOn(tile);
  }
  unlinkSelected(ctx: PanelContext): void {
    const zoneId = this.unlinkingFor;
    if (zoneId === 0) return;
    if (stockpileForEditor(ctx, zoneId) === undefined) { this.fail(ctx, 'unavailable'); return; }
    const sourceZoneId = this.sourceIds(ctx, zoneId)[this.sources.selected];
    if (sourceZoneId === undefined) { this.fail(ctx, 'no_links'); return; }
    ctx.submit({ type: 'LinkStockpile', zoneId, sourceZoneId, on: false }); this.unlinkingFor = 0;
  }

  key(ctx: PanelContext, zoneId: EntityId, press: KeyPress): boolean {
    if (press.ctrl || press.alt || press.meta) return false;
    const k = press.key;
    const letter = accel(ctx, press);
    const up = k === '↑' || k === 'ArrowUp';
    const down = k === '↓' || k === 'ArrowDown';
    const left = k === '←' || k === 'ArrowLeft';
    const right = k === '→' || k === 'ArrowRight';
    const space = k === 'Space' || k === ' ';
    if (this.linkingFor !== 0) {
      if (letter === 'x') { this.startUnlink(ctx, zoneId); return true; }
      return false;
    }
    if (this.unlinkingFor !== 0) {
      if (letter === 'i') { this.startLink(ctx, zoneId); return true; }
      if (letter === 'x') { this.startUnlink(ctx, zoneId); return true; }
      if (up || down) { this.selectSource(ctx, this.sources.selected + (up ? -1 : 1)); return true; }
      if (k === 'Enter') { this.unlinkSelected(ctx); return true; }
      return false;
    }
    if (this.preset.open) {
      const options = this.presetOptions(ctx);
      const result = dropdownKey(this.preset, options, { ...press, key: up ? '↑' : down ? '↓' : k });
      if (result !== null) {
        if (result !== 'handled') this.choosePreset(ctx, zoneId, result);
        return true;
      }
      if (letter !== '') {
        for (let d = 1; d <= options.length; d += 1) {
          const at = (this.preset.highlighted + d) % options.length;
          if (options[at]?.label.toLowerCase().startsWith(letter)) { this.preset.highlighted = at; break; }
        }
        return true;
      }
      return false;
    }
    if (this.materialsOpen) {
      if (up || down) {
        this.materials.selected = Math.max(0, Math.min(this.classes(ctx).length, this.materials.selected + (up ? -1 : 1)));
        return true;
      }
      if (space || k === 'Enter') { this.toggleMaterial(ctx, zoneId, this.materials.selected); return true; }
      return false;
    }
    if (letter === 'i') { this.startLink(ctx, zoneId); return true; }
    if (letter === 'x') { this.startUnlink(ctx, zoneId); return true; }
    if (letter === 'p') { this.openPreset(ctx, zoneId); return true; }
    if (letter === 'q') { this.focus = 'barrel'; return true; }
    if (letter === 'g') { this.focus = 'tree'; return true; }
    if (letter === 'v') { this.materialsOpen = true; return true; }
    if (k === 'Tab') {
      const fields: readonly Focus[] = ['tree', ...STOCKPILE_FIELDS];
      this.focus = fields[(fields.indexOf(this.focus) + (press.shift ? fields.length - 1 : 1)) % fields.length] as Focus;
      return true;
    }
    if (this.focus !== 'tree') {
      if (up || down) {
        const at = STOCKPILE_FIELDS.indexOf(this.focus);
        this.focus = STOCKPILE_FIELDS[Math.max(0, Math.min(STOCKPILE_FIELDS.length - 1, at + (up ? -1 : 1)))] as StockpileField;
        return true;
      }
      if (left || right || k === '+' || k === '=' || k === '-') {
        this.adjust(ctx, zoneId, this.focus, left || k === '-' ? -1 : 1);
        return true;
      }
      return false;
    }
    const rows = visibleRows(this.categories(), this.tree.expanded);
    if (up || down) {
      this.tree.selected = Math.max(0, Math.min(rows.length - 1, this.tree.selected + (up ? -1 : 1)));
      return true;
    }
    const node = rows[this.tree.selected]?.node;
    if (node === undefined) return false;
    if (left || right) {
      if (right) this.tree.expanded.add(node.id);
      else if (this.tree.expanded.has(node.id)) this.tree.expanded.delete(node.id);
      else {
        const parent = node.id.slice(0, node.id.lastIndexOf('/'));
        const at = rows.findIndex((r) => r.node.id === parent);
        if (at >= 0) this.tree.selected = at;
      }
      return true;
    }
    if (space) { this.toggleCategory(ctx, zoneId, node.id); return true; }
    return false;
  }
}

export function drawStockpileEditor(s: Surface, rect: Rect, editor: StockpileEditor, ctx: PanelContext, zoneId: EntityId, tiles: number): void {
  const sp = stockpileForEditor(ctx, zoneId);
  if (sp === undefined) {
    label(s, rect.col + 1, rect.row, zoneEditorMessage(ctx, 'unavailable'), { width: rect.cols - 2 });
    return;
  }
  const width = rect.cols - 2;
  const col = rect.col + 1;
  const strings = ctx.strings;
  let row = rect.row;
  if (editor.unlinkingFor !== 0) {
    label(s, col, row++, strings.get('ui.stockpile.unlink_title'), { width });
    const ids = editor.sourceIds(ctx, editor.unlinkingFor);
    list(s, { col, row, cols: width, rows: Math.max(1, rect.rows - 3) }, ids.map(id => zoneName(ctx, id)), editor.sources,
      index => editor.selectSource(ctx, index));
    const n = button(s, col, rect.row + rect.rows - 2, 'Enter', strings.get('ui.stockpile.unlink'), () => editor.unlinkSelected(ctx));
    button(s, col + n + 1, rect.row + rect.rows - 2, 'Esc', strings.get('ui.text_input.cancel'), () => { editor.cancel(); });
    return;
  }
  if (editor.materialsOpen) {
    label(s, col, row++, strings.get('ui.stockpile.material_title'), { width });
    const classes = editor.classes(ctx);
    const checked = (id: string): boolean => sp.filter.materialClasses === 'any' || sp.filter.materialClasses.includes(id);
    const rows = [`[${sp.filter.materialClasses === 'any' ? '■' : '□'}] ${strings.get('ui.build.any')}`,
      ...classes.map((id) => `[${checked(id) ? '■' : '□'}] ${strings.get(`ui.stockpile.class.${id}`)}`)];
    list(s, { col, row, cols: width, rows: Math.max(1, rect.rows - 3) }, rows, editor.materials,
      (index) => { editor.materials.selected = index; editor.toggleMaterial(ctx, zoneId, index); });
    label(s, col, rect.row + rect.rows - 1, strings.get('ui.stockpile.material_help'), { width, fg: s.theme.dim });
    return;
  }
  const preset = stockpilePreset(sp.filter);
  const value = strings.get(preset === null ? 'ui.stockpile.custom' : `ui.stockpile.preset.${preset}`);
  const options = editor.presetOptions(ctx);
  dropdown(s, col, row, width, value, options, editor.preset,
    (id) => editor.choosePreset(ctx, zoneId, id), () => editor.openPreset(ctx, zoneId));
  // Keep the existing compact header; label supplies its truncation tooltip.
  s.fill({ col, row, cols: width, rows: 1 }, s.theme.black);
  label(s, col, row++, `${acceleratorLabel('p', ctx.panelLetters)} ${strings.get('ui.stockpile.preset', { preset: value })}`, { width });
  if (editor.preset.open) {
    label(s, col, rect.row + rect.rows - 1, strings.get('ui.stockpile.preset_help'), { width, fg: s.theme.dim });
    return;
  }
  const controls: readonly [string, string, () => void][] = [
    ['g', 'ui.stockpile.tree_action', () => { editor.focus = 'tree'; }],
    ['q', 'ui.stockpile.settings_action', () => { editor.focus = 'barrel'; }],
    ['v', 'ui.stockpile.material_action', () => { editor.materialsOpen = true; }],
  ];
  let c = col;
  for (const [key, text, action] of controls) {
    const caption = `${acceleratorLabel(key, ctx.panelLetters)} ${strings.get(text)}`;
    if (c !== col && c + Array.from(caption).length > col + width) { c = col; row += 1; }
    const n = label(s, c, row, caption, { width: col + width - c });
    s.hit({ col: c, row, cols: n, rows: 1 }, action);
    c += n + 1;
  }
  row += 1;
  const treeRows = Math.max(1, rect.rows - (row - rect.row) - 12);
  const names = (nodes: readonly TreeNode[]): TreeNode[] => nodes.map((n) => ({ ...n, name: capitalize(n.name.replaceAll('_', ' ')), children: names(n.children) }));
  tree(s, { col, row, cols: width, rows: treeRows }, names(editor.categories()), editor.tree,
    (n) => nodeState(sp.filter.categories, n.id), {
      toggle: (n) => { editor.focus = 'tree'; editor.toggleCategory(ctx, zoneId, n.id); },
      select: () => { editor.focus = 'tree'; },
    });
  row += treeRows;
  for (const field of STOCKPILE_FIELDS) {
    const value = field === 'barrel' || field === 'bag' || field === 'bin' ? sp.containersWanted[field]
      : field === 'priority' ? sp.priority : sp.filter[field];
    const text = strings.get(`ui.stockpile.field.${field}`);
    label(s, col, row, text, { width: 15 });
    s.hit({ col, row, cols: 15, rows: 1 }, () => { editor.focus = field; });
    numberField(s, col + 15, row, value, (delta) => editor.adjust(ctx, zoneId, field, delta), { width: 3 });
    if (editor.focus === field) s.invert({ col, row, cols: Math.min(width, 15), rows: 1 });
    row += 1;
  }
  const classes = sp.filter.materialClasses === 'any' ? strings.get('ui.build.any') : sp.filter.materialClasses.map((id) => strings.get(`ui.stockpile.class.${id}`)).join(', ');
  label(s, col, row++, strings.get('ui.stockpile.materials', { classes, min: sp.filter.minQuality, max: sp.filter.maxQuality }), { width });
  label(s, col, row++, strings.get('ui.stockpile.priority', { n: sp.priority }), { width });
  label(s, col, row++, strings.get('ui.stockpile.links', { names: editor.sourceIds(ctx, zoneId).map(id => zoneName(ctx, id)).join(', ') || strings.get('ui.stockpile.no_links') }), { width });
  const linkWidth = button(s, col, row, acceleratorLabel('i', ctx.panelLetters).slice(1, -1), strings.get('ui.stockpile.link'), () => editor.startLink(ctx, zoneId));
  button(s, col + linkWidth + 1, row++, acceleratorLabel('x', ctx.panelLetters).slice(1, -1), strings.get('ui.stockpile.unlink'), () => editor.startUnlink(ctx, zoneId));
  label(s, col, row++, strings.get('ui.stockpile.usage', { used: tiles - (items(ctx)?.freeSlots(zoneId) ?? 0), n: tiles }), { width });
  label(s, col, row, strings.get(editor.focus === 'tree' ? 'ui.stockpile.tree_help' : 'ui.stockpile.number_help'), { width, fg: s.theme.dim });
}
