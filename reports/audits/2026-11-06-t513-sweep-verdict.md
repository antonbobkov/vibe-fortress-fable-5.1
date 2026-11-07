# Measurement: the twenty-seed sweep's noise, and a verdict over four shifted sweeps

**Task:** T-513 · **Date:** 2026-11-06 · **Commits examined:** master `1a8f0ef4` (T-514) with only the shift input added (`b17c65f2`), twelve sweeps shifted 0 to 550 ticks; the same with a seed playing on after an invariant finding (`c50712e6`), three seed-shifts replayed locally; the final branch (`c7517918`), the one command · **Kind:** a measurement, a rule redesigned · **Source:** [the T-513 work file](../../docs/work/T-513-sweep-verdict-by-shifts.md), [T-507's sweep samples](2026-11-05-t507-three-years-food.md#the-timeline-samples), [T-509's instrument verdict](2026-11-05-t509-instrument-noise.md)

## The answer

- **One sweep is noise.** Ten sweeps of master, the same code shifted 0 to 450 ticks before the opening, give 718 to 973 dwarves living at year 3 (s.d. 66), 119 to 172 dwarf deaths (s.d. 15), 0 to 4 extinct fortresses and 0 to 16 need deaths. Peril-0 fortresses have need deaths in 4 of the 70 peril-0 timelines (`p0-3` in three, 1 to 16 dead; `p0-4` in one), and one sweep of the ten (shift 50, two hungry peril-0 seeds) breaks the set rule a single sweep was held to. Alive at year 1 (19 or 20) and peril-0 grown (always 7) are far inside it.
- **Small shifts are not new timelines.** Shifts 2 to 10 ticks end year 3 with the same world hash on every seed measured but one, and shifts 450, 500 and 550 on most seeds. Shifts 0 to 400, 50 apart, are each a timeline of their own on every seed. So the sweep's samples are 50 ticks apart, not 1.
- **The rule: four sweeps, one verdict, one command.** `gh workflow run measure.yml --ref <branch> -f suite=sweep` plays the twenty seeds at shifts 0, 50, 100 and 150 in parallel (80 jobs) and a verdict job pools them. The set rule keeps its meaning, read as a mean over the four: at least 18 of 20 alive at year 1, at least 6 of 7 peril-0 fortresses grown, at most 1 of 7 peril-0 fortresses with a dwarf dead of hunger or thirst. The living and the deaths are guarded too, from the best pooled figures: living at least the best minus 100, deaths at most the best plus 30. Over all 1,575 pairs of disjoint sets of four among the ten shifts, the two means differed by at most 96.25 living and 26.25 deaths. The second set of four shifts of master passes against the first.
- **What it catches.** A peril-0 fortress starving out in every timeline (blocked on hunger), three fortresses dead before year 1 (blocked), forty more deaths a sweep (blocked; T-482's apparent rise was about fifty), eighty fewer living (blocked), two peril-0 fortresses that never grow (blocked). It cannot see twenty more deaths, or one fortress starving in two timelines of four.
- **A verdict takes about 45 minutes** when the runners are free: 80 jobs of 2 to 18 minutes, 167 job-minutes a sweep, on GitHub's twenty free runners. Behind other runs it waits: the twelve-sweep measurement queued behind another task's runs and took 2 hours 40 minutes.
- **The reference** is the pooled row of shifts 0 to 150: **20 / 7 / 0.75 / 903.75 / 141.75** (alive / grown / peril-0 with need deaths / living / deaths), 2 extinct, 2.5 need deaths. Bounds: 18 / 6 / 1 / 803.75 / 171.75.
- **Three invariant findings** stopped three seed-shifts of master (two caravans present over 20 days, a walled-in chest): [T-NEW: invariant findings in shifted sweeps](../../docs/work/T-NEW-sweep-invariant-findings.md). A seed now plays on after a finding, writes its figures and then fails, so the verdict still counts it.

## What was run

| Run | What | Data |
|---|---|---|
| Measure 42325771766 | `sweep`, shifts 0 to 11 ticks, `b17c65f2`; cancelled after 63 of 240 jobs, once shifts 2 to 10 were seen to end with equal hashes | [hashes](../data/2026-11-06-t513-small-shift-hashes.txt) |
| Probe | `three-years-p2-3`, `-p0-1`, `-p4-1`, world hash at day 20 for shifts 0 to 40 and 0 to 220 | [probe](../data/2026-11-06-t513-shift.probe.ts.txt), [hashes](../data/2026-11-06-t513-small-shift-hashes.txt) |
| Measure 42329994960 | `sweep`, shifts 0 to 550 ticks, 50 apart, `b17c65f2`: 240 jobs; `p4-4` at 150 and 400 and `p2-4` at 400 stopped on an invariant | [sweeps](../data/2026-11-06-t513-sweeps.json) |
| Local | those three seed-shifts on `c50712e6`, which plays on after a finding (the same simulation) | in [sweeps](../data/2026-11-06-t513-sweeps.json) |
| Analysis | splits of the ten distinct shifts (0 to 450) into two sets of four; regressions built from shifts 200 to 350 | [splits](../data/2026-11-06-t513-splits.txt) ([script](../data/2026-11-06-t513-splits.mjs.txt)), [regressions](../data/2026-11-06-t513-regressions.txt) ([script](../data/2026-11-06-t513-regressions.mjs.txt)) |
| Measure ⟨RUN⟩ | the one command, `-f suite=sweep` with the default shifts, on `c7517918` | ⟨RUNRESULT⟩ |

The shift is `w.step(shift)` before the three-year fortress's setup (`THREE_YEARS_SHIFT`), as T-507's shifted sweeps and T-509's instrument do; shift 0 is the unshifted sweep.

## The noise

One row a sweep: alive at year 1 / peril-0 grown / peril-0 with need deaths / living at year 3 / dwarf deaths / extinct / need deaths.

| Shift | Row | Peril-0 living | Deaths at peril 2 / 4 |
|---|---|---|---|
| 0 | 20/7/0/973/131/0/0 | 459 | 57 / 69 |
| 50 | 20/7/**2**/891/149/3/4 | 439 | 55 / 90 |
| 100 | 20/7/1/886/141/1/6 | 400 | 72 / 66 |
| 150 | 20/7/0/865/146/4/0 | 465 | 45 / 101 |
| 200 | 19/7/0/866/130/2/0 | 448 | 61 / 65 |
| 250 | 20/7/1/936/135/1/16 | 413 | 54 / 61 |
| 300 | 20/7/0/890/131/2/1 | 460 | 54 / 72 |
| 350 | 19/7/0/718/172/4/0 | 405 | 64 / 106 |
| 400 | 20/7/0/887/149/3/0 | 427 | 58 / 87 |
| 450 | 19/7/0/856/119/3/6 | 436 | 63 / 55 |

| Figure | One sweep: mean, range, s.d. | Mean of four: range over the 210 sets, s.d. | Largest difference between two disjoint sets of four | Tolerance |
|---|---|---|---|---|
| Alive at year 1 | 19.7; 19 to 20; 0.48 | 19.25 to 20; 0.19 | 0.75 | set rule, at least 18 |
| Peril-0 grown | 7; 7 to 7 | 7 | 0 | set rule, at least 6 |
| Peril-0 with need deaths | 0.4; 0 to 2; 0.70 | 0 to 1; 0.27 | 1 | set rule, at most 1 |
| Living at year 3 | 876.8; 718 to 973; 66 | 826.25 to 922.5; 25.6 | 96.25 | 100 |
| Dwarf deaths | 140.3; 119 to 172; 14.7 | 127.75 to 154; 5.7 | 26.25 | 30 |
| Extinct | 2.3; 0 to 4; 1.34 | 1 to 3.5; 0.52 | 2.5 | reported |
| Need deaths | 3.3; 0 to 16; 5.1 | 0 to 8; 2.0 | 8 | reported |

(The s.d. of the means is over every set of four of the ten shifts, which overlap; the largest difference is over the 1,575 pairs of disjoint sets.)

Single seeds move far more: `p4-1` ends with 0 to 59 living, `p4-3` with 0 to 55 (extinct on days 187 to 189 in six of ten), `p2-4` with 0 to 37 (extinct in six of ten), `p4-4` is dead before year 1 in three of ten. At peril 0 the living move by up to 33 a seed (`p0-5` 47 to 80); a few dwarves a sweep die there (on `p0-3`, `p0-4` and `p0-6`), and only `p0-3` and `p0-4` lose any to hunger. The peril-4 deaths carry most of the spread (55 to 106 a sweep).

Shift 0 is the unshifted sweep and gives T-507's fixed row exactly (973 living, 131 deaths, run 42159863826).

## Shifts that fall together

The first noise run played shifts 0 to 11 ticks. Shifts 2 to 10 ended year 3 with one world hash on every seed with several of them done (`p0-3`, `p2-3`, `p4-1`, `p4-5` to shift 8, `p4-6`; `p0-7` and `p2-4` on the two each that finished), and shift 11 repeated shift 1 on `p0-3`, `p2-3` and `p4-6`; only `p2-7` differed at every shift. A probe of the hash at day 20 finds the same classes there ([data](../data/2026-11-06-t513-small-shift-hashes.txt)): on `p2-3`, {0}, {1, 11}, {2 to 10}, {12, 13, 16}, then every shift from 17 to 40 alone; on `p0-1` and `p4-1`, shifts 2, 5 and 10 together and 15 to 20 together, then 40 to 220 (every 20) each alone. In the twelve-sweep run, 0 to 400 (every 50) differ on every seed, and 450, 500 and 550 end with one hash on 15 of the 20 seeds (500 and 550 on 18). The opening's first commands meet founders that do the same thing for a stretch whatever the offset; the game converges back onto one timeline. The annual instrument does not show this (its sixteen shifts 0 to 15 give sixteen rows), so it keeps shifts 0 to 7; the sweep uses 0, 50, 100 and 150, and its noise was measured on the ten distinct shifts 0 to 450.

## The rule

What it judges, in `test/perf/three_years_sweep_verdict.test.ts` with `test/perf/three_years_sweep.ts`:

- **Samples.** The twenty seeds at shifts 0, 50, 100 and 150 of one commit (`SWEEP_SHIFTS`). Any other set, a second commit, or a seed missing at a shift prints the table and fails.
- **Pooled figures.** Means over the four sweeps of the fortresses alive at year 1, peril-0 grown and peril-0 with need deaths, the living at year 3 and the dwarf deaths; extinct fortresses and need deaths reported.
- **Bounds.** The set rule as means (at least 18, at least 6, at most 1); living at least the best accepted pooled figure minus 100, deaths at most the best plus 30. The best figures are kept when a tolerated loss is accepted.
- **Output.** The verdict job's summary on the run's page: each sweep's row, the pooled row, the reference, the bounds and the verdict; each seed's year-1 and year-3 population, deaths and need deaths by shift and its extinctions; the invariant findings; and the reference and best rows to paste into `three_years_sweep.ts` when the change is accepted. Seed jobs fail only on their own assertions.
- **Why the set rule needs no tolerance of its own.** Its limits are absolute, and master sits well inside two of them; the hunger limit is met only by the unluckiest set of four of master's ten shifts (`p0-3` hungry at 50 and 100 and `p0-4` at 50: 4 of 28). A change that does nothing to food goes over it about one verdict in forty (master's 0.4 hungry peril-0 fortresses a sweep, as a Poisson count over four sweeps, exceeds four with probability 0.024). One sweep broke it in one of ten.

What it catches, built from shifts 200 to 350 of master and judged against the reference ([cases](../data/2026-11-06-t513-regressions.txt)):

| Change | Pooled row (alive/grown/hungry/living/deaths/extinct) | Verdict |
|---|---|---|
| None | 19.5/7/0.25/852.5/142/2.25 | pass |
| `p0-1` starves out (23 dead) in 4 of 4 timelines | 19.5/7/1.25/829.5/165/2.25 | blocked: hunger |
| … in 2 of 4 | 19.5/7/0.75/841/153.5/2.25 | pass |
| `p0-1` and `p0-5` starve out in 4 of 4 | 19.5/7/2.25/806.5/188/2.25 | blocked: hunger, deaths |
| `p0-1`, `p0-2`, `p0-5` lose 5 to hunger in 2 of 4 | 19.5/7/1.75/845/149.5/2.25 | blocked: hunger |
| Three fortresses dead before year 1 in 4 of 4 | 17/7/0.25/780/214.5/4.5 | blocked: alive, living, deaths |
| … in 2 of 4 | 18.25/7/0.25/821.5/173/3.25 | blocked: deaths |
| `p0-4` stays at seven in 4 of 4 | 19.5/6/0.25/804/142/2.25 | pass |
| `p0-4` and `p0-6` stay at seven in 4 of 4 | 19.5/5/0.25/757.5/142/2.25 | blocked: grown, living |
| 20 more deaths and 20 fewer living in every sweep | 19.5/7/0.25/832.5/162/2.25 | pass |
| 40 more deaths and 40 fewer living | 19.5/7/0.25/812.5/182/2.25 | blocked: deaths |
| 40 fewer living, no deaths (fewer waves) | 19.5/7/0.25/812.5/142/2.25 | pass |
| 80 fewer living, no deaths | 19.5/7/0.25/772.5/142/2.25 | blocked: living |

**Four sweeps, not eight.** Eight would narrow the tolerances by about a third (living about 70, deaths about 20) and make the hunger limit flip under one verdict in a hundred; they cost 160 jobs, about 80 minutes with free runners and much longer behind other runs. A task that needs a finer answer runs the suite with more shifts (`-f shifts=0,50,...,350`) and reads the table; the verdict judges the four.

## Invariant findings

Three seed-shifts of master stopped on a T-176 invariant, none of them seen in an unshifted sweep: `p2-4` at shift 400 (`caravan.present-over-20d`, a Hillfolk caravan still walking to the depot 21 days after it came), `p4-4` at shift 150 (`caravan.present-over-20d`, a repelled Wildwood caravan retreating for 21 days) and `p4-4` at shift 400 (`container.no-work-tile`, a chest of 7 items with no tile a dwarf reaches). Each stopped its seed before its figures were written, which would have left the verdict without a seed in about two runs of three (3 of 240 seed-timelines; 80 a verdict). The seed now keeps its findings, plays on, writes its figures with the findings, and fails at the end; the verdict lists the findings. The faults are [a task of their own](../../docs/work/T-NEW-sweep-invariant-findings.md).

## Noticed

- `p0-3` still starves in three of ten timelines on today's master (1, 2 and 16 dead), after T-507 moved its cave strips beside the farm; T-512 (crops sown too late to ripen) is open on the same fortress's surface farm.
- `p4-3` is wiped out on days 187 to 189 in six of ten timelines, the year-2 siege; `p2-4` in six of ten, on days 115 to 312.
