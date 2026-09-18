/**
 * The strings the UI draws.
 *
 * `01-architecture/content-pipeline.md` § Strings: "All player-facing text is in `strings.json`
 * keyed by a `StringKey`, with placeholders in braces". The generated `strings.json` carries the
 * Wave 3 texts (hints, milestones, confirmations, thoughts); the screen labels, announcement
 * lines and rejection reasons have no generated rows yet, so their canonical values, copied from
 * the Wave 4 wireframes (`04-implementation/ui-screens/*.md`) and the system documents, live in
 * this default table under the key names those documents use. A row of the content table with
 * the same key wins, so moving a row into `strings.json` needs no code change. DECISIONS.md D-061.
 */

import type { Registry } from '@core/registry';

/** The UI's default rows, by `StringKey`. */
export const UI_STRINGS: Readonly<Record<string, string>> = Object.freeze({
  // Main menu (`ui-screens/menus-and-world.md` § Main menu).
  'ui.menu.title': 'D E E P H O L M',
  'ui.menu.subtitle': 'a hall beneath the world',
  'ui.menu.new_world': 'New world',
  'ui.menu.continue': 'Continue',
  'ui.menu.load': 'Load',
  'ui.menu.legends': 'Legends',
  'ui.menu.settings': 'Settings',
  'ui.menu.about': 'About',
  // World generation (§ World generation).
  'ui.worldgen.title': 'New world',
  'ui.worldgen.seed': 'Seed',
  'ui.worldgen.random': 'random',
  'ui.worldgen.size': 'Size',
  'ui.worldgen.size.small': 'small',
  'ui.worldgen.size.standard': 'standard',
  'ui.worldgen.size.large': 'large',
  'ui.worldgen.generate': 'Generate',
  'ui.worldgen.stage': 'Stage: {stage}',
  'ui.worldgen.land': 'Land {pct}%',
  'ui.worldgen.mountains': 'Mountains {pct}%',
  'ui.worldgen.rivers': 'Rivers {n}',
  'ui.worldgen.volcanoes': 'Volcanoes {n}',
  'ui.worldgen.continue': 'Continue to the map',
  'ui.worldgen.back': 'Back',
  // World map (§ World map; `01` § Player-facing behavior).
  'ui.worldmap.river': 'A river runs {from} to {to}.',
  'ui.worldmap.river_source': 'A river rises here and runs {to}.',
  'ui.worldmap.river_mouth': 'A river runs {from} and ends here.',
  'ui.worldmap.lake': 'A lake lies here.',
  'ui.worldmap.volcano': 'A volcano.',
  'ui.worldmap.wealth': 'Wealth',
  'ui.worldmap.peril': 'Peril',
  'ui.worldmap.temper': 'Temper',
  'ui.worldmap.trait': 'Trait: {traits}',
  'ui.worldmap.civ': '{civ} {n} regions ({edge})',
  'ui.worldmap.no_embark': 'No embark here: {biome}.',
  'ui.worldmap.filter': 'filter',
  'ui.worldmap.legend': 'legend',
  'ui.worldmap.embark': 'Embark here',
  'ui.worldmap.filter_title': 'Filter',
  'ui.worldmap.filter_river': 'River',
  'ui.worldmap.filter_volcano': 'Volcano',
  'ui.worldmap.filter_any': 'any',
  'ui.worldmap.filter_yes': 'yes',
  'ui.worldmap.filter_no': 'no',
  'ui.worldmap.filter_min': 'min',
  'ui.worldmap.filter_max': 'max',
  'ui.worldmap.filter_help': '[Enter] toggle  [+][-] adjust',
  'ui.worldmap.filter_matches': '{n} regions match',
  'ui.worldmap.legend_title': 'Legend',
  'ui.worldmap.legend_river': 'river',
  'ui.worldmap.close': 'close',
  'ui.edge.n': 'north',
  'ui.edge.e': 'east',
  'ui.edge.s': 'south',
  'ui.edge.w': 'west',
  'ui.edge_short.n': 'N',
  'ui.edge_short.e': 'E',
  'ui.edge_short.s': 'S',
  'ui.edge_short.w': 'W',
  'ui.busy.site': 'Preparing the site...',
});

/** A `StringKey`'s text with `{placeholders}` filled; the key itself when no row has it. */
export class Strings {
  private readonly content: Readonly<Record<string, string>>;

  constructor(registry?: Registry) {
    this.content =
      registry !== undefined && registry.hasDerived('strings')
        ? registry.derived<Readonly<Record<string, string>>>('strings')
        : {};
  }

  has(key: string): boolean {
    return this.content[key] !== undefined || UI_STRINGS[key] !== undefined;
  }

  get(key: string, params: Readonly<Record<string, string | number>> = {}): string {
    const raw = this.content[key] ?? UI_STRINGS[key] ?? key;
    return fill(raw, params);
  }
}

/** `"{dwarf} has found {material}."` with the named values; unknown placeholders stay. */
export function fill(template: string, params: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}
