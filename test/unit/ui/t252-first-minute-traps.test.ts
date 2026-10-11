import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { computeLayout } from '@render/cellbuffer';
import type { EmbarkSession } from '@systems/embark';
import type { ConfirmRow } from '@ui/screens/confirm';
import { EmbarkScreen } from '@ui/screens/embark';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import type { Speed } from '@ui/status';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, press, registry, strings } from './ui-fixture';

function embark(answers: boolean[] = []): { s: EmbarkScreen; asked: string[]; embarked: EmbarkSession[] } {
  const asked: string[] = [];
  const embarked: EmbarkSession[] = [];
  const s = new EmbarkScreen(registry, 't252-embark', { name: 'Greenhollow', peril: 0, tempC: 12 }, {
    embark: (session) => embarked.push(session),
    back: () => {},
    confirm: (id, _params, answer) => { asked.push(id); answer(answers.shift() ?? false); },
  }, keymap, strings);
  return { s, asked, embarked };
}

function drop(s: EmbarkScreen, prefix: string): void {
  const catalog = registry.table<{ id: string; item?: string }>('embarkCatalog');
  const items = registry.table<{ id: string; category?: string }>('items');
  for (const line of s.session.supplies.slice()) {
    const category = items.byId(catalog.byId(line.entry)?.item ?? '')?.category ?? '';
    if (category === prefix || category.startsWith(`${prefix}/`)) s.session.apply({ type: 'SetSupply', entry: line.entry, count: 0 });
  }
}

function fortress(): FortressScreen {
  const w = new TestWorld({ seed: 't252-traps', world: 'flat-test', embark: 'none' });
  let speed: Speed = 0;
  const host: FortressHost = {
    readers: w.readers,
    registry: w.game.registry,
    ui: defaultUiState(FLAT_TEST_SURFACE_Z),
    submit: () => {},
    speed: () => speed,
    setSpeed: (v) => { speed = v; },
    pan: () => {},
    changeZ: () => {},
    centerOn: () => {},
    home: () => {},
    zoom: () => {},
    layout: () => computeLayout(80, 42, true),
    precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements,
    now: () => 0,
  };
  return new FortressScreen(host, keymap, strings);
}

describe('T-252 first-minute traps: no axe warning, and the second d', () => {
  it('asks "Embark without an axe?" (c_embark_no_axe) when supplies lack an axe, and defaults to No', () => {
    const { s, asked, embarked } = embark([false]);
    drop(s, 'tool/axe');
    s.key(press('Enter'));
    expect(asked).toEqual(['c_embark_no_axe']);
    expect(embarked).toHaveLength(0);

    const table = registry.table<ConfirmRow>('confirmations');
    expect(table.byId('c_embark_no_axe')?.default).toBe('no');
  });

  it('asks axe question after pick question and before food/drink question', () => {
    const { s, asked, embarked } = embark([true, true, true]);
    drop(s, 'tool/pick');
    drop(s, 'tool/axe');
    drop(s, 'food');
    s.key(press('Enter'));
    expect(asked).toEqual(['c_embark_no_pick', 'c_embark_no_axe', 'c_embark_no_food_drink']);
    expect(embarked).toHaveLength(1);
  });

  it('closing designate with d while tool is armed shows notice on status row 2', () => {
    const f = fortress();
    f.key(press('d')); // opens designate with Dig armed
    expect(f.toolActive).toBe(true);
    f.key(press('d')); // closes designate
    expect(f.statusRow2()).toBe('Designate closed · [d] opens it again');
  });

  it('closing build with b while tool is armed shows notice on status row 2', () => {
    const f = fortress();
    f.key(press('b'));
    f.build.choose('c');
    expect(f.build.active).toBe(true);
    f.key(press('b'));
    expect(f.statusRow2()).toBe('Build closed · [b] opens it again');
  });

  it('closing zones with z while tool is armed shows notice on status row 2', () => {
    const f = fortress();
    f.key(press('z'));
    f.zones.choose('m');
    expect(f.zones.active).toBe(true);
    f.key(press('z'));
    expect(f.statusRow2()).toBe('Zones closed · [z] opens it again');
  });
});
