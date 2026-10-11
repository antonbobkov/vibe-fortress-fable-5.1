# T-134 — T-195 follow-up: squad orders respect need activities

Closed by `T-134: a soldier on a calm order eats and sleeps, and squad orders never pull it from a need` and the merge `Merge origin/cloud/T-134: T-134, squad orders respect a soldier's needs`.

**Source:** Codex's critical read of the T-195 fix (`8ef36d5`), 2026-10-10; its work in progress is commit `c97c17c` on branch `t-134-wip` · **Size:** S · **Needs:** T-222 · **Status:** open, waiting on T-222: everything but `hospital_run` passes on `cloud/T-134`

## Why

T-195 made soldiers on duty eat, drink and sleep. Codex's critical read found three faults in that fix and left ten stepped-world regressions and a correction (`test/unit/combat/t195-follow-up.test.ts`), not green: `hospital_run` got one wounded survivor where it expects three, and the per-system performance file passed 19 of 22.

1. Squad code (`stepSquads`) still moved a soldier whose brain behavior was `need` when its activity was `sleep` outside `train` mode, so a sleeping soldier or one walking to bed was walked back to its station.
2. `select()` held a soldier's wants (`dutyHolds`) for an `active` squad with any standing order, or under any alert, and never for a `train` or `off` squad under an alert with an order.
3. `hasHostileInSight` counted a held combat target as a hostile in sight; 16 keeps a target that is out of sight (§ Targeting), so that is no proof of sight. And it ran the perception scan on every selection of every soldier, also when nothing could be held.

## Rule and scope

Implement the existing behavior-selection rules of 10 and 16. A critical need wins in every mode, and squad movement never redirects a `need` activity, including travel to a bed and sleep. Want-level needs wait only for an active squad with a hostile in sight, or an explicit order during a watchful or hearth alert. A calm station order and an alert without an order do not alone hold a want. An acquired combat target is not proof of current sight. Skip the sight scan where it cannot change the outcome; combat's own perception and target retention are unchanged.

## Spec sections

- `02-systems/10-dwarves.md` § Behavior selection, § Sleeping.
- `02-systems/16-combat.md` § Squads.
- `04-implementation/algorithms/creature-brains.md` § Dwarf brain.

## Decisions

1. **Merge.** `origin/t-134-wip` merged into `cloud/T-134` (from `cloud/main` `d36dd19`) with `--no-ff`. The code merged cleanly onto T-144's and T-212's `select()`; the three conflicts were documents. 10 § Behavior selection keeps `cloud/main`'s escape paragraph (T-212's weapon wording) and caught-civilian paragraph; 16 § Squads keeps `cloud/main`'s kill-order sentence (the walk toward a kill target out of perception); `process/testing-strategy.md` keeps `cloud/main`'s text, since the WIP side was an unresolved stash conflict (`<<<<<<< Updated upstream` committed as text). The task file moved from the archive to `docs/work/`.
2. **Codex's first point holds: squad code never moves a soldier serving a need, sleep included.** 16 § Squads, from T-195 itself: "While a soldier's brain behavior is `need` … squad code does not move the soldier". T-195's code still moved a sleeping soldier outside `train` mode. Two of Codex's regressions fail on `cloud/main` (`active`/`calm` and `off`/`watchful` bed walks: "the predicate did not hold within 1200 ticks").
3. **It was not complete.** `stepSquads` gave a member its kill-order target, and walked it toward a target out of perception (T-212), *before* the behavior check, and the `kill` `SquadOrder` set the target of every member on duty; combat then walks a soldier with a target toward it. So a soldier going to eat under a calm kill order, or walking to bed when a kill order came, was taken from its need. Now the squad step skips such a member before its kill-order step, and the command gives no target to it; the queued kill applies when it returns to duty. Two new regressions, both failing before the change.
4. **Codex's second point holds: a calm order, or an alert without an order, does not hold a want; an explicit order during an alert does, in every mode.** 10 § Behavior selection step 5 (T-195's own text: "In `active` mode with a hostile in sight, or when the squad has an explicit order … during an alert … duty holds the soldier against want-level needs; otherwise want-level needs also take precedence") and 16 § Squads ("On `watchful` alert every squad is treated as `active`"). T-195's code held wants for an `active` squad with any order or any alert, and never for a `train` or `off` squad. Four of Codex's regressions fail on `cloud/main` (an `active` squad's calm station and a `watchful` alert without an order no longer hold a meal; an `off` or `train` squad's station order during a `watchful` alert holds one).
5. **It was not complete either.** Codex's code tested sight only for a squad whose stored mode is `active`. Under a `watchful` or `hearth` alert every squad is treated as active (16 § Squads), so a `train` or `off` squad with a hostile in sight holds a want too. Two new regressions (`train`, `off`), both failing before the change.
6. **Codex's third point holds: a held combat target is not sight.** 16 § Targeting: "A target is not dropped for being out of sight: this system alone ends an acquired target." In sight is the same test as the squad's perception scan: alive, not stealthed, hostile, within `PERCEPTION_RADIUS` and two levels, line of sight. Codex's regression ("a held target behind a wall") fails on `cloud/main`.
7. **The sight scan runs only where it can change the outcome**: when the soldier has a want with an errand or its scheduled sleep, no alert order already holds it, and its squad is treated as active. Purpose has no errand at step 6, so a want of it alone no longer triggers the scan. Combat's own perception and target retention are unchanged.
8. **Spec text.** Codex's spec lines were loose paragraphs beside the lists (one of them implementation guidance in 10, one a repeat in 16). They are folded: 10 § Sleeping (a bullet), 10 § Behavior selection step 5 (the whole hold rule and what "in sight" means), 16 § Squads (the duty bullet: no target, kill orders included; what holds a want), `creature-brains.md` § Dwarf brain (pseudo-code with the scan order, and the squad step's skip before kill orders).
9. **Tests.** Codex's ten regressions stay, renamed to `describe('T-134 needs interrupt squad movement in every mode (T-195 follow-up)')`; four new ones in `describe('T-134 squad orders and sight under an alert')`. Before the change: Codex's ten, 7 fail and 3 pass on `cloud/main` (the three that pass are the controls: a `train` soldier's bed walk, a `train` soldier's meal, and an `active` squad's alert order); the four new ones all fail on the merged WIP. After: 14 of 14 pass. T-195's `soldier-needs.test.ts` and `t195_train_needs` pass unchanged.
10. **No fixture changed, no golden moved.** See § Findings for `hospital_run`.

## Findings

### `hospital_run`: not a fault of the change; the fixture is a roll

Reproduced: `cloud/main` passes, `cloud/T-134` fails with "expected 1 to be greater than or equal to 3", as Codex saw. Traced by stepping both and printing every dwarf's behavior, position and needs every 25 ticks from tick 4,800, with the damage, death and patient events:

- On `cloud/main` the scout (16777276, `Scout` squad, `active`, a station, alert `calm`) stands at its station through the night with rest 84–89 at ticks 6000–6100 (want 60): the fault this task fixes. The raid reaches it first; it, two guards and soldier3 are wounded and live, and the medic treats them.
- On `cloud/T-134` the scout goes to sleep at tick 5775 (rest 63) and soldier3 (16777278, `Reserve`, `active`, a station, `calm`) at 5825 (rest 62), as 10 step 5 now says. Both sleep on the hospital bed tile (41, 6), and the medic (16777281) sleeps on the same tile (several dwarves share one bed: T-223). The fixture lights its fire on soldier3's tile at tick 6000 and burns all three (`PatientAdmitted` for 16777276, 16777278 and 16777281 at tick 6015). With the only medic a patient, the guards' arrow wounds go untreated: 16777275, 16777277 and 16777279 bleed out at ticks 6788, 6793 and 6943. One wounded survivor: soldier3.

Three rounds of fixes were tried, none kept:

1. Lighting the fire only when soldier3 has its two tiles to itself (the fixture's intent: one burn casualty). The fight then rolls differently: soldier 16777277 takes a grievous head fracture whose pain (31, `PAIN_DISCHARGE` 30) keeps it a patient past day 30, and the fixture fails "should be discharged". It also exposed T-224 (the same treatments repeated on a treated patient).
2. A seed sweep of the same script: on `cloud/main` 1 of 12 seeds (`hospital-run`, `-2` … `-12`) passes, the chosen `-4`. On `cloud/T-134` 0 of 12, and 0 of 28 more (`-13` … `-40`), with or without change 1. The commonest failure is "should be admitted": the fixture counts any `DamageDealt` as a wound, and light bruises do not make a patient (17 § Patients and hospitals).
3. Deploying the squads under a `watchful` alert (their station orders then hold wants, as the spec intends for a guard post) and lowering it when the raid ends: 0 of 12.

So the failure is real as a test result and not as behaviour: the change does what 10 and 16 say, and the fixture's one passing seed depended on the old fault. Making the fixture test rules instead of a roll is T-222; this task waits on it. No assertion was weakened and the seed was not searched again.

### Per-system performance file

`npx vitest run --config vitest.perf.config.ts test/perf/per-system.test.ts`, twice on each side, alternating, on an otherwise idle machine (milliseconds per tick on the 80-dwarf reference fortress; the test allows twice the allocation):

| Run | Average tick | 08 (0.4 × 2) | 10 (0.5 × 2) | 16 | Result |
|---|---|---|---|---|---|
| `cloud/main` 1 | 4.287 | 0.802 | 0.782 | 0.158 | 21 of 22; 08 over |
| `cloud/T-134` 1 | 4.410 | 0.805 | 0.795 | 0.168 | 21 of 22; 08 over |
| `cloud/main` 2 | 4.653 | 0.869 | 0.827 | 0.171 | 21 of 22; 08 over |
| `cloud/T-134` 2 | 4.266 | 0.801 | 0.772 | 0.162 | 21 of 22; 08 over |

The change adds no failure: system 08 is over on both sides (known on `cloud/main`), and system 10 stays within its test limit of 1.0 on both, with the branch inside the spread of `cloud/main`'s two runs. Codex's 19 of 22 was measured on the older master base; it is not reproduced here. No budget was changed.

## Done

Every `describe('T-134 …')` regression passes; the static checks, `npm test` and the e2e suite pass; the per-system performance file adds no failure over `cloud/main`; the rules are folded into the spec. Archive this file and remove its backlog row.

### Verification on `cloud/T-134`

`typecheck`, `lint`, `content:check`, `strings:check`, `interface:check` and `docs:check` pass. `npm test`: 2,287 passed, 2 failed, both `hospital_run` (its own case in `m8.test.ts`, and the stepped-world inventory, which runs it); `cloud/main` `d36dd19`: 2,275 passed (the difference is the 14 regressions). No golden file moved. `CI=1 npm run test:e2e`: 24 passed; `full-year` ran (not skipped) and ended with `livingCount` 12.
