# T-510: cats off the hall's way in, measured

Branch `t510-t503-cats-range`, commit `8dec2397` (T-503's guard and T-510's change on master `6f5763ad`). Before: master's own runs on T-518's code (`44d3f334`, the same simulation as master).

## The cause, confirmed

The probe ([script](2026-11-07-t510-cats.probe.ts.txt), [output](2026-11-07-t510-probe-p0-6.txt)) plays `three-years-p0-6` as the sweep plays it. T-518 moved master's timeline, and on today's master `p0-6` no longer adopts the cats that stood together, so the probe was also run on T-508's code (`0348c100`, the timeline T-508 found them on): at day 328 hall tile 60369 holds two cats for 1,800 ticks, each with its owner in the hall one or two tiles away (one idle, one on a comfort errand) and no walk of its own. A pet within two tiles of its dwarf stopped where it stood (08 § Pets, "follows its dwarf loosely"), and T-463's spreading rule, which applies only to animals with no owner, never moved it; pets that came in the same way with their dwarves stopped on the same tile. Over that run owned pets were 202 of the 391 tame-animal counts on crowded hall tiles.

With T-510's animals system on the same code: no stretch of 1,200 ticks, owned pets 4 of 232 counts. On master and on T-510 to day 1,080: two dog-and-sleeper stretches of 1,200 ticks on master, none with T-510.

## The twenty-seed sweep (run 42372046622, verdict pass)

| | Alive y1 | Grown p0 | Need-death p0 | Living y3 | Deaths | Extinct | Need deaths |
|---|---|---|---|---|---|---|---|
| Before, pooled (42362123219) | 20 | 7 | 0 | 973.75 | 111.5 | 0.25 | 2 |
| T-510, pooled | 20 | 7 | 0 | 936.75 | 144.25 | 0.5 | 1.5 |
| Reference / bounds | 19.75 / ≥ 18 | 7 / ≥ 6 | 0 / ≤ 1 | 876 / ≥ 776 | 145 / ≤ 175 | 2.5 | 1.25 |

Seed jobs that failed: `p2-4` at shift 50 (its hall and dining-hall witnesses, 1 dwarf left at year 3; it fails on master's runs too) and `p2-6` at shift 150 (the invariant `party.active-with-no-living-member`: a gloam ambush retreating at t385,017 with its six members dead at the t385,200 sample; parties think every 50 ticks, so a sample taken between the last member's end and the party's next think sees this; not an animal matter).

### The hall's crowd watch, summed over the 80 seed-samples

| | Master before T-518 (42362125659) | Master (42362123219) | T-510 |
|---|---|---|---|
| Slowed hall tile-samples | 330,216 of 43,432,230 (0.76%) | 309,792 of 43,386,090 (0.71%) | 375,049 of 43,386,090 (0.86%) |
| By shift (0, 50, 100, 150) | 0.70, 0.79, 0.74, 0.82% | 0.70, 0.72, 0.61, 0.82% | 0.82, 0.90, 0.86, 0.88% |
| At the cap | 16,341 | 17,926 | 20,896 |
| Samples with a hall tile crowded over a day | 3 (`p2-7`@0 1,680, `p2-1`@150 1,340, `p4-3`@150 6,520 ticks) | 3 (`p2-3`@150 1,900, `p2-7`@50 1,540, `p4-4`@50 5,940) | 0 |
| Longest a hall tile stayed crowded | 6,520 ticks | 5,940 ticks | 960 ticks |
| Doors: slowed, longest | 10,757, 660 | 17,724, 220 | 18,445, 100 |

No hall tile stays crowded for a day on any seed at any shift. The trade-off: the hall's slowed share rises by about a tenth of a point at every shift, since pets whose dwarves are in the hall now stand in it, each on a tile of its own (curled cats and heaped pets count for nothing), where before they stood beside their dwarves, often outside the hall.

## The annual instrument (run 42372049000, verdict pass)

| | Median | Worst | Second-worst | Sum of the living | Wildlife-free | Extinct | Starved years |
|---|---|---|---|---|---|---|---|
| Before, pooled (42351239983) | 12.63 | 6 | 8.88 | 143 | 6.63 | 0 | 0 |
| T-510, pooled | 12.69 | 8.5 | 10 | 148.25 | 7.63 | 0 | 0 |
| Bounds | ≥ 11.38 | | | ≥ 130 | ≥ 4.13 | ≤ 2 | ≤ 2 |
