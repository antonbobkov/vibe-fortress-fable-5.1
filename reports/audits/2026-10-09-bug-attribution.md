# Audit: which agent introduced each bug

**Date:** 2026-10-09 · **Branch:** `bug-attribution`, at master `e33db83` (437 commits) · **Data:** [`../data/2026-10-09-bug-attribution.json`](../data/2026-10-09-bug-attribution.json)

## The answer

The history holds 124 distinct bugs fixed in non-test code, in 66 fix commits. 102 are charged to an agent. 22 are faults of the specification that the code followed, and are charged to nobody.

- **Most bugs: GPT-6 Sol, with 37.** Claude Opus 5 has 35.5 and Gemini 3.8 Flash has 26.5. This answer is **not firm**. GPT-6 Sol leads only because 15.5 of its bugs are UI findings. Without the UI audit the order is Gemini 26.5, Opus 5 24, GPT-6 Sol 21.5. The three are close in absolute terms under every counting.
- **Most bugs per task: GPT-6 Sol, with 1.03 per task that wrote code.** Gemini 3.8 Flash has 0.83 and Opus 5 has 0.62. This is **half firm**. Opus 5 is lowest of the three under every counting. GPT-6 Sol and Gemini swap places when UI bugs are left out (0.60 against 0.83).
- **Most bugs per line: GPT-6 Sol, with 3.6 per 1,000 lines of non-test code added.** Gemini 3.8 Flash has 2.2 and Opus 5 has 0.8. The same order holds for surviving lines (4.2, 2.6, 0.9). The **firm** part: Opus 5's rate is a third to a tenth of the other two under every counting tried. The **not firm** part: GPT-6 Sol and Gemini are level (2.1 against 2.2) when UI bugs are left out.

Three more results:

- **GPT-6.1 Sol, Claude Opus 5.5 and Claude Sonnet 5.5 have almost no bugs** (2, 0 and 0). This says little. Their code is small and new, it is mostly fixes, and the audits ran before most of it existed.
- **By vendor line:** Codex/GPT 39, Claude Opus 35.5, Gemini 26.5, Claude Fable 1, Claude Sonnet 0. Per 1,000 lines added: Codex/GPT 2.8, Gemini 2.2, Claude Opus 0.7.
- **Three fixes introduced a new bug.** Gemini's F-01 caused the crash fixed in `1764159`. GPT-6.1 Sol's T-122 caused the stair livelock of T-141. GPT-6.1 Sol's U-02 caused the unsaved-change fault of T-118.

## Results

Bugs are counted once each. A bug shared by two agents counts half for each. "Weighted" multiplies each bug by its confidence: high 1.0, medium 0.6, low 0.3.

### Per agent

| Agent | Bugs | Weighted | Tasks with code | Bugs per task | Code lines added | Bugs per 1,000 added | Surviving lines | Bugs per 1,000 surviving |
|---|---|---|---|---|---|---|---|---|
| Claude Opus 5 | 35.5 | 23.6 | 57 | 0.62 | 45,923 | 0.77 | 40,699 | 0.87 |
| Claude Opus 5.5 | 0 | 0 | 10 | 0.00 | 5,328 | 0.00 | 4,802 | 0.00 |
| GPT-6 Sol | 37 | 29.8 | 36 | 1.03 | 10,334 | 3.58 | 8,923 | 4.15 |
| GPT-6.1 Sol | 2 | 1.6 | 38 | 0.05 | 3,451 | 0.58 | 3,067 | 0.65 |
| Gemini 3.8 Flash | 26.5 | 21.6 | 32 | 0.83 | 12,089 | 2.19 | 10,293 | 2.57 |
| Claude Sonnet 5.5 | 0 | 0 | 6 | 0.00 | 156 | 0.00 | 140 | 0.00 |
| Claude Sonnet 5 | 0 | 0 | 0 | – | 0 | – | 0 | – |
| Claude Fable 5.1 | 1 | 1 | 0 | – | 0 | – | 0 | – |

Claude Fable 5.1 wrote the specification and its content tables, and no code. Its one bug is a content table row (T-125). The 22 specification faults are its work too, but the owner's rule is not to charge them.

### Per vendor line

| Agent | Bugs | Weighted | Tasks with code | Bugs per task | Code lines added | Bugs per 1,000 added | Surviving lines | Bugs per 1,000 surviving |
|---|---|---|---|---|---|---|---|---|
| Claude Opus | 35.5 | 23.6 | 67 | 0.53 | 51,251 | 0.69 | 45,501 | 0.78 |
| Codex/GPT | 39 | 31.4 | 74 | 0.53 | 13,785 | 2.83 | 11,990 | 3.25 |
| Gemini | 26.5 | 21.6 | 32 | 0.83 | 12,089 | 2.19 | 10,293 | 2.57 |
| Claude Sonnet | 0 | 0 | 6 | 0.00 | 156 | 0.00 | 140 | 0.00 |
| Claude Fable | 1 | 1 | 0 | – | 0 | – | 0 | – |

### What each agent did

| Agent | Non-merge commits | Implementing (code or tests) | Docs, plans, audits | Merge commits | Tasks (all) | Tasks with code | Test lines added |
|---|---|---|---|---|---|---|---|
| Claude Opus 5 | 74 | 60 | 14 | 3 | 61 | 57 | 40,779 |
| Claude Opus 5.5 | 78 | 16 | 62 | 64 | 16.5 | 10 | 9,560 |
| GPT-6 Sol | 58 | 46 | 12 | 0 | 39 | 36 | 31,174 |
| GPT-6.1 Sol | 56 | 42 | 14 | 21 | 43 | 38 | 10,155 |
| Gemini 3.8 Flash | 58 | 51 | 7 | 0 | 41 | 32 | 64,070 |
| Claude Sonnet 5.5 | 16 | 7 | 9 | 0 | 8.5 | 6 | 394 |
| Claude Sonnet 5 | 3 | 0 | 3 | 0 | 0 | 0 | 0 |
| Claude Fable 5.1 | 6 | 0 | 6 | 0 | 0 | 0 | 0 |

"Tasks with code" are the task ids whose commits added at least one line of non-test code. The rates above use that column. 209 task ids were found and all were assigned. 30 of them added no code (documentation triage, scenarios, audits).

Claude Opus 5.5 is mostly the orchestrator: 64 merge commits and 62 commits of plans, backlog rows, agent notes and audit reports. Its 16 implementing commits are U-01, U-03 to U-06, F-17, T-101, T-102, T-140 and the M8 gate. Claude Opus 5 built milestones M0 to M3, the start of M4 and the end of M7; 14 of its commits are orchestrator notes and 3 are merges.

### Sensitivity

| Agent | All | High confidence only | Omissions excluded | High and no omissions | UI bugs excluded | Per 1,000 added: all | high only | no omissions | no UI |
|---|---|---|---|---|---|---|---|---|---|
| Claude Opus 5 | 35.5 | 9 | 20 | 9 | 24 | 0.77 | 0.20 | 0.44 | 0.52 |
| Claude Opus 5.5 | 0 | 0 | 0 | 0 | 0 | 0.00 | 0.00 | 0.00 | 0.00 |
| GPT-6 Sol | 37 | 20 | 29.5 | 20 | 21.5 | 3.58 | 1.94 | 2.85 | 2.08 |
| GPT-6.1 Sol | 2 | 1 | 2 | 1 | 1 | 0.58 | 0.29 | 0.58 | 0.29 |
| Gemini 3.8 Flash | 26.5 | 15 | 21.5 | 15 | 26.5 | 2.19 | 1.24 | 1.78 | 2.19 |

By vendor line:

| Agent | All | High confidence only | Omissions excluded | High and no omissions | UI bugs excluded | Per 1,000 added: all | high only | no omissions | no UI |
|---|---|---|---|---|---|---|---|---|---|
| Claude Opus | 35.5 | 9 | 20 | 9 | 24 | 0.69 | 0.18 | 0.39 | 0.47 |
| Codex/GPT | 39 | 21 | 31.5 | 21 | 22.5 | 2.83 | 1.52 | 2.29 | 1.63 |
| Gemini | 26.5 | 15 | 21.5 | 15 | 26.5 | 2.19 | 1.24 | 1.78 | 2.19 |

What holds under every column:

- Opus 5 has the lowest rate per line of the three agents that built systems.
- GPT-6 Sol and Gemini 3.8 Flash each have close to three times Opus 5's rate per line, or more.
- GPT-6.1 Sol, Opus 5.5 and Sonnet 5.5 are near zero.

What does not hold under every column:

- Who has the most bugs in absolute terms. GPT-6 Sol leads on all bugs, on high confidence and without omissions. Gemini leads when UI bugs are excluded.
- Whether GPT-6 Sol or Gemini has the higher rate. GPT-6 Sol is higher on all bugs (3.6 against 2.2) and on high confidence (1.9 against 1.2). They are level without UI bugs (2.1 against 2.2).
- Opus 5's absolute count. It falls from 35.5 to 9 on high confidence alone, because 15.5 of its bugs are omissions and most of the rest are judgement calls on old code.

### By system

| System | Claude Opus 5 | GPT-6 Sol | GPT-6.1 Sol | Gemini 3.8 Flash | Claude Fable 5.1 | Spec (no agent) | Total |
|---|---|---|---|---|---|---|---|
| ui | 11.5 | 15.5 | 1 |  |  | 7 | 35 |
| jobs | 8 | 1 |  | 2 |  | 2 | 13 |
| threats |  |  |  | 9 |  | 3 | 12 |
| dwarves |  | 5 | 1 | 2 |  | 4 | 12 |
| combat |  |  |  | 10 |  | 1 | 11 |
| buildings | 4 | 3 |  |  |  |  | 7 |
| items | 4 | 0.5 |  | 0.5 |  | 1 | 6 |
| animals | 1 | 1 |  |  |  | 2 | 4 |
| workshops |  | 4 |  |  |  |  | 4 |
| content | 2 |  |  |  | 1 |  | 3 |
| trade |  | 2 |  |  |  |  | 2 |
| foraging |  | 1 |  | 1 |  |  | 2 |
| health |  |  |  | 2 |  |  | 2 |
| plants | 2 |  |  |  |  |  | 2 |
| immigration |  | 2 |  |  |  |  | 2 |
| defense |  | 2 |  |  |  |  | 2 |
| terrain | 1 |  |  |  |  |  | 1 |
| core | 1 |  |  |  |  |  | 1 |
| embark | 1 |  |  |  |  |  | 1 |
| morale |  |  |  |  |  | 1 | 1 |
| fluids |  |  |  |  |  | 1 | 1 |

### By kind

"Kind" is the main nature of the bug. A bug of any kind can also be an omission; 28 of the 102 charged bugs are.

| Kind group | Claude Opus 5 | GPT-6 Sol | GPT-6.1 Sol | Gemini 3.8 Flash | Claude Fable 5.1 | Spec (no agent) | Total |
|---|---|---|---|---|---|---|---|
| wrong logic | 9 | 9.5 | 1 | 16.5 |  |  | 36 |
| ui | 10.5 | 15.5 |  |  |  |  | 26 |
| spec |  |  |  |  |  | 22 | 22 |
| missing validation | 7 | 6 |  | 3 |  |  | 16 |
| missing cleanup | 4 | 5 |  | 5 |  |  | 14 |
| omission | 3 |  |  | 1 |  |  | 4 |
| save/load |  | 1 | 1 | 1 |  |  | 3 |
| content | 2 |  |  |  | 1 |  | 3 |

### Who found them

| Found by | Claude Opus 5 | GPT-6 Sol | GPT-6.1 Sol | Gemini 3.8 Flash | Claude Fable 5.1 | Spec (no agent) | Total |
|---|---|---|---|---|---|---|---|
| T-115 bug hunt | 12 | 10 |  | 15 |  | 3 | 40 |
| UI audit of v1.0.0 | 10.5 | 12.5 |  |  |  | 7 | 30 |
| M5 audit | 3 | 4 |  |  |  | 5 | 12 |
| T-115 spec reading | 1 | 2.5 |  | 2.5 |  |  | 6 |
| M8 mood diagnosis |  |  |  | 1 |  | 5 | 6 |
| M8 economy balance measurement | 2 | 1 |  | 1 |  |  | 4 |
| T-106 decision triage | 1 | 1 |  | 1 |  |  | 3 |
| T-123 economy audit |  | 1 | 1 |  |  | 1 | 3 |
| T-115 bug hunt (spec against code) | 1 |  |  | 1 |  |  | 2 |
| T-107 decision triage | 1 | 1 |  |  |  |  | 2 |
| F-17 balance re-measure |  | 1 |  |  | 1 |  | 2 |
| T-105 decision triage | 2 |  |  |  |  |  | 2 |
| T-M8-06 balance measurement |  |  |  | 1 |  | 1 | 2 |
| year-long browser playthrough | 1 |  |  |  |  |  | 1 |
| T-102 interface work |  | 1 |  |  |  |  | 1 |
| U-02 review |  |  | 1 |  |  |  | 1 |
| T-104 decision triage | 1 |  |  |  |  |  | 1 |
| Codex while repairing the economy fortress |  |  |  | 1 |  |  | 1 |
| T-130 save/load probe |  |  |  | 1 |  |  | 1 |
| T-M8-06 diagnosis |  | 1 |  |  |  |  | 1 |
| T-M8-06 balance run |  |  |  | 1 |  |  | 1 |
| Codex during M4 |  | 1 |  |  |  |  | 1 |
| Codex at the M6 gate |  |  |  | 1 |  |  | 1 |

Who ran each audit: the M5 audit, the UI audit, the T-115 bug hunt with its spec reading, and the T-123 economy audit were written by Claude Opus 5.5 sessions (the orchestrator or an Opus subagent). The M8 mood diagnosis was Gemini 3.8 Flash with a review by the orchestrator. The T-M8-06 measurements were Gemini and GPT-6.1 Sol. The decision triage was GPT-6.1 Sol (T-104, T-105, T-107) and Claude Sonnet 5.5 (T-106, T-107). So 93 of the 124 bugs were found by an Opus 5.5 audit. None of those audits read Opus 5.5's own implementation work: the UI audit came before it, and the bug hunt did not look at panels.

### Who fixed them

| Introduced by | Fixed by Claude Opus 5.5 | Fixed by Claude Sonnet 5.5 | Fixed by GPT-6 Sol | Fixed by GPT-6.1 Sol | Fixed by Gemini 3.8 Flash |
|---|---|---|---|---|---|
| Claude Opus 5 | 10 | 1 |  | 20 | 4.5 |
| GPT-6 Sol | 13 | 3.5 | 1 | 14 | 5.5 |
| GPT-6.1 Sol |  | 1 |  | 1 |  |
| Gemini 3.8 Flash | 1 | 2.5 | 1 | 20 | 2 |
| Claude Fable 5.1 |  | 1 |  |  |  |

## Method

**Measured** means a script computed it from git. **Judged** means I read the fix, the task file or the audit and decided.

1. **Candidates (measured).** All 437 commits were listed with their trailers and their changed lines by category. 349 are not merges. 194 of those change non-test code or content. Each of the 194 was classified by its subject, its body and its task file.
2. **Fix or not (judged).** 66 commits fix at least one bug. 118 are milestone tasks, performance work or golden updates and were treated as features. 10 were excluded for a stated reason: F-04 (a scenario), F-07 (a refactor to content-driven recipes), F-14 and T-140 (balance values chosen by design), T-101, T-102, T-110 and T-126 (documentation and export tooling), T-112 (a test-harness wait), T-176 (probes kept as tests). Gate commits changed only gate and check scripts, a few strings or a line of a save helper and were not counted.
3. **One bug or several (judged).** A bug is one finding of an audit, or one defect named in the fix's body or task file. A finding that names several defects with different faulty code is split: "four commands throw" is four bugs plus the tick abort; T-175 is ten bugs and one spec fault; F-05 is three; U-01 is fifteen bugs and four spec faults. The UI audit was counted by its rows in "Where the spec and the implementation disagree", plus the quick wins that are plain defects. Usability wishes (silent no-ops, help wording, the seed field) were not counted.
4. **The introducing commit (measured, then judged).** For each hunk of a fix in `src/` and `scripts/`, the removed or changed lines were blamed in the fix's parent (`git blame -w -C -C`, ignoring the comment-only commit `6eca1cb`, skipping blank and comment lines). For a hunk that only adds lines, the six lines around the insertion were blamed, to find who wrote the enclosing function. Where an audit named the faulty file and line, that line was blamed at the audited commit. Blame never pointed at a merge.
5. **Rules of attribution (judged).**
   - Changed lines from one commit: that commit, confidence **high**.
   - An omission (the fix only adds a rule, a check or a cleanup): the commit that wrote the function or feature the fix was added to, confidence **medium**. A missing cleanup on death goes to the system that held the stale reference, not to the system that causes death.
   - A wrong interaction: the later commit, if it clearly created the conflict; otherwise **shared**, half each (four bugs).
   - The spec was wrong, silent or contradicted itself and the code followed it: **spec**, charged to nobody (22 bugs).
   - **Low** confidence where two commits could each be blamed and I picked one or split (seven bugs).
6. **Agents (measured, with seven judged).** The agent is the `Co-Authored-By` trailer. Nine commits have none:

| Commit | Subject | Classified as |
|---|---|---|
| `81fabc5` | chore: start T-M4-17 | GPT-6 Sol |
| `1ebf43b` | chore: start T-M5-08 | GPT-6 Sol |
| `880d80b` | chore: start T-M5-09 | GPT-6 Sol |
| `4e14aee` | T-M6-03: Combat: projectiles, line of sight through fortifications, hu | Gemini 3.8 Flash |
| `ace9ed7` | Merge branch 'master' into t-101 | orchestrator merge |
| `678774e` | T-118: the unsaved-change check counts commands applied while paused | Claude Sonnet 5.5 |
| `16c13d1` | T-124: a fine meal relieves hunger and joy | Claude Sonnet 5.5 |
| `512f810` | T-125: peril 4's first ambush and raid wait for day 56 | Claude Sonnet 5.5 |
| `185b692` | Merge branch 'master' into t-140 | orchestrator merge |

   `4e14aee` is charged to Gemini: `PROGRESS.md` records it as run `agy-m603`, and it sits inside Gemini's unbroken M6 series. `678774e`, `16c13d1` and `512f810` are Claude Sonnet 5.5 run through the Antigravity CLI: `agents/antigravity.md` names these three tasks. The three "chore: start" commits change no code. Three commits carry two trailers (Gemini and Opus); they are counted for Gemini, which did the work. If `4e14aee` were left unattributed, Gemini would lose 2 bugs and 1,117 lines, and its rate per 1,000 lines would stay at 2.2.
7. **Denominators (measured).**
   - *Code lines added:* lines added under `src/` and `scripts/` by the agent's non-merge commits, without `src/content/*.json`. Tests, goldens, docs and reports are not counted. The total is 77,281.
   - *Surviving lines:* non-blank lines of today's `src/` and `scripts/` code files that `git blame -w -M -C` gives to the agent's commits: 67,924 lines in 349 files.
   - *Tasks:* distinct ids (`T-Mn-nn`, `T-nnn`, `F-nn`, `U-nn`, `C-nnn`) in the subjects of non-merge commits. A task goes to the agent that added most of its code lines; half each if the second agent added 40% or more.

## Caveats

- **The early builder has the most exposure.** Opus 5 wrote 45,923 of the 77,281 code lines and the systems everything else calls (jobs, items, buildings, the core). Every later audit ran through its code. Its absolute count is high for that reason. Its rate is low partly because much of its code is plain infrastructure (world generation, pathfinding, the renderer, the content loader) that no audit read.
- **The audits did not look everywhere.** The T-115 bug hunt found 48 of the 124 bugs. It looked hardest at death, gear, raids, commands and saves. That is Gemini's M6 code (combat, threats, health) and the jobs and items code of Opus 5. The UI audit found 30 more, all in panels written by Opus 5 and GPT-6 Sol. World generation, fluids, weather, plants, trade and the renderer were hardly audited.
- **UI bugs lean on judgement.** Many are features the spec promised and a panel did not have. Charging the first author of the panel is a choice: a panel written at M2 could not show a system that arrived at M6. Read the "UI bugs excluded" column beside the main one.
- **Omissions are judgement calls.** 28 charged bugs are omissions. Many could be charged to a second agent: the one that added the feature which made the missing rule matter. Read the "omissions excluded" column too.
- **Recent code has had no time to be found wrong.** GPT-6.1 Sol's and Opus 5.5's code dates from 2026-10-03 on. The bug hunt read the tree of 2026-10-08. Nothing has audited the U-01 to U-07 panels or the T-16x fixes. Their near-zero counts are a lower bound.
- **Some agents could hardly have bugs.** Sonnet 5.5 added 156 code lines. Sonnet 5 and Fable 5.1 added none. GPT-6.1 Sol's 38 code tasks are mostly small fixes with regression tests, which is safer work than building a system.
- **Tasks are not equal.** A milestone task of Opus 5 or Gemini is often 1,000 lines; a T-16x fix is 30. Bugs per task compares unlike things. Bugs per line is the fairer rate.
- **Lines are not equal either.** GPT-6 Sol's lines are dwarf behaviour, workshops and panels, where each small rule can be wrong. Opus 5's include thousands of lines of generators and schema. A rate per line rewards volume.
- **Fixes folded into feature commits are not counted.** Three are known from commit bodies: `75a777f` (GPT-6 Sol repaired the previous agent's military panel wiring), `6cee579` and `0cf9fd5` (Opus 5 fixed its own earlier code). Bugs filed and still open (T-184 to T-192 and others in the backlog) are not counted, because they have no fix to blame from.
- **Specification faults are charged to nobody.** All 22 trace to the design documents Fable 5.1 wrote. If they were charged, Fable 5.1 would have 23.

## Coverage

All 437 commits were scanned and all 194 non-merge commits that change non-test code were classified. Every fix was traced: the two milestone-era fixes, F-01 to F-17, the M8 fixes, U-01 to U-08, T-117 to T-143, T-160 to T-177, T-180 to T-183 and T-132. Nothing was left out for lack of budget. The introducing commit of each of the 102 charged bugs comes from a blame of the fix's hunks or of the lines the audit named. No test was re-run and no bug was reproduced for this report.

## Every bug

| Id | Fix commit | Task | Bug | Files | Introducing commit | Introducing agent | Kind | Confidence | Found by | Fixed by |
|---|---|---|---|---|---|---|---|---|---|---|
| B001 | `ebc1c20` | T-160 | A dwarf who dies holding a tool or a load takes it out of the world | jobs/board.ts workerDied | `9e6d0ad` T-M1-08 | Claude Opus 5 | missing cleanup (omission) | medium | T-115 bug hunt | GPT-6.1 Sol |
| B002 | `6c30bf7` | T-161 | A dead soldier's claimed gear stays owned by the dead dwarf | combat/equipment.ts; items/index.ts | `2efbdd9` T-M6-06 | Gemini 3.8 Flash | missing cleanup (omission) | medium | T-115 bug hunt | GPT-6.1 Sol |
| B003 | `6c30bf7` | T-161 | A squad may claim the only pick or axe a civilian worker needs (the spec allowed it) | combat/equipment.ts | – | none (spec) | spec | – | T-115 bug hunt | GPT-6.1 Sol |
| B004 | `c0e450a` | T-162 | Squad equipping writes item records directly: stock counts and containers go wrong | combat/equipment.ts, training.ts | `2efbdd9` T-M6-06 | Gemini 3.8 Flash | wrong logic | high | T-115 bug hunt | GPT-6.1 Sol |
| B005 | `c0e450a` | T-162 | Ammunition and archery practice bypass the item API (quiver with no container record) | combat/ranged.ts | `4e14aee` T-M6-03 | Gemini 3.8 Flash | wrong logic | high | T-115 bug hunt | GPT-6.1 Sol |
| B006 | `29013e2` | T-163 | A raider's gear is spawned on its arrival tile and keeps a position while carried | threats/gear.ts | `cff4f59` T-M6-08 | Gemini 3.8 Flash | wrong logic | high | T-115 bug hunt | GPT-6.1 Sol |
| B007 | `29013e2` | T-163 | A hostile that leaves the map does not take or remove what it carries | threats/ai.ts despawnMember | `682a650` T-M6-09 | Gemini 3.8 Flash | missing cleanup (omission) | medium | T-115 bug hunt | GPT-6.1 Sol |
| B008 | `29013e2` | T-163 | A caravan guard's dagger and arrows outlive the guard (C9) | trade/index.ts | `00b3faf` T-M7-01 | GPT-6 Sol | missing cleanup | high | T-115 bug hunt | GPT-6.1 Sol |
| B009 | `8428423` | T-164 | Burial destroys the corpse and leaves its worn items counted and nowhere | buildings/burial.ts; items/api.ts | `18dbd8e` T-M6-14 | GPT-6 Sol | missing cleanup (omission) | medium | T-115 bug hunt | GPT-6.1 Sol |
| B010 | `1b37cb9` | T-165 | A dead dwarf keeps its bedroom for ever | buildings/rooms.ts | `733303b` T-M2-07 | Claude Opus 5 | missing cleanup (omission) | medium | T-115 bug hunt | GPT-6.1 Sol |
| B011 | `1b37cb9` | T-165 | A pet keeps petOf naming its dead owner (C10) | animals/index.ts | `054cddf` T-M4-04 | GPT-6 Sol | missing cleanup (omission) | medium | T-115 bug hunt | GPT-6.1 Sol |
| B012 | `402ff03` | T-166 | A meal or drink reserved by a dwarf who dies stays reserved | dwarves/activities.ts, index.ts | `b587b6a` T-M4-06 | GPT-6 Sol | missing cleanup | high | T-115 bug hunt | GPT-6.1 Sol |
| B013 | `402ff03` | T-166 | A dwarf who falls unconscious keeps its meal reservation | dwarves/brain.ts | `6c0fb89` T-M6-01 | Gemini 3.8 Flash | missing cleanup | medium | T-115 bug hunt | GPT-6.1 Sol |
| B014 | `d37931c` | T-167 | AddWorkOrder throws on a null order | workshops/orders.ts | `1eb9026` T-M4-08 | GPT-6 Sol | missing validation | high | T-115 bug hunt | GPT-6.1 Sol |
| B015 | `d37931c` | T-167 | EditWorkOrder throws on a null patch | workshops/orders.ts | `1eb9026` T-M4-08 | GPT-6 Sol | missing validation | high | T-115 bug hunt | GPT-6.1 Sol |
| B016 | `d37931c` | T-167 | A hunting-zone command throws on an unknown species | foraging/index.ts | `180139a` T-M4-11 | GPT-6 Sol | missing validation | high | T-115 bug hunt | GPT-6.1 Sol |
| B017 | `d37931c` | T-167 | DesignateStairwell throws on a fractional coordinate | terrain/commands.ts | `24da3b9` T-M1-07 | Claude Opus 5 | missing validation | high | T-115 bug hunt | GPT-6.1 Sol |
| B018 | `d37931c` | T-167 | A command that throws aborts the tick and drops the rest of the queue | core/world.ts | `5f9cc8a` T-M0-08 | Claude Opus 5 | missing validation | medium | T-115 bug hunt | GPT-6.1 Sol |
| B019 | `07572b4` | T-168 | SetHospitalSupplies accepts any value; a NaN makes the game impossible to save | health/index.ts | `98a0cb9` T-M6-07 | Gemini 3.8 Flash | missing validation | high | T-115 bug hunt | GPT-6.1 Sol |
| B020 | `07572b4` | T-168 | SetZoneSetting stores any value for any key | buildings/zones.ts | `b788dc2` T-M2-03 | Claude Opus 5 | missing validation | high | T-115 bug hunt | GPT-6.1 Sol |
| B021 | `07572b4` | T-168 | The plot crop command accepts a non-integer or negative plant index | plants/index.ts | `9309612` T-M4-01 | Claude Opus 5 | missing validation | high | T-115 bug hunt | GPT-6.1 Sol |
| B022 | `ca9f494` | T-169 | A thief that escapes with loot ends its raid as withdrew | threats/ai.ts, index.ts | `682a650` T-M6-09 | Gemini 3.8 Flash | wrong logic | high | T-115 bug hunt | GPT-6.1 Sol |
| B023 | `a4677bc` | T-170 | Ambush parties are never hidden and AmbushSprung is never emitted | threats/ai.ts, index.ts, parties.ts | `682a650` T-M6-09 | Gemini 3.8 Flash | wrong logic | high | T-115 bug hunt | GPT-6.1 Sol |
| B024 | `c04eb46` | T-171 | Soldiers claim a visiting caravan's goods | combat/equipment.ts isAvailableItem | `2efbdd9` T-M6-06 | Gemini 3.8 Flash | wrong logic | high | T-115 bug hunt | GPT-6.1 Sol |
| B025 | `c04eb46` | T-171 | An equipment slot keeps naming a destroyed item | combat/equipment.ts, index.ts | `2efbdd9` T-M6-06 | Gemini 3.8 Flash | missing cleanup (omission) | medium | T-115 bug hunt | GPT-6.1 Sol |
| B026 | `a141d4c` | T-172 | Jobs whose target entity is destroyed (a dead patient, a removed workshop) stay open for ever | jobs/board.ts; core/entities.ts | `9e6d0ad` T-M1-08 | Claude Opus 5 | missing cleanup (omission) | medium | T-115 bug hunt | GPT-6.1 Sol |
| B027 | `f1f099d` | T-173 | A retreating thief oscillates between two exits and never leaves | threats/ai.ts | `682a650` T-M6-09 | Gemini 3.8 Flash | wrong logic | high | T-115 bug hunt | GPT-6.1 Sol |
| B028 | `f1f099d` | T-173 | A party that has arrived and finds no reachable defender waits for ever (no rule in the spec) | threats/ai.ts | – | none (spec) | spec | – | T-115 bug hunt | GPT-6.1 Sol |
| B029 | `6f66980` | T-174 | A work order's material filter changes on load (string id stored where an index is read back) | workshops/orders.ts, operate.ts | `1eb9026` T-M4-08 | GPT-6 Sol | save/load | medium | T-115 bug hunt | GPT-6.1 Sol |
| B030 | `3f9e424` | T-132 | Stockpile hauls take a barrel reserved by a brew job; the still stalls and the fortress dies of thirst | items/hauling.ts, stockpiles.ts | `072b9a8` T-M2-04 | Claude Opus 5 | wrong logic (omission) | medium | year-long browser playthrough | GPT-6.1 Sol |
| B031 | `d2ebc83` | T-175 | SetPopulationCap clamps out-of-range values and answers ok (C1) | immigration/index.ts | `5010069` golden | GPT-6 Sol | missing validation | high | T-115 bug hunt | GPT-6.1 Sol |
| B032 | `d2ebc83` | T-175 | SetStandingOrder accepts toString, constructor, __proto__ as names (C2) | jobs/commands.ts | `9e6d0ad` T-M1-08 | Claude Opus 5 | missing validation | high | T-115 bug hunt | GPT-6.1 Sol |
| B033 | `d2ebc83` | T-175 | AssignPasture answers not_tame for a tame non-grazer; no reason existed for it (C3) | animals/index.ts | – | none (spec) | spec | – | T-115 bug hunt | GPT-6.1 Sol |
| B034 | `d2ebc83` | T-175 | SetSquadLeader accepts a dwarf who is not a member (C4) | combat/squads.ts | `51fbe3d` T-M6-05 | Gemini 3.8 Flash | missing validation | high | T-115 bug hunt | GPT-6.1 Sol |
| B035 | `d2ebc83` | T-175 | SetSquadEquipment stores unknown weapon classes and armour kinds (C5) | combat/squads.ts | `51fbe3d` T-M6-05 | Gemini 3.8 Flash | missing validation | high | T-115 bug hunt | GPT-6.1 Sol |
| B036 | `d2ebc83` | T-175 | LinkStockpile accepts a source that is not a stockpile (C6) | items/stockpile-commands.ts | `b788dc2` T-M2-03 | Claude Opus 5 | missing validation | high | T-115 bug hunt | GPT-6.1 Sol |
| B037 | `d2ebc83` | T-175 | SetPlateTrigger accepts a fractional fluid level (C7) | buildings/build.ts | `d5f8513` T-M6-12 | GPT-6 Sol | missing validation | high | T-115 bug hunt | GPT-6.1 Sol |
| B038 | `d2ebc83` | T-175 | SetStockpileContainers accepts a count far above the stockpile's tiles (C7) | items/stockpile-commands.ts | `b788dc2` T-M2-03 | Claude Opus 5 | missing validation | medium | T-115 bug hunt | GPT-6.1 Sol |
| B039 | `d2ebc83` | T-175 | A party in state gone is never destroyed (C8) | threats/index.ts | `682a650` T-M6-09 | Gemini 3.8 Flash | missing cleanup (omission) | medium | T-115 bug hunt | GPT-6.1 Sol |
| B040 | `d2ebc83` | T-175 | A sapling grows into a tree on a tile that holds a creature | plants/wild.ts | `6cee579` T-M4-02 | Claude Opus 5 | wrong logic (omission) | medium | T-115 bug hunt | GPT-6.1 Sol |
| B041 | `d2ebc83` | T-175 | A craft job keeps listing a delivered input after the item is destroyed | jobs/index.ts, board.ts | `9e6d0ad` T-M1-08 | Claude Opus 5 | missing cleanup | medium | T-115 bug hunt | GPT-6.1 Sol |
| B042 | `1ee4263` | T-177 | The hauling-shortage hint of 11 § Hauling was never implemented (constant defined, unused) | ui/hints.ts; jobs/constants.ts | `9e6d0ad` T-M1-08 | Claude Opus 5 | omission | low | T-115 bug hunt (spec against code) | GPT-6.1 Sol |
| B043 | `1ee4263` | T-177 | Ranged soldiers never keep RANGED_KEEP_DISTANCE from melee threats (constant defined, unused) | combat/kiting.ts, index.ts | `4fae6eb` T-M6-02 | Gemini 3.8 Flash | omission | medium | T-115 bug hunt (spec against code) | GPT-6.1 Sol |
| B044 | `03ae75b` | T-180 | A worker that fetches a second tool keeps the first; the first is lost to every search | jobs/steps.ts, items-adapter.ts | `9e6d0ad` T-M1-08 | Claude Opus 5 | wrong logic (omission) | medium | T-115 spec reading | Claude Sonnet 5.5 |
| B045 | `03ae75b` | T-180 | A pick or axe in the weapon slot does not count as a held tool | jobs/items-adapter.ts hasTool | `2efbdd9` T-M6-06 | Gemini 3.8 Flash | wrong logic | low | T-115 spec reading | Claude Sonnet 5.5 |
| B046 | `0d9373c` | T-182 | A workshop keeps a job blocked on a missing input for ever and never starts the next runnable order | workshops/operate.ts | `1eb9026` T-M4-08 | GPT-6 Sol | wrong logic (omission) | medium | T-115 spec reading | Claude Sonnet 5.5 |
| B047 | `90ba3c9` | T-181 | A sprung cage trap can never be re-armed: the input filter emptyContainer:cage matches no cage | buildings/build.ts; defense/traps.ts | `d5f8513` T-M6-12 | GPT-6 Sol | wrong logic | high | T-115 spec reading | Claude Sonnet 5.5 |
| B048 | `90ba3c9` | T-181 | An occupied cage counts as available stock; occupant writers bypass the item API | items/counts.ts; animals/index.ts; trade/caravan.ts | `d5f8513` T-M6-12 + `d3f4b05` T-M6-15 | GPT-6 Sol + Gemini 3.8 Flash | wrong logic | medium | T-115 spec reading | Claude Sonnet 5.5 |
| B049 | `6af8f84` | T-183 | A hunter carries the first corpse in the world, not its own kill | jobs/steps.ts stepHunt | `4e14aee` T-M6-03 | Gemini 3.8 Flash | wrong logic | high | T-115 spec reading | Claude Sonnet 5.5 |
| B050 | `23f3961` | T-117 | A dwarf death is announced as an ordinary creature note | ui/announcements.ts | `75a777f` T-M6-16 | GPT-6 Sol | ui | medium | T-102 interface work | GPT-6.1 Sol |
| B051 | `678774e` | T-118 | The unsaved-change check ignores commands applied while paused | app/game.ts, sim-host.ts | `fac58ce` U-02 | GPT-6.1 Sol | save/load | medium | U-02 review | Claude Sonnet 5.5 |
| B052 | `082aa6b` | T-119 | Arrival looks up a tree's plant species with its material index | embark/arrival.ts | `faffb2e` T-M2-08 | Claude Opus 5 | wrong logic | high | T-104 decision triage | GPT-6.1 Sol |
| B053 | `59042a9` | T-120 | Bedroom assignment does not read actual morale | buildings/index.ts | `733303b` T-M2-07 | Claude Opus 5 | wrong logic | medium | T-106 decision triage | GPT-6.1 Sol |
| B054 | `59042a9` | T-120 | Fixed-footprint buildings accept supplied dimensions | buildings/build.ts | `c79c0a8` T-M6-13 | GPT-6 Sol | missing validation | medium | T-106 decision triage | GPT-6.1 Sol |
| B055 | `59042a9` | T-120 | A trained squad does not follow its new barracks assignment | combat/training.ts | `2efbdd9` T-M6-06 | Gemini 3.8 Flash | wrong logic | high | T-106 decision triage | GPT-6.1 Sol |
| B056 | `5bb5581` | T-121 | The announcement registry keeps one spec per event: filtered sulk and furniture-breaking announcements are lost | ui/announcements.ts | `c38d1d8` T-M1-14 | Claude Opus 5 | wrong logic | low | T-107 decision triage | GPT-6.1 Sol |
| B057 | `5bb5581` | T-121 | Settings failures show raw codes | ui/screens/settings.ts | `f23ed86` T-M7-07 | GPT-6 Sol | ui | medium | T-107 decision triage | GPT-6.1 Sol |
| B058 | `3cebc7a` | T-122 | Cornered civilians stay in the fighting state until their needs kill them | dwarves/brain.ts | `61a8f99` T-M6-04 | Gemini 3.8 Flash | wrong logic | high | Codex while repairing the economy fortress | GPT-6.1 Sol |
| B059 | `16c13d1` | T-124 | A fine meal writes joy from a stale needs snapshot and puts the old hunger back | dwarves/activities.ts | `b587b6a` T-M4-06 | GPT-6 Sol | wrong logic | high | F-17 balance re-measure | Claude Sonnet 5.5 |
| B060 | `512f810` | T-125 | Peril 4's first ambush and raid are scheduled before day 56, against balance.md | docs/03-content/threat-schedules.md | `78b2b8f` Wave 3 | Claude Fable 5.1 | content | high | F-17 balance re-measure | Claude Sonnet 5.5 |
| B061 | `b7430d4` | T-130 | Content-defined initial cavern fauna is ignored | animals/index.ts, spawn.ts | `f6712da` T-M4-03 | Claude Opus 5 | omission | medium | T-105 decision triage | GPT-6.1 Sol |
| B062 | `b7430d4` | T-130 | A fetched tool's reservation is released without the board, so no ItemReleased names the job | jobs/steps.ts | `83777cf` T-M2-02 | Claude Opus 5 | wrong logic | high | T-105 decision triage | GPT-6.1 Sol |
| B063 | `ad27193` | T-131 | A load re-runs bootstrap: cavern populations and web flags are added on load | threats/index.ts; app/game-save.ts | `af870b8` T-M6-10 | Gemini 3.8 Flash | save/load | medium | T-130 save/load probe | GPT-6.1 Sol |
| B064 | `8f92e42` | T-141 | A civilian fleeing at a stair head treats any other level as safe, forgets the threat and climbs back (livelock) | dwarves/brain.ts findFleeTile | `3cebc7a` T-122 | GPT-6.1 Sol | wrong logic | high | T-123 economy audit | GPT-6.1 Sol |
| B065 | `13118e0` | T-142 | The trade job outlives its caravan and its broker | trade/index.ts | `b94478c` golden | GPT-6 Sol | missing cleanup (omission) | medium | T-123 economy audit | GPT-6.1 Sol |
| B066 | `c2b8ca8` | T-143 | Delivered inputs of an interrupted job are freed after RESERVE_KEEP_TICKS (as 11 said) | jobs/board.ts | – | none (spec) | spec | – | T-123 economy audit | GPT-6.1 Sol |
| B067 | `a28626d` | F-17 | Crafts behind the symbolic craft output are exported quality:false and lose their quality | scripts/export-tables.mjs | `99453d8` T-M0-06 | Claude Opus 5 | content | high | M8 economy balance measurement | Claude Opus 5.5 |
| B068 | `a28626d` | F-17 | A job resumes with stale delivered inputs and outputs a material-0 item | jobs/board.ts | `9e6d0ad` T-M1-08 | Claude Opus 5 | omission | medium | M8 economy balance measurement | Claude Opus 5.5 |
| B069 | `9a02dcf` | F-17 | Renown counts tame animals as population | threats/index.ts | `cff4f59` T-M6-08 | Gemini 3.8 Flash | wrong logic | high | M8 economy balance measurement | Claude Opus 5.5 |
| B070 | `9a02dcf` | F-17 | The winter immigration wave halves before it clamps | immigration/waves.ts | `5010069` golden | GPT-6 Sol | wrong logic | high | M8 economy balance measurement | Claude Opus 5.5 |
| B071 | `f82bb84` | fix(threats) | Hostiles lose their target behind occlusion and never attack | combat/index.ts, targets.ts | `4fae6eb` T-M6-02 | Gemini 3.8 Flash | wrong logic | high | T-M8-06 balance measurement | GPT-6.1 Sol |
| B072 | `63bc36e` | fix(items) | Hostile gear counts as fortress wealth before it is recovered (earlier decision D-068(f) superseded) | items/index.ts, rot.ts | – | none (spec) | spec | – | T-M8-06 balance measurement | GPT-6.1 Sol |
| B073 | `5f64ad7` | F-16 | A civilian with no reachable shelter freezes (10 did not say what to do) | dwarves/brain.ts | – | none (spec) | spec | – | M8 mood diagnosis | GPT-6.1 Sol |
| B074 | `c34a9bb` | F-15 | Bandits standing on their stockpile never steal or leave (18 did not say what they do on arrival) | threats/ai.ts | – | none (spec) | spec | – | M8 mood diagnosis | Gemini 3.8 Flash |
| B075 | `c34a9bb` | F-15 | A party leader whose walk fails stays in approach for ever | threats/ai.ts | `682a650` T-M6-09 | Gemini 3.8 Flash | wrong logic | medium | M8 mood diagnosis | Gemini 3.8 Flash |
| B076 | `cc4c070` | fix(buildings) | A lock_on_alert door that locks by timeout does not update connectivity | buildings/build.ts | `d5f8513` T-M6-12 | GPT-6 Sol | wrong logic | high | T-M8-06 diagnosis | Gemini 3.8 Flash |
| B077 | `cbbf8a9` | F-13 | A raid that sees a dwarf it cannot reach never loiters or leaves (18 as written) | threats/ai.ts | – | none (spec) | spec | – | M8 mood diagnosis | Gemini 3.8 Flash |
| B078 | `cbbf8a9` | F-13 | A tame animal parks on a door and blocks it (22 as written) | animals/tame.ts | – | none (spec) | spec | – | M8 mood diagnosis | Gemini 3.8 Flash |
| B079 | `79fbf68` | F-12 | Comfort and joy rates outrun the visit frequency balance.md documents (spec contradicts itself) | dwarves/constants | – | none (spec) | spec | – | M8 mood diagnosis | Gemini 3.8 Flash |
| B080 | `1764159` | fix(jobs) | assignOne fetches a candidate job that a failed claim's cascade removed (crash) | jobs/board.ts | `95cff2b` F-01 | Gemini 3.8 Flash | wrong logic | medium | T-M8-06 balance run | Gemini 3.8 Flash |
| B081 | `95cff2b` | F-01 | Assignment livelock: blocked jobs reopen unchecked and the worker gets no job (W4 specified it) | jobs/board.ts | – | none (spec) | spec | – | M5 audit | Gemini 3.8 Flash |
| B082 | `95cff2b` | F-01 | Multi-unit building inputs count stacks, not units | buildings/build.ts | `c50d0a7` T-M2-05 | Claude Opus 5 | wrong logic | medium | M5 audit | Gemini 3.8 Flash |
| B083 | `95cff2b` | F-01 | Haul jobs stay open for items a worker has already picked up | items/hauling.ts | `072b9a8` T-M2-04 | Claude Opus 5 | wrong logic | medium | M5 audit | Gemini 3.8 Flash |
| B084 | `39147e7` | F-02 | Need pressure shares the negatives cap, so neglect cannot make a dwarf Miserable (15 contradicts itself) | morale/mood.ts | – | none (spec) | spec | – | M5 audit | Gemini 3.8 Flash |
| B085 | `67002ab` | F-03 | Uneven water never settles (rule 2 of 04 as written) | fluids | – | none (spec) | spec | – | M5 audit | Gemini 3.8 Flash |
| B086 | `94d7e56` | F-05 | Social picks one partner up front and waits for that dwarf only | dwarves/activities.ts | `b587b6a` T-M4-06 | GPT-6 Sol | wrong logic | high | M5 audit | Gemini 3.8 Flash |
| B087 | `94d7e56` | F-05 | Need targets ignore reachability: an unreachable bed or well loops a dwarf | dwarves/activities.ts | `b587b6a` T-M4-06 | GPT-6 Sol | wrong logic | high | M5 audit | Gemini 3.8 Flash |
| B088 | `94d7e56` | F-05 | Water is searched only on the dwarf's own level | dwarves/activities.ts | `b587b6a` T-M4-06 | GPT-6 Sol | wrong logic | medium | M5 audit | Gemini 3.8 Flash |
| B089 | `696bd49` | F-10 | Hunger and thirst rates are three times the documented season (spec contradicts itself) | dwarves/constants | – | none (spec) | spec | – | M5 audit | Gemini 3.8 Flash |
| B090 | `a4f8883` | F-11 | An idle dwarf ignores new work for IDLE_TICKS (10 as written) | dwarves/brain.ts | – | none (spec) | spec | – | M5 audit | Gemini 3.8 Flash |
| B091 | `a72826b` | F-08 | Deep emergence lists are exported empty | scripts/lib/export/meta.mjs | `99453d8` T-M0-06 | Claude Opus 5 | content | medium | M5 audit | Gemini 3.8 Flash |
| B092 | `aca6ea4` | F-09 | Mood, sulk and fish-pool announcements show raw string keys (no text registered) | morale/index.ts; ui/strings.ts | `c3b8668` T-M4-13 | GPT-6 Sol | ui | medium | M5 audit | Gemini 3.8 Flash |
| B093 | `261ad68` | fix(jobs) | A stacked craft input is split into single units and fetched one trip each | jobs/items-adapter.ts | `1eb9026` T-M4-08 | GPT-6 Sol | wrong logic | high | Codex during M4 | GPT-6 Sol |
| B094 | `479cb6a` | fix(health) | CreatureDied is emitted once per lethal hit, not once per death | health/tick.ts | `6c0fb89` T-M6-01 | Gemini 3.8 Flash | wrong logic | medium | Codex at the M6 gate | GPT-6 Sol |
| B095 | `a8e0a26` | U-01 | The military squad list hides a squad (list height omits the header) | ui/panels/military.ts | `75a777f` T-M6-16 | GPT-6 Sol | ui | high | UI audit of v1.0.0 | Claude Opus 5.5 |
| B096 | `a8e0a26` | U-01 | The labor grid cannot scroll its rows | ui/panels/labors.ts | `382f17d` T-M2-09 | Claude Opus 5 | ui | medium | UI audit of v1.0.0 | Claude Opus 5.5 |
| B097 | `a8e0a26` | U-01 | Harvest is permanently dim (a stale M4 gate) | ui/panels/designate.ts | `c38d1d8` T-M1-14 | Claude Opus 5 | ui | medium | UI audit of v1.0.0 | Claude Opus 5.5 |
| B098 | `a8e0a26` | U-01 | hint_fuel can never fire: it waits for a reason no system emits | ui/hints.ts | `af9aadb` T-M4-16 | GPT-6 Sol | ui | high | UI audit of v1.0.0 | Claude Opus 5.5 |
| B099 | `a8e0a26` | U-01 | hint_farm can never fire: the zone tool never sends a refusable rectangle | ui/hints.ts | `af9aadb` T-M4-16 | GPT-6 Sol | ui | medium | UI audit of v1.0.0 | Claude Opus 5.5 |
| B100 | `a8e0a26` | U-01 | The orders panel draws a glyph the atlas does not have | ui/panels/orders.ts; ui/surface.ts | `7b3f8fd` T-M4-17 Panels | GPT-6 Sol | ui | medium | UI audit of v1.0.0 | Claude Opus 5.5 |
| B101 | `a8e0a26` | U-01 | The build list shows raw content ids | ui/panels/build.ts | `382f17d` T-M2-09 | Claude Opus 5 | ui | high | UI audit of v1.0.0 | Claude Opus 5.5 |
| B102 | `a8e0a26` | U-01 | The hostile counter counts sealed-cavern hostiles (the spec said two things) | ui/status.ts | – | none (spec) | spec | – | UI audit of v1.0.0 | Claude Opus 5.5 |
| B103 | `0d7199b` | U-01 | Rejections vanish from the status row after two seconds and block reasons do not name the missing input (24 and 11 as written) | ui/screens/fortress.ts; ui/messages.ts | – | none (spec) | spec | – | UI audit of v1.0.0 | Claude Opus 5.5 |
| B104 | `cc8c064` | U-01 | A workshop shows a raw block code | ui/panels/orders.ts; workshops/operate.ts | `7b3f8fd` T-M4-17 Panels | GPT-6 Sol | ui | high | UI audit of v1.0.0 | Claude Opus 5.5 |
| B105 | `cc8c064` | U-01 | The depot panel titles itself Depot #entity-id | ui/panels/depot.ts | `4b8ef2f` T-M7-03 | GPT-6 Sol | ui | medium | UI audit of v1.0.0 | Claude Opus 5.5 |
| B106 | `cc8c064` | U-01 | The animals panel shows milestone placeholders (M6) with no handler | ui/panels/animals.ts | `7b3f8fd` T-M4-17 Panels | GPT-6 Sol | ui | high | UI audit of v1.0.0 | Claude Opus 5.5 |
| B107 | `cc8c064` | U-01 | Save and load messages show raw save ids | app/game.ts | `542e51b` T-M2-11 | Claude Opus 5 | ui | medium | UI audit of v1.0.0 | Claude Opus 5.5 |
| B108 | `cc8c064` | U-01 | Immigration and reputation announcements show a raw reason code | ui/strings.ts; immigration | `5010069` golden | GPT-6 Sol | ui | medium | UI audit of v1.0.0 | Claude Opus 5.5 |
| B109 | `cc8c064` | U-01 | Keybinding rows show action ids, not actions | ui/screens/settings.ts | `f23ed86` T-M7-07 | GPT-6 Sol | ui | high | UI audit of v1.0.0 | Claude Opus 5.5 |
| B110 | `0b124b1` | U-01 | The minus key un-pauses a paused game | ui/screens/fortress.ts | `c38d1d8` T-M1-14 | Claude Opus 5 | ui | medium | UI audit of v1.0.0 | Claude Opus 5.5 |
| B111 | `0b124b1` | U-01 | Ctrl+S does not open the save menu (24 § Input model) | ui/screens/fortress.ts; platform/input.ts | `c38d1d8` T-M1-14 | Claude Opus 5 | ui | medium | UI audit of v1.0.0 | Claude Opus 5.5 |
| B112 | `0b124b1` | U-01 | The embark screen opens empty and an empty party may embark (02 silent) | ui/screens/embark.ts | – | none (spec) | spec | – | UI audit of v1.0.0 | Claude Opus 5.5 |
| B113 | `0b124b1` | U-01 | c_remove_stockpile_items defaults to Yes (24 contradicts the content row) | content | – | none (spec) | spec | – | UI audit of v1.0.0 | Claude Opus 5.5 |
| B114 | `fac58ce` | U-02 | A paused game ignores input until it runs (simulation-core as written) | app/sim-host.ts | – | none (spec) | spec | – | UI audit of v1.0.0 | GPT-6.1 Sol |
| B115 | `42b1f7a` | U-03 | Plus opens a new global order even when an order is selected; the count cannot be changed and minus falls through to speed | ui/screens/fortress.ts | `7b3f8fd` T-M4-17 Panels | GPT-6 Sol | ui | high | UI audit of v1.0.0 | Claude Opus 5.5 |
| B116 | `42b1f7a` | U-03 | The order list has no waiting-for-input status (12 § Operation) | ui/panels/orders.ts | `7b3f8fd` T-M4-17 Panels | GPT-6 Sol | ui | medium | UI audit of v1.0.0 | Claude Opus 5.5 |
| B117 | `42b1f7a` | U-03 | Panel accelerators swallow the global panel hotkeys (the keymap spec guaranteed collisions) | ui/screens/fortress.ts | – | none (spec) | spec | – | UI audit of v1.0.0 | Claude Opus 5.5 |
| B118 | `5d9759f` | U-04 | Placing many buildings is one click per tile (14 as written) | ui/panels/build.ts | – | none (spec) | spec | – | UI audit of v1.0.0 | Claude Opus 5.5 |
| B119 | `3b06f7b` | U-05 | Non-workshop buildings have no panel: no modes, links, owners (14 § Player-facing behavior) | ui/panels/look.ts | `382f17d` T-M2-09 + `c79c0a8` T-M6-13 | Claude Opus 5 + GPT-6 Sol | ui | low | UI audit of v1.0.0 | Claude Opus 5.5 |
| B120 | `9d92c17` | U-06 | Unit title and rename actions are dim and inert; no mood glyph | ui/panels/units.ts | `382f17d` T-M2-09 + `7b3f8fd` T-M4-17 Panels | Claude Opus 5 + GPT-6 Sol | ui | low | UI audit of v1.0.0 | Claude Opus 5.5 |
| B121 | `9d92c17` | U-06 | The labor priority row is read-only text | ui/panels/jobs.ts | `382f17d` T-M2-09 | Claude Opus 5 | ui | medium | UI audit of v1.0.0 | Claude Opus 5.5 |
| B122 | `0e875a7` | U-07 | Stockpile preset is click-to-cycle and the other fields are display-only, mouse-only | ui/panels/zones.ts | `382f17d` T-M2-09 | Claude Opus 5 | ui | medium | UI audit of v1.0.0 | GPT-6.1 Sol |
| B123 | `42c623d` | U-08 | Truncated cells have no tooltip (24 § Input model) | ui/widgets/label.ts | `04108bd` T-M1-12 | Claude Opus 5 | ui | low | UI audit of v1.0.0 | Gemini 3.8 Flash |
| B124 | `42c623d` | U-08 | Ghost validity and recipe makeability are shown by colour alone (24 § Accessibility) | ui/screens/fortress.ts; ui/panels/orders.ts | `382f17d` T-M2-09 + `7b3f8fd` T-M4-17 Panels | Claude Opus 5 + GPT-6 Sol | ui | low | UI audit of v1.0.0 | Gemini 3.8 Flash |
