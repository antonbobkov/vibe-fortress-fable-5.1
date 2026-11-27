/**
 * T-804: nothing on screen said how quality is made. A dwarf's skill line says the best tier its
 * level makes and how often (`panels.md` § Look), and the workshop's `[w]` opens a picker of the
 * dwarves with its labor, the best at its skill first, instead of cycling them blind (§ Workshop).
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '@core/commands';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { PanelContext } from '@ui/panels/context';
import { drawWorkshopPanel, OrdersPanel } from '@ui/panels/orders';
import { skillMakesText } from '@ui/messages';
import { AnnouncementLog } from '@ui/announcements';
import { HintEngine } from '@ui/hints';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { press, strings, surface } from './ui-fixture';

const Z = 25;

describe('T-804 the skill line says what a level makes', () => {
  it('at 0 a common item one roll in four, at 6 a fine one two in five, at 13 a masterwork one in 41', () => {
    expect(skillMakesText(strings, 0)).toBe('common 1 in 4');
    expect(skillMakesText(strings, 6)).toBe('fine 2 in 5');
    expect(skillMakesText(strings, 13)).toBe('masterwork 1 in 41');
    expect(skillMakesText(strings, 20)).toBe('masterwork 9 in 10');
    expect(skillMakesText(strings, 21)).toBe('masterwork always');
  });
});

describe('T-804 the workshop\'s worker is chosen by skill', () => {
  function setup() {
    const w = new TestWorld({ seed: 't804-picker', world: 'flat-test', embark: 'none', surfaceWildlife: 'none', startTick: 60 * TICKS_PER_DAY });
    w.digRoom(10, 10, Z, 20, 12);
    for (let y = 9; y <= 22; y += 1) for (let x = 9; x <= 30; x += 1) w.discover(w.index(x, y, Z));
    const sent: Command[] = [];
    const ctx: PanelContext = {
      readers: w.readers, registry: w.game.registry, strings,
      submit: (cmd: Command) => { sent.push(cmd); expect(w.game.world.applyCommand(cmd)).toMatchObject({ ok: true }); },
      focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false,
    };
    const crafts = w.build('craftdwarf', w.index(11, 11, Z), 'granite');
    const soldier = w.spawnDwarf({ at: w.index(14, 14, Z), ageYears: 30, name: 'Kettil Frosthammer', skills: { crafting: 2 } });
    const crafter = w.spawnDwarf({ at: w.index(15, 14, Z), ageYears: 30, name: 'Runa Stormhold', skills: { crafting: 8 } });
    const miner = w.spawnDwarf({ at: w.index(16, 14, Z), ageYears: 30, name: 'Dis Ironvein', skills: { crafting: 5 } });
    for (const id of [soldier, crafter]) w.setLabor(id, 'crafts', true);
    w.setLabor(miner, 'crafts', false);
    expect(w.game.world.applyCommand({ type: 'AssignTitle', dwarfId: crafter, title: 'thane' })).toEqual({ ok: true });
    w.step(1);
    return { w, ctx, crafts, soldier, crafter, sent, orders: new OrdersPanel() };
  }

  it('[w] lists Anyone, then the dwarves with the labor by crafting, with their titles; Enter sets the worker', () => {
    const { w, ctx, crafts, crafter, sent, orders } = setup();
    orders.workshopAction(ctx, crafts, 'worker', () => {});
    expect(orders.workerPick.open).toBe(true);
    expect(sent).toEqual([]);
    const rows = orders.workerRows(ctx, crafts).map((row) => row.text);
    expect(rows).toEqual(['Anyone', 'Runa Stormhold · Crafting 8 · Thane', 'Kettil Frosthammer · Crafting 2']);
    const s = surface(48, 20);
    drawWorkshopPanel(s, { col: 0, row: 0, cols: 48, rows: 20 }, crafts, orders, ctx);
    const lines = s.lines().join('\n');
    expect(lines).toContain('► • Anyone');
    expect(lines).toContain('○ Runa Stormhold · Crafting 8 · Thane');
    orders.workshopKey(ctx, crafts, press('↓'), () => {});
    orders.workshopKey(ctx, crafts, press('Enter'), () => {});
    expect(orders.workerPick.open).toBe(false);
    expect(sent).toEqual([{ type: 'SetWorkshopWorker', workshopId: crafts, dwarfId: crafter }]);
    expect(w.game.world.entities.get(crafts, C.Workshop)?.assignedWorker).toBe(crafter);
    // Opened again, it stands on the assigned worker; Esc leaves it as it was.
    orders.workshopAction(ctx, crafts, 'worker', () => {});
    expect(orders.workerPick.selected).toBe(1);
    orders.workshopKey(ctx, crafts, press('Escape'), () => {});
    expect(orders.workerPick.open).toBe(false);
    expect(sent).toHaveLength(1);
  });
});

describe('T-804 hint_quality', () => {
  it('the first fine item says how quality is made, once, naming its maker and the item', () => {
    const w = new TestWorld({ seed: 't804-hint', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const maker = w.spawnDwarf({ at: w.index(14, 14, Z), ageYears: 30, name: 'Frode Brightward' });
    const common = w.spawnItem('statue', 'granite', w.index(15, 14, Z), 1, 1);
    const fine = w.spawnItem('statue', 'granite', w.index(16, 14, Z), 1, 2);
    const ui = defaultUiState(32);
    const log = new AnnouncementLog(strings, w.game.registry);
    const hints = new HintEngine(w.game.registry, ui, log);
    hints.onEvents([{ type: 'ItemCrafted', itemId: common, quality: 1, crafterId: maker, workshopId: 0, recipeId: 'craft_stone' }], w.readers);
    expect(log.lines).toHaveLength(0);
    hints.onEvents([{ type: 'ItemCrafted', itemId: fine, quality: 2, crafterId: maker, workshopId: 0, recipeId: 'make_statue' }], w.readers);
    hints.onEvents([{ type: 'ItemCrafted', itemId: fine, quality: 3, crafterId: maker, workshopId: 0, recipeId: 'make_statue' }], w.readers);
    expect(log.lines.map((line) => line.text)).toEqual(['☼ Frode Brightward made a fine statue. Quality comes from skill: a dwarf who works one craft gets better at it, and from Talented (13) can make a masterwork. Give a workshop one worker [w].']);
    expect(ui.hintsShown).toContain('hint_quality');
  });
});
