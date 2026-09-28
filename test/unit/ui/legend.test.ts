import { describe, expect, it } from 'vitest';
import { HeadlessGame } from '@app/headless';
import { Game } from '@app/game';
import { composeLegend, LegendStore } from '@app/legend';
import { SaveManager } from '@app/save-manager';
import { InProcessHost } from '@app/sim-host';
import { loadContent } from '@content/loader';
import type { GameEvent } from '@core/events';
import { Registrations, type InitContext, type TickContext } from '@core/system';
import { MemoryStorage } from '@platform/storage';
import { LegendSystem } from '@systems/legend';
import { legendLines } from '@ui/screens/legend';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { press } from './ui-fixture';

describe('T-M7-06 milestone registry and fortress legend', () => {
  it('awards all fifteen content milestones from their event fixtures once', () => {
    const registry = loadContent();
    const registrations = new Registrations();
    const system = new LegendSystem();
    system.init({ registry, register: registrations, world: { map: { d: 64 } } } as unknown as InitContext);
    expect(registrations.milestones.map((row) => row.id).sort()).toEqual(registry.table('milestones').ids());
    const milestones: { id: string; tick: number }[] = [];
    const item = { type: registry.table('items').index('bar'), material: registry.table('materials').index('steel') };
    const dwarf = { faction: 'fortress', name: 'Solveig Deephand' };
    const entities = { get: (id: number, component: { name: string }) => component.name === 'Item' && id === 7 ? item : component.name === 'Creature' && id === 9 ? dwarf : undefined };
    const ctx = { tick: 42, registry, world: { fortress: { milestones, populationCached: 50 }, entities, map: { zOf: () => 25 } },
      readers: { of: () => ({ population: () => 50 }) } } as unknown as TickContext;
    const fixtures: readonly [string, GameEvent][] = [
      ['m_hearth', { type: 'HearthLit', id: 1 }],
      ['m_metal', { type: 'ItemCrafted', itemId: 7 }],
      ['m_steel', { type: 'ItemCrafted', itemId: 7 }],
      ['m_cavern1', { type: 'CavernBreached', cavern: 1 }],
      ['m_cavern2', { type: 'CavernBreached', cavern: 2 }],
      ['m_sea', { type: 'CavernBreached', cavern: 3 }],
      ['m_fifty', { type: 'ImmigrantsArrived', count: 3 }],
      ['m_magma_forge', { type: 'BuildingCompleted', buildingType: 'magma_forge' }],
      ['m_deepsilver', { type: 'DeepsilverMined', tile: 3 }],
      ['m_hollow', { type: 'CreatureDied', species: registry.table('creatures').index('hollow_stalker'), killerId: 9 }],
      ['m_wyrm', { type: 'CreatureDied', species: registry.table('creatures').index('magma_wyrm'), killerId: 9 }],
      ['m_raid', { type: 'RaidEnded', outcome: 'repelled' }],
      ['m_royal', { type: 'RoomQualityChanged', tier: 5 }],
      ['m_decade', { type: 'YearPassed', year: 11 }],
      ['m_legend', { type: 'LegendaryReached', id: 9 }],
    ];
    for (const [id, event] of fixtures) {
      system.handle(event, ctx);
      expect(milestones.some((entry) => entry.id === id), id).toBe(true);
      system.handle(event, ctx);
      expect(milestones.filter((entry) => entry.id === id), id).toHaveLength(1);
    }
    expect(milestones).toHaveLength(15);
    system.handle({ type: 'EntitiesMoved', moves: [[9, 32, 25]] }, ctx);
    expect(system.reader().deepestZ()).toBe(25);
    expect(system.reader().kills()).toEqual([{ name: 'Solveig Deephand', count: 4 }]);
  });

  it('composes and stores the cause, dated milestones, and last alert/danger lines', async () => {
    const game = new HeadlessGame({ seed: 'legend-seed', fortressName: 'Coldvein Hold' });
    game.world.fortress.milestones.push({ id: 'm_hearth', tick: 0 });
    const journal = { peakPopulation: () => 41, deepestZ: () => 26, kills: () => [{ name: 'Orm', count: 14 }] };
    const log = Array.from({ length: 60 }, (_, tick) => ({ tick, severity: tick % 3 === 0 ? 'note' as const : 'alert' as const,
      text: `Line ${tick}`, count: 1 }));
    const record = composeLegend(game, null, game.registry, journal, log,
      { kind: 'all_dead', lastName: 'Solveig Deephand', lastCause: 'bled_out' });
    expect(record.cause).toContain('The hall fell silent');
    expect(record.cause).toContain('Solveig Deephand');
    expect(record.milestones).toEqual([{ id: 'm_hearth', date: 'Day 1 of Spring, Year 1', text: 'The hearth was lit.' }]);
    expect(record.lastWords).toHaveLength(40);
    expect(legendLines(record).join('\n')).toContain('Orm slew 14 enemies.');
    const store = new LegendStore(new MemoryStorage());
    await store.write(record);
    expect(await store.read(record.id)).toEqual(record);
    expect(await store.list()).toEqual([record]);
  });

  it('loads a final save view-only and rejects Designate', async () => {
    const host = new InProcessHost();
    await host.newGame({ seed: 'final-save' });
    const blob = await host.save({ kind: 'final' });
    await host.load(blob);
    expect(host.viewOnly).toBe(true);
    const before = host.world.calendar.tick;
    expect(host.submit({ type: 'Designate', kind: 'mine', tiles: [0], priority: 1 })).toBe(false);
    expect(host.world.commands.size).toBe(0);
    host.setSpeed(1);
    host.step(1);
    expect(host.speed()).toBe(0);
    expect(host.world.calendar.tick).toBe(before);
  });

  it('writes a final legend and save when scripted deaths empty the hall', async () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);
    const legends = new LegendStore(storage);
    const game = new Game({ canvas: new MockCanvas(), seed: 'silent-hall', registry: loadContent(),
      createCanvas: mockCanvasFactory(), width: 1280, height: 800, saves, legends });
    await game.start({ embark: 'default' });
    const ids = game.host.readers.of<{ list(): number[] }>('10').list();
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) game.host.world.emit({ type: 'CreatureDied', id, faction: 'fortress',
      species: game.registry.table('creatures').index('dwarf'), name: `Dwarf ${id}`, cause: 'wounds', killerId: 0 });
    game.host.step(1);
    await game.settled();
    expect(game.screen).toBe('legend');
    const record = (await legends.list())[0];
    expect(record?.cause).toContain('The hall fell silent');
    expect(record?.cause).toContain(`Dwarf ${ids[ids.length - 1]}`);
    expect((await saves.list()).some((save) => save.id === record?.id && save.header.kind === 'final')).toBe(true);
    expect(game.host.viewOnly).toBe(true);
  });

  it('keeps the hall on the safe retirement default, then retires on Yes', async () => {
    const storage = new MemoryStorage();
    const legends = new LegendStore(storage);
    const game = new Game({ canvas: new MockCanvas(), seed: 'retire-hall', registry: loadContent(),
      createCanvas: mockCanvasFactory(), width: 1280, height: 800, saves: new SaveManager(storage), legends });
    await game.start({ embark: 'default' });
    game.openGameMenu();
    expect(game.screen).toBe('game_menu');
    game.retireFortress();
    expect(game.screen).toBe('confirm');
    game.handleKey(press('Enter'));
    expect(game.screen).toBe('game_menu');
    expect(game.host.viewOnly).toBe(false);
    game.retireFortress();
    game.handleKey(press('y'));
    await game.settled();
    expect(game.screen).toBe('legend');
    expect((await legends.list())[0]?.cause).toMatch(/^Retired in Year 1 with \d+ dwarves\.$/);
    await game.showMainMenu();
    expect(game.mainMenu().items().find((item) => item.id === 'legends')?.enabled).toBe(true);
    await game.openLegends();
    expect(game.screen).toBe('legend');
  });
});
