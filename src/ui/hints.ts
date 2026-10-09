/** 24 § Hints; ui-keymap-and-screens.md § Hints. Presentation state is saved in the ui section. */
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { GameEvent } from '@core/events';
import type { ReaderSet } from '@core/readers';
import type { Registry } from '@core/registry';
import type { BuildingsReader } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import type { JobsReader } from '@systems/jobs';
import { HAULER_WARNING_MIN_WORKERS, IDLE_HAULER_WARNING } from '@systems/jobs/constants';
import type { WorkshopsReader } from '@systems/workshops';
import type { UiState } from './ui-state';
import type { AnnouncementLog } from './announcements';
import { HINT_CHECK_HOURS } from './constants';

export interface HintRow { readonly id: string; readonly trigger: string; readonly text: string }

export interface HintFacts {
  tick: number; year: number; season: number; day: number;
  stillMissing: boolean; drinkLow: boolean; stockpileMissing: boolean; groundItems: number;
  hearthMissing: boolean; hasDiningHall: boolean; bedrooms: number; containersMissing: boolean;
  fuelBlocked: boolean; hunterReady: boolean; farmRejected: boolean; harvested: boolean;
  bareRoomDays: number; threatWarned: boolean; depotMissing: boolean; seriousWound: boolean;
  immigrationSkipped: boolean; raidEnded: boolean; cageTrapBuilt: boolean; doorBroken: boolean;
  deepsilverFound: boolean; cavernTwoBreached: boolean;
  haulingPressure?: boolean;
}

/** Each row is the predicate stated by its `03-content/ui-keymap-and-screens.md` content trigger. */
export function hintPredicate(id: string, f: HintFacts): boolean {
  switch (id) {
    case 'hint_haulers': return f.haulingPressure === true;
    case 'hint_dig': return f.tick >= 1;
    case 'hint_still': return f.stillMissing && f.drinkLow;
    case 'hint_stockpile': return f.stockpileMissing && f.groundItems > 20;
    case 'hint_winter': return f.year === 1 && f.season === 0 && f.day === 20;
    case 'hint_hearth': return f.hearthMissing && (f.hasDiningHall || f.bedrooms >= 5);
    case 'hint_containers': return f.containersMissing;
    case 'hint_fuel': return f.fuelBlocked;
    case 'hint_hunter': return f.hunterReady;
    case 'hint_farm': return f.farmRejected;
    case 'hint_seeds': return f.harvested;
    case 'hint_room': return f.bareRoomDays >= 3;
    case 'hint_alert': return f.threatWarned;
    case 'hint_depot': return f.year === 1 && f.season === 1 && f.day === 14 && f.depotMissing;
    case 'hint_hospital': return f.seriousWound;
    case 'hint_immigration': return f.immigrationSkipped;
    case 'hint_gate': return f.raidEnded;
    case 'hint_cage': return f.cageTrapBuilt;
    case 'hint_troll': return f.doorBroken;
    case 'hint_deep': return f.deepsilverFound;
    case 'hint_magma': return f.cavernTwoBreached;
    default: return false;
  }
}

/** Whether a workshop's orders wait for fuel: the reader says `missing_input` without naming an input. */
export function fuelShort(readers: ReaderSet, workshopId: number): boolean {
  if (!readers.has('12')) return false;
  const reader = readers.of<WorkshopsReader>('12');
  return reader.ordersOf(workshopId).some((order) => {
    const recipe = reader.recipe(order.recipe);
    return recipe !== undefined && reader.isRunnable(recipe.id, workshopId).reason === 'missing_input';
  });
}

export class HintEngine {
  readonly registered: HintRow[] = [];
  constructor(private readonly registry: Registry, private readonly ui: UiState, private readonly log: AnnouncementLog) {
    for (const id of registry.table<HintRow>('hints').ids()) this.hint(registry.table<HintRow>('hints').byId(id) as HintRow);
  }

  /** 24 § Interfaces: `ui.registerHint(hint)`; content rows register in their authored order. */
  hint(row: HintRow): void {
    if (!this.registered.some((old) => old.id === row.id)) this.registered.push(row);
  }

  show(id: string, tick: number, enabled = true): boolean {
    if (!enabled || this.ui.hintsShown.includes(id)) return false;
    const row = this.registered.find((hint) => hint.id === id);
    if (row === undefined) return false;
    this.log.append('note', `☼ ${row.text}`, tick);
    this.ui.hintsShown.push(id);
    this.ui.hintsShown.sort();
    this.ui.hintPending = this.ui.hintPending.filter((pending) => pending !== id);
    return true;
  }

  onEvents(events: readonly GameEvent[], readers: ReaderSet, enabled = true): void {
    if (!enabled) return;
    for (const event of events) {
      this.mark(event, readers);
      if (event.type === 'DayPassed' && readers.has('11')) {
        const jobs = readers.of<JobsReader>('11');
        if (jobs.wantsHaulingCount() > IDLE_HAULER_WARNING && jobs.workersWithLabor('hauling').length < HAULER_WARNING_MIN_WORKERS) {
          this.show('hint_haulers', readers.calendar.tick);
        }
      }
      if (event.type === 'HourPassed' && readers.calendar.hour % HINT_CHECK_HOURS === 0) this.evaluate(readers);
    }
  }

  private pending(id: string): boolean { return this.ui.hintPending.includes(id); }
  private markId(id: string): void {
    if (!this.ui.hintsShown.includes(id) && !this.pending(id)) this.ui.hintPending.push(id);
  }

  private mark(event: GameEvent, readers: ReaderSet): void {
    const fields = event as Record<string, unknown>;
    if (event.type === 'CropHarvested') this.markId('hint_seeds');
    if (event.type === 'ThreatWarning') this.markId('hint_alert');
    if (event.type === 'ImmigrationSkipped') this.markId('hint_immigration');
    if (event.type === 'RaidEnded') this.markId('hint_gate');
    if (event.type === 'DoorBroken') this.markId('hint_troll');
    if (event.type === 'CavernBreached' && fields['cavern'] === 2) this.markId('hint_magma');
    if (event.type === 'VeinFound' && typeof fields['material'] === 'string' &&
      this.registry.table<{ id: string; deepsilver?: boolean }>('minerals').byId(fields['material'])?.deepsilver === true) this.markId('hint_deep');
    if (event.type === 'BuildingCompleted' && fields['buildingType'] === 'cage_trap') this.markId('hint_cage');
    if (event.type === 'WoundInflicted' && (fields['severity'] === 'serious' || fields['severity'] === 'grievous')) this.markId('hint_hospital');
    if (event.type === 'CommandRejected') {
      const command = fields['command'] as { type?: string; zoneType?: string } | undefined;
      if (command?.type === 'CreateZone' && command.zoneType === 'farm_plot') this.markId('hint_farm');
    }
    if (event.type === 'WorkshopBlocked' && readers.has('14')) {
      const id = Number(fields['workshopId']);
      // 12 reports a fuel shortage as `missing_input` (only an input names itself, "waiting for
      // <input>"), so the reader's runnable check of the orders tells fuel apart (Q12).
      const fuel = fields['reason'] === 'no_fuel' || (fields['reason'] === 'missing_input' && fuelShort(readers, id));
      const type = readers.of<BuildingsReader>('14').get(id)?.typeId;
      if (fuel && (type === 'smelter' || type === 'forge')) this.markId('hint_fuel');
    }
  }

  private evaluate(readers: ReaderSet): void {
    const f = this.facts(readers);
    for (const row of this.registered) if (hintPredicate(row.id, f)) this.show(row.id, readers.calendar.tick);
  }

  private facts(readers: ReaderSet): HintFacts {
    const cal = readers.calendar;
    const buildings = readers.has('14') ? readers.of<BuildingsReader>('14') : null;
    const items = readers.has('13') ? readers.of<ItemsReader>('13') : null;
    const zones = (type: string): number[] => buildings?.zonesOfType(type) ?? [];
    const byType = (type: string): number[] => buildings?.byType(type) ?? [];
    const stockpiles = zones('stockpile');
    const containersMissing = stockpiles.some((id) => {
      const pile = items?.stockpile(id);
      const tiles = buildings?.zone(id)?.tiles ?? [];
      const has = (cls: string): boolean => tiles.some((tile) => items?.at(tile).some((item) => items.containerRecord(item)?.classId === cls));
      const categories = pile?.filter.categories ?? [];
      return (categories.some((c) => c === 'drink' || c.startsWith('drink/')) && !has('barrel')) ||
        (categories.some((c) => c === 'seed' || c.startsWith('seed/')) && !has('bag'));
    });
    const bare = new Map(this.ui.hintBareSince);
    for (const id of zones('bedroom')) {
      if (buildings?.room(id)?.tier === 0) { if (!bare.has(id)) bare.set(id, cal.tick); }
      else bare.delete(id);
    }
    for (const id of Array.from(bare.keys())) if (!zones('bedroom').includes(id)) bare.delete(id);
    this.ui.hintBareSince = Array.from(bare).sort((a, b) => a[0] - b[0]);
    const bareRoomDays = Math.max(0, ...Array.from(bare.values(), (since) => (cal.tick - since) / TICKS_PER_DAY));
    const hunting = this.registry.table('labors').has('hunting') ? this.registry.table('labors').index('hunting') : 0;
    const hunterLabor = hunting > 0 && readers.entities.with(C.Labors).some((id) => (readers.entities.get(id, C.Labors)?.enabled[hunting] ?? 0) !== 0);
    return {
      tick: cal.tick, year: cal.year, season: cal.season, day: cal.dayOfSeason,
      stillMissing: byType('still').length === 0, drinkLow: (items?.count('drink') ?? 0) < 40,
      stockpileMissing: stockpiles.length === 0, groundItems: readers.entities.with(C.Item, C.Position).length,
      hearthMissing: (buildings?.hearth() ?? 0) === 0, hasDiningHall: zones('dining_hall').length > 0,
      bedrooms: zones('bedroom').length, containersMissing,
      fuelBlocked: this.pending('hint_fuel'), hunterReady: hunterLabor && (items?.count('bow') ?? 0) + (items?.count('crossbow') ?? 0) === 0,
      farmRejected: this.pending('hint_farm'), harvested: this.pending('hint_seeds'), bareRoomDays,
      threatWarned: this.pending('hint_alert'), depotMissing: (buildings?.depots().length ?? 0) === 0,
      seriousWound: this.pending('hint_hospital') && zones('hospital').length === 0,
      immigrationSkipped: this.pending('hint_immigration'), raidEnded: this.pending('hint_gate'),
      cageTrapBuilt: this.pending('hint_cage'), doorBroken: this.pending('hint_troll'),
      deepsilverFound: this.pending('hint_deep'), cavernTwoBreached: this.pending('hint_magma'),
    };
  }
}
