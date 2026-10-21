# Measurement: the combat-pace tune (T-404)

**Task:** T-404 · **Date:** 2026-10-21 · **Commit examined:** `bd80aaa` (`sim` at `23cc1dd`, docs only since) before and with `CLOT_TICKS` 150 · **Kind:** tune with before and after rows · **Source:** [the combat-pace measurement](2026-10-21-combat-pace.md)

## The answer

- **The first lever of the work file meets its target, so the tune stops there: `CLOT_TICKS` 300 → 150.** A Novice dwarf in an iron helm, mail shirt and greaves with an iron axe and shield, against two unarmoured copper-sword goblins at skill 2, now wins **55 of 60** duels (target at least 48, and conscious at the end in at least 40; a dwarf that wins is standing). Before: 32 of 60. It still takes about eight light cuts over a fight of about 400 ticks, but each bleeds half as long: the blood lost at the end falls from a median 328 to 210, under the 360 that takes a dwarf down. Two of the 60 die a day later with no medic, against 29.
- **A squad of three in full kit drives off an ambush of four at peril 2 in all 24 trials,** before and after (the second half of decision 1 was already met); the soldiers dead a day later with no medic fall from 1.25 to 0.92 a trial.
- **What the lever does not change, as the work file expects:** a dwarf in a mail shirt alone is still down in 47 of 60 duels (serious cuts on the bare head and legs bleed until bandaged); the trollkin still floors a dwarf in a median 3 hits; a squad of three still loses to a raid of ten in the open (21 and 23 of 24 down). `balance.md` § Combat pace now says a soldier's kit is helm, mail shirt and greaves, and a raid of ten is met at a gate.
- **The annual wildlife instrument holds its guards.** Before (`bd80aaa`): median 13, worst 6, second-worst 9, sum of the living 144, 8 of 12 years without a wildlife dwarf death, no extinction, no hunger or thirst death. After: median **13**, worst **2**, second-worst **8**, sum **140**, **8** of 12, **0**, **0**; only the sum worsened (against the latest accepted 143), every bound holds. `taiga-3` falls from 9 to 2 (eleven wolf deaths) and `taiga-2` rises from 6 to 8: single seeds that move with the timeline, named unstable. The latest accepted row in `test/perf/wildlife_year_constants.ts` and `balance.md` is the after row.

## What was run

At `bd80aaa` with only `CLOT_TICKS` changed, one heavy run at a time:

| Arena (`reports/data/2026-10-21-combat-pace-tune.probe.ts.txt`) | Trials | Before (`CLOT_TICKS` 300) | After (150) |
|---|---:|---|---|
| Full kit vs two goblins (`duel2full`) | 60 | won 32, down 28; blood lost 328; dead a day later 29 | won **55**, down 5; blood lost 210; dead a day later 2 |
| Mail shirt only (`duel2`) | 60 | won 12, down 47, dead 1 | won 13, down 46, dead 1 |
| Trollkin (`troll`) | 60 | won 10; floored after 3 hits | won 10; floored after 3 hits |
| Squad of three, full kit, vs ambush of four (`ambush-full`) | 24 | repelled 24; 1.25 soldiers dead a day later | repelled **24**; 0.92 |
| Squad of three, mail only, vs ambush of four (`ambush`) | 24 | repelled 24; 1.67 | repelled 24; 1.63 |
| Squad of three vs raid of ten in the open (`open`, `open-full`) | 24 each | down 21 and 22 | down 21 and 23 |

The `duel2`, `troll` and `open` before rows are those of [the measurement](2026-10-21-combat-pace.md) at `a5cd51c` (the arenas do not touch what changed between `a5cd51c` and `bd80aaa`); `duel2full` and the ambush rows were re-run at `bd80aaa`. The after data with every trial is `…-combat-pace-tune-arenas.json`.

Annual instrument (`test/perf/wildlife_year.test.ts`), living per seed, forest 1–4, taiga 1–4, grassland 1–4: before `12, 13, 13, 9, 13, 6, 9, 11, 15, 14, 15, 14` (`…-bd80aaa-wildlife.json`); after `12, 13, 13, 10, 13, 8, 2, 11, 15, 14, 15, 14` (`…-t404-wildlife.json`).
