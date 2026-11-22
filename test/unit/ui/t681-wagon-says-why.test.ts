/**
 * T-681: the wagon's panel and the hover line over it say why goods still wait in it (24 § Building
 * panel, 13 § The "wants hauling" set): with only a Food stockpile placed, the wagon's tools and drink
 * have no stockpile that takes them, and the line goes once an Everything stockpile with room has
 * taken them.
 */

import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { TICKS_PER_DAY } from '@core/constants';
import { computeLayout } from '@render/cellbuffer';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import { tileContents } from '@ui/panels/look';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, strings } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;
const LAYOUT = computeLayout(80, 42, true);

function screenOver(w: TestWorld): FortressScreen {
  const host: FortressHost = {
    readers: w.readers,
    registry: w.game.registry,
    ui: defaultUiState(z),
    submit: (cmd) => w.submit(cmd),
    speed: () => 0,
    setSpeed: () => {},
    pan: () => {},
    changeZ: () => {},
    centerOn: () => {},
    home: () => {},
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

function rectTiles(w: TestWorld, x0: number, y0: number, width: number, height: number): TileIndex[] {
  const out: TileIndex[] = [];
  for (let y = y0; y < y0 + height; y += 1) for (let x = x0; x < x0 + width; x += 1) out.push(w.index(x, y, z));
  return out;
}

describe('T-681 the wagon says why its goods stay', () => {
  it('names the goods no stockpile takes, on the panel and the hover line, and the line goes once an Everything stockpile takes them', () => {
    const w = new TestWorld({ seed: 't681', world: 'flat-test', embark: 'default', surfaceWildlife: 'none' });
    const b = w.readers.of<BuildingsReader>('14');
    const items = w.readers.of<ItemsReader>('13');
    const wagon = b.byTag('container').find((id) => b.get(id)?.typeId === 'wagon') as EntityId;
    expect(wagon).toBeDefined();
    const centre = items.tileOf(items.inContainer(wagon)[0] as EntityId);
    const map = w.game.world.map;
    const cx = map.xOf(centre);
    const cy = map.yOf(centre);
    const screen = screenOver(w);
    screen.openBuilding(wagon);
    const waitLine = (): string | undefined => screen.building.lines(screen.ctx).find((l) => l.id === 'wait')?.text;

    const food = w.zone('stockpile', rectTiles(w, cx - 8, cy + 4, 5, 4));
    expect(w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: food, filter: 'food' } as never).ok).toBe(true);
    w.step(30);
    const line = waitLine() ?? '';
    // "N goods wait: M have no stockpile that takes them (…, drink, …, tool, …)…"
    expect(line).toMatch(/^\d+ goods wait: \d+ (has|have) no stockpile that takes them \(/);
    const named = /no stockpile that takes them \(([^)]*)\)/.exec(line)?.[1]?.split(', ') ?? [];
    expect(named).toContain('drink');
    expect(named).toContain('tool');
    expect(named).not.toContain('food');
    expect(tileContents(w.readers, w.game.registry, strings, centre)).toMatch(/ · \d+ goods wait: \d+ no stockpile/);

    const everything = w.zone('stockpile', rectTiles(w, cx - 2, cy + 4, 12, 9));
    expect(w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: everything, filter: 'everything' } as never).ok).toBe(true);
    w.step(30);
    expect(waitLine() ?? '').not.toContain('no stockpile');
    w.until(() => items.inContainer(wagon).length === 0, 3 * TICKS_PER_DAY);
    expect(items.inContainer(wagon)).toEqual([]);
    expect(waitLine()).toBeUndefined();
    expect(tileContents(w.readers, w.game.registry, strings, centre)).not.toContain('goods wait');
  }, 60_000);
});
