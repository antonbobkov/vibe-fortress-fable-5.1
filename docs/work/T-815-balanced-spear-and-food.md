# T-815 — Balanced brings an iron spear, and plants instead of the boar meat

**Source:** the owner's decisions of 2026-11-28 on D-252 ([T-621](../archive/tasks/T-621-food-rot-unseen.md), [decisions.md](../decisions.md)) and the T-605 finding 29 ([report](../../reports/audits/2026-11-18-t605-first-hour-ux.md)) · **Size:** S · **Needs:** — · **Status:** open

## Why

- **Spear.** The Balanced loadout brings an axe (a tool) and a crossbow (the hunter's), but no spear, while the embark hint, the shelter hint, the Military panel and Help all advise iron spears. A first squad has no weapon to claim (T-618 finding 4).
- **Food (D-252).** Balanced brings 10 easy meals, 20 turnip, 20 dimcap and 10 boar meat: 60 units, about 15 to 18 days for seven dwarves, and the meat rots by day 6.

## What to do

Owner's decisions (2026-11-28):

- **Add an iron spear to Balanced.** Find the marks within its budget (06 § Supplies, `embark-catalog.md`); record what was traded for it.
- **D-252 option (4):** the boar meat's 60 marks become one more 20 turnip and one more 20 dimcap (48 marks): 90 units, about 20 days on the ground, about 27 with barrels. The alert before food rots warns before day 20.
- Remove D-252 from `docs/decisions.md` once folded into the spec.

Measure: the embark changes every sweep timeline that starts from Balanced. Pair a sweep with master at the same base (temporary branch, deleted after), plus the defence check. Adopt if paired deaths stay within about 8; the spear may well lower them.

## Decisions made in the work

- **What paid for the spear: the five iron bars (90 marks).** Balanced was 1,480 of 1,500; the food swap saves 12 (60 out, 48 in) and the spear costs 108, so 76 had to go. Balanced brings no anvil, and a forge needs one, so its bars could become only candle stands and the carpenter's wooden shields (a log and a bar each) until a caravan sold an anvil; a spear is what a forge would have made of one. The cost: the carpenter's Shield now waits for a bar from a smelter or a caravan; the buckler (a log) is still made at once. The charcoal stays (the smelter needs no anvil). New total **1,486**. Rejected: copper picks or a copper axe for the iron ones (slower work every day), one dog (a pair breeds), and the leather, strawberry seed and chairs (79; the chairs make the first dining seat, strawberry is the first spring crop, and several fixtures place the wagon's chair).
- **The advice.** The embark hint now reads "Bring an iron spear for each soldier; clubs lose to boars." (it said "iron spears", and Balanced brings one), and the catalog's rules of thumb carry the same line with "Balanced brings one". The shelter hint ("arm it with iron spears"), the Military panel's no-squad tip ("A squad of three with iron spears and a kill order holds off boars.") and Help's Start item 7 ("a squad [m] with iron spears") were checked and left as they are: they agree with a wagon that brings one spear, and the Military panel's armed line names who lacks one and says where to get it.
- **The sweep's player.** It already buys three spears (two at perils 2 and 4) and sets the count outright, so the wagon's spear changes nothing there; what reaches it is the 40 more plants, and the bars gone. Where its anvil comes in the wagon (perils 2 and 4) its forge makes the squad's kit from day 1 out of the wagon's bars, so it now buys five iron bars (90) with the anvil, as a player who buys an anvil buys something to forge. At peril 2 that is 20 marks over the 1,700, and its existing rule drops two of the three starter beds (the table and chairs are already gone). At peril 0 it has no anvil until the first caravan and buys no bars.
- **Fixtures.** The homestead fixture keeps the loadout it had (one bag of turnips, the bars, no spear), since its subject is the animals.
- **The spear's place in the list: after the quiver.** With the spear listed second (after the axe) the one-seed `year_one` scenario lost two dwarves to infected badger bites; with each part alone (the food; the spear with the bars; the spear for the bars), and with the whole change listed with the spear last or after the quiver, it lost none. The wagon's list order sets the items' ids and so the timeline: this is one timeline's luck, not the loadout, and the sweep's pooled shifts are the measure. The spear is listed after the hunter's kit.
- **Tests that held a timeline.** `bd_cistern_well`'s "pulled open and at once shut" sent the second pull up to 20 ticks after the first was done, by when its puller had gone off to other work and the gate stood open 160 ticks; it now sends it on the tick the first is done (20 ticks open, as before). `t675`'s per-step check that no animal stands on the map's edge became a check that no walk's target lies on one (08 § Tame behavior: a walk round a tree may cross an edge tile; the target never is one).

## Done

- [ ] Balanced's loadout changed in the catalog and spec, with the marks recorded.
- [ ] Paired sweep and defence check recorded; D-252 removed from decisions.md.
