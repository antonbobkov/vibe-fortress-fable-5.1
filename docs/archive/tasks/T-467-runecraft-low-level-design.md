# T-467 — Runecraft: the low-level design

**Closed:** 2026-11-01, in 630a95e8.

**Source:** runecraft [design](../../../reports/designs/2026-11-01-runecraft-magic-system.md) · **Size:** L · **Needs:** — · **Status:** open

## Why

The owner accepted the design and asked for it to be built. They said its numbers and mechanic details are guidance, not strict rules. The specification must say how the game behaves before code does (`docs/process/`), and the design was written without checking every seam against the code.

## What to do

Docs only. No `src` changes.

1. **Read the design, then the code it touches.** Check each claim it makes about what exists: lamp coverage per tile, `lightOk`, the launcher and ranged code, `armorReduction`, the wound types `burn` and `frost`, re-equip claims, `strip_corpse`, butcher yields, room tiers, chest wants, Deep pressure, party roles, the crowding rule added by T-457.
2. **Write `docs/02-systems/25-runecraft.md`** in the shape of its neighbours (state, interfaces, behaviour, constants). Add it to the systems README and the tick order. Where the design does not fit the code, change the design and say so in a short "differs from the design" list at the end, with the reason.
3. **Add the rows** to `docs/03-content/` and the schemas in `docs/04-implementation/` that the tables need, marked for the task that brings each in, in whatever way the content pipeline allows. If `content:check` requires rows to exist in code as soon as they are in the docs, keep the tables in the system spec and move them into `03-content` task by task; record which you chose.
4. **Change `docs/00-vision/scope.md`:** magic comes in as runecraft; necromancy, vampires and werebeasts stay out. Record the decision in `docs/decisions.md` in its own format, with the design's three limits.
5. **Refine the work files T-468 to T-477.** Correct their scope, order, seams and done lists against what you found. Split one if it is too large for one agent. Name new files `T-NEW-<slug>.md` so the orchestrator can number them. Do not edit `docs/backlog.md`.

## Decisions already made

- **Keep:** the player never casts; no necromancy; magic trails steel; the stone is the spell; the dwarf is the only vessel of rune; one draught then rest; one enchantment per item; friendly fire is real; a fortress that never touches runecraft plays as today.
- **Free to change:** any number, and any mechanic detail that costs much more than it gives. Prefer the plainest rule that fits the existing systems. If a table row needs a whole new mechanism for one effect, cut or replace that row and list it.
- **Everything is `unmeasured`** until a task measures it. The balance doc marks it so.
- **New rng stream `magic`.** Combat with no runecraft in play must draw the same numbers as today, so the existing instruments do not move for code reasons. Wild glowcap patches in worldgen may move them. If they would, say how to keep that change small and easy to measure.
- **Save format:** pick one approach for all the tasks (one bump per task that adds state is fine if the repo's migrations allow it) and write it in the spec.
- **Originality:** the content is ours. Do not borrow names or tables from other games.

## Done

- `25-runecraft.md` lets an agent build any one of T-468 to T-477 without reading the design.
- `docs:check` and `content:check` pass. No heavy runs are needed for this task.
- The final report lists every change from the design and the reason in one line each.
