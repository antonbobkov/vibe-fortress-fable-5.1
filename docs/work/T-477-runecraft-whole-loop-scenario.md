# T-477 — Runecraft 10: the whole loop played, and the docs that tell it

**Source:** runecraft [design](../../reports/designs/2026-11-01-runecraft-magic-system.md) · **Size:** M · **Needs:** T-492 · **Status:** open

The specification is [25 Runecraft](../02-systems/25-runecraft.md). It governs, and this task needs only its sections named below. Everything marked for this task lands here and nothing else. Move this task's rows from 25 to the tables and schemas it names, and into its § Interfaces. Every number stays *unmeasured* unless this task measures it.

## What to do

- A scripted fortress that plays the loop: lamp, glowcap, vials, sanctum, runeforge, a staff in a squad, a stone in an axe, a draught at a raid. It runs in the scenario suite at its usual weight.
- Screen check by e2e: sanctum panel, staff look line, squad draught list, a warded creature's glyph.
- The hints of 25 § Player-facing behavior. A tutorial mention if one fits. `reports/summaries/` gains a runecraft summary, and the combat, materials and production summaries are updated. Glossary terms in `00-vision/glossary.md`.
- `balance-status.md` gets the measured rows. Anything still unmeasured is marked so.
- **Turn 25 into plain specification.** Remove the task marks, § How to read this document, § Planned interfaces and § Differs from the design. Delete row D-250 from `decisions.md`.

## Done

- The scripted fortress throws a spell from a staff it made itself, and a soldier drinks a draught, on the set seeds.
- 25 holds no task id, and every row it names is in a table or schema.
- A new report notes that the spec now governs. The design file itself is not edited, since reports are frozen.

## Balance item from T-473 (orchestrator, 2026-11-02)

The ward is strong in the arena: a warded soldier took 0.57 damage a hit against 4.8 unwarded; in the ambush of four, soldiers dead a day later fell from 0.63 to 0.04, and the peril-2 raid of ten was driven off 24 of 24 against 14 of 24 ([report](../../reports/audits/2026-11-02-t473-ward-arena.md), on master once T-473 merges). The design wanted the ward to be the spell that changes outcomes most, but "magic trails steel". Measure it here against a squad with one more marksdwarf or one more axedwarf instead of the caster, and lower `WARD_ARMOR` or `WARD_TICKS` if one caster is worth more than two soldiers. Daze re-stunning a captain every 180 ticks for 3 rune is measured in the same pass.
