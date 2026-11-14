# T-546 — Making Do: the low-level design, written into the spec

**Source:** [Making Do](../../reports/designs/2026-11-06-making-do-content-and-scarcity.md); the owner, 2026-11-13 · **Size:** L · **Needs:** — · **Status:** open

The owner (2026-11-13): "let's implement reports\designs\2026-11-06-making-do-content-and-scarcity.md ! As before, schedule tasks including more a detailed low-level design".

The design is reviewed and has no open questions (its § 14). Treat its numbers and mechanic details as guidance, not a strict rule, as for runecraft (T-467's pattern). This task does no code.

## What to do

1. **Read it against the spec.** For every section of the design, find the systems it touches (03 terrain and generation, 05 fire and temperature, 07 plants, 08 animals, 09 production, 10 needs and sleep, 11 jobs, 13 items and stockpiles, 14 buildings and light, 16 combat layers, 17 health, 20 trade, 24 UI, 25 runecraft for fletching's enchant column) and the content tables. List every place the design's wording does not fit what the spec already says, and decide each one.
2. **Write the low-level design into the spec.** New sections or rules in the system docs and rows in `docs/03-content` (not yet exported; a row-order line only when its task lands). Each rule names its stream, its events, its constants (marked *unmeasured*), its save fields and its UI. Where a mechanism needs a design choice the design leaves open (the cellar's darkness test, how a skylight column is computed and cached, how a rack ``wants`` items, how `tipsy` is applied, how a dressed bed is made up), choose the plainest that fits the existing code, and say why.
3. **Check the task breakdown.** T-547 to T-561 are filed from the design's § 13 bundles. Re-cut them if the spec shows a better split (dependencies, shared mechanisms, sizes), by editing their work files: their **What to do**, **Needs** and **Size**. Add new rows only as `docs/work/T-NEW-<slug>.md`. Each implementation task should be one agent's day at most.
4. **Fun features.** List the design's goofy rules in `docs/fun-features.md` § Planned, each with its task.

## Done

- The spec carries every rule of the design that is to be built, marked by the task that builds it, and the content docs carry the planned rows.
- The implementation tasks are ready to dispatch: each names the spec sections it builds, its dependencies and its measurement.
- The six static checks pass. Commit with `Closes: T-546`.
