# Measurement: brook drinking under wild animals

**Task:** T-360 · **Date:** 2026-10-18 · **Commit examined:** codex-a `2771fe0` (master `cbeb7cd` plus the T-394 change, which moves no world hash) · **Kind:** measurement; no source rule, constant or content value was changed (the annual instrument's fixture gained two optional variants that its default path does not use) · **Source:** T-350 and its review

## The answer

- **No instrument seed has surface water.** The twelve generated maps of the annual instrument carry water only in cavern lakes (levels 4 to 19), none within 64 tiles and 8 levels of the wagon at level 32. A fortress there that runs out of drink dies of thirst: with no drink and no still, all twelve fortresses were extinct on day 19 (84 dwarf deaths, 82 of them thirst and hunger, two a boar's; `dry-nobrook` below). This is why the instrument never saw a `DrankWater` event.
- **A brook beside the wagon is cheap.** On the nine seeds whose opening survives a brook entering at the west edge (the wagon stands there, the bank is 1 to 6 tiles away), a fortress with no drink lived 79 dwarf-years against 93 for the same maps with the usual brew: within the noise the instrument's own wolf deaths make (a change that only moves the timeline moves a seed by five or more). Three fortresses were extinct without drink and one with it; two of the three are the fire that kills seven dwarves on days 39 to 41 in both variants (see below).
- **A brook 40 tiles away is not.** With a brook crossing the map from north to south, 38 to 49 tiles from the wagon, the same twelve fortresses with no drink lived **98 dwarf-years against 156** with the usual brew: **four extinctions against none, 61 dwarf deaths against 3**. 34 of the 61 are `starvation` (hunger or thirst; the death record does not say which), 33 of them 11 or more tiles from the wagon; 27 are wild animals (wolf 20, bear 6, badger 1), 26 of them 11 or more tiles from the wagon, on the walk. The usual brew fortress drank water 3,865 times in the year (43% of its drinks), always from the same bank, and lost three dwarves; walking is not what kills, walking for every drink is.
- **The instrument fortress itself drinks mostly water once a brook exists.** With the usual opening and a brook, 66% (west) and 43% (north) of the drinks were water, from about day 15, when the embark's drink runs out: its drink stockpile wants no barrels, so the brew stays loose ([10 § Needs, drink search](../../docs/02-systems/10-dwarves.md)). A player who builds a stockpile without barrels on a brook map is in this case.
- **Under a hearth alert a distant bank may be reached too late.** In 5 of the 12 dry-north seeds the harness's hearth alert sheltered the dwarves (300 to 68,580 ticks) and thirst reached 100 in all five; 21 of the 34 `starvation` deaths are in those seeds, the other 13 in one seed (`wildlife-taiga-3`) that never sheltered and whose first such death is on day 101. The rule lets a sheltering civilian go at the critical threshold (85); a walk of 43 tiles starts late. A work file follows.
- **No constant should change on this evidence.** `balance.md` § Drink chain now states what water costs; two work files follow (below).

## What was run

Twelve seeds of the annual instrument ([the opening, alert policy and wild species it uses](../../docs/process/testing-strategy.md#annual-wildlife-survival)), one year each, peril 0, Balanced embark, all natural wild species, five variants of the opening (`reports/data/2026-10-18-brook-drinking.probe.ts.txt`, the fixture options `dry` and `brook` of `test/perf/wildlife_year_fixture.ts`):

| Variant | Opening | Seeds run |
|---|---|---|
| `dry-nobrook` | the embark's drink destroyed at tick 0, no still, no brew order; the generated map as the instrument has it (no river) | 12 |
| `dry-west` | the same, with a brook entering at the west edge and leaving at the south edge | 9 |
| `control-west` | the usual opening, with that brook | 9 |
| `dry-north` | the same dry opening, a brook entering at the north edge and leaving at the south edge | 12 |
| `control-north` | the usual opening, with that brook | 12 |

Three seeds (`wildlife-temperate_forest-2`, `wildlife-taiga-4`, `wildlife-temperate_grassland-4`) cannot be played with the west brook: the instrument's own opening commands (a dig, a farm plot) are rejected where the brook runs. They are left out of both west variants, and the fixture was not repaired. A brook with the wagon between the two (20 to 30 tiles away) was not run: the generator places the brook by edge, so the bank is within 6 or beyond 34 tiles of the wagon on these maps.

The per-seed rows (deaths with cause, killer, tile, distance from the wagon and from the nearest bank, drinks and where they were taken, hearth alerts) are in [`../data/2026-10-18-brook-drinking.json`](../data/2026-10-18-brook-drinking.json). Distances are Chebyshev tiles on the dwarf's level.

## Results

| Variant | Seeds | Living at year end: median / sum | Extinct | Dwarf deaths | By cause | Water drinks (share) | Bank from the wagon, tiles |
|---|---:|---|---:|---:|---|---|---|
| annual instrument, no river (2026-10-18, same commit) | 12 | 13 / 143 | 0 | 16 | wolf and other wild animals 16 | 0 | none in reach |
| `dry-nobrook` | 12 | 0 / 0 | 12 | 84 | thirst and hunger 82, boar 2 | 0 | none in reach |
| `dry-west` | 9 | 13 / 79 | 3 | 37 | wolf 14, fire 13, hunger or thirst 4, blood loss 4, infection 2 | 5,062 (100%) | median 2, 90% within 6 |
| `control-west` | 9 | 12 / 93 | 1 | 28 | wolf 11, fire 11, blood loss 5, badger 1 | 4,050 (66%) | median 2, 90% within 6 |
| `dry-north` | 12 | 13 / 98 | 4 | 61 | hunger or thirst 34, wolf 20, bear 6, badger 1 | 6,153 (100%) | median 43, 90% within 46, up to 49 |
| `control-north` | 12 | 13 / 156 | 0 | 3 | boar 1, badger 1, blood loss 1 | 3,865 (43%) | median 43, 90% within 46, up to 49 |

Deaths by distance from the wagon in `dry-north`: hunger or thirst 1 within 10 tiles, 15 at 11 to 25, 18 beyond 25; wild animals 1, 17 and 9. In `control-north` the three deaths are at 11 to 25 tiles (2) and beyond (1).

The first drink at the brook was on day 2 to 4 in every `dry` run with a brook, so the walk is daily from the start. In `dry-nobrook` the deaths by hunger or thirst are all on day 19 (the boar killed two dwarves of one seed on day 14).

## The deaths that are not about water

- **A fire kills a taiga fortress on a brook map.** On `wildlife-taiga-3` (both west variants, days 39 to 41) seven dwarves and two animals burn; `wildlife-taiga-2` loses four to six more. The twelve instrument rows without a river have no death by fire at all, nor has `control-north`. The same days and the same seeds in `dry-west` and `control-west` show it is the map with the brook at the wagon, not the water policy. It is filed as its own task.
- **Sheltering and thirst.** The hearth alert's `near()` hold is the harness's, but the rule that a civilian leaves for a critical need is the game's (10 § Behavior selection, step 2). Hearth was held 300 to 68,580 ticks in five `dry-north` seeds and 1,300 and 17,680 ticks in two `dry-west` seeds; thirst reached 100 in those seven and in no `control-north` seed (the highest was 82). Filed as its own task.

## What this does not measure

- Dwarves that choose to drink at a brook beside a **well** or from a built well: none was built.
- A defence: the harness raises the hearth alert and a three-member squad exists, as in the instrument; no wall, gate or trap covers the bank.
- The mood cost of water (−2 per drink, 15 § Thoughts): `DrankWater` is counted, mood was not read.
- Brooks of different length, rivers and lakes (`BROOK_LENGTH` makes a brook the first three regions of a river), or a bank between 7 and 33 tiles from the wagon.
- One year, one run per seed and variant: a single seed's outcome turns on which dwarf an animal reaches first, so the per-seed rows are evidence of what happened, not of the seed's likelihood. The sums are the figures to read.

## Reproduce

`BROOK_VARIANT=<variant> BROOK_OUT=<dir> npx vitest run --config vitest.perf.config.ts test/perf/<the probe as a .test.ts>`, about 10 minutes a variant on a quiet machine; the probe is `reports/data/2026-10-18-brook-drinking.probe.ts.txt` (the water count near the wagon is `reports/data/2026-10-18-brook-drinking-water-probe.ts.txt`) and the table above is `reports/data/2026-10-18-brook-drinking-summary.mjs.txt` over its output.
