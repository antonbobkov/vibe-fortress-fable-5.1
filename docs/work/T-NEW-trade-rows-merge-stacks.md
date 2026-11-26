# T-NEW — The trade screen merges like stacks, and a category sent to the depot leaves rot behind

**Source:** playtest 7 ([report](../../reports/data/2026-11-26-playtest-7.md), finding 9); T-738 (Stocks merges like stacks) · **Size:** M · **Needs:** — · **Status:** open

## Why

Trading at scale in Years 4 and 5 took about a hundred key presses for each offer.

- **One row per stack.** "Our goods at the depot" listed every stack on its own row: "8 turnip lavish meals 192" five times, "1 dimcap lavish meal 24" six times, "3 sandstone rings 9" three times (29-trade-at-scale.png, 30-trade-offer.png). Selling 2,040 ☼ of meals to the Hillfolk took fourteen rows of `+`. Buying 15 linen cloth from the Wildwood (323 ☼ before the cut) took eighty rows of raw plants worth 1 to 7 ☼ each, and the offer still read "Not enough. Add 156 ☼ of goods." (37-trade-wildwood.png). Stocks merged like stacks in T-738; the trade screen did not follow.
- **A category sends everything.** Stocks › pick › "food" › `[t] move` sent raw turnips and dimcap by the handful, and "8 turnip rotten food 8" and "6 dimcap rotten food 6" with them. Most of the depot's rows were raw plants and rot. The meals I wanted to sell were a filter and four levels down ("lavish meal › dimcap").
- **Piles of seed.** The Hillfolk brought "720 turnip seeds", "810 cabbage seeds", "820 barley seeds", and the Wildwood "640 strawberry seeds", "690 barley seeds". These are the request share of each caravan's budget, spent on the requested seed. They are honest, but they push every other ware down the list.

## What to do

Decisions taken here:

- **Both columns merge like stacks** as Stocks does after T-738: same item type, material, quality and state (rotten, worn) are one row with the summed count and value. `+`/`-` take one unit and `Shift` ten, and the row takes units from its stacks in their order. One trade line still names each stack (20's session is unchanged).
- **`[a]` all of this row** sets the row's quantity to all or none.
- **Moving a category to the depot skips rotten food, corpses and refuse** unless the pick names them. The pick's count says "move 152 (12 rotten left)".
- The seed piles stay: they are what the player asked for.

## Done

- [ ] The trade screen's merged rows and `[a]`; UI tests with five stacks of one meal.
- [ ] The depot pick skips rot; a test.
- [ ] `panels.md` § Trade session and § Stocks updated.
