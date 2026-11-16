# T-571: where the sweep's living went

**Date:** 2026-11-15 · **Commits:** `4ab37734` (T-544 with T-545, the reference) to master `b4750f39` (after T-567) · **Data:** [the attribution tables](../data/2026-11-15-t571-growth-attribution.md), [the probe](../data/2026-11-15-t571-growth-watch.probe.ts.txt), [the sweep with dormitories](../data/2026-11-15-t571-sweep-verdict-dormitories.md), [T-567's sweeps](../data/2026-11-15-t567-sweeps.md)

## The question

The pooled sweep's living fell across the Making Do merges, from the reference's 1024.25 to 922 on master `f5c91764`, against a bound of 898.25. Deaths fell too, and peril-0 fortresses, which hardly lose anyone, fell from 456 to 428. So fortresses grow slower. Which merges, and what in them?

## How

- **Living is the founders plus the immigrants less the dead.** No dwarf is born in any timeline of any run. So the question is the waves: how many come and how big.
- **Every season's immigration evaluation is in the logs.** Each seed's `[three_years_economy]` line lists, for every season, the hall spirit, the wealth, the eligibility, the roll and its probability, and the wave's size. I read them for every kept sweep since T-544 (fourteen runs, 1,120 timelines).
- **The rolls' luck taken out.** A non-guaranteed wave comes on a roll of about 70%. A run's failed rolls against the number expected from their probabilities, times its mean wave size, is how much of its living was luck. Taking it out cuts the spread of a sweep's living from 56 to 37 dwarves.
- **More shifts.** Shifts 200 to 350 of `3b7a3117` (master after T-548 and T-547, run 43762037484), so two periods have eight.
- **Where the dwarf-time goes.** A probe counts, every tick, each dwarf working, on the sleep errand, or eating and drinking, and how each sleep ends: on the floor, a pallet, a bed, or woken. It ran master just before T-551 (`427fc9d0`) and at T-551's merge (`4eea2920`) at shifts 0 and 50 (runs 43762771314 and 43762773467), and on the fix (run 43765955049). It changes no timeline: its seeds end on the plain runs' hashes.

## What was found

**About half of the drop is the reference's luck.** In the reference's four shifts, 37.8 rolls a sweep failed against 44.8 expected. That is seven more waves than chance gives, about 56 dwarves. Its other four shifts (972.25) failed 1.9 more than expected. With luck taken out, T-544 stands at 968 and 986, 977 over its eight shifts. Master `f5c91764`'s 922 had slightly bad luck: 934 without it. The peril-0 figures are luck almost entirely: 460 adjusted for T-544, 449 to 460 for every later run.

**With luck out, the level fell in two steps:**

| period | sweeps | adjusted living |
|---|---:|---:|
| T-544 with T-545 | 8 | 977 |
| after T-548, T-547 and T-553 (T-550 alone too) | 20 | 956 |
| after T-551 (with T-550, T-552, T-567) | 20 | 926 |

A 4-shift figure is ±18.5 after the adjustment, an 8-shift one ±13. So the first step is not clearly more than noise. The second is about three standard errors.

**By merge:**

- **T-548** (plants): 966 raw, 971 adjusted. Within noise of T-544's second half. T-567's probe with its conversions off (908.75, 916 adjusted) brought nothing back, so the conversions cost nothing visible.
- **T-547** (materials): alone on T-544, 1052 raw (989 adjusted; the luckiest run of all). With T-548, 972.25 and 963.5 over eight shifts, 959 adjusted. That is −18 against T-544, mostly deaths at peril 4 (bled out, 57 to 71 a sweep). Deaths at peril 4 swing ±15 between sets of four shifts, so this is not attributable.
- **T-553** (kiln): 968.5, 947 adjusted. Within noise.
- **T-554** (cellar) and **T-549** (wicker, splints): no effect at all. Their sweeps came out seed for seed identical to the commits before them.
- **T-551** (beds rest differently, the floor at 50): 955.25, 939 adjusted. Then master with T-550 922 (934), T-552 937.5 (937.5), T-567's draft 922.75 (903.5). The mechanism is below; it is the second step.
- **T-550** (sundries, scarcity prices): alone on master before T-551, 964.5 (947 adjusted). No effect.
- **T-552** (drying racks): 937.5 on top of `f5c91764`'s 922. No effect.
- **T-567** (script fixes): 922.75 raw, 903.5 adjusted, the lowest. It skipped the most waves for low spirit (32.2 a sweep).

**T-551's floor at 50 is the second step, through the script's beds.** The three-year script plans 16 to 20 bedrooms, the hospital among them. The south corridor's rooms run off the 48 × 48 map's edge, and the carpenter's bed order is capped at the planned rooms. So beds stop at about 20 while fortresses reach 40 to 80 dwarves. On `three-years-p0-1`, 20 beds lie made by day 196 while the population climbs to 61. Before T-551 that cost a −4 thought: a floor sleep rested at 100, like a bed. At 50 it costs the sleep itself. Over the same 40 timelines, before and after T-551:

| | work, before → after | sleep errand, hours a day | floor share of sleeps |
|---|---|---|---|
| first month | 51.7% → 44.1% | 6.1 → 9.0 | 84% → 88% |
| year 1 | 36.9% → 35.2% | 6.3 → 7.4 | 25% → 28% |
| year 2 | 31.8% → 28.5% | 6.3 → 7.4 | 30% → 27% |
| year 3 | 30.9% → 26.0% | 6.2 → 8.1 | 56% → 51% |

T-551's sleep audit measured only the first 112 days, where it found working time barely moved (−0.2 points pooled over three seeds). Over three years the fortress loses 2 to 5 points of working time, a sixth of it by year 3. Wealth follows: year-2 food and drink stock, most of a fortress's wealth, fell by about 7% (510,000 to 472,000 marks a sweep). The waves follow too. After T-551, 30 evaluations a sweep were skipped for hall spirit under 55 at perils 2 and 4 (25 before), and non-guaranteed waves were smaller (7.58 against 7.72).

**How much of the drop the 50% floor explains.** Between the reference run (1024.25) and master `f5c91764` (922) lie 102 dwarves. Of these, 68 are the two runs' roll luck: +56 in the reference, −12 in master. The other 34 are real: 968 to 934 adjusted. Over the periods, which have more sweeps, the real fall is 51 (977 to 926). Of that, 21 is the first step, within noise and mostly peril-4 deaths. About 30 is the second step, the 50% floor on the dwarves the script left without beds: half of all sleeps by year 3. So the floor explains about 30 of the 102, some three-fifths of the real loss. With every dwarf in a bed under the same rules, the same master gives 982 adjusted, 1016 raw: more than those 30 back. The rest of the gain is the floor's −4 thought, which the shared bed's −1 replaces. The script paid that thought before T-551 too.

**The script, not the rule, was at fault.** A player whose dwarves sleep on the floor makes beds: the beds were made, and lay in stock. T-551's design wants a bedless dwarf to cost something, and keeping a bed for everyone is the play the rule asks for. The founders' first month (88% of sleeps on the floor, 9 hours a day asleep) is left as it was. The script's bedrooms are dug from day one and have beds within about two months. Day-one pallets of the wagon's cloth are T-568's and T-572's ground.

## The fix

`checkFortressRooms` now ends with `keepDormitories` (`test/scenarios/three_years_fortress.ts`). Once every bedroom plan is designated and the population plus two outgrows the plans and the dormitories, the script digs a dormitory. That is a block of rock four tiles by five on the hall level, nearest the stair's foot, beside a dug corridor or drift that the halls reach (`dormitorySite`). Every tile is undug, undesignated, dry rock that is in no plan and opens to no hillside, and every tile around it is rock or such a corridor. Once dug, a bed is placed on a tile of it for each dwarf, and the hospital, without one. Beds do not block a walk. A bed outside a bedroom is a free bed (14 § Beds), and its sleeper thinks `slept_in_shared_bed_room` (−1). The carpenter's bed order counts the dormitory's tiles with the bedrooms (`three_years_economy.ts`). Every seed has at least four such sites (checked over the 20 seeds with the hall level dug).

On master `b4750f39` (run 43765955049, shifts 0 to 150): floor sleeps fall to 3% in year 2 and 0.7% in year 3. The sleep errand is back to 6.5 and 6.3 hours, and working time to 31.7% and 29.9%. Skips for low spirit fall to 22.5 a sweep, and Content evaluations rise from 14% to 21%. The sweep pools 19.75 / 7 / 0 / 1016 / 120 / 0.5 / 0.25 and passes. One seed job, `p4-4` at shift 0, failed its witness: "gate doors built". That fortress ended with one dwarf after an 11-strong raid looted it on day 329. A seed job is not judged on the set rule, and the verdict passes. The instrument (run 43765960225) pools 13 / 9.13 / 10.5 / 152.25 / 10.38 and passes. Shifts 200 to 350 of the same code without the probe (`6b1b230f`, run 43769154757) pool 19.75 / 7 / 0 / 956.75 / 117 / 0.25 / 1.25. That is about 986 over eight shifts, against 922 to 937.5 for the four master commits before. Shift 250 lacks `p2-7`, whose job ran 53 minutes and left no log or result. Two other seed jobs failed on their own checks. `p4-1` at shift 300 ended without a dining hall. `p2-4` at shift 200 broke the invariant `job.worker-unconscious (plant)` at tick 277200: a plant job kept a worker who had fallen unconscious. That is a jobs fault outside this task, and the dormitories only moved the timeline onto it. It is filed ([T-NEW](../../docs/work/T-NEW-plant-job-unconscious-worker.md)).

## Not done

- **The reference is not refreshed.** The owner's T-572 moves the rest band (floor 85%, pallet 90%, stone bed 95%, wooden bed 100%, made-up 110%), and the refresh comes after it. The 50% floor's cost will mostly go with it. The dormitories still matter there: the floor's −4 thought, and 15% of a sleep.
- **The walk to bed** takes 3 to 4.5 hours of the 6 to 8 hour sleep errand in every period, before T-551 as after (T-551's audit saw the same). It is unchanged by this task.
