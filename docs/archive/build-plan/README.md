# Implementation Plan

**Detail level:** plan · **Owner:** implementation · **Depends on:** the whole specification, especially [`../../04-implementation/build-milestones.md`](../../04-implementation/build-milestones.md), [`../../04-implementation/acceptance-tests.md`](../../04-implementation/acceptance-tests.md), [`../../04-implementation/tooling.md`](../../04-implementation/tooling.md)

This folder turns the specification into a sequence of tasks that coding agents can execute without human intervention. Every task names the documents it implements, the files it produces, the tests it must add, and a mechanical definition of done. Nothing here introduces a design decision; where a task needs one, it points at the paragraph of the specification that already made it.

## Files

| File | Contents |
|---|---|
| [`../../process/agent-workflow.md`](../../process/agent-workflow.md) | How an agent picks up a task, works, verifies, commits; the ambiguity protocol; the decision log |
| [`../../process/testing-strategy.md`](../../process/testing-strategy.md) | Test tiers, the scenario runner, golden files, property tests, e2e smoke tests, coverage gates, how to run everything |
| [`M0-skeleton.md`](M0-skeleton.md) … [`M8-polish.md`](M8-polish.md) | Tasks per milestone |
| [`PROGRESS.md`](PROGRESS.md) | The checklist of every task; agents tick tasks as they complete them |
| [`../../05-plan/DECISIONS.md`](../../05-plan/DECISIONS.md) | The log of resolved ambiguities (empty at the start) |

## Milestone overview

| Milestone | Theme | Tasks | Gate (must pass to proceed) |
|---|---|---|---|
| [M0](M0-skeleton.md) | Skeleton: repo, core, content loader, atlas, headless runner | 14 | `core_*` scenarios, content check, lint, a rendered flat map screenshot in e2e |
| [M1](M1-ground.md) | Ground: world gen, local map, pathfinding, dwarves that walk, digging | 16 | `wg_*`, `tr_dig_room`, `tr_channel_ramp`, `tr_stairwell`, `tr_discovery`, `pf_*` |
| [M2](M2-things.md) | Things: items, stockpiles, hauling, constructions, furniture, zones, rooms, save/load | 14 | `jb_*`, `it_*` (except rot and miasma), `bd_room_tiers`, `bd_support`, `bd_door_lock`, `core_save_roundtrip` |
| [M3](M3-water-fire-sky.md) | Water, fire, sky: fluids, temperature, weather | 10 | `fl_*`, `ma_*`, `we_*` |
| [M4](M4-life.md) | Life: plants, animals, foraging, needs, first workshops, morale, hearth, embark screen | 20 | `pl_*`, `an_*`, `fo_*`, `dw_*` (except the combat-dependent ones listed in the file), `ws_bed`, `ws_maintain`, `mo_*`, `bd_hearth` |
| [M5](M5-metal.md) | Metal: every workshop and recipe, quality, professions | 9 | `ws_*`, `it_value`, `it_wealth` |
| [M6](M6-steel-and-blood.md) | Steel and blood: combat, health, threats, defense | 18 | `cb_*`, `he_*`, `th_*`, `df_*`, `bd_bridge`, `bd_floodgate`, `bd_burial`, plus the M4 deferrals (`an_predator`, `an_tame`, `fo_hunt`, `fo_no_ammo`, `fl_drown`, `dw_starve`) |
| [M7](M7-outside-world.md) | The outside world: trade, immigration, legend, settings, hints | 12 | `td_*`, `im_*`, `ui_*` |
| [M8](M8-polish.md) | Polish: performance, snapshots, palette, debug, golden renders, balance | 10 | every scenario, `perf_*`, e2e suite |

Total: 123 tasks. Task ids are `T-M<milestone>-<nn>`. Tasks within a milestone are ordered; a task may start when every task it lists under *Needs* is done.

## Ground rules that apply to every task

1. **The specification is the authority.** A task never restates a rule; it cites where the rule is. If code and spec disagree, the code is wrong.
2. **No creative decisions.** If a task cannot be completed without deciding something the spec does not decide, follow the ambiguity protocol in `00-agent-workflow.md`: pick the most conservative reading, record it in `DECISIONS.md`, and continue.
3. **Tests first or tests with.** Every task adds or extends tests in the same commit as the code. A task without a test change is not done.
4. **Determinism always.** From M0 on, `core_determinism` runs in the pre-commit check; any task that breaks it is reverted before anything else.
5. **One task, one commit** on `master`, message `T-M1-03: <task title>`; push after every milestone gate passes (and at least once per day of agent work).
6. **Never skip the gate.** A milestone's gate scenarios must pass before the next milestone's first task begins.
