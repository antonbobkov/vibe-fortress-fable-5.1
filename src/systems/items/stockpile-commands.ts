/**
 * 13's stockpile commands: `04-implementation/command-catalog.md` rows `SetStockpileFilter`
 * (`zoneId, filter`; "zone is a stockpile; category nodes exist") and `SetStockpileContainers` /
 * `SetStockpilePriority` / `LinkStockpile` (`zoneId, …`), and `13` § Stockpiles.
 *
 * `filter` is a preset name (`food`, `ore_and_bars`, … `everything`) or a filter object whose
 * missing fields take the empty filter's values (`preset` in the object starts from that preset).
 */

import { OK, reject, type Command, type CommandResult } from '@core/commands';
import { PRIORITY_MAX, PRIORITY_MIN } from '@core/constants';
import type { StockpileFilter } from '@core/components';
import type { EntityId, Priority } from '@core/types';
import { emptyFilter, presetFilter, WANTED_CLASSES, type StockpileStore } from './stockpiles';

export interface StockpileCommandHost {
  readonly store: StockpileStore;
  /** Every material class id (`materials.md` § Columns). */
  readonly materialClasses: ReadonlySet<string>;
  /** The stockpile's filter or settings changed: its items and the wants set are re-examined. */
  changed(spId: EntityId): void;
}

function stockpileOf(host: StockpileCommandHost, cmd: Command): EntityId | null {
  const id = cmd['zoneId'];
  if (typeof id !== 'number') return null;
  return host.store.ensure(id) ? id : null;
}

function parseFilter(host: StockpileCommandHost, raw: unknown): StockpileFilter | 'bad_category' | 'out_of_range' {
  if (typeof raw === 'string') return presetFilter(raw) ?? 'bad_category';
  if (typeof raw !== 'object' || raw === null) return 'bad_category';
  const f = raw as Record<string, unknown>;
  let base = emptyFilter();
  if (typeof f['preset'] === 'string') {
    const p = presetFilter(f['preset']);
    if (p === null) return 'bad_category';
    base = p;
  }
  const nodes = host.store.categoryNodes();
  let categories = base.categories;
  if (f['categories'] !== undefined) {
    if (!Array.isArray(f['categories'])) return 'bad_category';
    categories = [];
    for (const c of f['categories'] as unknown[]) {
      if (typeof c !== 'string' || !nodes.has(c)) return 'bad_category';
      if (!categories.includes(c)) categories.push(c);
    }
    categories.sort();
  }
  let materialClasses = base.materialClasses;
  if (f['materialClasses'] !== undefined) {
    if (f['materialClasses'] === 'any') materialClasses = 'any';
    else if (!Array.isArray(f['materialClasses'])) return 'bad_category';
    else {
      const list: string[] = [];
      for (const m of f['materialClasses'] as unknown[]) {
        if (typeof m !== 'string' || !host.materialClasses.has(m)) return 'bad_category';
        if (!list.includes(m)) list.push(m);
      }
      materialClasses = list.sort();
    }
  }
  const minQuality = host.store.qualityOf(f['minQuality'], base.minQuality);
  const maxQuality = host.store.qualityOf(f['maxQuality'], base.maxQuality);
  if (minQuality === null || maxQuality === null || minQuality > maxQuality) return 'out_of_range';
  const allowRot = typeof f['allowRot'] === 'boolean' ? f['allowRot'] : base.allowRot;
  return { categories, materialClasses, minQuality, maxQuality, allowRot };
}

export function applySetStockpileFilter(host: StockpileCommandHost, cmd: Command): CommandResult {
  const id = stockpileOf(host, cmd);
  if (id === null) return reject('not_found');
  const filter = parseFilter(host, cmd['filter']);
  if (typeof filter === 'string') return reject(filter);
  const store = host.store;
  const explicit = store.explicitPriority.includes(id);
  store.write(id, explicit ? { filter } : { filter, priority: store.defaultPriority(filter) });
  host.changed(id);
  return OK;
}

export function applySetStockpileContainers(host: StockpileCommandHost, cmd: Command): CommandResult {
  const id = stockpileOf(host, cmd);
  if (id === null) return reject('not_found');
  const raw = cmd['wants'];
  if (typeof raw !== 'object' || raw === null) return reject('bad_setting');
  const sp = host.store.stockpile(id);
  if (sp === undefined) return reject('not_found');
  const wants = { ...sp.containersWanted };
  for (const key of Object.keys(raw as Record<string, unknown>)) {
    const v = (raw as Record<string, unknown>)[key];
    if (!(WANTED_CLASSES as readonly string[]).includes(key)) return reject('bad_setting');
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > host.store.tilesOf(id).length) return reject('out_of_range');
    wants[key as 'barrel' | 'bag' | 'bin'] = v;
  }
  host.store.write(id, { containersWanted: wants });
  host.changed(id);
  return OK;
}

export function applySetStockpilePriority(host: StockpileCommandHost, cmd: Command): CommandResult {
  const id = stockpileOf(host, cmd);
  if (id === null) return reject('not_found');
  const p = cmd['priority'];
  if (typeof p !== 'number' || !Number.isInteger(p) || p < PRIORITY_MIN || p > PRIORITY_MAX) return reject('out_of_range');
  host.store.write(id, { priority: p as Priority });
  if (!host.store.explicitPriority.includes(id)) {
    host.store.explicitPriority.push(id);
    host.store.explicitPriority.sort((a, b) => a - b);
  }
  host.changed(id);
  return OK;
}

/** `LinkStockpile { zoneId, sourceZoneId, on }`: the source is another stockpile. */
export function applyLinkStockpile(host: StockpileCommandHost, cmd: Command): CommandResult {
  const id = stockpileOf(host, cmd);
  if (id === null) return reject('not_found');
  const source = cmd['sourceZoneId'];
  if (typeof source !== 'number' || source === id) return reject('not_found');
  if (host.store.host.zone(source)?.type !== 'stockpile' || !host.store.ensure(source)) return reject('not_found');
  const sp = host.store.stockpile(id);
  if (sp === undefined) return reject('not_found');
  const on = cmd['on'] !== false;
  const links = sp.linkedSources.filter((x) => x !== source);
  if (on) links.push(source);
  links.sort((a, b) => a - b);
  host.store.write(id, { linkedSources: links });
  host.changed(id);
  return OK;
}
