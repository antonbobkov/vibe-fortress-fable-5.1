/** 24: the saved milestone journal consumed by the app's legend record. */
import { C } from '@core/components';
import type { GameEvent } from '@core/events';
import type { EventType } from '@core/event-types';
import { BaseSystem, type InitContext, type TickContext } from '@core/system';
import { LEGEND_DECADE_YEAR, LEGEND_FIFTY_POPULATION } from './constants';

export interface LegendStateV1 {
  readonly stateVersion: 1;
  readonly peakPopulation: number;
  readonly seeded: boolean;
  readonly deepestZ: number;
  readonly kills: readonly { readonly name: string; readonly count: number }[];
}

export interface LegendReader {
  peakPopulation(): number;
  deepestZ(): number;
  kills(): readonly { name: string; count: number }[];
}

interface MilestoneRow { readonly id: string; readonly trigger: string; readonly text: string }

/** The `milestones` content rows are the registry; each id is awarded once. */
export class LegendSystem extends BaseSystem<LegendStateV1> {
  readonly id = '24';
  readonly order = 24;
  override readonly subscribes: readonly EventType[] = [
    'HearthLit', 'ItemCrafted', 'CavernBreached', 'DeepsilverMined', 'CreatureDied',
    'RaidEnded', 'BuildingCompleted', 'RoomQualityChanged', 'YearPassed',
    'LegendaryReached', 'ImmigrantsArrived', 'EntitiesMoved', 'StoneSet', 'FirstRunecaster', 'SummonCalled',
  ];
  private peak = 0;
  private seeded = false;
  private deepest = 0;
  private readonly killCounts = new Map<string, number>();
  private registry!: InitContext['registry'];
  private rows: readonly MilestoneRow[] = [];
  private readerRef!: LegendReader;

  override init(ctx: InitContext): void {
    this.deepest = ctx.world.map.d - 1;
    this.registry = ctx.registry;
    this.rows = ctx.registry.table<MilestoneRow>('milestones').ids()
      .map((id) => ctx.registry.table<MilestoneRow>('milestones').byId(id) as MilestoneRow);
    for (const row of this.rows) ctx.register.milestone({ id: row.id, trigger: row.trigger });
    this.readerRef = {
      peakPopulation: () => this.peak,
      deepestZ: () => this.deepest,
      kills: () => Array.from(this.killCounts, ([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    };
  }

  override reader(): LegendReader { return this.readerRef; }

  override tick(ctx: TickContext): void {
    // The embark party is created after system init. Revisit only until it is first present.
    if (this.seeded) return;
    this.seeded = true;
    const population = ctx.world.fortress.populationCached;
    this.peak = Math.max(this.peak, population);
    if (population >= LEGEND_FIFTY_POPULATION) this.award('m_fifty', ctx);
  }

  private award(id: string, ctx: TickContext): void {
    const milestones = ctx.world.fortress.milestones;
    if (!milestones.some((entry) => entry.id === id)) milestones.push({ id, tick: ctx.tick });
  }

  private crafted(event: GameEvent, ctx: TickContext): void {
    const itemId = Number(event['itemId'] ?? 0);
    const item = ctx.world.entities.get(itemId, C.Item);
    if (item === undefined) return;
    const type = this.registry.table<{ id: string; category: string }>('items').byIndex(item.type);
    if (type?.category !== 'bar/metal') return;
    this.award('m_metal', ctx);
    const material = this.registry.table<{ id: string }>('materials').byIndex(item.material);
    if (material?.id === 'steel') this.award('m_steel', ctx);
  }

  override handle(event: GameEvent, ctx: TickContext): void {
    // Dispatch invokes this only for `subscribes`; the full EventType union is wider.
    const type: string = event.type;
    switch (type) {
      case 'HearthLit': this.award('m_hearth', ctx); break;
      case 'ItemCrafted': this.crafted(event, ctx); break;
      case 'CavernBreached': {
        const cavern = Number(event['cavern']);
        if (cavern === 1) this.award('m_cavern1', ctx);
        if (cavern === 2) this.award('m_cavern2', ctx);
        if (cavern === 3) this.award('m_sea', ctx);
        break;
      }
      case 'DeepsilverMined': this.award('m_deepsilver', ctx); break;
      case 'BuildingCompleted': {
        if (event['buildingType'] === 'magma_forge') this.award('m_magma_forge', ctx);
        break;
      }
      case 'RoomQualityChanged': {
        const royal = this.registry.table<{ id: string; tier: number }>('roomTiers').byId('royal');
        if (royal !== undefined && Number(event['tier']) >= royal.tier) this.award('m_royal', ctx);
        break;
      }
      case 'YearPassed': if (Number(event['year']) >= LEGEND_DECADE_YEAR) this.award('m_decade', ctx); break;
      case 'LegendaryReached': this.award('m_legend', ctx); break;
      case 'StoneSet': this.award('m_stone_set', ctx); break;
      case 'FirstRunecaster': this.award('m_runecaster', ctx); break;
      case 'SummonCalled': this.award('m_summon', ctx); break;
      case 'RaidEnded': {
        if (event['outcome'] === 'repelled' || event['outcome'] === 'wiped') this.award('m_raid', ctx);
        break;
      }
      case 'ImmigrantsArrived': {
        const population = ctx.readers.of<{ population(): number }>('10').population();
        this.peak = Math.max(this.peak, population);
        if (population >= LEGEND_FIFTY_POPULATION) this.award('m_fifty', ctx);
        break;
      }
      case 'CreatureDied': {
        const killerId = Number(event['killerId'] ?? 0);
        const killer = ctx.world.entities.get(killerId, C.Creature);
        if (killer?.faction !== 'fortress') break;
        // A summon's kills are the fortress's, but it is no name in the legend (25 § Summons).
        if (ctx.world.entities.get(killerId, C.Summoned) === undefined) {
          const name = killer.name;
          this.killCounts.set(name, (this.killCounts.get(name) ?? 0) + 1);
        }
        const speciesIndex = Number(event['species'] ?? 0);
        const species = this.registry.table<{ id: string }>('creatures').byIndex(speciesIndex)?.id ?? '';
        if (species.startsWith('hollow_')) this.award('m_hollow', ctx);
        if (species === 'magma_wyrm') this.award('m_wyrm', ctx);
        break;
      }
      case 'EntitiesMoved': {
        const moves = event['moves'] as readonly (readonly [number, number, number])[] | undefined;
        if (moves === undefined) break;
        for (const [id, , to] of moves) {
          const creature = ctx.world.entities.get(id, C.Creature);
          if (creature?.faction !== 'fortress') continue;
          this.deepest = Math.min(this.deepest, ctx.world.map.zOf(to));
        }
        break;
      }
      default: break;
    }
  }

  override serialize(): LegendStateV1 {
    return { stateVersion: 1, peakPopulation: this.peak, seeded: this.seeded, deepestZ: this.deepest, kills: this.reader().kills() };
  }

  override deserialize(state: LegendStateV1, ctx: InitContext): void {
    if (!this.readerRef) this.init(ctx);
    this.peak = state.peakPopulation;
    this.seeded = state.seeded ?? true;
    this.deepest = state.deepestZ;
    this.killCounts.clear();
    for (const entry of state.kills) this.killCounts.set(entry.name, entry.count);
  }
}
