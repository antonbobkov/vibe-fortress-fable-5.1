/**
 * E2E `full-year` (M8) of `process/testing-strategy.md` § E2E harness and `M8-polish.md` T-M8-05:
 * Boots the app, generates world `e2e-year`, embarks Balanced at a serene_vale / peril-0 region
 * found through the filter panel, then drives a scripted first year through the real UI at 4×
 * (dig, stockpiles, still, farm, hearth, bedrooms, depot) with checkpoints from `balance.md`
 * § Year-one expectation; three screenshots for the report.
 */

import { expect, test, type Page } from '@playwright/test';
import { generateWorld, moveCursorTo, screenOf, textOf, clickTile, dragTiles, textCell, clickText, type Hook } from './helpers';
import { CARAVAN_DAY_MAX, CARAVAN_DAY_MIN } from '../../src/systems/trade/constants';
import { CARAVAN_SEASON } from '../../src/systems/trade/schedule';
import { GUARANTEED_SIZE_MAX, GUARANTEED_SIZE_MIN } from '../../src/systems/immigration/constants';
import { DAYS_PER_SEASON, DAYS_PER_YEAR } from '../../src/core/constants';
import { readFileSync } from 'node:fs';

/** Species ids of the content table, for naming the species of a killer. */
const speciesNames: string[] = (JSON.parse(readFileSync('src/content/creatures.json', 'utf8')) as { id: string }[]).map((row) => row.id);

interface FullYearHook extends Hook {
  step(n: number): void;
  setSpeed(speed: number): void;
  screenshotName(name: string): string;
  hash(): string;
  dwarves(): { id: number; x: number; y: number; z: number }[];
  readers: {
    calendar: { tick: number };
    map: { w: number; h: number; d: number; kindAt(i: number): number; index(x: number, y: number, z: number): number };
    items: { wealth(): number; count(kind: string): number };
    buildings: {
      wagon(): number;
      all(): readonly number[];
      get(id: number): { origin: number; state: string; type: number; typeId?: string } | undefined;
      zoneAt(i: number): number;
      zoneTileQualifies(type: string, i: number): boolean;
      ghost(typeId: string, origin: number, orientation: number): { reason: string | null };
    };
    world: {
      regions(): readonly { id: number; biome: string; peril: number; temper: number; wealth: number; traits: readonly string[]; name: string }[];
      findRegions(filter: Record<string, unknown>): readonly { id: number }[];
    } | null;
    ui: { camX: number; camY: number; z: number; panel: string | null };
    of<T>(id: string): T;
  };
  host: {
    speed(): number;
    headless: { movement: { tileOf(id: number): number }; registry: { table(name: string): { index(id: string): number; idOf(index: number): string } } };
    world: {
      calendar: { tick: number };
      scheduler: { byId(id: string): { lastPlacedBuilding: number; lastCreatedZone: number } };
      onEvents(listener: (events: readonly { type: string; [k: string]: unknown }[]) => void): () => void;
    };
  };
}

interface YearTracker {
  caravanDay: Record<string, number | null>;
  waves: { day: number; count: number; guaranteed: boolean }[];
  raidDays: number[];
  warningDays: number[];
  plantedDays: number[];
  cavePlantedDays: number[];
  frozenDays: number[];
  tradesDone: number;
  harvests: number;
  wildSpawns: Record<string, number>;
  huntKills: number;
  huntsCompleted: number;
  starvingCount: number;
  deaths: Death[];
  /** A wild animal has attacked a fortress creature since the alert last went to hearth. */
  attacked: boolean;
  /** The last tick a predator was near the wagon or a wild animal attacked. */
  lastThreatTick: number;
  level: 'calm' | 'watchful' | 'hearth';
  alerts: { tick: number; level: string }[];
  lastLoggedDay: number;
  raisedAt: number;
  noHearthUntil: number;
}

/** A fortress creature that died: when, of what, and who killed it (T-221). */
interface Death {
  day: number;
  tick: number;
  /** A dwarf, or the species of a fortress animal. */
  kind: string;
  name: string;
  cause: string;
  killerId: number;
  killerSpecies: string;
  /** The killer's wild state at the moment of death, when it was still alive. */
  killerState: string;
}

async function closePanels(page: Page): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    const panel = await page.evaluate(() => (window as unknown as { __deepholm: FullYearHook }).__deepholm.readers.ui.panel);
    if (panel === null) break;
    await page.keyboard.press('Escape');
  }
}

async function placeBuilding(page: Page, categoryKey: string, nameQuery: string, clickX: number, clickY: number): Promise<void> {
  await page.keyboard.press('b');
  await page.keyboard.press(categoryKey);
  await clickText(page, nameQuery);
  await expect.poll(async () => (await textOf(page)).toLowerCase()).toContain(`${nameQuery.toLowerCase()} ·`);
  if (nameQuery === 'Trade depot') {
    const txt = (await textOf(page)).toLowerCase();
    if (txt.includes('wood')) {
      await page.keyboard.press('x');
    }
  }
  await clickTile(page, clickX, clickY);
  await closePanels(page);
}

async function addWorkOrder(page: Page, filter: string, workshopHint: string, mode: 'once' | 'maintain', target: number): Promise<void> {
  await page.keyboard.press('o');
  await page.keyboard.press('Shift+N');
  await expect.poll(() => textOf(page)).toContain('Add order');
  for (const ch of filter) await page.keyboard.press(ch);
  for (let k = 0; k < 10 && !(await textOf(page)).toLowerCase().includes(`any ${workshopHint.toLowerCase()}`); k += 1) {
    await page.keyboard.press('ArrowDown');
  }
  await expect.poll(async () => (await textOf(page)).toLowerCase()).toContain(`any ${workshopHint.toLowerCase()}`);
  if (mode === 'maintain') {
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('ArrowRight');
  }
  for (const digit of String(target)) await page.keyboard.press(digit);
  await page.keyboard.press('Enter');
  await closePanels(page);
}

/**
 * The playthrough's clock (T-221): it is paused from the embark to the end, and the only way it
 * moves is `advance`. `expectPaused` checks, before the UI commands of a checkpoint, that nothing
 * but `advance` has moved it.
 */
function playClock(page: Page, startTick: number): {
  advance(ticks: number): Promise<void>;
  advanceTo(tick: number): Promise<void>;
  expectPaused(): Promise<void>;
  sync(): Promise<void>;
} {
  let expected = startTick;
  const clock = {
    async advance(ticks: number): Promise<void> {
      await clock.advanceTo(expected + ticks);
    },
    async advanceTo(tick: number): Promise<void> {
      await page.evaluate((target) => {
        const h = (window as unknown as { __deepholm: FullYearHook }).__deepholm;
        while (h.readers.calendar.tick < target) h.step(Math.min(300, target - h.readers.calendar.tick));
      }, tick);
      expected = tick;
      await clock.expectPaused();
    },
    /** Take the tick the play has stepped to, after a step loop of its own. */
    async sync(): Promise<void> {
      expected = await page.evaluate(() => (window as unknown as { __deepholm: FullYearHook }).__deepholm.readers.calendar.tick);
      await clock.expectPaused();
    },
    async expectPaused(): Promise<void> {
      const now = await page.evaluate(() => {
        const h = (window as unknown as { __deepholm: FullYearHook }).__deepholm;
        return { speed: h.host.speed(), tick: h.readers.calendar.tick };
      });
      expect(now, `the clock is paused at tick ${expected} while the UI commands are given`).toEqual({ speed: 0, tick: expected });
    },
  };
  return clock;
}

/**
 * Set the fortress alert through the military panel, as a player does: `m`, then `1`, `2` or `3`
 * (T-221). The command applies on the tick it is given, because the clock is paused.
 */
async function setAlertThroughUi(page: Page, level: 'calm' | 'watchful' | 'hearth'): Promise<void> {
  const key = { calm: '1', watchful: '2', hearth: '3' }[level];
  const shown = { calm: 'Calm', watchful: 'Watchful', hearth: 'Hearth' }[level];
  await closePanels(page);
  // A death pins a danger line to the log strip, and the first key after it only dismisses it (24).
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.keyboard.press('m');
    const panel = await page.evaluate(() => (window as unknown as { __deepholm: FullYearHook }).__deepholm.readers.ui.panel);
    if (panel === 'military') break;
  }
  await expect.poll(() => textOf(page)).toContain('Military');
  await page.keyboard.press(key);
  await expect.poll(() => textOf(page)).toContain(`Alert: ${shown}`);
  await closePanels(page);
}

/** Species of the content table whose temper is `aggressive`: they hunt the fortress's creatures. */
const aggressiveSpecies: string[] = (JSON.parse(readFileSync('src/content/creatures.json', 'utf8')) as { id: string; temper: string }[])
  .filter((row) => row.temper === 'aggressive')
  .map((row) => row.id);

/** Ticks from the last sign of a predator to the alert going back to calm. */
const ALERT_CALM_TICKS = 600;
/**
 * The shortest a hearth alert is held, and how long the civilians are then left out before the
 * next one. The alert ends when no predator is near; a sheltering civilian whose hunger, thirst or
 * rest is critical goes out to serve it and returns (10 § Behavior selection: step 2).
 */
const HEARTH_HOLD_TICKS = 300;
const HEARTH_PAUSE_TICKS = 1500;
/** How close to the wagon, in tiles, a predator counts as near. */
const PREDATOR_NEAR_TILES = 40;
/** Ticks the hook steps between two looks at the wildlife. */
const LOOK_EVERY_TICKS = 20;

/**
 * Play to `target` by stepping, answering wildlife as a player would (T-221, decision 4). A
 * predator near the wagon puts the fortress on watch, which sends the squad out and leaves the
 * civilians at work. When a wild animal attacks a fortress creature the alert goes to hearth, so
 * the civilians, the haulers among them, come in; after HEARTH_HOLD_TICKS, once no predator is near,
 * it goes back to watch. With no predator near for ALERT_CALM_TICKS it goes back to calm.
 * The answers come at tick boundaries that the simulation decides, so the year is the same on
 * every run.
 */
async function playTo(page: Page, clock: ReturnType<typeof playClock>, target: number): Promise<void> {
  for (;;) {
    const outcome = await page.evaluate(({ target, every, calm, hold, near, aggressive }) => {
      const h = (window as unknown as { __deepholm: FullYearHook }).__deepholm;
      const tracker = (window as unknown as { __tracker: YearTracker }).__tracker;
      const animals = h.readers.of<{ bySpecies(species: string, wild?: boolean): readonly number[] }>('08');
      const map = h.readers.map;
      const wagon = h.readers.buildings.get(h.readers.buildings.wagon())!;
      const wx = wagon.origin % map.w;
      const wy = Math.floor(wagon.origin / map.w) % map.h;
      const predatorNear = (): boolean =>
        aggressive.some((name) => animals.bySpecies(name, true).some((id) => {
          const tile = h.host.headless.movement.tileOf(id);
          return Math.max(Math.abs((tile % map.w) - wx), Math.abs((Math.floor(tile / map.w) % map.h) - wy)) <= near;
        }));
      while (h.readers.calendar.tick < target) {
        const before = h.readers.calendar.tick;
        h.step(Math.min(every, target - before));
        const tick = h.readers.calendar.tick;
        if (tick === before) {
          console.log(`[full-year] STALLED at tick ${before}! Dwarves: ${h.dwarves().length}`);
          return 'stalled';
        }
        const day = Math.floor(tick / 1200);
        if (day > tracker.lastLoggedDay && (day >= tracker.lastLoggedDay + 10 || day >= 80)) {
          tracker.lastLoggedDay = day;
          console.log(`[full-year] Day ${day}/112 (tick ${tick}, dwarves: ${h.dwarves().length}, drink: ${h.readers.items.count('drink')}, meal: ${h.readers.items.count('easy_meal')}, food: ${h.readers.items.count('plant_food')})`);
        }
        if (tracker.level === 'hearth') {
          if (tick - tracker.raisedAt >= hold && !predatorNear()) return 'watchful';
        } else if (tracker.attacked && tick >= tracker.noHearthUntil) {
          return 'hearth';
        } else if (predatorNear()) {
          tracker.lastThreatTick = tick;
          if (tracker.level === 'calm') return 'watchful';
        } else if (tracker.level === 'watchful' && tick - tracker.lastThreatTick >= calm) {
          return 'calm';
        }
      }
      return 'done';
    }, { target, every: LOOK_EVERY_TICKS, calm: ALERT_CALM_TICKS, hold: HEARTH_HOLD_TICKS, near: PREDATOR_NEAR_TILES, aggressive: aggressiveSpecies });

    if (outcome === 'done' || outcome === 'stalled') break;
    const level = outcome as 'calm' | 'watchful' | 'hearth';
    await setAlertThroughUi(page, level);
    const read = await page.evaluate(({ level, pause }) => {
      const h = (window as unknown as { __deepholm: FullYearHook }).__deepholm;
      const tracker = (window as unknown as { __tracker: YearTracker }).__tracker;
      const tick = h.readers.calendar.tick;
      tracker.alerts.push({ tick, level });
      if (level === 'hearth') {
        tracker.raisedAt = tick;
        tracker.attacked = false;
      } else if (tracker.level === 'hearth') {
        tracker.noHearthUntil = tick + pause;
      }
      tracker.level = level as YearTracker['level'];
      const alert = h.readers.of<{ alert(): string }>('16').alert();
      console.log(`[full-year] Day ${Math.floor(tick / 1200) + 1}: alert ${level} at tick ${tick}, alert reader says ${alert}`);
      return alert;
    }, { level, pause: HEARTH_PAUSE_TICKS });
    expect(read, 'the military panel set the alert').toBe(level);
  }
  await clock.sync();
}

test('full-year', async ({ page }) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.startsWith('[full-year]')) console.log(text);
  });

  // 1. Boot and generate world e2e-year
  await generateWorld(page, 'e2e-year');
  await expect.poll(() => screenOf(page)).toBe('world_map');

  // 2. Open filter panel on world_map ('f')
  await page.keyboard.press('f');
  await expect.poll(() => textOf(page)).toContain('Serene Vale');

  // Find target region: serene_vale trait or peril-0, temper-0 embarkable region (D-203)
  const targetRegion = await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: FullYearHook }).__deepholm;
    const world = h.readers.world;
    if (world === null) throw new Error('no world reader');
    const regions = world.regions();
    const sv = regions.find((r) => r.traits.includes('serene_vale'));
    if (sv !== undefined) return { id: sv.id, name: sv.name, peril: sv.peril, traits: sv.traits };
    const p0t0 = regions.find((r) => r.peril === 0 && r.temper === 0 && r.biome !== 'ocean' && r.biome !== 'glacier');
    if (p0t0 !== undefined) return { id: p0t0.id, name: p0t0.name, peril: p0t0.peril, traits: p0t0.traits };
    const p0 = regions.find((r) => r.peril === 0 && r.biome !== 'ocean' && r.biome !== 'glacier');
    if (p0 !== undefined) return { id: p0.id, name: p0.name, peril: p0.peril, traits: p0.traits };
    throw new Error('no embarkable peril 0 region found in e2e-year');
  });

  // Close filter panel and move cursor to the region
  await page.keyboard.press('f');
  await moveCursorTo(page, targetRegion.id);
  await expect.poll(() => textOf(page)).toContain('Wealth');

  // 3. Embark Balanced preset
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page)).toBe('embark');
  await page.keyboard.press('p');
  await expect.poll(() => textOf(page)).toContain('Balanced');
  await page.keyboard.press('Enter');
  await expect.poll(() => textOf(page)).toContain('Spent 1,480');
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page), { timeout: 60_000 }).toBe('fortress');

  // 4. The fortress opens paused and stays paused: every UI command below takes effect at once
  //    (U-02) on the tick it is given, and time advances only through the hook's `step`, so
  //    real time cannot change the year (T-221). The frame loop at 4x has a spec of its own,
  //    `frame-loop-day`.
  const opening = await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: FullYearHook }).__deepholm;
    return { speed: h.host.speed(), tick: h.readers.calendar.tick };
  });
  expect(opening.speed, 'the fortress opens paused').toBe(0);
  const clock = playClock(page, opening.tick);

  // 5. Initialize tracking
  await page.evaluate((speciesNames) => {
    const h = (window as unknown as { __deepholm: FullYearHook }).__deepholm;
    const w = h.host.world;
    const tracker: YearTracker = {
      caravanDay: { hillfolk: null, wildwood: null, mountainhome: null },
      waves: [],
      raidDays: [],
      warningDays: [],
      plantedDays: [],
      cavePlantedDays: [],
      frozenDays: [],
      tradesDone: 0,
      harvests: 0,
      wildSpawns: {},
      huntKills: 0,
      huntsCompleted: 0,
      starvingCount: 0,
      deaths: [],
      attacked: false,
      lastThreatTick: 0,
      level: 'calm',
      alerts: [],
      lastLoggedDay: 0,
      raisedAt: 0,
      noHearthUntil: 0,
    };
    (window as unknown as { __tracker: YearTracker }).__tracker = tracker;

    const wagonId = h.readers.buildings.wagon();
    const wagon = h.readers.buildings.get(wagonId);
    const wz = wagon === undefined ? 28 : Math.floor(wagon.origin / (h.readers.map.w * h.readers.map.h));

    const spawnedSpecies = new Map<number, string>();
    w.onEvents((events) => {
      const day = Math.floor(h.readers.calendar.tick / 1200) + 1;
      for (const event of events) {
        if (event.type === 'CaravanArrived' || event.type === 'CaravanWaiting') {
          const civ = String(event['civ'] ?? '');
          if (tracker.caravanDay[civ] === null || tracker.caravanDay[civ] === undefined) {
            tracker.caravanDay[civ] = day;
          }
          console.log(`[full-year] Day ${day}: ${event.type} civ=${civ}`);
        } else if (event.type === 'CaravanAtDepot' || event.type === 'CaravanDeparted') {
          console.log(`[full-year] Day ${day}: ${event.type} civ=${event['civ']}`);
        } else if (event.type === 'ImmigrantsArrived') {
          tracker.waves.push({ day, count: Number(event['count'] ?? 0), guaranteed: event['guaranteed'] === true });
        } else if (event.type === 'RaidArrived') {
          tracker.raidDays.push(day);
        } else if (event.type === 'ThreatWarning') {
          tracker.warningDays.push(day);
        } else if (event.type === 'CropPlanted') {
          const tile = Number(event['tile'] ?? 0);
          const z = Math.floor(tile / (h.readers.map.w * h.readers.map.h));
          (z === wz ? tracker.plantedDays : tracker.cavePlantedDays).push(day);
        } else if (event.type === 'TileFrozen') {
          tracker.frozenDays.push(day);
        } else if (event.type === 'TradeCompleted') {
          tracker.tradesDone += 1;
        } else if (event.type === 'CropHarvested') {
          tracker.harvests += 1;
        } else if (event.type === 'AnimalSpawned') {
          const species = String(event['species']);
          tracker.wildSpawns[species] = (tracker.wildSpawns[species] ?? 0) + 1;
          spawnedSpecies.set(Number(event['id']), species);
        } else if (event.type === 'AttackResolved') {
          // A wild animal's attack on anything that is not wild is the first sign of a threat the log shows.
          const animals = h.readers.of<{ isWild(id: number): boolean }>('08');
          if (animals.isWild(Number(event['attackerId'])) && !animals.isWild(Number(event['defenderId']))) {
            tracker.attacked = true;
            tracker.lastThreatTick = h.readers.calendar.tick;
          }
        } else if (event.type === 'HuntKill') {
          tracker.huntKills += 1;
        } else if (event.type === 'JobCompleted' && event['jobType'] === 'hunt') {
          tracker.huntsCompleted += 1;
        } else if (event.type === 'CreatureDied') {
          console.log(`[full-year] Day ${day}: CreatureDied ${JSON.stringify(event)}`);
          if (event['faction'] === 'fortress' && event['cause'] !== 'slaughter') {
            const killerId = Number(event['killerId'] ?? 0);
            const creatures = h.host.headless.registry.table('creatures');
            const animals = h.readers.of<{ bySpecies(species: string, wild?: boolean): readonly number[]; state(id: number): string }>('08');
            const alive = killerId !== 0 && animals.state(killerId) !== '';
            const killerSpecies = killerId === 0
              ? 'none'
              : (spawnedSpecies.get(killerId) ?? speciesNames.find((name) => animals.bySpecies(name).includes(killerId)) ?? 'unknown');
            tracker.deaths.push({
              day,
              tick: h.readers.calendar.tick,
              kind: event['species'] === creatures.index('dwarf') ? 'dwarf' : creatures.idOf(Number(event['species'])),
              name: String(event['name'] ?? ''),
              cause: String(event['cause'] ?? ''),
              killerId,
              killerSpecies,
              killerState: alive ? animals.state(killerId) : '',
            });
          }
        } else if (event.type === 'Starving') {
          tracker.starvingCount += 1;
          console.log(`[full-year] Day ${day}: Starving ${JSON.stringify(event)}`);
        } else if (event.type === 'ItemCrafted') {
          if (event['recipeId'] === 'brew' || event['recipeId'] === 'cook_easy_meal' || event['recipeId'] === 'make_barrel' || event['recipeId'] === 'make_stone_block') {
            console.log(`[full-year] Day ${day}: Crafted ${event['recipeId']}`);
          }
        }
      }
    });
  }, speciesNames);

  // Locate wagon, stairwell, trees, and free 3x3 patches
  const site = await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: FullYearHook }).__deepholm;
    const map = h.readers.map;
    const bReader = h.readers.buildings;
    const wagon = bReader.get(bReader.wagon())!;
    const wx = wagon.origin % map.w;
    const wy = Math.floor(wagon.origin / map.w) % map.h;
    const wz = Math.floor(wagon.origin / (map.w * map.h));

    let sx = wx + 4;
    let sy = wy - 1;
    for (let dy = -2; dy <= 5; dy += 1) {
      for (let dx = 2; dx <= 6; dx += 1) {
        const px = wx + dx;
        const py = wy + dy;
        // Avoid wagon (0..2, 49..51), stockpile (3..6, 51..54), farm plots (2..9, 44..46)
        if (px >= wx && px <= wx + 2 && py >= wy && py <= wy + 2) continue;
        if (px >= wx + 3 && px <= wx + 6 && py >= wy + 2 && py <= wy + 5) continue;
        if (px >= wx + 2 && px <= wx + 9 && py >= wy - 5 && py <= wy - 3) continue;
        const idx = map.index(px, py, wz);
        if (map.kindAt(idx) === 2 && bReader.zoneAt(idx) === 0) {
          sx = px;
          sy = py;
          break;
        }
      }
      if (sx !== wx + 4 || sy !== wy - 1) break;
    }

    const trees: { x: number; y: number }[] = [];
    for (let dy = -12; dy <= 12; dy += 1) {
      for (let dx = 1; dx <= 30; dx += 1) {
        const px = wx + dx;
        const py = wy + dy;
        if (px >= 0 && px < map.w && py >= 0 && py < map.h) {
          const t = map.index(px, py, wz);
          if (map.kindAt(t) === 8) {
            trees.push({ x: px, y: py });
          }
        }
      }
    }
    trees.sort((a, b) => (a.x - wx) ** 2 + (a.y - wy) ** 2 - ((b.x - wx) ** 2 + (b.y - wy) ** 2));

    const patches: { x: number; y: number }[] = [];
    const used = (px: number, py: number): boolean => {
      if (px <= 14 && py >= 42 && py <= 56) return true;
      for (const p of patches) {
        if (Math.abs(p.x - px) < 4 && Math.abs(p.y - py) < 4) return true;
      }
      return false;
    };

    const u = h.readers.ui;
    for (let y = u.camY + 2; y <= u.camY + 36 && patches.length < 8; y += 1) {
      for (let x = u.camX + 2; x <= u.camX + 38 && patches.length < 8; x += 1) {
        if (used(x, y)) continue;
        let allFloor = true;
        for (let dy = 0; dy < 3 && allFloor; dy += 1) {
          for (let dx = 0; dx < 3 && allFloor; dx += 1) {
            const idx = map.index(x + dx, y + dy, wz);
            if (map.kindAt(idx) !== 2 || bReader.zoneAt(idx) !== 0) allFloor = false;
          }
        }
        if (allFloor) {
          patches.push({ x, y });
        }
      }
    }

    return { wx, wy, wz, sx, sy, trees, patches, u: { camX: u.camX, camY: u.camY } };
  });

  console.log(`[full-year] wx=${site.wx}, wy=${site.wy}, wz=${site.wz}, camX=${site.u.camX}, camY=${site.u.camY}, patches=${site.patches.length}, trees=${site.trees.length}`);

  expect(site.patches.length).toBeGreaterThanOrEqual(6);
  expect(site.trees.length).toBeGreaterThanOrEqual(8);

  // Checkpoint 1 (Days 1–3): Entrance dug, stockpiles placed, still and carpenter built
  // 1. Stockpile on surface near wagon: z, Shift+S, drag, set Everything preset
  await page.keyboard.press('z');
  await page.keyboard.press('Shift+S');
  await dragTiles(page, { x: site.wx + 3, y: site.wy + 2 }, { x: site.wx + 6, y: site.wy + 5 });
  await page.keyboard.press('Escape');
  await clock.advance(1); // a zone's editor opens once system 13 has seen it: one tick, stepped (T-240 removes the need)
  await clickTile(page, site.wx + 3, site.wy + 2);
  await expect.poll(() => textOf(page)).toContain('[S-p] Preset');
  await page.keyboard.press('Shift+P');
  await expect.poll(() => textOf(page)).toContain('Everything');
  await clickText(page, 'Everything');
  await expect.poll(() => textOf(page)).toContain('Preset [Everything');
  await closePanels(page);

  // 2. Surface turnip plot: z, Shift+F, drag, set Spring, Summer, Autumn to turnip
  await page.keyboard.press('z');
  await page.keyboard.press('Shift+F');
  await dragTiles(page, { x: site.wx + 2, y: site.wy - 5 }, { x: site.wx + 5, y: site.wy - 3 });
  await page.keyboard.press('Escape');
  await clock.advance(1); // a zone's editor opens once system 13 has seen it: one tick, stepped (T-240 removes the need)
  await clickTile(page, site.wx + 2, site.wy - 5);
  await expect.poll(() => textOf(page)).toContain('Selected: Farm plot');
  for (const season of ['Spring', 'Summer', 'Autumn']) {
    const row = await textCell(page, season, 9);
    await page.mouse.click(row.x, row.y);
    const turnip = await textCell(page, '  turnip');
    await page.mouse.click(turnip.x, turnip.y);
  }
  await closePanels(page);

  // 3. Surface barley plot: z, Shift+F, drag, set Spring, Summer to barley
  await page.keyboard.press('z');
  await page.keyboard.press('Shift+F');
  await dragTiles(page, { x: site.wx + 6, y: site.wy - 5 }, { x: site.wx + 9, y: site.wy - 3 });
  await page.keyboard.press('Escape');
  await clock.advance(1); // a zone's editor opens once system 13 has seen it: one tick, stepped (T-240 removes the need)
  await clickTile(page, site.wx + 6, site.wy - 5);
  await expect.poll(() => textOf(page)).toContain('Selected: Farm plot');
  for (const season of ['Spring', 'Summer']) {
    const row = await textCell(page, season, 9);
    await page.mouse.click(row.x, row.y);
    const barley = await textCell(page, '  barley');
    await page.mouse.click(barley.x, barley.y);
  }
  await closePanels(page);

  // 4. Entrance stairwell: d, w, click, down 6 levels, click, back up
  await page.keyboard.press('d');
  await page.keyboard.press('w');
  await clickTile(page, site.sx, site.sy);
  for (let i = 0; i < 6; i += 1) await page.keyboard.press('<');
  await clickTile(page, site.sx, site.sy);
  await closePanels(page);
  for (let i = 0; i < 6; i += 1) await page.keyboard.press('>');

  // 5. Dig cave room on wz - 2 (8x4 = 32 tiles for cave farm) and stone hall on wz - 3 (5x5 = 25 tiles)
  for (let i = 0; i < 2; i += 1) await page.keyboard.press('<');
  await page.keyboard.press('d');
  await dragTiles(page, { x: site.sx + 1, y: site.sy }, { x: site.sx + 8, y: site.sy + 3 });
  await closePanels(page);

  await page.keyboard.press('<');
  await page.keyboard.press('d');
  await dragTiles(page, { x: site.sx + 1, y: site.sy }, { x: site.sx + 5, y: site.sy + 4 });
  await closePanels(page);

  for (let i = 0; i < 3; i += 1) await page.keyboard.press('>');

  // 6. Surface trees chop: d, Shift+T, designate 10 nearby trees for carpentry and construction
  await page.keyboard.press('d');
  await page.keyboard.press('Shift+T');
  for (const t of site.trees.slice(0, 10)) {
    await dragTiles(page, { x: t.x, y: t.y }, { x: t.x, y: t.y });
  }
  // Clear tree barrier at x: 0..3, y: 16..20 so caravan edge path is open
  // With a tool armed the arrows move the cursor, so the tool is dropped (Esc) to pan the view and chosen again.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Shift+ArrowUp');
  await page.keyboard.press('Shift+ArrowUp');
  await page.keyboard.press('Shift+T');
  await dragTiles(page, { x: 0, y: 16 }, { x: 3, y: 20 });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Shift+ArrowDown');
  await page.keyboard.press('Shift+ArrowDown');
  await page.keyboard.press('Shift+T');
  // Clear trees around trade depot patch to prevent wildfires spreading to depot
  await dragTiles(page, { x: site.patches[5]!.x - 2, y: site.patches[5]!.y - 2 }, { x: site.patches[5]!.x + 4, y: site.patches[5]!.y + 4 });
  await closePanels(page);

  // 7. Workshops on surface: carpenter, mason, still
  await placeBuilding(page, 'w', "Carpenter's workshop", site.patches[0]!.x + 1, site.patches[0]!.y + 1);
  await placeBuilding(page, 'w', "Mason's workshop", site.patches[1]!.x + 1, site.patches[1]!.y + 1);
  await placeBuilding(page, 'w', 'Still', site.patches[2]!.x + 1, site.patches[2]!.y + 1);

  // 8. Global work orders: barrel maintain 20, blocks once 4, brew drink maintain 100
  await addWorkOrder(page, 'barrel', 'carpenter', 'maintain', 20);
  await addWorkOrder(page, 'blocks', 'mason', 'once', 4);
  await addWorkOrder(page, 'brewdrink', 'still', 'maintain', 100);

  await clock.expectPaused();
  await clock.advanceTo(3 * 1200); // Day 3

  // Screenshot 1: full-year-spring
  const shot1 = await page.evaluate(() => (window as unknown as { __deepholm: FullYearHook }).__deepholm.screenshotName('full-year-spring'));
  await page.screenshot({ path: shot1 });

  // Checkpoint 2 (Days 4–10): First bedrooms, dining hall, hearth, kitchen
  // 1. Place hearth (1x1) and kitchen (3x3)
  await placeBuilding(page, 'Shift+S', 'Hearth', site.patches[3]!.x, site.patches[3]!.y);
  await placeBuilding(page, 'w', 'Kitchen', site.patches[4]!.x + 1, site.patches[4]!.y + 1);

  // 2. Kitchen work order: Easy meal maintain 60
  await addWorkOrder(page, 'easymeal', 'kitchen', 'maintain', 60);

  // 3. Meeting area (dining hall) and bedroom zones on surface near workshops
  await page.keyboard.press('z');
  await page.keyboard.press('Shift+M');
  await dragTiles(page, { x: site.patches[6]!.x, y: site.patches[6]!.y }, { x: site.patches[6]!.x + 2, y: site.patches[6]!.y + 2 });
  await closePanels(page);

  await page.keyboard.press('z');
  await page.keyboard.press('Shift+B');
  await dragTiles(page, { x: site.patches[7]!.x, y: site.patches[7]!.y }, { x: site.patches[7]!.x + 2, y: site.patches[7]!.y + 2 });
  await closePanels(page);

  // 4. A squad of three, for the wildlife (T-221): military panel, `+` makes it, `[S-a]` opens the
  //    member list, `Space` marks the first three rows, `Enter` adds them. It stays off duty until
  //    an alert, as a squad does (16 § Squads).
  await closePanels(page);
  await page.keyboard.press('m');
  await expect.poll(() => textOf(page)).toContain('Military');
  await page.keyboard.press('+');
  await clock.advance(1);
  await page.keyboard.press('Shift+A');
  for (let row = 0; row < 3; row += 1) {
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowDown');
  }
  await page.keyboard.press('Enter');
  await clock.advance(1);
  await closePanels(page);
  const squad = await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: FullYearHook }).__deepholm;
    return h.readers.of<{ squads(): { name: string; mode: string; members: number[] }[] }>('16').squads().map((sq) => ({ name: sq.name, mode: sq.mode, members: sq.members.length }));
  });
  console.log(`[full-year] squads: ${JSON.stringify(squad)}`);
  expect(squad, 'one squad of three, off duty').toEqual([{ name: expect.any(String), mode: 'off', members: 3 }]);

  await clock.expectPaused();
  await clock.advanceTo(10 * 1200); // Day 10

  // Checkpoint 3 (Days 10–20): Cave farm, trade depot, anvil request
  // 1. Cave farm plot on wz - 2: dug soil tiles planted with dimcap for all 4 seasons
  for (let i = 0; i < 2; i += 1) await page.keyboard.press('<');
  await page.keyboard.press('z');
  await page.keyboard.press('Shift+F');
  await dragTiles(page, { x: site.sx + 1, y: site.sy }, { x: site.sx + 8, y: site.sy + 3 });
  await page.keyboard.press('Escape');
  await clock.advance(1); // a zone's editor opens once system 13 has seen it: one tick, stepped (T-240 removes the need)
  await clickTile(page, site.sx + 1, site.sy);
  await expect.poll(() => textOf(page)).toContain('Selected: Farm plot');
  for (const season of ['Spring', 'Summer', 'Autumn', 'Winter']) {
    const row = await textCell(page, season, 9);
    await page.mouse.click(row.x, row.y);
    const dimcap = await textCell(page, '  dimcap');
    await page.mouse.click(dimcap.x, dimcap.y);
  }
  await closePanels(page);
  for (let i = 0; i < 2; i += 1) await page.keyboard.press('>');

  // 2. Trade depot (3x3)
  await placeBuilding(page, 'Shift+S', 'Trade depot', site.patches[5]!.x + 1, site.patches[5]!.y + 1);

  // 3. Request anvil from Mountainhome
  await page.keyboard.press('c');
  await expect.poll(() => textOf(page)).toContain('Mountainhome');
  await page.keyboard.press('+');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await closePanels(page);

  await clock.expectPaused();
  await clock.advanceTo(20 * 1200); // Day 20

  // Screenshot 2: full-year-summer
  const shot2 = await page.evaluate(() => (window as unknown as { __deepholm: FullYearHook }).__deepholm.screenshotName('full-year-summer'));
  await page.screenshot({ path: shot2 });

  // Advance through summer and autumn to Day 84, answering the wildlife as a player would
  await playTo(page, clock, 84 * 1200);

  // Screenshot 3: full-year-end
  const shot3 = await page.evaluate(() => (window as unknown as { __deepholm: FullYearHook }).__deepholm.screenshotName('full-year-end'));
  await page.screenshot({ path: shot3 });

  // Advance through winter to Year 2 (Day 112)
  await playTo(page, clock, 112 * 1200);

  // Collect results and statistics
  const results = await page.evaluate(() => {
    const h = (window as unknown as { __deepholm: FullYearHook }).__deepholm;
    const tracker = (window as unknown as { __tracker: YearTracker }).__tracker;
    const items = h.readers.items;
    const trade = h.host.world.scheduler.byId('20') as unknown as { serialize(): { schedule: Record<string, { nextArrivalTick: number }> } };
    const mountainhomeNext = trade.serialize().schedule['mountainhome']?.nextArrivalTick ?? 0;
    const nextDay = Math.floor(mountainhomeNext / 1200) + 1;
    const livingDwarves = h.dwarves();

    return {
      tracker,
      wealth: items.wealth(),
      harvests: tracker.harvests,
      nextDay,
      livingCount: livingDwarves.length,
      hash: h.hash(),
      wildAtEnd: h.readers.of<{ wildList(): readonly number[] }>('08').wildList().length,
      stocks: {
        drink: items.count('drink'),
        meal: items.count('easy_meal') + items.count('fine_meal') + items.count('lavish_meal'),
        plantFood: items.count('plant_food'),
        log: items.count('log'),
        stoneBlock: items.count('stone_block'),
      },
    };
  });

  const { tracker, wealth, harvests, nextDay, livingCount, stocks, hash } = results;

  const windowOf = (civ: string, year: number): [number, number] => {
    const base = (year - 1) * DAYS_PER_YEAR + (CARAVAN_SEASON[civ] ?? 0) * DAYS_PER_SEASON;
    return [base + CARAVAN_DAY_MIN, base + CARAVAN_DAY_MAX];
  };

  const seasonOfDay = (day: number): number => Math.floor(((day - 1) % DAYS_PER_YEAR) / DAYS_PER_SEASON);

  // Construct and report the year-one expectation balance table
  const table = [
    { day: '28 Summer: Hillfolk caravan', measured: `day ${tracker.caravanDay['hillfolk'] ?? 'never'}` },
    { day: '28 first immigrants (2-4)', measured: tracker.waves[0] === undefined ? 'never' : `day ${tracker.waves[0].day}, ${tracker.waves[0].count} dwarves` },
    { day: '56 Autumn: Wildwood caravan', measured: `day ${tracker.caravanDay['wildwood'] ?? 'never'}` },
    { day: '56 second guaranteed wave', measured: tracker.waves[1] === undefined ? 'never' : `day ${tracker.waves[1].day}, ${tracker.waves[1].count} dwarves` },
    { day: '56 first ambush or raid warning at peril >= 2', measured: `peril 0 region: ${tracker.raidDays.length} raids, ${tracker.warningDays.length} warnings` },
    { day: '84 Winter: surface farm dormant', measured: `${tracker.plantedDays.filter((d) => seasonOfDay(d) === 3).length} surface crops planted in winter` },
    { day: '84 cave farm carries', measured: `${tracker.cavePlantedDays.filter((d) => seasonOfDay(d) === 3).length} cave crops planted in winter, ${tracker.cavePlantedDays.length} all year` },
    { day: '84 river frozen at temper >= 1', measured: `temper 0 region: ${tracker.frozenDays.length} tiles frozen` },
    { day: '112 Year 2: Mountainhome caravan', measured: `scheduled day ${nextDay}` },
    { day: '112 the fortress is 11-15 dwarves', measured: `${livingCount} dwarves` },
    { day: 'Wealth curve: year 1 is 4,000-8,000 marks', measured: `${wealth} marks` },
    { day: 'Food chain: 0.25 plants per farm tile per day', measured: `${harvests} harvests over ${DAYS_PER_YEAR} days` },
  ];

  console.log(['full-year balance table:', ...table.map((row) => `  ${row.day} -> ${row.measured}`)].join('\n'));
  console.log(`full-year end state: ${JSON.stringify({ livingCount, wealth, stocks, waves: tracker.waves, caravanDay: tracker.caravanDay, trades: tracker.tradesDone, starving: tracker.starvingCount, alerts: tracker.alerts, deaths: tracker.deaths, hash })}`);

  console.log(`T-192 full-year wildlife: ${JSON.stringify({ spawns: tracker.wildSpawns, liveAtEnd: results.wildAtEnd, huntsCompleted: tracker.huntsCompleted, huntKills: tracker.huntKills })}`);

  // Assert rule-based rows (matching year_one.scenario.ts precedent)
  const hillfolk = windowOf('hillfolk', 1);
  expect(tracker.caravanDay['hillfolk'], 'Hillfolk caravan arrived in summer of year 1').not.toBeNull();
  expect(tracker.caravanDay['hillfolk'] as number).toBeGreaterThanOrEqual(hillfolk[0]);
  expect(tracker.caravanDay['hillfolk'] as number).toBeLessThanOrEqual(hillfolk[1]);

  const wildwood = windowOf('wildwood', 1);
  expect(tracker.caravanDay['wildwood'], 'Wildwood caravan arrived in autumn of year 1').not.toBeNull();
  expect(tracker.caravanDay['wildwood'] as number).toBeGreaterThanOrEqual(wildwood[0]);
  expect(tracker.caravanDay['wildwood'] as number).toBeLessThanOrEqual(wildwood[1]);

  // No caravan in winter
  for (const [civ, day] of Object.entries(tracker.caravanDay)) {
    if (day !== null) {
      expect(seasonOfDay(day), `${civ} did not arrive in winter`).not.toBe(3);
    }
  }

  // Mountainhome caravan scheduled in year 2 spring
  expect(tracker.caravanDay['mountainhome'], 'Mountainhome caravan does not arrive in year 1').toBeNull();
  const spring2 = windowOf('mountainhome', 2);
  expect(nextDay).toBeGreaterThanOrEqual(spring2[0]);
  expect(nextDay).toBeLessThanOrEqual(spring2[1]);

  // Two guaranteed immigration waves in year 1
  const guaranteed = tracker.waves.filter((wave) => wave.guaranteed);
  expect(guaranteed.length, 'at least two guaranteed immigration waves in year 1').toBeGreaterThanOrEqual(2);
  for (const wave of guaranteed.slice(0, 2)) {
    expect(wave.count).toBeGreaterThanOrEqual(GUARANTEED_SIZE_MIN);
    expect(wave.count).toBeLessThanOrEqual(GUARANTEED_SIZE_MAX);
  }
  expect(seasonOfDay(guaranteed[0]?.day ?? 0), 'first guaranteed wave arrives in summer').toBe(1);
  expect(seasonOfDay(guaranteed[1]?.day ?? 0), 'second guaranteed wave arrives in autumn').toBe(2);

  // Peril 0 region: zero raids
  expect(tracker.raidDays, 'no raids in peril 0 region').toEqual([]);

  // Survival (T-221): nobody starves or dies of thirst, every death is printed with its cause, its
  // day and its killer's species, and the hall ends the year with the dwarves it should have.
  const deathLines = tracker.deaths.map((d) => `  day ${d.day} (tick ${d.tick}): ${d.kind} ${d.name} died of ${d.cause}${d.killerId === 0 ? '' : `, killed by a ${d.killerSpecies}${d.killerState === '' ? '' : ` (${d.killerState})`}`}`);
  console.log([`full-year deaths: ${tracker.deaths.length}`, ...deathLines].join('\n'));
  expect(tracker.deaths.filter((d) => ['starvation', 'dehydration', 'thirst', 'hunger'].includes(d.cause)), 'no dwarf died of hunger or thirst').toEqual([]);
  // What this one year can and cannot assert (orchestrator's decision, 2026-10-11, T-136).
  // The year is deterministic, but it is ONE year, and it is chaotic: any change to where a dwarf
  // stands on day 60 re-rolls every wolf encounter after it. Three correct fixes in a row (T-134,
  // T-135) moved it from 9 living to 8 to 6 without any of them being at fault. A floor that may
  // only go up therefore blocks correct fixes at random, and a count of Starving events depends on
  // how long this script happens to hold the hearth alert. So the spec asserts what a single year
  // can witness: the fortress is not wiped out, and nobody dies of hunger or thirst. How many
  // dwarves wolves cost a fortress is measured over many seeds by the instrument of T-136, where a
  // median can carry a target; the figures of this year are printed above for the record.
  const FORTRESS_ALIVE_FLOOR = 4;
  expect(livingCount, `the fortress is not wiped out: at least ${FORTRESS_ALIVE_FLOOR} dwarves alive on the last day`).toBeGreaterThanOrEqual(FORTRESS_ALIVE_FLOOR);
  console.log(`full-year Starving events: ${tracker.starvingCount} (not asserted; see T-136)`);

  // Food margin assertions (T-150 decision a)
  const tenDaysFood = livingCount * 0.48 * 10;
  const tenDaysDrink = livingCount * 0.77 * 10;
  expect(stocks.meal + stocks.plantFood, 'at least 10 days of food in stock at year end').toBeGreaterThanOrEqual(tenDaysFood);
  expect(stocks.drink, 'at least 10 days of drink in stock at year end').toBeGreaterThanOrEqual(tenDaysDrink);

  expect(errors).toEqual([]);
});
