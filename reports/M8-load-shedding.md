# T-M8-02 — Load shedding

Implements performance-budget.md section Load shedding rules. Completed wall-time
windows measure actual simulation progress, including explicit host steps. Below
80% of the requested rate for two seconds enables yellow speed, the half-size
non-dwarf path pool, then 20-tick far-wild thinking. Five healthy seconds relax
rules 3, 2, 1. The localized word slow accompanies yellow in both palettes.

D-210 records one-second sampling windows, continuous observation, interruptions,
species classification, mixed path allocation, unsaved switches, companion constant
names and accessibility. Pause, hidden tabs, requested-speed changes and frame
reset interrupt observation. Visibility events reset the frame clock even when
hidden-tab RAF is suspended. New/load reset policy. Dwarves retain eligibility for
the unchanged 24,000-node global pool; non-dwarves share at most 12,000 expansions
while shedding. Unfinished searches retain their urgency/id ordering and state.
Near wild thinking and 10-tick tame thinking retain their cadence and movement.

Tests added: 19 simulated-clock, host, actual A*, animal and status tests in
load-shedding.test.ts, plus two T-M8-02 loot ranking regressions in threats/ai.test.ts.
The clock tests cover exact 2/5-second boundaries and 80% equality, streak resets,
reverse recovery, healthy 60fps at 1x/2x/4x, explicit ticks and suspended RAF gaps.
Path tests verify 24,000 versus 12,000 actual expansions, mixed-species allocation,
carry-over and dwarf merchants without fortress brains. Animal tests verify actual
far/near/tame cadence and recovery. Host tests verify new/load reset and unsaved
switches. Status tests verify yellow cells and the distinct word in both palettes.

Integration: d1d6f39 concluded the resolved 7725695 merge with only the two master
fixture files. badd348 incorporated accepted M8-01 d98c696 without tree changes.
0594fd3 concluded F-15 c34a9bb with only master's seven files. 5e217a7 incorporated
master's 47c0cd8 agent documentation. Task work remained outside those merge commits;
there were no merge conflicts. efb5f97 then merged master e2cf511 after full verification: it updates balance findings and corrects the raid kind recorded by the seed report, with no simulation source or assertion change. The affected report case passed after the merge; master is checked again immediately before the task commit. F-13 movement and F-15 bandit/unreachable-walk behavior are preserved.

Performance follow-up after F-15: the first complete suite failed only threats,
0.202469 ms against the unchanged 0.100 ms allocation times two (54 passed, one
failed, existing C-009 TODO; 9 files, 2,490.41 seconds). A repeat budget/reference
run passed, but threats varied from 0.189507 to 0.215560 ms, leaving little margin.
An inspector CPU profile on the unchanged saved reference attributed 132.982 ms
of inclusive sampled CPU to findUnattendedItemWithinRadius over 2,000 measured ticks.
It repeatedly collected and inspected individual nearby items and cloned zone views.
The whole run made 61,348 zone calls, copying 245,392 tile entries.

D-211 records the behavior-preserving fix: reuse M8-01's per-tile eligible value
maxima with optional same-z Chebyshev bounds. Reachability, radius and stockpile
classification are uniform on a tile. The highest value / lowest entity-slot item
therefore dominates its peers. If party loot excludes a still-loose maximum, use
the full spatial candidate search so its runner-up remains eligible. Connectivity,
stockpile classification and item state stay live. Existing index invalidation is
unchanged. An initial unbounded global-index experiment measured 0.502718 ms and
was replaced by the bounded query; that experiment is not part of the final code.
Two added tests pin stockpile priority over more valuable loose items, value/slot
ties including reused slots, forbidden flags, mutation invalidation, party
exclusions, connectivity, radius and elevation. Together with the 19 load tests and
all existing threat tests, 37 tests pass (5.83 seconds).

Noise control: the machine also runs another agent's balance simulations. No owned
benchmark overlapped another owned test/simulation. Before and after measurements
used the same saved 80-dwarf/120-animal/25,000-item/600-building/60-zone fixture,
fresh Node/Vite processes, the same injected clock, 200 warm-up ticks and 2,000
measured ticks. Two before runs measured threats at 0.199608 and 0.229124 ms;
three bounded after runs measured 0.189564, 0.187141 and 0.187996 ms. The adjacent
reverse-order comparison below uses the last after and second before run, reducing
order/warm-up bias. Their dwarf/jobs/combat/animal total changed 1.799187 to
1.764806 ms (1.9%), while threats fell 18.0%; normalized to that total, threats
fell 16.4%. This comparison informs the fix; the original budget assertions remain
unchanged and must pass independently. All five runs produced the identical
2,200-tick world hash 9cb8175bc8cca211. No rule or golden change was needed.

| System | Allocation ms | Before F-15 loot optimization ms | After ms |
|---|---:|---:|---:|
| 03 terrain | 0.100 | 0.006964 | 0.006564 |
| 04 fluids | 1.500 | 1.224316 | 1.179947 |
| 05 materials | 0.150 | 0.000881 | 0.000830 |
| 06 weather | 0.020 | 0.000591 | 0.000638 |
| 07 plants | 0.150 | 0.001100 | 0.001346 |
| 08 animals | 0.400 | 0.617310 | 0.602270 |
| 09 foraging | 0.050 | 0.001563 | 0.001311 |
| 10 dwarves | 0.500 | 0.572202 | 0.561921 |
| 11 jobs | 0.600 | 0.453935 | 0.441958 |
| 12 workshops | 0.100 | 0.001509 | 0.001453 |
| 13 items | 0.300 | 0.041029 | 0.038706 |
| 14 buildings | 0.100 | 0.000872 | 0.000848 |
| 15 morale | 0.200 | 0.089530 | 0.092491 |
| 16 combat | 0.200 | 0.155741 | 0.158657 |
| 17 health | 0.100 | 0.009657 | 0.008909 |
| 18 threats | 0.100 | 0.229124 | 0.187996 |
| 19 defense | 0.050 | 0.011833 | 0.011715 |
| 20 trade | 0.020 | 0.002541 | 0.002380 |
| 21 immigration | 0.000 | 0.000865 | 0.000783 |
| 22 pathing | 1.000 | 0.450432 | 0.450545 |
| core | 0.300 | 0.324599 | 0.321250 |

Only threats was optimized in this follow-up. Total tick average was 4.197442 to
4.073385 ms. Observed isolated worst ticks were 38.484 to 45.699 ms; these noisy
comparison samples are not a claim of worst-tick acceptance. The unchanged
acceptance tests independently assert 40 ms. System 21 retains only the previously
accepted C-009 TODO for a literal zero allocation; no new TODO or budget change.
The final targeted performance check passed 23 tests plus C-009 TODO (two files,
25.07 seconds), threats 0.182004 ms, reference average 3.994094 ms; its second
reference measured threats 0.194065 ms, average 4.177065 ms, worst 32.8569 ms.

Final foreground verification on the bounded implementation:

- Lint and typecheck passed; content check passed (50 tables, 1,585 rows).
- npm test: all 170 files / 1,610 tests passed in 378.08 seconds, including
  world/render goldens and save round-trip determinism. The three-year fortress
  ended with 15 dwarves, no dwarf/tame/other deaths, wealth 3601/3869/4174,
  1,057 meals and 1,733 alcohol drinks.
- test:e2e: all 14 passed in 2.6 minutes; full-year took 38.0 seconds and ended
  with 10 living dwarves, wealth 1,753, drink stock 5 and zero food stock. The two
  guaranteed waves brought 2 and 3 dwarves. Hunger/starvation warnings were logged
  late in the year; passing browser assertions does not establish the model
  population/wealth targets. All nine generated screenshot paths were restored.
- Full test:perf: all nine files passed, 55 tests passed and the existing C-009
  TODO remained, in 2,483.42 seconds. All 20 three-year seeds, all five year-one
  seeds, all three mood decompositions, fluids, reference and generation checks
  passed. No test, fixture, budget or formula was loosened.
- Final per-system reference: average tick 3.914214 ms, worst 36.3788 ms;
  threats 0.173967 ms, pathing 0.432723 ms, core 0.291319 ms. Every covered
  per-system allocation passed the unchanged times-two assertion.
- The second 80-dwarf reference: average 4.058606 ms, worst 30.3874 ms,
  threats 0.181179 ms. The 20-dwarf played reference: average 0.429438 ms,
  worst 33.6398 ms. Standard generation: 538.924 ms (64-region world,
  96 x 96 x 48 local map).
- Post-merge lint, typecheck and content validation passed again. The focused three-years-p0-1 reporting case passed in 126.57 seconds, with all three raid kinds correctly recorded as thief. Every result field matches the full run apart from the corrected labels. The other 19 cases were filtered only for this follow-up; all 20 passed in the full run. The merge changes
  only plan/report text and the seed report's recorded event kind; runtime source
  and all regular/browser test sources are identical to the fully verified tree.

No golden files changed. No runtime dependencies were added. Only the existing
C-009 TODO remains. T-M8-02 is complete; progress tick codex-m802 is marked done.
