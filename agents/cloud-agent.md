# Brief for the cloud agent

Written by the local orchestrator on 2026-10-10 for a Claude agent that runs in the cloud on this repository. You coordinate: you hand each task to a Claude subagent, review what comes back, merge it into your own branch and report. The local orchestrator merges your branch into `master`. You do not do the tasks yourself. The local orchestrator keeps working in parallel on other tasks with Codex and Gemini; this brief is how the two of you stay out of each other's way.

## What Deepholm is, and where things are

Deepholm is a Dwarf-Fortress-like game in TypeScript (Vite, Vitest, Playwright), built by coding agents from the specification in `docs/`. Version 1.0.0 was released on 2026-10-04. Since then the work is audits and the fixes they produce.

Read these before anything else, in this order:

1. [`../docs/process/agent-workflow.md`](../docs/process/agent-workflow.md): how a task is done and closed. The specification is edited in the same commit as the code. Closing a task means: fold its decisions into the spec, delete its backlog row, move its work file to `docs/archive/tasks/`.
2. [`../docs/process/testing-strategy.md`](../docs/process/testing-strategy.md): the test tiers and commands.
3. [`../docs/backlog.md`](../docs/backlog.md): every open task. Each has a work file in `docs/work/`.
4. [`README.md`](README.md) in this folder: the owner's rules for delegation. The hours and quota rules there are about the local machine and do not bind you. The rules about audits, verification and decisions do.
5. [`../docs/balance-status.md`](../docs/balance-status.md) and the three newest reports in `reports/audits/`: where the balance stands.

## The owner's standing instructions

- **Use your judgement and do not ask.** Where a spec is silent or a task needs a decision, decide, write the decision and its reason into the task's work file, and report it afterwards. Stop only for a serious blocker.
- **Audits and decisions go to a strong model, implementation of a decided task to a cheaper one.** For subagents: Opus for audits, diagnoses, measurements with a judgement at the end, and design decisions; Sonnet for implementing a fix whose rule is already written down, for test authoring, and for mechanical verification.
- **Do not guess causes.** Every claim in a report is marked as measured in a named run or read in the code at a named place. "Cause not established" is an acceptable finding. An earlier agent on this project invented causes and it cost a day.
- **Reports are never edited after they are filed.** A re-measure is a new dated report under `reports/audits/`, with its data under `reports/data/`.
- **Plain language** in everything a person will read: short sentences, the answer first.

## Your tasks

They are marked "cloud agent" in the Status column of the backlog. Take them in this order. Chain A is the important one; chain B can run beside it, because it changes no code.

### Chain A: the simulation, one task at a time

These all touch the same few files (`src/systems/dwarves/brain.ts` and `activities.ts`, `src/systems/combat/`, `src/systems/animals/`, `src/systems/jobs/`), so run them in sequence, never two at once.

1. **T-196, wild animals wipe out fortresses.** This is the blocker for everything else in the chain. Wild animals have spawned only since 2026-10-09 (T-192), and a single badger, boar or wolf now kills most of a fortress. The measurements are already taken: [`../reports/data/2026-10-10-wildlife-capture.md`](../reports/data/2026-10-10-wildlife-capture.md). In short: a civilian that comes within 5 tiles of a territorial animal is attacked; it never strikes back, even seven against one badger; all flee and three to five of seven still bleed to death within a third of a day; nobody is treated even with a stocked hospital; the fortress alert never changes; two armed soldiers end the fight with one or two hits. The capture was made by a weaker model and records observations only. An Opus subagent should:
   - check the capture's key facts with its own small probes before building on them;
   - read what the spec intends (`08` wild behavior, `10` flee and the cornered civilian, `16` melee and who gets a target, `17` bleeding and first aid, `balance.md`), and decide for each link in that chain whether it is a code fault, a missing rule or a balance number: why a fleeing civilian is never safe, whether a territorial animal should break off when the intruder leaves its territory, whether civilians in a group should defend themselves or each other, whether the alert should rise and call the squad and a hunter, whether bleeding leaves time for any treatment, and why three pastured animals starved;
   - write a dated report, then fix what is a fault and write the missing rules into the spec, each with a failing test first. Balance numbers change only with a measurement before and after.
   - **Target:** on a peril-0 map without the `serene` trait, wildlife is a hazard a careless fortress pays for, not an extinction. A fortress that reacts (alert, squad, doors) should lose nobody to a badger. State the figure you settle on in `balance.md`.
   - When it lands, restore natural animal arrivals in any fixture that was switched to "no wildlife" as a stopgap and names T-196 in a comment (`year_one` on branch `t-144` is one).
2. **Land branch `t-144`** (pushed as `origin/t-144`). It holds three finished tasks by an Opus subagent that was cut off before closing them: T-144 (social, comfort and joy are served in passing), T-198 (a ranged hunt takes a launcher and its ammunition together) and T-197 (at a mark of 75 one sit in the hearth hall comes before ordinary work), plus a fix that makes `homestead_year` wait for its birth. One run on the rewritten economy fixture gave mood 58.8 and a work share of 28.5%, against 57.7 and 22.7% before. It is not merged because one test is red: `homestead_year`'s "no dwarf died", four or five dwarves killed by one wild badger, which is T-196. After T-196: merge master into it, get it green, re-measure with the probe saved at `reports/data/2026-10-10-wants-without-errands-probe.ts.txt`, extend the story in a new dated report (the existing one is `reports/audits/2026-10-10-wants-without-errands.md` on that branch), update `balance-status.md`, and close T-144, T-197 and T-198. Then do T-199 (the still waits for an empty barrel while every barrel holds food), which that branch filed.
3. **T-134, the follow-up to the T-195 fix** (pushed as `origin/t-134-wip`, one work-in-progress commit by Codex; its task file is in that commit). T-195 made soldiers on duty eat, drink and sleep. Codex's critical read found three faults in that fix and wrote ten regressions and a correction: squad movement must never redirect a soldier serving a need, sleep included; a calm standing order must not hold back ordinary needs; the scan for hostiles in sight should be skipped where it cannot change the outcome. It is not green: `hospital_run` gets one wounded survivor where it expects three, and the per-system performance file passed 19 of 22. Rebase it onto master after step 2, find out whether those two failures are real, and finish it.
4. **T-133, a refused malformed command cannot poison the next save.** Small; its work file has an accepted resolution.
5. **T-145, the economy fixture plays at default priorities.** Test authoring on top of everything above: merge the rewritten three-year fixture from branch `origin/f-17` with the changes its work file lists, including the two added on 2026-10-09 (the script treats dangerous wildlife as a threat; a dwarf keeps brewing as its top labor). It ends with the 20-seed sweep and a new balance report, and with B-008 to B-012 each closed or re-filed. The sweep takes two to three hours of machine time; run it once.
6. **T-151, stage 4 of the defence year** (the raid). Three stages are on master. The fortress could not reach its raid because the squad starved in training (T-195, fixed) and wolves killed the civilians (T-196). Finish it once both are in.

### Chain B: the user interface, audit only

7. **T-111, the UI audit follow-up.** A mechanical draft is already in its work file: for each of the 89 findings of the first UI audit, whether a later commit closed it (68 fixed, 16 partly, 5 open, by Codex's count). What remains is the hands-on walkthrough that confirms or corrects that table in the running game.
8. **T-116, the UI and UX audit**, the third of the owner's three audits. Its work file sets a two-pass method: a capture pass (every flow played with Playwright, with a screenshot, a text dump of the cell buffer and the keys used at each step) by a cheaper model, then the judgement by Opus. It carries questions handed over from other tasks. Its fix tasks are filed as backlog rows, not done in the audit. Run it against master as it stands when you start; say which commit.

## What is not yours

The local orchestrator keeps these. Do not start them, and avoid their files where you can:

- **T-150** (the year in the browser played through the real UI; `test/e2e/full-year.spec.ts`).
- **T-156** (the long fixtures check their own steps; `test/scenarios/three_years_*.ts`, `year_one*`, `hospital_run`). T-145 also edits the three-year fixture, so the local side will hold T-156 until you have closed T-145.
- **T-113** (the full gate run, which needs a quiet machine for its timings) and the bookkeeping of **T-140**.

If you find a bug outside your tasks, file it (see "New rows") and go on. Do not fix it unless it blocks you.

## How to work with git

**You work in your own worktree, on your own branches. You never merge into `master` and never push to it. The local orchestrator does all merging into `master`.**

- **Your integration branch is `cloud/main`.** Create it from the current `origin/master` and check it out in a worktree of its own (`git worktree add ../deepholm-cloud -b cloud/main origin/master`, or the equivalent in your environment). It is the branch you keep, and the one the local orchestrator merges from.
- **One branch and one worktree per task,** named `cloud/<task id>`, cut from `cloud/main`. Give each subagent its own worktree of its task branch (`git worktree add ../deepholm-T-196 -b cloud/T-196 cloud/main`). A subagent never works in your worktree or in another subagent's.
- **When a task is verified** (next section), merge its branch into `cloud/main` with a merge commit (`git merge --no-ff`, no squash, no rebase of pushed commits) and push `cloud/main` and the task branch. Chain A's later steps build on the earlier ones through `cloud/main`, so they do not wait for the local merge.
- **Keep `cloud/main` close to `master`.** Merge `origin/master` into `cloud/main` before you start each task and again before you declare a step ready. The local orchestrator pushes to `master` several times a day. If that merge breaks something of yours, fixing it is part of your step.
- **Say when a step is ready to merge.** Add a line to the top section "Ready to merge" of your log (see the last section) with the `cloud/main` commit id and what it contains, and push. The local orchestrator then re-runs the checks on its machine, merges `cloud/main` into `master` and removes the line. Do not wait for that; go on with the next task.
- **The two branches handed to you** are `origin/t-144` and `origin/t-134-wip`. Merge them into task branches of your own (`cloud/T-144`, `cloud/T-134`); do not push to them, to `master`, to `codex-a` or to any other branch that does not start with `cloud/`. Never force-push.
- **`docs/backlog.md` conflicts at almost every merge,** because both sides add and delete rows. Resolve by keeping every row from both sides and removing only the rows of tasks that are closed.
- **Commit messages:** `T-nnn: <what the game now does>`, then a body that lists the spec sections edited, the tests added, the golden files that moved and why (a paragraph starting `golden:`), and the verification run (`e2e: N passed`). End with the attribution line of the model that wrote the change.
- **New rows.** A bug or follow-up you file takes the next free id in **T-210 … T-259**, a row in the backlog and a work file in `docs/work/` in the shape of the others (Source, Size, Needs, Status; Why; Reproduction; What the spec says; What to do; Done). The local side uses T-200 … T-209 and T-260 upward.

## Verification, before every merge into `cloud/main`

A change to behaviour under `src/` is verified only when all of these have run on the task branch after merging the current `cloud/main` (itself up to date with `origin/master`) into it:

```bash
npm ci
npm run typecheck
npm run lint
npm run content:check
npm run strings:check
npm run interface:check
npm run docs:check
npm test
npm run test:e2e
```

- **The browser suite is not optional.** `npm test` does not include it. On 2026-10-08 about twenty fixes were merged on `npm test` alone and one of them left the year-long browser playthrough starving, unseen for a day. In a fresh cloud machine, install the browser first (`npx playwright install --with-deps chromium`). The suite starts its own servers on ports 5174 and 5175, so only one checkout can run it at a time. Restore `reports/screenshots` afterwards unless a screenshot is meant to change.
- **Golden files** move when behaviour changes on purpose. Regenerate only the ones that fail (`npm run golden:update -- <name>`), and name each in the commit body.
- **A failing regression comes first.** Every fix has a test that fails before it and passes after it.
- **Do not weaken an assertion to get green,** and do not tune a long fixture (the year-long browser playthrough, `year_one`, the three-year economy run) beyond the smallest change that keeps what it meant. If a correct fix breaks one of them, find the one reason, with evidence. Several of these fixtures are fragile witnesses: more than once the honest fix was to the fixture's check, not to the game, and more than once the fixture had found a real bug.
- **The performance tier** (`npm run test:perf`) holds the per-system budgets, the three-year economy run and the 20-seed sweep. Timings on a shared or virtual machine are indicative only: report them, change no budget on them. Run `test/perf/per-system.test.ts` once after a change to a hot path (the dwarf brain, combat, animals) and report the figure against the allocation in `docs/01-architecture/performance-budget.md`.
- **Review what a subagent hands back before you merge it.** Read the diff. Check that tests assert outcomes through readers and events, that nothing writes components directly where the task said to go through commands, and that claimed test runs appear in the commit body. A subagent's summary is a claim, not evidence.

## How to brief a subagent

What has worked on this project:

- Give it one task, one branch, and the files to read first, in order. Tell it which other checkouts not to touch.
- State the decision already made, or say plainly that deciding is its job and what the decision must weigh.
- Tell it to commit each piece as soon as it is green, and to commit a first version of a report as soon as it has one. Subagents get cut off.
- Give a time box for anything that can turn into tuning: "at most three more full runs, then commit what passes, write down exactly what fails with numbers, and leave the task open".
- Tell it what to do when a check fails for a reason outside its task: record the test's name and message, do not edit the test, go on or stop as the case demands.
- Ask for a final message with numbers, commit ids, tests changed, goldens moved, and a list of what it could not establish.

## What to report, and where

- Keep the backlog true on `cloud/main`: a row's Status says who has the task and where it stands (`cloud agent: in progress on cloud/T-196`).
- Keep a running log, `reports/cloud-agent-log.md` (new file, on `cloud/main`; it is a log, so appending to it is right). It starts with two short sections that you keep current:
  - **Ready to merge:** one line per step that the local orchestrator can merge now, with the `cloud/main` commit id and what it contains.
  - **Needs the owner:** anything only the owner can settle. Write it there and carry on with the next task.
- Below those, add a short dated entry when a chain step lands on `cloud/main`: what it changed, the decisions you made and why, what the measurements were, what you filed, what you could not establish.
