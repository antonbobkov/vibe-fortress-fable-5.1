import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import type { Command } from '@core/commands';
import { AnnouncementLog } from '@ui/announcements';
import { Keymap } from '@ui/keymap';
import { professionOf } from '@ui/panels/units';
import { StocksPanel } from '@ui/panels/stocks';
import type { PanelContext } from '@ui/panels/context';
import { ConfirmScreen } from '@ui/screens/confirm';
import { SettingsScreen } from '@ui/screens/settings';
import { DEFAULT_USER_SETTINGS } from '@ui/settings';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, press, strings, surface } from './ui-fixture';

describe('T-121 retained UI decisions', () => {
  it('D-163/D-201: actual registrations resolve all three sulk notes and the furniture-break alert', () => {
    const w = new TestWorld({ seed: 't121-sulks', world: 'flat-test', embark: 'none' });
    const id = w.spawnDwarf({ at: w.index(30, 30, 32), name: 'Urist Stone' });
    const log = new AnnouncementLog(strings, w.game.registry);
    log.register(w.game.world.registrations.announcements);
    for (const [kind, severity, text] of [
      ['day_off', 'note', 'Urist Stone is taking the day off.'],
      ['argue', 'note', 'Urist Stone has picked a quarrel.'],
      ['weep', 'note', 'Urist Stone is weeping at the hearth.'],
      ['break', 'alert', 'Urist Stone has broken a piece of furniture in a temper.'],
    ]) {
      expect(log.announce({ type: 'SulkHappened', id, kind }, w.readers, 1)?.line).toMatchObject({ severity, text });
    }
    expect(log.announce({ type: 'SulkHappened', id, kind: 'other' }, w.readers, 1)).toBeNull();
    expect(log.lines).toHaveLength(4);
  });

  it('D-201: later filtered registrations retain earlier ones and filter before formatting', () => {
    const w = new TestWorld({ seed: 't121-filtered', world: 'flat-test', embark: 'none' });
    const log = new AnnouncementLog(strings, w.game.registry);
    const spec = { severity: 'note' as const, stringKey: 'announce.sulk', keyField: 'kind', oneOf: { field: 'kind', values: ['day_off'] } };
    log.register([{ type: 'SulkHappened', spec }]);
    log.register([{ type: 'SulkHappened', spec: { severity: 'alert', stringKey: 'announce.sulk_break', oneOf: { field: 'kind', values: ['break'] } } }]);
    expect(log.announce({ type: 'SulkHappened', kind: 'day_off' }, w.readers, 1)?.severity).toBe('note');
    expect(log.announce({ type: 'SulkHappened', kind: 'break' }, w.readers, 1)?.severity).toBe('alert');
    expect(log.announce({ type: 'SulkHappened', kind: 'weep' }, w.readers, 1)).toBeNull();
    log.register([{ type: 'RoomQualityChanged', spec: { severity: 'note', stringKey: 'announce.sulk_break', atLeast: { field: 'tier', value: 4 }, atMost: { field: 'tier', value: 5 } } },
      { type: 'RoomQualityChanged', spec: { severity: 'alert', stringKey: 'announce.sulk_break', atLeast: { field: 'tier', value: 5 } } }]);
    expect(log.announce({ type: 'RoomQualityChanged', tier: 3 }, w.readers, 2)).toBeNull();
    expect(log.announce({ type: 'RoomQualityChanged', tier: 5 }, w.readers, 2)?.severity).toBe('note');
    expect(log.announce({ type: 'RoomQualityChanged', tier: 6 }, w.readers, 2)?.severity).toBe('alert');
  });

  it('D-201: once remains saved and counted by event type after filtered matching', () => {
    const w = new TestWorld({ seed: 't121-once', world: 'flat-test', embark: 'none' });
    const log = new AnnouncementLog(strings, w.game.registry);
    log.register([{ type: 'SulkHappened', spec: { severity: 'alert', stringKey: 'announce.sulk_break', once: true, oneOf: { field: 'kind', values: ['break'] } } }]);
    expect(log.announce({ type: 'SulkHappened', kind: 'day_off' }, w.readers, 1)).toBeNull();
    expect(log.announce({ type: 'SulkHappened', kind: 'break' }, w.readers, 1)).not.toBeNull();
    expect(log.announce({ type: 'SulkHappened', kind: 'break' }, w.readers, 2)).toBeNull();
    const restored = new AnnouncementLog(strings, w.game.registry);
    restored.register(w.game.world.registrations.announcements);
    restored.register([{ type: 'DeepsilverMined', spec: { severity: 'danger', stringKey: 'announce.deepsilver_mined', once: true } }]);
    restored.markSeen('DeepsilverMined');
    expect(restored.announce({ type: 'DeepsilverMined' }, w.readers, 3)).toBeNull();
  });

  function stock(materials: string[]) {
    const w = new TestWorld({ seed: 't121-stocks', world: 'flat-test', embark: 'none' });
    const ids = materials.map((m) => w.spawnItem('bucket', m, w.index(30, 30, 32)));
    const sent: Command[] = []; const asked: string[] = []; let approve: (() => void) | undefined;
    const ctx: PanelContext = { readers: w.readers, registry: w.game.registry, strings,
      submit: (cmd) => { sent.push(cmd); expect(w.game.world.applyCommand(cmd)).toMatchObject({ ok: true }); },
      focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false,
      confirm: (id, _params, run) => { asked.push(id); approve = run; } };
    const panel = new StocksPanel();
    const rows: string[] = [];
    const walk = (nodes: Readonly<ReturnType<StocksPanel['visibleForest']>>) => { for (const n of nodes) { rows.push(n.id); panel.tree.expanded.add(n.id); walk(n.children); } };
    walk(panel.visibleForest(ctx));
    panel.tree.selected = rows.indexOf(`type:${w.game.world.entities.get(ids[0]!, C.Item)!.type}`);
    return { w, ids, ctx, panel, rows, sent, asked, approve: () => approve?.() };
  }

  it('D-077: mixed type melts only its metal items with one consistent toggle and default-No confirmation', () => {
    const f = stock(['iron', 'oak', 'copper']);
    expect(f.panel.flagCommands(f.ctx, 'MeltItem')).toEqual([
      { type: 'MeltItem', itemId: f.ids[0], on: true }, { type: 'MeltItem', itemId: f.ids[2], on: true }]);
    f.panel.flag(f.ctx, 'MeltItem');
    expect(f.asked).toEqual(['c_melt_items']); expect(f.sent).toEqual([]);
    const dialog = new ConfirmScreen(f.w.game.registry, strings, 'c_melt_items', { what: 'Buckets' }, () => {});
    expect(dialog.defaultYes).toBe(false);
    f.approve();
    expect(f.sent).toHaveLength(2);
    f.panel.flag(f.ctx, 'MeltItem');
    expect(f.asked).toHaveLength(1);
    expect(f.sent.slice(2)).toEqual([{ type: 'MeltItem', itemId: f.ids[0], on: false }, { type: 'MeltItem', itemId: f.ids[2], on: false }]);
    f.w.game.world.applyCommand({ type: 'MeltItem', itemId: f.ids[0], on: true });
    expect(f.panel.flagCommands(f.ctx, 'MeltItem').map((c) => c['on'])).toEqual([true, true]);
    f.panel.tree.selected = f.rows.indexOf(`item:${f.ids[1]}`);
    expect(f.panel.flagCommands(f.ctx, 'MeltItem')).toEqual([]);
  });

  it('D-077: current profession ties use ascending skill ids and no positive skill shows Peasant', () => {
    const f = stock(['iron']);
    const dwarf = f.w.spawnDwarf({ at: f.w.index(30, 30, 32), skills: { mining: 5, carpentry: 5 } });
    expect(professionOf(f.ctx, dwarf)).toBe('Carpenter');
    const peasant = f.w.spawnDwarf({ at: f.w.index(31, 30, 32) });
    expect(professionOf(f.ctx, peasant)).toBe('Peasant');
  });

  it('D-077: all-metal and single-item selections retain their command paths', () => {
    const f = stock(['iron', 'copper']);
    const typeId = f.w.game.world.entities.get(f.ids[0]!, C.Item)!.type;
    expect(f.panel.flagCommands(f.ctx, 'MeltItem')).toEqual([{ type: 'MeltItem', typeId, on: true }]);
    f.panel.tree.selected = f.rows.indexOf(`item:${f.ids[0]}`);
    expect(f.panel.flagCommands(f.ctx, 'MeltItem')).toEqual([{ type: 'MeltItem', itemId: f.ids[0], on: true }]);
  });

  for (const mouse of [false, true]) it(`Settings failure uses Help names and registry strings (${mouse ? 'mouse' : 'keyboard'})`, () => {
    const keys = new Keymap(keymap.bindings);
    const index = keys.bindings.findIndex((b) => b.context === 'fortress_panel' && b.id === 'zones');
    const before = keys.overrides(); let changed = 0;
    const screen = new SettingsScreen({ keymap: keys, strings, settings: () => DEFAULT_USER_SETTINGS,
      change: () => {}, bindingsChanged: () => { changed++; }, resetDefaults: () => {}, back: () => {} });
    screen.keybindings = true; screen.bindingList.selected = index;
    if (mouse) {
      const s = surface(90, 42); screen.draw(s);
      const row = s.lines().findIndex((r) => r.includes('Zones panel'));
      expect(row).toBeGreaterThanOrEqual(0);
      screen.pointerDown({ col: 3, row, button: 0, shift: false, ctrl: false, alt: false, meta: false });
    } else screen.key(press('Enter'));
    expect(screen.capturing).toBe(true);
    screen.key(press('u'));
    expect(screen.conflict).toBe('Conflicts with Fortress panels: Units panel');
    const s = surface(90, 42); screen.draw(s);
    expect(s.lines().join('\n')).toContain(screen.conflict);
    screen.key(press('v', { alt: true }));
    expect(screen.conflict).toBe(strings.get('ui.settings.binding_modifiers'));
    expect(keys.overrides()).toEqual(before); expect(changed).toBe(0);
  });
});
