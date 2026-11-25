/**
 * The food a starving fortress has at hand now (`ui-keymap-and-screens.md` § Hints, `hint_starving`):
 * tame animals to slaughter, water to fish with no fishing zone on it, ripe shrubs to gather and a
 * caravan that sells food, in that order and only what exists. Read once, when the hint is shown.
 */
import { C } from '@core/components';
import { Designation, TileKind } from '@core/map3d';
import type { ReaderSet } from '@core/readers';
import type { Registry } from '@core/registry';
import type { EntityId } from '@core/types';
import type { AnimalsReader } from '@systems/animals';
import type { BuildingsReader } from '@systems/buildings';
import type { ForagingReader } from '@systems/foraging';
import type { ItemsReader } from '@systems/items';
import type { PlantsReader } from '@systems/plants';
import type { TradeReader } from '@systems/trade';
import { capitalize, listText, pluralName } from './messages';
import type { Strings } from './strings';

interface SpeciesRow { readonly id: string; readonly name: string; readonly plural?: string; readonly meatValue?: number; readonly flags?: Readonly<Record<string, unknown>> }

/** Tame animals of the fortress a slaughter mark would take now, as "2 cows, 2 goats", or ''. */
function animals(readers: ReaderSet, registry: Registry, strings: Strings): string {
  if (!readers.has('08')) return '';
  const species = registry.table<SpeciesRow>('creatures');
  const counts = new Map<number, number>();
  for (const id of readers.of<AnimalsReader>('08').tameList()) {
    const tame = readers.entities.get(id, C.Tame);
    const creature = readers.entities.get(id, C.Creature);
    if (tame === undefined || creature === undefined || !readers.entities.alive(id)) continue;
    // 08 § Slaughter: a war or hunting animal, or one assigned to a dwarf, cannot be marked; a marked one is on its way.
    if (tame.slaughter || tame.assignedTo !== 0 || tame.trained !== 'none') continue;
    const row = species.byIndex(creature.species);
    if (row?.flags?.['butcherable'] !== true || (row.meatValue ?? 0) <= 0) continue;
    counts.set(creature.species, (counts.get(creature.species) ?? 0) + 1);
  }
  const named = Array.from(counts, ([index, n]) => {
    const row = species.byIndex(index) as SpeciesRow;
    return { name: row.name, text: n === 1 ? `1 ${row.name}` : `${n} ${row.plural ?? pluralName(row.name)}` };
  }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return listText(strings, named.map((entry) => entry.text), 'and');
}

/** The water a fishing zone could take, when no fishing zone exists (09 § Fishing), or null. */
function fishableWater(readers: ReaderSet): 'river' | 'lake' | null {
  if (!readers.has('09') || !readers.has('14')) return null;
  if (readers.of<BuildingsReader>('14').zonesOfType('fishing').length > 0) return null;
  return readers.of<ForagingReader>('09').fishableWater();
}

/** Mature shrubs with an edible yield that no gather designation covers yet. 07, 09 § Gathering. */
function ripeShrubs(readers: ReaderSet, registry: Registry): number {
  if (!readers.has('07')) return 0;
  const plants = readers.of<PlantsReader>('07');
  const rows = registry.table<{ id: string; edible?: boolean }>('plants');
  const map = readers.map;
  let n = 0;
  for (let tile = 0, end = map.w * map.h * map.d; tile < end; tile += 1) {
    if (map.kindAt(tile) !== TileKind.Shrub || map.designationAt(tile) === Designation.Gather || !plants.shrubReady(tile)) continue;
    if (rows.byId(plants.speciesAt(tile))?.edible === true) n += 1;
  }
  return n;
}

/** The civilization of a caravan on the map that carries food to sell, and whether a depot stands, or null. 20. */
function caravanFood(readers: ReaderSet, registry: Registry): { civ: string; depot: boolean } | null {
  if (!readers.has('20') || !readers.has('13')) return null;
  const trade = readers.of<TradeReader>('20');
  const caravan = trade.activeCaravan();
  if (caravan === null || caravan.state === 'pack' || caravan.state === 'leave') return null;
  const items = readers.of<ItemsReader>('13');
  const types = registry.table<{ id: string; edible?: boolean }>('items');
  const edible = (id: EntityId): boolean => types.byIndex(readers.entities.get(id, C.Item)?.type ?? 0)?.edible === true;
  if (!trade.merchantItems().some((id) => edible(id) || items.inContainer(id).some(edible))) return null;
  const name = registry.table<{ id: string; name: string }>('civilizations').byId(caravan.civ)?.name ?? caravan.civ;
  const depot = readers.has('14') && readers.of<BuildingsReader>('14').depots().length > 0;
  return { civ: capitalize(name.replace(/^the /, '')), depot };
}

/** The clauses of `hint_starving`, in the hint's order; empty when nothing to eat is at hand. */
export function foodAtHand(readers: ReaderSet, registry: Registry, strings: Strings): string[] {
  const out: string[] = [];
  const herd = animals(readers, registry, strings);
  if (herd !== '') {
    const butcher = readers.has('14') && readers.of<BuildingsReader>('14').byType('butcher')
      .some((id) => readers.of<BuildingsReader>('14').get(id)?.state === 'built');
    out.push(strings.get(butcher ? 'ui.starving_hint.slaughter' : 'ui.starving_hint.slaughter_shop', { animals: herd }));
  }
  const water = fishableWater(readers);
  if (water !== null) out.push(strings.get('ui.starving_hint.fish', { water: strings.get(`ui.starving_hint.${water}`) }));
  const shrubs = ripeShrubs(readers, registry);
  if (shrubs > 0) out.push(strings.get('ui.starving_hint.gather', { n: shrubs }));
  const caravan = caravanFood(readers, registry);
  if (caravan !== null) out.push(strings.get(caravan.depot ? 'ui.starving_hint.caravan_trade' : 'ui.starving_hint.caravan_depot', { civ: caravan.civ }));
  return out;
}
