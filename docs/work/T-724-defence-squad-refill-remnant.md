# T-724 — The defence script leaves its squad at one soldier when every adult has a role

**Source:** T-715's CI run 45560603824 (`defence_year` on seed `defence-year`, after T-715 moved its timeline) · **Size:** S · **Needs:** — · **Status:** open

## Why

On T-715's timeline of `defence_year` a Gloam ambush on day 153 killed two of the squad's three soldiers (five fight deaths, seven in the run). From day 158 to the end (day 225) the squad trained with one soldier: the fortress script's refill (`three_years_fortress.ts`, the militia's "the fallen are replaced once the alert is down") takes no specialist, brewer, farmer or cook, and the defence script's `keepNamedWorkersAtTheirShops` refills only when it takes a workshop's named worker out. A fortress of eight adults had nobody left for either. A trial refill from adults whom no workshop names (T-715, not kept) found one recruit, who died in the next raid.

T-715 made `defence_year` count a soldier fallen in a fight in its squad of three, since a fight's deaths are printed and not asserted. Whether a player's squad of one should be filled from the specialists, or the specialists released earlier (`releaseSpecialists` acts only below seven adults), is a choice for the defence script.

## What to do

Decisions:

- **While the alert is down and the squad (with those stood down) is under `SQUAD_SIZE`, the defence script fills it from the adults whom no workshop names, those no role holds first, then specialists other than the brewer and the metal chain**, newest first; a specialist taken into the squad is released from its role.
- Measure with `defence_seeds` (both verdict rules, and living and deaths a seed against master's), since the change moves every defence timeline.

Taken (T-724): on master's timeline of `defence-year` at cadence 20 the nine adults left on day 158 were the lone soldier, the brewer, the watchman and six with a workshop (fuel, jeweler, craftdwarf and broker, forge, carpenter, builder at the mason's workshop): the rule above, which passes over every named worker, found nobody. So the refill also takes a named specialist, the least needed role first: **those no role holds and no workshop names (newest first), then the jeweler, the craftdwarf, the woodcutter, the builder and the carpenter, in that order (newest first within a role); never the metal chain (forge, smelter, fuel, charcoal), the brewer, the broker, the founding farmer and cook, or the watch.** A specialist taken in leaves its role and its workshop and is added to the strong squad's `trained` (state only; the defence fortress has no strong squad), which the economy's choices of a specialist pass over, so it is not named back to a bench and out of the squad. There the jeweler and the builder joined on day 158 and the squad stood at three to day 225.

**The assertion keeps counting the fallen.** The refill acts only while the alert is down (a civilian put in mid-fight walks out unarmed, T-387) and only from the adults it may take: a fight in the run's last days, or one that leaves a small fortress with only its kept roles, still leaves the squad short at the end, and "at least 3 standing" would again assert a fight's deaths, which are printed and not asserted.

## Done

- [x] `defence_year_fortress.ts` refills the squad as above, with a note when it does.
- [ ] `defence_seeds` verdict passes; living and deaths a seed no worse than master's, pooled.
