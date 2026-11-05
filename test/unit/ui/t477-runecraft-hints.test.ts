/** T-477: the runecraft hints of `25-runecraft.md` § Player-facing behavior, each on stock or buildings. */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as z } from '@app/headless';
import { C } from '@core/components';
import { AnnouncementLog } from '@ui/announcements';
import { HintEngine } from '@ui/hints';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { strings } from './ui-fixture';

const RUNECRAFT_HINTS = ['hint_glowcap', 'hint_runeforge', 'hint_staff', 'hint_wand', 'hint_sanctum', 'hint_rune_metal', 'hint_draught'];

function world(): TestWorld {
  return new TestWorld({ seed: 't477-hints', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

/** The hints an hour's look shows in this world. */
function shown(w: TestWorld): string[] {
  const ui = defaultUiState(z);
  const hints = new HintEngine(w.game.registry, ui, new AnnouncementLog(strings, w.game.registry));
  hints.onEvents([{ type: 'HourPassed', hour: 0 }], w.readers);
  return ui.hintsShown.filter((id) => RUNECRAFT_HINTS.includes(id));
}

describe('T-477 runecraft hints', () => {
  it('a fortress with no runecraft sees none of them', () => {
    const w = world();
    w.spawnDwarf({ at: w.index(20, 20, z) });
    w.spawnItem('seed', 'dimcap', w.index(21, 20, z), 10);
    expect(shown(w)).toEqual([]);
  });

  it('each shows on its own stock or building, with its text', () => {
    const glowcap = world();
    glowcap.spawnItem('seed', 'glowcap', glowcap.index(21, 20, z), 10);
    expect(shown(glowcap)).toEqual(['hint_glowcap']);

    const placed = world();
    placed.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'runeforge', origin: placed.index(20, 20, z), orientation: 0, materialChoice: 0 });
    expect(shown(placed)).toEqual(['hint_runeforge']);
    const built = world();
    built.build('runeforge', built.index(20, 20, z), 'granite');
    expect(shown(built).sort()).toEqual(['hint_runeforge', 'hint_staff']);

    const wand = world();
    wand.spawnItem('wand', 'oak', wand.index(21, 20, z));
    expect(shown(wand)).toEqual(['hint_wand']);

    const sanctum = world();
    sanctum.zone('sanctum', [sanctum.index(20, 20, z), sanctum.index(21, 20, z)]);
    expect(shown(sanctum)).toEqual(['hint_sanctum']);

    const caster = world();
    const id = caster.spawnDwarf({ at: caster.index(20, 20, z) });
    caster.game.world.entities.add(id, C.Rune, { current: 0 });
    expect(shown(caster)).toEqual(['hint_rune_metal']);

    const draught = world();
    draught.spawnItem('stout_draught', 'rune', draught.index(21, 20, z));
    expect(shown(draught)).toEqual(['hint_draught']);

    const text = (id: string): string => glowcap.game.registry.table<{ id: string; text: string }>('hints').byId(id)?.text ?? '';
    expect(text('hint_glowcap')).toBe('Glowcap grows in the dark under a glowstone lamp.');
    expect(text('hint_staff')).toBe('A staff is a stone on a stick: the stone is the spell, the dwarf is the fuel.');
    expect(text('hint_wand')).toBe('A wand is quick and soft; a shod staff is slow and hard.');
    expect(text('hint_sanctum')).toBe('Build the sanctum in stone.');
    expect(text('hint_rune_metal')).toBe('Iron drinks the rune: a runecaster in mail recovers slowly.');
    expect(text('hint_runeforge')).toBe('The runeforge burns vials, not coal.');
    expect(text('hint_draught')).toBe("One draught, then three days' rest.");
  });
});
