# Cloud agent log

The running log of the Claude agent that works in the cloud on branches `cloud/main` and `cloud/<task id>`. Its brief is [`../agents/cloud-agent.md`](../agents/cloud-agent.md).

## Ready to merge

- `54fb118`: T-212 closed. A hungry predator hunts animal prey before a dwarf and a pack shares one quarry; a civilian caught while fleeing fights back with what it carries. Rules in 08, 10, 16 and `balance.md`; two dated reports; T-218 … T-221 filed. Verified: npm test 2275 passed, e2e 24 passed (full-year passed, not skipped).

## Needs the owner

- **The cloud agent has stopped, on the owner's instruction (2026-10-11).** Chain A stopped after T-212. T-134 is not merged (below). T-133, T-145, T-151 and chain B's T-116 were not started; their rows still say "cloud agent" and are free to reassign.
- **T-223: what is a free bed?** Several dwarves sleep in one bed at the same time today; T-134 found three on one hospital bed.
- **The year-long browser playthrough is a coin toss, and its fixme hides it** (local side: T-150, T-221). On `cloud/main` without T-212, `full-year.spec.ts` ended at 7 or fewer living dwarves in 6 of 10 repeated runs (twice with 0), because its UI commands land on different ticks each run at 4× real time. The conditional `test.fixme` at `full-year.spec.ts:636` turns each of those into a skip, so `npm run test:e2e` stays green while the fortress dies. Measured in `reports/audits/2026-10-11-full-year-with-t212.md`.
- **T-218: should pastured grazers be wolf prey?** Under 08's size rule (prey smaller than 0.8 × the predator) sheep, goats, pigs and cows are not, so T-212's "a pasture behind a door" protects nothing from wolves.
- **T-219: should a civilian caught by an animal that only defends its ground, or by an armed raider, fight back?** As decided, it does, and it costs: in the browser year 14 of T-212's 21 deaths were civilians caught by a defending boar, wolf or badger; raider deaths in the reference fortress went from 2 to 4. Exempting defenders (they let a fleeing dwarf go anyway) is the obvious change.
- **T-252 revises D-U3** (not blocking): it adds an "Embark without an axe?" question, because the Supplies tab calls an axe part of the minimum and a party without one embarks unasked. Look at it before anyone picks T-252 up.

## Entries

### 2026-10-10: started

- `cloud/main` cut from `origin/master` at `4fbe72c`.
- Environment note: the cloud machine has Chromium revision 1194 preinstalled, while `@playwright/test` 1.63 asks for headless shell revision 1243. The browser suite runs against the preinstalled build through a symlink outside the repository; nothing in the repository changed for it.
- Chain A starts with T-196 on `cloud/T-196`; chain B starts with T-111 on `cloud/T-111` beside it.
- Owner's instruction, 2026-10-10: from now on, one subagent at a time, to manage quota. The two already running finish; nothing new starts until both are done, and after that tasks run one by one.

### 2026-10-10: T-111 closed (merge `91dedf3`)

- The walkthrough of the first audit's § 2 was played in Chromium at 1280×800 against `26b6b86`. Of the 89 findings: 65 fixed, 20 partly fixed, 4 open (the code-only draft said 68, 16, 5).
- States corrected by play or code: Issue 2 and M1 → partly (a stockpile made while paused cannot be set up until time runs); § 5.5 → partly (the Jobs panel's empty line is drawn over); 7.19 → partly (the idle-hauler hint now exists, two others are missing).
- New findings, all filed: a raw string key in the stockpile preset list, a status notice that hides the next readout, layout cuts at 1280×800, placement that still looks refused, ungrouped merchant goods, Jobs panel names and filters, the second `d` closing Designate.
- Filed T-240 … T-252, each with a work file. They are unassigned (status `open`).
- Not established: the labor grid with 40+ dwarves; door, lever, trap and cage modes; the colourblind palette; immigration, reputation and load-failure messages.
- Seen in passing, not investigated: the embark dog and cat died within four days, and in the flat-test run five of seven dwarves were dead by Day 10 of Summer. This is T-196's ground.
- Checks: the subagent ran typecheck, lint, content, strings, interface, docs and `npm test` (2242 passed); after the merge into `cloud/main` I re-ran the four checks that read `docs/`. No browser suite: nothing under `src/` changed.

### 2026-10-10: T-196 closed (merge `f38eab2`)

The answer: one wild animal no longer wipes out a group of civilians. In the probe (seven civilians crossing one animal's ground for three days, 10 seeds each), a fortress with a medic and a squad that answers lost no civilian to a badger (0 of 70). Without a medic it lost 9 of 70 (before the fixes: 18 of 35 over 5 seeds).

- **Checked the capture first.** Its qualitative findings held when re-run on another map and seeds; its numbers were not used, since they disagree with themselves in places.
- **Code faults fixed** (each with a test that failed first, `test/unit/t196-wild-animals.test.ts`):
  - an attacking animal ignored flight and, after a kill, took the next dwarf in sight (`animals/brain.ts`); measured up to 7 dwarves killed one after another;
  - a kill order on a creature beyond 14 tiles did nothing (`combat/squads.ts`); measured a soldier standing still for 400 ticks;
  - one bandage job dressed only one wound (`health/producer.ts`), where 17 says every bleeding wound.
- **Rules written into the spec:** an attack provoked by a dwarf coming near is a defence of the tile where it began, and ends when the target leaves that radius, changes level or falls unconscious (08); a kill ends a hunter's hunger (08); a light wound stops bleeding after `CLOT_TICKS` = 300 (17). Measured before: one unbandaged light cut killed in 2,500 ticks.
- **Decided against:** an automatic alert (16 says the alert is manual; kept), and civilians fighting back (10 says they flee; it works once the animal lets go).
- **Balance figure in `balance.md` § Wild animals:** a careless fortress loses about one dwarf per animal whose ground it keeps crossing, never the group; a fortress with a medic and a squad that answers loses no civilian to a badger. `CLOT_TICKS` at 150, 300 and 600 gave 5, 6 and 8 badger deaths of 35; 300 kept.
- **Filed:** T-210 (a pasture at its stated capacity is eaten bare; the shared fixture's pasture is 20 tiles for six grazers), T-211 (a wounded soldier stays on duty; needs T-134), T-212 (a hungry predator kills its prey; needs a decision, see above), T-213 (two rules of 08 without code: the 50-tick grace and corpse eating).
- **Performance (indicative):** per-system 21 of 22; system 08 averaged 0.86 ms against 0.4 ms × 2, and measured 0.82 to 0.85 ms on the starting commit too, so it was over before this change. Not filed yet; it will be re-checked after T-144.
- **Not established:** year-long wildlife figures (the probe is three days on a flat map); why `defence_year` lost civilians on days 41 to 55; why a skill-0 hauler took a medic job ahead of the chief medic in one trace.
- **Reviewed by me:** the diff under `src/` (five files, small) matches the spec edits. A kill order chasing a moving animal asks for a new path whenever the animal steps; the measurement shows soldiers do reach it.
- **Re-verified after merging `cloud/main` into `cloud/T-196`:** all checks clean; npm test 2252 passed; e2e 24 passed.

### 2026-10-10: T-111 and T-196 are on master; T-212 decided

- `origin/master` merged both steps (`f95586b`), so their "Ready to merge" lines are removed.
- The local orchestrator decided T-212 (`4446f36`): a hungry predator prefers animal prey, and a caught civilian fights back. It comes to chain A after the `t-144` branch lands.

### 2026-10-10: T-144, T-197 and T-198 closed (merge `6ea68b2`)

The answer: the wants now cost about half the dwarf time they did, and mood is back where it was. On the rewritten economy fixture (seed `three-years`, no wild arrivals), year 1 gives mood 58.8 and a work share of 28.4%, against 57.7 and 22.7% before T-144. The three wants take 14.9% of dwarf time, against 27.4%. Report: `reports/audits/2026-10-10-wants-without-errands-after-t196.md`.

- **The merge** of `origin/t-144` onto T-196 had no code conflict: the two touch different systems. Only the backlog conflicted.
- **Fixtures:** `year_one` has natural animal arrivals again and passes (no dwarf died). `homestead_year`'s unfinished wait for its first birth was completed: the wait reads the gestation from content, and every other check still reads day 40. `hospital_run` passes.
- **Years 2 and 3, measured for the first time after T-144:** mood 61.1 and 59.8, 33 dwarves, no deaths; the work share falls to 13.8% and 17.1%, with 16 to 18% of dwarf time idle for lack of work.
- **With wild animals the economy fixtures still die out, to boars,** with or without T-144: on the rewritten fixture three boars kill 8 of 9 dwarves on days 19 to 32. Two traced deaths show a patient going back and forth between its bed and fleeing, and a medic working within two tiles of a boar. Filed as T-214 (diagnosis first). This matters for T-145.
- **Filed:** T-214 (boars wipe out the economy fixtures), T-215 (the old economy fixture runs out of food in year 3), T-216 (the perf-tier three-year run stops on day 3 with a log inside a wall; it fails the same way on `origin/master` `4fbe72c`; marked local side, since the three-year files are T-156's).
- **Performance (indicative):** per-system 21 of 22 on both this branch and `cloud/main`; system 08 over budget on both, as before. Systems 10 and 11 cost more here (0.64 against 0.60 ms, and 0.66 against 0.49 ms; budgets 0.50 and 0.60) but stay within the × 2 allowance. Worst tick 53.9 ms against 43.5 ms; not asserted.
- **Not established:** why some runs share the map with boars unharmed and others lose everyone; why the old fixture runs short of food in year 3; why sleep travel stays higher than before T-144; which change makes systems 10 and 11 cost more.
- **Reviewed by me:** the merge, the fixture changes and the T-197 check. The T-197 limit ("at the mark less than 15% of the time") is how the `t-144` branch wrote it, not a loosening made to land it.
- **Re-verified after merging `cloud/main` (with `origin/master` at `4446f36`) into `cloud/T-144`:** all checks clean; npm test 2263 passed; e2e 24 passed.
- **Next:** T-199 (the still waits for an empty barrel), then T-212 as decided.

### 2026-10-11: T-199 closed (merge `3fbf367`)

- **Decision (mine, recorded in the work file before the work):** the game tells the player; a brew does not empty a barrel. It was the work file's default and the smaller change; Dwarf Fortress players expect a brew to need an empty barrel; and tipping food onto the floor would quietly break the player's stockpile settings.
- **What the game does now:** a workshop whose only shortage is an empty container emits `WorkshopBlocked` with the new reason `no_empty_container` and the container class, once per wait. The log shows an alert naming the barrel, and the hint `hint_barrel` points at the carpenter. The spec had no reason name for this; `no_empty_container` was added to 12 and to the event catalogue.
- **Tests:** `test/unit/t199-brew-waits-for-barrel.test.ts` (failed first: the reason was `missing_input` and no alert appeared). No golden moved.
- **Filed:** T-217 (workshop alerts carry no focus tile, so the log cannot centre the map on the workshop).
- **Heads-up for whoever takes T-250:** it plans an `input` field on `WorkshopBlocked`; it should build on the new `container` field and reason.
- Implemented by a Sonnet subagent; I reviewed the diff and re-ran every check on the branch.

### 2026-10-11: T-212 held back

- The T-212 subagent finished (both rules in, 10 tests, npm test 2275 passed, e2e 23 passed and 1 skipped). The skipped one was `full-year`: its new conditional fixme fires at 7 or fewer living dwarves.
- Measured: `full-year.spec.ts` alone passes on `cloud/main` (11 living at year end) and ends with 1 living on `cloud/T-212`. Wild spawns differ between the runs (2 boars against 11), so the runs diverge early; cause not yet established.
- Not merged. The task went back to its subagent to find the cause and fix it, without editing the spec file.

### 2026-10-11: T-212 closed (merge `54fb118`)

The answer: a hungry wolf pack now costs a careless fortress fewer dwarves, and a dwarf with a pick usually kills the wolf. In T-196's probe (10 seeds, a hungry wolf), haulers holding picks lost 9 of 70 against 27 before, and the wolf died in every run; plain hauling lost 14 against 17. Over a year on 3 forest and 3 taiga seeds at peril 0 with wolves only, a fortress that ignores them lost 12 dwarves against 17, one that reacts 7 against 8. Four of six seeds lost none; two still lose several (T-220). Report: `reports/audits/2026-10-11-hungry-predators.md`.

- **Rules (the local orchestrator's decision):** a hungry predator hunts the nearest animal prey in perception and a dwarf only when none is in sight; a pack (one species, one arrival) shares one quarry and one kill feeds it. A fleeing civilian hit in melee by an attacker at least as fast is caught and fights with its weapon, or a tool with a melee row, or its fists, until the attacker lets go or dies, or a door the attacker cannot pass opens a way out. It never walks toward its attacker.
- **Silent details decided by the subagent** (in 08, 10 and the archived work file): prey keeps 08's size rule, so a wolf's prey is dogs, cats, chickens, rabbits and badgers, not sheep or cows (T-218 asks the owner); the escape that ends a fight must pass a tile the attacker cannot enter.
- **Held back once:** my single browser run ended with 1 living dwarf against 11 on `cloud/main`. The subagent's 22 repeated runs showed that was variance in the spec, not T-212: `cloud/main` is at 7 or fewer in 6 of 10 runs, `cloud/T-212` in 1 of 12 (median 8.5 against 11 living). Report: `reports/audits/2026-10-11-full-year-with-t212.md`. Lesson for me: one run of `full-year` is not a measurement.
- **Costs measured:** caught civilians now stay in a defending animal's ground (with a medic, boar deaths 7 → 9 of 70 in the probe; 14 of 21 browser-year deaths). Filed as T-219 for the owner.
- **Reviewed by me:** the `combat/index.ts` change stops every off-duty dwarf from approaching its combat target; only the dwarf brain gives such dwarves a target (cornered or caught), hunting fires directly, and pets have no brain, so it changes nothing else.
- **Filed:** T-218, T-219 (owner decisions, above), T-220 (two seeds of six still lose several dwarves to a pack), T-221 (the browser year varies run to run; local side).
- **Performance (indicative):** system 10 rose from about 0.64 to 0.81 ms (allocation 0.5, test limit 1.0), from the escape search a fighting civilian runs every tick. System 08 unchanged and still over, as before.
- **Not established:** why two seeds lose several dwarves to a pack while four lose none; why one reacting fortress starved.

### 2026-10-11: T-134 not merged; the cloud agent stops

- **Where T-134 stands:** branch `cloud/T-134` (`9682f22`, pushed) has Codex's correction merged onto T-144 and T-212 and completed, with 14 regressions `describe('T-134 …')` and the spec edits (10 § Sleeping and § Behavior selection step 5, 16 § Squads, `creature-brains.md`). All three of Codex's points held; two were incomplete and were finished (a kill order no longer pulls a soldier off a need; under an alert a hostile in sight holds a want whatever the squad's stored mode).
- **Why it is not merged:** `npm test` gives 2287 passed and 2 failed, both `hospital_run`. The subagent traced it: on `cloud/main` the fixture's scout stands at a calm station all night with rest 84–89 (the old fault); with the change it goes to sleep, on the same hospital bed as the medic, and the fixture's fire burns all three, so the only medic becomes a patient and three guards bleed out. Only 1 of 12 seeds passes on `cloud/main` and 0 of 40 on the branch. Three fix rounds did not give a fixture that passes and keeps its meaning, so the fixture was not changed. Filed T-222 (stage `hospital_run` by rule), which T-134 now needs.
- **Per-system:** no failure added (21 of 22 on both sides; system 08 over on both). Codex's 19 of 22 did not reproduce.
- **Browser suite on the branch:** 24 passed; `full-year` ran and was not skipped (12 living).
- **Brought onto `cloud/main` without the code:** the rows and work files of T-222, T-223 (several dwarves in one bed; needs a decision) and T-224 (a treated patient whose pain keeps it in hospital is treated again and again, using a splint each time), so the findings reach master. T-134's backlog row now points at the branch and needs T-222.
- **To resume T-134:** do T-222, merge `cloud/main` into `cloud/T-134`, re-run `hospital_run`, then the full checks.
