# T-284 — A workshop with no recipes is not listed, by rule and not by id

**Closed:** 2026-10-16, in 9a294b9.

**Source:** T-116 and its report, [`../../reports/audits/2026-10-12-ui-ux.md`](../../../reports/audits/2026-10-12-ui-ux.md) (§ 8 a); the question came from T-194 · **Size:** S · **Needs:** T-271 (same file, `src/ui/panels/build.ts`) · **Status:** open

## Why

The audit's answer to T-194's question is that hiding the magma kiln is right: a workshop with no recipes would cost the player magma-safe blocks for nothing. The build menu does hide it, but by naming the content id in code (`row.id !== 'magma_kiln' || recipesFor(row.id).length > 0`), against the rule that content ids appear in code only in tests. The next workshop reserved for a later version would be offered to the player. Nothing tests what happens to a kiln that an older save already contains.

## Reproduction

Read `src/ui/panels/build.ts:39-43` (`listed`). In play: Build › Workshops lists "Magma forge" and "Magma smelter" and no kiln (capture flow 8, steps `B-workshops-*`).

## What the spec says

- [`workshops-and-recipes.md`](../../03-content/workshops-and-recipes.md): the `magma_kiln` row, "reserved for glass in a later version; it has no recipes and is hidden from the build menu".
- [`12-workshops-and-professions.md`](../../02-systems/12-workshops-and-professions.md): "`magma_kiln` (unused in version 1 but listed for glass later)".

## What to do

**Decisions.**
- **The rule.** The build menu lists a building of category `workshop` only if at least one recipe names it. The check reads 12's reader and names no id. The wagon keeps its own rule (placed at embark only), expressed by its content row and not by its id if the row already has a field for it; if it has none, the wagon check stays as it is and this task does not touch it.
- **Placement.** `PlaceBuilding` for a workshop with no recipes is refused with `precondition_failed` and the line "Nothing can be made there yet." The UI cannot send it; the refusal protects a replay or a script.
- **An existing kiln.** A save that holds a built kiln loads, shows it, and its panel reads "Magma kiln · no recipes in this version" with only "take apart". A test builds one through the test harness and loads it.
- **Spec wording.** `workshops-and-recipes.md` states the rule for every workshop ("a workshop with no recipes is not offered in the build menu") and keeps the kiln's row as the one example.

1. Amend `workshops-and-recipes.md`, 12 § Player-facing behavior, and [`command-catalog.md`](../../04-implementation/command-catalog.md) for the refusal.
2. Implement in `src/ui/panels/build.ts`, `src/systems/workshops/` or the building system that validates `PlaceBuilding`, `src/ui/panels/building.ts` (the panel line), and the strings.
3. Tests, `describe('T-284 …')`: the menu lists exactly the workshops with a recipe (walk the content table); the command refusal; the panel of an existing kiln.

## Done

- No content id is named in `src/ui/panels/build.ts` for this rule, and the three tests pass.
- The verification commands of [`../process/agent-workflow.md`](../../process/agent-workflow.md) are green.

## Decisions made in the work

- The rule is "category `workshop`, and no recipe names it and no job is worked at it" (`workshopHasWork` in `src/core/workshop-use.ts`). The work file's "at least one recipe" would have hidden the butcher's shop and the kennel, which have jobs and no recipes, so the jobs table now exports the workshop type of a job (`workshop (butcher)` in `jobs.md`) and the rule reads it; the wagon keeps its id check, since its content row only has the free-text `on` column.
- `PlaceBuilding` is refused in 14 (`precondition_failed`, the line "Nothing can be made there yet." through the UI's rejection text). Tests that need the reserved kiln use `TestWorld.buildUnchecked`, which places through the store; the descent scenario does the same.
- The kiln's panel is three lines (the building name with its ordinal, "No recipes in this version.", and `[x] take apart`) because the one-line form of the work file does not fit the 36-column sidebar.
