/** `acceptance-tests.md` ws_magma; `12` magma workshop power and `14` placement. */
import { expect } from 'vitest';
import { TileKind } from '@core/map3d';
import type { Scenario } from './runner';
import type { ItemsReader } from '@systems/items';
import type { WorkshopsReader } from '@systems/workshops';
import type { JobBoard } from '@systems/jobs';

const scenario: Scenario = {
  id: 'ws_magma', milestone: 5, seed: 'ws-magma', world: 'flat-test', embark: 'none',
  run: (w) => {
    const at = w.index(15, 15, 32);
    const below = w.map.below(at);
    w.carve(below, TileKind.Open);
    w.setFluid(below, 7, 'magma', true);
    const smelter = w.build('magma_smelter', at, 'granite');
    w.spawnDwarf({ at: w.index(18, 17, 32), skills: { smelting: 8 } });
    w.spawnItem('ore', 'hematite', w.index(19, 17, 32));
    w.step(1);
    const reader = w.readers.of<WorkshopsReader>('12');
    expect(reader.isMagmaPowered(smelter)).toBe(true);
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: smelter,
      order: { recipeId: 'smelt_hematite', mode: 'once', remaining: 1, priority: 5 } })).toEqual({ ok: true });
    w.until(() => w.events('ItemCrafted').some((e) => e['recipeId'] === 'smelt_hematite'), 1000);
    expect(w.readers.of<ItemsReader>('13').count('charcoal_bar')).toBe(0);
    w.spawnItem('ore', 'magnetite', w.index(19, 18, 32));
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: smelter,
      order: { recipeId: 'smelt_magnetite', mode: 'once', remaining: 1, priority: 5 } })).toEqual({ ok: true });
    w.until(() => w.events('JobStarted').filter((e) => e['jobType'] === 'craft').length >= 2, 1000);
    w.setFluid(below, 0, 'magma');
    w.step(1);
    expect(reader.isMagmaPowered(smelter)).toBe(false);
    expect(w.events('WorkshopBlocked').some((e) => e['workshopId'] === smelter && e['reason'] === 'no_magma')).toBe(true);
    const board = w.game.world.services.jobs as JobBoard;
    expect(Array.from(board.jobs.values()).some((j) => j.target.ref === smelter && j.blockedReason === 'no_magma')).toBe(true);
    w.step(120);
    expect(w.events('ItemCrafted').some((e) => e['recipeId'] === 'smelt_magnetite')).toBe(false);
    w.setFluid(below, 7, 'magma', true);
    w.until(() => w.events('ItemCrafted').some((e) => e['recipeId'] === 'smelt_magnetite'), 1200);
    expect(reader.isMagmaPowered(smelter)).toBe(true);
  },
};

export default scenario;
