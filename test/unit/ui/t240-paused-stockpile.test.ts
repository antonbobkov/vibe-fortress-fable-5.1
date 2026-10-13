import { describe, expect, it } from 'vitest';
import { InProcessHost } from '@app/sim-host';
import { HeadlessGame, FLAT_TEST_SURFACE_Z as z } from '@app/headless';
import { replay } from '@app/replay';
import type { Command } from '@core/commands';
import type { BuildingsReader } from '@systems/buildings';
import { defaultStockpile, type ItemsReader } from '@systems/items';
import { ZoneTool, drawZonesPanel } from '@ui/panels/zones';
import type { PanelContext } from '@ui/panels/context';
import { press, strings, keymap, surface } from './ui-fixture';

async function fixture() {
  const h = new InProcessHost(() => 0); await h.newGame({ seed: 't240-paused-stockpile', embark: 'none' });
  const tile = h.world.map.index(30, 30, z);
  h.submit({ type: 'CreateZone', zoneType: 'stockpile', tiles: [tile, tile + 1] });
  const zoneId = h.readers.of<BuildingsReader>('14').zoneAt(tile);
  const tool = new ZoneTool(); tool.selected = zoneId;
  const notices: string[] = [];
  const ctx: PanelContext = { readers: h.readers, registry: h.headless.registry, strings, panelLetters: keymap.panelLetters(),
    submit: cmd => h.submit(cmd), focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false, notice: text => notices.push(text) };
  return { h, tool, ctx, zoneId, notices, items: h.readers.of<ItemsReader>('13') };
}
function draw(f: Awaited<ReturnType<typeof fixture>>) {
  const s = surface(36, 40); drawZonesPanel(s, { col: 0, row: 0, cols: 36, rows: 40 }, f.tool, f.ctx); return s;
}

describe('T-240 a stockpile made while paused can be configured at once', () => {
  it('draws the preset row without mutating a zone whose event is still queued', async () => {
    const f = await fixture(); expect(f.items.stockpile(f.zoneId)).toBeUndefined();
    const hash = f.h.headless.hash(); const text = draw(f).lines().join('\n');
    expect(text).toContain('[S-p]'); expect(text).not.toContain('That zone is no longer available');
    expect(f.h.headless.hash()).toBe(hash); expect(f.h.tick).toBe(0);
  });
  it('opens and applies Wood by keyboard before any simulation tick', async () => {
    const f = await fixture(); f.tool.editorKey(f.ctx, press('P', { shift: true }));
    expect(f.tool.stockpile.preset.open).toBe(true); expect(f.notices).toEqual([]);
    f.tool.editorKey(f.ctx, press('w')); f.tool.editorKey(f.ctx, press('Enter'));
    expect(f.items.stockpile(f.zoneId)?.filter.categories).toEqual(['wood']); expect(f.h.tick).toBe(0);
    const before = f.items.stockpile(f.zoneId); f.h.step(1); expect(f.items.stockpile(f.zoneId)).toEqual(before);
  });
  it('opens and applies Wood by mouse before any simulation tick', async () => {
    const f = await fixture(); const s = draw(f); const row = s.lines().findIndex(l => l.includes('[S-p]'));
    expect(row).toBeGreaterThanOrEqual(0); s.hitAt(2, row)?.action();
    expect(f.tool.stockpile.preset.open).toBe(true);
    const options = draw(f); const woodRow = options.lines().findIndex(l => l.includes('Wood'));
    expect(woodRow).toBeGreaterThanOrEqual(0); const hit = options.hitAt(2, woodRow); expect(hit).not.toBeNull(); hit?.action();
    expect(f.items.stockpile(f.zoneId)?.filter.categories).toEqual(['wood']); expect(f.h.tick).toBe(0);
  });
  it.each(['SetStockpileFilter', 'SetStockpileContainers', 'SetStockpilePriority', 'LinkStockpile'] as const)(
    '%s already ensures the missing record and later ZoneChanged preserves it', async type => {
      const f = await fixture(); let cmd: Command = type === 'SetStockpileFilter' ? { type, zoneId: f.zoneId, filter: 'wood' }
        : type === 'SetStockpileContainers' ? { type, zoneId: f.zoneId, wants: { barrel: 1 } }
        : type === 'SetStockpilePriority' ? { type, zoneId: f.zoneId, priority: 2 }
        : { type, zoneId: f.zoneId, sourceZoneId: 0, on: true };
      if (type === 'LinkStockpile') {
        const tile = f.h.world.map.index(35, 30, z); f.h.submit({ type: 'CreateZone', zoneType: 'stockpile', tiles: [tile] });
        cmd = { ...cmd, sourceZoneId: f.h.readers.of<BuildingsReader>('14').zoneAt(tile) };
      }
      expect(f.items.stockpile(f.zoneId)).toBeUndefined(); f.h.submit(cmd);
      expect(f.h.world.commandLog.all().at(-1)?.result.ok).toBe(true); expect(f.h.tick).toBe(0);
      const record = f.items.stockpile(f.zoneId); expect(record).toBeDefined(); f.h.step(1);
      expect(f.items.stockpile(f.zoneId)).toEqual(record);
    });
  it.each(['tree', 'material', 'containers'] as const)('uses shared defaults for %s editing before the event', async action => {
    const f = await fixture();
    if (action === 'tree') { f.tool.stockpile.toggleCategory(f.ctx, f.zoneId, 'wood'); expect(f.items.stockpile(f.zoneId)?.filter.categories).toEqual(['wood']); }
    if (action === 'material') { f.tool.stockpile.toggleMaterial(f.ctx, f.zoneId, 0); expect(f.items.stockpile(f.zoneId)?.filter.materialClasses).toEqual([]); }
    if (action === 'containers') { f.tool.stockpile.adjust(f.ctx, f.zoneId, 'barrel', 1); expect(f.items.stockpile(f.zoneId)?.containersWanted.barrel).toBe(1); }
    expect(f.notices).toEqual([]); expect(f.h.tick).toBe(0);
  });
  it('does not offer defaults for a removed zone', async () => {
    const f = await fixture(); f.h.submit({ type: 'RemoveZone', zoneId: f.zoneId });
    f.tool.stockpile.openPreset(f.ctx, f.zoneId); expect(f.tool.stockpile.preset.open).toBe(false);
    expect(f.notices).toEqual(['That zone is no longer available.']);
  });
  it('shared defaults are fresh records and preserve the hospital filter', () => {
    const a = defaultStockpile(), b = defaultStockpile();
    a.filter.categories.push('wood'); a.containersWanted.barrel = 1; a.linkedSources.push(1);
    expect(b.filter.categories).toEqual([]); expect(b.containersWanted.barrel).toBe(0); expect(b.linkedSources).toEqual([]);
    expect(defaultStockpile('hospital').filter.categories).toContain('medical/splint');
  });
  it('round-trips the paused editor command and preserves the next twenty hashes', async () => {
    const f = await fixture(); f.tool.stockpile.choosePreset(f.ctx, f.zoneId, 'wood');
    const loaded = new InProcessHost(() => 0); await loaded.load(await f.h.save({ kind: 'manual' }));
    expect(loaded.headless.hash()).toBe(f.h.headless.hash());
    for (let i = 0; i < 20; i++) { f.h.step(1); loaded.step(1); expect(loaded.headless.hash()).toBe(f.h.headless.hash()); }
  });
  it('replays the recorded paused command sequence without pauses to the same world hash', async () => {
    const f = await fixture(); f.h.submit({ type: 'SetStockpileFilter', zoneId: f.zoneId, filter: 'wood' }); f.h.step(20);
    const running = new HeadlessGame({ seed: 't240-paused-stockpile', embark: 'none' });
    replay(running, f.h.world.commandLog.serialize(), { until: f.h.tick });
    expect(running.hash()).toBe(f.h.headless.hash());
  });
});
