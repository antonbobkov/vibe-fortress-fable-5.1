# T-795 — A tomb keeps its own coffins ready: find why the measured rule cost deaths, then adopt it

**Closed:** 2026-11-26, in 8e3cc0ce, 9e92fce3, 98a6375f, cb379caf.

**Source:** T-789 ([work file](T-789-tomb-keeps-coffins.md)); playtest 7 ([report](../../../reports/data/2026-11-26-playtest-7.md), finding 5) · **Size:** M · **Needs:** — · **Status:** open

## Why

T-789 built a tomb setting, "Coffins ready" (default 2), with which 14 places coffins from stock in a tomb, farthest from its way in and never sealing it, and 12 keeps one standing coffin order "for Tomb #1" while stock is short. It works in tests (a death is buried with no player action; a full setting stops before it seals the tomb). Measured on `ef4daff2`, the twenty-seed sweep pooled living 1147.75 and deaths 121.5, 11.5 over master's ~110 (by shift 127, 104, 102, 153; the p4 seeds at shift 150 lost 30 and 34). The bounds held (deaths ≤ 132.5) and `defence_seeds` passed, but the deaths were over what T-789 allowed, so the rule was taken out. The code is in `ef4daff2` (`src/systems/buildings/tombs.ts`, `src/systems/workshops/tomb-orders.ts`, the tomb inspector in `src/ui/panels/zones.ts`, `test/unit/buildings/t789-tomb-coffins.test.ts`).

A player still buries every death by hand: order coffins, place each one, make a new tomb.

## What to do

Decisions taken here:

- First trace the two p4 seeds at shift 150 on `ef4daff2` against master: whether the deaths come from the mason's time (coffin orders ahead of the military's or the defence's work), from the stone the coffins take, from haulers carrying coffins during a raid, or are noise of one sweep (a second sweep of `ef4daff2` with other shifts answers that).
- Then adopt the rule with the fix the trace points at (for example the standing order at a lower priority than the player's orders, or no placement while the alert is above Calm), and measure again: deaths within about 8 of master and `defence_seeds` passing.
- The three-year script's `keepTheDead` keeps its own upkeep; with the rule in, it may rely on the tomb's setting instead.

Decided while doing it:

- **The trace: the two p4 seeds lost their dwarves to the timeline, not to the coffins.** Both seeds were played locally at shift 150, on `ef4daff2` and on its parent `acea9913`, with a probe (not committed) that notes every coffin made, placed, built and filled, and, for each dwarf that dies, what it was doing when it was first hit. `three-years-p4-1`: base 10 deaths, rule 30. The coffin record is the same in both up to day 71, when the third coffin is made a day later under the rule (day 72, built day 74 against 73); that is the rule's whole footprint before the two timelines part (by day 78 the drink differs by 20). The deaths come three to five months later: 2 on day 143 (none in the base), 17 against 4 in the raid of days 187 to 190, 7 on days 228 and 229. `three-years-p4-3`: base 9, rule 34. The record is the same to day 213, when the tomb's standing order makes one stone coffin more (placed day 214, built day 221). By day 232 the rule's fortress has 40 dwarves to the base's 38 and 203 drink to 246; on day 252 it meets an ambush with 26 dwarves critically thirsty (base 8) and loses 26 (base 2), the dwarves out for drink under the alert. After the two timelines part the rule's runs lose 58 dwarves to the base's 13, and none of the 58 was hauling a coffin or a body, making a coffin or building one when first hit: 22 were fleeing, 16 out for a need (drink, mostly), 9 at their post, 5 tending or being tended for wounds, 2 idle, 3 at other work (a harvest, stripping a raider's corpse in the fight, one between jobs) and 1 retreating. Every coffin of both runs was stone: no wood went to coffins, and the carpenter's barrels were not touched. So nothing the rule does puts a dwarf in danger; one coffin made a day late, or one made more, sends a peril-4 fortress down another timeline, and in these two the timeline met a raid or an ambush with the fortress outside. The fixes the trace was to choose between (no coffins under the alert, the order behind the player's, no haul until it is safe) answer nothing it found, so none is taken.
- **The rule is measured again unchanged, on this base, against a paired master sweep** (`1b293acd`, the same shifts), which tells a cost from the noise of one sweep. Master (run 45868894717): living 1167.25, deaths 114.75 (by shift 1188/117, 1145/128, 1168/111, 1168/103). The rule (`8e3cc0ce`, run 45869566024): living 1150.75, deaths 122.5 (1172/124, 1162/106, 1181/102, 1088/158), verdict pass. Paired: living −16.5, deaths +7.75. Of the 80 seed-shifts, 53 play out the same to the tick (no tomb, or the tomb's coffins and the script's agree); the other 27 differ by a sum of +31 deaths, of which the two traced above give +45 (p4-3 +25, p4-1 +20) and the other 25 together −14. The spread of a pair is 4.2 deaths, so a pooled difference has a noise of about 9 deaths: the +7.75 is inside it, and the two seeds that carry it are the two whose deaths the trace shows come from the timeline. The rule is adopted as it was measured, with no fix.
- **The defence check passes** (`defence_seeds`, run 45876018651): 7.25 raids turned back and 6.13 seeds with a soldier's kill, of 8 (rules ≥ 5, ≥ 4), as `ef4daff2` had (7.13, 6.13).
- **The three-year script keeps its own upkeep** (`keepTheDead`): it keeps one free coffin more than the unburied bodies, the tomb keeps 2 ready, and the fortress has the larger of the two. Moving the script onto the tomb's setting is a change to the harness, not to the game, and would make the paired sweep measure two changes at once.

## Done

- [x] The trace's finding, with figures (above).
- [x] The rule adopted (from `ef4daff2`); the trace found nothing to fix, so it is adopted as measured. Its tests (`t789-tomb-coffins`, `t789-tomb-ui`); 14 § Zones and § Burial, 12 § Work orders, 15's unburied line, `panels.md` § Zones and § Orders, the WorkOrder schema, the zone-type and strings tables.
- [x] The sweep and `defence_seeds` figures in the commit.
