# T-NEW — The defence script leaves its squad at one soldier when every adult has a role

**Source:** T-715's CI run 45560603824 (`defence_year` on seed `defence-year`, after T-715 moved its timeline) · **Size:** S · **Needs:** — · **Status:** open

## Why

On T-715's timeline of `defence_year` a Gloam ambush on day 153 killed two of the squad's three soldiers (five fight deaths, seven in the run). From day 158 to the end (day 225) the squad trained with one soldier: the fortress script's refill (`three_years_fortress.ts`, the militia's "the fallen are replaced once the alert is down") takes no specialist, brewer, farmer or cook, and the defence script's `keepNamedWorkersAtTheirShops` refills only when it takes a workshop's named worker out. A fortress of eight adults had nobody left for either. A trial refill from adults whom no workshop names (T-715, not kept) found one recruit, who died in the next raid.

T-715 made `defence_year` count a soldier fallen in a fight in its squad of three, since a fight's deaths are printed and not asserted. Whether a player's squad of one should be filled from the specialists, or the specialists released earlier (`releaseSpecialists` acts only below seven adults), is a choice for the defence script.

## What to do

Decisions:

- **While the alert is down and the squad (with those stood down) is under `SQUAD_SIZE`, the defence script fills it from the adults whom no workshop names, those no role holds first, then specialists other than the brewer and the metal chain**, newest first; a specialist taken into the squad is released from its role.
- Measure with `defence_seeds` (both verdict rules, and living and deaths a seed against master's), since the change moves every defence timeline.

## Done

- [ ] `defence_year_fortress.ts` refills the squad as above, with a note when it does.
- [ ] `defence_seeds` verdict passes; living and deaths a seed no worse than master's, pooled.
