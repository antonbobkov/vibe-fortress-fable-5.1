# T-640 — Animals, Jobs, Stocks and trade requests with many rows

**Source:** [T-635's mid-game audit](../../reports/audits/2026-11-19-t635-midgame-ux.md), findings 16–19 · **Size:** M · **Needs:** — · **Status:** open

## Why

- **Animals.** With 94 tame animals the Tame tab is one row per animal in the order they were made (cow, sheep, chicken, cow, sheep, …), where the wireframe groups unnamed ones ("chicken ×4"). The "Cond/Tr" column shows bare numbers (0, 19, 64) with no meaning given, and "Pastu" is cut.
- **Jobs.** In the 80-dwarf fortress the summary reads "15 open · 10 claimed · 922 block»" (cut) and sixteen "plant (72,89,z27 -" rows of one plot are not batched because they are open rather than blocked. In the 21-dwarf fortress there were 318 open jobs, and the kiln, loom and clothier's shop placed in spring were still "Build kiln  -" in late summer with nothing saying how long they have waited or why nobody takes them.
- **Stocks.** Counts have no thousands separator beside values that do ("8570  43,928 ☼"); the wealth line is cut ("(buildings 1,»"); the panel took 300 ms to open with 25,000 items, where every other panel took 130–160 ms.
- **Trade requests.** Mountainhome's list reads "seed ☼☼☼ / seed ☼☼ / seed ☼☼ / mail shirt ☼☼ / bar ☼": three rows that look the same and a "bar" of no metal. The request is by item type, so the player cannot ask for "plump helmet seeds" or "iron bars". The priority, `★` in the code and the wireframe, draws as `☼`, the money sign: "seed ☼☼☼" reads as a price.

## What to do

1. Animals groups unnamed animals of one species, pasture and condition ("cow ×6  #1"), sorts by species, and names the columns (`Cond` as a bar or a word, `Tr` as `war`/`hunting`/blank as the spec says).
2. Jobs batches open jobs of one type and priority on adjacent bare tiles as it batches blocked ones ("Plant ×16"); the summary wraps instead of cutting; a job open for more than a day shows its age ("Build kiln  open 41 days") and the line under the list says why nobody has taken it (no one with the labor, every worker busy at a higher priority, …).
3. Stocks writes counts with the separator and wraps the wealth line.
4. A request names its material or species when the item has one ("seed: plump helmet", "bar: iron"), from 20's request rows; two requests of one item and material merge; the priority is drawn with a glyph the font has and that is not the money sign (`!`, `!!`, `!!!`, or `high`/`medium`/`low`).

Spec: `ui-screens/panels.md` § Animals, § Jobs, § Stocks, § Civilizations; 20 § Requests.

## Done

Tests per panel on fixtures of the sizes above; the Stocks open time on the furniture fixture noted.

- [x] **Animals**, `test/unit/ui/t640-long-lists.test.ts` on 94 tame animals made cow, sheep, chicken, goat in turn: eight rows by species ("chicken ×23", "cow ×8 #1 ▓▓▓", "cow ×2 — ░░░", "dog Bramble"); columns `Animal`, `Pasture`, `Fed` (a three-cell hunger bar, `—` for an animal that does not graze), `Trained`; the selected row in words under the list ("8 cows · pasture #1 · fed"); `[S-p]` on a group moves all of it, a slaughter mark takes one animal to a row of its own. The Wild tab names its columns `Species`, `Hunt`, `Doing`.
- [x] **Jobs**, the same file: sixteen open plantings of one plot are "Plant ×16" (open jobs batch as blocked ones do, by list adjacency, type, priority and state); 16 open, 10 claimed and 1,000 blocked wrap to two rows with no `»`; a batch open 41 days reads "open 41 days" and the line under the list says why nobody takes it. The reason is `jobWait` / `jobWaitText` in `src/ui/job-wait.ts` (for T-641: `jobWaitText(env, job)` gives an open job's wait or a blocked job's block text, null for a held job), tested for no labor, busy, on duty, out of reach, free but not taken, a job for one dwarf, and more urgent jobs ahead.
- [x] **Stocks**: counts with separators ("8,550") and the wealth line on two rows when it does not fit, tested. Open time on the furniture fixture (25,000 items), `test/perf/t640_stocks_open.test.ts`, three passes on the owner's machine: master drew the panel in 90–140 ms the first time and 60–75 ms on every later frame in the same tick; the branch draws it in 47–82 ms the first time and 1–2 ms after (the tree, with a row for each of the 25,000 stacks, is now built once a tick and filter rather than five times a frame).
- [x] **Trade requests**: a request names its material ("seed: dimcap", "bar: iron", "wool cloth"), two of one item and material are one row at the higher priority, the priority is `high` / `medium` / `low`, and the editor's `←` `→` choose a material the civilization brings ("Add: bar: iron"), tested.
- [x] Spec: `panels.md` § Jobs, § Stocks, § Animals, § Civilizations; 20 § Requests; 11 and 08 § Player-facing behavior; `ui-keymap-and-screens.md` § Civilizations panel.
