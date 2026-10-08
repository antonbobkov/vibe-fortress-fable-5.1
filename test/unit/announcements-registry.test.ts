/**
 * T-M7-10: "every `ui` row of `event-catalog.md` has an announcement spec with the severity named
 * in its system document; `strings.json` complete; `scripts/strings-check.mjs` fails on a missing
 * key or an unused key."
 *
 * `event-catalog.md`'s own preamble says "`ui` means the presentation announcement registry **or
 * panels** subscribe", so each `ui` row is either announced, or consumed by a named presentation
 * surface, or marked `ui (none)` in the catalog itself. The three sets must together be exactly the
 * catalog's `ui` rows, so a row added to the catalog fails this test until it is placed (D-201).
 */

import { describe, expect, it } from 'vitest';
import { HeadlessGame } from '@app/headless';
import { Strings } from '@ui/strings';
// @ts-expect-error -- a plain .mjs script without type declarations
import { parseEvents } from '../../scripts/parse-catalogs.mjs';
// @ts-expect-error -- a plain .mjs script without type declarations
import { check as stringsCheck, referencesIn, uiStringKeys } from '../../scripts/strings-check.mjs';

interface CatalogRow { name: string; fields: string; emitters: string; subscribers: string }

const events = parseEvents() as CatalogRow[];
const uiRows = events.filter((row) => /\bui\b/.test(row.subscribers));
/** `KillRecorded` names the presentation layer by its system number instead of `ui`. */
const presentationRows = events.filter((row) => /\bui\b|\b24\b/.test(row.subscribers));

/**
 * The severity each system document names for its announcements, one row per document sentence.
 * The citation is the document's § Registrations or § Player-facing behavior line.
 */
const DOCUMENTED: readonly { event: string; severity: 'note' | 'alert' | 'danger'; doc: string }[] = [
  // `03` § Player-facing behavior.
  { event: 'VeinFound', severity: 'note', doc: '03' },
  { event: 'CavernBreached', severity: 'alert', doc: '03' },
  { event: 'DeepsilverMined', severity: 'danger', doc: '03' },
  { event: 'ConstructionCollapsed', severity: 'alert', doc: '03' },
  // `04` § Player-facing behavior.
  { event: 'ObsidianFormed', severity: 'note', doc: '04' },
  { event: 'MistProduced', severity: 'note', doc: '04' },
  // `05` § Registrations, § Player-facing behavior.
  { event: 'FireStarted', severity: 'alert', doc: '05' },
  { event: 'FireOut', severity: 'note', doc: '05' },
  // `06` § Registrations.
  { event: 'WeatherChanged', severity: 'note', doc: '06' },
  { event: 'SeasonChanged', severity: 'note', doc: '06' },
  // `07` § Registrations.
  { event: 'PlotNeedsSeeds', severity: 'note', doc: '07' },
  // `08` § Player-facing behavior.
  { event: 'AnimalSpawned', severity: 'note', doc: '08' },
  { event: 'AnimalStarving', severity: 'alert', doc: '08' },
  { event: 'PetAdopted', severity: 'note', doc: '08' },
  // `09` § Registrations.
  { event: 'HuntKill', severity: 'note', doc: '09' },
  { event: 'HuntAbandoned', severity: 'alert', doc: '09' },
  { event: 'FishPoolDepleted', severity: 'note', doc: '09' },
  // `10` § Registrations ("starving (alert), passed out (note), title assigned (note), came of age
  // (note), legendary (note)"); "passed out" is 17's `CreatureUnconscious` (D-201).
  { event: 'Starving', severity: 'alert', doc: '10' },
  { event: 'TitleAssigned', severity: 'note', doc: '10' },
  { event: 'DwarfBecameAdult', severity: 'note', doc: '10' },
  { event: 'LegendaryReached', severity: 'note', doc: '10' },
  // `12` § Registrations.
  { event: 'MasterworkCreated', severity: 'note', doc: '12' },
  { event: 'WorkshopBlocked', severity: 'alert', doc: '12' },
  // `13` § Registrations.
  { event: 'StockpileFull', severity: 'note', doc: '13' },
  { event: 'MiasmaSpread', severity: 'alert', doc: '13' },
  // `14` § Registrations.
  { event: 'HearthLit', severity: 'note', doc: '14' },
  { event: 'DoorBroken', severity: 'alert', doc: '14' },
  { event: 'Buried', severity: 'note', doc: '14' },
  { event: 'RoomQualityChanged', severity: 'note', doc: '14' },
  // `15` § Registrations ("`SulkHappened` (note or alert per kind)": the registry carries both).
  { event: 'SulkHappened', severity: 'note', doc: '15' },
  { event: 'SulkHappened', severity: 'alert', doc: '15' },
  { event: 'MoodTierChanged', severity: 'note', doc: '15' },
  // `16` § Registrations; the first attack of an engagement is the alert on `AttackResolved`.
  { event: 'AttackResolved', severity: 'alert', doc: '16' },
  { event: 'AlertChanged', severity: 'note', doc: '16' },
  { event: 'KillRecorded', severity: 'note', doc: '16' },
  // `17` § Registrations.
  { event: 'PatientAdmitted', severity: 'note', doc: '17' },
  { event: 'CreatureUnconscious', severity: 'alert', doc: '17' },
  { event: 'CreatureDied', severity: 'danger', doc: '17' },
  { event: 'InfectionStarted', severity: 'alert', doc: '17' },
  { event: 'LimbLost', severity: 'alert', doc: '17' },
  // `18` § Registrations.
  { event: 'ThreatWarning', severity: 'alert', doc: '18' },
  { event: 'RaidArrived', severity: 'danger', doc: '18' },
  { event: 'RaidEnded', severity: 'note', doc: '18' },
  { event: 'ThiefSpotted', severity: 'alert', doc: '18' },
  { event: 'ThiefEscaped', severity: 'alert', doc: '18' },
  { event: 'AmbushSprung', severity: 'danger', doc: '18' },
  { event: 'MonsterSpawned', severity: 'note', doc: '18' },
  { event: 'DeepStirred', severity: 'danger', doc: '18' },
  { event: 'RestlessRose', severity: 'alert', doc: '18' },
  // `19` § Registrations ("`TrapTriggered` (note; alert when a creature is caged)").
  { event: 'TrapTriggered', severity: 'note', doc: '19' },
  { event: 'CreatureCaged', severity: 'alert', doc: '19' },
  { event: 'TrapJammed', severity: 'alert', doc: '19' },
  { event: 'TrapSpent', severity: 'note', doc: '19' },
  // `20` § Registrations.
  { event: 'CaravanArrived', severity: 'alert', doc: '20' },
  { event: 'CaravanWaiting', severity: 'alert', doc: '20' },
  { event: 'CaravanDeparted', severity: 'note', doc: '20' },
  { event: 'CaravanLost', severity: 'alert', doc: '20' },
  { event: 'TradeCompleted', severity: 'note', doc: '20' },
  { event: 'ReputationChanged', severity: 'note', doc: '20' },
  // `21` § Registrations.
  { event: 'ImmigrantsArrived', severity: 'alert', doc: '21' },
  { event: 'ImmigrationSkipped', severity: 'note', doc: '21' },
];

/**
 * The `ui` rows the catalog's "or panels subscribe" covers: a presentation surface reads them, and
 * no system document names an announcement for them.
 */
const CONSUMED_ELSEWHERE: Readonly<Record<string, string>> = {
  WorldGenerated: 'the world generation screen (progress and preview)',
  Embarked: 'the fortress screen opens, and the first hint',
  CommandRejected: 'the status bar for two seconds (24 § Events consumed)',
  FireSpread: 'the compositor’s fire layer; 05 names only FireStarted and FireOut',
  CropPlanted: 'the zones panel’s farm settings (crops by stage)',
  CropHarvested: 'the zones panel’s farm settings',
  CropDied: 'the zones panel’s farm settings',
  AnimalBorn: 'the animals panel',
  AnimalLeft: 'the animals panel',
  AnimalTamed: 'the animals panel',
  AnimalTrained: 'the animals panel',
  ProductReady: 'the animals panel',
  HuntStarted: 'the animals panel’s wild tab',
  FishCaught: 'the stocks panel',
  JobCreated: 'the jobs panel',
  JobClaimed: 'the jobs panel',
  JobStarted: 'the jobs panel',
  JobCompleted: 'the jobs panel',
  JobCancelled: 'the jobs panel',
  JobBlocked: 'the jobs panel (blocked jobs with reasons)',
  JobUnblocked: 'the jobs panel',
  WorkshopIdle: 'the workshop panel’s blocked reason',
  StocksChanged: 'the stocks panel',
  BuildingPlaced: 'the build panel and the compositor',
  BuildingCompleted: 'the build panel and the compositor',
  BuildingRemoved: 'the build panel and the compositor',
  HallSpiritChanged: 'the status bar’s hall spirit glyph and the population panel',
  ThoughtGained: 'the mood panel’s thoughts (announced as a note besides)',
  CreatureConscious: 'the look panel’s health section',
  PatientDischarged: 'the health section of the look panel',
  PatientHealed: 'the health section of the look panel',
  InfectionCured: 'the health section of the look panel',
  MonsterEmerged: 'the threats panel',
  TrapRearmed: 'the look panel’s trap section',
  CaravanAtDepot: 'the depot and civilizations panels',
  CaravanAttacked: 'the civilizations panel (the catalog: "attacked → nothing")',
  TradeRefused: 'the civilizations panel’s reputation history',
  GiftGiven: 'the civilizations panel’s reputation history',
};

describe('T-M7-10 announcement registry and the strings audit', () => {
  const game = new HeadlessGame({ seed: 'm7-announcements', world: 'flat-test', embark: 'none' });
  /** An event may carry several specs ("`SulkHappened` (note or alert per kind)", 15). */
  const registered = new Map<string, { severity: string; stringKey: string; keyField?: string }[]>();
  for (const row of game.world.registrations.announcements) {
    const list = registered.get(row.type as string) ?? [];
    list.push(row.spec as { severity: string; stringKey: string; keyField?: string });
    registered.set(row.type as string, list);
  }

  it('every `ui` row of the event catalog is announced, panel-consumed, or marked "(none)"', () => {
    expect(uiRows.length).toBeGreaterThan(90);
    const unplaced: string[] = [];
    for (const row of uiRows) {
      if (/ui \(none\)/.test(row.subscribers)) continue;
      if (registered.has(row.name)) continue;
      if (CONSUMED_ELSEWHERE[row.name] !== undefined) continue;
      unplaced.push(row.name);
    }
    expect(unplaced).toEqual([]);
    // The panel table names no event the catalog does not mark `ui`.
    for (const name of Object.keys(CONSUMED_ELSEWHERE)) {
      expect(uiRows.some((row) => row.name === name), name).toBe(true);
      expect(/ui \(none\)/.test(uiRows.find((row) => row.name === name)?.subscribers ?? ''), name).toBe(false);
    }
  });

  it('every announcement the system documents name is registered with that severity', () => {
    for (const row of DOCUMENTED) {
      const specs = registered.get(row.event);
      expect(specs, `${row.doc} names an announcement for ${row.event}`).toBeDefined();
      expect(specs?.map((spec) => spec.severity), `${row.event} (${row.doc})`).toContain(row.severity);
    }
    // Nothing is registered for an event the catalog does not send to `ui`.
    for (const type of registered.keys()) {
      expect(presentationRows.some((row) => row.name === type), `${type} is announced but the catalog sends it to no presentation subscriber`).toBe(true);
    }
  });

  it('every announcement resolves to a real string, with no placeholder left unfilled', () => {
    const strings = new Strings(game.registry);
    for (const [type, specs] of registered) for (const spec of specs) {
      const keys = spec.keyField === undefined ? [spec.stringKey] : null;
      if (keys === null) {
        // A `keyField` spec has one line per value; at least one must exist.
        const prefix = `${spec.stringKey}.`;
        const any = ['0', '1', '2', '3', 'storm', 'snow', 'heatwave', 'cold_snap', 'hit', 'miss', 'parried', 'blocked', 'day_off', 'argue', 'weep']
          .some((value) => strings.has(`${prefix}${value}`));
        expect(any, `${type}: no line under ${spec.stringKey}`).toBe(true);
        continue;
      }
      expect(strings.has(spec.stringKey), `${type}: ${spec.stringKey}`).toBe(true);
      expect(strings.get(spec.stringKey)).not.toBe(spec.stringKey);
    }
  });

  describe('scripts/strings-check.mjs', () => {
    it('passes over the repository, with both halves of the table counted', () => {
      const result = stringsCheck() as { keys: number; content: number; ui: number; missing: string[]; unused: string[]; mismatched: string[] };
      expect(result.missing).toEqual([]);
      expect(result.unused).toEqual([]);
      expect(result.mismatched).toEqual([]);
      expect(result.content).toBeGreaterThan(100);
      expect(result.ui).toBeGreaterThan(300);
      expect(result.keys).toBe(result.content + result.ui);
    });

    it('reads keys and references the way the UI does', () => {
      const keys = uiStringKeys("export const UI_STRINGS = Object.freeze({\n  'ui.a.b': 'A',\n  'ui.c': 'C',\n});\n") as string[];
      expect(keys).toEqual(['ui.a.b', 'ui.c']);
      const refs = referencesIn(
        "s.get('ui.a.b'); s.has('ui.missing'); `ui.zone.type.${id}`; register.announcement('X', { severity: 'note', stringKey: 'announce.k', keyField: 'f' });",
        ['ui', 'announce'],
      ) as { exact: Set<string>; soft: Set<string>; prefixes: Set<string> };
      expect(Array.from(refs.exact)).toEqual(['ui.a.b']);
      expect(Array.from(refs.soft)).toContain('ui.missing');
      expect(Array.from(refs.prefixes)).toEqual(['ui.zone.type.', 'announce.k']);
    });
  });
});
