# T-803 — A crafter can reach masterwork: stone comes in a quantity a craft can train on, and the workshop says why it waits

**Source:** playtest 9 ([report](../../reports/data/2026-11-26-playtest-9.md), findings 1 and 2); playtest 7 ("no masterwork in six years") · **Size:** M · **Needs:** — · **Status:** open

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

## Done

- [ ] The drop rate measured and set; 03 § Digging and the tuning table updated, with the measurement.
- [ ] The stone advice for a dug fortress, with the orders that keep stone; a UI test.
- [ ] Set orders reserve stone as it comes; a scenario where a statue is made beside a standing 1-stone order.
- [ ] The sweep reports Year 3 craft levels and masterworks; balance.md § Wealth curve checked against it.
