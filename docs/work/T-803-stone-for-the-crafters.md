# T-803 — A crafter can reach masterwork: stone comes in a quantity a craft can train on, and the workshop says why it waits

**Source:** playtest 9 ([report](../../reports/data/2026-11-26-playtest-9.md), findings 1 and 2); playtest 7 ("no masterwork in six years") · **Size:** M · **Needs:** — · **Status:** done

## Why

A masterwork needs a quality roll of 105: `skill × 5 + rng.int(0, 40)`, so level 13 at the least (12 § Quality). Level 13 is 5,980 experience (10 § Skills and experience). Stone crafts give 8 a job, so a stone crafter needs about 750 jobs, and 750 raw stones, before the first roll can land. A dug rock tile drops a stone 300‰ of the time (`MINING_STONE_DROP_PERMILLE`, *unmeasured*), so that is about 2,500 tiles of rock for one crafter.

In practice the stone never comes:

- **Playtest 9, fortress A** (Emberdelve, peril 1). From day 4 one dwarf, Frode Brightward (crafting 5), was the craftsdwarf's assigned worker, with a 999-crafts order behind the script's own. He reached crafting 6 on day 48, 7 on day 176 and 8 on day 293. In a sampled stretch of 4 days (from day 56) he spent 580 ticks a day on "Craft (recipe)" and made one craft a day: he walked up six levels from the hall to the surface workshop for each stone, as it was dug. On day 56 the whole fortress held 4 raw stones. In 224 days the fortress used about 160 stones in all: 119 stone-craft jobs, 22 blocks, 10 doors, 6 tables, 1 chair.
- **Statues starve behind the crafter.** A statue takes 3 stones at once; stone crafts take 1. The mason's "≥2 Statue" order (from day 20) made its first statue on day 273. In the browser game I moved the statue order to the top of the mason's list on Year 2 autumn day 17 and it still made none in 28 days: "≥2 Statue · needs 3 stones, 2 in stock". Suspending the craftsdwarf's workshop gave one statue in 18 days and two more in the next 28.
- **The advice is for a new embark.** The workshop of a fortress that has dug rock for a year reads "Waiting for stone (0 available) - dig down to rock: the soil here is N levels deep" (`stoneAdvice`, `ui/messages.ts:452-461`). It never says that rock gives stone only three times in ten, or which orders took it ("31 blocks in stock" sat at the mason).
- **Playtest 7's Year 7 save** (80 dwarves, wealth 122,309): best crafting 8, the assigned worker's; "≥444 Stone crafts · queued … Waiting for inputs". Mining had reached 16 and the soldiers 19: skills whose work needs no input train; craft skills do not.

`balance.md` § Wealth curve lists masterworks among the Year 3 wealth drivers. In playtests 7, 8 and 9 none was ever made.

## What to do

Decisions taken here:

- **Stone drops more often:** `MINING_STONE_DROP_PERMILLE` 300 → 1000 for `stone` (obsidian stays at 300). A dug tile is a stone, as a player expects from the word "dig". The stone that piles up is the trade-off: a player stockpiles it, or dumps it with [d x]. Measure it in the twenty-seed sweep (items, ms per day, deaths) before it lands. If the item count costs too much time, fall back to 500‰ and say so here.
- **The waiting line names the cause in a dug fortress.** When rock has been dug (the fortress has mined at least one stone tile), the stone advice reads "dig more rock: 3 in 10 tiles give a stone" (with the drop rate as it then stands), followed by the orders that hold stone: "Mason's workshop #1 keeps 30 blocks". The soil-depth line stays for a fortress that has not reached rock.
- **An order whose inputs are a set waits its turn.** A 3-stone statue order that has waited `ORDER_AHEAD_TICKS` while 1-stone orders of the same priority took every stone reserves stones as they come. It does not wait for all three. Spec it in 12 § Operation step 2.
- **Masterworks are reachable by about Year 3 for a dedicated crafter.** That is the measure for this task. Add a sweep line: the best crafting/masonry/carpentry level at Year 3, and the count of masterworks.

## Decided while doing it

- **Neither rule is taken (the orchestrator, 2026-11-27).** The drop rate stays 300‰ and the set of stone does not gather: against the base this was built on (61723338, sweep 45911220303: living 1,139.75, deaths 108.5), 500‰ added 13.75 deaths, over the bar, and gave no masterwork by Year 3. The UI parts stay: the dug fortress's advice (with the rate as it stands, "3 in 10"), the saved `rockDug` flag it reads, and the sweep's crafts line. The stone rate goes with the crafter's pace into T-NEW-crafter-trains-faster. Twenty-seed sweep, four shifts, each with the set of stone below:

  | Drop | Living at year 3 | Dwarf deaths | Need deaths | Extinct | Raw stone (median) | Items (median) | Verdict |
  |---|---|---|---|---|---|---|---|
  | base 61723338 (300, run 45911220303) | 1,139.75 | 108.5 | | | | | |
  | 1000 (run 45928628497) | 1,093.25 | 135.75 | 1.25 | 0.25 | 611 | 2,167 | blocked: deaths |
  | 500 (run 45949777523) | 1,152.5 | 122.25 | 0.25 | 0 | 189 | 1,592 | pass, but +13.75 deaths |

  The annual instrument passed at both (1000: run 45928631650, pooled median 13, worst 8.5, sum 152.75; 500: run 45949780444, median 12.94, worst 7.38, sum 150.38). The sweep's crafts line at 500‰: best crafting a median 8 (0 to 9) at year 3, no masterwork.
- **"Rock has been dug"** is a saved flag of 03, `rockDug`, set by any mined tile of class `stone` (dig, a ramp, stairs cut into a wall), with the reader `terrain.rockDug()`. The advice reads "dig more rock: 5 in 10 tiles give a stone" (in tenths of the constant; "every tile dug gives a stone" at 1000), then "· stone goes to" the first two standing orders that take raw stone, as their rows read in Orders ("Mason's workshop #1 (≥30 Blocks)"): the order's quantity and recipe name read better than an item word, since stone crafts have no item of one name.
- **The set of stone as it was tried** (not taken): an input of more than one unit whose item types are all `stone/raw` gathered its units as they came once its order had waited `ORDER_AHEAD_TICKS`, holding the workshop's job `blocked: missing_input` meanwhile; food, drink, bars and cloth were left out, as a waiting set would hold them from eating, drinking and every other order. It was measured only together with the higher drop rates.
- **The measure was not met.** With 1000‰ playtest 9's crafter reached 12 on day 419; level 13 about day 500 and a first masterwork a month after. The sweep's fortresses make no masterwork by year 3. `balance.md` § Wealth curve now says so, and T-NEW-crafter-trains-faster takes up the pace.
- **The crafter eats the statues** (`fun-features.md`): decide again, as no rule was taken.

## Done

- [x] The drop rate measured, and kept at 300‰; 03's tuning table says why, with the measurement.
- [x] The stone advice for a dug fortress, with the orders that keep stone; a UI test (`test/unit/ui/t803-stone-advice-dug-fortress.test.ts`).
- [ ] Set orders reserve stone as it comes: tried and measured with the drop rates, not taken (above).
- [x] The sweep reports Year 3 craft levels and masterworks ("Crafts at year 3" in the verdict); balance.md § Wealth curve checked against it.
