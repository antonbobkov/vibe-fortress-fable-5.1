import { describe, expect, it } from 'vitest';
import { loadContent } from '@content/loader';
import { Game } from '@app/game';
import { SettingsStore } from '@app/settings-store';
import { MemoryStorage } from '@platform/storage';
import { Keymap, type KeymapRow } from '@ui/keymap';
import { DEFAULT_USER_SETTINGS } from '@ui/settings';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { press } from './ui-fixture';
import type { GameEvent } from '@core/events';

function game(store: SettingsStore): Game {
  return new Game({ canvas: new MockCanvas(), seed: 'm7-settings', registry: loadContent(), createCanvas: mockCanvasFactory(),
    devicePixelRatio: 1, width: 1280, height: 800, settingsStore: store });
}

describe('T-M7-07 settings and keymap overrides', () => {
  it('rejects a binding conflict and preserves the prior action', () => {
    const registry = loadContent();
    const keymap = Keymap.fromRows(registry.derived<readonly KeymapRow[]>('keymap'));
    const pause = keymap.bindings.findIndex((row) => row.context === 'global' && row.id === 'pause');
    const cancel = keymap.bindings.find((row) => row.context === 'global' && row.id === 'cancel');
    expect(pause).toBeGreaterThanOrEqual(0);
    expect(keymap.rebind(pause, { key: cancel?.spec.key ?? 'Esc', ctrl: false, shift: false })?.id).toBe('cancel');
    expect(keymap.resolve('global', press('Space'))?.id).toBe('pause');
    // T-424: `v` is a zone inspector and military key, which the global keys act beside.
    expect(keymap.rebind(pause, { key: 'v', ctrl: false, shift: false })?.context).toBe('zone_inspector');
    expect(keymap.rebind(pause, { key: 'F8', ctrl: false, shift: false })).toBeNull();
    expect(keymap.resolve('global', press('F8'))?.id).toBe('pause');
    const saved = keymap.overrides();
    keymap.reset();
    expect(keymap.resolve('global', press('F8'))).toBeNull();
    keymap.loadOverrides(saved);
    expect(keymap.resolve('global', press('F8'))?.id).toBe('pause');
  });

  it('persists preferences and keybindings outside the save', async () => {
    const storage = new MemoryStorage();
    const store = new SettingsStore(storage);
    const first = game(store);
    const pause = first.keymap.bindings.findIndex((row) => row.context === 'global' && row.id === 'pause');
    expect(first.keymap.rebind(pause, { key: 'F8', ctrl: false, shift: false })).toBeNull();
    first.changeSettings({ zoom: 0.75, colorblind: true, autoPauseAlert: true, autosave: false });
    await first.settled();
    expect((await store.load())?.preferences.zoom).toBe(0.75);
    const second = game(store);
    await second.loadSettings();
    expect(second.ui.zoom).toBe(0.75);
    expect(second.palette.colorblind).toBe(true);
    expect(second.fortress.settings.autoPauseAlert).toBe(true);
    expect(second.userSettings.autosave).toBe(false);
    expect(second.keymap.resolve('global', press('F8'))?.id).toBe('pause');
    second.resetSettings();
    await second.settled();
    expect((await store.load())?.preferences).toEqual(DEFAULT_USER_SETTINGS);
    expect((await store.load())?.keymapOverrides).toEqual([]);
  });

  it('rebinds a fortress panel hotkey through the live keymap', async () => {
    const instance = game(new SettingsStore(new MemoryStorage()));
    await instance.start({ embark: 'default' });
    const panel = instance.keymap.bindings.findIndex((row) => row.context === 'fortress_panel' && row.id === 'population');
    expect(panel).toBeGreaterThanOrEqual(0);
    expect(instance.keymap.rebind(panel, { key: 'h', ctrl: false, shift: false })).toBeNull();
    expect(instance.fortress.key(press('h'))).toBe(true);
    expect(instance.ui.panel).toBe('population');
    expect(instance.fortress.panels().find((row) => row.id === 'population')?.hotkey).toBe('h');
  });

  it('applies the alternate palette and auto-pause on alerts', async () => {
    const instance = game(new SettingsStore(new MemoryStorage()));
    await instance.start({ embark: 'default' });
    const normal = instance.palette.color('dwarf_need');
    instance.changeSettings({ colorblind: true, autoPauseAlert: true });
    expect(instance.palette.color('dwarf_need')).not.toBe(normal);
    instance.host.setSpeed(1);
    instance.fortress.onEvents([{ type: 'CaravanWaiting', civ: 'hillfolk', partyId: 1 } as GameEvent]);
    expect(instance.host.speed()).toBe(0);
  });
});
