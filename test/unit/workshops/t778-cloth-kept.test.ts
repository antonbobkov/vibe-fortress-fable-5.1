/**
 * T-778: a newcomer's first order, four beds at the carpenter's, took the five linen the wagon brings
 * for the first wound (`make_bed`: a log and two cloth), and the first cut found no dressing. A
 * workshop order takes cloth only while the dressings left after it (cloth and bandages) are at least
 * what the fortress keeps: its hospitals' `cloth` and `bandages` supplies, or a default hospital's
 * while it has none (12 § Cloth kept for dressings). An input that may be something else (a bed's
 * raw wool) takes that; a recipe that makes bandages is never held.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import type { WorkOrder } from '@core/components';
import type { TileIndex } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import { HOSPITAL_DEFAULT_SUPPLIES } from '@systems/health/constants';
import type { ItemsReader } from '@systems/items';
import { CLOTH_KEPT, type WorkshopsReader, type WorkshopsSystem } from '@systems/workshops';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { workshopBlockText } from '@ui/messages';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, strings } from '../ui/ui-fixture';

const KEPT = (HOSPITAL_DEFAULT_SUPPLIES['cloth'] ?? 0) + (HOSPITAL_DEFAULT_SUPPLIES['bandages'] ?? 0);

/** A carpenter's workshop (or a clothier's), its worker, logs, `cloth` cloth and what `extra` adds; `beds` beds ordered. */
function fortress(seed: string, cloth: number, extra?: (w: TestWorld) => void, workshop = 'carpenter', recipeId = 'make_bed', beds = 1) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const id = w.build(workshop, w.index(15, 15, Z));
  w.spawnDwarf({ at: w.index(17, 17, Z), skills: { carpentry: 6, clothesmaking: 6 } });
  w.spawnItem('log', 'oak', w.index(18, 17, Z), 4);
  if (cloth > 0) w.spawnItem('cloth', 'flax_cloth', w.index(19, 17, Z), cloth);
  extra?.(w);
  w.step(1);
  expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: id, order: { recipeId, mode: 'once', remaining: beds, priority: 5 } })).toEqual({ ok: true });
  const items = w.readers.of<ItemsReader>('13');
  const reader = w.readers.of<WorkshopsReader>('12');
  return { w, id, items, reason: () => reader.isRunnable(recipeId, id).reason };
}

function hospital(w: TestWorld, wants: Record<string, number> | null): void {
  const tiles: TileIndex[] = [];
  for (let x = 25; x < 28; x += 1) tiles.push(w.index(x, 25, Z));
  const zone = w.zone('hospital', tiles);
  if (wants !== null) expect(w.game.world.applyCommand({ type: 'SetHospitalSupplies', zoneId: zone, wants }).ok).toBe(true);
}

describe('T-778 cloth kept for dressings', () => {
  it('with no hospital the wagon\'s five linen stay: the bed order waits, says why, and takes none', () => {
    const f = fortress('t778-five', 5);
    expect(KEPT).toBe(10);
    expect(f.reason()).toBe(CLOTH_KEPT);
    f.w.step(800);
    expect(f.items.count('cloth')).toBe(5);
    expect(f.items.count('bed')).toBe(0);
    expect(f.w.events('WorkshopBlocked').some((e) => e['workshopId'] === f.id && e['reason'] === CLOTH_KEPT)).toBe(true);
  });

  it('a bed takes raw wool while the cloth is kept', () => {
    const f = fortress('t778-wool', 5, (w) => { w.spawnItem('wool_raw', 'wool', w.index(20, 17, Z), 2); });
    expect(f.reason()).toBeNull();
    f.w.until(() => f.items.count('bed') >= 1, 800);
    expect(f.items.count('cloth')).toBe(5);
    expect(f.items.count('wool_raw')).toBe(0);
  });

  it('cloth beyond the kept ten is taken, and the order stops at the ten', () => {
    const f = fortress('t778-twelve', KEPT + 3, undefined, 'carpenter', 'make_bed', 3);
    f.w.until(() => f.items.count('bed') >= 1, 800);
    f.w.step(800);
    expect(f.items.count('bed')).toBe(1);
    expect(f.items.count('cloth')).toBe(KEPT + 1);
    expect(f.reason()).toBe(CLOTH_KEPT);
  });

  it('bandages are dressings too: with enough of them the cloth goes to the bed', () => {
    const f = fortress('t778-bandages', 5, (w) => { w.spawnItem('bandage', 'flax_cloth', w.index(20, 17, Z), KEPT); });
    expect(f.reason()).toBeNull();
    f.w.until(() => f.items.count('bed') >= 1, 800);
    expect(f.items.count('cloth')).toBe(3);
  });

  it('a hospital keeps what its supplies say: cloth 0 and bandages 0 free the linen, the default keeps it', () => {
    const free = fortress('t778-hospital-free', 5, (w) => { hospital(w, { cloth: 0, bandages: 0 }); });
    expect(free.reason()).toBeNull();
    free.w.until(() => free.items.count('bed') >= 1, 800);
    expect(free.items.count('cloth')).toBe(3);
    const kept = fortress('t778-hospital-default', 5, (w) => { hospital(w, null); });
    expect(kept.reason()).toBe(CLOTH_KEPT);
  });

  it('the clothier cuts the kept cloth into bandages: it makes dressings', () => {
    const f = fortress('t778-bandages-made', 5, undefined, 'clothier', 'make_bandages');
    expect(f.reason()).toBeNull();
    f.w.until(() => f.items.count('bandage') >= 1, 800);
    expect(f.items.count('cloth')).toBe(4);
  });

  it('the orders panel and the workshop say the cloth is kept for wounds', () => {
    const f = fortress('t778-panel', 5);
    f.w.step(5);
    const host: FortressHost = {
      readers: f.w.readers, registry: f.w.game.registry, ui: defaultUiState(Z), submit: (cmd) => { f.w.submit(cmd); }, speed: () => 1,
      setSpeed: () => {}, pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
      layout: () => computeLayout(80, 42, true), precondition: () => true,
      registeredPanels: () => f.w.game.world.registrations.panels, announcements: () => f.w.game.world.registrations.announcements,
      now: () => 1000, confirm: (_id, _params, reply) => reply(true),
    };
    const screen = new FortressScreen(host, keymap, strings);
    screen.openPanel('orders');
    const row = screen.orders.rows(screen.ctx)[0];
    expect(row).toBeDefined();
    expect(screen.orders.status(screen.ctx, row!).short).toBe('cloth kept for wounds (5)');
    expect(workshopBlockText(screen.ctx, CLOTH_KEPT)).toBe("Waiting: the last 10 cloth and bandages are kept to bandage wounds (5 cloth in stock). Weave more cloth or lower a hospital's cloth supply; a bed can be stuffed with straw or wool instead.");
    const operator = (f.w.game.world.scheduler.byId('12') as WorkshopsSystem).operator;
    expect(operator.problem({ recipe: operator.recipeIndex('make_bed'), remaining: 1, mode: 'once', threshold: 0, priority: 5, materialFilter: null } as WorkOrder, f.id)).toBe(CLOTH_KEPT);
  });
});
