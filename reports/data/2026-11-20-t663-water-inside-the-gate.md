# T-663: water inside the gate

**Task:** T-663 · **Date:** 2026-11-20 · **Code:** branch `t663-water-inside` · **Source:** [the T-663 work file](../../docs/work/T-663-water-inside-the-gate.md), [T-656's report](2026-11-20-t656-thirst-under-the-alert.md)

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

- **The hall stays dry.** Water lifts by pressure only into open tiles above a full body (rule 3). The cistern, fed sideways through the floodgate, does not fill: a tile at `L − 1` gets a unit from its neighbour only by equalizing, whose budget a real flow renews (rule 2), so the cistern's tiles settle one short of full and the shaft's full column never joins them as one body. Left open to the brook for eight days (a local probe), the cistern held 56 units in its nine tiles, the well's own tile at 7, and nothing rose up the well's column, though the brook stands eight levels higher. So the floodgate is not what keeps the hall dry today; it is what shuts the tunnel, open to the surface by its stair, out of the halls until the brook fills it, and what would keep the hall dry if pressure carried through a level tunnel. That difference from 04's hint ("water rises to the level of its source") is [a follow-up](../../docs/work/T-NEW-pressure-through-a-level-tunnel.md).
- **The cistern keeps its water.** Drinking from a well or a water tile takes none (10), a body with neighbours does not evaporate (rule 4), and underground water never freezes (04 § Freezing and thawing). One fill lasts.
- **The feed's side is sealed by its water.** After the breach the shaft, the tunnel to the floodgate and the stair beside the shaft fill to the brook's level, too deep to walk (22).

### Shelter and drink search

The drink search takes a stocked barrel, then a barrel anywhere, then a working well, then a water tile (10 § Eating and drinking), so with the drink gone a dwarf goes to the well before the brook. Under a hearth alert a sheltering civilian serves a want-level thirst from a target inside its shelter; the well's stand tiles lie in the hearth hall, so it drinks there and never reaches critical thirst; a critical thirst takes the well too, being nearer in the search's order than the brook. The well needs no rule of its own in 19.

### How far the water goes

A level tunnel carries the brook's water only so far. Spread hands a neighbour a unit only when it stands two lower (rule 2), and equalizing moves the rest a unit at a time on a budget, so a 1-wide tunnel at one level, fed from a full column, settles into a falling profile and stops within about 2,000 ticks: in a local probe on `flat-test` (a column of seven over a source, then 40 tiles of tunnel) the levels ran `7 7 6 5 5 5 …` down to 1 at the 35th tile and nothing beyond, the same at 40,000 ticks. The three-year fortress's hearth hall lies 25 to 50 tiles of tunnel from its brook (on every map of the twenty), and in `three-years-p4-4` a 37-tile tunnel with the floodgate midway left the cistern dry through 50 days of opening and shutting it. So a cistern under the hall is no answer there, and the script puts the well where the water reaches.

## The three-year script

[`three_years_cistern.ts`](../../test/scenarios/three_years_cistern.ts) plans on its first look and builds from day 56, a step ahead of routine work (testing-strategy.md § The long scenarios has the rules):

- **Where.** Under a corner of the hearth hall when the tunnel is at most 20 tiles (none of the twenty maps), else under a 3 × 3 well room on the hall level within 10 tiles of the brook, joined to the halls' south or west corridor by a passage of its own: on all twenty maps, a tunnel of 3 to 6 tiles and a passage of 13 to 26. Under an alert a sheltering dwarf does not walk there for a want-level thirst (the room is outside its shelter, 10 § Behavior selection step 2), but with no drink left a critical thirst takes it there underground, and no longer up the stair to the brook.
- **Nothing else digs beside its water.** From the plan on, `keepOff` (`script-commands.ts`) leaves the tiles around the cistern, its feed and its columns out of every designation of the script that opens rock, and the mines, the deep shaft, the workshop hall, the hall level's blocks and the surface workshops choose around them. Planned on day 2, before any of them is dug.
- **What the building taught.** Each of these stalled or hurt a probe before it was fixed: the floodgate's tile is dug last and only once the stair stands whole (a miner digging the tunnel from the hall's side was shut on the brook's side when the floodgate went up, with the stair not yet down to him); it is dug with the floodgate in stock and no alert up, and the floodgate goes up ahead of all other work (until it stands, the tunnel joins the halls to the surface by the stair); the stone dug on the brook's side is left forbidden where it lies (hauling it sent haulers out to the brook and down the stair; the depot's cargo now skips forbidden goods); the stair and the brook's half of the tunnel are forbidden to traffic and the bank is opened only when no dwarf is in them; a channel's ground may have grown a sapling or a shrub since it was planned; the lever's link is ordered again when its job is given up, at the cistern's priority (left at its own, it stood open for 50 days); and the floodgate stays open until the water stands under the well (opened and shut at once, the far half of a long tunnel never got enough to carry it on).

The sweep's journal: `[three_years_cistern]` when planned (`room` or `hall`, the tunnel, the passage), at the breach, at each lever pull and when the well first works; `[three_years_thirst]` adds `waterIn` (drinks of water taken indoors under the alert) beside `waterOut`, `[three_years_drink]` the week's `waterIn`, and `[three_years_thirst_death]` whether the dwarf fell within eight tiles of the feed (`nearFeed`).

## The sweep: not accepted

Sweep `44850405030` on `d9a83b31` (master `1eb078c7` merged), the script with the well room on every map. From its `sweep-verdict` job:

| | Alive | Grown | Hungry | Living | Deaths | Extinct | Need deaths |
|---|---|---|---|---|---|---|---|
| Shift 0 | 19 | 7 | 1 | 982 | 133 | 3 | 13 |
| Shift 50 | 20 | 7 | 1 | 1019 | 118 | 3 | 8 |
| Shift 100 (19 seeds) | 19 | 7 | 1 | 869 | 199 | 4 | 3 |
| Shift 150 | 19 | 7 | 2 | 897 | 219 | 4 | 4 |
| Pooled | 19.25 | 7 | 1.25 | 941.75 | 167.25 | 3.5 | 7 |
| Reference | 19.5 | 7 | 0 | 1010.5 | 137 | 1.75 | 6.25 |

Bounds 887.75 living and 161.88 deaths. **Verdict: not judged (shift 100: 19 of 20).** Bounds exceeded: peril-0 with need deaths, dwarf deaths. Master's latest (`44830514124`, T-661) pooled 1096 living and 124.75 deaths: the script as it stands costs about 150 living and 40 deaths, and a peril-0 fortress with need deaths in each sweep.

Two seed jobs failed:

- `three-years-p2-4` at shift 50: the invariant checker found the founder miner standing on an open tile of the feed shaft, (5, 25, 30), from tick 82,800 to the end. The shaft is channelled before its stair reaches that level, so the channeller had no neighbour to step to, and it did not fall either ([a follow-up](../../docs/work/T-NEW-channeller-left-in-the-air.md)).
- `three-years-p2-3` at shift 100: the script threw on `AddWorkOrder` rejected `not_found` for `forge_crafts` at tick 138,000 (`three_years_economy.ts`, the "iron goods" phase): the forge it had placed was gone. The cistern's code orders nothing there under that name; the timeline differs, and the script's own order does not look for a missing forge. Not traced further.

Not traced either, under the quota pause: where the deaths and the lost living come from. Candidates, from the probes: the cistern's work at a step ahead of routine work takes the two miners (and the mechanics) for weeks in the first half of year 1; `keepOff` turns some upper-mine drifts away; the brook-side work (stair, shaft, bank) puts miners at the brook, where ambushes wait at perils 2 and 4 (the probes' deaths were not near the feed, `nearFeed` in the journal, but they were few). The sweep's logs carry the journal to answer it (`[three_years_cistern]`, `nearFeed`, `waterIn`). In the seeds looked at, the well worked from day 111 (`p4-4`, a probe) and day 145 (`p4-5` at shift 0, the sweep), and under alerts after that the fortress drank indoors (20 to 42 drinks of water indoors in four alerts of `p4-5` at shift 0, none outdoors).

## What is left

- The scenario stands: water can be brought inside with the game as it is.
- The three-year script's cistern is not acceptable as it is: it needs the shaft to wait for its stair, the latent `forge_crafts` throw guarded, and the cost to the fortress traced (and probably the work kept at routine priority, or started later), then a sweep.
