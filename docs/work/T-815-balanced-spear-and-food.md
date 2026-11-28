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

## Done

- [ ] Balanced's loadout changed in the catalog and spec, with the marks recorded.
- [ ] Paired sweep and defence check recorded; D-252 removed from decisions.md.
