# Audit fixes (between M5 and M6)

> **Archived.** F-01 … F-16 are done and their spec amendments are in the specification. F-17 closed on 2026-10-07: its document is [`../tasks/F-17-balance-followups.md`](../tasks/F-17-balance-followups.md), and its row is in [`../../backlog.md`](../../backlog.md). The rules quoted below (the plan's ground rules, the per-task permission to edit the spec, the progress block) are history; current work follows [`../../process/agent-workflow.md`](../../process/agent-workflow.md).

**Owner:** implementation · **Source:** [`reports/audit-M5.md`](../../../reports/audits/audit-M5.md) and the verification work behind these documents (2026-09-24)

These documents turn the findings of the M5 audit into tasks a coding agent can carry out without making design decisions. Every decision a task needs has been made here and is marked **Decision**. Wherever a task changes the specification, the exact old and new text is given as **Spec amendment**.

The plan's ground rules ([`../build-plan/README.md`](../build-plan/README.md), [`../../process/agent-workflow.md`](../../process/agent-workflow.md)) apply unchanged, with one addition: an agent working a task below **may edit `docs/00-` … `docs/04-` exactly as the task's spec amendments say**, and nowhere else. These documents are owner-approved amendments. They are not ambiguities to be resolved by the agent.

## How these were verified

Findings F-01 to F-06 were reproduced and their fixes prototyped on a scratch copy of the repository at commit `743deff` (T-M5-09). Every number quoted as "measured" comes from those runs. The prototypes are not committed; the tasks re-implement them properly, with the tests the tasks list. Where a task gives a measured bound for a new assertion, the bound has a margin and a rule for what to do if it does not hold. Do not loosen a bound silently.

## Tasks

| Id | Title | Size | Needs | Why it matters |
|---|---|---|---|---|
| [F-01](F-01-job-assignment-livelock.md) | Core job-loop defects: assignment livelock, stacked build inputs, haul jobs for held items | M | — | A fortress with one unbuildable building stops working, with dwarves idle beside open jobs, and no hearth or forge can be built from crafted blocks. **Blocks every realistic playthrough.** |
| [F-02](F-02-mood-need-pressure.md) | Mood: need pressure as its own term; the needs-met floor | S | — | Neglect cannot make a normal dwarf Miserable; sulks are mostly unreachable (C-006, C-007) |
| [F-03](F-03-fluid-settling.md) | Fluids: an equalize budget so disturbed water settles | M | — | Uneven water never settles (C-002); a tapped lake stays active for ever |
| [F-04](F-04-bootstrap-scenario.md) | A real year-one bootstrap scenario that asserts | M | F-01, F-05 | The only long integration test cannot succeed and measures nothing |
| [F-05](F-05-dwarf-need-activities.md) | Dwarf need activities: social partners, reachable targets, water search | M | — | Talks happen by coincidence; an unreachable bed or well loops a dwarf |
| [F-06](F-06-recipe-smoke.md) | Every recipe once through the real workshop loop | S | — | Most recipe tests call internals; the loop is proven for a handful |
| [F-07](F-07-recipe-constraints-as-content.md) | Recipe constraints as content, not `if (recipe.id === …)` | M | F-06 | Hard-coded content ids in `operate.ts` violate the content-driven rule |
| [F-08](F-08-m6-m7-spec-arithmetic.md) | M6/M7 spec arithmetic, combat-skill gap, Deep emergence export, embark supply prose | M | — | The acceptance tests M6/M7 inherit contradict their own rules; M6 needs numbers the spec never gives |
| [F-09](F-09-small-fixes.md) | Small fixes: announcement text, partial todo scenarios, dead seam, test tiers, gate checklist, perf fixture | M | F-01 | Visible bugs and test-hygiene items that are cheap now |
| [F-10](F-10-need-rates.md) | Need rates: make consumption match the documented season | M | — | Hunger and thirst overshoot the spec's own season figure by ~3×, so a first fortress starves before its first harvest |
| [F-11](F-11-idle-responsiveness.md) | An idle dwarf notices work before `IDLE_TICKS` elapses | S | F-10 | An idle dwarf ignores new work for up to a game hour, wasting fortress time after every designation |
| [F-12](F-12-comfort-joy-rates.md) | Comfort and joy rates: match the documented visit frequency | S | — | `bored` and `uncomfortable` are near-permanent because the rates outrun the visit frequency `balance.md` documents; added 2026-10-02 from the M8 mood diagnosis |
| [F-13](F-13-raid-loiter-and-door-pets.md) | A locked gate makes a raid loiter and leave; animals never park on doors | M | — | A raid that can see a dwarf it cannot reach never leaves, so a gated fortress starves under a permanent alert; a pet on a door blocks it for good. Added 2026-10-03 from the T-M8-06 defence measurement |
| [F-14](F-14-immigration-spirit-threshold.md) | Immigration spirit threshold 65 → 55 | S | F-12 | A fortress built as the hints describe settles at spirit ~55, so at 65 it never gets immigrants after year one. Added 2026-10-03 |
| [F-15](F-15-bandits-leave.md) | Bandits who reach their stockpile steal and leave; a failed walk means unreachable | S | F-13 | Bandits standing on an outdoor stockpile never leave, holding the fortress on alert until it starves (11 of 13 lingering parties). Parent decision 2026-10-03 |
| [F-16](F-16-retreat-without-shelter.md) | A civilian with no reachable shelter does not freeze | S | F-15 | A civilian shut out by a locked gate froze with targetTile −1 for 15 days, keeping a raid engaged and the alert up until the fortress starved. Parent decision 2026-10-03 |
| [F-17](../tasks/F-17-balance-followups.md) | Balance follow-ups from the economy fortress | L | F-16 | Two real bugs (crafts lose their quality; a job can output from inputs it no longer holds), three spec/code disagreements decided, and the fixture repairs the economy re-measure called for. Parent decisions 2026-10-05 |

Suggested order: F-01 first (it changes the timing of most scenarios and so the golden hashes), then **F-10** (it changes need timing, so F-02's and F-04's bounds must be measured after it), then **F-11**, then F-02, F-03 and F-05 in any order, then F-04, then F-06 and F-07, with F-08 and F-09 at any point before T-M6-01. **Every task in this folder must be done before T-M6-01 starts.**

## The open owner question — answered

The one question reserved for the owner was whether the embark's food and drink should last longer before M6 makes starvation and dehydration lethal. **Answered 2026-09-25:** change the need rates rather than the presets, anchoring them to the season `embark-catalog.md` already documents (about 100 food and 150 drink for seven dwarves). Hunger becomes 1/h and thirst 1.6/h; the presets and `EMBARK_BUDGET_BASE` are untouched. This is [F-10](F-10-need-rates.md). See [F-08 § Owner question](F-08-m6-m7-spec-arithmetic.md#owner-question-not-for-the-agent) for the reasoning and the rejected alternative.

## Progress block

This block is already in [`../build-plan/PROGRESS.md`](../build-plan/PROGRESS.md), between the M5 and M6 sections, and `T-M6-01` in `M6-steel-and-blood.md` already lists F-01 … F-09 under *Needs*. It is reproduced here for reference:

```markdown
## M5.5 — Audit fixes ([fixes/README.md](fixes/README.md))

- [ ] F-01 — Job assignment livelock
- [ ] F-02 — Mood: need pressure and the needs-met floor
- [ ] F-03 — Fluids: equalize budget and settling
- [ ] F-04 — Year-one bootstrap scenario
- [ ] F-05 — Dwarf need activities
- [ ] F-06 — Recipe smoke through the real loop
- [ ] F-07 — Recipe constraints as content
- [ ] F-08 — M6/M7 spec arithmetic and gaps
- [ ] F-09 — Small fixes
- [ ] F-10 — Need rates: consumption matches the documented season
- [ ] F-11 — Idle dwarves notice work without waiting out IDLE_TICKS
```

Commit messages follow the plan's convention: `F-01: job assignment livelock`.

## Golden files

F-01, F-02, F-03 and F-05 change simulation behaviour on purpose, so `test/golden/world-hashes.json` (and possibly render goldens) will change. Regenerate them with `npm run golden:update` **in the same commit as the behaviour change**. The commit body must say which golden files changed and why ("world hashes: F-01 changes which jobs are claimed"). A golden change in a task whose document does not predict it is a regression: investigate it before committing.

## Decision log

Each task lists the `DECISIONS.md` rows it adds. Use the next free `D-` number at the time of the commit (the log ends at D-152). A task that resolves a contradiction (`C-`) marks it resolved with one line under the contradiction's row: `Resolved by F-0n (<date>): <one sentence>.`, and removes the matching `it.todo`.
