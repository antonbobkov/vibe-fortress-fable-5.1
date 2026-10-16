/**
 * T-283: what the saved reference fortress contains. The performance tier times this fixture, so a check lists what it
 * holds: the workshops and their standing orders, the farm plots and their crops and seeds, the squads and their
 * barracks, the hospital, the depot, the gate, the stockpiles and the labors.
 */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_YEAR } from '@core/constants';
import type { BuildingRow, BuildingsReader } from '@systems/buildings';
import type { CombatReader } from '@systems/combat';
import { STOCKPILE_PRESETS, type ItemsReader } from '@systems/items';
import type { JobsReader } from '@systems/jobs';
import type { PlantsReader } from '@systems/plants';
import type { WorkshopsReader } from '@systems/workshops';
import { stockpilePreset } from '@ui/messages';
import { ensureScriptedReference, REFERENCE_SHAPE } from './scripted-reference';

describe('T-283 the reference fortress is a fortress', () => {
  it('holds the workshops, farms, squads, hospital, depot, gate, stockpiles and labors of a mature settlement', async () => {
    const game = await ensureScriptedReference(() => performance.now());
    const readers = game.world.readers;
    const registry = game.registry;
    const entities = game.world.entities;
    const buildings = readers.of<BuildingsReader>('14');
    const workshops = readers.of<WorkshopsReader>('12');
    const items = readers.of<ItemsReader>('13');
    const plants = readers.of<PlantsReader>('07');
    const combat = readers.of<CombatReader>('16');
    const jobs = readers.of<JobsReader>('11');
    const built = (type: string): number[] => buildings.byType(type).filter((id) => buildings.get(id)?.state === 'built');
    const report: Record<string, unknown> = {};

    // The same load as the first fixture: year three, 80 dwarves, the animals, the items, the buildings and the zones.
    expect(game.tick).toBeGreaterThanOrEqual(2 * TICKS_PER_YEAR);
    const dwarves = entities.with(C.Brain).filter((id) => entities.get(id, C.Creature)?.faction === 'fortress');
    expect(dwarves).toHaveLength(REFERENCE_SHAPE.dwarves);
    expect(entities.with(C.Tame).length + entities.with(C.Wild).length).toBeGreaterThanOrEqual(120);
    expect(entities.with(C.Item).length).toBeGreaterThanOrEqual(25_000);
    expect(entities.with(C.Building).length).toBeGreaterThanOrEqual(600);
    expect(entities.with(C.Zone).length).toBeGreaterThanOrEqual(60);

    // One of each workshop that has recipes, and twelve of them with a standing order.
    const rows = registry.table<BuildingRow>('buildings').rows.filter((b) => b.category === 'workshop' && !b.tags.includes('magma') && workshops.recipesFor(b.id).length > 0);
    expect(rows.length).toBeGreaterThanOrEqual(15);
    for (const row of rows) expect(built(row.id).length, row.id).toBeGreaterThanOrEqual(1);
    const withOrders = rows.filter((row) => built(row.id).some((id) => workshops.ordersOf(id).some((o) => o.mode === 'maintain')));
    expect(withOrders.length).toBeGreaterThanOrEqual(REFERENCE_SHAPE.twelveOrders);
    report['workshops'] = rows.length;
    report['workshopsWithOrders'] = withOrders.length;

    // Six farm plots (two on the surface, four in dark rooms), a crop for every season that has one, and seeds for each.
    const plots = buildings.zonesOfType('farm_plot');
    expect(plots).toHaveLength(REFERENCE_SHAPE.surfacePlots + REFERENCE_SHAPE.cavePlots);
    expect(plots.filter((id) => plants.plotKind(id) === 'surface')).toHaveLength(REFERENCE_SHAPE.surfacePlots);
    expect(plots.filter((id) => plants.plotKind(id) === 'cave')).toHaveLength(REFERENCE_SHAPE.cavePlots);
    const seedType = registry.table<{ id: string }>('items').index('seed');
    for (const plot of plots) {
      const crops = plants.plotSettings(plot);
      expect(crops.filter((c) => c !== 0).length, `plot ${plot}`).toBeGreaterThanOrEqual(plants.plotKind(plot) === 'cave' ? 4 : 3);
      for (const crop of crops.filter((c) => c !== 0)) {
        const material = registry.table<{ id: string }>('materials').index(registry.table<{ id: string }>('plants').byIndex(crop)?.id ?? '');
        expect(items.countMatching({ type: seedType, materialId: material }), `seeds of plant ${crop}`).toBeGreaterThan(0);
      }
    }

    // Food, drink and a still.
    expect(built('still').length).toBeGreaterThanOrEqual(1);
    expect(items.count('drink')).toBeGreaterThan(0);
    expect(items.count('easy_meal') + items.count('plant_food')).toBeGreaterThan(0);

    // Two squads of six with gear in stock and a barracks each; one on Train.
    const squads = combat.squads();
    expect(squads).toHaveLength(REFERENCE_SHAPE.squads);
    for (const squad of squads) expect(squad.members).toHaveLength(REFERENCE_SHAPE.squadSize);
    expect(squads.filter((s) => s.mode === 'train')).toHaveLength(1);
    const barracks = buildings.zonesOfType('barracks');
    expect(barracks).toHaveLength(REFERENCE_SHAPE.squads);
    expect(new Set(barracks.map((id) => buildings.zone(id)?.settings['squad']))).toEqual(new Set(squads.map((s) => s.id)));
    expect(items.count('spear')).toBeGreaterThanOrEqual(12);
    expect(items.count('mail_shirt')).toBeGreaterThanOrEqual(12);

    // A hospital with beds, a chest and its supplies.
    const hospitals = buildings.zonesOfType('hospital');
    expect(hospitals).toHaveLength(1);
    const hospitalTiles = new Set(buildings.zone(hospitals[0] as number)?.tiles);
    const inHospital = (type: string): number => built(type).filter((id) => (buildings.get(id)?.footprint ?? []).some((t) => hospitalTiles.has(t))).length;
    expect(inHospital('bed')).toBeGreaterThanOrEqual(4);
    expect(inHospital('chest')).toBeGreaterThanOrEqual(1);
    for (const supply of ['cloth', 'thread', 'brightleaf']) expect(items.count(supply), supply).toBeGreaterThan(0);

    // A trade depot; a gate with a door set to lock on alert, a drawbridge on a lever, and four cage traps.
    expect(built('trade_depot')).toHaveLength(1);
    const doors = built('door').filter((id) => buildings.get(id)?.mode === 'lock_on_alert');
    expect(doors.length).toBeGreaterThanOrEqual(1);
    const bridges = built('drawbridge');
    expect(bridges.length).toBeGreaterThanOrEqual(1);
    const levers = built('lever');
    expect(levers.some((lever) => bridges.some((bridge) => buildings.get(lever)?.linkedIds.includes(bridge)))).toBe(true);
    expect(built('cage_trap')).toHaveLength(REFERENCE_SHAPE.cageTraps);

    // Eight stockpiles of at least 5×5 with the presets a played fortress uses.
    const piles = buildings.zonesOfType('stockpile');
    expect(piles.length).toBeGreaterThanOrEqual(REFERENCE_SHAPE.stockpiles);
    for (const pile of piles) expect(buildings.zone(pile)?.tiles.length, `stockpile ${pile}`).toBeGreaterThanOrEqual(REFERENCE_SHAPE.stockpileSide ** 2);
    const presets = piles.map((pile) => { const f = items.stockpile(pile)?.filter; return f === undefined ? null : stockpilePreset(f); });
    for (const preset of ['food', 'drink', 'seeds', 'stone', 'wood', 'furniture']) expect(presets, preset).toContain(preset);
    expect(Object.keys(STOCKPILE_PRESETS)).toContain('weapons_and_armor');
    report['stockpiles'] = piles.length;

    // Labors set by profession template: no dwarf has them all, and the dwarves do not all have the same.
    const labors = registry.table<{ id: string }>('labors').ids();
    const sets = dwarves.map((dwarf) => labors.filter((labor) => jobs.laborEnabled(dwarf, labor)).join(','));
    expect(sets.every((set) => set.split(',').length < labors.length)).toBe(true);
    expect(new Set(sets).size).toBeGreaterThanOrEqual(4);
    report['laborSets'] = new Set(sets).size;
    console.log(`reference_fortress: ${JSON.stringify(report)}`);
  }, 600_000);
});
