/** T-M7-03: a caravan exchange driven through the real panel and modal controls. */
import { expect, test } from '@playwright/test';
import { screenOf, textOf, type Hook } from './helpers';

interface TradeHook extends Hook {
  readers: {
    ui: { panel: string | null };
    map: { index(x: number, y: number, z: number): number };
    items: { get(id: number): { type: number; count: number; flags: number } | undefined };
    of<T>(id: string): T;
  };
  host: {
    world: {
      calendar: { tick: number };
      fortress: { reputation: Record<string, number> };
      applyCommand(command: Record<string, unknown>): { ok: boolean; reason?: string };
      scheduler: { byId(id: string): { lastPlacedBuilding: number; completeNow(id: number, material: number, linked: number): void } };
      services: {
        spawn: { item(type: number, material: number, tile: number, count: number, quality: number): number };
        movement: { teleport(id: number, tile: number): boolean };
      };
      onEvents(listener: (events: readonly { type: string }[]) => void): () => void;
    };
    headless: { registry: { table(name: string): { index(id: string): number; idOf(index: number): string } } };
  };
  dwarves(): { id: number }[];
  submit(command: Record<string, unknown>): void;
  step(ticks: number): void;
}

test('T-M7-03 trade-session', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?start=flat-test&embark=default');
  await page.waitForFunction(() => (window as unknown as { __deepholm?: unknown }).__deepholm !== undefined);
  await expect.poll(() => screenOf(page)).toBe('fortress');
  await page.locator('canvas#screen').click();

  const fixture = await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: TradeHook }).__deepholm;
    const world = h.host.world;
    const registry = h.host.headless.registry;
    const granite = registry.table('materials').index('granite');
    const placed = world.applyCommand({ type: 'PlaceBuilding', buildingType: 'trade_depot', origin: h.readers.map.index(45, 8, 32), orientation: 0, materialChoice: 'granite' });
    if (!placed.ok) throw new Error(`depot: ${placed.reason}`);
    const depot = world.scheduler.byId('14').lastPlacedBuilding;
    world.scheduler.byId('14').completeNow(depot, granite, 0);
    const tile = h.readers.of<{ get(id: number): { footprint: number[] } | undefined }>('14').get(depot)?.footprint[0] ?? 0;
    const request = world.applyCommand({ type: 'SetRequests', civ: 'hillfolk', entries: [{ itemType: 'cloth', priority: 3 }] });
    if (!request.ok) throw new Error(`request: ${request.reason}`);
    (window as unknown as { __tradeEvents?: string[] }).__tradeEvents = [];
    world.onEvents((events) => { for (const event of events) (window as unknown as { __tradeEvents: string[] }).__tradeEvents.push(event.type); });
    return { depot, tile };
  });

  const arrival = await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: TradeHook }).__deepholm;
    const trade = h.readers.of<{ activeCaravan(): { civ: string; state: string } | null }>('20');
    for (let n = 0; n < 120; n += 1) {
      h.step(5_000);
      if (trade.activeCaravan()?.state === 'atDepot') return { tick: h.host.world.calendar.tick, state: trade.activeCaravan()?.state };
    }
    return { tick: h.host.world.calendar.tick, state: trade.activeCaravan()?.state ?? 'none' };
  });
  expect(arrival.state).toBe('atDepot');
  expect(await page.evaluate(() => (window as unknown as { __tradeEvents: string[] }).__tradeEvents)).toContain('CaravanAtDepot');
  const depotStock = await page.evaluate(({ depot, tile }) => {
    const h = (window as unknown as { __deepholm: TradeHook }).__deepholm;
    const registry = h.host.headless.registry;
    const type = registry.table('items').index('easy_meal');
    const material = registry.table('materials').index('meal');
    const meals = [h.host.world.services.spawn.item(type, material, tile, 10, 1), h.host.world.services.spawn.item(type, material, tile, 10, 1)];
    const hauler = h.dwarves()[0];
    if (!hauler || !h.host.world.services.movement.teleport(hauler.id, tile)) throw new Error('hauler fixture failed');
    h.submit({ type: 'MoveToDepot', depotId: depot, itemIds: meals });
    const trade = h.readers.of<{ depotItems(): number[] }>('20');
    for (let n = 0; n < 30 && !meals.every((id) => trade.depotItems().includes(id)); n += 1) h.step(100);
    return { ids: trade.depotItems(), meals };
  }, fixture);
  if (!depotStock.meals.every((id) => depotStock.ids.includes(id))) throw new Error(`depot stock: ${JSON.stringify(depotStock)}`);

  await page.evaluate(({ tile }) => {
    const h = (window as unknown as { __deepholm: TradeHook }).__deepholm;
    const dwarf = h.dwarves()[0];
    if (!dwarf || !h.host.world.services.movement.teleport(dwarf.id, tile)) throw new Error('broker fixture failed');
    const title = h.host.world.applyCommand({ type: 'AssignTitle', dwarfId: dwarf.id, title: 'broker' });
    if (!title.ok) throw new Error(`broker: ${title.reason}`);
  }, fixture);

  await page.keyboard.press('c');
  expect(await textOf(page)).toContain('Civilizations');
  await page.keyboard.press('Shift+D');
  expect(await textOf(page)).toContain('Depot');
  await page.keyboard.press('Shift+T');
  await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: TradeHook }).__deepholm;
    const trade = h.readers.of<{ sessionOpen(): boolean }>('20');
    for (let n = 0; n < 300 && !trade.sessionOpen(); n += 1) h.step(1);
    if (!trade.sessionOpen()) throw new Error('trade job did not open a session');
  });
  await expect.poll(() => screenOf(page)).toBe('trade_session');
  expect(await textOf(page)).toContain('Trading with the Hillfolk');

  const clothIndex = await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: TradeHook }).__deepholm;
    const trade = h.readers.of<{ merchantItems(): number[] }>('20');
    return trade.merchantItems().findIndex((id) => h.host.headless.registry.table('items').idOf(h.readers.items.get(id)?.type ?? 0) === 'cloth');
  });
  expect(clothIndex).toBeGreaterThanOrEqual(0);
  for (let i = 0; i < clothIndex; i += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('+');
  await page.keyboard.press('Tab');
  await page.keyboard.press('End');
  expect(await textOf(page)).toContain('We take');
  await page.keyboard.press('Enter');
  const result = await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: TradeHook }).__deepholm;
    return { rep: h.host.world.fortress.reputation['hillfolk'], events: (window as unknown as { __tradeEvents: string[] }).__tradeEvents, text: h.text().slice(-6).join('\n') };
  });
  if (!result.events.includes('TradeCompleted')) throw new Error(`offer: ${JSON.stringify({ rep: result.rep, recent: result.events.slice(-15), text: result.text })}`);
  expect(result.rep).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await expect.poll(() => screenOf(page)).toBe('fortress');
  await page.keyboard.press('c');
  expect(await textOf(page)).toContain(`rep +${result.rep}`);
  expect(errors).toEqual([]);
});
