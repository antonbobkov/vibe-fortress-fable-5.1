/**
 * T-716: a Warband fortress had no cloth or bandage, and a soldier with a serious cut bled for fifteen
 * hours beside a Medicine 5 medic while the log said only that he had lost consciousness. There is
 * still no bandaging without a dressing (17 § Patients and hospitals, `stop_bleeding`), but the player
 * is told at the cut: the `NoDressing` alert, the patient's Care line and the hospital panel; and every
 * embark preset carries linen.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { roundTrip } from '@app/game-save';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { EntityId } from '@core/types';
import { RngStream } from '@core/rng';
import { applyPreset, generateParty, type EmbarkEntryRow } from '@systems/embark/party';
import { AnnouncementLog } from '@ui/announcements';
import { careLine } from '@ui/panels/look';
import type { PanelContext } from '@ui/panels/context';
import { drawZonesPanel, ZoneTool } from '@ui/panels/zones';
import { EmbarkScreen } from '@ui/screens/embark';
import { Strings } from '@ui/strings';
import { TestWorld } from '../../scenarios/test-world';
import { fgOfText, hexOf, keymap, registry, strings, surface, theme } from '../ui/ui-fixture';

const NEEDS = ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const;

/** A medic of skill 20 and a dwarf with no labor; `cloth` cloth on the floor. */
function ward(seed: string, cloth: number) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const world = w.game.world;
  const labors = w.game.registry.table<{ id: string }>('labors').ids();
  const medic = w.spawnDwarf({ at: w.index(12, 10, Z), skills: { medicine: 20 } });
  const hurt = w.spawnDwarf({ at: w.index(10, 10, Z) });
  for (const id of [medic, hurt]) {
    for (const l of labors) w.setLabor(id, l, id === medic && l === 'medicine');
    for (const need of NEEDS) w.setNeed(id, need, 0);
  }
  if (cloth > 0) w.spawnItem('cloth', 'flax_cloth', w.index(11, 12, Z), cloth);
  const wounds = (id: EntityId) => world.entities.get(id, C.Body)!.parts.flatMap((p) => p.wounds);
  /** A cut of `amount` edge to the torso: 12 is serious, 3 light. */
  const cut = (id: EntityId, amount = 12): void => {
    world.emit({ type: 'DamageDealt', defenderId: id, attackerId: 0, part: 'torso', damageType: 'edge', amount });
  };
  const alerts = (id: EntityId): number => w.events('NoDressing').filter((e) => e['id'] === id).length;
  return { w, world, medic, hurt, wounds, cut, alerts };
}

describe('T-716 every embark preset carries a dressing', () => {
  it('each preset brings cloth or bandages', () => {
    const w = new TestWorld({ seed: 't716-presets', world: 'flat-test', embark: 'none' });
    const registry = w.game.registry;
    const catalog = registry.table<EmbarkEntryRow>('embarkCatalog');
    const presets = registry.table<{ id: string }>('embarkPresets').ids();
    expect(presets.length).toBeGreaterThanOrEqual(4);
    for (const id of presets) {
      const supplies = applyPreset(registry, generateParty(new RngStream(3), registry), id);
      const dressings = supplies.filter((l) => ['cloth', 'bandage'].includes(catalog.byId(l.entry)?.item ?? ''));
      expect([id, dressings.length > 0]).toEqual([id, true]);
    }
  });
});

describe('T-716 the embark screen says to bring linen', () => {
  it('the supplies tab\'s hint turns over to the linen line third', () => {
    let now = 0;
    const screen = new EmbarkScreen(registry, 'embark-ui', { name: 'Greenhollow', peril: 0, tempC: 12 },
      { embark: () => {}, back: () => {}, now: () => now }, keymap, strings);
    screen.tab = 1;
    const shown = (): string => {
      const s = surface(100, 45);
      screen.draw(s);
      return s.lines().join(' ').replace(/ +/g, ' ');
    };
    expect(shown()).toContain('Hint: two picks and one axe');
    now = 5000;
    expect(shown()).toContain('Hint: boars, wolves and bears');
    now = 10_000;
    expect(shown()).toContain('Hint: bring linen. Without cloth or bandages no wound can be bandaged');
    now = 15_000;
    expect(shown()).toContain('Hint: two picks and one axe');
  });
});

describe('T-716 a bleeding dwarf with no bandage or cloth is an alert', () => {
  it('a serious cut with no dressing in the fortress raises the alert once, at the cut, naming the dwarf and the cloth', () => {
    const a = ward('t716-alert', 0);
    const log = new AnnouncementLog(new Strings(a.w.game.registry), a.w.game.registry);
    log.register(a.world.registrations.announcements);
    a.w.step(2);
    a.cut(a.hurt);
    const woundedAt = a.w.until(() => a.wounds(a.hurt).length > 0, 10);
    const alertedAt = a.w.until(() => a.alerts(a.hurt) > 0, 10);
    expect(a.wounds(a.hurt).some((x) => x.type === 'cut' && x.severity === 'serious' && x.bleed > 0)).toBe(true);
    // With the wound, not when he faints: no later than the next tick.
    expect(alertedAt).toBeLessThanOrEqual(1);
    expect(woundedAt).toBeLessThanOrEqual(2);
    expect(a.alerts(a.hurt)).toBe(1);
    a.w.step(TICKS_PER_DAY / 8);
    expect(a.alerts(a.hurt)).toBe(1);
    const event = a.w.events('NoDressing')[0]!;
    const shown = log.announce(event, a.w.readers, a.w.tick);
    const name = a.world.entities.get(a.hurt, C.Creature)!.name;
    expect(shown?.severity).toBe('alert');
    expect(shown?.line.text).toBe(`${name} is bleeding and there is no bandage or cloth: buy them from a caravan, or weave cloth at a loom.`);
    expect(shown?.line.subject).toBe(a.hurt);
  });

  it('a second serious cut later raises it again; a light cut, which clots, does not', () => {
    const a = ward('t716-again', 0);
    a.w.step(2);
    a.cut(a.hurt, 3);
    a.w.step(20);
    expect(a.wounds(a.hurt).some((x) => x.severity === 'light' && x.bleed > 0)).toBe(true);
    expect(a.alerts(a.hurt)).toBe(0);
    a.cut(a.hurt);
    a.w.step(20);
    expect(a.alerts(a.hurt)).toBe(1);
    a.world.emit({ type: 'DamageDealt', defenderId: a.hurt, attackerId: 0, part: 'left_arm', damageType: 'edge', amount: 8 });
    a.w.step(20);
    expect(a.wounds(a.hurt).filter((x) => x.severity !== 'light' && x.bleed > 0).length).toBe(2);
    expect(a.alerts(a.hurt)).toBe(2);
  });

  it('no alert while the fortress has cloth, and the medic bandages the cut', () => {
    const a = ward('t716-cloth', 2);
    a.w.step(2);
    a.cut(a.hurt);
    a.w.until(() => a.wounds(a.hurt).some((x) => x.bandaged), TICKS_PER_DAY / 2);
    expect(a.wounds(a.hurt).some((x) => x.bandaged)).toBe(true);
    expect(a.alerts(a.hurt)).toBe(0);
  });

  it('the patient\'s Care line says it bleeds with nothing to bandage it, and what would help', () => {
    const a = ward('t716-care', 0);
    a.w.step(2);
    a.cut(a.hurt);
    a.w.step(30);
    const care = careLine(a.w.readers, a.w.game.registry, strings, a.hurt);
    expect(care).toEqual({
      text: 'Care: bleeding, and no bandage or cloth to bandage it. Buy them from a caravan, or weave cloth at a loom.',
      urgent: true,
    });
  });

  it('a save keeps the alert\'s tick; a patient of an older save, without it, is warned at its next update', () => {
    const a = ward('t716-save', 0);
    a.w.step(2);
    a.cut(a.hurt);
    a.w.step(5);
    const at = a.world.entities.get(a.hurt, C.Patient)?.noDressingAlerted;
    expect(at).toBeDefined();
    const loaded = roundTrip(a.w.game).game;
    expect(loaded.world.entities.get(a.hurt, C.Patient)?.noDressingAlerted).toBe(at);
    a.w.replaceGame(loaded);
    a.w.step(5);
    expect(a.alerts(a.hurt)).toBe(1);
    const older = roundTrip(a.w.game).game;
    const { noDressingAlerted: _dropped, ...patient } = older.world.entities.get(a.hurt, C.Patient)!;
    older.world.entities.add(a.hurt, C.Patient, patient);
    a.w.replaceGame(older);
    a.w.step(5);
    expect(a.alerts(a.hurt)).toBe(2);
  });
});

describe('T-716 the hospital panel says when there is nothing to bandage with', () => {
  it('shows the line in the alert colour while no cloth or bandage is to be had, and not once one is', () => {
    const w = new TestWorld({ seed: 't716-hospital', world: 'flat-test', embark: 'none' });
    const zoneId = w.zone('hospital', [w.index(10, 10, Z), w.index(11, 10, Z), w.index(12, 10, Z)]);
    w.step(1);
    const tool = new ZoneTool();
    tool.selected = zoneId;
    const ctx: PanelContext = {
      readers: w.readers,
      registry: w.game.registry,
      strings,
      submit: (cmd) => w.submit(cmd),
      focusOn: () => {},
      look: () => {},
      openPanel: () => {},
      shiftClick: () => false,
    };
    const draw = () => {
      const s = surface(60, 32);
      drawZonesPanel(s, { col: 0, row: 0, cols: 60, rows: 32 }, tool, ctx);
      return s;
    };
    const line = 'No cloth or bandages: a bleeding dwarf cannot be bandaged.';
    const s = draw();
    const row = s.lines().findIndex((l) => l.includes(line));
    expect(row).toBeGreaterThan(0);
    expect(fgOfText(s, row, 'No cloth')).toBe(hexOf(theme.alert));
    expect(s.lines()[row + 1]).toContain('Supplies (current / wanted):');
    w.spawnItem('bandage', 'flax_cloth', w.index(20, 20, Z), 1);
    w.step(1);
    expect(draw().lines().some((l) => l.includes('No cloth or bandages'))).toBe(false);
  });
});
