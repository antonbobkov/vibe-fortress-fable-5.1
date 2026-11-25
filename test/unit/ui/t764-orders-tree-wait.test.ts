/**
 * T-764: a workshop planned over grown trees has no build job until they fall (14 § Placement), so
 * Add order's not-built note counts the trees instead (`panels.md` § Add order).
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '@core/commands';
import { TileKind } from '@core/map3d';
import type { TileIndex } from '@core/types';
import type { PanelContext } from '@ui/panels/context';
import { OrdersPanel } from '@ui/panels/orders';
import { TestWorld } from '../../scenarios/test-world';
import { strings } from './ui-fixture';

const Z = 32;

function ctxOf(w: TestWorld): PanelContext {
  return { readers: w.readers, registry: w.game.registry, strings,
    submit: (cmd: Command) => { expect(w.game.world.applyCommand(cmd)).toMatchObject({ ok: true }); },
    focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false };
}

describe('T-764 the Orders note names the trees a planned workshop waits for', () => {
  it('a carpenter recipe reads "2 trees to fell first" until both fall, then the usual note', () => {
    const w = new TestWorld({ seed: 't764-orders', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const oak = w.game.registry.table('materials').index('oak');
    const trees = [w.index(40, 40, Z), w.index(42, 42, Z)] as [TileIndex, TileIndex];
    for (const t of trees) w.game.world.services.terrain.setKind(t, TileKind.Tree, oak);
    const ctx = ctxOf(w);
    const orders = new OrdersPanel();
    orders.openPicker(ctx);
    const recipe = orders.pickerRecipes(ctx).find((r) => r.id === 'make_archery_target');
    expect(recipe).toBeDefined();
    const note = (): string => orders.pickerNote(ctx, recipe as NonNullable<typeof recipe>);
    expect(note()).toBe("· no carpenter's workshop");
    expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'carpenter', origin: trees[0], orientation: 0, priority: 5 })).toMatchObject({ ok: true });
    w.step(2);
    expect(note()).toBe("· carpenter's workshop not built: 2 trees to fell first");
    w.game.world.services.terrain.setKind(trees[0], TileKind.Floor, oak);
    expect(note()).toBe("· carpenter's workshop not built: a tree to fell first");
    w.game.world.services.terrain.setKind(trees[1], TileKind.Floor, oak);
    w.step(2);
    expect(note()).toBe("· carpenter's workshop not built yet");
  });
});
