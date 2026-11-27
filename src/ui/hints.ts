/** 24 § Hints; ui-keymap-and-screens.md § Hints. Presentation state is saved in the ui section. */
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { GameEvent } from '@core/events';
import { Designation, TileFlag, TileKind } from '@core/map3d';
import type { ReaderSet } from '@core/readers';
import type { Registry } from '@core/registry';
import type { AnimalsReader } from '@systems/animals';
import { HIVE_FLOWERS_MIN } from '@systems/animals/constants';
import type { BuildingsReader } from '@systems/buildings';
import type { CombatReader } from '@systems/combat';
import type { ItemsReader } from '@systems/items';
import type { JobsReader } from '@systems/jobs';
import type { PlantsReader } from '@systems/plants';
import { HAULER_WARNING_MIN_WORKERS, IDLE_HAULER_WARNING } from '@systems/jobs/constants';
import type { WorkshopsReader } from '@systems/workshops';
import type { UiState } from './ui-state';
import type { AnnouncementLog } from './announcements';
import { HINT_ALERT_REPEAT_DAYS, HINT_CHECK_HOURS, HINT_FOOD_DAYS, HINT_FOOD_DAYS_PER_ITEM, QUALITY_HINT_TIER } from './constants';
import { itemName, withArticle } from './messages';
import { raidArrival } from './raid-lines';
import { foodAtHand } from './food-at-hand';
import { starvingShutIn } from './shut-in';

/** The string key the miserable line is filled from (`announce.mood_tier`, `_why`, `_many`, `_many_why`). */
const MISERABLE_KEY = 'announce.mood_tier';

export interface HintRow { readonly id: string; readonly trigger: string; readonly text: string }

export interface HintFacts {
  tick: number; year: number; season: number; day: number;
  stillMissing: boolean; drinkLow: boolean; stockpileMissing: boolean; groundItems: number;
  hearthMissing: boolean; hasDiningHall: boolean; bedrooms: number; containersMissing: boolean;
  fuelBlocked: boolean; barrelBlocked: boolean; hunterReady: boolean; farmRejected: boolean; harvested: boolean;
  bareRoomDays: number; threatWarned: boolean; depotMissing: boolean; seriousWound: boolean;
  immigrationSkipped: boolean; raidEnded: boolean; cageTrapBuilt: boolean; doorBroken: boolean;
  deepsilverFound: boolean; cavernTwoBreached: boolean;
  haulingPressure?: boolean;
  /** The third cavern was breached (the way to deepsilver). */
  cavernThreeBreached?: boolean;
  squadExists?: boolean;
  predatorArrived?: boolean;
  /** A beast that hunts dwarves came while the fortress had no shelter for the Hearth alert. */
  predatorNoShelter?: boolean;
  foodShort?: boolean;
  /** Shown on its `Starving` event with the food at hand (`onEvents`), never by the hourly facts. */
  starving?: boolean;
  /** Shown on the `MoodTierChanged` event that made the fortress's first miserable line (`onEvents`), never by the hourly facts. */
  miserableLine?: boolean;
  noMiners?: boolean;
  noPath?: boolean;
  /** 25 § Player-facing behavior: the runecraft hints, each on stock or buildings. */
  glowcapSeeds?: boolean;
  /** A sanctum zone or a rune circle exists while no glowcap seeds are in stock (`hint_glowcap`). */
  runecraftWithoutSeeds?: boolean;
  /** The first glowcap patch was discovered (`hint_glowcap_patch`). */
  glowcapPatch?: boolean;
  runeforgePlaced?: boolean;
  runeforgeBuilt?: boolean;
  channelInStock?: boolean;
  sanctumExists?: boolean;
  runecasterExists?: boolean;
  draughtInStock?: boolean;
  herbsEaten?: boolean;
  /** 13 § Aging in a cellar: a stockpile with the cellar setting on is not a working cellar. */
  cellarFailing?: boolean;
  /** 14 § Beds: a dwarf slept on the floor while a pallet's materials were in stock. */
  palletMaterials?: boolean;
  /** 14 § The drying rack: the first drying rack was built. */
  rackBuilt?: boolean;
  /** 08 § Hives: a built hive has too few flowers in reach. */
  hiveShort?: boolean;
  /** 14 § Constructions, Glass: the first glass floor was built over open space (a skylight). */
  skylightBuilt?: boolean;
  /** 08 § Cages: the first caged spider was placed in a cage building. */
  spiderRanch?: boolean;
  /** 13 § Rot: the first food item of the fortress turned stale. */
  foodStale?: boolean;
  /** 03 § Caverns: the first cavern was breached. */
  cavernBreached?: boolean;
  /** D-253: a panel's own letter acted where that letter also opens a panel (the screen shows it at once). */
  panelLetterShadowed?: boolean;
  /** Work was ordered while the fortress had not run since it was entered (the screen shows it at once). */
  pausedOrder?: boolean;
  /** 21 § Population cap: the living dwarves of the fortress have reached its cap. */
  populationCapped?: boolean;
  /** `hint_quality`: the first item of fine quality or better was made (shown on its `ItemCrafted`). */
  qualityMade?: boolean;
}

/** Each row is the predicate stated by its `03-content/ui-keymap-and-screens.md` content trigger. */
export function hintPredicate(id: string, f: HintFacts): boolean {
  switch (id) {
    case 'hint_shelter': return f.year === 1 && f.season === 0 && f.day >= 3 && f.squadExists === false;
    case 'hint_predator': return f.predatorArrived === true;
    case 'hint_predator_open': return f.predatorNoShelter === true;
    case 'hint_food': return f.foodShort === true;
    case 'hint_starving': return f.starving === true;
    case 'hint_mood': return f.miserableLine === true;
    case 'hint_no_miners': return f.noMiners === true;
    case 'hint_no_path': return f.noPath === true;
    case 'hint_haulers': return f.haulingPressure === true;
    case 'hint_dig': return f.tick >= 1;
    case 'hint_still': return f.stillMissing && f.drinkLow;
    case 'hint_stockpile': return f.stockpileMissing && f.groundItems > 20;
    case 'hint_winter': return f.year === 1 && f.season === 0 && f.day === 20;
    case 'hint_hearth': return f.hearthMissing && (f.hasDiningHall || f.bedrooms >= 5);
    case 'hint_containers': return f.containersMissing;
    case 'hint_barrel': return f.barrelBlocked;
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
    case 'hint_deep_cavern': return f.cavernThreeBreached === true;
    case 'hint_glowcap': return f.glowcapSeeds === true || f.runecraftWithoutSeeds === true;
    case 'hint_glowcap_patch': return f.glowcapPatch === true;
    case 'hint_runeforge': return f.runeforgePlaced === true;
    case 'hint_staff': return f.runeforgeBuilt === true;
    case 'hint_wand': return f.channelInStock === true;
    case 'hint_sanctum': return f.sanctumExists === true;
    case 'hint_rune_metal': return f.runecasterExists === true;
    case 'hint_draught': return f.draughtInStock === true;
    case 'hint_herbs_eaten': return f.herbsEaten === true;
    case 'hint_cellar': return f.cellarFailing === true;
    case 'hint_pallet': return f.palletMaterials === true;
    case 'hint_rack': return f.rackBuilt === true;
    case 'hint_hive': return f.hiveShort === true;
    case 'hint_skylight': return f.skylightBuilt === true;
    case 'hint_spider_ranch': return f.spiderRanch === true;
    case 'hint_rot': return f.foodStale === true;
    case 'hint_breach': return f.cavernBreached === true;
    case 'hint_panel_letters': return f.panelLetterShadowed === true;
    case 'hint_paused': return f.pausedOrder === true;
    case 'hint_cap': return f.populationCapped === true;
    case 'hint_quality': return f.qualityMade === true;
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

  /** Shows a hint once; `text` replaces the row's text for a hint whose words are made when it shows (`hint_starving`). */
  show(id: string, tick: number, enabled = true, text?: string): boolean {
    if (!enabled || this.ui.hintsShown.includes(id)) return false;
    const row = this.registered.find((hint) => hint.id === id);
    if (row === undefined) return false;
    this.log.append('note', `☼ ${text ?? row.text}`, tick, undefined, 'hint');
    this.ui.hintsShown.push(id);
    this.ui.hintsShown.sort();
    if (id === 'hint_alert') this.ui.hintAlertTick = tick;
    this.ui.hintPending = this.ui.hintPending.filter((pending) => pending !== id);
    return true;
  }

  onEvents(events: readonly GameEvent[], readers: ReaderSet, enabled = true): void {
    for (const event of events) {
      if (event.type === 'JobUnblocked' || event.type === 'JobCompleted' || event.type === 'JobCancelled' || (event.type === 'JobBlocked' && event['reason'] !== 'unreachable')) {
        this.ui.hintUnreachableSince = this.ui.hintUnreachableSince.filter(([id]) => id !== event['jobId']);
      }
    }
    if (!enabled) return;
    for (const event of events) {
      this.mark(event, readers);
      // 24 § Hints: a raid or an ambush at a Calm fortress shows the alert hint again, a season after it last showed.
      if (raidArrival(event as Readonly<Record<string, unknown>>) && readers.has('16') && readers.of<CombatReader>('16').alert() === 'calm') this.showAgain('hint_alert', readers.calendar.tick);
      // The first `Starving` for hunger names the food at hand, after the day's starving line.
      if (event.type === 'Starving' && event['need'] === 'hunger' && !this.ui.hintsShown.includes('hint_starving')) {
        this.show('hint_starving', readers.calendar.tick, true, this.starvingText(readers));
      }
      // The first item of fine quality or better says how quality is made, naming its maker and the item.
      if (event.type === 'ItemCrafted' && Number(event['quality'] ?? 0) >= QUALITY_HINT_TIER && !this.ui.hintsShown.includes('hint_quality')) {
        this.show('hint_quality', readers.calendar.tick, true, this.qualityText(readers, event as Readonly<Record<string, unknown>>));
      }
      // The first miserable line of the fortress says where to read what helps, after it.
      if (event.type === 'MoodTierChanged' && !this.ui.hintsShown.includes('hint_mood') && this.log.lines.some((line) => line.key?.startsWith(MISERABLE_KEY) === true)) {
        this.show('hint_mood', readers.calendar.tick);
      }
      if (event.type === 'DayPassed' && readers.has('11')) {
        const jobs = readers.of<JobsReader>('11');
        if (jobs.wantsHaulingCount() > IDLE_HAULER_WARNING && jobs.workersWithLabor('hauling').length < HAULER_WARNING_MIN_WORKERS) {
          this.show('hint_haulers', readers.calendar.tick);
        }
      }
      if (event.type === 'HourPassed' && readers.calendar.hour % HINT_CHECK_HOURS === 0) this.evaluate(readers);
    }
  }

  /**
   * `hint_alert` again: shown now unless it showed within `HINT_ALERT_REPEAT_DAYS` (the first time
   * too, when no warning came before the raid).
   */
  private showAgain(id: string, tick: number): void {
    const last = this.ui.hintAlertTick;
    if (this.ui.hintsShown.includes(id) && last >= 0 && tick - last < HINT_ALERT_REPEAT_DAYS * TICKS_PER_DAY) return;
    this.ui.hintsShown = this.ui.hintsShown.filter((shown) => shown !== id);
    this.show(id, tick);
  }

  /**
   * `hint_starving`'s words: with food in the stores that some starving dwarf cannot reach, that it is
   * there and how many cannot reach it; else the food at hand now, or the advice for none.
   */
  private starvingText(readers: ReaderSet): string {
    const strings = this.log.strings;
    const shut = starvingShutIn(readers);
    if (shut.length > 0) return strings.get('ui.starving_hint.shut_in', { n: shut.length });
    const food = foodAtHand(readers, this.registry, strings);
    return food.length === 0 ? strings.get('ui.starving_hint.none') : strings.get('hint.hint_starving', { food: food.join('; ') });
  }

  /** `hint_quality`'s words: "Frode Brightward made a fine figurine. Quality comes from skill: …". */
  private qualityText(readers: ReaderSet, event: Readonly<Record<string, unknown>>): string {
    const strings = this.log.strings;
    const dwarf = readers.entities.get(Number(event['crafterId'] ?? 0), C.Creature)?.name ?? '';
    const item = readers.has('13') ? readers.of<ItemsReader>('13').get(Number(event['itemId'] ?? 0)) : undefined;
    const typeId = item === undefined ? '' : this.registry.table<{ id: string }>('items').byIndex(item.type)?.id ?? '';
    const quality = strings.get(`ui.item.quality.${Number(event['quality'] ?? 0)}`);
    const what = withArticle(strings, typeId === '' ? quality : `${quality} ${itemName(this.registry, strings, typeId)}`);
    return strings.get('hint.hint_quality', { dwarf, what });
  }

  private pending(id: string): boolean { return this.ui.hintPending.includes(id); }
  private markId(id: string): void {
    if (!this.ui.hintsShown.includes(id) && !this.pending(id)) this.ui.hintPending.push(id);
  }

  private mark(event: GameEvent, readers: ReaderSet): void {
    const fields = event as Record<string, unknown>;
    if (event.type === 'CropHarvested') this.markId('hint_seeds');
    if (event.type === 'ThreatWarning') this.markId('hint_alert');
    // A beast that hunts dwarves has come (08 § Registrations), or one has wounded a fortress dwarf.
    if (event.type === 'AnimalSpawned' && typeof fields['species'] === 'string') {
      const creatures = this.registry.table<{ id: string }>('creatures');
      if (creatures.has(fields['species']) && readers.has('08') && readers.of<AnimalsReader>('08').isDangerous(fields['species'])) {
        // With no shelter yet the alert would only stop the work (19 § Hearth alert retreat): the hint says a hall comes first.
        this.markId(this.hasShelter(readers) ? 'hint_predator' : 'hint_predator_open');
      }
    }
    if (event.type === 'AttackResolved' && fields['outcome'] === 'hit' && this.animalWoundedDwarf(readers, Number(fields['attackerId']), Number(fields['defenderId']))) this.markId('hint_alert');
    if (event.type === 'ImmigrationSkipped') this.markId('hint_immigration');
    // 25 § Draughts: a raw plant eaten while a draught brewed from plants is ordered (a fun feature: the herbs are food too).
    if (event.type === 'MealEaten' && fields['kind'] === 'raw' && fields['mealType'] === 'plant_food' && this.draughtWantsPlants(readers)) this.markId('hint_herbs_eaten');
    if (event.type === 'RaidEnded') this.markId('hint_gate');
    // 14 § Beds: someone slept on the floor with a pallet's materials (cloth, wool, straw or reeds) in stock.
    if (event.type === 'Slept' && fields['onFloor'] === true && this.palletMaterials(readers)) this.markId('hint_pallet');
    if (event.type === 'DoorBroken') this.markId('hint_troll');
    if (event.type === 'CavernBreached' && fields['cavern'] === 2) this.markId('hint_magma');
    // 03 stage 7: deepsilver lies within two tiles of magma, at z6 and below; the third cavern is the way there.
    if (event.type === 'CavernBreached' && fields['cavern'] === 3) this.markId('hint_deep_cavern');
    if (event.type === 'CavernBreached') this.markId('hint_breach');
    // 25 § Player-facing behavior: the first glowcap patch seen says what it gives.
    if (event.type === 'TilesDiscovered' && Array.isArray(fields['tiles']) && readers.has('07') &&
      (fields['tiles'] as unknown[]).some((tile) => typeof tile === 'number' && readers.of<PlantsReader>('07').speciesAt(tile) === 'glowcap_patch')) this.markId('hint_glowcap_patch');
    // 13 § Rot: stage 1 is stale; a corpse is not food.
    if (event.type === 'ItemRotStage' && fields['stage'] === 1 && this.isFood(readers, Number(fields['id']))) this.markId('hint_rot');
    if (event.type === 'VeinFound' && typeof fields['material'] === 'string' &&
      this.registry.table<{ id: string; deepsilver?: boolean }>('minerals').byId(fields['material'])?.deepsilver === true) this.markId('hint_deep');
    if (event.type === 'BuildingCompleted' && fields['buildingType'] === 'cage_trap') this.markId('hint_cage');
    if (event.type === 'BuildingCompleted' && fields['buildingType'] === 'drying_rack') this.markId('hint_rack');
    if (event.type === 'BuildingCompleted' && fields['buildingType'] === 'floor' && this.skylight(readers, Number(fields['id']))) this.markId('hint_skylight');
    // 08 § Cages: the first caged spider placed in a cage building (a spider ranch).
    if (event.type === 'BuildingCompleted' && this.spiderCaged(readers, Number(fields['id']))) this.markId('hint_spider_ranch');
    // The hospital is for the fortress's own dwarves: a wounded beast or invader does not call for one.
    if (event.type === 'WoundInflicted' && (fields['severity'] === 'serious' || fields['severity'] === 'grievous') && this.fortressDwarf(readers, Number(fields['id']))) this.markId('hint_hospital');
    if (event.type === 'CommandRejected') {
      const command = fields['command'] as { type?: string; zoneType?: string } | undefined;
      if (command?.type === 'CreateZone' && command.zoneType === 'farm_plot') this.markId('hint_farm');
    }
    // 12 names the container class of a wait for an empty container; the hint is about barrels.
    if (event.type === 'WorkshopBlocked' && fields['reason'] === 'no_empty_container' && fields['container'] === 'barrel') this.markId('hint_barrel');
    if (event.type === 'WorkshopBlocked' && readers.has('14')) {
      const id = Number(fields['workshopId']);
      // 12 reports a fuel shortage as `missing_input` (only an input names itself, "waiting for
      // <input>"), so the reader's runnable check of the orders tells fuel apart (Q12).
      const fuel = fields['reason'] === 'no_fuel' || (fields['reason'] === 'missing_input' && fuelShort(readers, id));
      const type = readers.of<BuildingsReader>('14').get(id)?.typeId;
      if (fuel && (type === 'smelter' || type === 'forge')) this.markId('hint_fuel');
    }
  }

  /**
   * Whether the Hearth alert has somewhere to send civilians (19 § Hearth alert retreat): a hearth
   * hall, a built door (a room behind it) or a bedroom.
   */
  private hasShelter(readers: ReaderSet): boolean {
    if (!readers.has('14')) return false;
    const buildings = readers.of<BuildingsReader>('14');
    return buildings.hearthHallTiles().length > 0 || buildings.zonesOfType('bedroom').length > 0 ||
      buildings.byTag('door').some((id) => buildings.get(id)?.state === 'built');
  }

  /** A finished glass floor with a skylit room under it, not a wall: a skylight built over open space (`hint_skylight`). */
  private skylight(readers: ReaderSet, id: number): boolean {
    if (!readers.has('14')) return false;
    const origin = readers.of<BuildingsReader>('14').get(id)?.origin;
    const map = readers.map;
    if (origin === undefined || !map.isGlass(origin)) return false;
    const below = origin - map.w * map.h;
    return below >= 0 && (map.flagsAt(below) & TileFlag.Skylit) !== 0 && map.kindAt(below) !== TileKind.Wall;
  }

  /** Units of a pallet's materials in stock: cloth, wool, straw or reeds (`hint_pallet`). */
  private palletMaterials(readers: ReaderSet): boolean {
    if (!readers.has('13') || !readers.has('14')) return false;
    const b14 = readers.of<BuildingsReader>('14');
    const types = b14.types().filter((row) => row.labor === 'hauling' && row.tags.includes('sleep'))
      .flatMap((row) => row.inputs.flatMap((input) => b14.inputTypes(input.match)));
    const items = readers.of<ItemsReader>('13');
    return types.some((type) => items.available(type) > 0);
  }

  /** A work order stands for a draught recipe (a spoilable one) with a plant among its inputs. */
  private draughtWantsPlants(readers: ReaderSet): boolean {
    if (!readers.has('12')) return false;
    const workshops = readers.of<WorkshopsReader>('12');
    return workshops.allOrders().some(({ order }) => {
      const recipe = workshops.recipe(order.recipe);
      return recipe?.spoilable === true && recipe.inputs.some((input) => input.match === 'plant_food');
    });
  }

  /** Whether a creature is a dwarf of the fortress. */
  /** A built cage building holding a living giant cave spider (`hint_spider_ranch`). */
  private spiderCaged(readers: ReaderSet, id: number): boolean {
    if (!readers.has('14')) return false;
    const b14 = readers.of<BuildingsReader>('14');
    if (b14.get(id)?.state !== 'built') return false;
    const occupant = b14.cageOccupant(id);
    const species = occupant === 0 ? undefined : readers.entities.get(occupant, C.Creature)?.species;
    return species !== undefined && this.registry.table<{ id: string }>('creatures').byIndex(species)?.id === 'giant_cave_spider';
  }

  /** An item of the `food` category (13's category path), read while it is still there. */
  private isFood(readers: ReaderSet, id: number): boolean {
    const item = readers.entities.get(id, C.Item);
    if (item === undefined) return false;
    const category = this.registry.table<{ id: string; category?: string }>('items').byIndex(item.type)?.category ?? '';
    return category === 'food' || category.startsWith('food/');
  }

  private fortressDwarf(readers: ReaderSet, id: number): boolean {
    const creature = readers.entities.get(id, C.Creature);
    return creature !== undefined && creature.faction === 'fortress' && creature.species === this.registry.table('creatures').index('dwarf');
  }

  /** A wild animal's hit on a dwarf of the fortress. */
  private animalWoundedDwarf(readers: ReaderSet, attacker: number, defender: number): boolean {
    const a = readers.entities.get(attacker, C.Creature);
    return a !== undefined && a.faction === 'wild' && this.fortressDwarf(readers, defender);
  }

  private evaluate(readers: ReaderSet): void {
    const f = this.facts(readers);
    for (const row of this.registered) if (hintPredicate(row.id, f)) this.show(row.id, readers.calendar.tick);
  }

  /** True when a living fortress dwarf has the labor's bit set in its `Labors.enabled` bitset. */
  private laborEnabledByDwarf(readers: ReaderSet, labor: number): boolean {
    const dwarf = this.registry.table('creatures').index('dwarf');
    return readers.entities.with(C.Creature, C.Labors).some(id => {
      const creature = readers.entities.get(id, C.Creature);
      return readers.entities.alive(id) && creature?.faction === 'fortress' && creature.species === dwarf &&
        (((readers.entities.get(id, C.Labors)?.enabled[labor >> 3] ?? 0) as number) & (1 << (labor & 7))) !== 0;
    });
  }

  private noMiners(readers: ReaderSet): boolean {
    const enabled = this.laborEnabledByDwarf(readers, this.registry.table('labors').index('mining'));
    if (enabled) return false;
    const map = readers.map;
    for (let i = 0; i < map.w * map.h * map.d; i++) if (map.designationAt(i) === Designation.Dig) return true;
    return false;
  }
  private noPath(readers: ReaderSet): boolean {
    const since = new Map(this.ui.hintUnreachableSince);
    const jobs = readers.has('11') ? readers.of<JobsReader>('11').list() : [];
    this.ui.hintUnreachableSince = jobs.filter(j => j.state === 'blocked' && j.blockedReason === 'unreachable')
      .map((j): [number, number] => [j.id, since.get(j.id) ?? readers.calendar.tick]).sort((a, b) => a[0] - b[0]);
    return this.ui.hintUnreachableSince.some(([, tick]) => readers.calendar.tick - tick >= TICKS_PER_DAY);
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
    const runeforges = byType('runeforge');
    const seed = this.registry.table('items').has('seed') ? this.registry.table('items').index('seed') : -1;
    const glowcap = this.registry.table('materials').has('glowcap') ? this.registry.table('materials').index('glowcap') : -1;
    const hunting = this.registry.table('labors').has('hunting') ? this.registry.table('labors').index('hunting') : 0;
    const hunterLabor = hunting > 0 && this.laborEnabledByDwarf(readers, hunting);
    const glowcapSeeds = items !== null && seed >= 0 && glowcap >= 0 && items.countMatching({ type: seed, materialId: glowcap }) > 0;
    return {
      noMiners: this.noMiners(readers), noPath: this.noPath(readers),
      squadExists: readers.has('16') && readers.of<CombatReader>('16').squads().length > 0,
      predatorArrived: this.pending('hint_predator'),
      predatorNoShelter: this.pending('hint_predator_open'),
      foodShort: readers.has('10') && items !== null &&
        items.countMatching({ edible: true }) < Math.ceil((readers.of<{ population(): number }>('10').population() * HINT_FOOD_DAYS) / HINT_FOOD_DAYS_PER_ITEM),
      tick: cal.tick, year: cal.year, season: cal.season, day: cal.dayOfSeason,
      stillMissing: byType('still').every((id) => buildings?.get(id)?.state === 'ruined'), drinkLow: (items?.count('drink') ?? 0) < 40,
      stockpileMissing: stockpiles.length === 0, groundItems: readers.entities.with(C.Item, C.Position).length,
      hearthMissing: (buildings?.hearth() ?? 0) === 0, hasDiningHall: zones('dining_hall').length > 0,
      bedrooms: zones('bedroom').length, containersMissing,
      fuelBlocked: this.pending('hint_fuel'), barrelBlocked: this.pending('hint_barrel'),
      hunterReady: hunterLabor && (items?.count('bow') ?? 0) + (items?.count('crossbow') ?? 0) === 0,
      farmRejected: this.pending('hint_farm'), harvested: this.pending('hint_seeds'), bareRoomDays,
      threatWarned: this.pending('hint_alert'), depotMissing: (buildings?.depots().length ?? 0) === 0,
      seriousWound: this.pending('hint_hospital') && zones('hospital').length === 0,
      immigrationSkipped: this.pending('hint_immigration'), raidEnded: this.pending('hint_gate'),
      cageTrapBuilt: this.pending('hint_cage'), doorBroken: this.pending('hint_troll'),
      deepsilverFound: this.pending('hint_deep'), cavernTwoBreached: this.pending('hint_magma'),
      cavernThreeBreached: this.pending('hint_deep_cavern'),
      glowcapSeeds,
      runecraftWithoutSeeds: !glowcapSeeds && (zones('sanctum').length > 0 || (buildings?.byTag('rune_circle').length ?? 0) > 0),
      glowcapPatch: this.pending('hint_glowcap_patch'),
      runeforgePlaced: runeforges.length > 0,
      runeforgeBuilt: runeforges.some((id) => buildings?.get(id)?.state === 'built'),
      channelInStock: (items?.count('wand') ?? 0) + (items?.count('staff') ?? 0) > 0,
      sanctumExists: zones('sanctum').length > 0,
      runecasterExists: readers.entities.with(C.Rune).some((id) => readers.entities.get(id, C.Creature)?.faction === 'fortress'),
      draughtInStock: items !== null && items.countMatching({ tag: 'draught' }) > 0,
      herbsEaten: this.pending('hint_herbs_eaten'),
      cellarFailing: stockpiles.some((id) => {
        const pile = items?.stockpile(id);
        return pile?.cellar === true && pile.cellarOk !== true;
      }),
      palletMaterials: this.pending('hint_pallet'),
      rackBuilt: this.pending('hint_rack'),
      spiderRanch: this.pending('hint_spider_ranch'),
      hiveShort: readers.has('08') && readers.of<AnimalsReader>('08').hives()
        .some((id) => readers.of<AnimalsReader>('08').hiveFlowers(id) < HIVE_FLOWERS_MIN),
      skylightBuilt: this.pending('hint_skylight'),
      foodStale: this.pending('hint_rot'),
      cavernBreached: this.pending('hint_breach'),
      panelLetterShadowed: this.pending('hint_panel_letters'),
      pausedOrder: this.pending('hint_paused'),
      populationCapped: readers.has('10') && readers.has('21') &&
        readers.of<{ population(): number }>('10').population() >= readers.of<{ cap(): number }>('21').cap(),
    };
  }
}
