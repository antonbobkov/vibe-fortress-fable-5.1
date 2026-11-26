# T-793 — Decide what a settled fortress of 80 does with its idle half

**Closed:** 2026-11-26, in 5254e90e.

**Source:** playtest 7 ([report](../../../reports/data/2026-11-26-playtest-7.md), finding 6) · **Size:** M (a decision, a measurement, then a small rule) · **Needs:** — · **Status:** done (option 2; option 1 measured and not adopted; option 3 waiting on the owner)

## Why

From Year 4 the three-year script's fortress is finished. It has its halls, its standing orders and its defence, and the cap of 80 is reached in Year 4. The playtest's Mood panel on Day 1 of Spring, Year 4 (66 dwarves): "-4 I have nothing to do. x46 · Helps: work: dig, chop or order goods; or a squad on Train". On Day 1 of Spring, Year 7 (80 dwarves): "-4 I have nothing to do. x47", with Units "(80, 21 idle)" (46-y7-e.png, 46-y7-u.png). In my own Year 4 the Jobs panel read "4 open · 4 claimed · 14 blocked" for 66 dwarves. The standing orders were all "stocked", the wood was gone ("waiting for log (0)" on five orders), and the jeweler and the craftsdwarf had nothing they could reach.

The rest of those three years at peril 2 repeats itself (events.txt):

- one Gloam raid of 16 a year, always a "horde", always "looted" while the fortress sat locked in;
- thieves (seven, all withdrew) and two bandit raids;
- four ambushes, which killed 0 to 2 dwarves each;
- the Thane wishing for "something strong: 10 deepfire" in 10 of 12 seasons;
- smaller trades every year: the Mountainhome sold 438 ☼ in Year 4 and 102 ☼ in Year 5, and the Hillfolk 148 ☼, 48 ☼, then 13 ☼ in Year 6. This is the script's trade policy, but nothing in the game pulls it up;
- no siege (none at peril 2), no masterwork, artifact or legendary, no tantrum or sulk in six years;
- 71% of the wealth in meals (81,323 of 115,252 ☼, 47-y7-stocks-s.png).

The idle half's "nothing to do" is a −4 to −8 thought held all year long. It fades only when the player makes up work.

This is a design gap, not a fault: the fortress is safe and content. But Years 4 to 6 give a player at peril 2 little to decide.

## What to do

Decide, then measure. Options, to weigh in this order:

1. **The hall is something to do.** An idle dwarf who spends its idle hour in the hearth hall (talking, singing, sitting) does not gain purpose. The `restless` thought then belongs to idlers with no hall or a shut one. That makes "nothing to do" a nudge toward a hall rather than a year-long penalty. It costs nothing at peril 2, where the hall is full anyway.
2. **Late-game sinks that are already in the spec, put in front of the player:** a hint at the cap ("The fortress has reached its cap: [p] raises it, or the idle may take up a craft, train in a squad, or dig for what the deep holds") naming the deep, the runeforge and a squad on Train.
3. **Peril grows with renown.** Peril 2 sends the same raid of 16 a year from Year 2 to Year 6. A renown above 60 (Year 4 here) could add the next peril's kinds (a siege) or band sizes. This is a balance change for the threat schedules (18 § Schedule) and needs the sweep.

The owner chooses. Measure option 1 or 3 on the three-year sweep at peril 2, extended to six years: idle share, the `restless` thought's mean, deaths.

## Decision (the orchestrator, 2026-11-26)

- **Option 1, tried and not adopted.** The rule tried: an hour that ends with the dwarf awake, working no job and standing on a hearth hall tile lowers purpose by 4 instead of raising it by 2 (`PURPOSE_HALL_PER_HOUR`, *unmeasured*). A hall the dwarf cannot reach is never where it stands, so `restless` would stay with the idle that have no hall or a shut one. Holding purpose flat in the hall (rate 0) would not have been enough: a night's sleep adds 16 and the meals' walks a few more, and nothing in the hall takes them off, so an idle dwarf would still sit at the want threshold. Measured on commit `403567fc` (`t793-idle-half`); it failed the sweep, so the rule is removed and 10, 15 and the Mood panel's `restless` remedy are as they were.
- **Option 2, done.** `hint_cap`: when the living dwarves reach the population cap (21), hourly, once: "The fortress has reached its population cap: [p] raises it. The idle wait in the hearth hall. For more to do, put a squad on Train [m], dig down to the caverns and what the deep holds, or build a runeforge [b > Workshops] for runecraft." Each sink exists in the spec: squads in `train` mode (16 § Squads), the caverns and deepsilver by the Sea of Fire (03, 18), the runeforge and runecraft (25; a workshop in Build > Workshops). Spec: `ui-keymap-and-screens.md` § Hints, 24 § Hints, `row-order.md`.
- **Option 3 (peril grows with renown) is waiting on the owner.** It is a balance direction for the threat schedules (18 § Schedule), not taken here: [T-802-peril-grows-with-renown](../../work/T-802-peril-grows-with-renown.md) holds it until the owner decides.

## Measurements of option 1

**The twenty-seed sweep** (measure.yml run 45856387232, four shifted sweeps): pooled living 1140, dwarf deaths 133.75, need deaths 2.25 (9 at shift 150, on `three-years-p2-7`, with a container invariant finding: a chest no dwarf reaches). By shift: living 1140, 1141, 1168, 1111; deaths 144, 129, 116, 146. Verdict **blocked**: deaths over the 132.5 bound. Master is about 1170 living and 111 deaths, so deaths rose by about 22, against the 8 allowed.

**The defence check** (run 45856392348, eight seeds at cadences 20 to 55): pass, raids turned back 7.63 of 8, a soldier killed 6.13 of 8.

**Six years at peril 2** (a probe on two throwaway branches, `t793-probe-base` on `974d8ce1` and `t793-probe-rule` on `403567fc`; `test/scenarios/t793-probe.test.ts` drives the three-year script for 672 days and samples every 300 ticks: idle share = activity "No job", the `restless` mean over all dwarves, holders = share holding it). Runs 45856471174 and 45856475366 (base), 45856481036 and 45856485484 (rule).

| Seed, year | Idle share base / rule | `restless` mean base / rule | Holders base / rule | Mood mean base / rule | Deaths base / rule |
|---|---|---|---|---|---|
| playtest-1126-p2, Y4 | 0.111 / 0.159 | −1.44 / −0.23 | 0.40 / 0.06 | 65.7 / 66.8 | 3 / 3 |
| playtest-1126-p2, Y5 | 0.157 / 0.161 | −1.78 / −0.16 | 0.48 / 0.04 | 65.1 / 65.3 | 3 / 7 |
| playtest-1126-p2, Y6 | 0.173 / 0.135 | −2.11 / −0.15 | 0.55 / 0.03 | 64.3 / 66.6 | 3 / 1 |
| three-years-p2-3, Y4 | 0.119 / 0.102 | −1.05 / −0.10 | 0.30 / 0.03 | 66.5 / 66.5 | 1 / 1 |
| three-years-p2-3, Y5 | 0.009 / 0.011 | −0.35 / −0.03 | 0.10 / 0.01 | 66.6 / 63.8 | 3 / 6 |
| three-years-p2-3, Y6 | 0.008 / 0.010 | −0.33 / −0.04 | 0.09 / 0.01 | 65.6 / 62.6 | 1 / 1 |

The rule did what it was for: by Year 6 on the playtest's seed, `restless` went from more than half the fortress to 3%, and its mean from −2.1 to −0.15. The idle share did not change (the rule gives no work), and the mood rose by at most about 2. The sweep's deaths are what stopped it. Nothing in the rule kills directly, so the rise may be the timelines moving with a changed mood (immigration, sulks), but it was not traced, and the bound holds.

## Done

- [x] The decision recorded here; option 1's rule was measured and not adopted, so 15 and 10 are unchanged; option 3 waits on the owner (T-802-peril-grows-with-renown).
- [x] The tried rule's sweep, defence and six-year figures above; the hint, `hint_cap`, with its test (`test/unit/ui/t793-cap-hint.test.ts`).
