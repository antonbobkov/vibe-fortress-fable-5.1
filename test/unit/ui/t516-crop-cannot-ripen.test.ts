/**
 * T-516: the farm plot panel says when a surface crop sown now cannot ripen before its growing
 * seasons end (the reckoning the three-year script sows by, T-512), and a frost that kills crops is
 * one merged line in the log.
 */
import { describe, expect, it } from 'vitest';
import { Game } from '@app/game';
import { loadContent } from '@content/loader';
import { DAYS_PER_SEASON, DAYS_PER_YEAR, TICKS_PER_DAY } from '@core/constants';
import type { GameEvent } from '@core/events';
import type { BuildingsReader } from '@systems/buildings';
import type { PlantRow } from '@systems/plants';
import { ripeningOutlook } from '@systems/plants/growth';
import { AnnouncementLog } from '@ui/announcements';
import { LOG_DEDUP_TICKS } from '@ui/constants';
import { drawZonesPanel } from '@ui/panels/zones';
import { Strings } from '@ui/strings';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { registry, surface } from './ui-fixture';

const plant = (id: string): PlantRow => registry.table<PlantRow>('plants').byId(id) as PlantRow;

async function plot(seed: string): Promise<{ g: Game; zoneId: number; tiles: number[] }> {
  const g = new Game({ canvas: new MockCanvas(), seed, registry: loadContent(), createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
  await g.start({ embark: 'default' });
  const map = g.host.readers.map;
  const tiles = [map.index(40, 30, g.ui.z), map.index(41, 30, g.ui.z), map.index(42, 30, g.ui.z)];
  g.host.submit({ type: 'CreateZone', zoneType: 'farm_plot', tiles });
  g.host.step(1);
  const zoneId = g.host.readers.of<BuildingsReader>('14').zoneAt(tiles[0] as number);
  g.fortress.zones.selected = zoneId;
  g.ui.panel = 'zones';
  g.ui.sidebar = true;
  return { g, zoneId, tiles };
}

/** Moves the calendar to a day of a season of the current year (the panel reads only the calendar). */
function setDay(g: Game, season: number, dayOfSeason: number): void {
  const yearStart = (g.host.readers.calendar.year - 1) * DAYS_PER_YEAR * TICKS_PER_DAY;
  g.host.world.calendar.setTick(yearStart + (season * DAYS_PER_SEASON + dayOfSeason - 1) * TICKS_PER_DAY + TICKS_PER_DAY / 2);
  expect([g.host.readers.calendar.season, g.host.readers.calendar.dayOfSeason]).toEqual([season, dayOfSeason]);
}

function setCrop(g: Game, zoneId: number, season: number, speciesId: string | 0): void {
  g.host.submit({ type: 'SetPlotCrop', zoneId, season, speciesId });
  g.host.step(1);
}

function panel(g: Game): string {
  const s = surface(36, 40);
  drawZonesPanel(s, { col: 0, row: 0, cols: 36, rows: 40 }, g.fortress.zones, g.fortress.ctx);
  return s.lines().map((line) => line.trim()).join(' ').replace(/ +/g, ' ');
}

describe('T-516 the reckoning', () => {
  it('names the days needed and left at the season edges the T-512 test names', () => {
    expect(ripeningOutlook(plant('strawberry'), 0, 1)).toEqual({ needDays: 28, leftDays: 51, ripens: true });
    expect(ripeningOutlook(plant('strawberry'), 1, 1)).toEqual({ needDays: 28, leftDays: 25, ripens: false });
    expect(ripeningOutlook(plant('turnip'), 1, 28)).toEqual({ needDays: 20, leftDays: 20, ripens: true });
    expect(ripeningOutlook(plant('turnip'), 2, 1)).toEqual({ needDays: 20, leftDays: 17, ripens: false });
    expect(ripeningOutlook(plant('pumpkin'), 1, 14).ripens).toBe(true);
    expect(ripeningOutlook(plant('pumpkin'), 1, 15).ripens).toBe(false);
  });
});

describe('T-516 the farm plot panel says when the chosen crop cannot ripen', () => {
  it('late summer: pumpkin ripens sown on day 14 and not on day 15; turnip still does on day 28', async () => {
    const { g, zoneId } = await plot('t516-summer');
    setCrop(g, zoneId, 1, 'pumpkin');
    setDay(g, 1, 14);
    expect(panel(g)).not.toContain('cannot ripen');
    setDay(g, 1, 15);
    const late = ripeningOutlook(plant('pumpkin'), 1, 15);
    expect(panel(g)).toContain(`Sown now, pumpkin cannot ripen before its seasons end: it needs ${late.needDays} days, ${late.leftDays} are left.`);
    setCrop(g, zoneId, 1, 'turnip');
    setDay(g, 1, 28);
    expect(panel(g)).not.toContain('cannot ripen');
  });

  it('early autumn: no turnip sown in autumn ripens, even on its first day', async () => {
    const { g, zoneId } = await plot('t516-autumn');
    setCrop(g, zoneId, 2, 'turnip');
    setDay(g, 2, 1);
    expect(panel(g)).toContain('Sown now, turnip cannot ripen before its seasons end: it needs 20 days, 17 are left.');
    // In summer the same autumn row is reckoned from autumn's first day.
    setDay(g, 1, 1);
    expect(panel(g)).toContain('Sown in autumn, turnip cannot ripen before its seasons end: it needs 20 days, 17 are left at most.');
    setCrop(g, zoneId, 2, 0);
    expect(panel(g)).not.toContain('cannot ripen');
  });

  it('Shift+A on a spring strawberry gives summer strawberries, and the note says they cannot ripen', async () => {
    const { g, zoneId } = await plot('t516-all');
    setDay(g, 0, 1);
    setCrop(g, zoneId, 0, 'strawberry');
    expect(panel(g)).not.toContain('cannot ripen');
    g.fortress.zones.farmAllSeasons(g.fortress.ctx, 0);
    g.host.step(1);
    const text = panel(g);
    expect(text).toContain('Sown in summer, strawberry cannot ripen before its seasons end: it needs 28 days, 25 are left at most.');
    expect(text).not.toContain('Sown now');
  });
});

describe('T-516 a frost that kills crops is one line per plot and crop', () => {
  it('counts the kills of one frost in one line, starts a new line for a later frost, and leaves other deaths silent', async () => {
    const { g, tiles } = await plot('t516-frost');
    const log = new AnnouncementLog(new Strings(registry), registry);
    log.register(g.host.world.registrations.announcements);
    const died = (tile: number, species: string, reason: string): GameEvent => ({ type: 'CropDied', tile, species, reason }) as unknown as GameEvent;
    const tick = 10 * TICKS_PER_DAY;
    for (let k = 0; k < 12; k += 1) log.announce(died(tiles[k % 3] as number, 'strawberry', 'frost'), g.host.readers, tick + k);
    log.announce(died(tiles[0] as number, 'turnip', 'frost'), g.host.readers, tick + 20);
    expect(log.announce(died(tiles[0] as number, 'strawberry', 'flooded'), g.host.readers, tick + 21)).toBeNull();
    expect(log.lines.map((l) => [l.severity, l.text, l.count])).toEqual([
      ['note', 'Frost killed 12 plants of strawberry on Farm plot #1.', 1],
      ['note', 'Frost killed 1 plant of turnip on Farm plot #1.', 1],
    ]);
    // A frost on a later day is a line of its own.
    log.announce(died(tiles[1] as number, 'strawberry', 'frost'), g.host.readers, tick + TICKS_PER_DAY + LOG_DEDUP_TICKS + 1);
    expect(log.lines.map((l) => l.text).slice(2)).toEqual(['Frost killed 1 plant of strawberry on Farm plot #1.']);
  });
});
