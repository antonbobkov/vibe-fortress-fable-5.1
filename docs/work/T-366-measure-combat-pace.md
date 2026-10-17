# T-366 — Measure the combat pace

**Source:** T-333, [`../../reports/audits/2026-10-17-unmeasured-spec-numbers.md`](../../reports/audits/2026-10-17-unmeasured-spec-numbers.md) (rank 3) · **Size:** M · **Needs:** — · **Status:** open

## Why

The terms of 16's hit, parry, block and damage formulas, `BLUNT_THROUGH_PERCENT`, `FRACTURE_PERCENT`, `MIN_ATTACK_COOLDOWN`, `CREATURE_BASE_SKILL` and `HOSTILE_SKILL_PER_TIER` decide every fight, and all are marked *unmeasured*. `balance.md` § Combat pace states what they should give: one dwarf in iron mail with an axe and shield kills two unarmoured goblins in about ten swings with 2–3 light cuts; a squad of three with mail handles a raid of ten at peril 2 with a few wounds and a hospital visit; three trollkin hits floor a dwarf. No fight between armed sides has been measured: every peril 2 and 4 run of the economy sweep stopped on a game fault before its raids, and the sweep has not been run again since T-302 to T-304 fixed them ([the sweep](../../reports/audits/2026-10-12-economy-fixture-at-default-priority.md#the-sweep)).

## What to do

1. In stepped arenas, run each duel of § Combat pace many times (at least 50 seeds each): the dwarf against two goblins; the dwarf against a trollkin; a steel warhammer against a trollkin limb. Record swings, hits, blocks, wounds by severity, blood lost and the winner.
2. Run a squad of three Novice soldiers in iron mail with axes and shields against a peril-2 raid party of ten (the content party for that size, with its gear tier and `HOSTILE_SKILL_PER_TIER`), on open ground and behind a gate, at least 20 seeds; record deaths on each side, wounds and the time to the end.
3. Compare with § Combat pace. Write the report, add a `balance-status.md` row, and replace the marks with the report where the measurement covers them.

## What would change the number

If the squad of three loses dwarves in most runs, or wins untouched, the combat numbers or the raid party sizes (T-368) are off from the intended pace; which one moves depends on whether the duels already miss their figures. The tune is its own task.

## Done

- The report exists; § Combat pace and the combat constants carry the measurement instead of the mark where it covers them; `balance-status.md` has a combat-pace row.
