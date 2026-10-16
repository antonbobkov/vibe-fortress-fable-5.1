/** Observational balance telemetry; never consumes a simulation RNG draw or writes world state. */
import { C, ItemFlag, type Item } from '@core/components';
import { DAYS_PER_YEAR, TICKS_PER_DAY } from '@core/constants';
import { SEASON_NAMES } from '@core/calendar';
import { RngStream } from '@core/rng';
import { TileFlag, TileKind } from '@core/map3d';
import type { BuildingsReader } from '@systems/buildings';
import type { DwarvesReader } from '@systems/dwarves';
import { ItemCore, type ItemsReader } from '@systems/items';
import { itemValue } from '@systems/items/value';
import type { MoraleReader } from '@systems/morale/reader';
import type { ThreatsReader } from '@systems/threats/reader';
import { RENOWN_POP_WEIGHT, RENOWN_WEALTH_DIVISOR } from '@systems/threats/constants';
import type { ImmigrationReader } from '@systems/immigration/reader';
import { IMMIGRATION_PERMILLE, REP_PERMILLE_PER_POINT } from '@systems/immigration/constants';
import type { GameEvent } from '@core/events';
import type { GameSystem, TickContext } from '@core/system';
import type { ImmigrationStateV1 } from '@systems/immigration';
import { appendFileSync } from 'node:fs';
import type { TestWorld } from './test-world';

/** Days between two progress lines of a long run. */
const PROGRESS_DAYS = 28;

/**
 * One line of a long run's journal: to the console, and at once to the file named by
 * `THREE_YEARS_LOG` when it is set (vitest holds console output until the test ends).
 */
/** The seed of the run being journalled, for a file that several runs share. */
let journalSeed = '';

export function note(tag: string, data: unknown): void {
  const line = `[${tag}]${journalSeed ? ` ${journalSeed}` : ''} ${JSON.stringify(data)}`;
  console.log(line);
  const file = process.env['THREE_YEARS_LOG'];
  if (file) appendFileSync(file, `${line}
`);
}

export interface ImmigrationEvaluation {
  tick: number;
  trigger: 'SeasonChanged' | 'DayPassed';
  waveSize: number | null;
  year: number;
  season: string;
  population: number;
  wealth: number;
  spirit: number;
  wavesSoFar: number;
  eligible: boolean;
  reasons: string[];
  guaranteed: boolean;
  roll: number | null;
  probability: number;
  outcome: string;
}

export interface WealthSnapshot {
  day: number;
  wealth: number;
  population: number;
  meanEndurance: number;
  renown: number;
  fortressCreatures: number;
  renownWealthEquivalent: number;
  spirit: number;
  marks: Record<string, number>;
  counts: Record<string, number>;
  recipes: Record<string, number>;
  qualities: Record<string, number>;
  craftQualities: Record<string, number>;
  craftQualityValueDelta: number;
  skillMaxima: Record<string, number>;
  smoothed: number;
  engraved: number;
}

export class ThreeYearsMeasurements {
  readonly initialWealth: number;
  readonly embarkItems: Set<number>;
  readonly purchases = new Set<number>();
  readonly immigration: ImmigrationEvaluation[] = [];
  readonly years: WealthSnapshot[] = [];
  readonly recipes: Record<string, number> = {};
  readonly caravans: { day: number; civ: string; state: string; given?: number; received?: number }[] = [];
  readonly minerals: Record<string, number> = {};
  readonly deaths: { day: number; id: number; species: string; cause: string; killerId: number }[] = [];
  readonly raids: { day: number; kind: string; size: number; partyId: number; outcome?: string }[] = [];
  fixture: { armedDay: number | null; specialists: Record<string, number>; deepShaft: { x: number; y: number; bottom: number } | null } = { armedDay: null, specialists: {}, deepShaft: null };
  private readonly friendlyHits = new Set<string>();
  /** Every dwarf seen alive: a death whose event names no species (a freeze) is still a dwarf's. */
  private readonly knownDwarves = new Set<number>();
  dwarfTicks = 0;
  meals = 0;
  alcohol = 0;
  water = 0;
  private populationTick = 0;
  private lastPopulation = 0;
  private readonly origins = new Map<number, { item: Item; embark: number; purchase: number }>();
  private splitSource: { item: Item; embark: number; purchase: number } | null = null;
  private mergedSource: { item: Item; embark: number; purchase: number } | null = null;

  constructor(readonly w: TestWorld) {
    this.initialWealth = w.readers.of<ItemsReader>('13').wealth();
    this.lastPopulation = this.population();
    this.embarkItems = new Set(w.game.world.entities.with(C.Item));
    for (const id of this.embarkItems) {
      const item = w.game.world.entities.get(id, C.Item)!;
      this.origins.set(id, { item: { ...item }, embark: item.count, purchase: 0 });
    }
    this.connect();
  }

  /** Reattach observation to a loaded game, retaining all measured history and origins. */
  connect(): void {
    const w = this.w;
    // Public item notifications preserve acquisition provenance through stack splits and merges.
    // Mixed, fungible stacks use proportional depletion; no simulation item is modified.
    const core = w.game.world.services.items;
    if (!(core instanceof ItemCore)) throw new Error('economy instrument needs ordinary item notifications');
    core.listen((id, change) => {
      const item = w.game.world.entities.get(id, C.Item);
      const old = this.origins.get(id);
      const same = (a: Item, b: Item): boolean => a.type === b.type && a.material === b.material && a.quality === b.quality;
      if (!item) {
        this.mergedSource = old ?? null;
        this.splitSource = null;
        this.origins.delete(id);
        return;
      }
      let embark = old?.embark ?? 0, purchase = old?.purchase ?? 0;
      if (!old && change !== 'created' && this.splitSource && same(item, this.splitSource.item)) {
        embark = this.splitSource.embark * item.count / this.splitSource.item.count;
        purchase = this.splitSource.purchase * item.count / this.splitSource.item.count;
      }
      if (old && item.count < old.item.count) {
        this.splitSource = old;
        embark *= item.count / old.item.count;
        purchase *= item.count / old.item.count;
      } else {
        this.splitSource = null;
      }
      if (old && item.count > old.item.count && this.mergedSource && same(item, this.mergedSource.item) &&
          item.count - old.item.count === this.mergedSource.item.count) {
        embark += this.mergedSource.embark;
        purchase += this.mergedSource.purchase;
      }
      this.mergedSource = null;
      if (change === 'created') { embark = 0; purchase = 0; }
      if (old && (old.item.flags & ItemFlag.Merchant) && !(item.flags & ItemFlag.Merchant)) {
        embark = 0; purchase = item.count;
        this.purchases.add(id);
      }
      this.origins.set(id, { item: { ...item }, embark, purchase });
    });
    const rememberDwarves = (): void => { for (const id of w.game.world.entities.with(C.Labors)) this.knownDwarves.add(id); };
    rememberDwarves();
    w.game.world.onEvents((events) => {
      if (events.some((e) => e.type === 'CreatureDied')) for (const e of events) if (e.type === 'CreatureDied' && w.game.world.entities.has(Number(e['id']), C.Labors)) this.knownDwarves.add(Number(e['id']));
      if (events.some((e) => e.type === 'ItemCreated' || e.type === 'CreatureDied')) this.accountPopulation();
      for (const e of events) {
        if (e.type === 'HourPassed') rememberDwarves();
        const dwarf = e.type === 'CreatureDied' && this.knownDwarves.has(Number(e['id']));
        if (e.type === 'CreatureDied' && (e['faction'] === 'fortress' || dwarf)) this.deaths.push({ day: Math.floor(w.tick / TICKS_PER_DAY) + 1,
          id: Number(e['id']), species: dwarf ? 'dwarf' : w.game.registry.table<{ id: string }>('creatures').byIndex(Number(e['species']))?.id ?? 'unknown',
          cause: String(e['cause']), killerId: Number(e['killerId'] ?? 0) });
        if (e.type === 'CreatureDied' && (e['faction'] === 'fortress' || dwarf)) note('three_years_death', { ...this.deaths[this.deaths.length - 1], tick: w.tick, killer: w.game.registry.table<{ id: string }>('creatures').byIndex(w.game.world.entities.get(Number(e['killerId'] ?? 0), C.Creature)?.species ?? -1)?.id ?? null });
        if (e.type === 'RaidArrived') this.raids.push({ day: Math.floor(w.tick / TICKS_PER_DAY) + 1,
          kind: String(e['kind']), size: Number(e['size']), partyId: Number(e['partyId']) });
        if (e.type === 'RaidEnded') {
          const raid = this.raids.find((r) => r.partyId === Number(e['partyId']) && !r.outcome);
          if (raid) raid.outcome = String(e['outcome']);
        }
        if (e.type === 'AttackResolved') this.noteFriendlyHit(Number(e['attackerId']), Number(e['defenderId']), String(e['damageType']), String(e['outcome']));
        if (e.type === 'MealEaten') this.meals += 1;
        if (e.type === 'DrankAlcohol') this.alcohol += 1;
        if (e.type === 'DrankWater') this.water += 1;
        if (e.type === 'ItemCrafted') {
          const recipe = String(e['recipeId']);
          this.recipes[recipe] = (this.recipes[recipe] ?? 0) + 1;
        }
        if (e.type === 'MineralMined') {
          const material = String(e['material']);
          this.minerals[material] = (this.minerals[material] ?? 0) + 1;
        }
        if (e.type === 'CaravanArrived' || e.type === 'CaravanDeparted' || e.type === 'TradeCompleted') {
          this.caravans.push({ day: Math.floor(w.tick / TICKS_PER_DAY) + 1, civ: String(e['civ']), state: e.type,
            ...(e.type === 'TradeCompleted' ? { given: Number(e['givenValue']), received: Number(e['receivedValue']) } : {}) });
        }
      }
    });
  }

  /** T-334: the dwarf deaths by cause, a printed figure of the long runs. */
  dwarfDeathsByCause(): Record<string, number> {
    const causes: Record<string, number> = {};
    for (const d of this.deaths) if (d.species === 'dwarf') causes[d.cause] = (causes[d.cause] ?? 0) + 1;
    return causes;
  }

  /** T-334: dwarves dead of hunger or thirst. 10 names both deaths `starvation` (no other cause is emitted for them). */
  needDeaths(): number {
    return this.dwarfDeathsByCause()['starvation'] ?? 0;
  }

  private accountPopulation(): void {
    this.dwarfTicks += this.lastPopulation * (this.w.tick - this.populationTick);
    this.populationTick = this.w.tick;
    this.lastPopulation = this.population();
  }

  observeImmigration(system: Pick<GameSystem, 'serialize' | 'handle'>, event: GameEvent, ctx: TickContext): void {
    const state = system.serialize() as ImmigrationStateV1;
    const seasonal = event.type === 'SeasonChanged';
    if (!seasonal && !(event.type === 'DayPassed' && state.deferredUntilTick > 0 && ctx.tick >= state.deferredUntilTick)) {
      system.handle(event, ctx);
      return;
    }
    const w = this.w;
    const im = w.readers.of<ImmigrationReader>('21');
    const eligibility = im.eligibility();
    const season = seasonal ? Number(event['season']) : state.deferredSeason;
    const year = seasonal ? Number(event['year']) : state.deferredYear;
    const guaranteed = year === 1 && ((season === 1 && !state.guaranteedDone[0]) || (season === 2 && !state.guaranteedDone[1]));
    const entry: ImmigrationEvaluation = { tick: ctx.tick, trigger: seasonal ? 'SeasonChanged' : 'DayPassed', waveSize: null, year, season: SEASON_NAMES[season] ?? 'unknown',
      population: this.population(), wealth: w.readers.of<ItemsReader>('13').wealth(),
      spirit: w.readers.of<MoraleReader>('15').hallSpirit(), wavesSoFar: im.wavesSoFar(),
      eligible: eligibility.eligible, reasons: [...eligibility.reasons], guaranteed,
      roll: eligibility.eligible && !guaranteed ? new RngStream(w.game.world.rngFor('21').state()).int(0, 999) : null,
      probability: IMMIGRATION_PERMILLE + (w.game.world.fortress.reputation.mountainhome ?? 0) * REP_PERMILLE_PER_POINT,
      outcome: 'pending' };
    system.handle(event, ctx);
    const after = system.serialize() as ImmigrationStateV1;
    entry.outcome = entry.population === 0 ? 'no_population' : after.deferredUntilTick > 0 ? 'deferred:raid' : after.wavesSoFar > entry.wavesSoFar ? 'wave' : im.lastSkipReason() ?? 'no_population';
    if (entry.outcome === 'wave') entry.waveSize = after.pending?.planned.length ?? after.lastWave?.count ?? null;
    this.immigration.push(entry);
  }

  /** A fortress dwarf struck by another: the journal names both, the weapon and what each was doing. */
  private noteFriendlyHit(attacker: number, defender: number, damageType: string, outcome: string): void {
    const w = this.w;
    const ent = w.game.world.entities;
    if (outcome !== 'hit' || ent.get(attacker, C.Creature)?.faction !== 'fortress' || ent.get(defender, C.Creature)?.faction !== 'fortress') return;
    const key = `${attacker}:${defender}`;
    if (this.friendlyHits.has(key)) return;
    this.friendlyHits.add(key);
    const types = w.game.registry.table<{ id: string }>('items');
    const held = (id: number): string => types.byIndex(ent.get(ent.get(id, C.Equipment)?.weapon || ent.get(id, C.Worker)?.toolId || 0, C.Item)?.type ?? -1)?.id ?? 'none';
    note('three_years_friendly_hit', { tick: w.tick, day: Math.floor(w.tick / TICKS_PER_DAY) + 1, attacker, defender, damageType, weapon: held(attacker),
      attackerDoing: ent.get(attacker, C.Brain)?.activity ?? '', attackerBehavior: ent.get(attacker, C.Brain)?.behavior ?? '', defenderDoing: ent.get(defender, C.Brain)?.activity ?? '' });
  }

  /** Wild animals on the map by species, for the journal. */
  private wildCensus(): Record<string, number> {
    const ent = this.w.game.world.entities;
    const species = this.w.game.registry.table<{ id: string }>('creatures');
    const census: Record<string, number> = {};
    for (const id of ent.with(C.Creature)) {
      const c = ent.get(id, C.Creature)!;
      if (c.faction !== 'wild') continue;
      const name = species.byIndex(c.species)?.id ?? 'unknown';
      census[name] = (census[name] ?? 0) + 1;
    }
    return census;
  }

  private population(): number {
    return this.w.game.world.entities.with(C.Labors).filter((id) => this.w.game.world.entities.get(id, C.Creature)?.faction === 'fortress').length;
  }

  step(n: number): void {
    const w = this.w;
    const end = w.tick + n;
    while (w.tick < end) {
      const count = Math.min(end - w.tick, TICKS_PER_DAY - w.tick % TICKS_PER_DAY);
      w.step(count);
      this.accountPopulation();
      if (w.tick % (PROGRESS_DAYS * TICKS_PER_DAY) === 0) {
        const items = w.readers.of<ItemsReader>('13');
        note('three_years_progress', { day: w.tick / TICKS_PER_DAY, population: this.population(), wealth: items.wealth(),
          alert: w.game.world.fortress.alert, wild: this.wildCensus(), dwarfDeaths: this.deaths.filter(d => d.species === 'dwarf').length,
          meals: items.count('easy_meal') + items.count('fine_meal') + items.count('lavish_meal'), drink: items.count('drink'),
          plants: items.count('plant_food'), beds: items.count('bed'), caravans: this.caravans.map(c => `${c.day}:${c.civ}:${c.state}`),
          recipes: { ...this.recipes } });
      }
      if (w.tick % (DAYS_PER_YEAR * TICKS_PER_DAY) === 0) {
        const year = this.snapshot();
        this.years.push(year);
        note('three_years_checkpoint', ({ day: year.day, wealth: year.wealth, population: year.population,
          adults: w.readers.of<DwarvesReader>('10').adults().filter(id => w.game.world.entities.get(id, C.Creature)?.faction === 'fortress').length,
          recipes: year.recipes, dwarfDeaths: this.deaths.filter(d => d.species === 'dwarf').length }));
      }
    }
  }

  snapshot(): WealthSnapshot {
    const w = this.w;
    const items = w.readers.of<ItemsReader>('13');
    const buildings = w.readers.of<BuildingsReader>('14');
    const ent = w.game.world.entities;
    const mats = w.game.registry.table<{ id: string; class: string; value: number }>('materials');
    const marks: Record<string, number> = Object.fromEntries(['embark goods', 'blocks', 'furniture', 'crafts', 'meals/drink', 'iron goods', 'steel goods', 'iron bars', 'steel bars', 'gems', 'smoothing/engraving', 'other building value', 'trade purchases', 'barrels', 'other'].map((s) => [s, 0]));
    const counts: Record<string, number> = {};
    const qualities: Record<string, number> = {};
    const craftQualities: Record<string, number> = {};
    let craftQualityValueDelta = 0;
    for (const id of ent.with(C.Item)) {
      const it = ent.get(id, C.Item)!;
      if (it.flags & (ItemFlag.Merchant | ItemFlag.Foreign)) continue;
      const def = items.def(it.type)!;
      // Material index 0 is allowed by ItemFacts (value 0); keep it in the ledger.
      const material = mats.byIndex(it.material) ?? { id: `unspecified(${it.material})`, class: '', value: 0 };
      const key = `${def.id}:${material.id}`;
      counts[key] = (counts[key] ?? 0) + it.count;
      const quality = String(it.quality);
      qualities[quality] = (qualities[quality] ?? 0) + it.count;
      let driver = 'other';
      if (def.id === 'barrel') driver = 'barrels';
      else if (def.id === 'bar' && material.id === 'iron') driver = 'iron bars';
      else if (def.id === 'bar' && material.id === 'steel') driver = 'steel bars';
      else if (material.id === 'steel' && it.crafterId !== 0) driver = 'steel goods';
      else if (material.id === 'iron' && it.crafterId !== 0) driver = 'iron goods';
      else if (def.id.endsWith('_block')) driver = 'blocks';
      else if (def.category.startsWith('furniture/')) driver = 'furniture';
      else if (def.category.startsWith('craft/')) driver = 'crafts';
      else if (def.category.startsWith('food/meal') || def.category.startsWith('drink/')) driver = 'meals/drink';
      else if (def.id === 'cut_gem') driver = 'gems';
      const origin = this.origins.get(id);
      const value = items.value(id);
      if (def.category.startsWith('craft/')) {
        craftQualities[quality] = (craftQualities[quality] ?? 0) + it.count;
        // Static diagnostic only: apply the existing quality table to the same inventory.
        craftQualityValueDelta += itemValue(material.value, def.mult, it.quality, true, it.count) - value;
      }
      const embark = value * (origin?.embark ?? 0) / it.count;
      const purchase = value * (origin?.purchase ?? 0) / it.count;
      marks['embark goods'] = (marks['embark goods'] ?? 0) + embark;
      marks['trade purchases'] = (marks['trade purchases'] ?? 0) + purchase;
      marks[driver] = (marks[driver] ?? 0) + value - embark - purchase;
    }
    for (const id of ent.with(C.Building)) marks['other building value'] = (marks['other building value'] ?? 0) + buildings.value(id);
    const total = Object.values(marks).reduce((sum, value) => sum + value, 0);
    if (Math.abs(total - items.wealth()) > 0.001) throw new Error(`wealth decomposition ${total} != reader ${items.wealth()}`);
    let smoothed = 0, engraved = 0;
    for (let t = 0; t < w.map.tileCount; t += 1) {
      if (w.map.kindAt(t) !== TileKind.Wall && w.map.kindAt(t) !== TileKind.Floor) continue;
      if (w.map.hasFlag(t, TileFlag.Smoothed)) smoothed += 1;
      if (w.map.hasFlag(t, TileFlag.Engraved)) engraved += 1;
    }
    const dwarves = ent.with(C.Labors).filter((id) => ent.get(id, C.Creature)?.faction === 'fortress');
    const meanEndurance = dwarves.length ? dwarves.reduce((sum, id) => sum + (ent.get(id, C.Attributes)?.end ?? 50), 0) / dwarves.length : 0;
    const skills = w.game.registry.table('skills');
    const skillMaxima = Object.fromEntries(skills.ids().map((id) => [id, Math.max(0, ...dwarves.map((d) => ent.get(d, C.Skills)?.level[skills.index(id)] ?? 0))]));
    const renown = w.readers.of<ThreatsReader>('18').renown();
    const fortressCreatures = ent.with(C.Creature).filter((id) => ent.alive(id) && ent.get(id, C.Creature)?.faction === 'fortress').length;
    // Formula-equivalent wealth, using snapshot dwarf population; updates and snapshots can differ.
    const renownWealthEquivalent = (renown - this.population() * RENOWN_POP_WEIGHT) * RENOWN_WEALTH_DIVISOR;
    return { day: Math.floor(w.tick / TICKS_PER_DAY), wealth: items.wealth(), population: this.population(), meanEndurance,
      renown, fortressCreatures, renownWealthEquivalent, spirit: w.readers.of<MoraleReader>('15').hallSpirit(),
      marks, counts, qualities, craftQualities, craftQualityValueDelta, skillMaxima, recipes: { ...this.recipes }, smoothed, engraved };
  }
}

const instruments = new WeakMap<TestWorld, ThreeYearsMeasurements>();
export function attachThreeYearsMeasurements(w: TestWorld, seed = ''): ThreeYearsMeasurements {
  journalSeed = seed;
  const instrument = new ThreeYearsMeasurements(w);
  instruments.set(w, instrument);
  return instrument;
}

/** Test-only forwarding adapter: the real system executes every method unchanged, in its original slot. */
export function observeImmigration(system: GameSystem, instrument: () => ThreeYearsMeasurements | null): GameSystem {
  return { id: system.id, order: system.order, cadence: system.cadence, phase: system.phase,
    subscribes: system.subscribes, ownsCommands: system.ownsCommands,
    init: (ctx) => system.init(ctx), tick: (ctx) => system.tick(ctx),
    handle: (event, ctx) => {
      const observer = instrument();
      if (observer) observer.observeImmigration(system, event, ctx);
      else system.handle(event, ctx);
    },
    applyCommand: (cmd, ctx) => system.applyCommand(cmd, ctx), reader: () => system.reader(),
    serialize: () => system.serialize(), deserialize: (state, ctx) => system.deserialize(state, ctx) };
}
export function threeYearsMeasurements(w: TestWorld): ThreeYearsMeasurements {
  const value = instruments.get(w);
  if (!value) throw new Error('missing three-year measurements');
  return value;
}
export function stepThreeYears(w: TestWorld, n: number): void { threeYearsMeasurements(w).step(n); }
