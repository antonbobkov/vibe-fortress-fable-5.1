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
    ConfirmIgnite: { test: 'test/unit/t559-making-do-ice-and-fire.test.ts', reason: 'The first ignite is refused until ConfirmIgnite, which sets igniteConfirmed; the designation then runs through the stepped job loop.' },
    SetStockpileCellar: { test: 'test/unit/items/t554-cellar.test.ts', reason: 'Turns a dark, cool stockpile into a working cellar and judges it at once; stepped days then age oak, pine and cheese, pause in a warm, cold or lit week, and the setting turns off.' },
    ReleaseHeld: { test: 'test/unit/t551-making-do-beds.test.ts', reason: 'Haulers make a built bed up with a bedding and a pillow through the stepped wants pass; ReleaseHeld then drops both on its tile, unflagged, and is refused on a bed that holds nothing.' },
    SetRackDrying: { test: 'test/unit/t552-making-do-drying.test.ts', reason: 'A built rack takes only the drying rows the command names; a held item no row takes drops on its tile; a bad row or a building that is no rack is refused.' },
    SetSanctumApprentices: { test: 'test/unit/runecraft/t469-sanctum-attunement.test.ts', reason: 'Names apprentices of a built sanctum, refuses a child, a stranger and a fifth, and turns attunement on; the named dwarf then attunes through the job.' },
  },
  events: {
    SmokyFuelBurned: { test: 'test/unit/t552-making-do-drying.test.ts', reason: 'A stepped kiln with no bar fires a brick from two peat bricks; the completion emits it, 05 makes the kiln smoky and 15 gives smoky_hall within its reach.' },
    WorldGenerated: { reason: 'World-map generation emits outside the simulation tick loop.' },
    TradeMissed: { test: 'test/unit/trade/t636-broker-on-duty.test.ts', reason: 'A Broker on an active squad and no other trading dwarf leave a requested trade waiting; the stepped stay ends and emits it with the depot and no trader, and a stay with no request emits none.' },
    DepotGoodsReturned: { test: 'test/unit/trade/t715-trade-first.test.ts', reason: 'Goods hauled to the depot and left there when the stepped caravan departs go back to stock, one event for the depot with their count.' },
    Frostbitten: { test: 'test/unit/health/t765-frostbite.test.ts', reason: 'Dwarves on tiles held at -40 °C take frostbite through the stepped hourly health check; the first of the season emits it once, and after a save and load the same season emits none.' },
    TreeFelled: { test: 'test/unit/terrain/producer.test.ts', reason: 'A commanded chop completes through the real job loop and delivers TreeFelled.' },
    CraterEntered: { test: 'test/unit/t560-making-do-starfall.test.ts', reason: 'A squad dwarf walks to a station inside a crater through the stepped world; the entry emits it with first, 15 gives saw_the_star, and after a save and load a second entry is not the first.' },
    WhimSet: { test: 'test/unit/t565-making-do-hall-life.test.ts', reason: 'A Thane with a built kiln sees the stepped calendar turn the season; 10 draws a whim a kiln can make on its own stream, and none is drawn without a Thane.' },
    WhimJudged: { test: 'test/unit/t565-making-do-hall-life.test.ts', reason: 'The stepped season turns with a lantern in the dining hall (after a save and load) and with too little mead; the judgement is met or missed, and 15 gives everyone thane_pleased or the Thane alone thane_grumbled.' },
    RibsEntered: { test: 'test/unit/t557-making-do-boneyards.test.ts', reason: 'A squad dwarf walks into the ribs of a generated desert boneyard through the stepped world; the entry emits it once for that skeleton, 03 marks and saves the record, 15 gives stood_in_the_ribs, and after a save and load a second dwarf there emits none.' },
    FossilFound: { test: 'test/unit/t547-making-do-materials.test.ts', reason: 'A miner digs a room of giant bone through the real job loop; the first fossil delivers FossilFound once and the thought of the digger.' },
    ShrubRegrown: { test: 'test/unit/plants/wild.test.ts', reason: 'A delivered gather completion starts the shrub timer; stepped days deliver regrowth.' },
    ShrubGrazed: { test: 'test/unit/t548-making-do-plants.test.ts', reason: 'A tame yak in a pasture of lichen with no grass walks onto a lichen shrub and grazes it through the stepped tame brain; 07 then sets it regrowing.' },
    SpatOn: { test: 'test/unit/t561-making-do-reindeer-camels.test.ts', reason: 'A dwarf milks a tame camel at the farmers workshop through the stepped job loop until it is spat on twice; the first of the day is the note, 15 gives spat_on, and the day of the note survives a save and load.' },
    RoostFound: { test: 'test/unit/t556-making-do-cages-and-roosts.test.ts', reason: 'A dwarf comes within ROOST_NOTICE_RADIUS of a discovered bat roost in the stepped world; the hourly check emits it once with the dwarf, and the roost and the note survive a save and load.' },
    Stung: { test: 'test/unit/t548-making-do-plants.test.ts', reason: 'Two hundred gather completions on a wild nettle draw the sting on its own stream in step; 15 gives the nettles thought.' },
    ItemAged: { test: 'test/unit/items/t554-cellar.test.ts', reason: 'Bellwine in an oak barrel in a working cellar ages to aged after a year of stepped days and to vintage after two; pine ages in two; cheese in one.' },
    DrankFromPlant: { test: 'test/unit/t548-making-do-plants.test.ts', reason: 'A thirsty dwarf with only cactus pulp walks to it and eats it for its water through the stepped need loop.' },
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
    TileIgnited: { test: 'test/unit/t559-making-do-ice-and-fire.test.ts', reason: 'A woodcutter fetches a firebrand and lights a grass tile through the stepped job loop once the first fire is confirmed; 05 lights it and 15 gives set_a_fire.' },
    IceMelted: { test: 'test/unit/t559-making-do-ice-and-fire.test.ts', reason: 'Underground ice walls whose days are up melt on the stepped DayPassed, and an outdoor ice gate melts at the thaw, said once a day.' },
    SquadOrderIssued: { test: commandTest, reason: 'An accepted SquadOrder is dispatched through the following 50 ticks on both saved worlds.' },
  },
  jobs: {
    harvest_ice: { test: 'test/unit/t559-making-do-ice-and-fire.test.ts', reason: 'A miner with a pick cuts an ice block from a frozen pond, standing on the bank above, through the stepped job loop.' },
    ignite: { test: 'test/unit/t559-making-do-ice-and-fire.test.ts', reason: 'A woodcutter fetches and spends a firebrand on a grass tile through the stepped job loop.' },
    attune: { test: 'test/unit/runecraft/t469-sanctum-attunement.test.ts', reason: 'An apprentice fetches glowcap and attunes at a built circle through the job loop.' },
    give_draught: { test: 'test/unit/runecraft/t474-draughts.test.ts', reason: 'A medic fetches a draught of mending to a badly hurt patient, and a calming draught to a Miserable dwarf, through the job loop.' },
    bandage_animal: { test: 'test/unit/health/t190-bandage-animal.test.ts', reason: 'An animal-care worker fetches cloth and completes the catalog job for a bleeding cow.' },
    collect_egg: { test: 'test/unit/animals/products.test.ts', reason: 'Standing orders start actual collection of a nest egg during step.' },
    collect_honey: { test: 'test/unit/t555-making-do-hives.test.ts', reason: 'A built hive by a meadow fills with a comb over stepped days; a keeper with only animal care lifts it out through the job loop and releases it.' },
    wash_patient: { test: 'test/unit/t564-making-do-compost-fertilizer-soap.test.ts', reason: 'A dwarf admitted with an unbandaged cut is washed by a medic with only medicine on through the stepped job loop, once an admission, consuming one soap.' },
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
    straw_pallet: { test: 'test/unit/t551-making-do-beds.test.ts', reason: 'A child lays a straw pallet of three straw through the stepped build job, with no skill and no experience.' },
    stone_bed: { test: 'test/unit/t551-making-do-beds.test.ts', reason: 'A built stone bed rests at 95 and wants nothing; both mason recipes run in recipe-smoke.' },
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
    drying_rack: { test: 'test/unit/t552-making-do-drying.test.ts', reason: 'Haulers fill a built rack with a peat load and raw meat through the stepped wants pass; its days and dried forms follow DayPassed.' },
    smokehouse: { test: 'test/unit/t552-making-do-drying.test.ts', reason: 'A built smokehouse smokes five boar meat through a stepped work order, and a dwarf nearby smells it; recipe-smoke runs both recipes.' },
    kiln: { test: 'test/unit/t553-making-do-kiln.test.ts', reason: 'A kiln placed by command is built of blocks by a mason and fires a brick through a work order; recipe-smoke runs every kiln recipe.' },
    magma_kiln: { test: 'test/unit/t553-making-do-kiln.test.ts', reason: 'A built magma kiln fires glass, potash, bone ash and clay through work orders with no fuel.' },
    mechanic: { test: 'test/unit/workshops/recipe-smoke.test.ts', reason: 'The built mechanic completes each authored recipe through work orders and jobs.' },
    beehive: { test: 'test/unit/t555-making-do-hives.test.ts', reason: 'A hive placed by command on the outdoor soil is accepted and refused underground; a built hive by a meadow makes a comb over stepped days and keeps it through a save.' },
    candle_stand: { test: 'test/unit/t563-making-do-candles.test.ts', reason: 'Haulers feed a built stand tallow candles through the stepped wants pass; it lights its 3×3 and burns a candle over seven stepped days; a maintain order at the craftsdwarf keeps it fed.' },
    lantern: { test: 'test/unit/t563-making-do-candles.test.ts', reason: 'A built lantern lights its 3×3 and stays lit over thirty stepped days; a hidden creature beside it is spotted two tiles farther.' },
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
