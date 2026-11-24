# T-663: water inside the gate

**Task:** T-663 · **Date:** 2026-11-20 · **Code:** branch `t663-water-inside` · **Source:** [the T-663 work file](../../docs/archive/tasks/T-663-water-inside-the-gate.md), [T-656's report](2026-11-20-t656-thirst-under-the-alert.md)

## The question

A fortress whose drink runs out under an alert has the brook to drink from, outside the gate, where the ambushes wait (T-656). The game has no aquifer, and a well needs open water within `WELL_DEPTH` below it (14), so can a player bring the brook inside with what the game has: a channel, a floodgate, a cistern under the halls and a well over it?

## The answer: yes, with the game as it is

Nothing in the game had to change. [`bd_cistern_well`](../../test/scenarios/bd_cistern_well.scenario.ts) plays it on a generated Serene Vale with a brook, from the Balanced embark, by commands (the floodgate, mechanisms, a chain, blocks and a door are laid by the wagon on day 1): a stair down to a 5 × 5 hall five levels under the brook's water, and under it, laid out from the brook's course by [`cistern-well.ts`](../../test/scenarios/cistern-well.ts):

- a stair from the surface beside the brook down to the cistern's level, and beside it a shaft channelled level by level (water falls only through open tiles: every stair is solid-bottomed, 04 § The four movement rules, rule 1), the miner stepping off each level onto the stair rather than falling;
- a tunnel at the cistern's level from the shaft's foot toward the hall, a floodgate midway on it (dug toward from both ends, its own tile last, once the stair stands whole, so nobody is shut on the brook's side without a way out), on a lever in the hall;
- a 3 × 3 cistern three levels under the hall, reached while it is dug by a stair from the hall; the well's column channelled from the hall's floor down to it;
- the bank beside the brook channelled last: the bank's wall at the water's level becomes a ramp, and the brook runs into the shaft, down to the shut floodgate. The lever opens the floodgate and shuts it once the water stands under the well (about 180 ticks), and the well goes over the water (its placement asks for the water, 14).

It is built by day 11. Asserted: the well works and the floodgate is shut again; no water ever stands on the hall's level; two quiet days later the cistern keeps its water; and under a hearth alert with every drink forbidden, all seven dwarves shelter in the hall, each drinks at the well (a want-level thirst is served there because the well stands in the hearth hall, 10 § Behavior selection step 2; one of them at critical thirst), and none goes out for a drink.

### What the fluids do

- **The hall stays dry.** Water lifts by pressure only into open tiles above a full body (rule 3). The cistern, fed sideways through the floodgate, does not fill: a tile at `L − 1` gets a unit from its neighbour only by equalizing, whose budget a real flow renews (rule 2), so the cistern's tiles settle one short of full and the shaft's full column never joins them as one body. Left open to the brook for eight days (a local probe), the cistern held 56 units in its nine tiles, the well's own tile at 7, and nothing rose up the well's column, though the brook stands eight levels higher. So the floodgate is not what keeps the hall dry today; it is what shuts the tunnel, open to the surface by its stair, out of the halls until the brook fills it, and what would keep the hall dry if pressure carried through a level tunnel. That difference from 04's hint ("water rises to the level of its source") is [a follow-up](../../docs/archive/tasks/T-688-pressure-through-a-level-tunnel.md).
- **The cistern keeps its water.** Drinking from a well or a water tile takes none (10), a body with neighbours does not evaporate (rule 4), and underground water never freezes (04 § Freezing and thawing). One fill lasts.
- **The feed's side is sealed by its water.** After the breach the shaft, the tunnel to the floodgate and the stair beside the shaft fill to the brook's level, too deep to walk (22).

### Shelter and drink search

The drink search takes a stocked barrel, then a barrel anywhere, then a working well, then a water tile (10 § Eating and drinking), so with the drink gone a dwarf goes to the well before the brook. Under a hearth alert a sheltering civilian serves a want-level thirst from a target inside its shelter; the well's stand tiles lie in the hearth hall, so it drinks there and never reaches critical thirst; a critical thirst takes the well too, being nearer in the search's order than the brook. The well needs no rule of its own in 19.

### How far the water goes

A level tunnel carries the brook's water only so far. Spread hands a neighbour a unit only when it stands two lower (rule 2), and equalizing moves the rest a unit at a time on a budget, so a 1-wide tunnel at one level, fed from a full column, settles into a falling profile and stops within about 2,000 ticks: in a local probe on `flat-test` (a column of seven over a source, then 40 tiles of tunnel) the levels ran `7 7 6 5 5 5 …` down to 1 at the 35th tile and nothing beyond, the same at 40,000 ticks. The three-year fortress's hearth hall lies 25 to 50 tiles of tunnel from its brook (on every map of the twenty), and in `three-years-p4-4` a 37-tile tunnel with the floodgate midway left the cistern dry through 50 days of opening and shutting it. So a cistern under the hall is no answer there, and the script puts the well where the water reaches.

## The three-year script

[`three_years_cistern.ts`](../../test/scenarios/three_years_cistern.ts) plans on its first look and builds as routine work once the drink has run short (under four days for the adults, from day 56) (testing-strategy.md § The long scenarios has the rules). **It is off by default** (`FortressState.waterInside`): on the twenty-seed sweep it cost more than it saved (below).

- **Where.** Under a corner of the hearth hall when the tunnel is at most 20 tiles (none of the twenty maps), else under a 3 × 3 well room on the hall level within 10 tiles of the brook, joined to the halls' south or west corridor by a passage of its own: on all twenty maps, a tunnel of 3 to 6 tiles and a passage of 13 to 26. Under an alert a sheltering dwarf does not walk there for a want-level thirst (the room is outside its shelter, 10 § Behavior selection step 2), but with no drink left a critical thirst takes it there underground, and no longer up the stair to the brook.
- **Nothing else digs beside its water.** From the plan on, `keepOff` (`script-commands.ts`) leaves the tiles around the cistern, its feed and its columns out of every designation of the script that opens rock, and the mines, the deep shaft, the workshop hall, the hall level's blocks, the farm strips and the surface workshops choose around them. Planned on day 2, before any of them is dug, and never under a zone.
- **What the building taught.** Each of these stalled, killed or broke an invariant in a probe or a sweep before it was fixed:
  - The two sides of the tunnel never meet but through the shut floodgate. In the first sweep raids came in by the cistern's stair while the floodgate's tile stood dug and unbuilt, and wiped out whole fortresses at perils 2 and 4 (`p2-7` at shift 150: 46 dead in days 271 to 277, inside the halls). Now the hall's side digs the floodgate's tile and builds the floodgate; the brook's side stops a tile short and digs that tile only once the floodgate stands, from its stair.
  - Each shaft level is channelled only once the stair beside it reaches that level, so its miner steps onto the stair (first sweep, `p2-4` at shift 50: a miner left standing over the open shaft; [a follow-up](../../docs/work/T-689-channeller-left-in-the-air.md) asks why it did not fall).
  - The stone dug on the brook's side is left forbidden where it lies (haulers went out to the brook and down the stair for it; the depot's cargo now skips forbidden goods). The stair and the brook's half of the tunnel are forbidden to traffic before the bank is opened, and the bank waits for them to be empty; the cistern's side the same before the floodgate opens (second sweep, `p2-1` at shift 150: seven thirsty dwarves in it drowned when it opened).
  - No farm strip goes on the feed's ground (second sweep, `p2-3` and `p2-4` at shift 0: a strip tile left unreachable beside the shaft).
  - The lever's link is ordered again when its job is given up, at the cistern's priority (left at its own, it stood open for 50 days); a channel's ground may have grown a sapling, a shrub or a tree; the floodgate stays open until the water stands under the well.

The sweep's journal: `[three_years_cistern]` when planned, when started, at the breach, at each lever pull and when the well first works; `[three_years_thirst]` adds `waterIn` (drinks of water taken indoors under the alert) beside `waterOut`, `[three_years_drink]` the week's `waterIn`, and `[three_years_thirst_death]` whether the dwarf fell within eight tiles of the feed (`nearFeed`). These lines are written whether the cistern is on or not.

## The sweeps

**First** (`44850405030` on `d9a83b31`, built from day 56 a step ahead of routine work): Pooled 19.25 | 7 | 1.25 | 941.75 | 167.25 | 3.5 | 7, not judged (shift 100: 19 of 20), over the death and peril-0 need-death bounds. The extra deaths were whole fortresses lost to raids through the cistern's stair (deaths at peril 2: 228 before, 391 with it, most in days 112 to 223), and the work took the miners in year 1.

**Second** (`45038892159` on `a1480973`, master `a513d903` merged, the fixes above to that point, routine work once the drink ran short). From its `sweep-verdict` job:

| | Alive | Grown | Hungry | Living | Deaths | Extinct | Need deaths |
|---|---|---|---|---|---|---|---|
| Pooled | 20 | 7 | 0.75 | 1115.25 | 121.75 | 0 | 4 |
| Reference | 20 | 7 | 0 | 1151.75 | 98.25 | 0 | 0 |

Bounds 1046.63 living and 132.5 deaths; **Verdict: pass**, nothing worth tracing by seed; but `p2-3` and `p2-4` at shift 0 were red (the farm strip). Against master's latest (`45031734775`: 1140.25 living, 118 deaths, no need deaths), by peril, summed over the four shifts:

| Peril | Deaths, master → cistern | Of them | Living at year 3 |
|---|---|---|---|
| 0 | 5 → 13 | 11 starved (none before) | 1931 → 1903 |
| 2 | 195 → 199 | 8 drowned, 3 starved | 1587 → 1515 |
| 4 | 272 → 275 | 2 starved | 1043 → 1043 |

- **What it saved:** nothing measurable. At peril 4, where T-656's thirsty died at the brook, the deaths and the living are unchanged. Master's stills, barrels and second woodcutter (T-656) keep the drink up: the cistern started only where the drink ran short, mostly late in year 2 (`p0-3` at shift 0 on day 124, `p2-1` at shift 150 on day 206), and its well worked a few weeks later.
- **What it cost:** seven drowned in the cistern's side at the opening (`p2-1` at shift 150; fixed since, not measured), one more drowned (`p2-7` at shift 0, day 210, not traced), and 16 starved where master starved none: nine of them in `p0-3` at shift 0 on days 331 to 333, outdoors, with 947 meals and 1,000 drinks in stock, after the cistern was finished on day 171. Not traced: a group starving outdoors beside full stores looks stranded, and the feed's open shaft and channelled bank are the change to the surface, but the journal has no positions to show it.

So the script leaves the cistern off by default. The scenario stands, and the script's cistern can be turned on (`waterInside = true`) once the stranding is understood.

**Third** (`45046783384` on `55c0032d`, the cistern off): pooled 20 / 7 / 0 / 1097.25 living / 122.5 deaths / 0.5 / 0.5, verdict pass, every seed job green, worth tracing by seed: none. Identical to master's sweep at the time (T-683, run 45027251322: 1097.25 / 122.5), so with the cistern off the script plays as master does.

## What is left

- The scenario stands: water can be brought inside with the game as it is.
- The three-year cistern is off. To turn it on: find why nine dwarves of `p0-3` at shift 0 starved outdoors beside full stores, measure the cistern side's seal, and sweep with `waterInside` on.
