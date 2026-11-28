# T-813 — The builder's whims, without the deaths

**Source:** T-806 ([work file](../archive/tasks/T-806-thane-wishes-for-the-hall.md), § Measured and § Outcome); playtest 9 ([report](../../reports/data/2026-11-26-playtest-9.md), finding 5) · **Size:** M · **Needs:** — · **Status:** done: the cause found, not adopted

## Why

T-806 built five builder's whims (a statue in the hall, a grander hall, an engraved bedroom, a fine table and chair, a superior work), kept a drink whim's units from the fortress's throats, and stopped the same whim being drawn twice running. The Thane then wished for eight things instead of two. Over three sweeps, every variant, with or without the kept drink, ended 13 to 17 dwarf deaths over master (121.75 to 125.25 against 108.5), more than the 8 the adoption rule allows, so none of it went into the game. The code is on branch `t806-t807-wip`, commit `934c7013` (the kept drink's switch is `keptForThane` in `src/systems/dwarves/activities.ts`).

The extra deaths are fighting deaths, not thirst. Nothing reads a whim but `thane_pleased` (+3 to everyone for 72 hours, when it is met) and `thane_grumbled` (−1 to the Thane). The builder's rows are met less often than deepfire was: 24% of seasons against about 35%. A fortress pleased less often may fight a little worse, or the three sweeps may share the timeline's noise.

## What to do

Decisions taken here:

- **Find the cause before changing the rows.** Run the T-806 code with `thane_pleased` given on every judgement, met or not (a probe, not a rule). If the deaths come back to master's level, the mood is the cause. Then make the builder's rows no harder to meet than deepfire: for example, a `tier` whim only while the hall is within reach of the next tier, or a row's `count` lowered.
- **If they do not come back,** measure the rows over eight shifts (`-f shifts=0,50,100,150,200,250,300,350`) before deciding: three four-shift sweeps of one change sharing the same excess is not yet proof that it is real.
- The kept drink is measured last and alone. Its trade-off is fun ("The Thane's barrel"), and it may come back once the rows are settled.

## What was found

**What was measured.** T-806's code (`934c7013`) was brought onto the T-805..T-807 merge `ee41d537`, the base of every figure here. The rows and the no-repeat rule were measured; the kept drink was off (commit `b2cb7d1a`; `cda2cbc5` is the same play with the kept drink's code, spec text and panel words taken out, and is the code to start from again).

**Nothing in the game reads the new rows but the Thane's thoughts.** The trace probe (`test/perf/t813_whim_trace_probe.test.ts`, local only) plays one three-year seed with the sweep's loop and records, after every step, the world hash, a digest of the play (where every creature and item is, and each creature's mood), each whim drawn and judged, and each dwarf death with what the dwarf was doing when first wounded. With `thane_pleased` given on every judgement and `thane_grumbled` never, and the sweep's player not reading the whim, `ee41d537` and the rows play the same three years step for step on `p4-3` at shift 100 and `p2-4` at shift 150 (two of the seeds that moved most in T-806's sweeps): the same digest at every step, the same deaths on the same days, 54 and 49 living. The Thane wished for different things from day 85 and day 29. The draw, the `tier` and `engraved` kinds, the room checks and the no-repeat rule touch nothing else.

**Where the timelines part.** With the game as it is, the play parts one look of the script after the first draw that differs: day 86 on `p4-3` shift 100 (master drew fine meals, the rows a grander hall), day 30 on `p2-4` shift 150 and day 32 on `p4-4` shift 100. It parts there because the sweep's player answers master's two whims (`three_years_making_do.ts`, `answerTheThane` and `keepThanesShare`). For fine meals it raises the kitchen's order from 10 to 25 and moves it first. For something strong it adds a distilling ahead of the brew, raises the still's order from 10 to 20 and sets the deepfire aside. It answers none of the builder's rows. So the rows are met half as often: 335 of 1,359 seasons (25%) against master's 690 of 1,406 (49%), over eight shifts. On `p2-4` master's fine meals were met six seasons running, because the player cooked for them; the rows' statue, engraved bedroom and fine table were never met, because nobody made them.

**The victims** are those of master's fights, in other places: dwarves fleeing an ambush or a siege, at a meal, and soldiers on duty. On `p4-3` shift 100 master lost 16 in one ambush on day 191 and 21 in all, and the rows lost 10. On `p2-4` shift 150 both lost 6, and the rows' two deaths on day 63 cost them waves through hall spirit (62 living against 43), the amplifier T-808 found. On `p4-4` shift 100 it was 19 against 21. No death points at a whim.

**The sweeps** (twenty seeds; deaths and living pooled over the shifts):

| Code | Run | Shifts | Living at year 3 | Dwarf deaths | Whims met | Verdict |
|---|---|---|---|---|---|---|
| master `ee41d537` | 46074241906 | 0–150 | 1109.25 | 120 | 48% (328 of 682) | pass |
| the rows `b2cb7d1a` | 46074762719 | 0–150 | 1069.25 | 135.25 | 24% (164 of 670) | blocked (deaths over 132.5) |
| the rows, `thane_pleased` on every judgement (probe) | 46074803633 | 0–150 | 1120.5 | 129.25 | 26% (182 of 707) | pass |
| master `ee41d537` | 46105191451 | 200–350 | 1100.5 | 112.75 | 50% | |
| the rows `cda2cbc5` | 46105193630 | 200–350 | 1063.5 | 133 | 25% | |
| **master, eight shifts** | | 0–350 | 1104.88 | 116.38 | 49% | |
| **the rows, eight shifts** | | 0–350 | 1066.38 | 134.13 | 25% | |

Paired by seed and shift over the 160 runs, the rows add 0.89 deaths a run (SD 5.81, t 1.93; 100 of 160 moved): 17.75 a sweep, against the 8 allowed. Seven of the eight shifts lose more (shift 100 loses 29 fewer, one master seed there losing 42). The four new shifts alone give +20.25 (t 2.01), and T-806's rows on the old base gave +13.25 (t 1.22). So this is not only the timelines parting: the excess comes back on every base and shift set.

**The cause.** The rows take the place of the two whims the sweep's player works for, so the fortress is pleased half as often, cooks fewer fine meals and distils less (water drunk 16,595 times against 11,361 over the eight shifts). Its mood at year 3 is 1.2 lower (59.22 against 60.40), 166 fewer immigrants come, and 38 fewer dwarves live at year 3. The probe gives back the Thane's pleasure alone: mood comes back (61.77 against 61.86 at shifts 0–150) and so does living (1120.5 against 1109.25), and the deaths come about halfway back (129.25 against 120 and 135.25). The other half is likely the fine meals and deepfire the player no longer makes. Both are the sweep's player answering only master's two rows. A player who answered the Thane's statue as the script answers its fine meals would meet the rows as often. The sweep cannot show that until its player answers them.

## Decision

**Not adopted.** Over eight shifts the rows cost 17.75 deaths a sweep, more than the 8 allowed, so the rows, the `tier` and `engraved` kinds and the no-repeat rule stay out, and no spec text changes. The cause is not a rule that kills: the sweep's player stops working for the Thane when the Thane wishes for builder's things, and the fortress loses the mood and the stock the player made for him. The work file's fix, making the rows easier to meet, would not reach that: the script meets no row it does not answer. The follow-up `T-NEW-sweep-answers-builder-whims` gives the sweep's player answers to the builder's rows, then measures the rows again from `cda2cbc5`.

The kept drink was not measured: it comes after the rows, and "The Thane's deepfire is drunk" is now a keep in `fun-features.md`, so it stays out unless that call changes. The trace probe stays in `test/perf/` for the next whim change. Branch `t806-t807-wip` stays, as the follow-up starts from this branch's `cda2cbc5`.

## Done

- [x] The cause found and written here, with its run.
- [x] The builder's rows adopted within 8 deaths of master, with the spec edits that T-806 lists, or this file closed with the figures (closed: § Decision).
