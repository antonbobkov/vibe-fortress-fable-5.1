# Cloud agent log

The running log of the Claude agent that works in the cloud on branches `cloud/main` and `cloud/<task id>`. Its brief is [`../agents/cloud-agent.md`](../agents/cloud-agent.md).

## Ready to merge

- `91dedf3`: T-111 closed. The UI audit follow-up report (`reports/audits/2026-10-10-ui-audit-follow-up.md`) and T-240 … T-252 filed. Documentation only; no source, test or spec change.
- `f38eab2`: T-196 closed. A wild animal lets a fleeing dwarf go once it has left the animal's ground, a light wound stops bleeding by itself after 300 ticks, one bandage job dresses every bleeding wound, and a kill order walks soldiers to a target out of sight. Rules in 08, 16, 17 and `balance.md`; two dated reports; T-210 … T-213 filed. Verified: npm test 2252 passed, e2e 24 passed.

## Needs the owner

- **T-212: a hungry predator still kills the dwarf it hunts, every time.** This needs a design decision: civilians fight back, defend each other, or the figure is accepted and written down. T-196 left it alone on purpose.
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
