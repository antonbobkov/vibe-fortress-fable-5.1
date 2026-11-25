# T-NEW — The defence fortress's economy makes a soldier at drill its woodcutter

**Source:** T-724 (`defence_year` on seed `defence-year`, cadence 20, master 847f59dd) · **Size:** S · **Needs:** — · **Status:** open

## Why

The economy's choices of a specialist (`specialistCandidates`, `keepWoodcutter`, the bench specialists in `three_years_economy.ts`) pass over the founders, the roles already held, the watch and the strong squad's `trained`, but not the members of the defence fortress's squad, which trains full time and does no civilian work (16). On `defence-year` at cadence 20 the founding woodcutter died in the ambush of day 153, and from then to the end the economy's woodcutter was an immigrant in the squad at drill (318767569): `keepWoodcutter` dedicated him to woodcutting and carpentry, `keepToolLaborsOffTheSquad` took the woodcutting off him again, and nobody was kept on felling. The same can happen with the builder and the furnaces' workers, whom `specialistCandidates` chooses; a bench specialist chosen so is named to its workshop and taken out of the squad (`keepNamedWorkersAtTheirShops`), which keeps the squad short.

T-724 adds the squad's members it takes from the specialists to `fortress.strong.trained`, so the economy passes over them; the other members are still candidates.

## What to do

Decisions:

- **The defence script keeps its squad's members (and those stood down) in `fortress.strong.trained`** at each look, so no economy choice takes a soldier at drill, as a player does not make a full-time soldier the woodcutter. The defence fortress has no strong squad (`strongSquad = false`), so nothing else reads the list there; check `keepWoodcutter`'s founder rule (a founder in `trained` counts as gone) and `keepACarpenter` (which then never names a member carpenter).
- Measure with `defence_seeds` (both verdict rules; living and deaths a seed against master's). The three-year script is not changed, so no sweep.

## Done

- [ ] No specialist role is held by a member of the defence squad at drill in `defence_year`.
- [ ] `defence_seeds` verdict passes; living and deaths a seed no worse than master's, pooled.
