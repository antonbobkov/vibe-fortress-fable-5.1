# T-NEW — The fixtures: soldiers' picks stall the digging, and p2-6 ends without dining chairs

**Source:** T-547's runs (CI 43578890540, sweeps 43578896745 and 43586642336) · **Size:** S · **Needs:** — · **Status:** open

T-547's soil loads moved the economy fixture's timelines, and two weaknesses of the fixtures showed.

## What was seen

- **The soldiers keep the picks.** In `defence_year` (`test/scenarios/defence_year_fortress.ts`) the two founding miners are the squad's soldiers. When the squad trains (from about day 28) they keep their picks, the third miner has none, and every dig job of the fortress stays open: no room is dug from day 28 to about day 120. This happens on master too (a probe of the miners' jobs, days 20 to 60, gave the same stall); master's timeline frees a pick later, T-547's did not, and the archery target never found open floor. T-547 made the script dig the range a room of its own and take mining from the soldiers once it has (`rangeRoom` and the lines after it), which keeps the scenario green. The same run then lost 26 dwarves to the day-153 raid (printed, not asserted); `defence_seeds` passed (6.13 and 7.13 against 5 and 4, run 43586654005). Decide whether the fixture should take mining from soldiers always (as a player would), and measure it on `defence_seeds`.
- **p2-6 at shift 0 ends without a dining hall.** `three-years-p2-6` at shift 0 fails its T-156 witness "a dining hall" in both of T-547's sweeps (the verdicts passed; the other three shifts are fine). At the end of year 3 the hall's two tables are built and its four chairs are still `planned`: no chair was made for them. Find what keeps the chairs from being made on this timeline (stone, the mason's orders, the order of the furniture the fixture keeps) and make the fixture or the game hold.

## Done

Both explained; the fixture changed where it is the fixture, or a game rule fixed where it is the game; `defence_year`, `defence_seeds` and the sweep green.
