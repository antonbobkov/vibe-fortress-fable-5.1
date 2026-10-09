# Audit: bug hunt, the spec read against the code

**Task:** T-115 · **Date:** 2026-10-09 · **Commit examined:** `d29ea8e` · **Kind:** audit; no source, test, fixture, constant or spec file was changed

This report finishes what [the bug hunt of 2026-10-08](2026-10-08-bug-hunt.md) left open: the rule-by-rule reading of seven system documents against the code (way 5 of T-115), and two save cases of way 2. It does not correct the earlier report. Everything here was checked against the code of `d29ea8e`, which has the fixes of T-141 to T-143 and T-160 to T-168; nothing those tasks fixed, and nothing the open rows T-140 to T-177 already cover, is filed again.

## Summary

The reading found 6 new confirmed bugs that break a fortress or give a wrong result, 12 cosmetic ones, and 18 places where the spec and the code must be brought to agree by writing a rule down or removing one.

- **One bug breaks a fortress.** A dwarf who holds a pick and takes a job that needs an axe fetches the axe and keeps the pick. The pick stays in the dwarf's hands and nobody can use it, the dwarf included. The stocks show it as available. Every dig job is then blocked with `no_tool` for good. Every dwarf starts with all labors on, so any fortress whose player has not split mining and woodcutting between dwarves can lose a tool this way. The three-year fixture does not hit it, because its script gives each dwarf one of the two labors.
- **A sprung cage trap is never re-armed.** The re-arm job asks for an empty container of class `cage`, and a cage is not a container.
- **A workshop stops on a job it cannot supply.** When the input of its current job goes away before a worker claims it, the job stays blocked and the workshop starts none of its other orders, runnable or not. It reports nothing.
- **A hunter carries the wrong corpse.** After a kill the hunter takes the first corpse in the world, which is the quarry's only when no other corpse exists. In the probe it carried a dead dwarf 25 tiles to the butcher's workshop.
- **A save taken while paused, after a designation, does not play like the unsaved game.** The two differ in the state of 07 and 09 from the next tick, for 600 ticks and more. A second load plays like the first.
- **A thief that finds nothing to steal ends its raid as `looted`.**
- **Save and load, the two cases left over.** A save with a trade session open plays exactly like the unsaved game for 1,000 ticks, with an accepted offer and a cancel applied to both. A save taken while paused after thirteen commands equals the unsaved game at the save, and a game with those commands applied while paused equals one with them applied by the tick's command phase. The one difference found is the designation above.
- **A thief can never steal an animal**, because 18 lets the animal itself spot the thief. This is a contradiction inside the spec, not a code fault, and it is in the list of rules to settle.

Every claim is marked **measured** (seen in a run, with the probe named) or **read** (seen in the code, with the file named). Where a cause was not established the report says so. The probes are saved under [`../data/`](../data/) with the date 2026-10-09; the last section says how to run them.

## What was done

| Part | State | How |
|---|---|---|
| Way 5: 11 jobs and labor | read | every rule of §§ Labors to Standing orders against `src/systems/jobs/` (all of it) |
| Way 5: 12 workshops | read | every rule of §§ Recipes to Professions against `src/systems/workshops/` (all of it) |
| Way 5: 13 items and storage | read in part | `api.ts`, `index.ts`, `search.ts`, `hauling.ts`, `commands.ts` whole; `stockpiles.ts`, `rot.ts`, `counts.ts` by search for the rule's terms |
| Way 5: 16 combat | read in part | `melee.ts` (resolution), `squads.ts` (duty and orders), the target loop of `index.ts` whole; `ranged.ts`, `equipment.ts`, `training.ts` by search |
| Way 5: 18 threats | read in part | `ai.ts` (party and member AI), `schedule.ts`, the event handler of `index.ts` whole; `caverns.ts`, `deep.ts`, `parties.ts`, `gear.ts` by search |
| Way 5: 19 defense and traps | read | every rule against `src/systems/defense/` (all of it); the door lock of 14 by search |
| Way 5: 22 pathfinding | read in part | the constants and the terms of each rule by search in `src/core/pathfinding.ts`, `movement.ts`, `path-constants.ts`; the algorithms were not re-derived |
| Way 2: a save while paused, with commands applied by the paused command phase | measured | `save2.probe.ts`, `pausedevents.probe.ts` |
| Way 2: a save with a trade session open | measured | `save2.probe.ts` |

"By search" means the code that names the rule's constant or event was found and read around the match; a rule whose code was found this way and that has an acceptance scenario is recorded as implemented without a second look. Way 6 and the UI half of way 3 are T-116's.

## Confirmed bugs, ranked

Severity is one of: **breaks a fortress**, **wrong result**, **cosmetic**. Bugs are numbered from 16, after the fifteen of the first report.

### Breaks a fortress

#### 16. A dwarf who fetches a second tool keeps the first, and nobody can use it

- **Reproduction (measured):** [`toolswap.probe.ts`](../data/2026-10-09-bug-hunt-toolswap.probe.ts.txt). Flat-test map 48 × 48, seed `t115-toolswap`. One dwarf with `mining` and `woodcutting` on and every other labor off, one iron pick and one iron axe on the ground, food and drink. Designate two channel tiles: the dwarf takes the pick (`Worker.toolId` = the pick) and digs both. Turn two tiles into trees and designate them for chopping: the dwarf fetches the axe and fells both. Designate four more channel tiles and add a second dwarf with only `mining` on.
- **What happens:** after the chop, `Worker.toolId` is the axe. The pick still has `carriedBy` = the dwarf and no position; `items.carriedItems(dwarf)` lists both tools. No `ToolDropped` was emitted. The stock reader says `pick: total 1, available 1`. The four channel jobs are `blocked: no_tool` three days later and 23 days later. Neither dwarf digs again: the first no longer "holds" a pick, and the second cannot find one.
- **What the spec says:** 11 § Assignment step 5: "if the job needs a tool and the worker does not carry it, the first step is to fetch one". 11 § Hauling: "A held tool remains unavailable to searches through `Worker.toolId` and the item's `carriedBy`". Nothing says what becomes of a tool the worker already holds when it fetches another kind. `Worker.toolId` names one item.
- **Cause (read):** `src/systems/jobs/steps.ts:113–119` attaches the fetched tool and writes `toolId` over the old one. The old tool is not dropped. `hasTool` (`src/systems/jobs/items-adapter.ts:116`) reads `toolId` only, and every search skips carried items (`src/systems/items/search.ts:104`).
- **How often:** every time a dwarf that holds a pick takes a chop job, or one that holds an axe takes a dig job, while a free tool of the other kind is in reach. New dwarves have every labor on (11 § Labors), so this is the default. The tool comes back only when the dwarf dies (the corpse holds it until it rots or is buried) or when the player turns both `mining` and `woodcutting` off for that dwarf, which drops only the tool `toolId` names.
- **In the three-year fixture (measured, [`tools-fixture.probe.ts`](../data/2026-10-09-bug-hunt-tools-fixture.probe.ts.txt)):** not hit. At peril 0 in 120 days `ToolEquipped` fires three times and no dwarf carries two tools. The fixture's script splits the labors. So this bug is not shown to be part of T-140 to T-145.
- **Why it ranks first:** an embark has two picks and two axes. Two dwarves that each dig and then chop leave the fortress with no pick, and no message says why.

### Wrong result

#### 17. A sprung cage trap is never re-armed

- **Reproduction (measured):** [`cagetrap.probe.ts`](../data/2026-10-09-bug-hunt-cagetrap.probe.ts.txt). Flat-test, a `cage_trap` and, for contrast, a `stone_fall_trap`. A trollkin is moved onto each. A spare iron cage and a spare stone lie two tiles away; two dwarves with `mechanics` 5 are added.
- **What happens:** both traps go `spent`. The stone-fall trap is `armed` again within a day (`TrapRearmed`). The cage trap's `rearm_trap` job is `blocked: missing_input` after one, three and ten days, with the spare cage lying free. Its input filter is `{ types: [cage], emptyContainer: 'cage' }`. `countAvailable({ type: cage })` is 2 and `countAvailable({ emptyContainer: 'cage' })` is 0. The cage has no `Container` component.
- **What the spec says:** 19 § Trap kinds, `cage`: "`spent`; `rearm_trap` with a new empty cage". 13 § Concepts lists `cage` among the container classes ("one creature").
- **Cause (read):** `src/systems/defense/index.ts:175` adds `emptyContainer: 'cage'` to the filter. `matches` (`src/systems/items/search.ts:95–98`) needs a `Container` of that class, and the `cage` row of `items.json` has no `containerClass`; the occupant is kept in `Item.occupantId` (`src/systems/defense/traps.ts:59`).
- **Note for the fix:** the plain type count calls the occupied cage on the trap tile available too (2, with one cage holding the trollkin). A filter that only drops `emptyContainer` would let the job re-install the cage that has just been sprung.
- **How often:** every cage trap, after its first catch.

#### 18. A workshop whose current job lost its input starts no other order

- **Reproduction (measured):** [`orders.probe.ts`](../data/2026-10-09-bug-hunt-orders.probe.ts.txt), first test. Flat-test, a `craftdwarf` workshop, one bone pile, two stones. Order 1 `craft_bone`, order 2 `make_mug_stone` × 2. With no dwarf on the map yet the workshop creates the job of order 1 (`currentJobId` 1). The bone is then forbidden, standing in for any other taker, and a dwarf with `crafting` 5 is added.
- **What happens:** the job is `blocked: missing_input` on days 1, 5 and 20. No item is crafted. No `WorkshopBlocked` is emitted. `workshops.isRunnable` says order 1 is not runnable ("waiting for bone_pile") and order 2 is.
- **What the spec says:** 12 § Operation step 2: "walk its work orders in order; for the first order that is *runnable*, create the job". Step 3: "if an order is not runnable because of inputs, … the workshop reports `WorkshopBlocked { reason }` once". Step 1 says "If it has a `currentJobId`, nothing to do", and that is the path the code takes: 12 has no rule for a job whose order stops being runnable after the job exists.
- **Cause (read):** `src/systems/workshops/operate.ts:336` skips a workshop that has a current job, whatever the job's state. A job is created when `countAvailable` covers the input (`operate.ts:242`) and the input is reserved only when a worker claims it (`src/systems/jobs/board.ts:854`), so anything that takes the input in between leaves the job blocked.
- **How often:** whenever two takers want the same scarce input: two workshops with one log, a kitchen and a still with the same plants, a build site and a mason. The workshop recovers when the input appears again. It was measured only with the forbid command as the other taker.

#### 19. A hunter carries the first corpse in the world to the butcher's workshop

- **Reproduction (measured):** `orders.probe.ts`, second test. The setup of scenario `fo_hunt` (a hunter with a crossbow and twenty bolts at (21, 20), a deer at (25, 20), a butcher's workshop at (20, 20)), and one thing more: a dwarf killed at (45, 45) before the hunt, whose corpse lies there.
- **What happens:** `HuntKill` at tick 25. At tick 26 the hunt job names the dead dwarf's corpse as its `corpseId`. The hunter walks to (45, 45), picks the corpse up at tick 265 and drops it on the butcher's workshop at tick 506. The deer is butchered afterwards by the ordinary butcher job.
- **What the spec says:** `acceptance-tests.md` `fo_hunt`: "corpse hauled to the butcher". 13 § Corpses: dwarf corpses "want hauling to a coffin".
- **Cause (read):** `src/systems/jobs/steps.ts:229–243`. The hunter looks for a corpse on the tile where it last saw the quarry, and if there is none it takes the first entity with a `Corpse`. The quarry's corpse is made by 13 on its next tick (13 runs every 10 ticks), so on the tick after the kill it is not there yet.
- **How often:** every kill by a hunter while any corpse lies anywhere on the map. With no other corpse the job ends at once and nothing is carried.
- **Effect:** a rotting corpse is carried into a workshop (miasma indoors, 13 § Rot), and a dead dwarf is taken away from where a burial job expects it. What the burial job then does was not established.

#### 20. A save taken while paused after a designation does not play like the unsaved game

- **Reproduction (measured):** [`pausedevents.probe.ts`](../data/2026-10-09-bug-hunt-pausedevents.probe.ts.txt). Flat-test, default embark, 700 ticks. One command is submitted and applied by the paused command phase (`world.commandPhase(true)`), the game is saved and loaded in memory, and the unsaved and the loaded game are stepped side by side with the hash compared after every tick.
- **What happens:** for `Designate { kind: 'channel' }` on two tiles the hashes are equal at the save and different on each of the next 600 ticks. At tick 701 the unsaved game has the two tiles in 07's `pendingBare` and `bodiesStale: true` in 09; the loaded game has neither. A second load equals the first. For `SetAlert hearth`, `CreateZone`, `PlaceBuilding`, `SetLabor` and `CreateSquad` the two games stay equal on every tick; their queued events (`AlertChanged`, `ZoneChanged`, `BuildingPlaced`) are in the save.
- **In the larger case (measured, [`save2.probe.ts`](../data/2026-10-09-bug-hunt-save2.probe.ts.txt), test "paused"):** thirteen commands applied while paused at tick 800 of a busy fortress, among them a designation of four tiles. The unsaved game and its load differ on 811 ticks (801 to 1,611) and are equal from tick 1,612 to the end at 1,800. The control, the same world saved at the same tick with no command applied, is equal on every tick.
- **What the spec says:** `acceptance-tests.md` `core_save_roundtrip`: "identical hash". `save-format.md` step on connectivity: a paused save "preserves the command boundary".
- **Cause:** not established. Something the designation leaves for the end of the tick (it reaches 07 and 09 as changed tiles in the unsaved game) is not in the save. It is not the event queue: that is saved.
- **Effect on play:** none was seen beyond the two fields; the games converge. As with bug 15 of the first report, the fault is that the hash no longer proves a save.
- **How often:** every save made while paused after designating, before a tick has run. That is how a player who plans while paused and then saves plays.

#### 21. A thief that finds nothing to steal ends its raid as `looted`

- **Reproduction (measured):** [`thief.probe.ts`](../data/2026-10-09-bug-hunt-thief.probe.ts.txt), case A. Flat-test with no embark, no item and no creature. `arriveParty(… 'thief', 'gloam', 1, 'n' …)`.
- **What happens:** the party goes to `retreat` at once with `outcome: 'looted'` and an empty loot list, the thief leaves, and `RaidEnded { outcome: 'looted' }` is emitted. No `ThiefEscaped`.
- **What the spec says:** 18 § Party AI, Retreat: "`looted` (retreat with loot)". 18 § Registrations: `RaidEnded` is "an alert when the raid escaped with loot". The fortress also gets no `raid_repelled` thought.
- **Cause (read):** `src/systems/threats/ai.ts:583–587` sets the thief's goal to its own tile when nothing can be stolen, and `ai.ts:976–983` treats arriving at the goal as having stolen.
- **How often:** every thief party that arrives when no loose, unforbidden, reachable item lies on the map and no small tame animal is reachable. T-169 fixes the opposite case (a thief with loot ending `withdrew`); its decision, "the outcome is computed when the party ends, from what happened", covers this one as well if the fix follows it.

### Cosmetic

Grouped into one task, T-187.

- **C13. Editing, removing or reordering any order of a workshop cancels the workshop's current job, whichever order the job belongs to** (read, `src/systems/workshops/orders.ts:17–25`, `:45`, `:49`, `:55`). The job's progress is lost. 12 says only that "removing the order cancels the job". For a global order, `ReorderWorkOrder` cancels nothing (the key is built from `cmd.index`, which that command does not carry), and the running job keeps the old index: it then decrements whichever order now has that index, or none.
- **C14. `clean_trap` marks every corpse on the trap tile for dumping** (read, `src/systems/defense/index.ts:196–199`), a dwarf's included, where 19 says the job "removes corpses to refuse". With no dump zone the corpses stay.
- **C15. Raiders walk to loot while their party is in `engage`** (read, `src/systems/threats/ai.ts:936`). 18 gives looting to `loiter` and to bandits at their stockpile.
- **C16. An ambush goes for the nearest fortress creature outdoors, a grazing animal included** (read, `ai.ts:632–649`). 18 says "the nearest dwarf outdoors".
- **C17. `twilight_pass` sends two thieves in each party** (read, `src/systems/threats/parties.ts:51`) on top of the halved interval. 18 says it "doubles thief frequency".
- **C18. The job board's copy for the save drops the `wholeItem` mark of a job input** (read, `src/systems/jobs/board.ts:983`). A melt job, a burial job and a depot haul carry it. After a load such an input is counted by units where the job has `inputUnits`. No difference was measured: these inputs are single items.
- **C19. `haul_to_dump` and `strip_corpse` jobs run at priority 5**, not at `HAUL_PRIORITY` 6 (read, `src/systems/items/hauling.ts:334` and `:357`; no priority is passed and the board's default applies). 11 § Hauling names the priority only for `haul_to_stockpile`.
- **C20. A squad order that never ends holds the queue** (read, `src/systems/combat/squads.ts:363–380`). `station`, `patrol` and `follow` of a living dwarf are never removed, so an order issued after one of them waits until the player sends `cancel`. 16 says "Orders are executed in order".
- **C21. A pick or an axe in the weapon slot is not a tool for a job** (read, `src/systems/jobs/items-adapter.ts:116`). Measured in the peril-2 fixture: from day 29 an immigrant carries an axe as `Equipment.weapon` with `toolId` 0. A chop job makes that dwarf fetch another axe. 16 § Equipment counts either slot as holding the tool.
- **C22. The stocks call a held tool and an occupied cage available** (measured: `pick: available 1` in `toolswap.probe.ts` while the pick is in a dwarf's hands; `countAvailable({ type: cage })` 2 in `cagetrap.probe.ts` with one cage occupied). 13 defines `available` as "not forbidden, not reserved, not owned", so the code follows the letter. A `maintain` order for picks counts the ones in use.
- **C23. A target is dropped when it is more than two levels above or below** (read, `src/systems/combat/index.ts:284`). 16 names `PERCEPTION_RADIUS` only.
- **C24. Three values are written into the code instead of read from their constant or tag** (read): three days for the unburied dead in `src/systems/items/index.ts:174` (15's `UNBURIED_DAYS`), 100 ticks to the hour in `src/systems/combat/training.ts:85`, and a dog recognised by `id.includes('dog')` in `src/systems/threats/ai.ts:55`. `agent-workflow.md` § Working forbids each.

## Suspected, not reproduced or not established

- **A workshop whose assigned worker dies stays tied to the dead dwarf** (read, `src/systems/workshops/operate.ts:238`): every order answers `no_worker` until the player assigns someone else, and `WorkshopBlocked { no_worker }` is not an announcement. Not run. T-186 asks for the rule.
- **On a `twilight_pass` map, the first of two thieves to leave reports the whole party's loot as escaped** (read, `src/systems/threats/ai.ts:389`: `it.carriedBy === m || P.purpose === 'thief'`). The item the second thief still carries would be destroyed as `stolen` while that thief is on the map. Not run.
- **A stolen animal is never given back when its thief dies** (read: `pickUpLoot` removes the animal's `Position`, `ai.ts:371–380`, and nothing restores it). It cannot be reached today, because no thief gets as far as an animal (G12 below).
- **A job that the labels call reachable and the path search does not is claimed again every 100 ticks** (read, `src/systems/jobs/steps.ts:124–153` with `board.ts:447–453`): the labels ignore the forbidden set and the door rules of a faction (22 § Connectivity labels), `unclaim(job, 'unreachable')` blocks the job, and `openProblem` opens it again. Not run.
- **Whether bug 16 explains any stalled fortress of T-140 to T-145.** Not seen in the fixture at peril 0 (120 days) or peril 2 (60 days).
- **What the burial job does with a dwarf's corpse a hunter has moved** (bug 19).
- **The cause of bug 20.**

## Spec against code, system by system

State is one of: **implemented**, **missing** (a rule with no code), **differs** (code that does something else), **no rule** (code with a player-visible effect and no rule). A row with a bug or gap number is described above or in the list of gaps below.

### 11 Jobs and labor

| Rule | § | Code | State | How |
|---|---|---|---|---|
| Labor list; children haul only | Labors | `board.ts:170`, `commands.ts:34` | implemented | read |
| Job record, anchor tile, item seam | The job record | `board.ts:201–233`, `producers.ts` | implemented | read |
| Producers polled each tick in registration order | The board | `board.ts:929` | implemented | read |
| Candidates: labor, `minSkill`, label, threat radius | Assignment 1 | `board.ts:754–769` | implemented | read |
| Sort, `CANDIDATE_LIMIT`, score, ties by id | Assignment 2–3 | `assign.ts:54–70` | implemented | read |
| Claim, reserve inputs, `missing_input` | Assignment 4 | `board.ts:845–869`, `items-adapter.ts:44–79` | implemented | read |
| Tool: fetch one, else `no_tool` | Assignment 5 | `board.ts:858–866` | implemented | read |
| A worker that already holds a tool and needs another kind | — | `steps.ts:113–119` | no rule; **bug 16** | measured |
| A tool in the weapon slot | 16 § Equipment | `items-adapter.ts:116` | differs; C21 | read, measured |
| Skip a tool job while another worker holds the only tool | Assignment | `board.ts:782–800` | implemented | read |
| Death: held tool and carried item drop | Assignment, Cancellation | `board.ts:872–917` | implemented | read (T-160) |
| Both tool labors off: drop on the next stockpile tile | Assignment | `items-adapter.ts:136–155` | implemented | read |
| Next candidate when a claim fails | Assignment | `board.ts:828–840` | implemented | read |
| Steps `claimed` to `completing`; effort without rounding | Job steps | `steps.ts:97–196`, `assign.ts:78–91` | implemented | read |
| Interruption keeps progress; `RESERVE_KEEP_TICKS`; delivered inputs stay | Job steps | `board.ts:658–675`, `:585–622` | implemented | read |
| A delivered input counts only while it is this job's | Job steps | `board.ts:520–544`, `steps.ts:161–168` | implemented | read |
| Haul family; one item or stack per trip | Hauling | `hauling.ts` | implemented | read |
| Priority of `haul_to_dump` and `strip_corpse` | Hauling | `hauling.ts:334`, `:357` | no rule; C19 | read |
| `IDLE_HAULER_WARNING` hint | Hauling | — | missing (T-177) | read |
| `hasWork` summary by label and labor | Hauling | `board.ts:690–752` | implemented | read |
| One `ItemReleased` per released reservation | Hauling | `board.ts:609–612` | implemented | read |
| Blocking reasons and their triggers | Blocking and retry | `board.ts:45–52`, `index.ts:118–141` | implemented, except `workshop_suspended` (G2) | read |
| Retry in creation order, `BLOCKED_RETRIES_PER_TICK`; opens only when the reason is gone | Blocking and retry | `board.ts:428–507` | implemented | read |
| A job blocked `unreachable` by the path search, not by the labels | Blocking and retry | `board.ts:447–453` | differs; suspected | read |
| Cancellation releases reservations; `CancelJob` clears a designation | Cancellation | `board.ts:352–360`, 03's producer | implemented | read |
| A worker who dies: job to `open`, progress kept | Cancellation | `board.ts:886–898` | implemented | read |
| Standing orders, all on | Standing orders | `constants.ts:22–29` | implemented | read |
| The save copy of a job | State | `board.ts:979–986` | differs; C18 | read |
| The hunt job's corpse | 09, `fo_hunt` | `steps.ts:229–243` | differs; **bug 19** | measured |

### 12 Workshops and professions

| Rule | § | Code | State | How |
|---|---|---|---|---|
| Magma variants: power below the footprint, `no_magma` | Workshops | `operate.ts:213–221`, `:322–335` | implemented | read |
| Input `match`, `materials`, `materialProperty`, `sameMaterial`, `stage: 'next'` | Recipes | `operate.ts:55–151`, `:264–286` | implemented | read |
| `flagged: 'melt'` takes the whole item; auto-melt only when no order starts | Recipes | `operate.ts:67–71`, `:366–392` | implemented | read |
| Melt yield and bar cost | Recipes | `operate.ts:414–456` | implemented | read |
| One job per workshop; first runnable order | Operation 1–2 | `operate.ts:336–365` | implemented | read |
| Runnable: remaining, inputs, fuel, container, worker | Operation 2 | `operate.ts:231–256` | implemented | read |
| `WorkshopBlocked` once | Operation 3 | `operate.ts:393–395` | implemented | read |
| A current job whose order is no longer runnable | — | `operate.ts:336` | no rule; **bug 18** | measured |
| `onComplete`: validate, consume, quality, outputs, decrement | Operation | `operate.ts:446–516` | implemented | read |
| Removing the order cancels the job | Operation | `orders.ts:47–50` | differs; C13 | read |
| `SetWorkshopWorker` by any labor of the type | Operation | `orders.ts:94–108` | implemented | read |
| A dead assigned worker | — | `operate.ts:238` | no rule; G7 | read |
| `maintain` below threshold; never completes | Work orders | `operate.ts:237`, `:508` | implemented | read |
| Global order goes to "the least busy" workshop | Work orders | `operate.ts:337–344` | differs: the first idle workshop in entity order (G6) | read |
| `materialFilter` constrains one input | Work orders | `operate.ts:264–270` | implemented | read |
| Quality roll and tiers | Quality | `quality.ts:5–12` | implemented | read |
| `masterwork_lost` on `ItemDestroyed` | Quality | `src/systems/morale/thoughts.ts:120` | implemented, by 15 and not by 12 (G4) | read |
| Fuel one bar per job; none with magma | Fuel | `operate.ts:249–253`, `:352`, `:459` | implemented | read |
| `CHARCOAL_PER_LOG`, `COAL_PER_ORE`, `BARS_PER_ORE`, `SILVER_FROM_GALENA_PERMILLE` | Fuel, Recipes | constants unused | T-177 | read |
| `professionOf`, military title on duty | Professions | `professions.ts`, `reader.ts:41` | implemented | read |
| Events consumed: `FluidsChanged`, `StocksChanged`, `ItemDestroyed` | Interfaces | not subscribed; polled each tick | differs (G4) | read |
| `SuspendWorkshop` | Interfaces, 11's table | `orders.ts:86–91` cancels the job | differs (G2) | read |

### 13 Items and storage

| Rule | § | Code | State | How |
|---|---|---|---|---|
| Item, stack, container; a place is ground, container or carrier | Concepts | `api.ts:421–432` | implemented | read |
| `cage` is a container class | Concepts | `items.json`: no `containerClass` | differs; **bug 17**, G14 | measured |
| `foreign`: no count, no wealth, cleared on pickup | Value | `api.ts:343–345`, `:499–511` | implemented | read |
| Value formula; wealth kept by increments; `WealthChanged` step | Value | `value.ts`, `api.ts:357–371`, `index.ts:234–240` | implemented | read |
| Several stacks above the stack size; falling to a solid tile | Placement | `api.ts:380–394`, `:440–452` | implemented | read |
| `accepts`, slot search, container requests, slot reservations | Stockpiles | `stockpiles.ts`, `hauling.ts:183–331` | implemented | by search; `it_` scenarios |
| `StockpileFull` once; `noHome` returns | Stockpiles | `hauling.ts:218–229` | implemented | read |
| Wants set: enters, leaves, `HAUL_JOBS_PER_TICK` | The "wants hauling" set | `hauling.ts:85–137`, `:231–254` | implemented | read |
| An unclaimed haul is cancelled when another job takes the item | The "wants hauling" set | `hauling.ts:128–137`, `:150–160` | implemented | read |
| Containers count units or items; never nested | Containers in play | `api.ts:522–556` | implemented | read |
| Flags; forbid cancels the reserving job | Forbid, dump, melt, claim | `commands.ts:53–72` | implemented | read |
| `available` | Forbid; Stock counts | `counts.ts`, `search.ts:253–264` | implemented to the letter; C22, G8 | measured |
| Ownership ends with the owner | Forbid | `index.ts:248–252` | implemented | read (T-161) |
| A corpse's worn items on burial, rot and destroy | Forbid | `api.ts:646–664`, `rot.ts` | implemented | read (T-164) |
| `strip_corpse` for non-dwarf corpses | Forbid | `hauling.ts:355–369`, `:377–388` | implemented | read |
| Dump: first tile of the nearest dump zone; flag clears | Forbid | `hauling.ts:333–352`, `:401–405` | implemented | read |
| Rot stages, container and temperature speeds, bags | Rot | `rot.ts:40–55` | implemented | by search |
| Miasma indoors only | Rot | `rot.ts:151–160` | implemented | by search |
| Corpse made on death with what the creature carried | Corpses | `index.ts:240–260` | implemented | read |
| Counts rebuilt on load | Stock counts | `index.ts:349`, `api.ts:768–774` | implemented | read |
| `findItem`: rings, then stock order; carried items out | Searching | `search.ts:166–233` | implemented | read |
| `ThiefEscaped` destroys the item | Value | `index.ts:268–271` | implemented | read |
| Magma melts, fire burns, collapse drops | Items and hazards | `index.ts:272–281`, `src/systems/materials/fire.ts:221–240` | implemented, burning by 05 | by search |
| The unburied-dead limit | Interfaces | `index.ts:174` | implemented with a literal; C24 | read |

### 16 Combat

| Rule | § | Code | State | How |
|---|---|---|---|---|
| Adjacent melee, else ranged, else approach | Targeting | `index.ts:288–318` | implemented | read |
| Target lost: death, perception, `TARGET_LOSE_TICKS` | Targeting | `index.ts:284`, `:358–375` | implemented, plus the level limit (C23) | read |
| Soldiers pick the nearest hostile in perception | Targeting | `squads.ts:403–433` | implemented, with line of sight | read |
| `RANGED_KEEP_DISTANCE` | Targeting | — | missing (T-177) | read |
| Cooldown | Attack cooldown | `melee.ts:435` | implemented | read |
| Hit, parry, block, part, raw damage, armor, blunt-through, experience | Melee resolution | `melee.ts:416–600` | implemented | read; `cb_` scenarios |
| Toughness, natural armor, buckler, launcher as a club, clothing as padding | 17, 08, `weapons-and-armor.md` | `melee.ts:286–318`, `:392–400`, `:575–583` | implemented; the terms are outside 16's formula (G10) | read |
| Ranged hit, projectile, ammunition break, bystander at half chance | Ranged resolution | `ranged.ts:386`, `:775` | implemented | by search; `cb_` scenarios |
| Line of sight and fortifications | Ranged resolution | `src/core/pathfinding.ts:364` | implemented | by search |
| Flight at `FLEE_BLOOD_PERCENT`; aggressive and deep never | Fleeing | `src/systems/threats/ai.ts:867–889` | implemented | read |
| `ThreatNearby`, throttled and saved | Threat detection | `threats.ts`, `index.ts:380` | implemented | by search |
| Modes; `watchful` and `hearth` make every squad active | Squads | `squads.ts:20–23` | implemented | read |
| A squad in `train` mode is on duty | Squads | `squads.ts:22` | no rule (G9) | read |
| Orders in order; `kill`, `station`, `patrol`, `follow`, `cancel` | Squads | `squads.ts:262–310`, `:363–380` | differs; C20 | read |
| The Warden leads the first squad | Squads | `squads.ts:52–60` | implemented | read |
| Shifts every `TRAIN_SHIFT_HOURS` | Squads | `training.ts:78–87` | implemented with a literal; C24 | read |
| Sparring, drills, archery, Warden bonus | Training | `training.ts:119–300` | implemented | by search |
| Claim on joining and every `REEQUIP_CHECK_DAYS`, through 13 | Equipment | `equipment.ts` | implemented | by search (T-162) |
| No pick or axe as a weapon while a worker lacks one | Equipment | `equipment.ts:299–306` | implemented | read |
| Armor slows; `armor_use` restores | Equipment | `equipment.ts:62–105` | implemented | by search |
| Soldiers claim a caravan's goods | Equipment | `equipment.ts:110–120` | T-171 | — |
| Alert has no automatic change | Alerts | — | implemented | first report |
| First attack of a pair is the alert | Combat log | engagements map, `index.ts:309` | implemented | by search |

### 18 Threats, monsters and raids

| Rule | § | Code | State | How |
|---|---|---|---|---|
| Renown, recomputed daily and on change | Renown | `schedule.ts:42`, `index.ts:316`, `:411` | implemented | read |
| Party size `base + renown × perRenown`, capped | Renown | `schedule.ts:62–71` | implemented | read |
| Daily check; first date rolled at embark | Schedule | `schedule.ts:139–141`, `index.ts:318–323` | implemented | read |
| Bandits only below reputation 50, without advancing | Schedule | `index.ts:324–325` | implemented | read |
| `serene_vale`; `twilight_pass` halves intervals | Schedule | `schedule.ts:91–137` | implemented | read |
| `twilight_pass` doubles thief frequency | Schedule | `parties.ts:51` | differs; C17 | read |
| No raid in winter at peril ≤ 2 | Schedule | `index.ts:338–342` | implemented | read |
| Gear tier, skills, kit attached through 13 | Party composition | `gear.ts`, `parties.ts` | implemented | by search (T-163) |
| Arrival spread and trickle; warning with size band; fog | Arrival and warning | `parties.ts`, `index.ts:327–362` | implemented | read |
| Thief goal: most valuable reachable item, outdoors first | Party AI, goal | `ai.ts:518–587` | implemented | read |
| Thief goal: a small tame animal | Party AI, goal | `ai.ts:560–577` | implemented and unreachable (G12) | measured |
| A thief with no goal | — | `ai.ts:583–587`, `:976–983` | no rule; **bug 21** | measured |
| Bandits: nearest stockpile, one item each | Party AI, goal | `ai.ts:588–626`, `:320–349` | implemented | read |
| Ambush: nearest dwarf outdoors | Party AI, goal | `ai.ts:627–657` | differs; C16 | read |
| Raid and siege: hearth, wagon, building; nearest reachable | Party AI, goal | `ai.ts:429–507` | implemented | by search; `th_loiter` |
| Approach to engage on a reachable sighting | Party AI, approach | `ai.ts:750–766` | implemented | read |
| A party that has arrived and sees nobody | Party AI | `ai.ts:995–1006` | T-173 | — |
| Engage: targets, door breaking, back to approach | Party AI, engage | `ai.ts:768–786`, `:920–934` | implemented | read |
| Looting while in `engage` | Party AI, loiter | `ai.ts:936–952` | differs; C15 | read |
| Loiter limits; broken door returns to approach | Party AI, loiter | `ai.ts:788–817` | implemented | read |
| Retreat by casualties; outcomes | Party AI, retreat | `ai.ts:690–713`, `:383–426` | implemented; thief outcome T-169 | read |
| A member that fled counts as a casualty | Party AI, retreat | `ai.ts:707`, `:741` | no rule (G13) | read |
| Stealth and spotting, `SPOT_RADIUS`, traps | Stealth | `ai.ts:125–146`, `index.ts:449–468` | implemented; ambush T-170 | read |
| Restless dead | Party composition | `caverns.ts`, `ai.ts:658–684` | implemented; "attacks anything" is fortress creatures only (G13) | by search; `th_restless` |
| Cavern monsters: spawns, seek, return, webs | Cavern monsters | `caverns.ts` | implemented | by search |
| The Deep: pressure, thresholds, emergence, waves | The Deep | `deep.ts` | implemented | by search; `th_deep` |

### 19 Defense and traps

| Rule | § | Code | State | How |
|---|---|---|---|---|
| Modes `enemies` and `all`; who triggers | Trap targeting | `traps.ts:12–18` | implemented | read |
| Triggered from `EntitiesMoved` against `trapTiles` | Trap targeting | `index.ts:100–107` | implemented | read |
| Stone-fall: damage by density, head doubled, `spent`, re-arm | Trap kinds | `traps.ts:37–49`, `index.ts:171–178` | implemented | measured (`cagetrap.probe.ts`) |
| Spike: only extended; pierce at `TRAP_SKILL` | Trap kinds | `traps.ts:64–69`, `index.ts:92–99` | implemented | read |
| Cage: size limit, `CreatureCaged`, `spent` | Trap kinds | `traps.ts:50–63` | implemented | measured |
| Cage: re-arm with a new empty cage | Trap kinds | `index.ts:171–178` | differs; **bug 17** | measured |
| Weapon: each weapon attacks; jam chance | Trap kinds | `traps.ts:70–76` | implemented | read |
| `clean_trap` removes corpses to refuse | Trap kinds | `index.ts:196–203` | differs; C14 | read |
| Plates: creature and fluid triggers, default trigger, reset ticks | Pressure plates | `plates.ts` | implemented | read |
| Lever: `pull_lever` completes here | Levers | `index.ts:108–115`, `:157–164` | implemented | read |
| Chained animals spot at `SPOT_RADIUS_DOG` | War animals | `index.ts:126–142` | implemented, without line of sight (G15) | read |
| `retreatTile`: hall, behind a door, bedroom | Hearth alert retreat | `retreat.ts` | implemented | read |
| Door lock: grace and outside-clear | Hearth alert retreat | `src/systems/buildings/build.ts:1033–1127` | implemented | by search |
| The seven defense patterns | Doors, bridges, floodgates | 14, 16, 04 | not read; they have `df_` scenarios | — |

### 22 Pathfinding and spatial

| Rule | § | Code | State | How |
|---|---|---|---|---|
| Kinds, buildings, fluids, flags | Passability | `src/core/pathfinding.ts:160–200` | implemented | by search; `pf_` scenarios and the property tests |
| Costs: diagonal, water, snow, restricted, web, door | Costs | `path-constants.ts`, `pathfinding.ts:185–197` | implemented | read |
| Stairs not for `large`; ramps; hatches | Edges | `pathfinding.ts:263–290` | implemented | by search |
| A*: node limit, tick budget, urgency order | A* | `pathfinding.ts:404–410`, `:688–720` | implemented | by search |
| Labels: chunk components, portals, union | Connectivity labels | `src/core/connectivity.ts` | not re-derived; `connectivity-incremental` property test | — |
| Labels ignore the mover: faction, forbidden set, locked for some | Connectivity labels | `board.ts:236–241` and 18's `reachable` calls | implemented as written; the effect on jobs is in "Suspected" | read |
| Path cache | Path cache | `pathfinding.ts`, `PATH_CACHE_SIZE` | implemented | by search |
| Movement helper: blocked, repath, fall | Movement helper | `src/core/movement.ts:312–330` | implemented | by search |
| Line of sight and `LOS_MAX` | Line of sight | `pathfinding.ts:364` | implemented | by search |
| `DWARF_SPEED` | Tuning constants | unused | T-177 | read |

## Rules to write down or remove

Each is a place where the spec is silent, or says something the code does not do and where the code may be the better rule. They go to one task, T-186, with a recommendation for each.

- **G1. 11: a worker that holds one tool and needs another kind.** The root of bug 16; T-180 writes the rule.
- **G2. 11 § Blocking and retry: `workshop_suspended` is never a block reason.** `SuspendWorkshop` and `SetWorkshopWorker` cancel the job (`orders.ts:89`, `:106`). `SetLabor` also retries `unreachable` jobs, which the table does not list.
- **G3. 11 § Hauling: the priority of `haul_to_dump` and `strip_corpse`** (C19).
- **G4. 12 § Events consumed lists `FluidsChanged`, `StocksChanged` and `ItemDestroyed`**; 12 subscribes to none of them. It reads magma and stock each tick, and 15 gives `masterwork_lost`.
- **G5. 12 § Operation: a current job whose order stops being runnable.** T-182 writes the rule.
- **G6. 12 § Work orders: "the job is created at the least busy" workshop.** The code gives a global order to the first idle workshop of the type in entity order.
- **G7. 12: a workshop whose assigned worker has died.**
- **G8. 13 § Stock counts: what `available` means for a tool in a dwarf's hands and for an occupied cage** (C22).
- **G9. 16 § Squads: whether a squad in `train` mode is on duty.** In the code it is: its members do not flee, carry the military title, are not interrupted by a hearth alert, and attack a hostile they see. The spec gives those to squads "on duty" and defines the word only for `active`.
- **G10. 16 § Melee resolution leaves out terms the code applies**: Toughness (17 § 4), natural armor and the war-animal bonus to it (08), the buckler's lower block chance and the launcher used as a club (`weapons-and-armor.md`), clothing as a padding layer. The formula block in 16 reads as complete.
- **G11. 16 § Squads: when an order ends** (C20), and **16 § Targeting: the level limit** (C23).
- **G12. 18 § Stealth against § Party AI: a thief cannot steal an animal.** § Stealth: spotted by "any fortress creature within `SPOT_RADIUS` … with line of sight". § Party AI: thieves target a "small tame animal". The animal is a fortress creature. Measured in `thief.probe.ts`, case B: five runs with a tame cat as the only quarry, five times `ThiefSpotted` and `withdrew`, the cat untouched.
- **G13. 18 § Party AI: four small silences.** What a thief does with nothing to steal (bug 21); whether a member that fled and left counts toward `RETREAT_LOSS_PERCENT` (it does); whether an ambush hunts animals (C16); whether the restless dead attack "anything" or fortress creatures (the code: fortress creatures).
- **G14. 13 § Concepts lists `cage` as a container class; `items.md` gives the cage none.** T-181 decides how a cage holds its occupant.
- **G15. 19 § War animals: a chained animal spots a stealthed creature with no line of sight** (`index.ts:133–135`), where 18 § Stealth asks for one.
- **G16. 19 § Trap kinds: `clean_trap` and the corpses** (C14).
- **G17. 09 and 11: which corpse a hunter carries, and what the hunt job does until the corpse exists.** T-183 writes the rule.
- **G18. `save-format.md`: what a save taken between a paused command and the next tick must carry.** It names the connectivity state and nothing else. T-184 finds what is missing and writes it down.

## Save and load: the two cases left over

Both measured with `save2.probe.ts`. The world is a flat-test fortress with the default embark, `prepareBusyFortress` of `core_save_roundtrip` and a trade depot. A save is `roundTrip` of `src/app/game-save.ts`; the hash is compared after every tick.

| Case | At the save | Next 1,000 ticks |
|---|---|---|
| Paused at tick 800, thirteen commands applied by the paused command phase (a designation, a zone, two buildings, two work orders, a labor, a labor priority, a squad, an alert, a standing order, a rename; two were rejected) | first load equals the unsaved game; second load equals the first | unsaved against load: **811 ticks differ, 801 to 1,611**, then equal (bug 20). Load against load: equal on every tick |
| The same thirteen commands, applied while paused in one game and by the tick's command phase in another | — | equal after 1,000 ticks |
| Control: the same world saved at tick 800, no command | equal | equal on every tick |
| A trade session open at tick 41,894 (caravan at the depot, broker trading) | first load equals the unsaved game; the session is open in the load | with `TradeOffer` at +10 (accepted, `TradeCompleted`) and `TradeCancel` at +400 on both: equal on every tick. Load against load, no command: equal on every tick |

The trade world had two dwarves alive of seven after 35 days; the causes were not read (the first report saw the same in its fuzz world).

## The probes

All are scratch files and none is a permanent test. To run one, copy the files of both dates from `reports/data/` into a directory `t115-scratch/` at the repository root, remove the `2026-10-0n-bug-hunt-` prefix and the `.txt` suffix, and run:

```
node node_modules/vitest/vitest.mjs run -c t115-scratch/vitest.config.ts t115-scratch/<name>.probe.ts
```

The config is the first report's `vitest.config.ts`. No file under `src/` was changed or instrumented. The probes use readers, the entity store, events, `arriveParty` of 18 as scenario `th_thief` does, `world.commandPhase(true)` as the paused host does, and `roundTrip`.

| File | What it does | Keep as a permanent test? |
|---|---|---|
| [`toolswap.probe.ts`](../data/2026-10-09-bug-hunt-toolswap.probe.ts.txt) | One dwarf, a pick, an axe, a dig and then a chop: bug 16. | Yes, as the test of T-180 |
| [`tools-fixture.probe.ts`](../data/2026-10-09-bug-hunt-tools-fixture.probe.ts.txt) | Where every pick and axe of the three-year fixture is, once a day. Environment: `T115_SEED`, `T115_PERIL`, `T115_DAYS`. | No |
| [`cagetrap.probe.ts`](../data/2026-10-09-bug-hunt-cagetrap.probe.ts.txt) | A cage trap and a stone-fall trap sprung, then mechanics with spares: bug 17. | Yes, as the test of T-181 |
| [`orders.probe.ts`](../data/2026-10-09-bug-hunt-orders.probe.ts.txt) | A blocked first order (bug 18); a hunter with an old corpse on the map (bug 19). | Yes, both |
| [`thief.probe.ts`](../data/2026-10-09-bug-hunt-thief.probe.ts.txt) | A thief with nothing to steal (bug 21); a thief whose only quarry is a cat (G12). | Yes |
| [`save2.probe.ts`](../data/2026-10-09-bug-hunt-save2.probe.ts.txt) | The two save cases. About five minutes. | Yes: the paused case belongs in `core_save_roundtrip` |
| [`pausedevents.probe.ts`](../data/2026-10-09-bug-hunt-pausedevents.probe.ts.txt) | One paused command at a time across a save: bug 20. About three minutes. | Yes, the designation case |
| [`whydiffer.ts`](../data/2026-10-09-bug-hunt-whydiffer.ts.txt) | Where two games differ, taken from the first report's `long.probe.ts`. | With T-176 |

Their output is in [`2026-10-09-bug-hunt-output.txt`](../data/2026-10-09-bug-hunt-output.txt).

## Not established

- The cause of bug 20.
- Whether bug 16 is part of any stalled fortress of T-140 to T-145.
- What the burial job does with a corpse a hunter moved.
- The four suspected items above that were read and not run.
- The seven defense patterns of 19, the ranged and training code of 16 line by line, the cavern and Deep code of 18 line by line, and the label algorithm of 22: these were checked by search and by their scenarios, not read whole.
- Anything about the UI (T-116).

## Follow-up

| Task | Bug | Severity |
|---|---|---|
| T-180 | 16. A second tool leaves the first one in the dwarf's hands | breaks a fortress |
| T-181 | 17. A sprung cage trap is never re-armed | wrong result |
| T-182 | 18. A workshop stops on a job it cannot supply | wrong result |
| T-183 | 19. A hunter carries the wrong corpse | wrong result |
| T-184 | 20. A paused save after a designation plays differently | wrong result |
| T-185 | 21. A thief with nothing to steal ends as `looted` | wrong result |
| T-186 | G1 to G18, the rules to write down or remove | — |
| T-187 | C13 to C24 and the suspected items | cosmetic |

Each has a work file in `docs/work/` with the reproduction and a proposed resolution. The probes worth keeping join T-176.
