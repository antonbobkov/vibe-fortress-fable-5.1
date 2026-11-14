import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { COMMAND_TYPES } from '@core/command-types';
import { EVENT_TYPES } from '@core/event-types';
import { recordWorlds } from './recorder';
import { runScenario, type Scenario } from './runner';
import { TestWorld } from './test-world';

const modules = import.meta.glob('./*.scenario.ts', { eager: true }) as Record<string, { default: Scenario }>;
// T-157: these multi-season/year instruments run in their own suites, not twice in the inventory.
const longScenarios = new Set([
  'core_calendar', 'td_schedule', 'th_schedule', 'th_warning', 'year_one',
  'homestead_year', 'three_years', 'descent', 't195_train_needs', 'defence_year',
]);
// T-330: the player paths play weeks of a fortress each; they run once, in their own suite.
const isLong = (id: string): boolean => longScenarios.has(id) || id.startsWith('pp_');

// Explicit entries, not a blanket exemption of the command catalog: adding an entry must fail
// until a scenario reaches it or a concrete stepped test is checked and named here.
const commandExceptions = [
  'SetDesignationPriority', 'DesignateHarvest', 'MarkSlaughter', 'UnmarkSlaughter',
  'TrainAnimal', 'AssignAnimal', 'SetBreedingCap', 'ReleaseCaged', 'SetHuntable',
  'CancelJob', 'SetJobPriority', 'SetStandingOrder', 'RenameDwarf', 'SetSchedule',
  'EditWorkOrder', 'RemoveWorkOrder', 'ReorderWorkOrder', 'SetWorkshopWorker',
  'SuspendWorkshop', 'DumpItem', 'MeltItem', 'SetStockpilePriority', 'LinkStockpile',
  'CancelBuilding', 'DeconstructBuilding', 'SetBuildingPriority', 'ResizeZone',
  'RemoveZone', 'LinkMechanism', 'UnlinkMechanism', 'SetPlateTrigger', 'DisbandSquad',
  'SetSquadLeader', 'SetSquadPatrol', 'SquadOrder', 'SetTrapMode', 'NameAnimal',
  'RenameSquad', 'RenameFortress',
] as const;
const commandTest = 'test/property/t184-paused-command-catalog.test.ts';

interface Exception { readonly reason: string; readonly test?: string; readonly task?: string }
const exceptions: Readonly<Record<'commands' | 'events' | 'jobs' | 'buildings', Readonly<Record<string, Exception>>>> = {
  commands: {
    ...Object.fromEntries(commandExceptions.map((id) => [id, {
      test: commandTest, reason: `Accepts ${id} while paused, saves, and compares all next 50 stepped hashes with its load.`,
    }])),
    SetSanctumApprentices: { test: 'test/unit/runecraft/t469-sanctum-attunement.test.ts', reason: 'Names apprentices of a built sanctum, refuses a child, a stranger and a fifth, and turns attunement on; the named dwarf then attunes through the job.' },
  },
  events: {
    WorldGenerated: { reason: 'World-map generation emits outside the simulation tick loop.' },
    TreeFelled: { test: 'test/unit/terrain/producer.test.ts', reason: 'A commanded chop completes through the real job loop and delivers TreeFelled.' },
    FossilFound: { test: 'test/unit/t547-making-do-materials.test.ts', reason: 'A miner digs a room of giant bone through the real job loop; the first fossil delivers FossilFound once and the thought of the digger.' },
    ShrubRegrown: { test: 'test/unit/plants/wild.test.ts', reason: 'A delivered gather completion starts the shrub timer; stepped days deliver regrowth.' },
    AnimalTrained: { test: 'test/unit/animals/taming.test.ts', reason: 'TrainAnimal runs at a kennel until its actual completion event.' },
    PetAdopted: { test: 'test/unit/t165-death-ownership.test.ts', reason: 'The remaining cat adopts another living dwarf during stepped days after its owner dies.' },
    Talked: { test: 'test/unit/dwarves/activities.test.ts', reason: 'Dwarves actually talk through their stepped social plans and become friends.' },
    ToolDropped: { test: 'test/unit/jobs/tool-drop.test.ts', reason: 'Labor commands release a carried pick when its dwarf reaches a stockpile during step.' },
    FortressShutOut: { test: 'test/unit/buildings/t382-fortress-shut-out.test.ts', reason: 'A hearth alert locks the gate of a fortress whose dwarves all stand outdoors, through the stepped door rules.' },
    AttuneSession: { test: 'test/unit/runecraft/t469-sanctum-attunement.test.ts', reason: 'An apprentice sits two sessions a day at a built circle through the stepped job loop.' },
    Mishap: { test: 'test/unit/runecraft/t469-sanctum-attunement.test.ts', reason: 'A thousand session completions at a built circle roll mishaps that 05, 14 and 17 then play out in step.' },
    CreatureStunned: { test: 'test/unit/runecraft/t469-sanctum-attunement.test.ts', reason: 'A blackout knocks the apprentice down until the stun ends, through the stepped health tick.' },
    FirstRunecaster: { test: 'test/unit/runecraft/t469-sanctum-attunement.test.ts', reason: 'An apprentice attunes through the job to level 10 over 73 stepped days.' },
    StoneSet: { test: 'test/unit/runecraft/t471-setting-stones.test.ts', reason: 'A runesmith sets a garnet in an iron axe, and 25 bolts of 30, through a work order at a built runeforge in the stepped loop.' },
    SpellCast: { test: 'test/unit/runecraft/t470-runeforge-channels.test.ts', reason: 'A runecaster soldier on duty casts its wand\'s bolts at a goblin through the stepped combat loop until its rune runs out.' },
    RuneSpent: { test: 'test/unit/runecraft/t473-remaining-spells.test.ts', reason: 'A wand caster on duty casts its last bolt through the stepped combat loop and falls below cost; regen at the hour lifts it and the note comes again.' },
    VialDrunk: { test: 'test/unit/runecraft/t473-remaining-spells.test.ts', reason: 'A squad caster claims three vials at its re-equip and drinks them below cost with a goblin held, three a day, through the stepped combat loop.' },
    Warded: { test: 'test/unit/runecraft/t473-remaining-spells.test.ts', reason: 'A ward caster on duty wards itself and the soldiers within 3 when a goblin is held, through the stepped combat loop.' },
    Mended: { test: 'test/unit/runecraft/t473-remaining-spells.test.ts', reason: 'A mend caster on duty closes the wounds of a bleeding soldier through the stepped combat loop, and 17 plays the mend out.' },
    DeepsilverWorked: { test: 'test/unit/runecraft/t476-rare-materials-deepsilver.test.ts', reason: 'An alchemist quenches a deepsilver bar and a runesmith shods a staff and sets a deep stone, through the stepped workshop loop, and 18 raises the pressure and the Hollow comes up.' },
    DraughtDrunk: { test: 'test/unit/runecraft/t474-draughts.test.ts', reason: 'A soldier on duty drinks its listed draught when a raid arrives or a hit leaves it below half blood, and a medic brings one to a patient, through the stepped loop.' },
    SummonCalled: { test: 'test/unit/runecraft/t475-summons.test.ts', reason: 'A Call caster on duty calls its summons when a goblin is held, through the stepped combat loop.' },
    SummonTurned: { test: 'test/unit/runecraft/t475-summons.test.ts', reason: 'A deepsilver Call on a seed whose first draw turns brings a deep shade that 18 makes Hollow-born and a squad kills, in step.' },
    SummonFaded: { test: 'test/unit/runecraft/t475-summons.test.ts', reason: 'A summon fades at the hour after its day ends, and after its caster dies, through 25 and 17 in step.' },
    WispAppeared: { test: 'test/unit/runecraft/t491-flavour-pass.test.ts', reason: 'A wand caster on duty calls a wisp through the stepped combat loop, and a sanctum lets one loose; dwarves who see it get saw_wisp.' },
    PutToFlight: { test: 'test/unit/runecraft/t493-hexer-dread.test.ts', reason: 'A dread hexer casts through the stepped combat loop, and the dwarves it puts to flight run, get put_to_flight and come back.' },
    SpellBloomed: { test: 'test/unit/runecraft/t491-flavour-pass.test.ts', reason: 'A firebloom queued with 25 blooms at its tick in step, and the compositor flashes its 3×3.' },
    SquadOrderIssued: { test: commandTest, reason: 'An accepted SquadOrder is dispatched through the following 50 ticks on both saved worlds.' },
  },
  jobs: {
    attune: { test: 'test/unit/runecraft/t469-sanctum-attunement.test.ts', reason: 'An apprentice fetches glowcap and attunes at a built circle through the job loop.' },
    give_draught: { test: 'test/unit/runecraft/t474-draughts.test.ts', reason: 'A medic fetches a draught of mending to a badly hurt patient, and a calming draught to a Miserable dwarf, through the job loop.' },
    bandage_animal: { test: 'test/unit/health/t190-bandage-animal.test.ts', reason: 'An animal-care worker fetches cloth and completes the catalog job for a bleeding cow.' },
    collect_egg: { test: 'test/unit/animals/products.test.ts', reason: 'Standing orders start actual collection of a nest egg during step.' },
    deconstruct: { test: 'test/unit/buildings/furniture.test.ts', reason: 'A DeconstructBuilding command runs to removal and returns its installed bed.' },
    engrave: { test: 'test/unit/terrain/producer.test.ts', reason: 'A dwarf completes commanded smoothing and engraving through the job loop.' },
    gather: { test: 'test/unit/foraging/foraging.test.ts', reason: 'The stepped gathering zone designates a shrub and creates its gather job.' },
    haul_to_dump: { test: 'test/unit/items/hauling.test.ts', reason: 'DumpItem creates a real dump job during step.' },
    link_mechanism: { test: 'test/unit/buildings/mechanisms.test.ts', reason: 'A mechanic fetches a mechanism and works at both buildings to finish LinkMechanism.' },
    milk_animal: { test: 'test/unit/animals/products.test.ts', reason: 'The stepped four-day cow interval produces and completes milking at the farmer workshop.' },
    remove_construction: { test: 'test/unit/buildings/build.test.ts', reason: 'A commanded construction deconstruction runs the remove job and returns its material.' },
    shear_animal: { test: 'test/unit/animals/products.test.ts', reason: 'A seasonal sheep product is actually sheared through the worker loop.' },
    slaughter: { test: 'test/unit/foraging/foraging.test.ts', reason: 'MarkSlaughter runs to CreatureDied, a corpse, and butchery outputs.' },
    train_animal: { test: 'test/unit/animals/taming.test.ts', reason: 'A trainer completes the commanded dog training job at a kennel.' },
  },
  buildings: {
    rune_circle: { test: 'test/unit/runecraft/t469-sanctum-attunement.test.ts', reason: 'A sanctum counts as a room with a built circle, and apprentices attune at it.' },
    alchemist: { test: 'test/unit/runecraft/t468-glowcap-laboratory.test.ts', reason: 'A built laboratory turns two glowcap into a rune vial through a work order and a dwarf; recipe-smoke runs both recipes.' },
    runeforge: { test: 'test/unit/runecraft/t470-runeforge-channels.test.ts', reason: 'A built runeforge makes a silver staff of embers through a work order and a runesmith; recipe-smoke runs every generated wand and staff recipe.' },
    archery_target: { test: 'test/unit/combat/squads.test.ts', reason: 'A built target is used by a ranged soldier during stepped barracks training.' },
    bowyer: { test: 'test/unit/workshops/recipe-smoke.test.ts', reason: 'The built bowyer completes each authored recipe through work orders and jobs.' },
    chain_post: { test: 'test/unit/defense/defense.test.ts', reason: 'A chained animal guards and detects through the actual defense tick.' },
    clothier: { test: 'test/unit/workshops/recipe-smoke.test.ts', reason: 'The built clothier completes each authored recipe through work orders and jobs.' },
    craftdwarf: { test: 'test/unit/workshops/recipe-smoke.test.ts', reason: 'The built craftdwarf completes each authored recipe through work orders and jobs.' },
    farmers_workshop: { test: 'test/unit/animals/products.test.ts', reason: 'Built farmer workshops receive milking and shearing and complete cheese orders.' },
    jeweler: { test: 'test/unit/workshops/recipe-smoke.test.ts', reason: 'The built jeweler completes each authored recipe through work orders and jobs.' },
    leatherworks: { test: 'test/unit/workshops/recipe-smoke.test.ts', reason: 'Built leatherworks completes each authored recipe through work orders and jobs.' },
    loom: { test: 'test/unit/workshops/recipe-smoke.test.ts', reason: 'The built loom completes each authored recipe through work orders and jobs.' },
    magma_forge: { test: 'test/unit/workshops/magma.test.ts', reason: 'A built forge completes a magma-powered order, consumes no fuel, and blocks after losing magma.' },
    magma_kiln: { test: 'test/unit/workshops/t194-kiln-power.test.ts', reason: 'A built kiln reads actual magma power through a stepped world; the spec reserves its recipes for glass outside version 1.' },
    mechanic: { test: 'test/unit/workshops/recipe-smoke.test.ts', reason: 'The built mechanic completes each authored recipe through work orders and jobs.' },
    nest_box: { test: 'test/unit/animals/products.test.ts', reason: 'A built nest holds an egg until the standing collection order is enabled during step.' },
    spike_trap: { test: 'test/unit/defense/defense.test.ts', reason: 'An installed spike trap damages a crossing creature when toggled through stepped defense.' },
    tannery: { test: 'test/unit/workshops/recipe-smoke.test.ts', reason: 'The built tannery completes each authored recipe through work orders and jobs.' },
  },
};

describe('T-157 stepped-world catalog inventory', () => {
  it('reaches every entry or names the concrete stepped test or open task that owns it', () => {
    const recorder = recordWorlds();
    try {
      const ids = Object.values(modules).map(({ default: scenario }) => scenario.id);
      for (const id of longScenarios) expect(ids, `named long scenario ${id}`).toContain(id);
      for (const path of Object.keys(modules).sort()) {
        const scenario = modules[path]!.default;
        if (isLong(scenario.id)) continue;
        // A scenario that is todo for a recorded fault (T-331: a failed end invariant) does not run.
        if (scenario.todo !== undefined) continue;
        runScenario(scenario);
      }
      const registry = new TestWorld({ seed: 't157-catalog', world: 'flat-test', embark: 'none' }).game.registry;
      const rows = (name: string): string[] => [...registry.table(name).ids()];
      const missing = {
        commands: COMMAND_TYPES.filter((id) => !recorder.coverage.commands.has(id)),
        events: EVENT_TYPES.filter((id) => !recorder.coverage.events.has(id)),
        jobs: rows('jobTypes').filter((id) => !recorder.coverage.jobs.has(id)),
        buildings: rows('buildings').filter((id) => !recorder.coverage.buildings.has(id)),
      };
      const catalog = { commands: [...COMMAND_TYPES], events: [...EVENT_TYPES], jobs: rows('jobTypes'), buildings: rows('buildings') };
      const uncovered: Record<string, string[]> = {};
      for (const kind of ['commands', 'events', 'jobs', 'buildings'] as const) {
        for (const [id, exception] of Object.entries(exceptions[kind])) {
          expect(catalog[kind], `exception ${kind}/${id} is still a catalog entry`).toContain(id);
          expect(exception.reason.trim().length, `${kind}/${id} has a reason`).toBeGreaterThan(0);
          if (exception.test) expect(existsSync(exception.test), `${kind}/${id}: ${exception.test}`).toBe(true);
          if (exception.task) expect(readFileSync('docs/backlog.md', 'utf8')).toContain(`| ${exception.task} |`);
          expect(exception.test || exception.task || (kind === 'events' && id === 'WorldGenerated')).toBeTruthy();
        }
        uncovered[kind] = missing[kind].filter((id) => !exceptions[kind][id]);
      }
      console.log('T-157 scenario coverage:', JSON.stringify(Object.fromEntries(
        Object.entries(recorder.coverage).map(([kind, ids]) => [kind, [...ids].sort()]))));
      expect(uncovered).toEqual({ commands: [], events: [], jobs: [], buildings: [] });
    } finally {
      recorder.dispose();
    }
  }, 600_000);
});
