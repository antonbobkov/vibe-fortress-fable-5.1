/**
 * T-791: in playtest 7 a standing "≥30 Cut gem" order at the jeweler's cut two of the four rough
 * glowstones bought for the lamp, and the lamp order waited for a rough gem all season. An input that
 * names no material leaves the units of a material that another standing order's recipe names for the
 * same item (12 § Materials kept for orders): the cut-gem order leaves the lamp's glowstone and says
 * so, and one that names glowstone still cuts it. The hint names the lamp's order and its placing,
 * the Build list names the lamp, and a built lamp says what it lights.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { computeLayout } from '@render/cellbuffer';
import type { ItemsReader } from '@systems/items';
import { MATERIAL_KEPT, type WorkshopsReader } from '@systems/workshops';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { workshopBlockText } from '@ui/messages';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, strings } from '../ui/ui-fixture';

const KEPT_REASON = `${MATERIAL_KEPT} rough_gem glowstone make_glowstone_lamp`;

/** A jeweler's with its worker, `glow` rough glowstones, `ruby` rough rubies and `blocks` granite blocks; `orders` added in that order. */
function jeweler(seed: string, glow: number, ruby: number, orders: Record<string, unknown>[], blocks = 2) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const id = w.build('jeweler', w.index(15, 15, Z));
  w.spawnDwarf({ at: w.index(17, 17, Z), skills: { gem_cutting: 8 } });
  if (glow > 0) w.spawnItem('rough_gem', 'glowstone', w.index(18, 17, Z), glow);
  if (ruby > 0) w.spawnItem('rough_gem', 'ruby', w.index(19, 17, Z), ruby);
  if (blocks > 0) w.spawnItem('stone_block', 'granite', w.index(20, 17, Z), blocks);
  w.step(1);
  for (const order of orders) expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: id, order: { priority: 5, ...order } })).toEqual({ ok: true });
  const items = w.readers.of<ItemsReader>('13');
  const materials = w.game.registry.table('materials');
  const types = w.game.registry.table('items');
  const count = (type: string, material: string): number => items.countMatching({ type: types.index(type), materialId: materials.index(material) });
  const reader = w.readers.of<WorkshopsReader>('12');
  return { w, id, count, reason: (recipeId: string, materialFilter: string | null = null) => reader.isRunnable(recipeId, id, { materialFilter } as never).reason };
}

const CUT_ANY = { recipeId: 'cut_gem', mode: 'maintain', threshold: 30 };
const LAMPS = { recipeId: 'make_glowstone_lamp', mode: 'once', remaining: 2 };

describe('T-791 the jeweler leaves the lamp\'s glowstone', () => {
  it('a standing cut-gem order of any stone leaves the two rough glowstones two lamps want, and the lamps are made', () => {
    const f = jeweler('t791-kept', 2, 0, [CUT_ANY, LAMPS]);
    expect(f.reason('cut_gem')).toBe(KEPT_REASON);
    f.w.until(() => f.count('statue', 'glowstone') >= 2, 4000);
    expect(f.count('cut_gem', 'glowstone')).toBe(0);
    expect(f.count('rough_gem', 'glowstone')).toBe(0);
  });

  it('while the lamp waits for its stone block, the cut-gem order waits too and the workshop says why', () => {
    const f = jeweler('t791-wait', 2, 0, [CUT_ANY, LAMPS], 0);
    f.w.step(600);
    expect(f.count('rough_gem', 'glowstone')).toBe(2);
    expect(f.reason('cut_gem')).toBe(KEPT_REASON);
    expect(f.w.events('WorkshopBlocked').some((e) => e['workshopId'] === f.id && e['reason'] === MATERIAL_KEPT && e['input'] === 'rough_gem')).toBe(true);
  });

  it('the cut-gem order cuts other stones meanwhile, and the glowstone beyond what the lamps want', () => {
    const f = jeweler('t791-beyond', 3, 2, [CUT_ANY, LAMPS]);
    expect(f.reason('cut_gem')).toBeNull();
    f.w.until(() => f.count('statue', 'glowstone') >= 2, 6000);
    f.w.step(1200);
    expect(f.count('cut_gem', 'ruby')).toBe(2);
    expect(f.count('cut_gem', 'glowstone')).toBe(1);
    expect(f.count('statue', 'glowstone')).toBe(2);
  });

  it('a cut-gem order that names glowstone still cuts it: rough is a lamp, cut is a staff stone', () => {
    const f = jeweler('t791-named', 2, 0, [{ ...CUT_ANY, materialFilter: 'glowstone' }, LAMPS]);
    expect(f.reason('cut_gem', 'glowstone')).toBeNull();
    f.w.step(1500);
    expect(f.count('cut_gem', 'glowstone')).toBeGreaterThanOrEqual(1);
  });

  it('with no lamp ordered the glowstone is cut as any stone', () => {
    const f = jeweler('t791-no-lamp', 2, 0, [CUT_ANY]);
    expect(f.reason('cut_gem')).toBeNull();
    f.w.until(() => f.count('cut_gem', 'glowstone') >= 2, 4000);
  });

  it('the orders panel and the workshop say what the glowstone is kept for', () => {
    const f = jeweler('t791-panel', 1, 0, [CUT_ANY, { ...LAMPS, remaining: 1 }]);
    const host: FortressHost = {
      readers: f.w.readers, registry: f.w.game.registry, ui: defaultUiState(Z), submit: (cmd) => { f.w.submit(cmd); }, speed: () => 1,
      setSpeed: () => {}, pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
      layout: () => computeLayout(80, 42, true), precondition: () => true,
      registeredPanels: () => f.w.game.world.registrations.panels, announcements: () => f.w.game.world.registrations.announcements,
      now: () => 1000, confirm: (_id, _params, reply) => reply(true),
    };
    const screen = new FortressScreen(host, keymap, strings);
    screen.openPanel('orders');
    const row = screen.orders.rows(screen.ctx).find((r) => r.kind !== 'done' && r.entry.order.mode === 'maintain');
    expect(row).toBeDefined();
    expect(screen.orders.status(screen.ctx, row!).short).toBe('glowstone kept for Glowstone lamp');
    expect(workshopBlockText(screen.ctx, KEPT_REASON)).toBe("Waiting: the glowstone rough gem is kept for the Glowstone lamp order. Set this order's material to glowstone to take it anyway.");
  });
});

describe('T-791 the way to a lamp is named where the player looks', () => {
  it('the glowcap hint names the order and the placing', () => {
    // T-798: the hint also says where glowcap comes from.
    expect(strings.get('hint.hint_glowcap')).toBe("Glowcap grows in the dark under a glowstone lamp, from seeds the Mountainhome sells in spring or from a glowcap patch in the caverns: order a lamp at a jeweler's ([o], 'Glowstone lamp'), then place it [b > Furniture > Statue] in the middle of a dark plot.");
  });

  it('the Statue row reads "Statue / lamp" while a glowstone statue is to be had, and a built lamp says what it lights', () => {
    const w = new TestWorld({ seed: 't791-build', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    w.step(1);
    const host: FortressHost = {
      readers: w.readers, registry: w.game.registry, ui: defaultUiState(Z), submit: (cmd) => { w.submit(cmd); }, speed: () => 1,
      setSpeed: () => {}, pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
      layout: () => computeLayout(80, 42, true), precondition: () => true,
      registeredPanels: () => w.game.world.registrations.panels, announcements: () => w.game.world.registrations.announcements,
      now: () => 1000, confirm: (_id, _params, reply) => reply(true),
    };
    const screen = new FortressScreen(host, keymap, strings);
    screen.build.choose('f');
    const statueRow = (): string => screen.build.rowName(screen.ctx, screen.build.rows(screen.ctx).find((r) => r.id === 'statue')!);
    expect(statueRow()).toBe('Statue');
    w.spawnItem('statue', 'granite', w.index(10, 10, Z), 1);
    w.step(1);
    expect(statueRow()).toBe('Statue');
    w.spawnItem('statue', 'glowstone', w.index(11, 10, Z), 1);
    w.step(1);
    expect(statueRow()).toBe('Statue / lamp');

    const lamp = w.build('statue', w.index(20, 20, Z), 'glowstone');
    const plain = w.build('statue', w.index(24, 20, Z), 'granite');
    screen.building.open(lamp);
    expect(screen.building.lines(screen.ctx).find((l) => l.id === 'lamp')?.text).toBe('Glowstone lamp: lights its 3 × 3 for glowcap.');
    screen.building.open(plain);
    expect(screen.building.lines(screen.ctx).some((l) => l.id === 'lamp')).toBe(false);
  });
});
