# T-488 — three-years-p2-7 ends without its dining hall

**Closed:** 2026-11-07, in 51a5d15d.

**Source:** [hexers measured](../../../reports/audits/2026-11-04-t479-hexers.md) § The answer · **Size:** S · **Needs:** — · **Status:** open

The twenty-seed file on master `37da07a4` (with T-479, which draws nothing new at peril 2) fails `three-years-p2-7` on its T-156 witness: `fortressWitnesses` returns `['a dining hall']` at the end of year 3. The seed also has 2 dwarf deaths of starvation, a cause the reference sweep (`reports/data/2026-11-02-batch-t461-t465-sweep.json`, `3ea1517e`) did not show for it. Its figures are in `reports/data/2026-11-04-t479-sweep.json`. Master moved between the two runs (T-466 to T-476, T-481, T-484).

## Decisions

- Find which change since `3ea1517e` stops the script's dining hall in this seed (the cold-cave rule of T-484 and the shrub conversion of T-468 are the first suspects), and whether the starvation deaths follow from it.
- Fix the script if the fixture asks for something the game now forbids; fix the game if a rule is wrong.

## Done

- `three-years-p2-7` passes its witnesses, and the cause is named in the commit.

## Also seen (2026-11-07)

Seed `p2-4` at shift 50 fails the same kind of witness (no hearth or dining hall, one dwarf left at year 3), in T-513's reference sweep and since; the same seed goes extinct at shift 100. Treat it with this task.

## Found (2026-11-07)

Replays in [2026-11-07-t488-halls.txt](../../../reports/data/2026-11-07-t488-halls.txt).

- `p2-7` on `37da07a4`: its halls stood from day 31; in a miserable year 3 the sulks (15 § Sulks, which break the nearest poor chair or table) broke the dining hall's table and all four chairs between days 306 and 336, and the script never placed them again. The script was at fault: it now places a hall's hearth, table or chair again where it stood. The two starvation deaths came on days 329 and 330, after the breaks began, and do not follow from them. On master the seed passes at all four shifts.
- `p2-4` at shift 50: raids cut the fortress from 11 dwarves to 5 by day 84 and to 2 by day 164, while its halls were still being dug; the last dwarf with the mining labor died on day 164, and 400 dig jobs stood for the rest of the run with nobody to take them. The script was at fault there too (it now gives the labor to a survivor), and so was the witness: a fortress of one or two dwarves is not asked to finish or keep its rooms. The halls and bedrooms witness now holds a fortress that ends with at least the embark party's seven dwarves. With the fix the seed's last two dwarves bleed out on days 303 and 306.
- The game was not at fault in either seed.
