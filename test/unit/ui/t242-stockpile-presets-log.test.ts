import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { AnnouncementLog } from '@ui/announcements';
import { StockpileEditor, PRESET_ORDER } from '@ui/panels/stockpile-editor';
import { Strings } from '@ui/strings';
import { TestWorld } from '../../scenarios/test-world';
import { registry, strings } from './ui-fixture';

describe('T-242 stockpile presets and announcement formatting', () => {
  it('preset list offers exactly thirteen presets in 13 order without hospital', () => {
    expect(PRESET_ORDER).toHaveLength(13);
    expect(PRESET_ORDER).not.toContain('hospital');
    expect(PRESET_ORDER).toEqual([
      'food',
      'drink',
      'seeds',
      'stone',
      'ore_and_bars',
      'wood',
      'furniture',
      'weapons_and_armor',
      'cloth_and_leather',
      'crafts_and_gems',
      'refuse',
      'corpses',
      'everything',
    ]);
  });

  it('every preset option has a non-raw string in the strings table', () => {
    const editor = new StockpileEditor();
    const ctx = {
      readers: {} as never,
      registry,
      strings,
      submit: () => {},
      panelLetters: new Set<string>(),
    };
    const options = editor.presetOptions(ctx as never);
    expect(options).toHaveLength(13);
    for (const opt of options) {
      expect(strings.has(`ui.stockpile.preset.${opt.id}`)).toBe(true);
      expect(opt.label).not.toMatch(/^ui\./);
      expect(opt.label.length).toBeGreaterThan(0);
    }
  });

  it('announcements for unnamed creatures start with capital letter and article', () => {
    const w = new TestWorld({ seed: 't242-announcements', world: 'flat-test', embark: 'none' });
    const log = new AnnouncementLog(new Strings(w.game.registry), w.game.registry);
    log.register(w.game.world.registrations.announcements);

    const dogId = w.spawnCreature('dog', w.index(10, 10, 32), 'wild');
    const dog = w.game.world.entities.get(dogId, C.Creature);
    expect(dog?.name).toBe('dog');

    // CreatureDied event
    const died = log.announce({
      type: 'CreatureDied',
      id: dogId,
      cause: 'old_age',
      tile: w.index(10, 10, 32),
      species: dog?.species ?? 0,
      faction: 'wild',
    }, w.readers, 1);

    expect(died).not.toBeNull();
    expect(died?.line.text).toBe('A dog has died.');

    // LimbLost event
    const catId = w.spawnCreature('cat', w.index(11, 11, 32), 'wild');
    const limb = log.announce({
      type: 'LimbLost',
      id: catId,
      part: 'left front paw',
    }, w.readers, 2);

    expect(limb).not.toBeNull();
    expect(limb?.line.text).toBe('A cat has lost a limb.');
  });
});
