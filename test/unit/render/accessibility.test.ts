import { describe, expect, it } from 'vitest';
import { loadContent } from '@content/loader';
import { Palette, STATE_COLORS, SIDE_BY_SIDE_STATE_PAIRS, ciede2000, toHex } from '@render/palette';
import { prefixOf, lineText, type LogLine } from '@ui/announcements';
import { Game } from '@app/game';
import { SettingsStore } from '@app/settings-store';
import { MemoryStorage } from '@platform/storage';
import { MockCanvas, mockCanvasFactory } from './canvas-mock';

describe('T-M8-07 colorblind palette and accessibility checks', () => {
  const registry = loadContent();

  it('every state color exists and resolves in standard and colorblind palettes', () => {
    const standard = new Palette(registry, { colorblind: false });
    const colorblind = new Palette(registry, { colorblind: true });

    for (const id of STATE_COLORS) {
      expect(standard.has(id), `standard has ${id}`).toBe(true);
      expect(colorblind.has(id), `colorblind has ${id}`).toBe(true);

      const stdVal = standard.color(id);
      const cbVal = colorblind.color(id);

      expect(typeof stdVal).toBe('number');
      expect(typeof cbVal).toBe('number');
      expect(toHex(stdVal)).toMatch(/^#[0-9a-f]{6}$/);
      expect(toHex(cbVal)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('U-08: every side-by-side state pair has minimum perceptual distance (CIEDE2000 ΔE >= 15) in both palettes (D-U10, M12)', () => {
    const standard = new Palette(registry, { colorblind: false });
    const colorblind = new Palette(registry, { colorblind: true });

    expect(SIDE_BY_SIDE_STATE_PAIRS).toEqual(expect.arrayContaining([
      ['hostile', 'dwarf_wounded'],
      ['text_key', 'alert'],
    ]));

    for (const [a, b] of SIDE_BY_SIDE_STATE_PAIRS) {
      const stdA = standard.color(a);
      const stdB = standard.color(b);
      expect(stdA, `standard ${a} (${toHex(stdA)}) vs ${b} (${toHex(stdB)})`).not.toBe(stdB);
      const stdDe = ciede2000(stdA, stdB);
      expect(stdDe, `standard ${a} (${toHex(stdA)}) vs ${b} (${toHex(stdB)}) CIEDE2000 ΔE=${stdDe.toFixed(2)} >= 15`).toBeGreaterThanOrEqual(15);

      const cbA = colorblind.color(a);
      const cbB = colorblind.color(b);
      expect(cbA, `colorblind ${a} (${toHex(cbA)}) vs ${b} (${toHex(cbB)})`).not.toBe(cbB);
      const cbDe = ciede2000(cbA, cbB);
      expect(cbDe, `colorblind ${a} (${toHex(cbA)}) vs ${b} (${toHex(cbB)}) CIEDE2000 ΔE=${cbDe.toFixed(2)} >= 15`).toBeGreaterThanOrEqual(15);
    }
  });

  it('toggling colorblind mode updates colors live on the palette instance', () => {
    const palette = new Palette(registry);
    expect(palette.colorblind).toBe(false);
    const normalTextGood = palette.color('text_good');
    const normalTextBad = palette.color('text_bad');
    const normalAlert = palette.color('alert');
    const normalDanger = palette.color('danger');

    palette.setColorblind(true);
    expect(palette.colorblind).toBe(true);
    expect(palette.color('text_good')).not.toBe(normalTextGood);
    expect(palette.color('text_bad')).not.toBe(normalTextBad);
    expect(palette.color('alert')).not.toBe(normalAlert);
    expect(palette.color('danger')).not.toBe(normalDanger);

    // Switches back live cleanly.
    palette.setColorblind(false);
    expect(palette.colorblind).toBe(false);
    expect(palette.color('text_good')).toBe(normalTextGood);
    expect(palette.color('text_bad')).toBe(normalTextBad);
  });

  it('game setting toggle switches palette live and persists across game instances', async () => {
    const storage = new MemoryStorage();
    const store = new SettingsStore(storage);

    const game1 = new Game({
      canvas: new MockCanvas(),
      seed: 'm8-a11y',
      registry,
      createCanvas: mockCanvasFactory(),
      devicePixelRatio: 1,
      width: 1280,
      height: 800,
      settingsStore: store,
    });

    expect(game1.palette.colorblind).toBe(false);
    expect(game1.userSettings.colorblind).toBe(false);

    // Toggle live.
    game1.changeSettings({ colorblind: true });
    expect(game1.palette.colorblind).toBe(true);
    expect(game1.userSettings.colorblind).toBe(true);
    await game1.settled();

    // Verify persisted setting loads in a second instance.
    const game2 = new Game({
      canvas: new MockCanvas(),
      seed: 'm8-a11y-2',
      registry,
      createCanvas: mockCanvasFactory(),
      devicePixelRatio: 1,
      width: 1280,
      height: 800,
      settingsStore: store,
    });
    await game2.loadSettings();

    expect(game2.palette.colorblind).toBe(true);
    expect(game2.userSettings.colorblind).toBe(true);
  });

  it('accessibility: no information is conveyed by color alone (24 § Accessibility)', () => {
    // 1. Announcements distinguish severity by prefix in text, not color alone:
    expect(prefixOf('danger')).toBe('!! ');
    expect(prefixOf('alert')).toBe('! ');
    expect(prefixOf('note')).toBe('');

    const dangerLine: LogLine = { tick: 1, severity: 'danger', text: 'Cave-in!', count: 1 };
    const alertLine: LogLine = { tick: 1, severity: 'alert', text: 'Merchant arrived', count: 1 };
    const noteLine: LogLine = { tick: 1, severity: 'note', text: 'Dig completed', count: 1 };

    expect(lineText(dangerLine)).toMatch(/^!! /);
    expect(lineText(alertLine)).toMatch(/^! /);
    expect(lineText(noteLine)).not.toMatch(/^!/);

    // 2. State glyphs and inspector representations:
    // Verify creatures / states have distinct textual labels or glyphs.
    const creatures = registry.table<{ id: string; name: string; glyph: string }>('creatures');
    expect(creatures.ids().length).toBeGreaterThan(0);
    for (const id of creatures.ids()) {
      const row = creatures.byId(id) as { id: string; name: string; glyph: string };
      expect(typeof row.name).toBe('string');
      expect(row.name.length).toBeGreaterThan(0);
      expect(typeof row.glyph).toBe('string');
      expect(row.glyph.length).toBeGreaterThan(0);
    }

    // 3. Materials and zones have readable textual names:
    const materials = registry.table<{ id: string; name: string }>('materials');
    expect(materials.ids().length).toBeGreaterThan(0);
    for (const id of materials.ids().slice(0, 10)) {
      const row = materials.byId(id) as { id: string; name: string };
      expect(typeof row.name).toBe('string');
      expect(row.name.length).toBeGreaterThan(0);
    }

    const zones = registry.table<{ id: string; name: string }>('zoneTypes');
    expect(zones.ids().length).toBeGreaterThan(0);
    for (const id of zones.ids()) {
      const row = zones.byId(id) as { id: string; name: string };
      expect(typeof row.name).toBe('string');
      expect(row.name.length).toBeGreaterThan(0);
    }
  });
});
