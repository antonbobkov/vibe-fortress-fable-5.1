/**
 * T-684: 13 names the stack an item merged into. `items.merge(a, b)` ends `b` with no `ItemDestroyed`;
 * it now emits `ItemMerged { id: b, into: a, count }`, and whoever holds `b` follows it or lets it go:
 * Look's item view moves to the stack it joined (T-671 guessed by type and material on its last
 * tile), a log line naming it names the stack, and a job listing it takes the stack while that is
 * still the job's, else drops it as a destroyed item (the T-687 path).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import type { GameEvent } from '@core/events';
import type { EntityId } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import type { JobsSystem } from '@systems/jobs';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, press, strings } from '../ui/ui-fixture';

const LAYOUT = computeLayout(80, 42, true);

function world(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

function screenOver(w: TestWorld): FortressScreen {
  const ui = defaultUiState(Z);
  const host: FortressHost = {
    readers: w.readers,
    registry: w.game.registry,
    ui,
    submit: (cmd) => w.submit(cmd),
    speed: () => 1,
    setSpeed: () => {},
    pan: (dx, dy) => { ui.camX += dx; ui.camY += dy; },
    changeZ: (dz) => { ui.z += dz; },
    centerOn: (x, y, zz) => { ui.camX = x - 20; ui.camY = y - 20; ui.z = zz; },
    home: () => { ui.camX = 0; ui.camY = 0; },
    zoom: () => {},
    layout: () => LAYOUT,
    precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements,
    now: () => 1000,
    confirm: (_id, _params, reply) => reply(true),
  };
  return new FortressScreen(host, keymap, strings);
}

/** The `ItemMerged` events a step dispatches, as the presentation receives them. */
function mergedEvents(w: TestWorld): GameEvent[] {
  const before = w.events('ItemMerged').length;
  w.step(1);
  return w.events('ItemMerged').slice(before);
}

describe('T-684 ItemMerged', () => {
  it('13 emits ItemMerged with the stack joined and the units it brought, and no ItemDestroyed', () => {
    const w = world('t684-event');
    const at = w.index(30, 30, Z);
    const a = w.spawnItem('bolt', 'copper', at, 25);
    const b = w.items.split(a, 15);
    const destroyed = w.events('ItemDestroyed').length;
    expect(w.items.merge(a, b)).toBe(true);
    expect(mergedEvents(w)).toEqual([expect.objectContaining({ type: 'ItemMerged', id: b, into: a, count: 15 })]);
    expect(w.events('ItemDestroyed').length).toBe(destroyed);
  });

  it('Look: a stack merged into a carried stack moves the view to it, though a stack of its kind lies on its last tile', () => {
    const w = world('t684-look');
    const screen = screenOver(w);
    const at = w.index(30, 30, Z);
    const decoy = w.spawnItem('bolt', 'copper', at, 5);
    const b = w.spawnItem('bolt', 'copper', at, 10);
    const dwarf = w.spawnDwarf({ at: w.index(50, 40, Z) });
    const carried = w.spawnItem('bolt', 'copper', w.index(50, 40, Z), 3);
    w.items.attachToCarrier(carried, dwarf);
    screen.look({ x: 30, y: 30, z: Z });
    screen.openTarget({ kind: 'item', id: b });
    screen.key(press('f'));
    expect(screen.lookFollow).toBe(true);
    screen.followView();
    expect(w.items.merge(carried, b)).toBe(true);
    screen.onEvents(mergedEvents(w));
    screen.followView();
    expect(screen.lookAt).toMatchObject({ kind: 'item', id: carried });
    expect(screen.lookAt).not.toMatchObject({ id: decoy });
    expect(screen.lookFollow).toBe(true);
    expect(screen.ui.cursor).toEqual({ x: 50, y: 40 });
  });

  it('Look: merges heard in one batch are followed to the last stack; a gone item merged nowhere stays gone', () => {
    const w = world('t684-chain');
    const screen = screenOver(w);
    const a = w.spawnItem('bolt', 'copper', w.index(30, 30, Z), 4);
    const b = w.spawnItem('bolt', 'copper', w.index(31, 30, Z), 4);
    const c = w.spawnItem('bolt', 'copper', w.index(32, 30, Z), 4);
    screen.look({ x: 30, y: 30, z: Z });
    screen.openTarget({ kind: 'item', id: a });
    screen.key(press('f'));
    screen.followView();
    expect(w.items.merge(b, a)).toBe(true);
    expect(w.items.merge(c, b)).toBe(true);
    screen.onEvents(mergedEvents(w));
    screen.followView();
    expect(screen.lookAt).toMatchObject({ kind: 'item', id: c });
    expect(screen.ui.cursor).toEqual({ x: 32, y: 30 });
    // No guess any more: a stack that vanished with no event heard keeps its view, gone.
    const d = w.spawnItem('bolt', 'copper', w.index(32, 30, Z), 1);
    screen.openTarget({ kind: 'item', id: d });
    screen.key(press('f'));
    screen.followView();
    w.game.world.entities.destroy(d);
    screen.followView();
    expect(screen.lookAt).toMatchObject({ kind: 'item', id: d });
  });

  it('the log: a line whose subject merged names the stack it joined', () => {
    const w = world('t684-log');
    const screen = screenOver(w);
    const a = w.spawnItem('bolt', 'copper', w.index(30, 30, Z), 4);
    const b = w.spawnItem('bolt', 'copper', w.index(31, 30, Z), 4);
    const line = screen.log.append('note', 'Some bolts.', w.tick, w.index(31, 30, Z));
    line.subject = b;
    const other = screen.log.append('note', 'Other bolts.', w.tick);
    other.subject = a;
    expect(w.items.merge(a, b)).toBe(true);
    screen.onEvents(mergedEvents(w));
    expect(line.subject).toBe(a);
    expect(other.subject).toBe(a);
    expect(screen.logSubject(line)).toMatchObject({ id: a, kind: 'item' });
  });

  it('a job: a listed stack still its own follows into the stack it joined; a lapsed one is dropped and invalidates', () => {
    const w = world('t684-jobs');
    const world13 = w.game.world;
    const tile = w.index(30, 20, Z);
    const zoneId = w.zone('farm_plot', [tile]);
    expect(world13.applyCommand({ type: 'SetPlotCrop', zoneId, season: world13.calendar.season, speciesId: 'barley' }).ok).toBe(true);
    w.spawnItem('seed', 'barley', w.index(50, 20, Z), 1);
    const board = (world13.scheduler.byId('11') as JobsSystem).board;
    w.until(() => board.byKey(`plant:${tile}`) !== undefined, 2000);
    const job = board.jobs.get(board.byKey(`plant:${tile}`)?.id ?? -1);
    expect(job).toBeDefined();
    const input = job!.inputs[0]!;
    const items = world13.services.items!;
    const at = w.index(40, 20, Z);

    // Held: both stacks reserved to the job, the one listed merges into the other.
    const held: EntityId = w.spawnItem('seed', 'barley', at, 1);
    const stack: EntityId = w.spawnItem('seed', 'barley', at, 2);
    items.reserve(held, job!.id);
    items.reserve(stack, job!.id);
    input.reserved = [held];
    input.delivered = [held];
    delete job!.data['inputsInvalidated'];
    expect(items.merge(stack, held)).toBe(true);
    w.step(1);
    expect(input.reserved).toEqual([stack]);
    expect(input.delivered).toEqual([stack]);
    expect(job!.data['inputsInvalidated']).toBeUndefined();

    // Lapsed: a free seed the job still lists merges into a free stack: it leaves the lists.
    items.release(stack);
    const free = w.spawnItem('seed', 'barley', at, 1);
    input.reserved = [];
    input.delivered = [stack];
    expect(items.merge(free, stack)).toBe(true);
    w.step(1);
    expect(input.delivered).toEqual([]);
    expect(job!.data['inputsInvalidated']).toBe(true);
  });
});
